from __future__ import annotations

import contextvars
import json
import os
from typing import Any

import httpx
from agents import function_tool

from .schemas import TraceEvent


_trace_events: contextvars.ContextVar[list[TraceEvent] | None] = contextvars.ContextVar(
    "trace_events",
    default=None,
)


def start_trace() -> contextvars.Token[list[TraceEvent] | None]:
    return _trace_events.set([])


def finish_trace(token: contextvars.Token[list[TraceEvent] | None]) -> list[TraceEvent]:
    events = _trace_events.get() or []
    _trace_events.reset(token)
    return events


def append_trace(
    event_type: str,
    label: str,
    detail: str | None = None,
    payload: dict[str, Any] | None = None,
) -> None:
    events = _trace_events.get()
    if events is None:
        return
    events.append(
        TraceEvent(
            type=event_type,  # type: ignore[arg-type]
            label=label,
            detail=detail,
            payload=payload,
        ),
    )


def _headers() -> dict[str, str]:
    token = os.getenv("GIVERNY_AGENT_TOOL_TOKEN", "").strip()
    if not token:
        return {}
    return {"Authorization": f"Bearer {token}"}


async def _get_json(endpoint: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    base_url = os.getenv("GIVERNY_API_BASE_URL", "https://mayeai.com").rstrip("/")
    url = f"{base_url}/api/agent/tools/{endpoint}"
    clean_params = {
        key: value
        for key, value in (params or {}).items()
        if value is not None and value != ""
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, headers=_headers(), params=clean_params)
    if response.status_code >= 400:
        raise RuntimeError(
            f"Giverny tool {endpoint} failed with HTTP {response.status_code}: {response.text[:300]}",
        )
    data = response.json()
    if not isinstance(data, dict):
        raise RuntimeError(f"Giverny tool {endpoint} returned a non-object payload.")
    return data


@function_tool
async def query_month_finance(
    question: str,
    current_month: str | None = None,
    months: str | None = None,
) -> str:
    """Query Giverny monthly finance data, billable hours, and income statistics."""
    params = {"question": question, "currentMonth": current_month, "months": months}
    append_trace("tool", "查询月份金额", "读取工时、计费状态和收入统计。", params)
    data = await _get_json("month-finance", params)
    append_trace("result", "月份金额已返回", payload=data)
    return json.dumps(data, ensure_ascii=False)


@function_tool
async def search_tasks(query: str, month: str | None = None, limit: int = 8) -> str:
    """Search Giverny tasks by title, requirement, people, or month."""
    params = {"query": query, "month": month, "limit": limit}
    append_trace("tool", "搜索任务", "按任务名称、需求、人员或月份检索。", params)
    data = await _get_json("search-tasks", params)
    append_trace("result", "任务搜索已返回", payload=data)
    return json.dumps(data, ensure_ascii=False)


@function_tool
async def get_task_detail(task_id: int | None = None, title: str | None = None) -> str:
    """Get a task detail by task id or approximate title."""
    params = {"taskId": task_id, "title": title}
    append_trace("tool", "读取任务详情", "查看任务基础信息、进展、验收与附件。", params)
    data = await _get_json("task-detail", params)
    append_trace("result", "任务详情已返回", payload=data)
    return json.dumps(data, ensure_ascii=False)


@function_tool
async def get_giverny_context() -> str:
    """Get Giverny workspace context and current platform summary."""
    append_trace("tool", "读取工作台上下文", "获取当前平台概览。")
    data = await _get_json("context")
    append_trace("result", "工作台上下文已返回", payload=data)
    return json.dumps(data, ensure_ascii=False)
