import type { ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import type { TaskFilter, TaskStatus } from '../types/domain'

export function StatCard({ label, value, trend, icon }: { label: string; value: string; trend: string; icon: ReactNode }) {
  return (
    <article className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-text">
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{trend}</span>
      </div>
    </article>
  )
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`status-badge status-${status}`}>{status}</span>
}

export function TaskSearchBox({ value, onChange, placeholder, className = '' }: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <label className={`search-box task-search-box ${className}`.trim()}>
      <Search size={18} />
      <input aria-label={placeholder} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      {value && (
        <button
          type="button"
          className="search-clear-button"
          aria-label="清除搜索内容"
          title="清除搜索"
          onClick={(event) => {
            event.preventDefault()
            onChange('')
          }}
        >
          <X size={14} />
        </button>
      )}
    </label>
  )
}

export function ActiveTaskFilters({ query, filter, onClearQuery, onClearFilter }: {
  query: string
  filter: TaskFilter
  onClearQuery: () => void
  onClearFilter: () => void
}) {
  const normalizedQuery = query.trim()
  if (!normalizedQuery && filter === '全部') return null

  return (
    <div className="task-active-filters" aria-live="polite">
      <span>当前筛选</span>
      {normalizedQuery && (
        <button type="button" title="清除搜索关键词" onClick={onClearQuery}>
          “{normalizedQuery}”
          <X size={12} />
        </button>
      )}
      {filter !== '全部' && (
        <button type="button" title="清除状态筛选" onClick={onClearFilter}>
          {filter}
          <X size={12} />
        </button>
      )}
      {normalizedQuery && filter !== '全部' && (
        <button type="button" className="task-filter-reset" onClick={() => { onClearQuery(); onClearFilter() }}>
          清除全部
        </button>
      )}
    </div>
  )
}

export function StatusDotLabel({ status }: { status: TaskStatus }) {
  return (
    <span className={`status-dot-label status-dot-${status}`}>
      <StatusDot status={status} />
      {status}
    </span>
  )
}

export function StatusDot({ status }: { status: TaskStatus }) {
  return <i className={`status-dot status-dot-${status}`} aria-hidden="true" />
}
