import { useMemo, useState } from 'react'
import { Check, Clock3, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { AgentEnterpriseMemory, AgentEnterpriseMemoryScope, AgentEnterpriseMemorySummary, AgentEnterpriseMemoryType } from '../types/agent'
import { EmptyState } from './EmptyState'
import { GivernySelect } from './GivernySelect'

export type EnterpriseMemoryDraft = {
  scopeType: AgentEnterpriseMemoryScope
  scopeKey: string
  memoryType: AgentEnterpriseMemoryType
  title: string
  content: string
  sourceType: 'manual'
  sourceLabel: string
  sourceExcerpt: string
  confidence: 'confirmed'
  expiresAt?: string
  reason?: string
}

type EnterpriseMemoryPanelProps = {
  memories: AgentEnterpriseMemory[]
  summary: AgentEnterpriseMemorySummary | null
  busy: boolean
  onCreate: (draft: EnterpriseMemoryDraft) => Promise<void>
  onCorrect: (memory: AgentEnterpriseMemory, draft: EnterpriseMemoryDraft) => Promise<void>
  onExpire: (memory: AgentEnterpriseMemory) => Promise<void>
  onDelete: (memory: AgentEnterpriseMemory) => Promise<void>
}

const scopeLabels: Record<AgentEnterpriseMemoryScope, string> = { organization: '组织', partner: '合作伙伴', project: '项目' }
const typeLabels: Record<AgentEnterpriseMemoryType, string> = { fact: '事实', preference: '偏好', rule: '规则', decision: '决策' }
const emptyDraft = (): EnterpriseMemoryDraft => ({ scopeType: 'organization', scopeKey: '', memoryType: 'rule', title: '', content: '', sourceType: 'manual', sourceLabel: '', sourceExcerpt: '', confidence: 'confirmed' })

function expiryFromPreset(preset: string) {
  const days = Number(preset)
  if (!Number.isFinite(days) || days <= 0) return undefined
  return new Date(Date.now() + days * 86_400_000).toISOString()
}

export function EnterpriseMemoryPanel({ memories, summary, busy, onCreate, onCorrect, onExpire, onDelete }: EnterpriseMemoryPanelProps) {
  const [scope, setScope] = useState<'all' | AgentEnterpriseMemoryScope>('all')
  const [showHistory, setShowHistory] = useState(false)
  const [editing, setEditing] = useState<AgentEnterpriseMemory | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState<EnterpriseMemoryDraft>(emptyDraft)
  const [expiryPreset, setExpiryPreset] = useState('0')
  const [deleteConfirmId, setDeleteConfirmId] = useState('')
  const visible = useMemo(() => memories.filter((memory) => (scope === 'all' || memory.scopeType === scope) && (showHistory || memory.status === 'active')), [memories, scope, showHistory])

  const beginCreate = () => {
    setEditing(null)
    setDraft(emptyDraft())
    setExpiryPreset('0')
    setFormOpen(true)
  }
  const beginCorrection = (memory: AgentEnterpriseMemory) => {
    setEditing(memory)
    setDraft({
      scopeType: memory.scopeType, scopeKey: memory.scopeKey, memoryType: memory.memoryType,
      title: memory.title, content: memory.content, sourceType: 'manual',
      sourceLabel: memory.sourceLabel, sourceExcerpt: memory.sourceExcerpt, confidence: 'confirmed', reason: '人工纠正',
    })
    setExpiryPreset('0')
    setFormOpen(true)
  }
  const submit = async () => {
    const payload = { ...draft, expiresAt: expiryFromPreset(expiryPreset) }
    if (editing) await onCorrect(editing, payload)
    else await onCreate(payload)
    setFormOpen(false)
    setEditing(null)
    setDraft(emptyDraft())
  }
  const complete = Boolean(draft.title.trim() && draft.content.trim() && draft.sourceLabel.trim() && (draft.scopeType === 'organization' || draft.scopeKey.trim()))

  return (
    <div className="enterprise-memory-panel">
      {summary && <div className="chat-proactive-summary" aria-label="企业记忆概况">
        <span><strong>{summary.active}</strong> 有效记忆</span>
        <span><strong>{summary.organization}</strong> 组织规则</span>
        <span><strong>{summary.partner}</strong> 合作伙伴</span>
        <span><strong>{summary.project}</strong> 项目记忆</span>
      </div>}
      <div className="enterprise-memory-toolbar">
        <div className="enterprise-memory-scopes" role="tablist" aria-label="记忆范围">
          {(['all', 'organization', 'partner', 'project'] as const).map((value) => <button key={value} type="button" className={scope === value ? 'active' : ''} onClick={() => setScope(value)}>{value === 'all' ? '全部' : scopeLabels[value]}</button>)}
        </div>
        <button type="button" className="chat-panel-icon-btn" title="新增记忆" aria-label="新增企业记忆" onClick={beginCreate}><Plus size={15} /></button>
      </div>
      <label className="enterprise-memory-history-toggle"><input type="checkbox" checked={showHistory} onChange={(event) => setShowHistory(event.target.checked)} />显示已纠正、失效和删除记录</label>
      {formOpen && <div className="enterprise-memory-form">
        <div className="enterprise-memory-form-header"><strong>{editing ? '纠正记忆' : '新增记忆'}</strong><button type="button" className="chat-panel-icon-btn" aria-label="关闭记忆表单" onClick={() => setFormOpen(false)}><X size={14} /></button></div>
        <div className="enterprise-memory-form-grid">
          <GivernySelect ariaLabel="记忆范围" placeholder="选择范围" value={draft.scopeType} onChange={(value) => setDraft((current) => ({ ...current, scopeType: value as AgentEnterpriseMemoryScope, scopeKey: value === 'organization' ? '' : current.scopeKey }))} options={Object.entries(scopeLabels).map(([value, label]) => ({ value, label }))} />
          <GivernySelect ariaLabel="记忆类型" placeholder="选择类型" value={draft.memoryType} onChange={(value) => setDraft((current) => ({ ...current, memoryType: value as AgentEnterpriseMemoryType }))} options={Object.entries(typeLabels).map(([value, label]) => ({ value, label }))} />
        </div>
        {draft.scopeType !== 'organization' && <input className="knowledge-input" value={draft.scopeKey} placeholder={draft.scopeType === 'partner' ? '合作伙伴名称' : '项目名称'} onChange={(event) => setDraft((current) => ({ ...current, scopeKey: event.target.value }))} />}
        <input className="knowledge-input" value={draft.title} placeholder="记忆标题" onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
        <textarea className="knowledge-textarea" rows={4} value={draft.content} placeholder="需要长期记住的事实、规则、偏好或决策" onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))} />
        <input className="knowledge-input" value={draft.sourceLabel} placeholder="来源说明，例如：2026-07-25 与刘总确认" onChange={(event) => setDraft((current) => ({ ...current, sourceLabel: event.target.value }))} />
        <textarea className="knowledge-textarea enterprise-memory-source-excerpt" rows={2} value={draft.sourceExcerpt} placeholder="来源原文或依据摘要（选填）" onChange={(event) => setDraft((current) => ({ ...current, sourceExcerpt: event.target.value }))} />
        <GivernySelect ariaLabel="有效期" placeholder="选择有效期" value={expiryPreset} onChange={setExpiryPreset} options={[{ value: '0', label: '长期有效' }, { value: '30', label: '30 天' }, { value: '90', label: '90 天' }, { value: '365', label: '1 年' }]} />
        <button type="button" className="primary-button compact-button" disabled={!complete || busy} onClick={() => void submit()}><Check size={13} />{editing ? '保存纠正' : '保存记忆'}</button>
      </div>}
      <div className="enterprise-memory-list">
        {visible.map((memory) => <article key={memory.id} className={`enterprise-memory-item ${memory.status !== 'active' ? 'inactive' : ''}`}>
          <div className="enterprise-memory-item-main">
            <strong>{memory.title}</strong>
            <small>{scopeLabels[memory.scopeType]}{memory.scopeKey ? ` · ${memory.scopeKey}` : ''} · {typeLabels[memory.memoryType]} · v{memory.version}</small>
          </div>
          <p>{memory.content}</p>
          <div className="enterprise-memory-source"><span>来源：{memory.sourceLabel}</span><span>{memory.expiresAt ? `有效至 ${memory.expiresAt.slice(0, 10)}` : '长期有效'}</span></div>
          {memory.sourceExcerpt && <blockquote>{memory.sourceExcerpt}</blockquote>}
          {memory.status === 'active' && <div className="chat-task-plan-actions">
            <button type="button" className="ghost-button compact-button" disabled={busy} onClick={() => beginCorrection(memory)}><Pencil size={12} />纠正</button>
            <button type="button" className="ghost-button compact-button" disabled={busy} onClick={() => void onExpire(memory)}><Clock3 size={12} />设为失效</button>
            {deleteConfirmId === memory.id ? <><button type="button" className="ghost-button compact-button" onClick={() => setDeleteConfirmId('')}>保留</button><button type="button" className="danger-button compact-button" disabled={busy} onClick={() => { setDeleteConfirmId(''); void onDelete(memory) }}>确认删除</button></> : <button type="button" className="danger-text-button compact-button" onClick={() => setDeleteConfirmId(memory.id)}><Trash2 size={12} />删除</button>}
          </div>}
          {memory.status !== 'active' && <span className="enterprise-memory-status">{memory.status === 'superseded' ? '已被新版本纠正' : memory.status === 'expired' ? '已失效' : '已删除'}</span>}
        </article>)}
        {visible.length === 0 && <EmptyState variant="compact" title="当前范围暂无企业记忆" description="新增后，Agent 会按组织、合作伙伴和项目范围准确引用。" />}
      </div>
    </div>
  )
}
