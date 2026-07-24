import type { ReactNode } from 'react'
import { Flower2, Waves } from 'lucide-react'

export type EmptyStateVariant = 'feature' | 'panel' | 'compact' | 'inline'

type EmptyStateProps = {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
  role?: string
  variant?: EmptyStateVariant
  illustration?: boolean
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
  role,
  variant = 'panel',
  illustration = variant === 'feature',
}: EmptyStateProps) {
  return (
    <div className={`empty-state empty-state-${variant} ${className}`.trim()} role={role}>
      {illustration && !icon ? (
        <span className="empty-state-lily" aria-hidden="true">
          <Waves className="empty-state-lily-water" />
          <Flower2 className="empty-state-lily-flower" />
        </span>
      ) : null}
      {icon ? <span className="empty-state-icon" aria-hidden="true">{icon}</span> : null}
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  )
}
