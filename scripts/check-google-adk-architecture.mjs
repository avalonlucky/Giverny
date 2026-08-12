import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const worker = readFileSync('src/worker.ts', 'utf8')
const schema = readFileSync('db/schema.sql', 'utf8')
const requirements = readFileSync('agent-runtime/requirements.txt', 'utf8')
const manual = readFileSync('使用手册.md', 'utf8')
const routingGuide = readFileSync('docs/AI_MODEL_ROUTING.md', 'utf8')
const operationsGuide = readFileSync('docs/AGENT_PRODUCTION_OPERATIONS.md', 'utf8')
const costGovernance = readFileSync('docs/AI_COST_AND_MODEL_GOVERNANCE.md', 'utf8')
const agentInstructions = readFileSync('AGENTS.md', 'utf8')
const evalMock = readFileSync('agent-evals/mock-model.mjs', 'utf8')
const timeline = readFileSync('src/components/AgentExecutionTimeline.tsx', 'utf8')
const evidenceSource = readFileSync('agent-runtime/app/evidence.py', 'utf8')
const currentManual = manual.slice(0, manual.indexOf('## 更新记录'))
const runtimeDir = 'agent-runtime/app'
const runtimeSource = readdirSync(runtimeDir)
  .filter((name) => name.endsWith('.py'))
  .map((name) => readFileSync(join(runtimeDir, name), 'utf8'))
  .join('\n')
const adkEntry = worker.slice(worker.indexOf('async function callAdkAgentRuntime('), worker.indexOf('async function callAgentRuntime('))
const chatEntry = worker.slice(worker.indexOf('async function callAgentRuntime('), worker.indexOf('async function reviseAgentApproval('))
const mainChat = worker.slice(worker.indexOf('async function chatWithAi('), worker.indexOf('async function chatWithAiInstrumented('))

