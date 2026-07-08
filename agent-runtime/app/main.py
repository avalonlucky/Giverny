from __future__ import annotations

import json
import os
import re
from typing import Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI

from .giverny_tools import TOOL_DEFINITIONS, append_trace, dispatch_tool, finish_trace, start_trace
from .schemas import ChatRequest, ChatResponse


load_dotenv()

PROVIDER = os.getenv("AGENT_MODEL_PROVIDER", "deepseek").strip().lower()
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash")
OPENAI_MODEL = os.getenv("OPENAI_AGENT_MODEL", "gpt-4.1-mini")
MODEL = DEEPSEEK_MODEL if PROVIDER == "deepseek" else OPENAI_MODEL

SYSTEM_PROMPT = (
    "你是爱丽丝，也是 Giverny 工作助手。你不是普通聊天机器人，而是用户的长期工作智能体。\n"
    "你可以闲聊、解释平台数据、协助写作、梳理任务，也可以调用工具读取 Giverny 的真实任务数据。\n\n"
    "工作原则：\n"
    "- 当用户询问任务、收入、金额、工时、结算、验收、附件、进展时，必须优先调用工具，不要凭空估算。\n"
    "- 金额、工时、月份、任务数量必须以工具返回的数据为准。\n"
    "- 如果工具没有返回某项数据，要明确说明缺失，不要编造。\n"
    "- 当前只开放只读工具；如果用户要求新建任务、修改任务、记录反馈或写入数据，要先说明暂不能直接写入，再给出需要补齐的信息或后续执行建议。\n"
    "- 如果用户只是闲聊或问通用问题，可以直接回答。\n"
    "- 不要输出 <think> 标签或原始内心推理；如需说明过程，用简短、可读的工作步骤概括。\n"
    "- 回答要像真正的工作助手：清楚、温和、直接，优先给结论，再补充必要依据。"
)

app = FastAPI(title="Giverny Agent Runtime", version="0.2.0")

cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "AGENT_RUNTIME_CORS_ORIGINS",
        "http://localhost:5173,https://mayeai.com",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


async def verify_runtime_key(x_agent_runtime_key: str | None = Header(default=None)) -> None:
    expected = os.getenv("AGENT_RUNTIME_KEY", "").strip()
    if expected and x_agent_runtime_key != expected:
        raise HTTPException(status_code=401, detail="Invalid agent runtime key.")


def normalize_answer(answer: str) -> str:
    without_think = re.sub(r"<think>.*?</think>", "", answer, flags=re.DOTALL | re.IGNORECASE)
    without_open_tag = re.sub(r"</?think>", "", without_think, flags=re.IGNORECASE)
    return without_open_tag.strip()


def build_client() -> AsyncOpenAI:
    if PROVIDER == "deepseek":
        api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
        base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").strip().rstrip("/")
    else:
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").strip().rstrip("/")
    if not api_key:
        raise RuntimeError(f"{PROVIDER.upper()} API key is not configured.")
    return AsyncOpenAI(api_key=api_key, base_url=base_url)


def parse_arguments(raw_arguments: str | None) -> dict[str, Any]:
    if not raw_arguments:
        return {}
    try:
        parsed = json.loads(raw_arguments)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


@app.get("/health")
async def health() -> dict[str, str | bool]:
    return {"ok": True, "provider": PROVIDER, "model": MODEL}


@app.post("/v1/chat", response_model=ChatResponse, dependencies=[Depends(verify_runtime_key)])
async def chat(request: ChatRequest) -> ChatResponse:
    trace_token = start_trace()
    append_trace(
        "plan",
        "理解问题",
        "判断是否需要读取 Giverny 数据；如涉及任务、金额、工时或验收，会优先调用工具。",
        {"message": request.message, "currentMonth": request.currentMonth, "provider": PROVIDER, "model": MODEL},
    )

    try:
        client = build_client()
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"用户问题：{request.message}\n"
                    f"当前月份：{request.currentMonth or '未知'}\n"
                    f"会话 ID：{request.conversationId or '未提供'}"
                ),
            },
        ]

        final_answer = ""
        for _ in range(4):
            completion = await client.chat.completions.create(
                model=MODEL,
                messages=messages,
                tools=TOOL_DEFINITIONS,
                tool_choice="auto",
                temperature=0.2,
            )
            message = completion.choices[0].message
            message_payload = message.model_dump(exclude_none=True)
            messages.append(message_payload)

            tool_calls = message.tool_calls or []
            if not tool_calls:
                final_answer = normalize_answer(message.content or "")
                break

            for tool_call in tool_calls:
                tool_name = tool_call.function.name
                arguments = parse_arguments(tool_call.function.arguments)
                append_trace("tool", f"模型调用工具：{tool_name}", payload=arguments)
                try:
                    tool_output = await dispatch_tool(tool_name, arguments)
                except Exception as exc:
                    tool_output = json.dumps({"error": str(exc)}, ensure_ascii=False)
                    append_trace("error", f"工具执行失败：{tool_name}", str(exc), arguments)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": tool_output,
                    },
                )
        else:
            final_answer = "我已经读取了相关数据，但这次工具调用轮次过多，先暂停，避免继续消耗。请把问题缩小一点再问我。"

        trace = finish_trace(trace_token)
        if not request.debug:
            trace = [
                event
                for event in trace
                if event.type in {"plan", "tool", "result", "error"}
            ]
        return ChatResponse(
            answer=final_answer or "我这次没有生成有效回答。",
            trace=trace,
            conversationId=request.conversationId,
            model=f"{PROVIDER}:{MODEL}",
        )
    except Exception as exc:
        append_trace("error", "Agent 运行失败", str(exc))
        trace = finish_trace(trace_token)
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Agent runtime failed.",
                "error": str(exc),
                "trace": [event.model_dump() for event in trace],
            },
        ) from exc
