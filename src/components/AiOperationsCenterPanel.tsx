import { useState } from 'react'
import { AlertTriangle, Plus, RotateCcw, UserPlus } from 'lucide-react'
import type { AiOperationsCenter, WorkspaceSummary } from '../lib/api'

type Props = {
  operations: AiOperationsCenter | null
  loading: boolean
  jobBusyId: string
  alertBusyId: string
  workspaces: WorkspaceSummary[]
  workspaceSwitching: boolean
  workspaceMessage: string
  onRefresh: () => void
  onJobAction: (jobId: string, action: 'retry' | 'cancel') => void
  onAlertAction: (alertId: string, status: 'acknowledged' | 'resolved') => void
  onWorkspaceChange: (workspaceId: string) => void
  onWorkspaceCreate: (name: string) => void
  onWorkspaceMemberAdd: (workspaceId: string, email: string, role: string) => void
}

const intentLabels: Record<string, string> = {
  general: '一般问答',
  task_query: '任务查询',
  financial_query: '财务查询',
  monthly_review: '月度复盘',
  task_operation: '任务操作',
}

function formatDuration(value: number) {
  if (!value) return '0 秒'
  return value < 1000 ? `${Math.round(value)} 毫秒` : `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)} 秒`
}

export default function AiOperationsCenterPanel({
  operations,
  loading,
  jobBusyId,
  alertBusyId,
  workspaces,
  workspaceSwitching,
  workspaceMessage,
  onRefresh,
  onJobAction,
  onAlertAction,
  onWorkspaceChange,
  onWorkspaceCreate,
  onWorkspaceMemberAdd,
}: Props) {
  const [workspaceName, setWorkspaceName] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [memberRole, setMemberRole] = useState('member')
  const submitWorkspace = () => {
    const name = workspaceName.trim()
    if (!name) return
    onWorkspaceCreate(name)
    setWorkspaceName('')
  }
  const submitMember = (workspaceId: string) => {
    const email = memberEmail.trim()
    if (!email) return
    onWorkspaceMemberAdd(workspaceId, email, memberRole)
    setMemberEmail('')
  }

  return (
    <section className="panel settings-ai-panel ai-operations-panel">
      <div className="panel-header compact agent-quality-header">
        <div>
          <span className="model-section-kicker">可观测与治理</span>
          <h2>AI 运行中心</h2>
          <p>统一查看模型路由、后台任务、学习效果与当前工作区，不保存用户问题或回答正文</p>
        </div>
        <button type="button" className="ghost-button compact-button" disabled={loading} onClick={onRefresh}>
          <RotateCcw size={14} />
          {loading ? '刷新中…' : '刷新'}
        </button>
      </div>
      {!operations && loading && <p className="calendar-empty-hint">正在汇总 AI 运行状态…</p>}
      {operations && (
        <>
          {operations.alerts.length > 0 && (
            <div className="ai-operation-alerts" aria-label="AI 运行告警">
              {operations.alerts.map((alert) => (
                <article className={`ai-operation-alert severity-${alert.severity}`} key={alert.id}>
                  <AlertTriangle size={17} />
                  <div>
                    <strong>{alert.title}</strong>
                    <p>{alert.message}</p>
                    <small>最近出现 {alert.occurrences} 次{alert.status === 'acknowledged' ? ' · 已确认' : ''}</small>
                  </div>
                  <div className="ai-operation-alert-actions">
                    {alert.status === 'open' && <button type="button" disabled={alertBusyId === alert.id} onClick={() => onAlertAction(alert.id, 'acknowledged')}>确认</button>}
                    <button type="button" disabled={alertBusyId === alert.id} onClick={() => onAlertAction(alert.id, 'resolved')}>解决</button>
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className="ai-operations-summary">
            <article>
              <span>当前工作区</span>
              {workspaces.length > 1 ? (
                <select
                  className="ai-workspace-select"
                  aria-label="切换工作区"
                  value={operations.workspace.id}
                  disabled={workspaceSwitching}
                  onChange={(event) => onWorkspaceChange(event.target.value)}
                >
                  {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
                </select>
              ) : <strong>{operations.workspace.name}</strong>}
              <small>{operations.workspace.role} · {operations.workspace.foundationReady ? '租户上下文已就绪' : '待初始化'}</small>
              <div className="ai-workspace-tools">
                <label className="ai-workspace-row">
                  <span>新建工作区</span>
                  <input value={workspaceName} placeholder="例如：合作伙伴项目组" onChange={(event) => setWorkspaceName(event.target.value)} />
                  <button type="button" disabled={workspaceSwitching || !workspaceName.trim()} onClick={submitWorkspace}>
                    <Plus size={13} />
                    创建
                  </button>
                </label>
                <label className="ai-workspace-row">
                  <span>添加成员</span>
                  <input value={memberEmail} placeholder="成员邮箱" onChange={(event) => setMemberEmail(event.target.value)} />
                  <select value={memberRole} onChange={(event) => setMemberRole(event.target.value)}>
                    <option value="member">成员</option>
                    <option value="viewer">只读</option>
                    <option value="admin">管理员</option>
                  </select>
                  <button type="button" disabled={workspaceSwitching || !memberEmail.trim()} onClick={() => submitMember(operations.workspace.id)}>
                    <UserPlus size={13} />
                    添加
                  </button>
                </label>
                {workspaceMessage && <small className="ai-workspace-message">{workspaceMessage}</small>}
              </div>
            </article>
            <article>
              <span>路由成功率</span>
              <strong>{operations.routing.totalRuns ? `${operations.routing.successRate}%` : '—'}</strong>
              <small>本机 {operations.routing.localCliRuns} · 云端 {operations.routing.cloudRuns} · P95 {formatDuration(operations.routing.p95DurationMs)}</small>
            </article>
            <article>
              <span>后台任务</span>
              <strong>{operations.background.activeCount}</strong>
              <small>运行中 · {operations.background.failedCount} 失败 · 附件分析 {operations.background.attachmentActiveCount}</small>
            </article>
            <article>
              <span>持续学习</span>
              <strong>{operations.learning.totalSamples}</strong>
              <small>直接采用 {operations.learning.adoptionRate}% · 修改后采用 {operations.learning.editedRate}%</small>
            </article>
          </div>
          <div className="ai-operations-columns">
            <section>
              <h3>最近路由</h3>
              {operations.routing.recent.length ? (
                <div className="ai-operations-list">
                  {operations.routing.recent.slice(0, 8).map((item) => (
                    <article key={`${item.createdAt}-${item.intent}-${item.durationMs}`}>
                      <div><strong>{item.model}</strong><small>{intentLabels[item.intent] || item.intent} · {formatDuration(item.durationMs)}</small></div>
                      <span className={`ai-route-${item.route}`}>{item.route === 'local-cli' ? '本机 CLI' : item.route === 'cloud-fallback' ? '云端回退' : '云端'}</span>
                    </article>
                  ))}
                </div>
              ) : <p className="calendar-empty-hint">当前周期还没有路由记录。</p>}
            </section>
            <section>
              <h3>后台任务中心</h3>
              {operations.background.jobs.length ? (
                <div className="ai-operations-list">
                  {operations.background.jobs.slice(0, 8).map((job) => (
                    <article key={job.id}>
                      <div><strong>{job.title}</strong><small>{job.status === 'completed' ? '已完成' : job.status === 'failed' ? job.error || '执行失败' : `${job.phase} · ${job.progress}%`}</small></div>
                      <div className="ai-operations-job-actions">
                        <span className={`status-${job.status}`}>{job.status === 'queued' ? '排队中' : job.status === 'running' ? '运行中' : job.status === 'completed' ? '已完成' : job.status === 'cancelled' ? '已取消' : '失败'}</span>
                        {(job.status === 'failed' || job.status === 'cancelled') && <button type="button" disabled={jobBusyId === job.id} onClick={() => onJobAction(job.id, 'retry')}>重试</button>}
                        {(job.status === 'queued' || job.status === 'running') && <button type="button" disabled={jobBusyId === job.id} onClick={() => onJobAction(job.id, 'cancel')}>取消</button>}
                      </div>
                    </article>
                  ))}
                </div>
              ) : <p className="calendar-empty-hint">当前没有后台分析任务。</p>}
            </section>
            <section>
              <h3>学习效果</h3>
              <div className="ai-learning-overview">
                <p><span>工时建议可核对样本</span><strong>{operations.learning.hourEstimateObserved}</strong></p>
                <p><span>误差 20% 内</span><strong>{operations.learning.hourEstimateObserved ? `${operations.learning.hourEstimateWithin20Rate}%` : '—'}</strong></p>
                <p><span>明确拒绝</span><strong>{operations.learning.rejectionRate}%</strong></p>
              </div>
              {operations.learning.calibrations.length ? (
                <div className="agent-quality-list">
                  {operations.learning.calibrations.slice(0, 6).map((item) => (
                    <div key={`${item.context}-${item.designType}-${item.principalId}`}>
                      <span>{item.designType || item.context}{item.topReasonCategory ? ` · ${item.topReasonCategory}` : ''}</span>
                      <strong>{item.sampleCount}</strong>
                    </div>
                  ))}
                </div>
              ) : <p className="calendar-empty-hint">继续采用、修改或拒绝 AI 建议后，这里会形成独立校准画像。</p>}
            </section>
          </div>
        </>
      )}
    </section>
  )
}
