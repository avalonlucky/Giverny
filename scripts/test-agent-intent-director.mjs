import assert from 'node:assert/strict'
import {
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

console.log('Agent 意图导演单测通过：普通问答、业务写入、产品帮助、全域搜索、越界拒绝和角色裁剪均已覆盖。')
