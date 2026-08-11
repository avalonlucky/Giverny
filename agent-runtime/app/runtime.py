from __future__ import annotations

import asyncio
import hashlib
import json
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

import httpx
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.runners import Runner
from google.adk.sessions import DatabaseSessionService
from google.genai import types

from .agents import build_agent_bundle, build_scope_supervisor
from .config import Settings
from .evidence import EvidenceStore, deterministic_verify
from .schemas import AgentTurnOutput, AuditOutput, ChatRequest, ChatResponse, RoutingDecision, SelectedModelConfig
from .tooling import RequestScope, ToolFactory, request_scope


def _content_text(event: Any) -> str:
    """答案正文：必须排除 thought part。

    思考内容与答案是两类 part（`types.Part.thought`）。把它们混在一起，
    推理过程会被当成草稿送进 formatter，也会污染最终答案。
    """
    content = getattr(event, "content", None)
    parts = getattr(content, "parts", None) or []
    return "".join(
        str(getattr(part, "text", "") or "") for part in parts if not getattr(part, "thought", False)
    ).strip()


def _thought_text(event: Any) -> str:
    """模型的推理内容。可以实时展示给用户——它不是结论，因此不绕过证据审核。"""
    content = getattr(event, "content", None)
    parts = getattr(content, "parts", None) or []
    return "".join(
        str(getattr(part, "text", "") or "") for part in parts if getattr(part, "thought", False)
    ).strip()


def _structured_event(event: Any, schema: type[Any]) -> Any | None:
    output = getattr(event, "output", None)
    if output is not None:
        try:
            return schema.model_validate(output)
        except Exception:
            pass
    text = _content_text(event)
    if text:
        return _parse_structured_text(text, schema)
    return None


def _parse_structured_text(value: str, schema: type[Any]) -> Any | None:
    raw = value.strip()
    if raw.startswith("```"):
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    candidates = [raw]
    start, end = raw.find("{"), raw.rfind("}")
    if start >= 0 and end > start:
        candidates.append(raw[start : end + 1])
    for candidate in candidates:
        try:
            return schema.model_validate(json.loads(candidate))
        except Exception:
            continue
    return None


# 思考步骤沉降到用户界面，因此只允许自然语言：不得出现框架名、主链名称、
# 专家代号或原始工具 operationId。上限与 Claim 文案一致，避免界面被单步刷爆。
StepSink = Callable[[str], Awaitable[None]] | None

# 推理内容是逐块下发的连续文本（打字机效果），和离散的步骤分开走。
ThoughtSink = Callable[[str], Awaitable[None]] | None

_STEP_TEXT_LIMIT = 120

# 每个外层聊天请求的模型调用硬预算：1（范围主管）+ 4（协调器及专家）
# + 1（结构化整理）+ 1（证据审核）= 最多 7 次。Google ADK 默认是 500，
# 绝不能直接用于生产，否则一次超时/循环就可能产生大量费用。
SUPERVISOR_LLM_CALL_LIMIT = 1
COORDINATOR_LLM_CALL_LIMIT = 4
FORMATTER_LLM_CALL_LIMIT = 1
AUDITOR_LLM_CALL_LIMIT = 1
TOTAL_LLM_CALL_LIMIT = 7


def _sanitize_step(text: str) -> str:
    cleaned = " ".join(str(text or "").split())
    return cleaned[:_STEP_TEXT_LIMIT]


def _conversation_prompt(request: ChatRequest, history_limit: int) -> str:
    history = request.history[-history_limit:]
    history_text = "\n".join(
        f"{'User' if item.role == 'user' else 'Assistant'}: {item.content}" for item in history
    )
    return (
        "<conversation_history>\n"
        f"{history_text or 'No previous conversation.'}\n"
        "</conversation_history>\n"
        f"<current_month>{request.current_month or 'not specified'}</current_month>\n"
        f"<attached_context>{request.context or 'none'}</attached_context>\n"
        "<current_user_question>\n"
        f"{request.question}\n"
        "</current_user_question>"
    )


