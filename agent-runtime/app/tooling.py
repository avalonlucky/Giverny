from __future__ import annotations

import contextvars
import copy
from dataclasses import dataclass
from typing import Any, Iterable

import httpx
from google.adk.agents.readonly_context import ReadonlyContext
from google.adk.tools.base_tool import BaseTool
from google.adk.tools.openapi_tool.openapi_spec_parser.openapi_toolset import OpenAPIToolset

from .evidence import EvidenceStore
from .schemas import Principal
from .security import scope_headers


@dataclass(frozen=True)
class RequestScope:
    principal: Principal
    evidence: EvidenceStore


request_scope: contextvars.ContextVar[RequestScope | None] = contextvars.ContextVar("giverny_request_scope", default=None)


READ_GROUPS = {
    "workspace": {"tasks", "files", "finance", "calendar", "memory", "planning", "analysis", "notifications"},
    "product": {"product"},
    "web": {"web"},
    "security": {"security"},
}


def _operations(spec: dict[str, Any]) -> Iterable[tuple[str, dict[str, Any]]]:
    for path_item in spec.get("paths", {}).values():
        if not isinstance(path_item, dict):
            continue
        for method, operation in path_item.items():
            if method.lower() not in {"get", "post", "put", "patch", "delete"} or not isinstance(operation, dict):
                continue
            operation_id = str(operation.get("operationId", "")).strip()
            if operation_id:
                yield operation_id, operation


def select_operation_ids(
    spec: dict[str, Any],
    *,
    role: str,
    groups: set[str],
    include_preview: bool,
) -> list[str]:
    selected: list[str] = []
    for operation_id, operation in _operations(spec):
        if operation_id.endswith("_post"):
            continue
        policy = operation.get("x-giverny-policy", {}) if isinstance(operation.get("x-giverny-policy"), dict) else {}
        roles = {str(value) for value in policy.get("roles", [])}
        confirmation = str(policy.get("confirmation", "none"))
        tags = {str(value) for value in operation.get("tags", [])}
        if role not in roles or not tags.intersection(groups):
            continue
        if confirmation in {"signed-execute", "system-only"}:
            continue
        if confirmation == "preview" and not include_preview:
            continue
        selected.append(operation_id)
    return selected


class ToolFactory:
    def __init__(self, *, spec: dict[str, Any], token: str, timeout_seconds: float):
        self.spec = spec
        self.runtime_spec = copy.deepcopy(spec)
        self.routing_spec = copy.deepcopy(spec)
        components = self.runtime_spec.get("components")
        if isinstance(components, dict):
            components.pop("securitySchemes", None)
        for path_item in self.runtime_spec.get("paths", {}).values():
            if not isinstance(path_item, dict):
                continue
            for operation in path_item.values():
                if isinstance(operation, dict):
                    operation.pop("security", None)
        for path_item in self.routing_spec.get("paths", {}).values():
            if not isinstance(path_item, dict):
                continue
            for operation in path_item.values():
                if isinstance(operation, dict) and operation.get("operationId") == "search_workspace":
                    operation["tags"] = ["memory"]
        self.token = token
        self.timeout_seconds = timeout_seconds

    def _headers(self, _: ReadonlyContext) -> dict[str, str]:
        scope = request_scope.get()
        if not scope:
            raise RuntimeError("Agent 工具调用缺少租户上下文")
        return scope_headers(self.token, scope.principal)

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=self.timeout_seconds, follow_redirects=False)

    def toolset(self, *, role: str, groups: set[str], include_preview: bool = False) -> OpenAPIToolset:
        operation_ids = select_operation_ids(
            self.routing_spec,
            role=role,
            groups=groups,
            include_preview=include_preview,
        )
        return OpenAPIToolset(
            spec_dict=self.runtime_spec,
            tool_filter=operation_ids,
            header_provider=self._headers,
            httpx_client_factory=self._client,
            preserve_property_names=True,
        )

    def toolsets_for_operations(self, *, role: str, operation_ids: set[str]) -> list[OpenAPIToolset]:
        """Build a least-privilege toolset for an orchestration stage.

        Scope resolution must be able to ground a named business object, but it
        must not inherit every workspace read tool or any write capability.
        """
        allowed = set(select_operation_ids(
            self.routing_spec,
            role=role,
            groups=set().union(*READ_GROUPS.values()),
            include_preview=False,
        ))
        selected = sorted(allowed.intersection(operation_ids))
        if not selected:
            return []
        return [OpenAPIToolset(
            spec_dict=self.runtime_spec,
            tool_filter=selected,
            header_provider=self._headers,
            httpx_client_factory=self._client,
            preserve_property_names=True,
        )]

    def pending_action(self, tool_name: str, result: dict[str, Any]) -> dict[str, Any] | None:
        preview_operation = None
        preview_path = ""
        for path, path_item in self.spec.get("paths", {}).items():
            if not isinstance(path_item, dict):
                continue
            for operation in path_item.values():
                if isinstance(operation, dict) and operation.get("operationId") == tool_name:
                    preview_operation = operation
                    preview_path = str(path)
                    break
            if preview_operation:
                break
        if not preview_operation or not tool_name.endswith("_preview"):
            return None

        execute_name = tool_name.removesuffix("_preview")
        execute_path = ""
        for path, path_item in self.spec.get("paths", {}).items():
            if not isinstance(path_item, dict):
                continue
            if any(isinstance(operation, dict) and operation.get("operationId") == execute_name for operation in path_item.values()):
                execute_path = str(path)
                break
        if not execute_path:
            return None
        return {
            "action": execute_name,
            "label": str(preview_operation.get("summary") or "执行此操作").removeprefix("预览"),
            "previewEndpoint": preview_path.removeprefix("/api/agent/tools/").lstrip("/"),
            "executeEndpoint": execute_path.removeprefix("/api/agent/tools/").lstrip("/"),
            "confirmationToken": result["confirmationToken"],
            "draft": result["draft"],
            "warnings": [str(value) for value in result.get("warnings", []) if str(value).strip()],
        }


async def capture_tool_evidence(
    tool: BaseTool,
    args: dict[str, Any],
    tool_context: Any,
    tool_response: dict[str, Any],
) -> dict[str, Any] | None:
    del tool_context
    if tool.name in {"transfer_to_agent", "finish_task"}:
        return tool_response
    scope = request_scope.get()
    if not scope:
        raise RuntimeError("Agent 工具返回缺少证据上下文")
    record = scope.evidence.add(tool.name, args, tool_response)
    if isinstance(tool_response, dict):
        safe_response = {key: value for key, value in tool_response.items() if key != "confirmationToken"}
        return {**safe_response, "evidenceId": record.evidence_id}
    return {"value": tool_response, "evidenceId": record.evidence_id}
