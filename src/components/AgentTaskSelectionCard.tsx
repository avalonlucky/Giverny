import type { AgentTaskCandidate, AgentTaskSelection } from '../types/agent'

export function AgentTaskSelectionCard({ selection, busy, onSelect }: { selection: AgentTaskSelection; busy: boolean; onSelect: (candidate: AgentTaskCandidate) => void }) {
  return (
    <section className="agent-selection-card" aria-label="选择任务">
      <header className="agent-selection-header">
        <small>需要你确认</small>
        <strong>{selection.prompt}</strong>
      </header>
      <div className="agent-selection-list">
        {selection.candidates.map((candidate) => (
          <button key={candidate.id} type="button" className="agent-selection-option" disabled={busy} onClick={() => onSelect(candidate)}>
            <span className="agent-selection-main">{candidate.title}</span>
            <span className="agent-selection-meta">{[candidate.startDate.slice(0, 10), candidate.type, candidate.status].filter(Boolean).join(' · ')}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
