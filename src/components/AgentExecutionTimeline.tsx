import { ChevronDown } from 'lucide-react'
import { RichChatLine } from './ChatContent'

export function AgentExecutionTimeline({ trace, status }: { trace: string[]; status: 'running' | 'completed' | 'failed' }) {
  if (trace.length === 0) return null
  const running = status === 'running'
  const displayTraceLine = (line: string) => line.replace(/\s*\[tool:[^\]]+\]\s*/g, ' ').trim()
  return (
    <details className={`chat-agent-timeline status-${status}`} open>
      <summary>
        <span>{running ? '分析中…' : status === 'failed' ? '分析中断' : '分析过程'}</span>
        <small>{running ? displayTraceLine(trace.at(-1) ?? '') : '已核对，可展开查看'}</small>
        <ChevronDown size={13} />
      </summary>
      <ol>
        {trace.map((line, index) => {
          const active = running && index === trace.length - 1
          const completed = !running || index < trace.length - 1
          return (
            <li key={`${index}-${line}`} className={`${active ? 'active' : ''} ${completed ? 'complete' : ''}`} aria-current={active ? 'step' : undefined}>
              <RichChatLine line={displayTraceLine(line)} />
            </li>
          )
        })}
      </ol>
    </details>
  )
}
