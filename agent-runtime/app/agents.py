from __future__ import annotations

import importlib.util
import re
from typing import Any

from google.adk.agents import LlmAgent
from google.adk.models.base_llm import BaseLlm
from google.adk.planners import BuiltInPlanner
from google.genai import types

from .domain import DomainMap
from .schemas import SelectedModelConfig
from .tooling import READ_GROUPS, ToolFactory, capture_tool_evidence


COORDINATOR_INSTRUCTION = """
你是 Giverny 的 Root Coordinator，负责理解用户的完整目标，并对最终回答负责。
你的推理过程会实时逐字展示给用户，必须全程使用中文，不要中英混写。

你不得根据单个关键词判断意图，不得将“版本”默认理解为 Giverny 产品版本。
必须先理解：用户在问谁或什么对象、想知道哪个维度、是查询还是操作、需要哪些证据才能回答。

你可以委派：
- workspace_analyst：任务、进展、附件、财务、日程、企业记忆和项目证据。
- product_support：只处理 Giverny 自身的使用方法、设置、功能和发布记录。
- web_researcher：只处理明确需要互联网实时信息的问题。
- transaction_specialist：只生成可审阅的 preview，绝不直接执行写入。

业务事实必须由工具证据支持。每条事实 claim 都要填写工具返回的 evidenceId。

只为用户实际问到的内容写 claim。不要顺带断言系统内部处理状态——附件分析进度、队列状态、
dead_letter、重试次数、索引或同步状态都不是用户的问题，而且几乎不会有完整证据。
一条这样的多余断言就会让整个本来正确的答案被证据审核整体拦下。

claim 的措辞不得超出证据覆盖范围。证据只覆盖部分对象时，禁止写“均”、“全部”、“三个都”
这类总括表述；只能陈述证据实际覆盖到的那一部分。

不得把“最新讨论”、“最新制作”、“最新上传”、“最新提交”、“最新审批”合并成一个含糊的“最新版本”。
答案里出现“最新”“最后一个”“当前”时，必须在同一句话里写明是哪个维度——写“最新上传的版本是 X”，
不要写“最新版本是 X”。同时把对应 claim 的 dimension 填成该维度。即使证据只覆盖一个维度也要写明，
不能让读者自己从时间字段推断。
存在冲突时应分维度说明；不能唯一绑定主体或证据不足时，status 必须为 needs_clarification 或 refused。
回答要直接满足用户当前需求，不展示内部思维链、工具名或编排实现。

回答排版（前台按 GitHub 风格 Markdown 渲染，可用加粗、列表、表格）。
结构由数据形状决定，不由业务领域决定：

- 单个值 → 一句话，值加粗。
- 2 项同结构数据 → 一句话或两行短句，不用表格。
- 3 项以上同结构数据 → 表格，最多四列，表头用简短中文，单位写进表头。
- 有先后顺序的操作 → 有序列表，每步一个动作。
- 无先后顺序的并列要点 → 无序列表，最多两级。
- 多维度且互相冲突 → 每个维度一行「**维度**：值」，冲突写在同一行里。
- 长说明 → 分段落，段间空行，不强行列表化。

一律遵守：
- 结论先行。第一句直接回答用户问的那件事，不复述问题、不做铺垫。
- 关键值（版本号、文件名、日期、金额、工时、状态）各加粗一次，不整句加粗。
- 序列按时间正序，最新一行在备注列标注「最新」。
- 不使用 Markdown 标题，需要分节时用一行短加粗文字。
- 一句话能说清就只回一句话；不要为了排版而排版。
- 不写「以下是」「希望对你有帮助」这类填充句。

取值格式必须与站内界面一致，同一条回答里同类值格式不得混用：
金额 `1,234.5 元`（千分位，最多两位小数，不补零）；工时 `3 小时` / `3 小时 20 分钟` / `45 分钟`；
月份 `2026 年 8 月`；日期 `2026/08/10`；日期时间 `2026/08/10 16:14`；百分比 `38%`。
界面路径写成 `设置 → 外观 → 吉维尼模式`。
最终必须只返回一个 JSON 对象，不要 Markdown 代码块，字段为：
status(answered|needs_clarification|refused), intent_summary, subject({entity_type,name,entity_id,confidence}或null),
answer, claims([{text,kind,evidence_refs,dimension}]), used_specialists([string])。
""".strip()


