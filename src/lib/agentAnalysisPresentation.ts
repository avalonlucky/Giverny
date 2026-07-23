import type { AgentBackgroundTask } from '../types/agent'

export function agentAnalysisStatusLabel(status: AgentBackgroundTask['status']) {
  if (status === 'running') return '分析中'
  if (status === 'completed') return '已完成'
  if (status === 'failed') return '分析失败'
  if (status === 'cancelled') return '已取消'
  return '已排队'
}