assert.ok(runtimeSource.includes('from google.adk.agents import LlmAgent'), 'ADK coordinator must use Google ADK LlmAgent')
assert.ok(runtimeSource.includes('Evidence Auditor'), 'ADK runtime must include an independent evidence auditor')
assert.ok(runtimeSource.includes('confirmation in {"signed-execute", "system-only"}'), 'model toolset must reject execute/system operations')
assert.ok(runtimeSource.includes('key != "confirmationToken"'), 'confirmation token must be removed before model/auditor context')
assert.ok(!/^\s*(?:from|import)\s+.*langgraph/im.test(runtimeSource), 'independent ADK runtime must not import LangGraph')
assert.ok(requirements.includes('google-adk[db]'), 'ADK database session dependency must be explicit')
assert.ok(!requirements.includes('google-adk[extensions]'), 'broad ADK extensions must not pull LangGraph into the runtime image')
assert.ok(requirements.includes('litellm'), 'ADK must include the narrow multi-provider adapter without pulling the broad extensions bundle')
assert.ok(chatEntry.includes("if (!env.ADK_AGENT_URL) throw new Error('工作助手服务未启用。')"), 'chat entry must fail closed without ADK')
// 用户可见的报错里不得出现框架名：用户已经两次因此抱怨"暴露自己用什么框架"。
assert.ok(!/new Error\(`?'?Google ADK Runtime/.test(worker), 'user-facing errors must not name the orchestration framework')
assert.ok(worker.includes("event: 'adk_runtime_bounds_missing'"), 'a bounds mismatch must be logged instead of shown as internal numbers')
assert.equal(
  (mainChat.match(/if \(runtimeFailureMustStop\)/g) || []).length,
  2,
  'configured ADK must fail closed for both empty output and runtime errors',
)
assert.ok(mainChat.includes("const runtimeFailureMustStop = Boolean(env.ADK_AGENT_URL) || (requiresRuntime && env.LOCAL_DEV !== '1')"), 'only an explicitly local unconfigured runtime may exercise legacy compatibility tests')
assert.ok(!chatEntry.includes('ALICE_AGENT'), 'legacy Alice/LangGraph runtime must not participate in the chat request path')
assert.ok(!chatEntry.includes('applyAgentGroundingPolicy'), 'legacy keyword grounding policy must not participate in the chat request path')
assert.ok(adkEntry.includes('const effectiveChoice = await getActiveChatModelChoice(env)'), 'ADK must resolve the persisted backend model setting for every request')
assert.ok(!adkEntry.includes('args.modelChoice'), 'a stale browser model choice must never override the persisted backend setting')
assert.ok(worker.includes('selectedModel: {'), 'Worker must send an exact provider/model/baseUrl contract to ADK')
assert.ok(worker.includes('模型一致性校验失败'), 'Worker must reject any ADK response whose provider/model differs from settings')
assert.ok(runtimeSource.includes('selected_model: SelectedModelConfig'), 'ADK request schema must require the exact selected model')
assert.ok(runtimeSource.includes('"modelPolicy": "exact-selected-model-no-fallback"'), 'ADK response must attest the no-fallback exact-model policy')
assert.ok(runtimeSource.includes('model=selected_model.model'), 'ADK response must report the exact requested model')
// 调用次数是防打转开关，不是费用预算：真正约束一轮规模的是 240 秒时间墙
// （单次调用 15–25 秒，一轮实际最多十几次）。把次数卡到刚好够用只会让正常的
// 第二轮检索撞墙，结论查清了却写不出来。但也不能不设，否则 ADK 默认 500 次会一直转到超时。
assert.ok(
  runtimeSource.includes('TOTAL_LLM_CALL_LIMIT = SUPERVISOR_LLM_CALL_LIMIT + COORDINATOR_LLM_CALL_LIMIT + AUDITOR_LLM_CALL_LIMIT + REPAIR_LLM_CALL_LIMIT'),
  'the call ceiling must be derived from the per-stage loop guards rather than hand-tuned',
)
assert.ok(runtimeSource.includes('这些数字是**防打转开关，不是费用预算**'), 'the call ceiling must be documented as a loop guard, not a cost budget')
assert.ok(runtimeSource.includes('"turnBudgetSeconds": self.settings.turn_budget_seconds'), 'the runtime must attest its wall-clock bound, which is the real limit on one turn')
assert.ok(runtimeSource.includes('RunConfig(streaming_mode=StreamingMode.SSE, max_llm_calls=max_llm_calls)'), 'coordinator and specialists must receive a hard ADK model-call limit')
assert.ok(runtimeSource.includes('RunConfig(streaming_mode=StreamingMode.SSE, max_llm_calls=max_llm_calls)'), 'all model stages must stream under a hard ADK model-call limit')
// 校验"边界存在且收在 Worker 之内"，而不是某个具体数字——钉死数字会让每次编排调优都变成契约不兼容。
assert.ok(worker.includes('const boundedOrchestration ='), 'Worker must verify that the runtime declares finite execution bounds')
assert.ok(worker.includes('declaredTurnBudget < 280'), 'the declared turn budget must nest inside the Worker subrequest limit')
assert.ok(worker.includes('工作助手服务版本不一致，已阻止返回未经校验的结果'), 'a runtime without declared bounds must be rejected explicitly')
assert.ok(worker.includes('async function probeAdkRuntimeHealth'), 'Worker must expose a no-model ADK connectivity probe')
assert.ok(worker.includes("`${baseUrl}/health`"), 'ADK connectivity probe must call health rather than a model endpoint')
// 发布顺序必须可核对，而不是只能声称：Runtime 先上才会在 /health 报出新契约。
assert.ok(runtimeSource.includes('RUNTIME_CONTRACT = "domain-map-1"'), 'the runtime must publish a verifiable streaming contract version')
assert.ok(worker.includes("contract: String(payload.contract || '')"), 'the no-model probe must surface the runtime contract so deploy order can be verified')
assert.ok(worker.includes("searchParams.get('runtime') === '1'"), 'runtime health probing must be explicit rather than added to every health request')
assert.ok(!runtimeSource.includes('GIVERNY_COORDINATOR_MODEL'), 'ADK must not retain a hidden fixed coordinator model')
assert.ok(!runtimeSource.includes('GIVERNY_AUDITOR_MODEL'), 'ADK must not retain a hidden fixed auditor model')
assert.ok(costGovernance.includes('不得把“继续”“修复”“发布收尾”解释为付费授权'), 'cost governance must require explicit per-action approval')
assert.ok(costGovernance.includes('外层请求数量不能替代内部模型调用上限'), 'cost governance must budget internal model fan-out')
assert.ok(agentInstructions.includes('任何可能新增、扩大或重复产生费用的操作'), 'project instructions must enforce the cost approval red line')
assert.ok(operationsGuide.includes('未获当前轮明确批准时，只能进行本地静态检查、Mock 测试、文档修改和不调用模型的健康检查'), 'operations guide must fail closed without cost approval')
assert.ok(routingGuide.includes('后台设置 A 就必须让 Scope Supervisor、Root Coordinator、各专家和 Evidence Auditor 全部使用 A'), 'routing guide must require the persisted A/B choice for every ADK role')
assert.ok(currentManual.includes('Google ADK 是编排框架，不是另一个模型'), 'manual must explain that ADK cannot override the selected model')
assert.ok(currentManual.includes('前台不得显示 DeepSeek、后台却运行 Gemini'), 'manual must explicitly prohibit UI/runtime model mismatch')
assert.ok(evalMock.includes("throw new Error('评测请求缺少 selectedModel 精确模型契约')"), 'isolated ADK eval must reject requests without the selected model contract')
assert.ok(evalMock.includes("modelPolicy: 'exact-selected-model-no-fallback'"), 'isolated ADK eval must attest the exact model policy')
assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS agent_adk_pending_actions'), 'D1 must durably hold private confirmation state')
assert.ok(currentManual.includes('生产文本对话统一由 Google ADK 语义主链编排'), 'manual must describe Google ADK as the production text-chat mainline')
assert.ok(currentManual.includes('本机 CLI 配对状态只说明连接是否可用'), 'manual must separate local CLI pairing from chat runtime identity')
assert.ok(manual.includes('v0.37.1 Google ADK 语义 Agent 主链'), 'manual must include the v0.37.1 user-facing release entry')
for (const staleStatement of [
  '普通问答和本机文件任务可直接使用 CLI',
  '自动 · 本机 CLI',
  '以下情况会继续使用云端 Agent',
  '跨月复盘等持久任务进入 Cloudflare `AliceAgent`',
  '普通问答可使用当前电脑连接的 Codex CLI',
  '工作助手实际走了本机 CLI、站内工具还是云端模型',
  '当前选择的模型理解完整问题',
  '至少 99% 请求必须由用户选择的主模型完成',
  '正式站会优先调用独立 BAML Runtime',
  '不用于替换 ADK 协调与证据审核模型',
]) {
  assert.ok(!currentManual.includes(staleStatement), `manual still contains legacy routing statement: ${staleStatement}`)
}

// 编排耗时 60–150 秒。非流式的单次子请求会被 Cloudflare 掐断并合成 520，
// 而且用户全程只看到一句静止文案；因此流式与心跳属于契约，不是优化项。
assert.ok(runtimeSource.includes('/v1/chat/stream'), 'ADK runtime must expose a streaming chat endpoint')
assert.ok(runtimeSource.includes('keep-alive'), 'streaming endpoint must emit heartbeats while orchestration is silent')
assert.ok(runtimeSource.includes('on_step'), 'orchestration stages must report progress steps as they happen')
assert.ok(worker.includes('readAdkChatStream'), 'Worker must consume the ADK streaming endpoint')
assert.ok(worker.includes('/v1/chat/stream'), 'Worker must target the ADK streaming endpoint when a trace sink exists')
assert.ok(worker.includes('if (!data.streamedSteps)'), 'streamed turns must not re-emit the raw audit trace to the UI')

// 用户可见的思考步骤必须是自然语言：不得出现框架名、专家代号或原始 operationId。
assert.ok(
  runtimeSource.includes('return f"正在{summary}" if summary else "正在查阅业务数据"'),
  'visible steps must be derived from OpenAPI summaries and never fall back to a raw operationId',
)
assert.ok(runtimeSource.includes('tool_name != "transfer_to_agent"'), 'specialist delegation must stay out of user-visible steps')

// 长阶段内部也必须持续有反馈：只靠阶段边界的话，模型思考几十秒时界面依然定住。
assert.ok(runtimeSource.includes('streaming_mode=StreamingMode.SSE'), 'the long coordinator stage must stream partial events')
assert.ok(runtimeSource.includes('def _thought_text'), 'reasoning parts must be extracted separately from the answer')
assert.ok(worker.includes("parsed?.type === 'thinking'"), 'Worker must relay reasoning chunks to the typewriter channel')
assert.ok(worker.includes('trace: uniqueAgentTrace([...routingTrace, ...cloudTrace]), thinking: streamingRationale'), 'reasoning and execution progress must use separate transport fields')
assert.ok(runtimeSource.includes('resolve_workspace_subject'), 'scope supervisor must ground ambiguous workspace objects before routing')

// 排版规范：文档是给人评审的完整版，提示词是模型唯一能看到的操作版，两者不能漂移。
// 规范按数据形状分类而非业务领域分类——按领域分类会写成一堆特例，遇到没见过的问题就没有依据。
const answerLayout = readFileSync('docs/AGENT_ANSWER_LAYOUT.md', 'utf8')
assert.ok(runtimeSource.includes('结构由数据形状决定，不由业务领域决定'), 'the answer layout rule must be shape-driven, not domain-specific')
assert.ok(answerLayout.includes('## 2. 形状 → 结构（决策表）'), 'the layout spec must carry the shape decision table')
for (const shapeRule of ['3 项以上同结构数据', '有先后顺序的操作', '不使用 Markdown 标题', '一句话能说清就只回一句话']) {
  assert.ok(runtimeSource.includes(shapeRule), `coordinator instruction must carry the layout rule: ${shapeRule}`)
  assert.ok(answerLayout.includes(shapeRule), `layout spec must carry the same rule: ${shapeRule}`)
}
// 取值格式必须与站内显示函数一致，否则用户无法把回答和界面交叉核对。
for (const [valueFormat, source] of [['1,234.5', 'formatYuan'], ['3 小时 20 分钟', 'formatDurationZh'], ['2026 年 8 月', 'monthLabelCn'], ['2026/08/10 16:14', 'formatMonthDayTime']]) {
  assert.ok(runtimeSource.includes(valueFormat), `coordinator instruction must pin the in-app value format: ${valueFormat}`)
  assert.ok(answerLayout.includes(source), `layout spec must cite the in-app formatter for ${valueFormat}: ${source}`)
}
assert.ok(answerLayout.includes('列出候选项'), 'the clarification template must list candidates instead of only asking for a better name')

// 混合推理模型不显式打开开关就不返回 reasoning_content，思考链只能是空的。
// deepseek 走 litellm 的 openai 兼容路由，该路由的 thinking 参数会直接抛
// UnsupportedParamsError，所以开关只能经 extra_body 透传。
assert.ok(runtimeSource.includes('def reasoning_extra_body'), 'the runtime must ask the provider for reasoning output')
assert.ok(
  runtimeSource.includes('return {"thinking": {"type": "enabled"}}'),
  'DeepSeek V4 must receive the same thinking switch the direct model path already sends',
)
assert.ok(runtimeSource.includes('kwargs["extra_body"] = extra_body'), 'the reasoning switch must travel as extra_body, never as a litellm top-level param')
assert.ok(!/kwargs\["thinking"\]/.test(runtimeSource), 'a top-level thinking param would make every openai-route request fail')
assert.ok(runtimeSource.includes('_model(selected_model, reasoning=True)'), 'the long orchestration stages must request reasoning output')
assert.ok(runtimeSource.includes('auditor_model = _model(selected_model, reasoning=False, deterministic=True)'), 'the auditor gate needs no visible reasoning and must run deterministically')
// 审核员是判定器：默认温度下同一份输入会时松时严，线上同一个问题出现过 拦/过/拦。
assert.ok(runtimeSource.includes('kwargs["temperature"] = 0'), 'the auditor must not vary run to run')
// 阻断问题与措辞建议必须分开，否则措辞偏好会把正确答案整段拦掉。
assert.ok(runtimeSource.includes('advisory: list[str]'), 'the audit contract must separate blocking defects from wording advice')
assert.ok(runtimeSource.includes('只能写进 advisory，不得因此拒绝'), 'the auditor must be told which findings may never block')
// 一轮修复：审核不通过时按意见重写，重写稿必须重新过审。只有一轮，绝不循环。
// 修复"只有一轮"由结构保证（没有循环），不靠次数上限——次数只是防打转开关。
assert.ok(runtimeSource.includes('REPAIR_LLM_CALL_LIMIT = 6'), 'the repair round needs its own loop guard')
// 爆预算不是服务故障：线上用户看到过「Agent Runtime 暂时不可用：Max number of llm calls limit of 4 exceeded」。
assert.ok(runtimeSource.includes('except LlmCallsLimitExceededError:'), 'exhausting the call budget must land as an answer, not as a framework error')
assert.ok(runtimeSource.includes('def _incomplete_response'), 'an unfinished turn still needs a complete, verifiable response payload')
assert.ok(runtimeSource.includes('"detail": "这一轮没能完成，请稍后再试一次。"'), 'the user-facing error text must never carry the raw exception')
assert.ok(runtimeSource.includes('"technical": f"{type(error).__name__}: {error}"'), 'the technical cause must still be reported for audit')
assert.ok(worker.includes("event: 'adk_runtime_error'"), 'the Worker must log the technical cause instead of rendering it')
assert.ok(runtimeSource.includes('先用覆盖面最广的那个搜索工具'), 'specialists must not burn the budget re-confirming the same fact with narrower tools')
assert.ok(runtimeSource.includes('and deterministic.passed'), 'a deterministic failure is a hard defect and must never be papered over by a rewrite')
assert.ok(
  runtimeSource.includes('if reaudit is not None and reaudit.passed and reaudit.recommendation == "publish":'),
  'a repaired draft may only publish after passing the same audit again',
)
assert.ok(
  !/(?:while|for)[^\n]*repair/i.test(runtimeSource),
  'the repair round must never become a retry loop',
)
assert.ok(runtimeSource.includes('BuiltInPlanner(thinking_config=types.ThinkingConfig(include_thoughts=True))'), 'the native Gemini route needs a thinking planner to emit thought parts')
assert.ok(runtimeSource.includes('def reasoning_stream_expected'), 'the runtime must tell the client whether reasoning was requested at all')
assert.ok(worker.includes("if (parsed?.type === 'accepted') onReasoningExpected?.(parsed.reasoning === true)"), 'Worker must relay the reasoning declaration from the handshake frame')

// 推理内容与 intent_summary 都是模型自由文本，会照着提示词念出内部名词。
// 这两条通道直接渲染给用户，所以出口必须消毒——trace 有过滤器，thinking 也必须有。
assert.ok(runtimeSource.includes('def _scrub_internal'), 'model-authored text must be scrubbed before it reaches the user')
assert.ok(runtimeSource.includes('await on_thought(self._scrub_internal(thoughts.text()))'), 'the reasoning channel must be scrubbed, not only the trace channel')
assert.ok(runtimeSource.includes('cleaned = _sanitize_step(self._scrub_internal(text))'), 'model-authored step text must be scrubbed too')
assert.ok(timeline.includes('function scrubInternalNames'), 'the UI must keep a second scrubbing layer for reasoning text')
// 推理此前整段塞进单个 <p>，换行被 HTML 折叠成一堵墙；跑完还一直展开着，把执行过程挤走。
assert.ok(timeline.includes('function splitReasoning'), 'reasoning must render as paragraphs instead of one collapsed block')
assert.ok(timeline.includes('thinking-reasoning-fold'), 'a finished turn must fold the long reasoning behind one click')
assert.ok(timeline.includes('running ? ('), 'a running turn must keep the live reasoning visible — that is the whole point of streaming it')
assert.ok(timeline.includes('scrubInternalNames(thinking?.trim() ?? \'\')'), 'reasoning text must never be rendered unscrubbed')
assert.ok(evalMock.includes('由 Google ADK 编排'), 'the eval stub must emit dirty reasoning so the scrubbing assertions are not vacuous')

// ADK 的 SSE 分片是增量，段末再补一帧聚合全文。靠 endswith 猜就会吞掉重复分片
// （JSON 里的 "" 和 }}），丢一次末尾聚合帧就会被追加成垃圾 JSON，整轮 502。
assert.ok(runtimeSource.includes('class _StreamText'), 'stream text must be assembled from ADK partial semantics')
assert.ok(runtimeSource.includes('partial = bool(getattr(event, "partial", False))'), 'delta and aggregated frames must be distinguished by event.partial, never guessed')
assert.ok(!runtimeSource.includes('def _merge_stream_text'), 'the lossy endswith-based merge must not come back')
assert.ok(runtimeSource.includes('if accepts_result and not partial:'), 'structured parsing must only run on aggregated frames')

// ADK 的委派工具名固定是 transfer_to_agent，真正的专家名只在 args 里，
// 只看 detail 的话 used_specialists 与 productivity.path 永远是空数组。
assert.ok(runtimeSource.includes('.get("agent_name")'), 'delegation attribution must read the transfer target from the call arguments')
assert.ok(runtimeSource.includes('item.get("agent") in allowed_specialists'), 'used specialists must be derived from the transfer target, not the tool name')
assert.ok(!/"detail": tool_name\}\)/.test(runtimeSource), 'the delegation entry must carry the resolved target alongside the tool name')

// 审核员的推理里带着还没过闸的答案草稿，展示它等于绕过这道闸门自己。
assert.ok(!runtimeSource.includes('thought("证据复核"'), 'the auditor stage must never feed the user-visible reasoning channel')
// 结论不是 answered 时 passed 恒为 False、答案已被固定文案取代，那次调用改变不了任何输出。
assert.ok(runtimeSource.includes('audited = output.status == "answered"'), 'the auditor must be skipped when its verdict cannot change the output')
assert.ok(
  runtimeSource.includes('passed = (fast_path or audited) and deterministic.passed and semantic_audit.passed'),
  'publishing always requires deterministic reconciliation to pass, whether or not the semantic auditor ran',
)

// 每阶段各拿一份单阶段超时，最坏能跑到 450 秒，而 Worker 280 秒就掐断。
assert.ok(runtimeSource.includes('turn_deadline = time.monotonic() + self.settings.turn_budget_seconds'), 'one turn must carry a single total budget')
assert.ok(runtimeSource.includes('return min(self.settings.request_timeout_seconds, remaining)'), 'per-stage timeouts must nest inside the turn budget')
assert.ok(!/timeout=self\.settings\.request_timeout_seconds/.test(runtimeSource), 'no stage may claim the full timeout independently of the turn budget')
assert.ok(runtimeSource.includes('turn_budget_seconds: float'), 'the turn budget must be an explicit setting')

// 非流式子请求同样会被 Cloudflare 掐断合成 520，所以传输层只能保留流式这一条。
assert.ok(!/\$\{baseUrl\}\/v1\/chat`/.test(worker), 'the Worker must not fall back to the non-streaming endpoint that Cloudflare turns into a 520')
assert.ok(worker.includes("args.onTrace ?? (async () => {})"), 'callers without a trace sink must still use the streaming transport')

// 核心判据是"答案里的事实值在不在证据里"，不是模型自己声明的证据编号。
// 编号对账要求模型手抄哈希，而线上真实案例是每个数值都真实存在于证据中、
// 只因抄错哈希被整段拦下——这是整个闸门此前的承重墙，也是最不可靠的一环。
assert.ok(evidenceSource.includes('def unsupported_values'), 'the gate must reconcile answer values against the evidence corpus')
assert.ok(evidenceSource.includes('答案里的「'), 'an unsupported value must be reported as the blocking reason')
assert.ok(
  /advisory\.append\(f"声明引用了不存在的证据编号/.test(evidenceSource),
  'a wrong evidence id must be recorded for audit, never used to block a factually grounded answer',
)
assert.ok(evidenceSource.includes('def _subject_is_grounded'), 'subject grounding must tolerate paraphrase instead of requiring a substring')
// 派生值（"14 天"是两个日期算出来的）不在证据里，对账它只会大量误拦。
assert.ok(evidenceSource.includes('刻意不对账派生值'), 'derived arithmetic must stay out of value reconciliation')
// 用户的猜测不是事实：问"是 B09 还是 B10"时 B10 只是候选。
assert.ok(evidenceSource.includes('刻意不把用户问题算进来'), 'a value the user merely guessed must not count as grounded')
// 值全部对上时直接发布：审核员的输入是全轮最大的一份，它是尾部延迟的来源。
assert.ok(runtimeSource.includes('fast_path = output.status == "answered" and deterministic.passed and reconcilable'), 'a fully reconciled answer must publish without a semantic audit call')
assert.ok(runtimeSource.includes('elif audited:'), 'the semantic auditor must remain reachable when reconciliation is inconclusive')

// 确定性证据门只能拦真正在陈述业务事实的回答。既没工具证据也没事实声明的请求
// （写文案、闲聊）被拦下来时，用户会收到一句系统根本没做过的"我已查到相关资料"。
assert.ok(evidenceSource.includes('if output.status == "answered" and output.claims and not evidence.records'), 'claims without any tool evidence must still be blocked')
assert.ok(
  /VERSION_PATTERN = re\.compile\(r"\(\?<!\[A-Za-z0-9\]\)\(v\|ver\|rev\|rc\|b\)/.test(evidenceSource),
  'version detection must be limited to real version prefixes so "Logo 3" cannot block a correct answer',
)
assert.ok(runtimeSource.includes('if grounded.get("resolutionStatus") == "resolved":'), 'an ambiguous resolution must not destroy the product-support route')

// Runtime 的 systemd 单元设了 MemoryMax=1200M，只增不减的字典就是慢性 OOM。
assert.ok(runtimeSource.includes('_ADAPTER_CACHE_LIMIT'), 'model adapter caches must be bounded')
assert.ok(runtimeSource.includes('class _ConversationGate'), 'conversation locks must be reference counted rather than accumulated forever')
assert.ok(runtimeSource.includes('self._conversation_locks.pop(lock_key, None)'), 'a finished turn must release its conversation gate')
// 答案草稿必须先过证据审核才能露面，所以 thought part 不能混进正文。
assert.ok(
  runtimeSource.includes('if not getattr(part, "thought", False)'),
  'answer text must exclude thought parts so unverified reasoning never becomes the draft',
)

console.log('Google ADK 主链架构守卫通过：精确模型一致性、费用审批、语义编排、证据审核、写入隔离、流式思考链与用户手册均已锁定。')
