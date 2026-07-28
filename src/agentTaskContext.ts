// Task reference management and evidence validation
import { agentCapabilityRegistry, type AgentCapabilityDefinition, type AgentCapabilityName } from './agentToolRegistry'
import { toJsonObject } from './agentUtils'
import type { AgentResultAttachment, AgentTaskSelection } from './types/agent'

export type TaskReference = {
  id: number
  title: string
  updatedAt: number
}

export function extractTaskReference(message: string): TaskReference | null {
  const match = message.match(/(?:选择)?任务\s*#(\d+)(?:[：:]\s*(.+))?/)
  const id = Number(match?.[1])
  if (!Number.isInteger(id) || id <= 0) return null
  return { id, title: String(match?.[2] || `任务 #${id}`).trim(), updatedAt: Date.now() }
}

export function referencesCurrentTask(message: string): boolean {
  return /(?:这个|那个|刚才|上述|前面|当前|该|它|继续|这项|那项)(?:任务|项目|工作|进展|反馈|等待|验收)?/.test(message)
}

export function resolveTaskInput(input: Record<string, unknown>, message: string, reference: TaskReference | null): Record<string, unknown> {
  const taskId = Number(input.taskId)
  const hasExplicitReference = /(?:选择)?任务\s*#\d+/.test(message)
  if (reference && (hasExplicitReference || referencesCurrentTask(message))) {
    return { ...input, taskId: reference.id, taskTitle: reference.title }
  }
  if (Number.isInteger(taskId) && taskId > 0) return input
  return reference ? { ...input, taskId: reference.id, taskTitle: reference.title } : input
}

export function extractTaskReferences(value: unknown): TaskReference[] {
  const record = toJsonObject(value)
  const candidates: TaskReference[] = []
  const append = (item: unknown) => {
    const candidate = toJsonObject(item)
    const id = Number(candidate.taskId ?? candidate.id)
    const title = String(candidate.title ?? candidate.taskTitle ?? candidate.task ?? '').trim()
    if (Number.isInteger(id) && id > 0 && title) candidates.push({ id, title, updatedAt: Date.now() })
  }
  append(record.task)
  append(record.draft)
  append(record.memory)
  append(record.plan)
  for (const key of ['results', 'tasks', 'files']) {
    const items = Array.isArray(record[key]) ? record[key] as unknown[] : []
    items.forEach((item) => {
      const nested = toJsonObject(item)
      append(nested.task && typeof nested.task === 'object' ? nested.task : nested)
    })
  }
  return [...new Map(candidates.map((item) => [item.id, item])).values()]
}

export function extractTaskIds(value: unknown): number[] {
  return extractTaskReferences(value).map((ref) => ref.id)
}

export function isTaskScopedTool(toolName: string): boolean {
  return Boolean((agentCapabilityRegistry[toolName as AgentCapabilityName] as AgentCapabilityDefinition | undefined)?.taskScoped)
}

export function detectTaskEvidenceMismatch(toolName: string, input: Record<string, unknown>, output: unknown): string {
  const expectedTaskId = Number(input.taskId)
  const returnedIds = extractTaskIds(output)
  if (Number.isInteger(expectedTaskId) && expectedTaskId > 0) {
    if (isTaskScopedTool(toolName) && returnedIds.length === 0) return `工具 ${toolName} 未返回可核对的 taskId`
    if (returnedIds.length > 0 && !returnedIds.includes(expectedTaskId)) {
      return `工具请求任务 #${expectedTaskId}，但返回了 ${returnedIds.map((id) => `#${id}`).join('、')}`
    }
  }
  const record = toJsonObject(output)
  const task = toJsonObject(record.task)
  const waitingRecords = Array.isArray(record.waitingRecords) ? record.waitingRecords.map(toJsonObject) : []
  const activeWaiting = waitingRecords.filter((item) => item.active === true)
  if (['已验收', '终止', '不计费'].includes(String(task.status || '')) && activeWaiting.length > 0) {
    return `任务 #${Number(task.id) || expectedTaskId} 已关闭，但工具仍返回活动等待记录`
  }
  if (activeWaiting.some((item) => !String(item.note || item.reason || '').trim() || !String(item.startAt || '').trim())) {
    return `任务 #${Number(task.id) || expectedTaskId} 的活动等待记录缺少原因或开始时间`
  }
  return ''
}

export function extractTaskSelection(value: unknown): AgentTaskSelection | undefined {
  const record = toJsonObject(value)
  const rawSelection = toJsonObject(record.selection)
  const candidates = Array.isArray(rawSelection.candidates)
    ? rawSelection.candidates.map((item) => toJsonObject(item)).map((item) => ({
        id: Number(item.id) || 0,
        title: String(item.title || ''),
        type: String(item.type || ''),
        status: String(item.status || ''),
        startDate: String(item.startDate || ''),
        settlementMonth: String(item.settlementMonth || ''),
      })).filter((item) => item.id > 0 && item.title)
    : []
  if (record.needsDisambiguation !== true || candidates.length < 2) return undefined
  return {
    id: String(rawSelection.id || `task-selection:${Date.now()}`),
    kind: 'task',
    prompt: String(rawSelection.prompt || '请选择要操作的任务。'),
    candidates,
  }
}

export function extractResultAttachments(value: unknown): AgentResultAttachment[] {
  const record = toJsonObject(value)
  const evidenceFiles = Array.isArray(record.evidence) ? record.evidence.map((item) => toJsonObject(toJsonObject(item).file)) : []
  const files = Array.isArray(record.files) ? record.files : evidenceFiles
  return files.map((item) => toJsonObject(item)).map((file) => {
    const numericId = Number(file.id)
    const id = Number.isInteger(numericId) && numericId > 0 ? numericId : String(file.id || '').trim()
    const kind: AgentResultAttachment['kind'] = file.kind === 'settlement-receipt' || file.kind === 'formal-deliverable' ? file.kind : 'task-file'
    return {
      id,
      taskId: Number(file.taskId) || 0,
      taskTitle: String(file.taskTitle || file.task || ''),
      name: String(file.name || ''),
      type: String(file.type || 'FILE'),
      mimeType: String(file.mimeType || ''),
      size: String(file.size || ''),
      scope: file.scope === 'acceptance' ? 'acceptance' as const : 'progress' as const,
      tag: String(file.tag || ''),
      uploadedAt: String(file.uploadedAt || ''),
      previewUrl: file.previewUrl ? String(file.previewUrl) : undefined,
      sourceUrl: String(file.sourceUrl || ''),
      downloadUrl: file.downloadUrl ? String(file.downloadUrl) : undefined,
      shareUrl: file.shareUrl ? String(file.shareUrl) : undefined,
      kind,
    }
  }).filter((file) => Boolean(file.id) && file.name && file.sourceUrl)
}
