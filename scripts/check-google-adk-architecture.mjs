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
const currentManual = manual.slice(0, manual.indexOf('## 更新记录'))
const runtimeDir = 'agent-runtime/app'
const runtimeSource = readdirSync(runtimeDir)
  .filter((name) => name.endsWith('.py'))
  .map((name) => readFileSync(join(runtimeDir, name), 'utf8'))
  .join('\n')
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
assert.ok(chatEntry.includes("if (!env.ADK_AGENT_URL) throw new Error('Google ADK Runtime 未启用')"), 'chat entry must fail closed without ADK')
assert.equal(
  (mainChat.match(/if \(runtimeFailureMustStop\)/g) || []).length,
  2,
  'configured ADK must fail closed for both empty output and runtime errors',
)
assert.ok(mainChat.includes("const runtimeFailureMustStop = Boolean(env.ADK_AGENT_URL) || (requiresRuntime && env.LOCAL_DEV !== '1')"), 'only an explicitly local unconfigured runtime may exercise legacy compatibility tests')
assert.ok(!chatEntry.includes('ALICE_AGENT'), 'legacy Alice/LangGraph runtime must not participate in the chat request path')
assert.ok(!chatEntry.includes('applyAgentGroundingPolicy'), 'legacy keyword grounding policy must not participate in the chat request path')
assert.ok(chatEntry.includes('modelChoice: args.modelChoice'), 'the selected settings model must be forwarded into the ADK request path')
assert.ok(worker.includes('selectedModel: {'), 'Worker must send an exact provider/model/baseUrl contract to ADK')
assert.ok(worker.includes('模型一致性校验失败'), 'Worker must reject any ADK response whose provider/model differs from settings')
assert.ok(runtimeSource.includes('selected_model: SelectedModelConfig'), 'ADK request schema must require the exact selected model')
assert.ok(runtimeSource.includes('"modelPolicy": "exact-selected-model-no-fallback"'), 'ADK response must attest the no-fallback exact-model policy')
assert.ok(runtimeSource.includes('model=selected_model.model'), 'ADK response must report the exact requested model')
assert.ok(runtimeSource.includes('TOTAL_LLM_CALL_LIMIT = 7'), 'ADK must cap one outer request at seven model calls')
assert.ok(runtimeSource.includes('RunConfig(streaming_mode=StreamingMode.SSE, max_llm_calls=max_llm_calls)'), 'coordinator and specialists must receive a hard ADK model-call limit')
assert.ok(runtimeSource.includes('run_config=RunConfig(max_llm_calls=max_llm_calls)'), 'structured stages must receive a hard ADK model-call limit')
assert.ok(worker.includes('data.orchestration?.modelCallLimit !== 7'), 'Worker must reject a runtime that does not attest the seven-call limit')
assert.ok(worker.includes('async function probeAdkRuntimeHealth'), 'Worker must expose a no-model ADK connectivity probe')
assert.ok(worker.includes("`${baseUrl}/health`"), 'ADK connectivity probe must call health rather than a model endpoint')
assert.ok(worker.includes("searchParams.get('runtime') === '1'"), 'runtime health probing must be explicit rather than added to every health request')
assert.ok(!runtimeSource.includes('GIVERNY_COORDINATOR_MODEL'), 'ADK must not retain a hidden fixed coordinator model')
assert.ok(!runtimeSource.includes('GIVERNY_AUDITOR_MODEL'), 'ADK must not retain a hidden fixed auditor model')
assert.ok(costGovernance.includes('不得把“继续”“修复”“发布收尾”解释为付费授权'), 'cost governance must require explicit per-action approval')
assert.ok(costGovernance.includes('外层请求数量不能替代内部模型调用上限'), 'cost governance must budget internal model fan-out')
assert.ok(agentInstructions.includes('任何可能新增、扩大或重复产生费用的操作'), 'project instructions must enforce the cost approval red line')
assert.ok(operationsGuide.includes('未获当前轮明确批准时，只能进行本地静态检查、Mock 测试、文档修改和不调用模型的健康检查'), 'operations guide must fail closed without cost approval')
assert.ok(routingGuide.includes('Scope Supervisor、Root Coordinator、各专家、回答格式化器和 Evidence Auditor 必须全部使用这一个模型'), 'routing guide must require one exact model for every ADK role')
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
// 答案草稿必须先过证据审核才能露面，所以 thought part 不能混进正文。
assert.ok(
  runtimeSource.includes('if not getattr(part, "thought", False)'),
  'answer text must exclude thought parts so unverified reasoning never becomes the draft',
)

console.log('Google ADK 主链架构守卫通过：精确模型一致性、费用审批、语义编排、证据审核、写入隔离、流式思考链与用户手册均已锁定。')
