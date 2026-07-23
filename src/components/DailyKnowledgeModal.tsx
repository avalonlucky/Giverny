import { Fragment, useState } from 'react'
import { Star, X } from 'lucide-react'
import type { DailyKnowledgeItem } from '../types/knowledge'
import { ModalShell } from './ModalShell'

function renderKnowledgeParagraph(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
    }
    return <Fragment key={`${part}-${index}`}>{part}</Fragment>
  })
}

type DailyKnowledgeModalProps = {
  item: DailyKnowledgeItem
  isLoading: boolean
  canRefresh: boolean
  onRefresh: () => void
  onClose: () => void
  onFavorite?: (item: DailyKnowledgeItem) => Promise<boolean>
}

export function DailyKnowledgeModal({
  item,
  isLoading,
  canRefresh,
  onRefresh,
  onClose,
  onFavorite,
}: DailyKnowledgeModalProps) {
  const sourceLabel = item.source.startsWith('AI · ') ? `AI 生成（${item.source.replace('AI · ', '')}）` : item.source
  const [favorited, setFavorited] = useState(false)
  const [favoriteSaving, setFavoriteSaving] = useState(false)

  const handleFavorite = async () => {
    if (!onFavorite || favoriteSaving || favorited) return
    setFavoriteSaving(true)
    try {
      const ok = await onFavorite(item)
      if (ok) setFavorited(true)
    } finally {
      setFavoriteSaving(false)
    }
  }

  return (
    <ModalShell className="daily-knowledge-modal" labelledBy="daily-knowledge-title" onClose={onClose}>
      <header className="daily-knowledge-modal-header">
        <div>
          <h2 id="daily-knowledge-title">{item.title}</h2>
          <p>{item.category} · {sourceLabel}</p>
        </div>
        <button className="icon-button daily-knowledge-close-btn" type="button" aria-label="关闭" onClick={onClose}>
          <X size={16} />
        </button>
      </header>
      <div className="daily-knowledge-article">
        {item.body.map((paragraph, index) => (
          <p key={`${item.title}-${index}`}>{renderKnowledgeParagraph(paragraph)}</p>
        ))}
      </div>
      <footer className="daily-knowledge-modal-footer">
        {onFavorite && (
          <button
            className={`daily-knowledge-favorite-btn ${favorited ? 'favorited' : ''}`}
            type="button"
            disabled={favoriteSaving || favorited}
            onClick={() => void handleFavorite()}
            title={favorited ? '已收藏到知识库' : '收藏到知识库'}
            aria-label={favorited ? '已收藏' : '收藏'}
          >
            <Star size={15} fill={favorited ? 'currentColor' : 'none'} />
          </button>
        )}
        {canRefresh && (
          <button className="daily-knowledge-primary" type="button" disabled={isLoading} onClick={onRefresh}>
            {isLoading ? '生成中' : '换一篇'}
          </button>
        )}
      </footer>
    </ModalShell>
  )
}