@dataclass
class AgentRuntime:
    settings: Settings
    spec: dict[str, Any]

    def __post_init__(self) -> None:
        self.session_service = DatabaseSessionService(db_url=self.settings.session_db_url)
        self.tool_factory = ToolFactory(
            spec=self.spec,
            token=self.settings.tool_token,
            timeout_seconds=min(30.0, self.settings.request_timeout_seconds),
        )
        self._supervisors: dict[tuple[str, str, str, str], Runner] = {}
        self._bundles: dict[tuple[str, str, str, str, str, tuple[str, ...]], tuple[Runner, Runner, Runner]] = {}
        self._conversation_locks: dict[str, asyncio.Lock] = {}

    @staticmethod
    def _model_key(selected_model: SelectedModelConfig) -> tuple[str, str, str, str]:
        # The digest prevents stale cached adapters after a key rotation without
        # putting the secret itself into cache keys, traces or error messages.
        key_digest = hashlib.sha256(selected_model.api_key.encode()).hexdigest()[:16] if selected_model.api_key else "vertex-adc"
        return selected_model.provider, selected_model.model, selected_model.base_url, key_digest

    def _supervisor(self, selected_model: SelectedModelConfig) -> Runner:
        key = self._model_key(selected_model)
        cached = self._supervisors.get(key)
        if cached:
            return cached
        runner = Runner(
            agent=build_scope_supervisor(selected_model),
            app_name="giverny-adk-supervisor",
            session_service=self.session_service,
            auto_create_session=True,
        )
        self._supervisors[key] = runner
        return runner

    def _tool_summaries(self) -> dict[str, str]:
        # OpenAPI 里每个业务工具都自带中文 summary（search_attachments → 搜索任务附件），
        # 直接复用它派生用户可见文案，避免再维护一份会和接口漂移的映射表。
        cached = getattr(self, "_tool_summary_cache", None)
        if cached is not None:
            return cached
        summaries: dict[str, str] = {}
        for path_item in self.spec.get("paths", {}).values():
            if not isinstance(path_item, dict):
                continue
            for operation in path_item.values():
                if not isinstance(operation, dict):
                    continue
                operation_id = str(operation.get("operationId") or "").strip()
                summary = str(operation.get("summary") or "").strip()
                if operation_id and summary:
                    summaries.setdefault(operation_id, summary)
        self._tool_summary_cache = summaries
        return summaries

    def _tool_phrase(self, tool_name: str) -> str:
        name = str(tool_name or "").strip()
        if not name:
            return "正在查阅业务数据"
        summaries = self._tool_summaries()
        summary = summaries.get(name) or summaries.get(name.removesuffix("_post"))
        # 查不到 summary 时绝不回落成原始 operationId，宁可说得笼统一点。
        return f"正在{summary}" if summary else "正在查阅业务数据"

    def _runners(self, selected_model: SelectedModelConfig, role: str, allowed_specialists: set[str]) -> tuple[Runner, Runner, Runner]:
        key = (*self._model_key(selected_model), role, tuple(sorted(allowed_specialists)))
        cached = self._bundles.get(key)
        if cached:
            return cached
        coordinator, formatter, auditor = build_agent_bundle(selected_model, self.tool_factory, role, allowed_specialists)
        coordinator_runner = Runner(
            agent=coordinator,
            app_name="giverny-adk",
            session_service=self.session_service,
            auto_create_session=True,
        )
        formatter_runner = Runner(
            agent=formatter,
            app_name="giverny-adk-formatter",
            session_service=self.session_service,
            auto_create_session=True,
        )
        auditor_runner = Runner(
            agent=auditor,
            app_name="giverny-adk-auditor",
            session_service=self.session_service,
            auto_create_session=True,
        )
        self._bundles[key] = (coordinator_runner, formatter_runner, auditor_runner)
        return coordinator_runner, formatter_runner, auditor_runner

    async def _run_text(
        self,
        runner: Runner,
        *,
        user_id: str,
        session_id: str,
        prompt: str,
        on_step: StepSink = None,
        on_thought: ThoughtSink = None,
        max_llm_calls: int,
    ) -> tuple[str, list[dict[str, str]]]:
        final_text = ""
        trace: list[dict[str, str]] = []
        event_shapes: list[dict[str, Any]] = []
        # SSE 模式下 runner 会边生成边吐 partial 事件；没有它的话，模型思考
        # 几十秒期间一个事件都没有，界面上最后一行就会定住不动。
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=types.Content(role="user", parts=[types.Part(text=prompt)]),
            run_config=RunConfig(streaming_mode=StreamingMode.SSE, max_llm_calls=max_llm_calls),
        ):
            if on_thought:
                thought = _thought_text(event)
                if thought:
                    await on_thought(thought)
            author = str(getattr(event, "author", "") or "agent")
            calls = list(event.get_function_calls() or []) if getattr(event, "get_function_calls", None) else []
            responses = list(event.get_function_responses() or []) if getattr(event, "get_function_responses", None) else []
            event_shapes.append({
                "author": author,
                "calls": [str(getattr(value, "name", "")) for value in calls],
                "responses": [str(getattr(value, "name", "")) for value in responses],
                "hasContent": getattr(event, "content", None) is not None,
                "outputType": type(getattr(event, "output", None)).__name__,
                "transfer": str(getattr(getattr(event, "actions", None), "transfer_to_agent", "") or ""),
            })
            if getattr(event, "get_function_calls", None):
                for call in calls:
                    tool_name = str(getattr(call, "name", "tool"))
                    trace.append({"type": "tool", "label": author, "detail": tool_name})
                    # 委派专家（transfer_to_agent）属于内部编排，不进用户可见步骤。
                    if on_step and tool_name != "transfer_to_agent":
                        await on_step(self._tool_phrase(tool_name))
            if getattr(event, "get_function_responses", None):
                for response in responses:
                    response_value = getattr(response, "response", None)
                    response_name = str(getattr(response, "name", "") or "")
                    if response_name in {"finish_task", "transfer_to_agent"} and response_value is not None:
                        final_text = response_value if isinstance(response_value, str) else json.dumps(response_value, ensure_ascii=False, default=str)
            text = _content_text(event)
            if text:
                final_text = text
            output = getattr(event, "output", None)
            if output is not None:
                if isinstance(output, str):
                    final_text = output.strip() or final_text
                elif hasattr(output, "model_dump"):
                    final_text = json.dumps(output.model_dump(), ensure_ascii=False, default=str)
                elif isinstance(output, (dict, list)):
                    final_text = json.dumps(output, ensure_ascii=False, default=str)
        if not final_text:
            raise RuntimeError(f"Root Coordinator did not return a draft; eventShapes={json.dumps(event_shapes[-12:])}")
        return final_text, trace

    async def _run_structured(
        self,
        runner: Runner,
        *,
        user_id: str,
        session_id: str,
        prompt: str,
        schema: type[Any],
        on_step: StepSink = None,
        max_llm_calls: int,
    ) -> tuple[Any, list[dict[str, str]]]:
        trace: list[dict[str, str]] = []
        last_text = ""
        parsed = None
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=types.Content(role="user", parts=[types.Part(text=prompt)]),
            run_config=RunConfig(max_llm_calls=max_llm_calls),
        ):
            author = str(getattr(event, "author", "") or "agent")
            if getattr(event, "get_function_calls", None):
                for call in event.get_function_calls() or []:
                    tool_name = str(getattr(call, "name", "tool"))
                    trace.append({"type": "tool", "label": author, "detail": tool_name})
                    if on_step and tool_name != "transfer_to_agent":
                        await on_step(self._tool_phrase(tool_name))
            text = _content_text(event)
            if text:
                last_text = text
            candidate = _structured_event(event, schema)
            if candidate is not None:
                parsed = candidate
        if parsed is not None:
            return parsed, trace
        raise RuntimeError(f"{schema.__name__} structured output missing within the one-call safety budget")

    async def chat(self, request: ChatRequest, on_step: StepSink = None, on_thought: ThoughtSink = None) -> ChatResponse:
        async def step(text: str) -> None:
            if not on_step:
                return
            cleaned = _sanitize_step(text)
            if cleaned:
                await on_step(cleaned)

        lock_key = f"{request.principal.workspace_id}:{request.conversation_id}"
        lock = self._conversation_locks.setdefault(lock_key, asyncio.Lock())
        async with lock:
            selected_model = request.selected_model
            conversation_prompt = _conversation_prompt(request, self.settings.max_history_messages)
            await step("正在判断这个问题问的是哪个对象、哪个维度")
            routing, routing_trace = await asyncio.wait_for(
                self._run_structured(
                    self._supervisor(selected_model),
                    user_id=request.principal.principal_id,
                    session_id=f"scope-{uuid.uuid4()}",
                    prompt=conversation_prompt,
                    schema=RoutingDecision,
                    on_step=on_step,
                    max_llm_calls=SUPERVISOR_LLM_CALL_LIMIT,
                ),
                timeout=self.settings.request_timeout_seconds,
            )
            # 这是模型对问题的真实理解，不是占位符文案，直接给用户看。
            await step(routing.intent_summary)
            allowed_specialists = set(routing.allowed_specialists)
            coordinator_runner, formatter_runner, auditor_runner = self._runners(selected_model, request.principal.role, allowed_specialists)
            evidence = EvidenceStore()
            token = request_scope.set(RequestScope(principal=request.principal, evidence=evidence))
            try:
                draft, trace = await asyncio.wait_for(
                    self._run_text(
                        coordinator_runner,
                        user_id=request.principal.principal_id,
                        session_id=request.conversation_id,
                        prompt=(
                            f"<scope_supervisor>{json.dumps(routing.model_dump(), ensure_ascii=False)}</scope_supervisor>\n"
                            "只能委派 allowed_specialists 中列出的专家，不得请求其他领域。\n"
                            f"{conversation_prompt}"
                        ),
                        on_step=on_step,
                        # 只有 coordinator 这一段值得实时展示推理：它耗时最长，
                        # 而且它的 thought part 是过程而非结论，不绕过证据审核。
                        on_thought=on_thought,
                        max_llm_calls=COORDINATOR_LLM_CALL_LIMIT,
                    ),
                    timeout=self.settings.request_timeout_seconds,
                )
                formatter_prompt = json.dumps(
                    {
                        "question": request.question,
                        "coordinatorDraft": draft,
                        "evidence": evidence.as_prompt_data(),
                    },
                    ensure_ascii=False,
                    default=str,
                )
                await step("正在把证据逐条对齐，整理结论")
                output, formatter_trace = await asyncio.wait_for(
                    self._run_structured(
                        formatter_runner,
                        user_id=request.principal.principal_id,
                        session_id=f"format-{uuid.uuid4()}",
                        prompt=formatter_prompt,
                        schema=AgentTurnOutput,
                        on_step=on_step,
                        max_llm_calls=FORMATTER_LLM_CALL_LIMIT,
                    ),
                    timeout=self.settings.request_timeout_seconds,
                )
                actual_specialists = sorted({
                    item["detail"] for item in trace
                    if item.get("label") == "giverny_coordinator" and item.get("detail") in allowed_specialists
                })
                output.used_specialists = actual_specialists
                deterministic = deterministic_verify(request.question, output, evidence)
                audit_prompt = json.dumps(
                    {
                        "question": request.question,
                        "candidate": output.model_dump(),
                        "evidence": evidence.as_prompt_data(),
                        "deterministicAudit": deterministic.model_dump(),
                    },
                    ensure_ascii=False,
                    default=str,
                )
                await step("正在复核结论与证据是否一致")
                semantic_audit, audit_trace = await asyncio.wait_for(
                    self._run_structured(
                        auditor_runner,
                        user_id=request.principal.principal_id,
                        session_id=f"audit-{uuid.uuid4()}",
                        prompt=audit_prompt,
                        schema=AuditOutput,
                        on_step=on_step,
                        max_llm_calls=AUDITOR_LLM_CALL_LIMIT,
                    ),
                    timeout=self.settings.request_timeout_seconds,
                )
                passed = output.status == "answered" and deterministic.passed and semantic_audit.passed and semantic_audit.recommendation == "publish"
                issues = list(dict.fromkeys([*deterministic.issues, *semantic_audit.issues]))
                preview = evidence.ready_preview()
                pending_action = self.tool_factory.pending_action(preview[0].tool_name, preview[1]) if preview else None
                now_ms = int(time.time() * 1000)
                approval = None
                if pending_action:
                    approval = {
                        "id": f"{pending_action['action']}:{request.principal.run_id}",
                        "action": pending_action["action"],
                        "label": pending_action["label"],
                        "draft": pending_action["draft"],
                        "warnings": pending_action["warnings"],
                        "status": "pending",
                        "createdAt": now_ms,
                        "expiresAt": now_ms + 10 * 60 * 1000,
                    }
                if passed:
                    answer = output.answer
                elif output.status == "needs_clarification":
                    answer = "我还无法把当前证据唯一绑定到你问的对象，因此不会用其他相似项目代替回答。请补充任务 ID、所属项目或更准确的名称。"
                else:
                    answer = (
                        "我已查到相关资料，但这一版结论没有通过主体与证据校验，因此暂不输出可能错误的答案。"
                        + (f"\n\n需要重新核对：{'；'.join(issues[:3])}" if issues else "")
                    )
                return ChatResponse(
                    answer=answer,
                    conversationId=request.conversation_id,
                    model=selected_model.model,
                    trace=[
                        {"type": "plan", "label": "语义理解", "detail": output.intent_summary},
                        {"type": "plan", "label": "范围总管", "detail": routing.intent_summary},
                        *routing_trace,
                        *trace,
                        *formatter_trace,
                        *audit_trace,
                        {
                            "type": "result" if passed else "error",
                            "label": "证据审核",
                            "detail": "通过" if passed else "未通过，已阻止未验证结论",
                        },
                    ],
                    factVerification={
                        "passed": passed,
                        "checkedClaims": len(output.claims),
                        "sourceTools": sorted({record.tool_name for record in evidence.records.values()}),
                        "fallbackUsed": not passed,
                        "issues": issues,
                        "auditorModel": selected_model.model,
                    },
                    orchestration={
                        "engine": "google-adk-2",
                        "frameworkVersion": "2.x",
                        "provider": selected_model.provider,
                        "model": selected_model.model,
                        "modelPolicy": "exact-selected-model-no-fallback",
                        "modelCallLimit": TOTAL_LLM_CALL_LIMIT,
                        "specialists": output.used_specialists,
                        "evidenceCount": len(evidence.records),
                        "status": output.status,
                    },
                    productivity={
                        "engine": "google-adk-2",
                        "status": "complete" if passed else ("needs_input" if output.status == "needs_clarification" else "failed"),
                        "path": output.used_specialists,
                        "cycles": 1,
                        "toolCalls": len(evidence.records),
                        "reason": "evidence_verified" if passed else ("clarification_required" if output.status == "needs_clarification" else "evidence_audit_blocked"),
                    },
                    approval=approval,
                    pendingAction=pending_action,
                )
            finally:
                request_scope.reset(token)


async def load_runtime(settings: Settings) -> AgentRuntime:
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=False) as client:
        response = await client.get(f"{settings.tool_base_url}/api/agent/openapi.json")
        response.raise_for_status()
        spec = response.json()
    if not isinstance(spec, dict) or not isinstance(spec.get("paths"), dict):
        raise RuntimeError("Giverny Agent OpenAPI specification is invalid")
    return AgentRuntime(settings=settings, spec=spec)