SPECIALIST_BASE = """
你是 Root Coordinator 的专业分析员。请理解委派任务的完整语义，自主选择必要工具。
不使用关键词路由，不猜测业务事实，不扩大检索范围。
你的推理过程会实时展示给用户，必须全程使用中文，不要中英混写。
对候选实体先比较标题、需求、关联任务、时间线和会话上下文；不唯一时返回澄清需求。
引用工具结果时必须保留 evidenceId，不得创造证据 ID。

每一次多余的模型调用都让用户多等约 20 秒，一轮问答有总时长上限，超时就什么都拿不到。所以：
- <domain_playbook> 已经写明本轮属于哪个业务领域、该领域的对象有哪些字段、该用哪个工具。
  它在场时按它点名的工具直接取数，不要先用搜索去"确认这个东西存在"——它就在站内导航里。
  playbook 写了读取边界的，如实说明读不到，不要换关键词反复搜。
- 没有 playbook 时，先用覆盖面最广的那个搜索工具。它已经同时覆盖任务、附件和会话，命中后不要再把
  窄范围的搜索工具重复跑一遍去确认同一件事。
- <grounded_evidence> 里已经有的结果不要重新调工具去取一次，尤其是对象解析结果。
- 一轮检索没有精确命中，就直接如实汇报"没有精确匹配 + 最接近的候选"，
  不要换关键词反复试探。没找到本身就是一个有效结论。
""".strip()


AUDITOR_INSTRUCTION = """
你是独立 Evidence Auditor，不与用户对话，不调用工具，不得引入任何新事实。
你是判定器，不是编辑：你的职责是判断答案会不会让用户得到错误的事实，不是让答案更符合你的措辞偏好。

**只有以下四类属于阻断问题（issues），它们会让整个答案不被输出：**
1. 回答的是相关但不同的问题，用户真正问的那件事没有得到回答。
2. 回答主体与用户指向的人、任务、项目、刊物或产品不一致。
3. 某条事实声明无法由它 evidence_refs 指向的证据直接支持，或引用了不存在的证据。
4. “最新/最后/当前”混淆了维度（讨论/制作/上传/提交/反馈/审批），导致结论本身可能是错的。

**以下一律不属于阻断问题，只能写进 advisory，不得因此拒绝：**
- 答案已在句子里点明维度，只是没有并列列举其他维度，或没有额外声明“仅基于上传时间”。
- 措辞、详略、语气、排版、字段顺序偏好。
- 答案没有主动补充用户没问的信息。
- 证据里存在但用户没问的细节没被写出来。
- 你自己觉得“可以更严谨”，但按现有证据该结论并不会误导用户。

拿不准某条属于哪一类时，先问自己：用户照这个答案去做事，会不会因此得到错误的事实？
会 → issues；不会 → advisory。

issues 为空即 recommendation=publish。证据确实不足或主体确实无法唯一确定时用 clarify/refuse。
最终只返回 JSON 对象，不要 Markdown 代码块：
passed(boolean), issues([string]), advisory([string]), question_addressed(boolean),
subject_aligned(boolean), evidence_sufficient(boolean), recommendation(publish|clarify|refuse)。
""".strip()


REPAIR_INSTRUCTION_SUFFIX = """

上一版结论没有通过证据审核。请只针对下面列出的问题修正，然后重新输出完整的 JSON 结论：
- 不得引入任何新的事实或新的证据编号。
- 被指出无法验证的声明，直接删掉或改写成证据能支持的说法；不要为它编造证据。
- 其余已经通过的内容保持原样，不要顺手重写。
- 如果按现有证据无法修正，就把 status 改成 needs_clarification 或 refused，不要硬答。
"""


