import type { AgentBackgroundTask } from '../types/agent'
import { agentAnalysisStatusLabel } from '../lib/agentAnalysisPresentation'
import { ChatMarkdown } from './ChatContent'

const AGENT_ANALYSIS_PHASES: Array<{ phase: AgentBackgroundTask['phase']; label: string }> = [
  { phase: 'queued', label: '排队等待' },
  { phase: 'collecting', label: '汇总工作资料' },
  { phase: 'analyzing', label: '生成可核对报告' },
  { phase: 'completed', label: '保存分析结果' },
]

export function AgentAnalysisTaskCard({
  task,
  busy,
  onCancel,
  onRetry,
}: {
  task: AgentBackgroundTask
  busy: boolean
  onCancel: () => void
  onRetry: () => void
}) {
  const activePhaseIndex = AGENT_ANALYSIS_PHASES.findIndex((item) => item.phase === task.phase)
  const terminal = task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled'
  return (
    <section className={`agent-analysis-card status-${task.status}`} aria-label={`${task.title}后台分析`}>
      <header className="agent-analysis-header">
        <div>
          <small>后台分析任务</small>
          <strong>{task.title}</strong>
        </div>
        <span className="agent-analysis-status">{agentAnalysisStatusLabel(task.status)}</span>
      </header>
      {!terminal && (
        <div className="agent-analysis-progress" aria-label={`分析进度 ${task.progress}%`}>
          <div><span style={{ width: `${task.progress}%` }} /></div>
          <small>{task.progress}%</small>
        </div>
      )}
      <ol className="agent-analysis-steps">
        {AGENT_ANALYSIS_PHASES.map((item, index) => {
          const completed = task.status === 'completed' || activePhaseIndex > index
          const active = !terminal && item.phase === task.phase
          return <li key={item.phase} className={`${completed ? 'complete' : ''} ${active ? 'active' : ''}`}>{item.label}</li>
        })}
      </ol>
      {task.result && (
        <div className="agent-analysis-result chat-final-answer">
          <ChatMarkdown content={task.result} />
        </div>
      )}
      {task.error && <p className="agent-analysis-error">{task.error}</p>}
      {(task.status === 'queued' || task.status === 'running' || task.status === 'failed' || task.status === 'cancelled') && (
        <footer className="agent-analysis-actions">
          {(task.status === 'queued' || task.status === 'running') && (
            <button type="button" className="ghost-button compact-button" disabled={busy} onClick={onCancel}>取消分析</button>
          )}
          {(task.status === 'failed' || task.status === 'cancelled') && (
            <button type="button" className="primary-button compact-button" disabled={busy} onClick={onRetry}>重新分析</button>
          )}
        </footer>
      )}
    </section>
  )
}
