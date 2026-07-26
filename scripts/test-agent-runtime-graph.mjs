import assert from 'node:assert/strict'
import { runAgentRuntimeGraph } from '../src/agentRuntimeGraph.ts'

const principal = { workspaceId: 'default', principalId: 'graph-test', role: 'admin', runId: 'graph-test' }
const request = { question: '帮我新建一个任务', currentMonth: '2026-07', history: [], principal }
const simpleDecision = {
  goal: '新建任务', domains: ['tasks'], operation: 'create_task', requiresBusinessData: true,
  requiresProductKnowledge: false, isWrite: true, missingInformation: [], confidence: 0.99,
  rationale: '明确的新建任务操作。', complexity: 'simple',
  proposedCalls: [{ name: 'create_task_preview', args: {}, reason: '生成任务草稿' }],
}

let plannerCalls = 0
const baseDependencies = {
  understand: async () => simpleDecision,
  shortlist: () => ['create_task_preview'],
  plan: async () => {
    plannerCalls += 1
    return { calls: [], needsInput: false, followUpQuestion: '', answerIfNoTools: '' }
  },
  authorize: (_decision, plan, allowed) => ({
    calls: plan.calls.filter((call) => allowed.includes(call.name)),
    denied: plan.calls.filter((call) => !allowed.includes(call.name)).map((call) => call.name),
  }),
}

const simple = await runAgentRuntimeGraph(baseDependencies, request)
assert.deepEqual(simple.calls.map((call) => call.name), ['create_task_preview'])
assert.deepEqual(simple.path, ['understand', 'shortlist', 'direct_authorize', 'finish'])
assert.equal(simple.modelCalls, 1)
assert.equal(plannerCalls, 0)

const complex = await runAgentRuntimeGraph({
  ...baseDependencies,
  understand: async () => ({ ...simpleDecision, complexity: 'complex', proposedCalls: [] }),
  plan: async () => {
    plannerCalls += 1
    return { calls: [{ name: 'create_task_preview', args: {}, reason: '复杂请求规划' }], needsInput: false, followUpQuestion: '', answerIfNoTools: '' }
  },
}, { ...request, question: '新建任务，再查询本月金额' })
assert.deepEqual(complex.path, ['understand', 'shortlist', 'plan', 'authorize', 'finish'])
assert.equal(complex.modelCalls, 2)

plannerCalls = 0
const rejectedFastPath = await runAgentRuntimeGraph({
  ...baseDependencies,
  understand: async () => ({ ...simpleDecision, proposedCalls: [{ name: 'search_product_help', args: { query: '任务' }, reason: '越界' }] }),
  plan: async () => {
    plannerCalls += 1
    return { calls: [{ name: 'create_task_preview', args: {}, reason: '重新规划' }], needsInput: false, followUpQuestion: '', answerIfNoTools: '' }
  },
}, request)
assert.deepEqual(rejectedFastPath.calls.map((call) => call.name), ['create_task_preview'])
assert.deepEqual(rejectedFastPath.path, ['understand', 'shortlist', 'direct_authorize', 'plan', 'authorize', 'finish'])
assert.equal(rejectedFastPath.modelCalls, 2)
assert.equal(plannerCalls, 1)

console.log('Agent LangGraph runtime tests passed: simple commands use one model call; complex and rejected fast paths replan safely.')