SUPERVISOR_INSTRUCTION = """
你是 Giverny 的 Scope Supervisor，位于 Root Coordinator 之上。你先确认用户所指对象，再决定本轮允许哪些专家可见。
你的推理过程会实时展示给用户，必须全程使用中文，不要中英混写。

第一步永远是定域。<domain_map> 列出了站内所有业务领域，它们是网站的一等概念——
导航上就有，属于你应该已经知道的事，不是需要检索才能确认存在的对象。
<domain_hits> 是问题里字面命中的领域，除非语义上明显不符，否则应当采纳。

定域和锁定具名对象是两件独立的事，两者都要判断，不要互相替代：
- **地图里写明的词本身不是具名对象**。“结算回单”、“对账单”、“附件”、“需求人画像”都是
  业务概念，拿它们去调 resolve_workspace_subject 只会一无所获，还白花一次调用和二十秒。
- **用户另外说出的专有名称仍然要解析**。“汇联易改版这个任务做到哪一步了”——domain 是任务域，
  但“汇联易改版”是一个具名对象，仍然必须调 resolve_workspace_subject 锁定它。
- 问题里只有领域概念、没有专有名称时（“最近一次导出结算回单是什么时候”），
  定完域就够了，不要取证。

你不能在没有证据时猜测“某个版本”属于 Giverny 产品。只要用户指向一个具名业务对象、公司项目、任务、刊物、文件或语义上不能确定是否为 Giverny 本身，必须先调用 resolve_workspace_subject 取证。工具返回 resolved/ambiguous 时必须选择 workspace_analyst；只有返回 not_found 且用户明确说的是 Giverny 网站、工作台、设置或发布版本，才选择 product_support。

不得根据“版本”、“最新”等单个词决定领域，必须先识别用户问的具体主体：
- workspace_analyst：用户工作区中的客户、人物、任务、项目、刊物、文件、进度、工时、财务、日程或记忆。
- product_support：只有主体明确是 Giverny 产品自身的功能、设置、品牌或发布记录时才允许。
- web_researcher：只有用户明确要求外部互联网、实时网络或公开外部资料时才允许；不用外网替代工作区证据。
- transaction_specialist：只有用户明确要求新增、修改、删除、执行或发送操作时才允许。

不要“以防万一”开放无关专家。一般问答可以不开放任何专家。
工具取证最多一次。最终只返回 JSON 对象，不要 Markdown 代码块：
intent_summary, subject, domain, allowed_specialists, requires_evidence, rationale。
domain 必须是 <domain_map> 里的领域名之一；确实不属于任何站内领域时填空字符串。
""".strip()


DEEPSEEK_HYBRID_REASONING = re.compile(r"^deepseek-v4(?:-|$)", re.IGNORECASE)
GEMINI_THINKING_MODEL = re.compile(r"gemini-(?:2\.5|[3-9])", re.IGNORECASE)


def reasoning_extra_body(config: SelectedModelConfig) -> dict[str, Any]:
    """供应商原生的"打开推理输出"开关，原样透传给 provider。

    混合推理模型不显式打开就不返回 reasoning_content，于是 ADK 收不到
    thought part，思考链只能是空的。这里必须走 litellm 的 ``extra_body``：
    deepseek 被映射成 openai 兼容路由，而 litellm 对该路由的 ``thinking``
    参数会直接抛 UnsupportedParamsError，把整条主链打死。

    未列出的供应商一律返回空：把没验证过的字段塞进请求体，可能让供应商
    对每个请求都返回 400，代价远大于少一段推理文本。
    """
    if config.provider == "deepseek" and DEEPSEEK_HYBRID_REASONING.match(config.model.strip()):
        # 与 src/worker.ts 直连路径同一份契约（thinking: { type: 'enabled' }）。
        return {"thinking": {"type": "enabled"}}
    return {}


def _thinking_planner(config: SelectedModelConfig) -> BuiltInPlanner | None:
    """ADK 原生 Gemini 路由要靠 planner 才会回传 thought part。"""
    if config.provider == "gemini" and not config.api_key and GEMINI_THINKING_MODEL.search(config.model):
        return BuiltInPlanner(thinking_config=types.ThinkingConfig(include_thoughts=True))
    return None


