import { useState } from 'react'
import { AlertTriangle, Plus, RotateCcw, ShieldCheck, UserPlus } from 'lucide-react'
import type { AiOperationsCenter, WorkspaceSummary } from '../lib/api'
import { EmptyState } from './EmptyState'

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
  finance: '财务查询',
  task_data: '任务数据',
  attachment: '附件查询',
  product_help: '产品帮助',
  knowledge: '知识查询',
  write: '写入操作',
  unknown: '待识别',
}

function formatDuration(value: number) {
  if (!value) return '0 秒'
  return value < 1000 ? `${Math.round(value)} 毫秒` : `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)} 秒`
}

function formatObservedDuration(value: number, samples: number) {
  return samples > 0 ? formatDuration(value) : '—'
}

function formatSavedTime(minutes: number) {
  if (!minutes) return '—'
  if (minutes < 60) return `${Math.round(minutes)} 分钟`
  return `${(minutes / 60).toFixed(minutes >= 600 ? 0 : 1)} 小时`
}

const clientErrorKindLabels: Record<string, string> = {
  render: 'React 渲染',
  'window-error': '脚本异常',
  'unhandled-rejection': 'Promise 异常',
  'resource-error': '资源加载',
  'chunk-load': '分包加载',
  'api-error': '接口异常',
}

const productivityReasonLabels: Record<string, string> = {
  completed: '目标已完成',
  missing_input: '等待补充信息',
  tool_failure: '工具执行失败',
  evidence_missing: '确定性证据不足',
  budget_exhausted: '执行预算已耗尽',
}

