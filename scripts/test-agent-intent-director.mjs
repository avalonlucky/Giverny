import assert from 'node:assert/strict'
import {
  applyAgentConversationFollowUpPolicy,
  groundDirectAgentCalls,
  normalizeAgentDirectorDecision,
  shortlistAgentCapabilities,
  validateDirectedPlan,
} from '../src/agentIntentDirector.ts'

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
