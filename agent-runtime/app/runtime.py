from __future__ import annotations

import asyncio
import hashlib
import json
import re
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

import httpx
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.runners import Runner
from google.adk.sessions import DatabaseSessionService
from google.genai import types

from .agents import build_agent_bundle, build_scope_supervisor, reasoning_is_requested
from .config import Settings
from .evidence import EvidenceStore, deterministic_verify
from .schemas import AgentTurnOutput, AuditOutput, ChatRequest, ChatResponse, EntityReference, RoutingDecision, SelectedModelConfig
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


@dataclass
class _StreamText:
    """按 ADK 的事件语义拼装流式文本。

    ADK 的 SSE 分片是**增量**（``partial=True``），每段结束时再补一帧完整的
    聚合文本（lite_llm 的 ``_finalize_text_response``）。所以增量只能拼接，
    聚合帧只覆盖当前这一段。

    绝不能靠 ``endswith`` 去猜增量还是全量：任何与上一片相同的分片都会被当成
    重复而吞掉——JSON 里的 ``""`` 和 ``}}``、正文里的重复字符都会中招，而且丢一次
    就再也接不回来，末尾聚合帧会被追加成两段拼在一起的垃圾 JSON，整轮 502。
    """

    segments: list[str] = field(default_factory=list)
    current: str = ""

    def feed(self, text: str, *, partial: bool) -> None:
        chunk = str(text or "")
        if not chunk:
            return
        if partial:
            self.current += chunk
            return
        # 聚合帧是这一段的权威全文，直接取代同段累积的增量。
        self.segments.append(chunk)
        self.current = ""

    def text(self) -> str:
        return "".join([*self.segments, self.current])


def _apply_grounded_scope(routing: RoutingDecision, evidence: EvidenceStore) -> RoutingDecision:
    """Let retrieved entity evidence override an ungrounded product guess."""
    resolutions = [
        record.result for record in evidence.records.values()
        if record.tool_name == "resolve_workspace_subject"
    ]
    grounded = next(
        (item for item in reversed(resolutions) if item.get("resolutionStatus") in {"resolved", "ambiguous"}),
        None,
    )
    if not grounded:
        return routing
    # 只有确实解析到唯一的工作区对象时，才排除产品支持这条路。返回 ambiguous 说明
    # 取证本身没定论，这时把产品支持也剥掉，会让一个真正在问 Giverny 自身的问题
    # 被强行送进工作区分析，再也回不去。
    if grounded.get("resolutionStatus") == "resolved":
        routing.allowed_specialists = [
            value for value in routing.allowed_specialists if value != "product_support"
        ]
    if "workspace_analyst" not in routing.allowed_specialists:
        routing.allowed_specialists.append("workspace_analyst")
    task = grounded.get("task") if isinstance(grounded.get("task"), dict) else None
    if task and str(task.get("title") or "").strip():
        routing.subject = EntityReference(
            entity_type="task",
            name=str(task["title"]).strip(),
            entity_id=str(task.get("id") or "") or None,
            confidence=1.0,
        )
    return routing


# 执行步骤沉降到用户界面，因此只允许自然语言：不得出现框架名、主链名称、
# 专家代号或原始工具 operationId。它与模型 thought 是两条独立通道。
StepSink = Callable[[str], Awaitable[None]] | None

# 推理内容来自供应商 thought part，逐块下发并与离散执行步骤分开走。
ThoughtSink = Callable[[str], Awaitable[None]] | None

_STEP_TEXT_LIMIT = 120

# 模型适配器缓存的上限。Key 含 provider/model/baseUrl/密钥摘要/角色/可用专家组合，
# 组合数会随设置切换和路由结果持续增长，无界字典等于慢性内存泄漏——而 Runtime 的
# systemd 单元设了 MemoryMax=1200M，涨上去就是被 OOM kill。
_ADAPTER_CACHE_LIMIT = 24


def _cache_get(cache: dict[Any, Any], key: Any) -> Any:
    value = cache.get(key)
    if value is not None:
        # 命中就挪到末尾，淘汰的永远是最久没用过的那个。
        cache[key] = cache.pop(key)
    return value


