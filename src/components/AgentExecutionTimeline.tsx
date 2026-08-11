import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'

export function AgentExecutionTimeline({ trace, status }: { trace: string[]; status: 'running' | 'completed' | 'failed' }) {
  const running = status === 'running'
  const [tick, setTick] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Filter out system-level noise
  const thoughts = trace
    .map((line) => line.replace(/s*[tool:[^]]+]s*/g, ' ').trim())
    // 底层框架名与主链名称一律不进思考链：用户看到的应当是推理过程，不是我们的技术选型。
    .filter((line) => line && line !== '…' && line !== '...' && !/(?:执行编排路径|结构化事实协议|业务事实核验|主模型调用|Google\s*ADK|语义编排|understands*→|query_[a-z_]+)/i.test(line))
    .map((line) => line.replace(/^(?:思考|理解|规划|动作|结果|补充|评估|执行计划|确认需要业务依据|确认产品使用问题|确认站内操作目标)[：:]s*/, ''))

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Only run interval while running; tick drives progressive reveal
  useEffect(() => {
    if (!running) {
      stopTimer()
      return
    }
    if (!timerRef.current) {
      timerRef.current = setInterval(() => setTick((t) => t + 1), 200)
    }
    return stopTimer
  }, [running, stopTimer])

  // Derived: when not running, show all; when running, reveal progressively
  const visibleCount = running ? Math.min(Math.max(tick, 1), thoughts.length) : thoughts.length
  const visibleThoughts = thoughts.slice(0, visibleCount)
  const isThinking = running && thoughts.length === 0

  // Claude-style: expanded while running, collapsed when done
  const label = running ? '思考中' : status === 'failed' ? '思考中断' : `已思考 ${thoughts.length} 步`

  // 展开时正文已经逐条列出全部思考，摘要里再显示最后一条就是同一句话显示两遍；
  // 因此摘要预览只在用户手动收起后出现。手动开合记录跟随 running 失效，
  // 保证"运行时展开、结束后收起"的默认行为不被上一轮的手动状态带偏。
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
        {running && !isThinking && !expanded && <small className="thinking-latest">{visibleThoughts.at(-1)}</small>}
        <ChevronDown size={14} />
      </summary>
      <div className="thinking-stream" aria-live="polite">
        {isThinking ? (
          <p className="thinking-placeholder">
            <span className="thinking-wave"><i /><i /><i /></span>
          </p>
        ) : (
          visibleThoughts.map((thought, index) => (
            <p
              key={`${index}-${thought.slice(0, 20)}`}
              className={`thinking-line ${running && index === visibleThoughts.length - 1 ? 'active' : ''}`}
            >
              {thought}
            </p>
          ))
        )}
      </div>
    </details>
  )
}
