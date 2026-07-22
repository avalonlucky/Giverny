import type { ReactNode } from 'react'

type EmptyStateProps = {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
  role?: string
}

export function EmptyState({ icon, title, description, action, className = '', role }: EmptyStateProps) {
  return (
    <div className={`empty-state ${className}`.trim()} role={role}>
      {icon ? <span className="empty-state-icon">{icon}</span> : null}
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  )
}
