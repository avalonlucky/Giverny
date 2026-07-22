import { Download, ExternalLink, Eye, Pencil, Tag, Trash2 } from 'lucide-react'
import type { FileAsset } from '../types/domain'

export function FileContextMenu({
  menu,
  onClose,
  onPreview,
  onOpen,
  onDownload,
  onFocusName,
  onFocusTag,
  onDelete,
  canWrite,
  canDelete,
}: {
  menu: { x: number; y: number; file: FileAsset }
  onClose: () => void
  onPreview: (file: FileAsset) => void
  onOpen: (file: FileAsset) => void
  onDownload: (file: FileAsset) => void
  onFocusName: (file: FileAsset) => void
  onFocusTag: (file: FileAsset) => void
  onDelete: (fileId: number) => void
  canWrite: boolean
  canDelete: boolean
}) {
  const run = (action: () => void) => {
    action()
    onClose()
  }

  return (
    <div className="task-context-menu file-context-menu" style={{ left: menu.x, top: menu.y }} role="menu">
      <button type="button" onClick={() => run(() => onPreview(menu.file))}>
        <Eye size={15} />
        预览
      </button>
      <button type="button" onClick={() => run(() => onOpen(menu.file))}>
        <ExternalLink size={15} />
        打开原文件
      </button>
      {canWrite && <button type="button" onClick={() => run(() => onFocusName(menu.file))}>
        <Pencil size={15} />
        重命名
      </button>}
      {canWrite && <button type="button" onClick={() => run(() => onFocusTag(menu.file))}>
        <Tag size={15} />
        添加标签
      </button>}
      <button type="button" onClick={() => run(() => onDownload(menu.file))}>
        <Download size={15} />
        下载源文件
      </button>
      {canDelete && <div className="context-menu-separator" />}
      {canDelete && <button type="button" className="danger" onClick={() => run(() => onDelete(menu.file.id))}>
        <Trash2 size={15} />
        删除
      </button>}
    </div>
  )
}
