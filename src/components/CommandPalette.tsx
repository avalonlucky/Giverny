import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { createPortal } from 'react-dom'

export type CommandPaletteAction = {
  id: string
  group: string
  label: string
  detail?: string
  shortcut?: string
  keywords?: string
  disabled?: boolean
  run: () => void
}

export type ShortcutHelpGroup = {
  label: string
  items: Array<{ keys: string; action: string }>
}

export function CommandPalette({
  actions,
  initialQuery,
  onClose,
}: {
  actions: CommandPaletteAction[]
  initialQuery: string
  onClose: () => void
}) {
  const [query, setQuery] = useState(initialQuery)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const normalizedQuery = query.trim().toLowerCase()
  const filteredActions = useMemo(
    () =>
      actions.filter((action) => {
        if (!normalizedQuery) return true
        return [action.label, action.detail, action.group, action.keywords]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      }),
    [actions, normalizedQuery],
  )

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const runAction = (action: CommandPaletteAction | undefined) => {
    if (!action || action.disabled) return
    onClose()
    action.run()
  }

  const groupedActions = filteredActions.reduce<Array<{ label: string; actions: CommandPaletteAction[] }>>((groups, action) => {
    const existing = groups.find((group) => group.label === action.group)
    if (existing) existing.actions.push(action)
    else groups.push({ label: action.group, actions: [action] })
    return groups
  }, [])

  return (
    <div className="command-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="命令面板"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
          } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActiveIndex((current) => Math.min(current + 1, Math.max(filteredActions.length - 1, 0)))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex((current) => Math.max(current - 1, 0))
          } else if (event.key === 'Enter') {
            event.preventDefault()
            runAction(filteredActions[activeIndex])
          }
        }}
      >
        <label className="command-search">
          <Search size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            placeholder="搜索任务、页面或操作…"
          />
          <kbd>Esc</kbd>
        </label>
        <div className="command-results" role="listbox" aria-label="可用命令">
          {groupedActions.map((group) => (
            <div className="command-group" key={group.label}>
              <p>{group.label}</p>
              {group.actions.map((action) => {
                const flatIndex = filteredActions.indexOf(action)
                return (
                  <button
                    type="button"
                    className={`command-item ${flatIndex === activeIndex ? 'active' : ''}`}
                    key={action.id}
                    disabled={action.disabled}
                    onMouseMove={() => setActiveIndex(flatIndex)}
                    onClick={() => runAction(action)}
                  >
                    <span>
                      <strong>{action.label}</strong>
                      {action.detail && <small>{action.detail}</small>}
                    </span>
                    {action.shortcut && <kbd>{action.shortcut}</kbd>}
                  </button>
                )
              })}
            </div>
          ))}
          {filteredActions.length === 0 && (
            <div className="command-empty">
              <Search size={18} />
              <span>没有匹配的任务或操作</span>
            </div>
          )}
        </div>
        <footer className="command-footer">
          <span><kbd>↑↓</kbd> 选择</span>
          <span><kbd>Enter</kbd> 执行</span>
          <span><kbd>?</kbd> 快捷键</span>
        </footer>
      </section>
    </div>
  )
}

export function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <div className="img-lightbox-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="图片预览">
      <button type="button" className="img-lightbox-close" onClick={onClose} aria-label="关闭"><X size={18} /></button>
      <img className="img-lightbox-img" src={src} alt={alt} onClick={(event) => event.stopPropagation()} />
    </div>,
    document.body,
  )
}

function isQuestionShortcut(event: KeyboardEvent) {
  return event.key === '?' || (event.key === '/' && event.shiftKey)
}

export function ShortcutHelpModal({ groups, onClose }: { groups: ShortcutHelpGroup[]; onClose: () => void }) {
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || isQuestionShortcut(event)) {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [onClose])

  return (
    <div className="command-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="shortcut-help" role="dialog" aria-modal="true" aria-labelledby="shortcut-help-title">
        <header>
          <div>
            <p className="eyebrow">Giverny 快捷操作</p>
            <h2 id="shortcut-help-title">键盘快捷键</h2>
          </div>
          <button type="button" className="shortcut-close" aria-label="关闭快捷键列表" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="shortcut-groups">
          {groups.map((group) => (
            <section key={group.label}>
              <h3>{group.label}</h3>
              {group.items.map((item) => (
                <div className="shortcut-row" key={`${group.label}-${item.keys}`}>
                  <span>{item.action}</span>
                  <kbd>{item.keys}</kbd>
                </div>
              ))}
            </section>
          ))}
        </div>
        <footer>在输入框和编辑区域内，单键快捷键会自动停用。</footer>
      </section>
    </div>
  )
}