def _cache_put(cache: dict[Any, Any], key: Any, value: Any) -> Any:
    cache[key] = value
    while len(cache) > _ADAPTER_CACHE_LIMIT:
        cache.pop(next(iter(cache)))
    return value


@dataclass
class _ConversationGate:
    """同会话串行执行的闸门，附带引用计数。

    此前直接往 dict 里 setdefault 一把 Lock 且从不删除：每个新会话留一个 Lock
    对象，进程活多久就攒多久。
    """

    lock: asyncio.Lock
    holders: int = 0


# 模型的推理内容和它自己写的 intent_summary 都是自由文本，会照着提示词把内部
# 名词念出来（"我需要调用 search_attachments"、"让 workspace_analyst 处理"）。
# 这两条通道最终都会直接渲染给用户，所以必须在出口处换成自然语言：
# 用户不该看到我们用什么框架、内部有几个专家、工具的 operationId 叫什么。
_INTERNAL_ROLE_PHRASES = {
    "scope_supervisor": "对象判断",
    "giverny_coordinator": "主协调",
    "workspace_analyst": "工作区分析",
    "product_support": "产品支持",
    "web_researcher": "联网检索",
    "transaction_specialist": "操作预览",
    "evidence_auditor": "结论复核",
    "transfer_to_agent": "转交",
}

# 提示词里出现过的协议字段名，模型复述它们的概率很高。
_INTERNAL_FIELD_PHRASES = {
    "intent_summary": "意图判断",
    "allowed_specialists": "可用范围",
    "requires_evidence": "是否需要取证",
    "used_specialists": "参与环节",
    "evidence_refs": "证据编号",
    "evidence_id": "证据编号",
    "evidenceId": "证据编号",
    "resolutionStatus": "识别结果",
    "resolution_status": "识别结果",
    "question_addressed": "是否回应问题",
    "subject_aligned": "主体是否一致",
    "evidence_sufficient": "证据是否充分",
    "needs_clarification": "需要澄清",
    "sub_agent": "内部环节",
    "sub_agents": "内部环节",
}

_FRAMEWORK_PATTERN = re.compile(
    r"Google\s*ADK|\bADK\b|LiteLLM|LangGraph|Vertex\s*AI"
    r"|Evidence\s*Auditor|Root\s*Coordinator|Scope\s*Supervisor"
    r"|语义编排(?:与证据审核)?(?:主链)?|证据审核主链",
    re.IGNORECASE,
)

