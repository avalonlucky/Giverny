from __future__ import annotations

import importlib.util
from typing import Any

from google.adk.agents import LlmAgent
from google.adk.models.base_llm import BaseLlm

from .schemas import SelectedModelConfig
from .tooling import READ_GROUPS, ToolFactory, capture_tool_evidence


COORDINATOR_INSTRUCTION = """
你是 Giverny 的 Root Coordinator，负责理解用户的完整目标，并对最终回答负责。

你不得根据单个关键词判断意图，不得将“版本”默认理解为 Giverny 产品版本。
必须先理解：用户在问谁或什么对象、想知道哪个维度、是查询还是操作、需要哪些证据才能回答。

你可以委派：
- workspace_analyst：任务、进展、附件、财务、日程、企业记忆和项目证据。
- product_support：只处理 Giverny 自身的使用方法、设置、功能和发布记录。
- web_researcher：只处理明确需要互联网实时信息的问题。
- transaction_specialist：只生成可审阅的 preview，绝不直接执行写入。

业务事实必须由工具证据支持。每条事实 claim 都要填写工具返回的 evidenceId。
不得把“最新讨论”、“最新制作”、“最新上传”、“最新提交”、“最新审批”合并成一个含糊的“最新版本”。
存在冲突时应分维度说明；不能唯一绑定主体或证据不足时，status 必须为 needs_clarification 或 refused。
回答要直接满足用户当前需求，不展示内部思维链、工具名或编排实现。
最终必须只返回一个 JSON 对象，不要 Markdown 代码块，字段为：
status(answered|needs_clarification|refused), intent_summary, subject({entity_type,name,entity_id,confidence}或null),
answer, claims([{text,kind,evidence_refs,dimension}]), used_specialists([string])。
""".strip()


SPECIALIST_BASE = """
你是 Root Coordinator 的专业分析员。请理解委派任务的完整语义，自主选择必要工具。
不使用关键词路由，不猜测业务事实，不扩大检索范围。
对候选实体先比较标题、需求、关联任务、时间线和会话上下文；不唯一时返回澄清需求。
引用工具结果时必须保留 evidenceId，不得创造证据 ID。
""".strip()


AUDITOR_INSTRUCTION = """
你是独立 Evidence Auditor，不与用户对话，不调用工具，不得引入任何新事实。
你只检查：
1. 回答是否真正回应用户问题，而不是回答了相关但不同的问题。
2. 回答主体是否与用户指向的人、任务、项目、期刊或产品一致。
3. 每条事实声明是否能由其 evidence_refs 指向的证据直接支持。
4. “最新”是否区分讨论、制作、上传、提交、反馈和审批维度。
5. 当证据不足或冲突时，系统是否正确澄清或拒答。
任何一项失败都不得 publish。
最终只返回 JSON 对象，不要 Markdown 代码块：
passed(boolean), issues([string]), question_addressed(boolean), subject_aligned(boolean),
evidence_sufficient(boolean), recommendation(publish|clarify|refuse)。
""".strip()


SUPERVISOR_INSTRUCTION = """
你是 Giverny 的 Scope Supervisor，位于 Root Coordinator 之上。你先确认用户所指对象，再决定本轮允许哪些专家可见。

你不能在没有证据时猜测“某个版本”属于 Giverny 产品。只要用户指向一个具名业务对象、公司项目、任务、刊物、文件或语义上不能确定是否为 Giverny 本身，必须先调用 resolve_workspace_subject 取证。工具返回 resolved/ambiguous 时必须选择 workspace_analyst；只有返回 not_found 且用户明确说的是 Giverny 网站、工作台、设置或发布版本，才选择 product_support。

不得根据“版本”、“最新”等单个词决定领域，必须先识别用户问的具体主体：
- workspace_analyst：用户工作区中的客户、人物、任务、项目、刊物、文件、进度、工时、财务、日程或记忆。
- product_support：只有主体明确是 Giverny 产品自身的功能、设置、品牌或发布记录时才允许。
- web_researcher：只有用户明确要求外部互联网、实时网络或公开外部资料时才允许；不用外网替代工作区证据。
- transaction_specialist：只有用户明确要求新增、修改、删除、执行或发送操作时才允许。

不要“以防万一”开放无关专家。一般问答可以不开放任何专家。
工具取证最多一次。最终只返回 JSON 对象，不要 Markdown 代码块：
intent_summary, subject, allowed_specialists, requires_evidence, rationale。
""".strip()


