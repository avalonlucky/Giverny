import assert from 'node:assert/strict'
import {
  applyAgentConversationFollowUpPolicy,
  applyExplicitSettlementExportPolicy,
  groundDirectAgentCalls,
  normalizeAgentDirectorDecision,
  shortlistAgentCapabilities,
  validateDirectedPlan,
} from '../src/agentIntentDirector.ts'
import { applyAgentGroundingPolicy, resolveAgentGroundingSubject } from '../src/agentGroundingPolicy.ts'
import { searchProductKnowledge } from '../src/productKnowledgeSearch.ts'
import { appVersion } from '../src/config/appConfig.ts'

const createDecision = normalizeAgentDirectorDecision({
  goal: '新建一个任务', domains: ['tasks'], operation: 'create_task',
  requiresBusinessData: true, requiresProductKnowledge: false, isWrite: true, confidence: 0.99,
})
const createTools = shortlistAgentCapabilities(createDecision, 'admin')
assert.deepEqual(createTools, ['create_task_preview'])
assert.ok(!createTools.includes('search_product_help'))
assert.ok(!createTools.includes('search_workspace'))

const productDecision = normalizeAgentDirectorDecision({
  goal: '查询快捷键', domains: ['product_help'], operation: 'general',
  requiresBusinessData: false, requiresProductKnowledge: true, isWrite: false, confidence: 0.99,
})
assert.deepEqual(shortlistAgentCapabilities(productDecision, 'guest'), ['get_giverny_context', 'search_product_help'])

const conversationDecision = normalizeAgentDirectorDecision({
  goal: '普通问答', domains: ['conversation'], operation: 'general',
  requiresBusinessData: false, requiresProductKnowledge: false, isWrite: false, confidence: 0.95,
})
assert.deepEqual(shortlistAgentCapabilities(conversationDecision, 'admin'), [])

const namedVersionSubject = resolveAgentGroundingSubject('你看看昂楷之道现在最新的是哪个版本')
assert.deepEqual(namedVersionSubject, { label: '昂楷之道', namespace: 'workspace', factKind: 'version' })
const misroutedNamedVersion = applyAgentGroundingPolicy(productDecision, '你看看昂楷之道现在最新的是哪个版本')
assert.deepEqual(misroutedNamedVersion.domains, ['workspace_search'])
assert.equal(misroutedNamedVersion.requiresProductKnowledge, false)
assert.deepEqual(misroutedNamedVersion.proposedCalls, [{
  name: 'resolve_workspace_subject',
  args: { subject: '昂楷之道', factKind: 'version', limit: 20 },
  reason: '先锁定具名对象，再聚合任务、进展、附件与对话证据。',
}])
assert.deepEqual(shortlistAgentCapabilities(misroutedNamedVersion, 'admin'), ['resolve_workspace_subject'])

const explicitProductVersion = applyAgentGroundingPolicy(conversationDecision, 'Giverny 当前最新版本是什么？')
assert.deepEqual(explicitProductVersion.domains, ['product_help'])
assert.equal(explicitProductVersion.requiresProductKnowledge, true)
assert.equal(explicitProductVersion.proposedCalls[0].name, 'search_product_help')
assert.match(searchProductKnowledge('Giverny 当前最新版本', 5).matches[0].summary, new RegExp(`v${appVersion.replaceAll('.', '\\.')}`))

const webDecision = normalizeAgentDirectorDecision({
  goal: '查询上海明天天气', domains: ['web'], operation: 'general',
  requiresBusinessData: false, requiresProductKnowledge: false, isWrite: false, confidence: 0.98,
})
assert.deepEqual(shortlistAgentCapabilities(webDecision, 'guest'), ['search_web'])
assert.ok(!shortlistAgentCapabilities(webDecision, 'guest').includes('search_product_help'))

const financeFollowUp = applyAgentConversationFollowUpPolicy(
  normalizeAgentDirectorDecision({ goal: '解释上一条回答', domains: ['product_help'], requiresProductKnowledge: true }),
  '所以刚才这个金额为什么不对？',
  [{ role: 'assistant', content: '最近一次结算回单金额 ¥0。' }],
)
assert.deepEqual(financeFollowUp.domains, ['finance'])
assert.equal(financeFollowUp.requiresProductKnowledge, false)
assert.deepEqual(financeFollowUp.proposedCalls.map((item) => item.name), ['query_settlement_exports', 'reconcile_settlement_export'])

const mistakenSettlementQuery = normalizeAgentDirectorDecision({
  goal: '查询七月导出记录', domains: ['finance'], operation: 'settlement_export',
  requiresBusinessData: true, requiresProductKnowledge: false, isWrite: false, complexity: 'simple',
  proposedCalls: [{ name: 'query_settlement_exports', args: {}, reason: '模型误选查询' }],
})
const explicitSettlementExport = applyExplicitSettlementExportPolicy(
  mistakenSettlementQuery,
  '请导出七月份的任务回单总结。',
  '2026-07',
)
assert.deepEqual(explicitSettlementExport.proposedCalls.map((item) => item.name), ['generate_settlement_receipt'])
assert.deepEqual(explicitSettlementExport.proposedCalls[0].args, { startDate: '2026-07-01', endDate: '2026-07-31' })
assert.equal(explicitSettlementExport.isWrite, true)

