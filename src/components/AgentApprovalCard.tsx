import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { VoiceScheduleResult } from '../lib/api'
import { isoDate, monthPart } from '../lib/dateTime'
import type { AgentApproval, AgentApprovalStatus } from '../types/agent'
import { MonthPicker } from './MonthPicker'
import { PlanDateTimeField } from './PlanDateTimeField'
import { VoiceScheduleButton } from './VoiceScheduleButton'

const AGENT_APPROVAL_FIELD_LABELS: Record<string, string> = {
  title: '任务名称',
  taskTitle: '任务',
  requirement: '具体需求',
  type: '设计类型',
  date: '开始时间',
  startDateTime: '开始时间',
  endDateTime: '结束时间',
  estimatedDate: '预计交付',
  settlementMonth: '结算月份',
  estimatedHours: '预估工时',
  requester: '需求人',
  contact: '对接人',
  reviewer: '验收人',
  billable: '计入结算',
  isSupplemental: '补录任务',
  note: '记录内容',
  feedbackVersion: '反馈版本',
  feedbackSource: '反馈来源',
  dateTime: '记录时间',
  fromStatus: '原状态',
  status: '新状态',
  progress: '任务进度',
  reason: '修改原因',
  isUncounted: '不计工时',
  isRevision: '改稿轮次',
  isAcceptanceProgress: '验收进展',
  supplementalNote: '补录说明',
  acceptanceNote: '验收备注',
  progressNote: '最终进展',
  countTime: '计入工时',
  recordType: '记录类型',
  action: '操作',
  recordId: '记录 ID',
  attachmentIds: '附件 ID',
  files: '验收文件',
  changes: '修改内容',
}

function formatAgentApprovalValue(key: string, value: unknown): string {
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (key === 'estimatedHours') return `${value} h`
  if (key === 'progress') return `${value}%`
  if (value === null || value === undefined || value === '') return '未填写'
  if (key === 'files' && Array.isArray(value)) {
    return value.map((item) => typeof item === 'object' && item ? String((item as Record<string, unknown>).name || (item as Record<string, unknown>).id || '') : String(item)).filter(Boolean).join('、') || '未选择'
  }
  if (Array.isArray(value)) return value.map(String).join('、')
  if (typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([field, fieldValue]) => `${AGENT_APPROVAL_FIELD_LABELS[field] || field}：${formatAgentApprovalValue(field, fieldValue)}`).join('；')
  return String(value).replace('T', ' ')
}

function agentApprovalRows(approval: AgentApproval) {
  const draft = approval.draft ?? {}
  const changeSource = draft.fields ?? draft.changes
  const changedFields = changeSource && typeof changeSource === 'object' && !Array.isArray(changeSource)
    ? changeSource as Record<string, unknown>
    : null
  const before = changedFields && draft.before && typeof draft.before === 'object' && !Array.isArray(draft.before)
    ? draft.before as Record<string, unknown>
    : null
  const source = changedFields
    ? { taskTitle: draft.taskTitle, ...(draft.recordType ? { recordType: draft.recordType, action: draft.action, recordId: draft.recordId } : {}), ...changedFields }
    : draft
  return Object.entries(source)
    .filter(([key, value]) => key !== 'taskId' && key !== 'before' && value !== undefined && value !== '')
    .map(([key, value]) => ({
      key,
      label: AGENT_APPROVAL_FIELD_LABELS[key] || key,
      value: formatAgentApprovalValue(key, value),
      beforeValue: before && key in before && before[key] !== value
        ? formatAgentApprovalValue(key, before[key])
        : undefined,
    }))
}

function agentApprovalStatusLabel(status: AgentApprovalStatus) {
  if (status === 'processing') return '正在执行'
  if (status === 'executed') return '已执行'
  if (status === 'cancelled') return '已取消'
  if (status === 'expired') return '已过期'
  if (status === 'failed') return '执行失败'
  return '等待确认'
}

