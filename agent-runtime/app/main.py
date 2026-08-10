from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException, Request

from .config import Settings
from .runtime import AgentRuntime, load_runtime
from .schemas import ChatRequest, ChatResponse
from .security import runtime_key_matches


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
        "coordinatorModel": settings.coordinator_model,
        "auditorModel": settings.auditor_model,
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
        raise HTTPException(status_code=502, detail=f"ADK Agent 执行失败：{error}") from error
