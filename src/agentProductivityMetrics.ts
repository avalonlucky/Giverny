export type AgentProductivityMetricItem = {
  productivity_status: string
  productivity_cycles: number
  productivity_tool_calls: number
  conversation_hash: string
  created_at: string
}

export type AgentProductivityMetricSummary = {
  productivityRuns: number
  goalCompletionRate: number
  firstPassCompletionRate: number
  recoveryRate: number
  followUpResolutionRate: number
  completedRuns: number
  needsInputRuns: number
  productivityFailedRuns: number
  replannedRuns: number
  recoveredRuns: number
  needsInputFollowUps: number
  resolvedFollowUps: number
  averageProductivityCycles: number
  averageProductivityToolCalls: number
}

export function summarizeAgentProductivity<T extends AgentProductivityMetricItem>(items: T[]): AgentProductivityMetricSummary {
  const runs = items.filter((item) => ['complete', 'needs_input', 'failed'].includes(item.productivity_status))
  const productivityRuns = runs.length
  const completedRuns = runs.filter((item) => item.productivity_status === 'complete').length
  const firstPassCompletedRuns = runs.filter((item) => item.productivity_status === 'complete' && Number(item.productivity_cycles) <= 1).length
  const replannedRuns = runs.filter((item) => Number(item.productivity_cycles) > 1).length
  const recoveredRuns = runs.filter((item) => item.productivity_status === 'complete' && Number(item.productivity_cycles) > 1).length
  const needsInputRuns = runs.filter((item) => item.productivity_status === 'needs_input').length
  const productivityFailedRuns = runs.filter((item) => item.productivity_status === 'failed').length
  const averageProductivityCycles = productivityRuns
    ? Number((runs.reduce((sum, item) => sum + Math.max(0, Number(item.productivity_cycles) || 0), 0) / productivityRuns).toFixed(2))
    : 0
  const averageProductivityToolCalls = productivityRuns
    ? Number((runs.reduce((sum, item) => sum + Math.max(0, Number(item.productivity_tool_calls) || 0), 0) / productivityRuns).toFixed(2))
    : 0
  let needsInputFollowUps = 0
  let resolvedFollowUps = 0
  const conversations = new Map<string, T[]>()
  for (const item of runs) {
    if (!item.conversation_hash) continue
    conversations.set(item.conversation_hash, [...(conversations.get(item.conversation_hash) || []), item])
  }
  for (const conversation of conversations.values()) {
    const ordered = [...conversation].sort((left, right) => left.created_at.localeCompare(right.created_at))
    ordered.forEach((item, index) => {
      if (item.productivity_status !== 'needs_input') return
      const later = ordered.slice(index + 1)
      if (later.length > 0) needsInputFollowUps += 1
      if (later.some((entry) => entry.productivity_status === 'complete')) resolvedFollowUps += 1
    })
  }
  return {
    productivityRuns,
    goalCompletionRate: productivityRuns ? Number((completedRuns / productivityRuns * 100).toFixed(1)) : 0,
    firstPassCompletionRate: productivityRuns ? Number((firstPassCompletedRuns / productivityRuns * 100).toFixed(1)) : 0,
    recoveryRate: replannedRuns ? Number((recoveredRuns / replannedRuns * 100).toFixed(1)) : 0,
    followUpResolutionRate: needsInputFollowUps ? Number((resolvedFollowUps / needsInputFollowUps * 100).toFixed(1)) : 0,
    completedRuns,
    needsInputRuns,
    productivityFailedRuns,
    replannedRuns,
    recoveredRuns,
    needsInputFollowUps,
    resolvedFollowUps,
    averageProductivityCycles,
    averageProductivityToolCalls,
  }
}
