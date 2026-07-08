from __future__ import annotations

import contextvars
import json
import os
from typing import Any

import httpx

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


async def _post_json(endpoint: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    base_url = os.getenv("GIVERNY_API_BASE_URL", "https://mayeai.com").rstrip("/")
    url = f"{base_url}/api/agent/tools/{endpoint}"
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(url, headers={**_headers(), "content-type": "application/json"}, json=payload or {})
    if response.status_code >= 400:
        raise RuntimeError(
            f"Giverny tool {endpoint} failed with HTTP {response.status_code}: {response.text[:300]}",
        )
    data = response.json()
    if not isinstance(data, dict):
        raise RuntimeError(f"Giverny tool {endpoint} returned a non-object payload.")
    return data


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


async def search_tasks(query: str, month: str | None = None, limit: int = 30) -> str:
    """Search Giverny tasks by title, requirement, status intent, people, or month."""
    params = {"query": query, "month": month, "limit": limit}
    append_trace("tool", "搜索任务", "按月份、状态意图、任务名称、需求或人员检索。", params)
    data = await _get_json("search-tasks", params)
    append_trace("result", "任务搜索已返回", payload=data)
    return json.dumps(data, ensure_ascii=False)


async def get_task_detail(task_id: int | None = None, title: str | None = None) -> str:
    """Get a task detail by task id or approximate title."""
    params = {"taskId": task_id, "title": title}
    append_trace("tool", "读取任务详情", "查看任务基础信息、进展、验收与附件。", params)
    data = await _get_json("task-detail", params)
    append_trace("result", "任务详情已返回", payload=data)
    return json.dumps(data, ensure_ascii=False)


async def get_giverny_context() -> str:
    """Get Giverny workspace context and current platform summary."""
    append_trace("tool", "读取工作台上下文", "获取当前平台概览。")
    data = await _get_json("context")
    append_trace("result", "工作台上下文已返回", payload=data)
    return json.dumps(data, ensure_ascii=False)


async def write_tool(endpoint: str, label: str, payload: dict[str, Any]) -> str:
    append_trace("tool", label, payload=payload)
    data = await _post_json(endpoint, payload)
    append_trace("result", f"{label}已返回", payload=data)
    return json.dumps(data, ensure_ascii=False)


TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "query_month_finance",
            "description": "Query Giverny monthly finance data, billable hours, and income statistics.",
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {"type": "string", "description": "Original user question."},
                    "current_month": {"type": "string", "description": "Current month in YYYY-MM format."},
                    "months": {
                        "type": "string",
                        "description": "Optional comma-separated settlement months, for example 2026-06,2026-07.",
                    },
                },
                "required": ["question"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_tasks",
            "description": "Search Giverny tasks by title, requirement, status intent, people, or month. For questions like unfinished/overdue tasks in a month, pass the month and the original user query; the Worker will first load the month scope and then filter by status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search keyword or natural-language query."},
                    "month": {"type": "string", "description": "Optional settlement month in YYYY-MM format."},
                    "limit": {"type": "integer", "description": "Maximum number of tasks to return. Use 30 or more for month-level status questions."},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_task_detail",
            "description": "Get one task detail by task id or approximate title.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "integer", "description": "Task ID."},
                    "title": {"type": "string", "description": "Approximate task title."},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_giverny_context",
            "description": "Get Giverny workspace context and current platform summary.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_task_preview",
            "description": "Preview a new task draft. Call this before creating a task.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "requirement": {"type": "string"},
                    "type": {"type": "string"},
                    "startDate": {"type": "string", "description": "YYYY-MM-DDTHH:mm"},
                    "estimatedDate": {"type": "string", "description": "YYYY-MM-DDTHH:mm"},
                    "settlementMonth": {"type": "string", "description": "YYYY-MM"},
                    "estimatedHours": {"type": "number"},
                    "requester": {"type": "string"},
                    "contact": {"type": "string"},
                    "reviewer": {"type": "string"},
                    "billable": {"type": "boolean"},
                    "isSupplemental": {"type": "boolean"},
                    "currentMonth": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_task",
            "description": "Create a task after the user explicitly confirms a create_task_preview.",
            "parameters": {"type": "object", "properties": {"confirmationToken": {"type": "string"}}, "required": ["confirmationToken"]},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "record_feedback_preview",
            "description": "Preview recording client feedback or revision notes on a task.",
            "parameters": {
                "type": "object",
                "properties": {
                    "taskId": {"type": "integer"},
                    "taskTitle": {"type": "string"},
                    "note": {"type": "string"},
                    "feedbackVersion": {"type": "string"},
                    "feedbackSource": {"type": "string"},
                    "dateTime": {"type": "string", "description": "YYYY-MM-DDTHH:mm"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "record_feedback",
            "description": "Record client feedback after explicit user confirmation.",
            "parameters": {"type": "object", "properties": {"confirmationToken": {"type": "string"}}, "required": ["confirmationToken"]},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_task_status_preview",
            "description": "Preview changing a task status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "taskId": {"type": "integer"},
                    "taskTitle": {"type": "string"},
                    "status": {"type": "string", "enum": ["计划中", "进行中", "挂起", "待验收", "已验收", "终止", "不计费"]},
                    "progress": {"type": "integer"},
                    "reason": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_task_status",
            "description": "Update task status after explicit user confirmation.",
            "parameters": {"type": "object", "properties": {"confirmationToken": {"type": "string"}}, "required": ["confirmationToken"]},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_task_fields_preview",
            "description": "Preview editing safe task fields such as title, requirement, type, schedule, people, billable, notes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "taskId": {"type": "integer"},
                    "taskTitle": {"type": "string"},
                    "fields": {"type": "object", "additionalProperties": True},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_task_fields",
            "description": "Update task fields after explicit user confirmation.",
            "parameters": {"type": "object", "properties": {"confirmationToken": {"type": "string"}}, "required": ["confirmationToken"]},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "append_progress_preview",
            "description": "Preview appending a progress/time entry to a task.",
            "parameters": {
                "type": "object",
                "properties": {
                    "taskId": {"type": "integer"},
                    "taskTitle": {"type": "string"},
                    "note": {"type": "string"},
                    "startDateTime": {"type": "string", "description": "YYYY-MM-DDTHH:mm"},
                    "endDateTime": {"type": "string", "description": "YYYY-MM-DDTHH:mm"},
                    "isUncounted": {"type": "boolean"},
                    "isRevision": {"type": "boolean"},
                    "isAcceptanceProgress": {"type": "boolean"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "append_progress",
            "description": "Append progress after explicit user confirmation.",
            "parameters": {"type": "object", "properties": {"confirmationToken": {"type": "string"}}, "required": ["confirmationToken"]},
        },
    },
]


async def dispatch_tool(name: str, arguments: dict[str, Any]) -> str:
    if name == "query_month_finance":
        return await query_month_finance(
            question=str(arguments.get("question") or ""),
            current_month=arguments.get("current_month"),
            months=arguments.get("months"),
        )
    if name == "search_tasks":
        raw_limit = arguments.get("limit", 8)
        limit = raw_limit if isinstance(raw_limit, int) else 8
        return await search_tasks(
            query=str(arguments.get("query") or ""),
            month=arguments.get("month"),
            limit=limit,
        )
    if name == "get_task_detail":
        raw_task_id = arguments.get("task_id")
        task_id = raw_task_id if isinstance(raw_task_id, int) else None
        return await get_task_detail(task_id=task_id, title=arguments.get("title"))
    if name == "get_giverny_context":
        return await get_giverny_context()
    write_tool_map = {
        "create_task_preview": ("create-task-preview", "预览新建任务"),
        "create_task": ("create-task", "创建任务"),
        "record_feedback_preview": ("record-feedback-preview", "预览记录反馈"),
        "record_feedback": ("record-feedback", "记录反馈"),
        "update_task_status_preview": ("update-task-status-preview", "预览修改状态"),
        "update_task_status": ("update-task-status", "修改状态"),
        "update_task_fields_preview": ("update-task-fields-preview", "预览修改字段"),
        "update_task_fields": ("update-task-fields", "修改字段"),
        "append_progress_preview": ("append-progress-preview", "预览追加进展"),
        "append_progress": ("append-progress", "追加进展"),
    }
    if name in write_tool_map:
        endpoint, label = write_tool_map[name]
        return await write_tool(endpoint, label, arguments)
    raise ValueError(f"Unknown tool: {name}")
