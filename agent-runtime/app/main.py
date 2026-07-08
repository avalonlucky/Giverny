from __future__ import annotations

import os
import re

from agents import Agent, Runner
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .giverny_tools import (
    append_trace,
    finish_trace,
    get_giverny_context,
    get_task_detail,
    query_month_finance,
    search_tasks,
    start_trace,
)
from .schemas import ChatRequest, ChatResponse


load_dotenv()

MODEL = os.getenv("OPENAI_AGENT_MODEL", "gpt-4.1-mini")

app = FastAPI(title="Giverny Agent Runtime", version="0.1.0")

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


def build_agent() -> Agent:
    return Agent(
        name="Giverny Agent",
        model=MODEL,
        instructions=(
            "你是爱丽丝，也是 Giverny 工作助手。你不是普通聊天机器人，而是用户的长期工作智能体。\n"
            "你可以闲聊、解释平台数据、协助写作、梳理任务，也可以调用工具读取 Giverny 的真实任务数据。\n\n"
            "工作原则：\n"
            "- 当用户询问任务、收入、金额、工时、结算、验收、附件、进展时，必须优先调用工具，不要凭空估算。\n"
            "- 金额、工时、月份、任务数量必须以工具返回的数据为准。\n"
            "- 如果工具没有返回某项数据，要明确说明缺失，不要编造。\n"
            "- 如果用户只是闲聊或问通用问题，可以直接回答。\n"
            "- 不要输出 <think> 标签或原始内心推理；如需说明过程，用简短、可读的工作步骤概括。\n"
            "- 回答要像真正的工作助手：清楚、温和、直接，优先给结论，再补充必要依据。"
        ),
        tools=[
            query_month_finance,
            search_tasks,
            get_task_detail,
            get_giverny_context,
        ],
    )


@app.get("/health")
async def health() -> dict[str, str | bool]:
    return {"ok": True, "model": MODEL}


@app.post("/v1/chat", response_model=ChatResponse, dependencies=[Depends(verify_runtime_key)])
async def chat(request: ChatRequest) -> ChatResponse:
    trace_token = start_trace()
    append_trace(
        "plan",
        "理解问题",
        "判断是否需要读取 Giverny 数据；如涉及任务、金额、工时或验收，会优先调用工具。",
        {"message": request.message, "currentMonth": request.currentMonth},
    )

    try:
        prompt = (
            f"用户问题：{request.message}\n"
            f"当前月份：{request.currentMonth or '未知'}\n"
            f"会话 ID：{request.conversationId or '未提供'}"
        )
        result = await Runner.run(build_agent(), prompt)
        answer = normalize_answer(result.final_output or "")
        trace = finish_trace(trace_token)
        if not request.debug:
            trace = [
                event
                for event in trace
                if event.type in {"plan", "tool", "result", "error"}
            ]
        return ChatResponse(
            answer=answer,
            trace=trace,
            conversationId=request.conversationId,
            model=MODEL,
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