def _model(config: SelectedModelConfig) -> str | BaseLlm:
    # Gemini without an API key uses ADK's native Vertex adapter. Every other
    # route uses the exact provider/model/base URL selected in Giverny settings.
    # There is intentionally no fallback model here.
    if config.provider == "gemini" and not config.api_key:
        return config.model
    if importlib.util.find_spec("litellm") is None:
        raise RuntimeError("Selected multi-provider model requires the litellm adapter")
    import litellm  # noqa: F401 - ADK 2.6 lazy loader requires the module to be initialized.
    from google.adk.models import LiteLlm

    provider_prefix = {
        "gemini": "gemini",
        "openrouter": "openrouter",
        "anthropic": "anthropic",
    }.get(config.provider, "openai")
    model_name = config.model if config.model.startswith(f"{provider_prefix}/") else f"{provider_prefix}/{config.model}"
    kwargs: dict[str, Any] = {"api_base": config.base_url}
    if config.api_key:
        kwargs["api_key"] = config.api_key
    return LiteLlm(model=model_name, **kwargs)


def build_scope_supervisor(selected_model: SelectedModelConfig, tool_factory: ToolFactory, role: str) -> LlmAgent:
    return LlmAgent(
        name="scope_supervisor",
        description="理解用户真实主体与意图，在编排前限定专家可见性。",
        model=_model(selected_model),
        instruction=SUPERVISOR_INSTRUCTION,
        tools=tool_factory.toolsets_for_operations(role=role, operation_ids={"resolve_workspace_subject"}),
        mode="chat",
        include_contents="none",
        after_tool_callback=capture_tool_evidence,
    )


def build_agent_bundle(selected_model: SelectedModelConfig, tool_factory: ToolFactory, role: str, allowed_specialists: set[str]) -> tuple[LlmAgent, LlmAgent]:
    # Coordinator, specialists and auditor must all use the exact
    # selected model. A cheaper or different auditor would violate the UI/model contract.
    coordinator_model = _model(selected_model)
    auditor_model = _model(selected_model)

    workspace_analyst = LlmAgent(
        name="workspace_analyst",
        description="语义理解真实业务对象，检索任务、进展、附件、财务、日程、记忆和项目时间线。",
        model=coordinator_model,
        instruction=f"{SPECIALIST_BASE}\n你只分析工作区的真实业务数据，不回答 Giverny 产品版本或使用方法。",
        tools=[tool_factory.toolset(role=role, groups=READ_GROUPS["workspace"])],
        mode="single_turn",
        after_tool_callback=capture_tool_evidence,
    )
    product_support = LlmAgent(
        name="product_support",
        description="只回答 Giverny 产品自身的使用方法、设置、功能、版本日志和品牌资料。",
        model=coordinator_model,
        instruction=(
            f"{SPECIALIST_BASE}\n只有委派目标明确是 Giverny 产品本身时才工作。"
            "具体客户、任务、项目或期刊不属于产品帮助。\n"
            "处理产品发布时序时，必须先用 get_giverny_context 确认当前版本，"
            "再用 search_product_help 查该版本的更新记录；不得把相关性较高的旧版本当成最新版本。"
        ),
        tools=[tool_factory.toolset(role=role, groups=READ_GROUPS["product"])],
        mode="single_turn",
        after_tool_callback=capture_tool_evidence,
    )
    web_researcher = LlmAgent(
        name="web_researcher",
        description="只处理用户明确需要联网、实时或外部资料的问题。",
        model=coordinator_model,
        instruction=f"{SPECIALIST_BASE}\n只搜索用户要求的外部互联网信息，不用外网结果替代工作区数据。",
        tools=[tool_factory.toolset(role=role, groups=READ_GROUPS["web"])],
        mode="single_turn",
        after_tool_callback=capture_tool_evidence,
    )
    transaction_specialist = LlmAgent(
        name="transaction_specialist",
        description="将用户明确要求的业务操作生成 preview 确认卡，绝不直接执行写入。",
        model=coordinator_model,
        instruction=f"{SPECIALIST_BASE}\n只允许调用 confirmation=preview 或无写入副作用的工具。缺失字段时返回需要澄清的内容，不得补写用户未提供的任务、日期、工时、人员或附件。",
        tools=[
            tool_factory.toolset(
                role=role,
                groups={"write", "files", "finance", "calendar", "notifications", "planning", "memory", "analysis", "security"},
                include_preview=True,
            )
        ],
        mode="single_turn",
        after_tool_callback=capture_tool_evidence,
    )

    available_specialists = [
        agent for agent in [workspace_analyst, product_support, web_researcher, transaction_specialist]
        if agent.name in allowed_specialists
    ]
    coordinator = LlmAgent(
        name="giverny_coordinator",
        description="Giverny 语义协调者与最终回答责任人。",
        model=coordinator_model,
        instruction=COORDINATOR_INSTRUCTION,
        sub_agents=available_specialists,
        mode="chat",
    )
    auditor = LlmAgent(
        name="evidence_auditor",
        description="独立检查问题覆盖、主体一致性和 claim-evidence 支持关系。",
        model=auditor_model,
        instruction=AUDITOR_INSTRUCTION,
        mode="chat",
        include_contents="none",
    )
    return coordinator, auditor