const governanceStatusLabels = {
  healthy: '生产目标正常',
  'at-risk': '接近红线',
  breached: '已阻止发布',
  observing: '正在积累样本',
} as const

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
          <h2>运行与质量中心</h2>
          <p>统一查看模型路由、后台任务、前端体验与当前工作区，不保存用户输入、问题或回答正文</p>
        </div>
        <button type="button" className="ghost-button compact-button" disabled={loading} onClick={onRefresh}>
          <RotateCcw size={14} />
          {loading ? '刷新中…' : '刷新'}
        </button>
      </div>
      {!operations && loading && <p className="loading-state">正在汇总运行状态…</p>}
      {operations && (
        <>
          {operations.alerts.length > 0 && (
            <div className="ai-operation-alerts" aria-label="运行告警">
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
          <section className={`ai-governance-section status-${operations.governance.slo.status}`} aria-label="生产保护">
            <div className="ai-agent-audit-heading">
              <div>
                <span className="model-section-kicker">生产保护</span>
                <h3><ShieldCheck size={16} /> {governanceStatusLabels[operations.governance.slo.status]}</h3>
                <p>
                  {operations.governance.slo.releaseGate === 'block'
                    ? '当前指标突破红线，新版本不能直接上线。'
                    : operations.governance.slo.releaseGate === 'observe'
                      ? '样本不足时继续观察，但候选版本仍必须通过健康与事实校验。'
                      : '当前允许发布，候选版本仍会先验证，失败时自动恢复上一版本。'}
                </p>
              </div>
              <small>v{operations.governance.version} · {operations.governance.release.automaticRollback ? '自动回滚已启用' : '未启用自动回滚'}</small>
            </div>
            <div className="ai-governance-objectives">
              {operations.governance.slo.objectives.map((objective) => (
                <article key={objective.key}>
                  <span>{objective.label}</span>
                  <strong>{objective.unit === 'ms' ? formatDuration(objective.value) : `${objective.value}%`}</strong>
                  <small className={`governance-objective-${objective.status}`}>{objective.summary}</small>
                </article>
              ))}
            </div>
            <div className="ai-governance-notes">
              <p>
                <strong>主模型纪律</strong>
                <span>目标 {operations.governance.fallbackPolicy.targetPrimaryModelRate}% 由主模型完成；备用模型仅在同模型重试失败或能力明确不匹配时启动。</span>
              </p>
              <p>
                <strong>本周期回退</strong>
                <span>{operations.governance.fallbackPolicy.fallbackRuns} 次，其中合规 {operations.governance.fallbackPolicy.compliantRuns} 次、违规 {operations.governance.fallbackPolicy.violations} 次。</span>
              </p>
              <p>
                <strong>外部告警</strong>
                <span>{operations.governance.integrations.signedDelivery ? '签名 Webhook 已接通，只发送运行事件，不发送任务正文。' : '尚未配置签名 Webhook，站内告警继续正常工作。'}</span>
              </p>
              <p>
                <strong>错误预算</strong>
                <span>本周期已使用 {operations.governance.slo.errorBudget.consumedPercent}%，剩余 {operations.governance.slo.errorBudget.remainingPercent}%。</span>
              </p>
            </div>
          </section>
          <section className="ai-agent-audit-section" aria-label="Agent 执行审计">
            <div className="ai-agent-audit-heading">
              <div>
                <h3>Agent 执行审计</h3>
                <p>目标完成 {operations.agentTurns.completed} · 首轮完成 {operations.agentTurns.firstPassCompleted} · 待补充 {operations.agentTurns.needsInput} · 失败 {operations.agentTurns.productivityFailed}</p>
              </div>
              <small>仅记录执行状态，不保存对话正文</small>
            </div>
            {operations.agentTurns.recent.length ? (
              <div className="ai-operations-list ai-agent-audit-list">
                {operations.agentTurns.recent.slice(0, 10).map((turn) => (
                  <details key={turn.id}>
                    <summary>
                      <div>
                        <strong>{intentLabels[turn.intent] || turn.intent}</strong>
                        <small>{turn.model} · {turn.tools.length ? turn.tools.map((tool) => tool.name).join('、') : '未调用工具'} · {formatDuration(turn.durationMs)}</small>
                      </div>
                      <span className={turn.verificationPassed ? 'status-completed' : turn.outcome === 'failed' ? 'status-failed' : 'status-running'}>
                        {turn.productivityStatus === 'complete' ? turn.productivityCycles > 1 ? '补查后完成' : '已完成' : turn.productivityStatus === 'needs_input' ? '待补充' : turn.productivityStatus === 'failed' ? '失败' : turn.verificationPassed ? '已验真' : '待核对'}
                      </span>
                    </summary>
                    <div className="ai-agent-audit-detail">
                      <p>闭环 {turn.productivityCycles || turn.attempts} 轮 · 工具 {turn.productivityToolCalls || turn.tools.length} 次 · 确定性证据 {turn.deterministicEvidenceCount} 条{turn.fallbackUsed ? ' · 已启用备用模型' : ' · 主模型完成'}</p>
                      {turn.productivityReasonCode && <p>终止原因：{productivityReasonLabels[turn.productivityReasonCode] || turn.productivityReasonCode}</p>}
                      {turn.tools.length > 0 && <p>工具：{turn.tools.map((tool) => `${tool.name}（${tool.status === 'success' ? '成功' : tool.status}）`).join('、')}</p>}
                      {turn.issues.length > 0 && <p>验真：{turn.issues.join(' ')}</p>}
                      {turn.fallbackReason && <p>备用原因：{turn.fallbackReason}</p>}
                    </div>
                  </details>
                ))}
              </div>
            ) : <EmptyState variant="inline" title="暂无 Agent 执行记录" description="新的 Agent 请求完成后，这里会显示可核对的执行记录。" />}
          </section>
          <section className="ai-agent-audit-section" aria-label="Agent 长期效果">
            <div className="ai-agent-audit-heading">
              <div>
                <h3>Agent 长期效果</h3>
                <p>{operations.effectiveness.observation.note}</p>
              </div>
              <small>v{operations.effectiveness.currentVersion} · 最近 {operations.effectiveness.periodDays} 天</small>
            </div>
            <div className="ai-governance-objectives" aria-label="长期效果核心指标">
              <article>
                <span>任务完成率</span>
                <strong>{operations.effectiveness.summary.terminalTasks ? `${operations.effectiveness.summary.taskCompletionRate}%` : '—'}</strong>
                <small>{operations.effectiveness.summary.completedTasks}/{operations.effectiveness.summary.terminalTasks} 项确认式操作完成</small>
              </article>
              <article>
                <span>人工修正率</span>
                <strong>{operations.effectiveness.summary.approvalPreviews ? `${operations.effectiveness.summary.humanCorrectionRate}%` : '—'}</strong>
                <small>{operations.effectiveness.summary.approvalRevisions} 次修改 / {operations.effectiveness.summary.approvalPreviews} 张确认卡</small>
              </article>
              <article>
                <span>执行质量</span>
                <strong>{operations.effectiveness.summary.totalTurns ? `${operations.effectiveness.summary.executionQualityRate}%` : '—'}</strong>
                <small>{operations.effectiveness.summary.verifiedTurns}/{operations.effectiveness.summary.totalTurns} 次通过确定性验真</small>
              </article>
              <article>
                <span>估算节省时间</span>
                <strong>{formatSavedTime(operations.effectiveness.summary.estimatedMinutesSaved)}</strong>
                <small>按成功工具类型保守估算，单次最多 30 分钟</small>
              </article>
            </div>
            {operations.effectiveness.versions.length > 0 && (
              <div className="ai-operations-list ai-agent-audit-list">
                {operations.effectiveness.versions.slice(0, 6).map((version) => (
                  <details key={version.appVersion}>
                    <summary>
                      <div>
                        <strong>v{version.appVersion}</strong>
                        <small>{version.runs} 次运行 · 估算节省 {formatSavedTime(version.estimatedMinutesSaved)}</small>
                      </div>
                      <span>{version.executionQualityRate}% 验真</span>
                    </summary>
                    <div className="ai-agent-audit-detail">
                      <p>确认式任务完成率 {version.taskCompletionRate}% · 执行质量 {version.executionQualityRate}%</p>
                    </div>
                  </details>
                ))}
              </div>
            )}
            <details className="ai-governance-notes">
              <summary>查看统计口径</summary>
              <p><strong>任务完成率</strong><span>{operations.effectiveness.policy.taskCompletion}</span></p>
              <p><strong>人工修正率</strong><span>{operations.effectiveness.policy.humanCorrection}</span></p>
              <p><strong>执行质量</strong><span>{operations.effectiveness.policy.executionQuality}</span></p>
              <p><strong>节省时间</strong><span>{operations.effectiveness.policy.timeSaved}</span></p>
            </details>
          </section>
          <section className="ai-agent-audit-section" aria-label="真实用户体验">
            <div className="ai-agent-audit-heading">
              <div>
                <h3>真实用户体验</h3>
                <p>最近 {operations.periodDays} 天 {operations.clientPerformance.sampleCount} 次访问 · 有效样本 {operations.clientPerformance.ratings.ratedSamples} · 良好率 {operations.clientPerformance.ratings.ratedSamples ? `${operations.clientPerformance.ratings.goodRate}%` : '—'}</p>
              </div>
              <small>{operations.clientPerformance.latestVersion ? `最新 v${operations.clientPerformance.latestVersion}` : '等待真实访问样本'}</small>
            </div>
            <div className="client-performance-overview" aria-label="前端 P75 性能指标">
              <p><span>TTFB</span><strong>{formatObservedDuration(operations.clientPerformance.p75.ttfbMs, operations.clientPerformance.sampleCount)}</strong></p>
              <p><span>FCP</span><strong>{formatObservedDuration(operations.clientPerformance.p75.fcpMs, operations.clientPerformance.ratings.ratedSamples)}</strong></p>
              <p><span>LCP</span><strong>{formatObservedDuration(operations.clientPerformance.p75.lcpMs, operations.clientPerformance.ratings.ratedSamples)}</strong></p>
              <p><span>INP</span><strong>{operations.clientPerformance.p75.inpMs ? formatDuration(operations.clientPerformance.p75.inpMs) : '—'}</strong></p>
              <p><span>CLS</span><strong>{operations.clientPerformance.ratings.ratedSamples ? operations.clientPerformance.p75.cls : '—'}</strong></p>
              <p><span>页面加载</span><strong>{formatObservedDuration(operations.clientPerformance.p75.loadMs, operations.clientPerformance.sampleCount)}</strong></p>
            </div>
            {operations.clientPerformance.slowRoutes.length > 0 && (
              <div className="ai-operations-list ai-agent-audit-list client-performance-routes">
                {operations.clientPerformance.slowRoutes.slice(0, 5).map((item) => (
                  <details key={item.path}>
                    <summary>
                      <div>
                        <strong>{item.path}</strong>
                        <small>{item.samples} 个样本 · LCP {formatDuration(item.p75LcpMs)} · INP {formatDuration(item.p75InpMs)}</small>
                      </div>
                      <span>CLS {item.p75Cls}</span>
                    </summary>
                  </details>
                ))}
              </div>
            )}
          </section>
          <section className="ai-agent-audit-section" aria-label="前端运行异常">
            <div className="ai-agent-audit-heading">
              <div>
                <h3>前端运行异常</h3>
                <p>最近 {operations.periodDays} 天 {operations.clientErrors.uniqueErrors} 类 · 累计 {operations.clientErrors.totalOccurrences} 次</p>
              </div>
              <small>不保存输入内容、附件或 URL 查询参数</small>
            </div>
            {operations.clientErrors.recent.length ? (
              <div className="ai-operations-list ai-agent-audit-list">
                {operations.clientErrors.recent.slice(0, 10).map((item) => (
                  <details key={`${item.fingerprint}-${item.appVersion}-${item.path}`}>
                    <summary>
                      <div>
                        <strong>{item.message}</strong>
                        <small>{item.path} · v{item.appVersion || '未知'} · 最近 {item.lastSeenAt}</small>
                      </div>
                      <span className="status-failed">{item.occurrences} 次</span>
                    </summary>
                    <div className="ai-agent-audit-detail">
                      <p>类型：{clientErrorKindLabels[item.kind] || item.kind} · 首次：{item.firstSeenAt}</p>
                      <p>指纹：{item.fingerprint}</p>
                      {item.stack && <pre className="client-error-stack">{item.stack}</pre>}
                      {item.componentStack && <pre className="client-error-stack">{item.componentStack}</pre>}
                    </div>
                  </details>
                ))}
              </div>
            ) : <EmptyState variant="inline" title="当前周期没有前端运行异常" />}
          </section>
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
              ) : <EmptyState variant="inline" title="当前周期还没有路由记录" />}
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
              ) : <EmptyState variant="inline" title="当前没有后台分析任务" />}
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
              ) : <EmptyState variant="inline" title="暂无学习校准画像" description="继续采用、修改或拒绝 AI 建议后，这里会形成独立校准画像。" />}
            </section>
          </div>
        </>
      )}
    </section>
  )
}
