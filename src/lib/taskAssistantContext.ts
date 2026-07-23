import type { ActivityItem } from './api'
import { formatPlanDateTime } from './dateTime'
import type { FileAsset, Task } from '../types/domain'

const taskFieldLabels: Record<string, string> = {
  title: '任务名称',
  type: '设计类型',
  date: '预计开始时间',
  estimatedDate: '预计交付时间',
  requester: '需求人',
  contact: '对接人',
  reviewer: '验收人',
  requirement: '需求描述',
}

function describeActivity(item: ActivityItem): string {
  const payload = item.payload ?? {}
  if (item.entityType === 'task') {
    if (item.action === 'create') return '接受任务'
    if (item.action === 'void') {
      const reason = typeof payload.reason === 'string' ? payload.reason.trim() : ''
      return reason ? `作废任务；原因：${reason}` : '作废任务'
    }
    if (item.action === 'delete') return '删除任务'
    if (payload.status === '已验收') {
      const acceptanceNote = typeof payload.acceptanceNote === 'string' ? payload.acceptanceNote.trim() : ''
      const actualHours = Number(payload.actualHours)
      const timeEntries = Array.isArray(payload.timeEntries) ? payload.timeEntries : []
      const acceptanceFiles = Array.isArray(payload.acceptanceFiles) ? payload.acceptanceFiles.map(String).filter(Boolean) : []
      const details: string[] = ['确认验收']
      if (Number.isFinite(actualHours)) details.push(`系统计算工时 ${actualHours.toFixed(2)}h`)
      if (acceptanceNote) details.push(`验收备注：${acceptanceNote}`)
      else if (timeEntries.length > 0) details.push(`包含 ${timeEntries.length} 段时间记录`)
      if (acceptanceFiles.length > 0) {
        details.push(`验收文件：${acceptanceFiles.slice(0, 3).join('、')}${acceptanceFiles.length > 3 ? ` 等 ${acceptanceFiles.length} 个` : ''}`)
      }
      return details.join('；')
    }
    const parts: string[] = []
    if (typeof payload.status === 'string') parts.push(`状态更新为「${payload.status}」`)
    if (payload.progress !== undefined) parts.push(`进度更新为 ${payload.progress}%`)
    if (payload.actualHours !== undefined) parts.push(`实际工时改为 ${payload.actualHours}h`)
    if (Array.isArray(payload.timeEntries)) parts.push(`记录了 ${payload.timeEntries.length} 段时间`)
    if (typeof payload.estimatedDate === 'string') parts.push(`预计交付改为 ${formatPlanDateTime(payload.estimatedDate)}`)
    Object.keys(taskFieldLabels).forEach((key) => {
      if (payload[key] !== undefined) parts.push(`修改了${taskFieldLabels[key]}`)
    })
    return parts.length > 0 ? parts.join('；') : '更新了任务信息'
  }
  if (item.entityType === 'attachment') {
    if (item.action === 'create') return '上传了文件'
    if (item.action === 'delete') return `删除了文件「${String(payload.fileName ?? '')}」`
  }
  if (item.entityType === 'update') {
    if (item.action === 'create') {
      const hours = Number(payload.hours)
      const title = String(payload.title ?? '').trim()
      const body = String(payload.body ?? '').trim()
      if (body) return body.startsWith('上传过程附件') ? '上传过程附件' : body
      return `添加进展「${title}」${hours > 0 ? `（${hours}h）` : ''}`
    }
    if (item.action === 'update') return '修改了进展记录'
    if (item.action === 'delete') return `删除了进展「${String(payload.title ?? '')}」`
  }
  return '其他操作'
}

export function taskAssistantFiles(task: Task, files: FileAsset[], uploadedFiles: Array<FileAsset | string> = []) {
  const taskFileNames = new Set([...(task.files ?? []), ...(task.acceptanceFiles ?? [])].map((name) => name.trim()).filter(Boolean))
  const uploadedNames = uploadedFiles
    .map((file) => (typeof file === 'string' ? file : file.name))
    .map((name) => name.trim())
    .filter(Boolean)
  uploadedNames.forEach((name) => taskFileNames.add(name))
  const relatedFiles = files.filter((file) => file.taskId === task.id || taskFileNames.has(file.name))
  const fallbackFiles = [...taskFileNames].map((name) => ({
    name,
    type: '',
    tag: task.acceptanceFiles?.includes(name) ? '验收文件' : '',
    final: task.acceptanceFiles?.includes(name) ?? false,
    visible: true,
    uploadedAt: '',
  }))
  const seen = new Set<string>()
  return [...relatedFiles, ...fallbackFiles]
    .filter((file) => {
      if (!file.name || seen.has(file.name)) return false
      seen.add(file.name)
      return true
    })
    .slice(0, 40)
    .map((file) => ({
      name: file.name,
      type: file.type,
      tag: file.tag,
      final: file.final,
      visible: file.visible,
      uploadedAt: file.uploadedAt,
    }))
}

export function taskAssistantActivity(activity: ActivityItem[]) {
  return activity.slice(0, 12).map((item) => ({ createdAt: item.createdAt, summary: describeActivity(item) }))
}

export function taskAssistantProgressHistory(task: Task, files: FileAsset[]) {
  const attachmentsByEntry = new Map<string, string[]>()
  files.forEach((file) => {
    if (file.taskId !== task.id || file.deletedAt || !file.entryId) return
    const names = attachmentsByEntry.get(file.entryId) ?? []
    if (!names.includes(file.name)) names.push(file.name)
    attachmentsByEntry.set(file.entryId, names)
  })

  return (task.timeEntries ?? [])
    .filter((entry) => !entry.isAcceptanceProgress)
    .sort((left, right) => {
      const leftKey = `${left.date ?? ''}T${left.start || '00:00'}`
      const rightKey = `${right.date ?? ''}T${right.start || '00:00'}`
      return leftKey.localeCompare(rightKey)
    })
    .map((entry, index) => ({
      sequence: index + 1,
      date: entry.date ?? '',
      endDate: entry.endDate ?? entry.date ?? '',
      start: entry.start,
      end: entry.end,
      note: entry.note?.trim() ?? '',
      kind: entry.isClientFeedback ? 'client_feedback' as const : entry.isRevision ? 'revision' as const : 'progress' as const,
      counted: !entry.isUncounted,
      attachments: attachmentsByEntry.get(entry.id) ?? [],
    }))
    .filter((entry) => entry.note || entry.attachments.length > 0)
}

export function taskAssistantRequirementWithoutOutputFiles(text: string) {
  const lines = text.split('\n')
  const result: string[] = []
  let skippingOutputSection = false
  lines.forEach((line) => {
    const trimmed = line.trim()
    const isNumberedSection = /^\d+[、.．]/.test(trimmed)
    const isPlainOutputSection = /^(?:【)?\s*(输出文件|交付文件|文件格式|源文件)(?:】)?\s*[：:]/.test(trimmed)
    const isOutputSection = /输出文件|交付文件|文件格式|源文件/.test(trimmed)
    if ((isNumberedSection && isOutputSection) || isPlainOutputSection) {
      skippingOutputSection = true
      return
    }
    if (skippingOutputSection && isNumberedSection) skippingOutputSection = false
    if (!skippingOutputSection) result.push(line)
  })
  return result.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
