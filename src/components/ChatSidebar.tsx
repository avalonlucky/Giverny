import { useMemo, useState } from 'react'
import { Plus, Search, Settings, Trash2, X } from 'lucide-react'
import type { ConversationRecord } from '../lib/conversationCache'
import { EmptyState } from './EmptyState'

type ChatSidebarProps = {
  history: ConversationRecord[]
  activeConversationId: string
  onSelect: (record: ConversationRecord) => void
  onNew: () => void
  onDelete: (id: string) => void
  onOpenSettings: () => void
  onClose: () => void
}

function groupByTime(records: ConversationRecord[]): Array<{ label: string; items: ConversationRecord[] }> {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86_400_000
  const weekStart = todayStart - 7 * 86_400_000

  const today: ConversationRecord[] = []
  const yesterday: ConversationRecord[] = []
  const earlier: ConversationRecord[] = []

  for (const record of records) {
    if (record.savedAt >= todayStart) today.push(record)
    else if (record.savedAt >= yesterdayStart) yesterday.push(record)
    else earlier.push(record)
  }

  const groups: Array<{ label: string; items: ConversationRecord[] }> = []
  if (today.length > 0) groups.push({ label: '今天', items: today })
  if (yesterday.length > 0) groups.push({ label: '昨天', items: yesterday })
  if (earlier.length > 0) groups.push({ label: weekStart <= (earlier[0]?.savedAt ?? 0) ? '最近 7 天' : '更早', items: earlier })
  return groups
}

export function ChatSidebar({ history, activeConversationId, onSelect, onNew, onDelete, onOpenSettings, onClose }: ChatSidebarProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const sorted = [...history].sort((a, b) => b.savedAt - a.savedAt)
    if (!keyword) return sorted
    return sorted.filter((record) => record.title.toLowerCase().includes(keyword))
  }, [history, search])

  const groups = useMemo(() => groupByTime(filtered), [filtered])

  return (
    <aside className="chat-sidebar">
      <div className="chat-sidebar-top">
        <button type="button" className="chat-sidebar-new-btn" onClick={onNew}>
          <Plus size={16} />
          <span>新对话</span>
        </button>
        <button type="button" className="chat-sidebar-collapse-btn" onClick={onClose} title="收起侧栏">
          <X size={15} />
        </button>
      </div>

      <div className="chat-sidebar-search">
        <Search size={14} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索对话…"
          aria-label="搜索对话"
        />
      </div>

      <nav className="chat-sidebar-list" aria-label="对话历史">
        {groups.length === 0 && (
          <EmptyState variant="compact" title="暂无对话记录" />
        )}
        {groups.map((group) => (
          <div key={group.label} className="chat-sidebar-group">
            <span className="chat-sidebar-group-label">{group.label}</span>
            {group.items.map((record) => (
              <div
                key={record.id}
                className={`chat-sidebar-item ${record.id === activeConversationId || record.agentConversationId === activeConversationId ? 'active' : ''}`}
                onClick={() => onSelect(record)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelect(record)}
              >
                <span className="chat-sidebar-item-title">{record.title}</span>
                <button
                  type="button"
                  className="chat-sidebar-item-del"
                  onClick={(e) => { e.stopPropagation(); onDelete(record.id) }}
                  title="删除"
                  aria-label={`删除：${record.title}`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div className="chat-sidebar-footer">
        <button type="button" className="chat-sidebar-settings-btn" onClick={onOpenSettings}>
          <Settings size={15} />
          <span>设置</span>
        </button>
      </div>
    </aside>
  )
}
