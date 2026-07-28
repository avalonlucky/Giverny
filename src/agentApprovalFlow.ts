// Approval flow and workflow execution with exponential backoff
import { toJsonObject } from './agentUtils'
import type { AgentToolResponse } from './agentToolClient'
import type { AgentApproval, AgentApprovalStatus } from './types/agent'

export type PendingActionSummary = {
  action: string
  label: string
  draft: Record<string, unknown>
  warnings: string[]
  createdAt: number
}

export type StoredPendingAction = PendingActionSummary & {
  endpoint: string
  confirmationToken: string
  workflowId: string
  workflowApproved: boolean
}

export const CONFIRM_RE = /^(?:好的?|没问题)?(?:确认(?:执行|创建|记录|修改)?|执行吧|可以(?:执行|创建|记录|修改)|同意(?:执行|创建|记录|修改)|就这样(?:执行|创建|记录)?)$/
export const REJECT_RE = /^(?:好的?)?(?:取消|不要(?:执行|创建|记录|修改)?|撤销|拒绝|先不(?:执行|创建|记录|修改)?)$/

export function buildApprovalResult(pending: StoredPendingAction, status: AgentApprovalStatus, error?: string): AgentApproval {
  return {
    id: `${pending.action}:${pending.createdAt}`,
    action: pending.action,
    label: pending.label,
    draft: pending.draft,
    warnings: pending.warnings,
    status,
    createdAt: pending.createdAt,
    expiresAt: pending.createdAt + 10 * 60 * 1000,
    ...(error ? { error } : {}),
  }
}

export function buildExecutionSummary(result: AgentToolResponse): string {
  const batch = toJsonObject(result.batch)
  if (batch.id && batch.status === 'completed') return `批量事务已原子提交：${Number(batch.operationCount) || 0} 个操作，涉及 ${Number(batch.taskCount) || 0} 个任务。`
  const record = toJsonObject(result.record)
  if (record.startDate && record.endDate) return `结算日期：${String(record.startDate)} 至 ${String(record.endDate)}。回单已生成，可直接预览、分享或下载。`
  const plan = toJsonObject(result.plan)
  if (plan.goal) return `提醒：${String(plan.goal)}`
  const config = toJsonObject(result.config)
  if (config.provider && config.model) return `模型路由：${String(config.provider)} / ${String(config.model)}`
  const task = toJsonObject(result.task)
  const title = String(task.title || '')
  if (title) return `任务：${title}`
  return '系统已保存本次操作，并返回成功状态。'
}

export type WorkflowPollOptions = {
  getStatus: (workflowId: string) => Promise<{ status: string; output?: unknown; error?: { message?: string } }>
  maxAttempts?: number
  initialDelayMs?: number
  maxDelayMs?: number
}

export async function pollWorkflowWithBackoff(workflowId: string, options: WorkflowPollOptions): Promise<{ status: string; output?: unknown; error?: { message?: string } }> {
  const maxAttempts = options.maxAttempts ?? 30
  const initialDelay = options.initialDelayMs ?? 200
  const maxDelay = options.maxDelayMs ?? 2000
  let delay = initialDelay
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, delay))
    const status = await options.getStatus(workflowId)
    if (status.status === 'complete' || status.status === 'errored' || status.status === 'terminated') {
      return status
    }
    delay = Math.min(delay * 1.5, maxDelay)
  }
  return { status: 'running' }
}

export function isPendingActionExpired(pending: StoredPendingAction): boolean {
  return Date.now() - pending.createdAt > 10 * 60 * 1000
}
