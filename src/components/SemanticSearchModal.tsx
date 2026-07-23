import { useEffect, useState, type ReactNode } from 'react'
import { RotateCcw, Search, X } from 'lucide-react'
import { api } from '../lib/api'
import type { FileAsset, Task } from '../types/domain'

export default function SemanticSearchModal({
  isAdmin,
  files,
  tasks,
  onClose,
  onOpenTask,
  renderFileThumbnail,
}: {
  isAdmin: boolean
  files: FileAsset[]
  tasks: Task[]
  onClose: () => void
  onOpenTask: (taskId: number) => void
  renderFileThumbnail: (file: FileAsset) => ReactNode
}) {
  const acceptedTaskIds = new Set(tasks.filter((task) => task.status === '已验收').map((task) => task.id))
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ taskId: number; score: number; title: string; month: string; type: string }>>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [note, setNote] = useState('')
  const [reindexing, setReindexing] = useState(false)

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [onClose])

  const runSearch = async () => {
    const q = query.trim()
    if (!q || loading) return
    setLoading(true)
    setNote('')
    setSearched(true)
    try {
      const response = await api.searchTasks(q)
      setResults(response.results)
    } catch (error) {
      setNote(error instanceof Error ? error.message : '搜索失败')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const runReindex = async () => {
    if (reindexing) return
    setReindexing(true)
    setNote('正在重建索引…')
    try {
      const response = await api.reindexSearch()
      setNote(`已重建索引：${response.indexed} / ${response.total} 条任务（约 1 分钟后生效）`)
    } catch (error) {
      setNote(error instanceof Error ? error.message : '重建索引失败')
    } finally {
      setReindexing(false)
    }
  }

  return (
    <div className="command-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="semantic-search" role="dialog" aria-modal="true" aria-labelledby="semantic-search-title">
        <header>
          <div>
            <p className="eyebrow">语义搜索</p>
            <h2 id="semantic-search-title">按意思找回历史任务</h2>
          </div>
          <button type="button" className="shortcut-close" aria-label="关闭" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="semantic-search-input">
          <Search size={16} />
          <input
            autoFocus
            value={query}
            placeholder="例如：之前那张邀请函长图 / 官网 banner / 文化墙矢量图"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void runSearch()
            }}
          />
          <button className="soft-primary-button" type="button" onClick={() => void runSearch()} disabled={loading || !query.trim()}>
            {loading ? '搜索中…' : '搜索'}
          </button>
        </div>
        {note && <p className="semantic-search-note">{note}</p>}
        <div className="semantic-search-results">
          {searched && !loading && results.length === 0 && !note && (
            <p className="calendar-empty-hint">没有找到相关任务。如果是刚新建的任务，可点下方「重建索引」后再搜。</p>
          )}
          {results.map((item) => {
            const libraryFiles = files.filter(
              (file) => file.taskId === item.taskId && !file.deletedAt && file.scope === 'acceptance' && acceptedTaskIds.has(item.taskId),
            )
            return (
              <div className="semantic-search-result" key={item.taskId}>
                <button type="button" className="semantic-search-result-main" onClick={() => onOpenTask(item.taskId)}>
                  <div>
                    <strong>{item.title || '未命名任务'}</strong>
                    <span>{item.type || '未分类'}{item.month ? ` · ${item.month}` : ''}</span>
                  </div>
                  <em>{Math.round(item.score * 100)}%</em>
                </button>
                {libraryFiles.length > 0 && (
                  <div className="semantic-search-result-files">
                    <span className="semantic-search-files-label">文件库</span>
                    <div className="semantic-search-files-row">
                      {libraryFiles.map((file) => <span key={file.id}>{renderFileThumbnail(file)}</span>)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <footer className="semantic-search-footer">
          <span>按语义匹配，非关键词；中英文均可。</span>
          {isAdmin && (
            <button type="button" className="ghost-button compact-button" onClick={() => void runReindex()} disabled={reindexing}>
              <RotateCcw size={14} />
              {reindexing ? '重建中…' : '重建索引'}
            </button>
          )}
        </footer>
      </section>
    </div>
  )
}
