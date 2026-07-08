from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    currentMonth: str | None = None
    conversationId: str | None = None
    debug: bool = False


class TraceEvent(BaseModel):
    type: Literal["plan", "tool", "result", "error"]
    label: str
    detail: str | None = None
    payload: dict[str, Any] | None = None


class ChatResponse(BaseModel):
    answer: str
    trace: list[TraceEvent] = Field(default_factory=list)
    conversationId: str | None = None
    model: str