def reasoning_is_requested(config: SelectedModelConfig) -> bool:
    """本轮是否真的向供应商申请了推理输出。前端据此决定要不要摆"等待推理"占位符。"""
    return bool(reasoning_extra_body(config)) or _thinking_planner(config) is not None


def _model(config: SelectedModelConfig, *, reasoning: bool = False, deterministic: bool = False) -> str | BaseLlm:
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
    if reasoning:
        extra_body = reasoning_extra_body(config)
        if extra_body:
            kwargs["extra_body"] = extra_body
    if deterministic:
        # 审核员是判定器而不是作者。默认温度下同一份输入会时松时严——线上同一个问题
        # 三次是 拦/过/拦，两次拒绝理由还完全不同。分类器不需要创造性。
        kwargs["temperature"] = 0
    return LiteLlm(model=model_name, **kwargs)


def _reasoning_kwargs(config: SelectedModelConfig) -> dict[str, Any]:
    planner = _thinking_planner(config)
    return {"planner": planner} if planner else {}


def build_scope_supervisor(
    selected_model: SelectedModelConfig,
    tool_factory: ToolFactory,
    role: str,
    domain_map: DomainMap | None = None,
) -> LlmAgent:
    # 对象判断是本轮最先执行的阶段，用户等待的头几十秒全在这里。它必须开推理，
    # 否则思考链在开场阶段一定是空的。
    #
    # 领域地图烘进指令而不是每轮拼进 prompt：它对整个进程是常量，
    # 而指令随 Runner 一起缓存，等于每轮省下一次重复序列化。
    catalog = domain_map.render_catalog() if domain_map else ""
    return LlmAgent(
        name="scope_supervisor",
        description="理解用户真实主体与意图，在编排前限定专家可见性。",
        model=_model(selected_model, reasoning=True),
        instruction=f"{SUPERVISOR_INSTRUCTION}\n\n{catalog}" if catalog else SUPERVISOR_INSTRUCTION,
        tools=tool_factory.toolsets_for_operations(role=role, operation_ids={"resolve_workspace_subject"}),
        mode="chat",
        include_contents="none",
        after_tool_callback=capture_tool_evidence,
        **_reasoning_kwargs(selected_model),
    )


def build_agent_bundle(selected_model: SelectedModelConfig, tool_factory: ToolFactory, role: str, allowed_specialists: set[str]) -> tuple[LlmAgent, LlmAgent]:
    # Coordinator, specialists and auditor must all use the exact
    # selected model. A cheaper or different auditor would violate the UI/model contract.
    # 推理输出只向协调器与专家申请：审核员是布尔闸门，它的推理既不该展示给用户
    # （里面带着还没过闸的答案草稿），也没必要为此多付推理 token。
    coordinator_model = _model(selected_model, reasoning=True)
    auditor_model = _model(selected_model, reasoning=False, deterministic=True)
    reasoning_kwargs = _reasoning_kwargs(selected_model)

    workspace_analyst = LlmAgent(
        name="workspace_analyst",
        description="语义理解真实业务对象，检索任务、进展、附件、财务、日程、记忆和项目时间线。",
        model=coordinator_model,
        instruction=f"{SPECIALIST_BASE}\n你只分析工作区的真实业务数据，不回答 Giverny 产品版本或使用方法。",
        tools=[tool_factory.toolset(role=role, groups=READ_GROUPS["workspace"])],
        mode="single_turn",
        after_tool_callback=capture_tool_evidence,
        **reasoning_kwargs,
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
        **reasoning_kwargs,
    )
    web_researcher = LlmAgent(
        name="web_researcher",
        description="只处理用户明确需要联网、实时或外部资料的问题。",
        model=coordinator_model,
        instruction=f"{SPECIALIST_BASE}\n只搜索用户要求的外部互联网信息，不用外网结果替代工作区数据。",
        tools=[tool_factory.toolset(role=role, groups=READ_GROUPS["web"])],
        mode="single_turn",
        after_tool_callback=capture_tool_evidence,
        **reasoning_kwargs,
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
        **reasoning_kwargs,
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
        **reasoning_kwargs,
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
