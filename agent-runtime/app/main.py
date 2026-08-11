from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import StreamingResponse

from .config import Settings
from .runtime import AgentRuntime, load_runtime
from .schemas import ChatRequest, ChatResponse
from .security import runtime_key_matches


# 编排要跑 60–150 秒，中间可能几十秒没有任何工具事件。若整段静默，
# Cloudflare 会掐掉 Worker→ADK Runtime 的子请求并合成 520，源站算出的 200 会被丢掉。
# 因此空闲时必须持续吐心跳注释帧，让字节不断流动。
_HEARTBEAT_SECONDS = 10.0

# 每次改动 Worker 与 Runtime 之间的流式契约都要往上推一版，
# 发布前用 /health 核对，避免 Worker 先上而 Runtime 还是旧代码。
RUNTIME_CONTRACT = "repair-round-2"


settings = Settings.from_env()


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.runtime = await load_runtime(settings) if settings.ready else None
    yield


app = FastAPI(title="Giverny ADK Agent Runtime", version="2.0.0", lifespan=lifespan)


def authorize(x_adk_runtime_key: str | None = Header(default=None)) -> None:
    if not runtime_key_matches(settings.runtime_key, x_adk_runtime_key):
        raise HTTPException(status_code=401, detail="ADK Runtime 未授权")


@app.get("/health")
async def health(request: Request):
    runtime_ready = isinstance(getattr(request.app.state, "runtime", None), AgentRuntime)
    return {
        "ok": runtime_ready and settings.ready,
        "runtime": "google-adk-2",
        "framework": "google-adk",
        "modelPolicy": "exact-selected-model-no-fallback",
        # 契约标记让"Runtime 是否已经先于 Worker 发布"变成可核对的事实。
        # Worker 依赖 accepted 帧的 reasoning 字段与推理消毒，旧代码不具备。
        "contract": RUNTIME_CONTRACT,
        "turnBudgetSeconds": settings.turn_budget_seconds,
        "missing": settings.missing(),
    }


@app.post("/v1/chat", response_model=ChatResponse, dependencies=[Depends(authorize)])
async def chat(payload: ChatRequest, request: Request) -> ChatResponse:
    runtime = getattr(request.app.state, "runtime", None)
    if not isinstance(runtime, AgentRuntime):
        raise HTTPException(status_code=503, detail="ADK Runtime 尚未就绪")
    try:
        return await runtime.chat(payload)
    except TimeoutError as error:
        raise HTTPException(status_code=504, detail="ADK Agent 执行超时") from error
    except Exception as error:
        raise HTTPException(status_code=502, detail="这一轮没能完成，请稍后再试一次。") from error


def _sse(payload: dict) -> bytes:
    return f"data: {json.dumps(payload, ensure_ascii=False, default=str)}\n\n".encode()


@app.post("/v1/chat/stream", dependencies=[Depends(authorize)])
async def chat_stream(payload: ChatRequest, request: Request) -> StreamingResponse:
    runtime = getattr(request.app.state, "runtime", None)
    if not isinstance(runtime, AgentRuntime):
        raise HTTPException(status_code=503, detail="ADK Runtime 尚未就绪")

    queue: asyncio.Queue[dict | None] = asyncio.Queue()

    async def on_step(text: str) -> None:
        await queue.put({"type": "step", "detail": text})

    async def on_thought(text: str) -> None:
        # 推理内容按块下发，前端做打字机式替换而不是逐条累积。
        await queue.put({"type": "thinking", "detail": text})

    async def run() -> None:
        try:
            response = await runtime.chat(payload, on_step=on_step, on_thought=on_thought)
            await queue.put({"type": "result", "response": response.model_dump(by_alias=True)})
        except TimeoutError:
            await queue.put({"type": "error", "status": 504, "detail": "ADK Agent 执行超时"})
        except Exception as error:  # noqa: BLE001 - 技术细节进审计字段，不进用户界面
            # detail 会一路显示到聊天气泡里。把框架异常原样放进去，用户就会看到
            # 「Max number of llm calls limit of 4 exceeded」这种东西。
            await queue.put({
                "type": "error",
                "status": 502,
                "detail": "这一轮没能完成，请稍后再试一次。",
                "technical": f"{type(error).__name__}: {error}",
            })
        finally:
            await queue.put(None)

    async def events() -> AsyncIterator[bytes]:
        task = asyncio.create_task(run())
        try:
            # 先发一帧，握手立即完成，Worker 不必等第一个编排事件。
            # reasoning 说明本轮有没有向供应商申请推理输出：混合推理模型没打开开关
            # 就永远不会有 thought part，前端不能一直挂着"等待模型返回推理内容"。
            yield _sse({
                "type": "accepted",
                "conversationId": payload.conversation_id,
                "reasoning": runtime.reasoning_stream_expected(payload),
            })
            while True:
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=_HEARTBEAT_SECONDS)
                except TimeoutError:
                    yield b": keep-alive\n\n"
                    continue
                if item is None:
                    break
                yield _sse(item)
        finally:
            # 客户端断开时不要把编排任务留成孤儿。
            if not task.done():
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"cache-control": "no-cache, no-transform", "x-accel-buffering": "no"},
    )
