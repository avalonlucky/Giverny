import { acceptanceProgressEndDateTime, isSupplementalTask, isTaskBillable } from './taskAccounting'
import { hasAcceptanceProgress } from './taskProgress'
import type { Task, TaskUpdate } from '../types/domain'
import type { TaskContextInsight } from '../types/taskUi'

export function normalizeTaskClosure(task: Task): Task {
  if (!hasAcceptanceProgress(task)) {
    return task
  }
  const acceptanceDate = acceptanceProgressEndDateTime(task)
  return {
    ...task,
    status: '已验收',
    stage: task.stage && task.stage !== '待验收' && task.stage !== '进行中' ? task.stage : '已验收',
    progress: 100,
    actualDeliveryDate: acceptanceDate || task.actualDeliveryDate,
  }
}

function averageNumber(values: number[]) {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function buildTaskContextInsights(tasks: Task[], updates: TaskUpdate[]) {
  const updatesByTask = new Map<number, TaskUpdate[]>()
  updates.forEach((update) => {
    updatesByTask.set(update.taskId, [...(updatesByTask.get(update.taskId) ?? []), update])
  })
  const activeTasks = tasks.filter((task) => !task.voidedAt && isTaskBillable(task))
  const byType = new Map<string, Task[]>()
  activeTasks.forEach((task) => {
    const type = task.type || '未分类'
    byType.set(type, [...(byType.get(type) ?? []), task])
  })
  const insights = new Map<number, TaskContextInsight>()

  activeTasks.forEach((task) => {
    if (['已验收', '终止', '不计费'].includes(task.status)) {
      return
    }
    const type = task.type || '未分类'
    const samples = (byType.get(type) ?? []).filter((item) => (
      item.id !== task.id
      && item.status === '已验收'
      && !isSupplementalTask(item)
      && item.actualHours > 0
      && item.estimatedHours > 0
    ))
    if (samples.length < 3) {
      return
    }
    const avgActualHours = averageNumber(samples.map((item) => item.actualHours))
    const avgEstimateVariance = averageNumber(samples.map((item) => (item.actualHours - item.estimatedHours) / item.estimatedHours))
    const revisionSignals = samples.reduce(
      (sum, item) => sum + (updatesByTask.get(item.id) ?? []).filter((update) => /修改|调整|改稿|反馈|返工|revision/i.test(`${update.title} ${update.body}`)).length,
      0,
    )
    const revisionSignalsPerTask = revisionSignals / samples.length
    const candidates: Array<TaskContextInsight & { priority: number }> = []

    if (avgEstimateVariance >= 0.15) {
      const percent = Math.round(avgEstimateVariance * 100)
      candidates.push({
        tone: 'warning',
        label: `同类历史平均超时 ${percent}%`,
        detail: `基于 ${samples.length} 个已验收、非补录的同类样本，平均实际工时高于预估 ${percent}%，建议今天预留缓冲时间。`,
        evidence: `${type} · ${samples.length} 个有效历史样本 · 平均实际 ${avgActualHours.toFixed(1)}h`,
        priority: 90 + percent,
      })
    }
    if (task.estimatedHours > 0 && avgActualHours > task.estimatedHours * 1.25) {
      const gap = Number((avgActualHours - task.estimatedHours).toFixed(1))
      candidates.push({
        tone: 'warning',
        label: `预估低于同类均值 ${gap.toFixed(1)}h`,
        detail: `同类历史平均实际 ${avgActualHours.toFixed(1)}h，当前预估 ${task.estimatedHours.toFixed(1)}h，建议提前确认范围或补缓冲。`,
        evidence: `${type} · ${samples.length} 个历史样本`,
        priority: 85 + gap,
      })
    }
    if (revisionSignalsPerTask >= 1.5) {
      candidates.push({
        tone: 'info',
        label: '同类修改信号偏高',
        detail: `同类历史平均每个任务出现 ${revisionSignalsPerTask.toFixed(1)} 次修改信号，建议先锁定尺寸、文案和色板。`,
        evidence: `${type} · ${revisionSignals} 次修改信号 / ${samples.length} 个样本`,
        priority: 70 + revisionSignalsPerTask,
      })
    }
    const strongest = candidates.sort((left, right) => right.priority - left.priority)[0]
    if (strongest) {
      insights.set(task.id, {
        tone: strongest.tone,
        label: strongest.label,
        detail: strongest.detail,
        evidence: strongest.evidence,
      })
    }
  })

  return insights
}
