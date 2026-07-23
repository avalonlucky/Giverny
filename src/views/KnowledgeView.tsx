import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Heart, Pencil, Trash2 } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'

type KnowledgeNote = {
  id: string
  title: string
  content: string
  tags: string
  created_at: string
  source?: string
}

export default function KnowledgeView() {
  const [notes, setNotes] = useState<KnowledgeNote[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'user' | 'ai-tip'>('user')

  const authHeaders = useCallback((): Record<string, string> => ({ 'content-type': 'application/json' }), [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/knowledge', { headers: authHeaders() })
      if (response.ok) setNotes((await response.json()) as KnowledgeNote[])
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch('/api/knowledge', { headers: authHeaders() })
        if (response.ok) {
          const items = (await response.json()) as KnowledgeNote[]
          if (!cancelled) setNotes(items)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authHeaders])

  const reset = () => {
    setTitle('')
    setContent('')
    setTags('')
    setEditId(null)
  }

  const save = async () => {
    if (!content.trim() || saving) return
    setSaving(true)
    try {
      const body: Record<string, string> = { title: title.trim(), content: content.trim(), tags: tags.trim() }
      if (editId) body.id = editId
      const response = await fetch('/api/knowledge', { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) })
      if (response.ok) {
        reset()
        await load()
      }
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (note: KnowledgeNote) => {
    setEditId(note.id)
    setTitle(note.title)
    setContent(note.content)
    setTags(note.tags)
    setActiveTab('user')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const remove = async (id: string) => {
    await fetch(`/api/knowledge/${id}`, { method: 'DELETE', headers: authHeaders() })
    setNotes((current) => current.filter((note) => note.id !== id))
    if (editId === id) reset()
  }

  const userNotes = notes.filter((note) => !note.source || note.source === 'user')
  const aiTipNotes = notes.filter((note) => note.source === 'ai-tip')

  return (
    <div className="knowledge-page">
      {activeTab === 'user' && (
        <div className="knowledge-page-form">
          <h2 className="knowledge-page-title">{editId ? '编辑笔记' : '添加笔记'}</h2>
          <input className="knowledge-input" placeholder="标题（可选）" value={title} onChange={(event) => setTitle(event.target.value)} />
          <textarea
            className="knowledge-textarea"
            placeholder="写下你的知识、定价逻辑、合作伙伴沟通方式、行业笔记… AI 对话时会自动参考"
            value={content}
            rows={6}
            onChange={(event) => setContent(event.target.value)}
          />
          <div className="knowledge-add-footer">
            <input className="knowledge-input knowledge-tags" placeholder="标签（逗号分隔，可选）" value={tags} onChange={(event) => setTags(event.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
              {editId && <button type="button" className="knowledge-cancel-btn" onClick={reset}>取消</button>}
              <button type="button" className="knowledge-save-btn" disabled={!content.trim() || saving} onClick={() => void save()}>
                {saving ? '保存中…' : editId ? '保存修改' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="knowledge-page-list">
        <div className="settings-tabs view-mode-tabs knowledge-source-tabs">
          <button type="button" className={activeTab === 'user' ? 'active' : ''} onClick={() => setActiveTab('user')}>
            <BookOpen size={14} />
            我的笔记
            {userNotes.length > 0 && <span className="knowledge-tab-count">{userNotes.length}</span>}
          </button>
          <button type="button" className={activeTab === 'ai-tip' ? 'active' : ''} onClick={() => setActiveTab('ai-tip')}>
            <Heart size={14} />
            AI 收藏
            {aiTipNotes.length > 0 && <span className="knowledge-tab-count">{aiTipNotes.length}</span>}
          </button>
        </div>

        {loading && <p className="knowledge-empty">加载中…</p>}
        {!loading && activeTab === 'user' && userNotes.length === 0 && (
          <EmptyState
            title="还没有笔记"
            description="写下定价逻辑、合作伙伴沟通方式、行业心得，AI 工作助手对话时会自动参考这里的内容。"
          />
        )}
        {!loading && activeTab === 'ai-tip' && aiTipNotes.length === 0 && (
          <EmptyState title="还没有收藏" description="在工作台的每日小知识里点击收藏，感兴趣的内容会收进这里。" />
        )}
        {(activeTab === 'user' ? userNotes : aiTipNotes).map((note) => (
          <div key={note.id} className={`knowledge-item ${note.source === 'ai-tip' ? 'knowledge-item-ai-tip' : ''}`}>
            <div className="knowledge-item-header">
              <span className="knowledge-item-title">{note.title || '无标题'}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {note.source !== 'ai-tip' && (
                  <button type="button" className="knowledge-item-delete" onClick={() => startEdit(note)} aria-label="编辑" title="编辑">
                    <Pencil size={13} />
                  </button>
                )}
                <button type="button" className="knowledge-item-delete" onClick={() => void remove(note.id)} aria-label="删除" title="删除">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            {note.tags && <div className="knowledge-item-tags">{note.tags}</div>}
            <p className="knowledge-item-content">{note.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
