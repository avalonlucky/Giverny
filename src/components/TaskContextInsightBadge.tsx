import { Info } from 'lucide-react'
import type { TaskContextInsight } from '../types/taskUi'

export function TaskContextInsightBadge({ insight }: { insight?: TaskContextInsight }) {
  if (!insight) {
    return null
  }
  return (
    <span className={`task-context-insight admin-only-data ${insight.tone}`} title={`${insight.detail}｜依据：${insight.evidence}`}>
      <Info size={12} />
      {insight.label}
    </span>
  )
}