# 每个外层聊天请求的模型调用硬预算：2（范围主管，含一次对象取证）
# + 4（协调器及专家）+ 1（证据审核）= 最多 7 次。结构整理改为本地
# 强类型解析，不再为修 JSON 额外调用一次模型。Google ADK 默认是 500，
# 绝不能直接用于生产，否则一次超时/循环就可能产生大量费用。
SUPERVISOR_LLM_CALL_LIMIT = 2
COORDINATOR_LLM_CALL_LIMIT = 4
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
        self._supervisors: dict[tuple[str, str, str, str, str], Runner] = {}
        self._bundles: dict[tuple[str, str, str, str, str, tuple[str, ...]], tuple[Runner, Runner]] = {}
        self._conversation_locks: dict[str, _ConversationGate] = {}

    @staticmethod
    def _model_key(selected_model: SelectedModelConfig) -> tuple[str, str, str, str]:
        # The digest prevents stale cached adapters after a key rotation without
        # putting the secret itself into cache keys, traces or error messages.
        key_digest = hashlib.sha256(selected_model.api_key.encode()).hexdigest()[:16] if selected_model.api_key else "vertex-adc"
        return selected_model.provider, selected_model.model, selected_model.base_url, key_digest

    def _supervisor(self, selected_model: SelectedModelConfig, role: str) -> Runner:
        key = (*self._model_key(selected_model), role)
        cached = _cache_get(self._supervisors, key)
        if cached:
            return cached
        runner = Runner(
            agent=build_scope_supervisor(selected_model, self.tool_factory, role),
            app_name="giverny-adk-supervisor",
            session_service=self.session_service,
            auto_create_session=True,
        )
        return _cache_put(self._supervisors, key, runner)

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

    def _internal_name_replacements(self) -> dict[str, str]:
        cached = getattr(self, "_internal_name_cache", None)
        if cached is not None:
            return cached
        replacements: dict[str, str] = {**_INTERNAL_FIELD_PHRASES, **_INTERNAL_ROLE_PHRASES}
        summaries = self._tool_summaries()
        for path_item in self.spec.get("paths", {}).values():
            if not isinstance(path_item, dict):
                continue
            for operation in path_item.values():
                if not isinstance(operation, dict):
                    continue
                operation_id = str(operation.get("operationId") or "").strip()
                if not operation_id:
                    continue
                summary = summaries.get(operation_id)
                # 没写 summary 的工具宁可说笼统一点，也不能把 operationId 露出去。
                replacements[operation_id] = f"「{summary}」" if summary else "内部工具"
        self._internal_name_cache = replacements
        return replacements

    def _scrub_internal(self, text: str) -> str:
        """把模型自由文本里的内部名词换成自然语言，再交给用户可见通道。"""
        value = str(text or "")
        if not value:
            return ""
        replacements = self._internal_name_replacements()
        # 长名字先替换：否则 search_attachments_post 会被 search_attachments 截成半截。
        for name in sorted(replacements, key=len, reverse=True):
            if name in value:
                value = value.replace(name, replacements[name])
        return _FRAMEWORK_PATTERN.sub("内部流程", value)

    def _runners(self, selected_model: SelectedModelConfig, role: str, allowed_specialists: set[str]) -> tuple[Runner, Runner]:
        key = (*self._model_key(selected_model), role, tuple(sorted(allowed_specialists)))
        cached = _cache_get(self._bundles, key)
        if cached:
            return cached
        coordinator, auditor = build_agent_bundle(selected_model, self.tool_factory, role, allowed_specialists)
        coordinator_runner = Runner(
            agent=coordinator,
            app_name="giverny-adk",
            session_service=self.session_service,
            auto_create_session=True,
        )
        auditor_runner = Runner(
            agent=auditor,
            app_name="giverny-adk-auditor",
            session_service=self.session_service,
            auto_create_session=True,
        )
        return _cache_put(self._bundles, key, (coordinator_runner, auditor_runner))

    async def _run_structured(
        self,
        runner: Runner,
        *,
        user_id: str,
        session_id: str,
        prompt: str,
        schema: type[Any],
        on_step: StepSink = None,
        on_thought: ThoughtSink = None,
        max_llm_calls: int,
        result_author: str | None = None,
    ) -> tuple[Any, list[dict[str, str]]]:
        trace: list[dict[str, str]] = []
        answer = _StreamText()
        thoughts = _StreamText()
        parsed = None
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=types.Content(role="user", parts=[types.Part(text=prompt)]),
            run_config=RunConfig(streaming_mode=StreamingMode.SSE, max_llm_calls=max_llm_calls),
        ):
            partial = bool(getattr(event, "partial", False))
            if on_thought:
                thought = _thought_text(event)
                if thought:
                    thoughts.feed(thought, partial=partial)
                    await on_thought(self._scrub_internal(thoughts.text()))
            author = str(getattr(event, "author", "") or "agent")
            if getattr(event, "get_function_calls", None):
                for call in event.get_function_calls() or []:
                    tool_name = str(getattr(call, "name", "tool"))
                    entry = {"type": "tool", "label": author, "detail": tool_name}
                    # ADK 委派专家用的工具就叫 transfer_to_agent，真正的专家名在
                    # args["agent_name"] 里。只看 detail 的话 used_specialists 永远是空的。
                    if tool_name == "transfer_to_agent":
                        target = str((getattr(call, "args", None) or {}).get("agent_name") or "").strip()
                        if target:
                            entry["agent"] = target
                    trace.append(entry)
                    if on_step and tool_name != "transfer_to_agent":
                        await on_step(self._tool_phrase(tool_name))
            text = _content_text(event)
            accepts_result = result_author is None or author == result_author
            if text and accepts_result:
                answer.feed(text, partial=partial)
            # 只在聚合帧上尝试解析：增量分片是被截断的 JSON，既白费 CPU，
            # 又有可能凑巧解析成一个字段缺失的"合法"对象被当成最终答案。
            if accepts_result and not partial:
                # ADK events can expose a transient ``output`` alongside the
                # provider's final content.  Never let that transient value
                # overwrite a body that already satisfies the public schema.
                # Only the named owning agent may publish the structured result;
                # specialist prose and transfer payloads remain trace-only.
                candidate = _structured_event(event, schema)
                if candidate is not None:
                    parsed = candidate
                elif answer.text():
                    parsed = _parse_structured_text(answer.text(), schema) or parsed
        if parsed is None and answer.text():
            # 供应商没有补聚合帧时的兜底：用增量拼出来的全文再解析一次。
            parsed = _parse_structured_text(answer.text(), schema)
        if parsed is not None:
            return parsed, trace
        raise RuntimeError(f"{schema.__name__} structured output missing within its bounded call budget")

    @staticmethod
    def reasoning_stream_expected(request: ChatRequest) -> bool:
        """本轮是否会向供应商申请推理输出。前端据此决定要不要摆"等待推理"占位符。"""
        return reasoning_is_requested(request.selected_model)

    async def chat(self, request: ChatRequest, on_step: StepSink = None, on_thought: ThoughtSink = None) -> ChatResponse:
        async def step(text: str) -> None:
            if not on_step:
                return
            # intent_summary 是模型自由文本，同样会念出工具名和内部角色。
            cleaned = _sanitize_step(self._scrub_internal(text))
            if cleaned:
                await on_step(cleaned)

        reasoning_sections: dict[str, str] = {}

        async def thought(stage: str, text: str) -> None:
            if not on_thought or not text:
                return
            reasoning_sections[stage] = text
            await on_thought("\n\n".join(f"【{label}】\n{value}" for label, value in reasoning_sections.items()))

        # 每阶段各给一份 request_timeout_seconds 时，三阶段最坏可以跑到 450 秒，
        # 而 Worker 侧 280 秒就会单方面掐断——用户白等四分多钟才看到失败。
        # 所以本轮总预算必须收在 Worker 之内，各阶段只能在剩余额度里取用。
        turn_deadline = time.monotonic() + self.settings.turn_budget_seconds

        def stage_timeout() -> float:
            remaining = turn_deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("ADK 编排已用尽本轮总预算")
            return min(self.settings.request_timeout_seconds, remaining)

        lock_key = f"{request.principal.workspace_id}:{request.conversation_id}"
        gate = self._conversation_locks.get(lock_key)
        if gate is None:
            gate = self._conversation_locks[lock_key] = _ConversationGate(asyncio.Lock())
        gate.holders += 1
        try:
            async with gate.lock:
                return await self._chat_turn(request, on_step, step, thought, stage_timeout)
        finally:
            gate.holders -= 1
            # 最后一个使用者离开时立刻回收，闸门不会随会话数一直攒下去。
            if gate.holders <= 0:
                self._conversation_locks.pop(lock_key, None)

    async def _chat_turn(
        self,
        request: ChatRequest,
        on_step: StepSink,
        step: Callable[[str], Awaitable[None]],
        thought: Callable[[str, str], Awaitable[None]],
        stage_timeout: Callable[[], float],
    ) -> ChatResponse:
        selected_model = request.selected_model
        conversation_prompt = _conversation_prompt(request, self.settings.max_history_messages)
        evidence = EvidenceStore()
        token = request_scope.set(RequestScope(principal=request.principal, evidence=evidence))
        try:
            await step("正在确认问题所指对象")
            supervisor_timeout = stage_timeout()
            routing, routing_trace = await asyncio.wait_for(
                self._run_structured(
                    self._supervisor(selected_model, request.principal.role),
                    user_id=request.principal.principal_id,
                    session_id=f"scope-{uuid.uuid4()}",
                    prompt=conversation_prompt,
                    schema=RoutingDecision,
                    on_step=on_step,
                    on_thought=lambda text: thought("对象判断", text),
                    max_llm_calls=SUPERVISOR_LLM_CALL_LIMIT,
                    result_author="scope_supervisor",
                ),
                timeout=supervisor_timeout,
            )
            routing = _apply_grounded_scope(routing, evidence)
            await step(routing.intent_summary)
            allowed_specialists = set(routing.allowed_specialists)
            coordinator_runner, auditor_runner = self._runners(selected_model, request.principal.role, allowed_specialists)
            coordinator_timeout = stage_timeout()
            output, trace = await asyncio.wait_for(
                self._run_structured(
                    coordinator_runner,
                    user_id=request.principal.principal_id,
                    session_id=request.conversation_id,
                    prompt=(
                        f"<scope_supervisor>{json.dumps(routing.model_dump(), ensure_ascii=False)}</scope_supervisor>\n"
                        f"<grounded_evidence>{json.dumps(evidence.as_prompt_data(), ensure_ascii=False, default=str)}</grounded_evidence>\n"
                        "只能委派 allowed_specialists 中列出的专家，不得请求其他领域。\n"
                        f"{conversation_prompt}"
                    ),
                    on_step=on_step,
                    on_thought=lambda text: thought("分析与取证", text),
                    max_llm_calls=COORDINATOR_LLM_CALL_LIMIT,
                    schema=AgentTurnOutput,
                    result_author="giverny_coordinator",
                ),
                timeout=coordinator_timeout,
            )
            actual_specialists = sorted({
                str(item["agent"]) for item in trace
                if item.get("label") == "giverny_coordinator" and item.get("agent") in allowed_specialists
            })
            output.used_specialists = actual_specialists
            deterministic = deterministic_verify(request.question, output, evidence)
            # 状态不是 answered 时，passed 恒为 False，答案也已经被固定文案取代，
            # 审核结论改变不了任何输出——那次模型调用是纯浪费的等待与费用。
            audited = output.status == "answered"
            if audited:
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
                auditor_timeout = stage_timeout()
                # 审核员不接推理通道：它的推理里带着还没过闸的答案草稿，
                # 展示出去等于绕过这道闸门自己。
                semantic_audit, audit_trace = await asyncio.wait_for(
                    self._run_structured(
                        auditor_runner,
                        user_id=request.principal.principal_id,
                        session_id=f"audit-{uuid.uuid4()}",
                        prompt=audit_prompt,
                        schema=AuditOutput,
                        on_step=on_step,
                        max_llm_calls=AUDITOR_LLM_CALL_LIMIT,
                        result_author="evidence_auditor",
                    ),
                    timeout=auditor_timeout,
                )
            else:
                semantic_audit = AuditOutput(
                    passed=False,
                    issues=[],
                    question_addressed=False,
                    subject_aligned=False,
                    evidence_sufficient=False,
                    recommendation="clarify" if output.status == "needs_clarification" else "refuse",
                )
                audit_trace = []
            passed = audited and deterministic.passed and semantic_audit.passed and semantic_audit.recommendation == "publish"
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
                # 一次工具都没调过时说"我已查到相关资料"是句假话。
                answer = (
                    "我已查到相关资料，但这一版结论没有通过主体与证据校验，因此暂不输出可能错误的答案。"
                    if evidence.records
                    else "这一版结论没有通过校验，我不会输出可能错误的答案。"
                ) + (f"\n\n需要重新核对：{'；'.join(issues[:3])}" if issues else "")
            return ChatResponse(
                answer=answer,
                conversationId=request.conversation_id,
                model=selected_model.model,
                trace=[
                    {"type": "plan", "label": "语义理解", "detail": output.intent_summary},
                    {"type": "plan", "label": "范围总管", "detail": routing.intent_summary},
                    *routing_trace,
                    *trace,
                    *audit_trace,
                    {
                        "type": "result" if passed or not audited else "error",
                        "label": "证据审核",
                        "detail": "通过" if passed else ("结论未成形，未进入复核" if not audited else "未通过，已阻止未验证结论"),
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
                    "reasoningStream": reasoning_is_requested(selected_model),
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
