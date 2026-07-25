export type AgentProactiveSignalType =
  | 'overdue'
  | 'due_soon'
  | 'ready_for_acceptance'
  | 'hours_overrun'
  | 'waiting_blocked'
  | 'acceptance_note_missing'

export type AgentProactivePriority = 'critical' | 'high' | 'medium' | 'low'

export type AgentProactiveSignal = {
  type: AgentProactiveSignalType
  priority: AgentProactivePriority
  title: string
  evidence: string[]
  recommendation: string
  suggestedPrompt: string
}

export type AgentProactiveTaskSnapshot = {
  id: number
  title: string
  status: string
  progress: number
  estimatedDeliveryDate?: string
  estimatedHours: number
  actualHours: number
  acceptanceNote?: string
  hasAcceptanceFile: boolean
  activeWaiting?: { reason?: string; note?: string; startedAt?: string }[]
}

const dayNumber = (value: string) => Math.floor(Date.parse(`${value.slice(0, 10)}T00:00:00Z`) / 86_400_000)

export function buildAgentProactiveSignals(task: AgentProactiveTaskSnapshot, today: string): AgentProactiveSignal[] {
  if (['已验收', '终止', '不计费'].includes(task.status)) return []
  const signals: AgentProactiveSignal[] = []
  const deliveryDate = task.estimatedDeliveryDate?.slice(0, 10) || ''
  if (deliveryDate) {
    const dayGap = dayNumber(deliveryDate) - dayNumber(today)
    if (dayGap < 0) {
      const overdueDays = Math.abs(dayGap)
      signals.push({
        type: 'overdue',
        priority: overdueDays >= 3 ? 'critical' : 'high',
        title: `${task.title}已逾期 ${overdueDays} 天`,
        evidence: [`预计交付日期：${deliveryDate}`, `当前状态：${task.status}`, `当前进度：${task.progress}%`],
        recommendation: '核对最新进展和延期原因，记录进展或重新调整预计交付时间。',
        suggestedPrompt: `请检查任务 #${task.id} 的逾期原因和最新进展，并生成更新进展或调整交付日期的确认草稿。`,
      })
    } else if (dayGap <= 1 && task.progress < 100) {
      signals.push({
        type: 'due_soon',
        priority: dayGap === 0 ? 'high' : 'medium',
        title: `${task.title}${dayGap === 0 ? '今天到期' : '明天到期'}`,
        evidence: [`预计交付日期：${deliveryDate}`, `当前进度：${task.progress}%`],
        recommendation: '确认剩余工作量和交付风险，必要时提前同步排期。',
        suggestedPrompt: `请检查任务 #${task.id} 的剩余工作和交付风险，并给出下一步可确认操作。`,
      })
    }
  }
  if (task.progress >= 100) {
    signals.push({
      type: 'ready_for_acceptance',
      priority: 'high',
      title: `${task.title}已达到 100%，等待验收`,
      evidence: [`当前进度：${task.progress}%`, `当前状态：${task.status}`],
      recommendation: '核对验收附件、实际工时和验收备注，准备完整验收草稿。',
      suggestedPrompt: `请检查任务 #${task.id} 当前资料，并生成完整验收草稿；执行前让我确认。`,
    })
  }
  if (task.estimatedHours > 0 && task.actualHours > task.estimatedHours * 1.25) {
    const ratio = task.actualHours / task.estimatedHours
    signals.push({
      type: 'hours_overrun',
      priority: ratio >= 1.5 ? 'high' : 'medium',
      title: `${task.title}实际工时已超出预估`,
      evidence: [`预估工时：${task.estimatedHours} 小时`, `实际工时：${task.actualHours} 小时`, `偏差：${Math.round((ratio - 1) * 100)}%`],
      recommendation: '复核需求范围、改稿和等待记录，保留偏差原因供后续估时校准。',
      suggestedPrompt: `请分析任务 #${task.id} 实际工时超出预估的原因，并给出可执行的范围调整建议。`,
    })
  }
  const waiting = task.activeWaiting || []
  if (waiting.length > 0) {
    const detail = waiting[0]
    signals.push({
      type: 'waiting_blocked',
      priority: 'high',
      title: `${task.title}仍处于等待中`,
      evidence: [`等待原因：${detail.reason || '未填写'}`, `等待说明：${detail.note || '未填写'}`, detail.startedAt ? `开始等待：${detail.startedAt}` : ''].filter(Boolean),
      recommendation: '核对阻塞是否解除；已解除则补充进展，未解除则保留等待并安排下一次跟进。',
      suggestedPrompt: `请检查任务 #${task.id} 的等待记录和后续进展，判断阻塞是否解除，并给出下一步可确认操作。`,
    })
  }
  if (task.hasAcceptanceFile && !task.acceptanceNote?.trim()) {
    signals.push({
      type: 'acceptance_note_missing',
      priority: 'medium',
      title: `${task.title}已有验收文件但缺少验收备注`,
      evidence: ['已存在验收范围附件', '验收备注：未填写'],
      recommendation: '读取任务需求和验收文件，整理准确、简洁的验收备注。',
      suggestedPrompt: `请读取任务 #${task.id} 的需求和验收附件，生成基于事实的验收备注草稿。`,
    })
  }
  return signals
}

export const agentProactivePriorityRank: Record<AgentProactivePriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}
