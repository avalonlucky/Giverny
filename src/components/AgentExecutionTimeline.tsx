import { ChevronDown } from 'lucide-react'
import { RichChatLine } from './ChatContent'

export function AgentExecutionTimeline({ trace, status }: { trace: string[]; status: 'running' | 'completed' | 'failed' }) {
  const running = status === 'running'
  const displayTraceLine = (line: string) => {
    const clean = line.replace(/\s*\[tool:[^\]]+\]\s*/g, ' ').trim()
    if (/(?:执行编排路径|结构化事实协议|业务事实核验|主模型调用|understand\s*→|query_[a-z_]+)/i.test(clean)) return ''
    return clean
      .replace(/^确认需要业务依据[：:]/, '思考：')
      .replace(/^确认产品使用问题[：:]/, '思考：')
      .replace(/^确认站内操作目标[：:]/, '思考：')
  }
  const visibleTrace = trace.map(displayTraceLine).filter(Boolean)
  return (
    <details className={`chat-agent-timeline status-${status}`} open>
      <summary>
        <span>{running ? '思考中' : status === 'failed' ? '未完成' : '思考过程'}</span>
        {running && visibleTrace.length === 0
          ? <span className="chat-agent-thinking-wave" aria-label="正在思考"><i /><i /><i /></span>
          : <small>{running ? visibleTrace.at(-1) : '已完成，可展开查看'}</small>}
        <ChevronDown size={13} />
      </summary>
      {visibleTrace.length > 0 && <ol>
        {visibleTrace.map((line, index) => {
          const active = running && index === visibleTrace.length - 1
          const completed = !running || index < visibleTrace.length - 1
          return (
            <li key={`${index}-${line}`} className={`${active ? 'active' : ''} ${completed ? 'complete' : ''}`} aria-current={active ? 'step' : undefined}>
              <RichChatLine line={line} />
            </li>
          )
        })}
      </ol>}
    </details>
  )
}