export function AgentApprovalCard({
  approval,
  busy,
  onDecision,
  onRevise,
  onOpenTask,
}: {
  approval: AgentApproval
  busy: boolean
  onDecision: (decision: 'confirm' | 'cancel') => void
  onRevise: (draft: Record<string, unknown>) => Promise<void>
  onOpenTask: (taskId: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState<Record<string, unknown>>(approval.draft)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [activePickerId, setActivePickerId] = useState<string | null>(null)
  const rows = agentApprovalRows(approval)
  const canDecide = approval.status === 'pending' || approval.status === 'failed'
  const canEdit = canDecide
  const setDraftField = (key: string, value: unknown) => setEditDraft((current) => ({ ...current, [key]: value }))
  const nestedKey = editDraft.fields && typeof editDraft.fields === 'object' ? 'fields' : editDraft.changes && typeof editDraft.changes === 'object' ? 'changes' : ''
  const editableSource = nestedKey
    ? editDraft[nestedKey] as Record<string, unknown>
    : editDraft
  const setEditableField = (key: string, value: unknown) => {
    if (!nestedKey) return setDraftField(key, value)
    setEditDraft((current) => ({
      ...current,
      [nestedKey]: { ...((current[nestedKey] as Record<string, unknown>) || {}), [key]: value },
    }))
  }
  const genericEditableEntries = Object.entries(editableSource).filter(([key, value]) => (
    !['taskId', 'taskTitle', 'before', 'files'].includes(key) && value !== undefined && value !== null && typeof value !== 'object'
  ))
  const applyVoiceApprovalSchedule = (result: VoiceScheduleResult) => {
    if (result.startAt) {
      setDraftField('date', result.startAt)
    }
    if (result.durationMinutes) {
      setDraftField('estimatedHours', Math.round((result.durationMinutes / 60) * 100) / 100)
    }
    if (result.endAt) {
      setDraftField('estimatedDate', result.endAt)
    }
    setActivePickerId(null)
  }
  const saveDraft = async () => {
    setSaving(true)
    setEditError('')
    try {
      await onRevise(editDraft)
      setEditing(false)
    } catch (error) {
      setEditError(error instanceof Error ? error.message : '草稿更新失败')
    } finally {
      setSaving(false)
    }
  }
  return (
    <section className={`agent-approval-card status-${approval.status}`} aria-label={`${approval.label}确认卡片`}>
      <header className="agent-approval-header">
        <div>
          <small>{approval.status === 'executed' ? '操作结果' : '待确认操作'}</small>
          <strong>{approval.label}</strong>
        </div>
        <span className="agent-approval-status">{agentApprovalStatusLabel(approval.status)}</span>
      </header>
      <p className="agent-approval-hint">
        {approval.status === 'executed'
          ? '操作已经写入网站数据。'
          : approval.status === 'processing'
            ? '操作已交给持久化 Workflow，页面关闭后仍会继续执行。'
            : '请核对草稿。只有确认后，Agent 才会写入网站数据。'}
      </p>
      {editing && approval.action === 'create_task' ? (
        <div className="agent-approval-editor">
          <label className="agent-approval-editor-field agent-approval-editor-wide">
            <span>任务名称</span>
            <input value={String(editDraft.title ?? '')} onChange={(event) => setDraftField('title', event.target.value)} />
          </label>
          <label className="agent-approval-editor-field agent-approval-editor-wide">
            <span>具体需求</span>
            <textarea rows={4} value={String(editDraft.requirement ?? '')} onChange={(event) => setDraftField('requirement', event.target.value)} />
          </label>
          <label className="agent-approval-editor-field">
            <span>设计类型</span>
            <input value={String(editDraft.type ?? '')} onChange={(event) => setDraftField('type', event.target.value)} />
          </label>
          <div className="agent-approval-editor-field">
            <span>结算月份</span>
            <MonthPicker
              value={String(editDraft.settlementMonth ?? monthPart(isoDate()))}
              taskMonthValues={new Set([String(editDraft.settlementMonth ?? monthPart(isoDate()))])}
              onChange={(value) => setDraftField('settlementMonth', value)}
              minimal
            />
          </div>
          <div className="agent-approval-editor-schedule-head agent-approval-editor-wide">
            <span>时间与工时</span>
            <VoiceScheduleButton
              label="用语音填写待确认任务的时间与工时"
              context="工作助手待确认新建任务的预计排期"
              currentStart={String(editDraft.date ?? '')}
              currentDurationMinutes={Number(editDraft.estimatedHours || 0) > 0 ? Math.round(Number(editDraft.estimatedHours) * 60) : undefined}
              currentEnd={String(editDraft.estimatedDate ?? '')}
              onApply={applyVoiceApprovalSchedule}
            />
          </div>
          <div className="agent-approval-editor-field">
            <PlanDateTimeField
              label="开始时间"
              value={String(editDraft.date ?? '')}
              onChange={(value) => setDraftField('date', value)}
              pickerId="agent-create-date"
              activePickerId={activePickerId}
              onActivePickerChange={setActivePickerId}
            />
          </div>
          <div className="agent-approval-editor-field">
            <PlanDateTimeField
              label="预计交付"
              value={String(editDraft.estimatedDate ?? '')}
              onChange={(value) => setDraftField('estimatedDate', value)}
              pickerId="agent-create-estimated-date"
              activePickerId={activePickerId}
              onActivePickerChange={setActivePickerId}
            />
          </div>
          {(['estimatedHours', 'requester', 'contact', 'reviewer'] as const).map((key) => (
            <label key={key} className="agent-approval-editor-field">
              <span>{AGENT_APPROVAL_FIELD_LABELS[key]}</span>
              <input
                type={key === 'estimatedHours' ? 'number' : 'text'}
                min={key === 'estimatedHours' ? '0' : undefined}
                step={key === 'estimatedHours' ? '0.5' : undefined}
                value={String(editDraft[key] ?? '')}
                onChange={(event) => setDraftField(key, key === 'estimatedHours' ? Number(event.target.value) : event.target.value)}
              />
            </label>
          ))}
          <div className="agent-approval-editor-options agent-approval-editor-wide">
            {(['billable', 'isSupplemental'] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="switch"
                aria-checked={Boolean(editDraft[key])}
                className={`agent-approval-editor-toggle ${editDraft[key] ? 'active' : ''}`}
                onClick={() => setDraftField(key, !editDraft[key])}
              >
                <span aria-hidden="true" />
                {AGENT_APPROVAL_FIELD_LABELS[key]}
              </button>
            ))}
          </div>
        </div>
      ) : editing ? (
        <div className="agent-approval-editor">
          {genericEditableEntries.map(([key, value]) => {
            const label = AGENT_APPROVAL_FIELD_LABELS[key] || key
            if (typeof value === 'boolean') {
              return (
                <div key={key} className="agent-approval-editor-field">
                  <span>{label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={value}
                    className={`agent-approval-editor-toggle ${value ? 'active' : ''}`}
                    onClick={() => setEditableField(key, !value)}
                  >
                    <span aria-hidden="true" />{value ? '是' : '否'}
                  </button>
                </div>
              )
            }
            const multiline = ['note', 'requirement', 'reason', 'acceptanceNote', 'progressNote'].includes(key)
            return (
              <label key={key} className={`agent-approval-editor-field ${multiline ? 'agent-approval-editor-wide' : ''}`}>
                <span>{label}</span>
                {multiline
                  ? <textarea rows={3} value={String(value ?? '')} onChange={(event) => setEditableField(key, event.target.value)} />
                  : <input
                      type={typeof value === 'number' ? 'number' : key.toLowerCase().includes('datetime') ? 'datetime-local' : 'text'}
                      value={String(value ?? '')}
                      onChange={(event) => setEditableField(key, typeof value === 'number' ? Number(event.target.value) : event.target.value)}
                    />}
              </label>
            )
          })}
          {Array.isArray(editDraft.attachmentIds) && (
            <label className="agent-approval-editor-field agent-approval-editor-wide">
              <span>附件 ID（逗号分隔）</span>
              <input
                value={(editDraft.attachmentIds as unknown[]).join(', ')}
                onChange={(event) => setDraftField('attachmentIds', event.target.value.split(/[,，]/).map((item) => Number(item.trim())).filter((item) => Number.isFinite(item) && item > 0))}
              />
            </label>
          )}
        </div>
      ) : (
        <dl className="agent-approval-fields">
          {rows.map((row) => (
            <div key={row.key} className="agent-approval-field">
              <dt>{row.label}</dt>
              <dd>
                {row.beforeValue !== undefined ? (
                  <span className="agent-approval-diff"><del>{row.beforeValue}</del><span aria-hidden="true">→</span><ins>{row.value}</ins></span>
                ) : row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {approval.warnings.length > 0 && (
        <div className="agent-approval-warnings">
          <AlertTriangle size={14} />
          <span>{approval.warnings.join('；')}</span>
        </div>
      )}
      {approval.error && <p className="agent-approval-error">{approval.error}</p>}
      {editError && <p className="agent-approval-error">{editError}</p>}
      {canDecide && (
        <footer className="agent-approval-actions">
          {editing ? (
            <>
              <button type="button" className="ghost-button compact-button" disabled={saving} onClick={() => { setEditing(false); setEditDraft(approval.draft); setEditError('') }}>放弃修改</button>
              <button type="button" className="primary-button compact-button" disabled={saving} onClick={() => void saveDraft()}>{saving ? '保存中…' : '保存草稿'}</button>
            </>
          ) : (
            <>
              {canEdit && <button type="button" className="ghost-button compact-button" disabled={busy} onClick={() => setEditing(true)}>编辑草稿</button>}
              <button type="button" className="ghost-button compact-button" disabled={busy} onClick={() => onDecision('cancel')}>取消</button>
              <button type="button" className="primary-button compact-button" disabled={busy} onClick={() => onDecision('confirm')}>确认执行</button>
            </>
          )}
        </footer>
      )}
      {approval.status === 'executed' && approval.result?.taskId && (
        <footer className="agent-approval-actions">
          <button type="button" className="primary-button compact-button" onClick={() => onOpenTask(approval.result!.taskId!)}>查看任务</button>
        </footer>
      )}
    </section>
  )
}
