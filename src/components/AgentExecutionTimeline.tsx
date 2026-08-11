import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

type AgentExecutionTimelineProps = {
  thinking?: string
  trace: string[]
  status: 'running' | 'completed' | 'failed'
}

export function AgentExecutionTimeline({ thinking, trace, status }: AgentExecutionTimelineProps) {
  const running = status === 'running'
  const reasoning = thinking?.trim() ?? ''
  const progress = trace
    .map((line) => line.replace(/\s*\[tool:[^\]]+\]\s*/g, ' ').trim())
    .filter((line) => line && line !== '…' && line !== '...' && !/(?:执行编排路径|结构化事实协议|业务事实核验|主模型调用|Google\s*ADK|语义编排|understand\s*→|query_[a-z_]+)/i.test(line))
  const label = running ? '模型正在推理' : status === 'failed' ? '推理中断' : reasoning ? '模型推理' : '执行过程'
  const [toggle, setToggle] = useState<{ running: boolean; open: boolean } | null>(null)
  const expanded = toggle && toggle.running === running ? toggle.open : running

  return (
    <details
      className={`chat-agent-thinking status-${status}`}
      open={expanded}
      onToggle={(event) => setToggle({ running, open: event.currentTarget.open })}
    >
      <summary>
        <span className="thinking-indicator">
          {running && <span className="thinking-dot" aria-hidden="true" />}
          {label}
        </span>
        {running && !expanded && (
          <small className="thinking-latest">{reasoning.split('\n').filter(Boolean).at(-1) ?? progress.at(-1)}</small>
        )}
        <ChevronDown size={14} />
      </summary>
      <div className="thinking-stream" aria-live="polite">
        <section className="thinking-section">
          <strong>模型推理</strong>
          {reasoning ? (
            <p className={`thinking-reasoning ${running ? 'active' : ''}`}>{reasoning}</p>
          ) : (
            <p className="thinking-placeholder">
              {running ? '等待模型返回真实推理内容…' : '本次模型没有返回可展示的推理内容。'}
            </p>
          )}
        </section>
        {progress.length > 0 && (
          <section className="thinking-section execution-progress">
            <strong>执行过程</strong>
            {progress.map((line, index) => (
              <p key={`${index}-${line.slice(0, 20)}`} className="thinking-line">{line}</p>
            ))}
          </section>
        )}
      </div>
    </details>
  )
}
