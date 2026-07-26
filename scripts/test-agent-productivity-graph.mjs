import assert from 'node:assert/strict'
import { runAgentProductivityGraph } from '../src/agentProductivityGraph.ts'

const executed = []
const graph = await runAgentProductivityGraph({
  execute: async (call) => {
    executed.push(call.name)
    return { call, output: { ok: true }, deterministic: true, durationMs: 1 }
  },
  observe: (observations) => observations.some((item) => item.call.name === 'get_task_detail')
    ? { status: 'complete', requiredTools: [], reason: '详情证据已齐全。' }
    : { status: 'replan', requiredTools: ['get_task_detail'], reason: '缺少任务详情。' },
  replan: async (decision) => decision.requiredTools.map((name) => ({ name, args: { taskId: 1 }, reason: decision.reason })),
}, [{ name: 'search_tasks', args: { query: '最近任务' }, reason: '先定位任务' }])

assert.deepEqual(executed, ['search_tasks', 'get_task_detail'])
assert.deepEqual(graph.path, ['execute', 'observe', 'replan', 'execute', 'observe', 'finish'])
assert.equal(graph.decision.status, 'complete')
assert.equal(graph.cycles, 2)
assert.equal(graph.toolCalls, 2)

const halted = await runAgentProductivityGraph({
  execute: async (call) => ({ call, output: { ready: false, missing: ['title'] }, deterministic: true, halt: 'needs_input', durationMs: 1 }),
  observe: () => ({ status: 'needs_input', requiredTools: [], reason: '需要用户补充字段。' }),
  replan: async () => { throw new Error('不应进入重规划') },
}, [{ name: 'create_task_preview', args: {}, reason: '创建草稿' }])
assert.equal(halted.decision.status, 'needs_input')
assert.deepEqual(halted.path, ['execute', 'observe', 'finish'])

const missingTarget = await runAgentProductivityGraph({
  execute: async (call) => ({ call, output: { results: [] }, deterministic: true, durationMs: 1 }),
  observe: () => ({ status: 'replan', requiredTools: ['get_task_detail'], reason: '需要任务详情。' }),
  replan: async () => [],
}, [{ name: 'search_tasks', args: { query: '任务' }, reason: '查找' }])
assert.equal(missingTarget.decision.status, 'needs_input')
assert.match(missingTarget.decision.reason, /补充明确对象/)

const exhausted = await runAgentProductivityGraph({
  execute: async (call) => ({ call, output: { toolFailed: true }, deterministic: false, error: '故障', durationMs: 1 }),
  observe: () => ({ status: 'replan', requiredTools: ['query_month_finance'], reason: '财务证据缺失。' }),
  replan: async (decision, _observations, cycle) => decision.requiredTools.map((name) => ({ name, args: {}, reason: `第 ${cycle + 1} 次尝试` })),
}, [{ name: 'query_month_finance', args: {}, reason: '查财务' }], { maxCycles: 3, maxToolCalls: 3 })
assert.equal(exhausted.decision.status, 'failed')
assert.equal(exhausted.cycles, 3)
assert.equal(exhausted.toolCalls, 3)
assert.match(exhausted.decision.reason, /预算上限/)

console.log('Agent productivity graph tests passed: execute-observe-replan closure, user-input halt, and hard budgets are enforced.')
