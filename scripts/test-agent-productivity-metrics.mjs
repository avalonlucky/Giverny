import assert from 'node:assert/strict'
import { summarizeAgentProductivity } from '../src/agentProductivityMetrics.ts'

const summary = summarizeAgentProductivity([
  { productivity_status: 'complete', productivity_cycles: 1, productivity_tool_calls: 1, conversation_hash: 'a', created_at: '2026-07-26 10:00:00' },
  { productivity_status: 'needs_input', productivity_cycles: 1, productivity_tool_calls: 1, conversation_hash: 'b', created_at: '2026-07-26 10:01:00' },
  { productivity_status: 'complete', productivity_cycles: 2, productivity_tool_calls: 2, conversation_hash: 'b', created_at: '2026-07-26 10:02:00' },
  { productivity_status: 'needs_input', productivity_cycles: 1, productivity_tool_calls: 1, conversation_hash: 'c', created_at: '2026-07-26 10:03:00' },
  { productivity_status: 'failed', productivity_cycles: 3, productivity_tool_calls: 3, conversation_hash: 'd', created_at: '2026-07-26 10:04:00' },
])

assert.equal(summary.productivityRuns, 5)
assert.equal(summary.completedRuns, 2)
assert.equal(summary.goalCompletionRate, 40)
assert.equal(summary.firstPassCompletionRate, 20)
assert.equal(summary.replannedRuns, 2)
assert.equal(summary.recoveredRuns, 1)
assert.equal(summary.recoveryRate, 50)
assert.equal(summary.needsInputRuns, 2)
assert.equal(summary.needsInputFollowUps, 1)
assert.equal(summary.resolvedFollowUps, 1)
assert.equal(summary.followUpResolutionRate, 100)
assert.equal(summary.productivityFailedRuns, 1)
assert.equal(summary.averageProductivityCycles, 1.6)
assert.equal(summary.averageProductivityToolCalls, 1.6)

console.log('Agent productivity metric tests passed: completion, first-pass, recovery, follow-up resolution, and averages are deterministic.')
