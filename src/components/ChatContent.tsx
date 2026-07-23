import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronDown } from 'lucide-react'

export function RichChatLine({ line }: { line: string }) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, index) => (
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : <span key={index}>{part}</span>
  ))
}

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer">{children}</a>,
        table: ({ children }) => <div className="chat-markdown-table-wrap"><table>{children}</table></div>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

function trimEmptyChatLines(lines: string[]) {
  const next = [...lines]
  while (next.length > 0 && next[0].trim() === '') next.shift()
  while (next.length > 0 && next[next.length - 1].trim() === '') next.pop()
  return next
}

function answerLinesWithoutThinkingBlocks(lines: string[]) {
  const thinkingLines: string[] = []
  const answerLines: string[] = []
  let isInsideThinking = false
  let hasThinkingBlock = false

  lines.forEach((line) => {
    let rest = line
    if (rest === '') {
      ;(isInsideThinking ? thinkingLines : answerLines).push(rest)
      return
    }
    while (rest.length > 0) {
      if (isInsideThinking) {
        const closeIndex = rest.search(/<\/think>/i)
        if (closeIndex < 0) {
          thinkingLines.push(rest)
          rest = ''
          continue
        }
        const closeMatch = rest.slice(closeIndex).match(/^<\/think>/i)
        thinkingLines.push(rest.slice(0, closeIndex))
        rest = rest.slice(closeIndex + (closeMatch?.[0].length ?? '</think>'.length))
        isInsideThinking = false
        continue
      }
      const openIndex = rest.search(/<think>/i)
      if (openIndex < 0) {
        answerLines.push(rest)
        rest = ''
        continue
      }
      const openMatch = rest.slice(openIndex).match(/^<think>/i)
      if (openIndex > 0) answerLines.push(rest.slice(0, openIndex))
      rest = rest.slice(openIndex + (openMatch?.[0].length ?? '<think>'.length))
      isInsideThinking = true
      hasThinkingBlock = true
    }
  })

  return trimEmptyChatLines(hasThinkingBlock ? answerLines : lines)
}

export function ChatContent({ content }: { content: string }) {
  const lines = content.split('\n')
  const liveTraceMatch = lines[0]?.match(/^我正在这样处理：(\d+)$/)
  const isLiveAgentTrace = Boolean(liveTraceMatch)
  if (lines[0] === '我按这个过程处理：' || isLiveAgentTrace) {
    const dividerIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '')
    const traceLines = lines
      .slice(1, dividerIndex > 0 ? dividerIndex : lines.length)
      .map((line) => line.replace(/^- /, '').trim())
      .filter(Boolean)
    const answerLines = answerLinesWithoutThinkingBlocks(dividerIndex > 0 ? lines.slice(dividerIndex + 1) : [])
    const totalSteps = liveTraceMatch ? Number(liveTraceMatch[1]) : traceLines.length
    return (
      <>
        <details className="chat-agent-timeline" open={isLiveAgentTrace}>
          <summary>
            <span>{isLiveAgentTrace ? '正在运行' : '运行完成'}</span>
            <small>{isLiveAgentTrace ? `${traceLines.length} / ${totalSteps} 步` : `${traceLines.length} 步`}</small>
            <ChevronDown size={13} />
          </summary>
          <ol>
            {traceLines.map((line, index) => <li key={`${index}-${line}`}><RichChatLine line={line} /></li>)}
          </ol>
        </details>
        {answerLines.length > 0 && <div className="chat-final-answer"><ChatMarkdown content={answerLines.join('\n')} /></div>}
      </>
    )
  }
  const answerLines = answerLinesWithoutThinkingBlocks(lines)
  return answerLines.length > 0
    ? <div className="chat-final-answer"><ChatMarkdown content={answerLines.join('\n')} /></div>
    : null
}
