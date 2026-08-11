import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

type AgentExecutionTimelineProps = {
  thinking?: string
  trace: string[]
  status: 'running' | 'completed' | 'failed'
  reasoningExpected?: boolean
}

// 推理内容是模型自由文本，它会照着提示词念出内部名词。Runtime 已经在出口处
// 换成自然语言，这里是第二层：万一后端漏了，界面也不能把框架名和工具名端给用户。
const INTERNAL_NAME_PATTERN =
  /Google\s*ADK|\bADK\b|LiteLLM|LangGraph|Root\s*Coordinator|Scope\s*Supervisor|Evidence\s*Auditor|语义编排(?:与证据审核)?(?:主链)?/gi

// 界面拿不到 OpenAPI，认不出具体的 operationId，只能按形态兜底：推理里出现的
// snake_case 标识符几乎只可能是接口名、专家代号或协议字段名。带扩展名的文件名
// （hard_cover.png）排除在外，避免把用户自己的数据也涂掉。
const INTERNAL_IDENTIFIER_PATTERN = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+){1,4}\b(?!\.[a-z]{2,5})/g

function scrubInternalNames(value: string) {
  return value.replace(INTERNAL_NAME_PATTERN, '内部流程').replace(INTERNAL_IDENTIFIER_PATTERN, '内部流程')
}

// 推理是分段的自由文本（含 Runtime 加的【阶段】小标题），但它此前被塞进单个 <p>：
// 换行在 HTML 里会被折叠，几百字挤成一堵墙。这里还原成段落，【阶段】单独成行。
type ReasoningBlock = { stage?: string; paragraphs: string[] }

function splitReasoning(value: string): ReasoningBlock[] {
  const blocks: ReasoningBlock[] = []
  for (const chunk of value.split(/\n{2,}/)) {
    const text = chunk.trim()
    if (!text) continue
    const stageMatch = text.match(/^【([^】]+)】\s*([\s\S]*)$/)
    const stage = stageMatch?.[1]
    const body = (stageMatch?.[2] ?? text).trim()
    const paragraphs = body.split('\n').map((line) => line.trim()).filter(Boolean)
    if (stage && blocks.length > 0 && !paragraphs.length) continue
    blocks.push({ stage, paragraphs })
  }
  return blocks
}

function ReasoningBody({ blocks, active = false }: { blocks: ReasoningBlock[]; active?: boolean }) {
  return (
    <div className={`thinking-reasoning ${active ? 'active' : ''}`}>
      {blocks.map((block, index) => (
        <div key={`${index}-${block.stage ?? ''}`} className="thinking-reasoning-block">
          {block.stage && <span className="thinking-reasoning-stage">{block.stage}</span>}
          {block.paragraphs.map((paragraph, line) => (
            <p key={`${line}-${paragraph.slice(0, 16)}`}>{paragraph}</p>
          ))}
        </div>
      ))}
    </div>
  )
}

export function AgentExecutionTimeline({ thinking, trace, status, reasoningExpected }: AgentExecutionTimelineProps) {
  const running = status === 'running'
  const reasoning = scrubInternalNames(thinking?.trim() ?? '')
  const reasoningBlocks = splitReasoning(reasoning)
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
        {/* 当前模型没被要求返回推理时不留空壳：占位符会被当成进度，等于又骗用户一次。 */}
        {/* 当前模型没被要求返回推理时不留空壳：占位符会被当成进度，等于又骗用户一次。 */}
        {(reasoning || reasoningExpected !== false) && (
          running ? (
            // 跑的时候必须直接可见：等待期间的实时反馈就是这段文字的全部意义。
            <section className="thinking-section">
              <strong>模型推理</strong>
              {reasoning ? (
                <ReasoningBody blocks={reasoningBlocks} active />
              ) : (
                <p className="thinking-placeholder">等待模型返回真实推理内容…</p>
              )}
            </section>
          ) : (
            // 跑完就收起来。推理全文动辄上千字，留在展开状态会把真正有用的执行过程挤走。
            <details className="thinking-section thinking-reasoning-fold">
              <summary>
                <strong>模型推理</strong>
                <small>{reasoning ? `${reasoning.length} 字，点击展开` : '本次模型没有返回可展示的推理内容'}</small>
                <ChevronDown size={13} />
              </summary>
              {reasoning && <ReasoningBody blocks={reasoningBlocks} />}
            </details>
          )
        )}
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