const currentMonthExport = applyExplicitSettlementExportPolicy(mistakenSettlementQuery, '导出本月回单', '2026-07')
assert.deepEqual(currentMonthExport.proposedCalls[0].args, { startDate: '2026-07-01', endDate: '2026-07-31' })

const februaryExport = applyExplicitSettlementExportPolicy(mistakenSettlementQuery, '生成2026年2月结算回单', '2026-07')
assert.deepEqual(februaryExport.proposedCalls[0].args, { startDate: '2026-02-01', endDate: '2026-02-28' })

const historyQuery = applyExplicitSettlementExportPolicy(mistakenSettlementQuery, '查询七月是否有导出记录', '2026-07')
assert.deepEqual(historyQuery.proposedCalls.map((item) => item.name), ['query_settlement_exports'])

const compoundHowTo = applyExplicitSettlementExportPolicy(mistakenSettlementQuery, '查一下本月结算金额，再列出所有延期任务，并告诉我网站里怎么下载回单', '2026-07')
assert.deepEqual(compoundHowTo.proposedCalls.map((item) => item.name), ['query_settlement_exports'])

const explicitDayRange = applyExplicitSettlementExportPolicy(mistakenSettlementQuery, '请帮我导出 6 月 1 号到 6 月 10 号的结算回单', '2026-07')
assert.deepEqual(explicitDayRange.proposedCalls.map((item) => item.name), ['query_settlement_exports'])

const searchDecision = normalizeAgentDirectorDecision({
  goal: '跨全站查找', domains: ['workspace_search'], operation: 'general',
  requiresBusinessData: true, requiresProductKnowledge: false, isWrite: false, confidence: 0.96,
})
assert.deepEqual(shortlistAgentCapabilities(searchDecision, 'admin'), ['search_workspace'])

const injectedPlan = validateDirectedPlan({
  decision: createDecision,
  allowedCapabilities: createTools,
  role: 'admin',
  plan: {
    calls: [
      { name: 'search_product_help', args: { query: '新建任务' }, reason: '误路由' },
      { name: 'create_task_preview', args: {}, reason: '生成任务草稿' },
    ],
    needsInput: false,
    followUpQuestion: '',
    answerIfNoTools: '',
  },
})
assert.deepEqual(injectedPlan.calls.map((item) => item.name), ['create_task_preview'])
assert.ok(injectedPlan.denied.includes('search_product_help'))

assert.deepEqual(shortlistAgentCapabilities(createDecision, 'guest'), [])

const fabricatedCreate = groundDirectAgentCalls(normalizeAgentDirectorDecision({
  goal: '新建一个任务', domains: ['tasks'], operation: 'create_task', complexity: 'simple',
  requiresBusinessData: true, requiresProductKnowledge: false, isWrite: true,
  proposedCalls: [{ name: 'create_task_preview', args: { title: '模型虚构任务', estimatedHours: 4 }, reason: '创建' }],
}), '你帮我新建一个任务')
assert.deepEqual(fabricatedCreate.proposedCalls[0].args, {})

const groundedCreate = groundDirectAgentCalls(normalizeAgentDirectorDecision({
  goal: '新建 Logo 任务', domains: ['tasks'], operation: 'create_task', complexity: 'simple',
  requiresBusinessData: true, requiresProductKnowledge: false, isWrite: true,
  proposedCalls: [{
    name: 'create_task_preview', args: { title: 'Logo 提案', estimatedHours: 4 }, reason: '创建',
    grounding: { title: 'Logo 提案', estimatedHours: '预估 4 小时' },
  }],
}), '新建 Logo 提案，预估 4 小时')
assert.deepEqual(groundedCreate.proposedCalls[0].args, { title: 'Logo 提案', estimatedHours: 4 })

const fabricatedFeedback = groundDirectAgentCalls(normalizeAgentDirectorDecision({
  goal: '查询之前反馈', domains: ['tasks'], operation: 'feedback', complexity: 'simple',
  requiresBusinessData: true, requiresProductKnowledge: false, isWrite: true,
  proposedCalls: [{ name: 'record_feedback_preview', args: { taskId: 1, note: '模型虚构的修改意见' }, reason: '误判为写入' }],
}), '查询这个任务之前的反馈')
assert.deepEqual(fabricatedFeedback.proposedCalls[0].args, {})

console.log('Agent 意图导演单测通过：普通问答、联网查询、财务追问、业务写入、参数原话依据、产品帮助、全域搜索、越界拒绝和角色裁剪均已覆盖。')
