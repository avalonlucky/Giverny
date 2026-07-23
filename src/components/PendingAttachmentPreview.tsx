import { memo, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, FileArchive, X } from 'lucide-react'
import { AttachmentHoverThumbnail } from './AttachmentHoverThumbnail'
import { ImagePreviewReader, OfficePreview, PdfPreviewReader } from './FilePreviewReaders'
import { ModalShell } from './ModalShell'
import { fileTypeForFile, isInlineImageFileType, isOfficeFileType, videoFileTypes } from '../lib/fileTypes'
import type { PendingProgressAttachment } from '../types/taskUi'

export const PendingAttachmentThumbnail = memo(function PendingAttachmentThumbnail({
  attachment,
  onOpen,
  ensurePreview,
}: {
  attachment: PendingProgressAttachment
  onOpen: () => void
  ensurePreview: (attachment: PendingProgressAttachment) => Promise<File | undefined>
}) {
  const inferred = fileTypeForFile(attachment.file)
  const isImage = inferred.kind === 'image'
  const canUseSourceFallback = ['pdf', 'ai', 'psd', 'office', 'video'].includes(inferred.kind)
  const sourcePreviewUrl = useMemo(() => canUseSourceFallback ? URL.createObjectURL(attachment.file) : undefined, [attachment.file, canUseSourceFallback])
  const [thumbnailUrl, setThumbnailUrl] = useState('')

  useEffect(() => {
    if (!isImage) return
    let active = true
    let objectUrl = ''
    void ensurePreview(attachment).then((preview) => {
      if (!active || !preview) return
      objectUrl = URL.createObjectURL(preview)
      setThumbnailUrl(objectUrl)
    })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachment, ensurePreview, isImage])

  useEffect(() => () => {
    if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl)
  }, [sourcePreviewUrl])

  return <AttachmentHoverThumbnail name={attachment.name} type={inferred.type} previewUrl={isImage ? thumbnailUrl : undefined} sourceUrl={sourcePreviewUrl} sourceFile={isImage ? undefined : attachment.file} onOpen={onOpen} />
}, (previous, next) => (
  previous.attachment.file === next.attachment.file
  && previous.attachment.name === next.attachment.name
  && previous.ensurePreview === next.ensurePreview
))

export function PendingAttachmentPreview({ attachment, onClose }: { attachment: PendingProgressAttachment; onClose: () => void }) {
  const sourceUrl = useMemo(() => URL.createObjectURL(attachment.file), [attachment.file])
  const fileType = fileTypeForFile(attachment.file).type
  const isImage = isInlineImageFileType(fileType)
  const isPdf = fileType === 'PDF'
  const isVideo = videoFileTypes.has(fileType)
  const isOffice = isOfficeFileType(fileType)
  useEffect(() => () => URL.revokeObjectURL(sourceUrl), [sourceUrl])

  return createPortal(
    <ModalShell className="file-preview-modal pending-attachment-preview-modal" labelledBy="pending-attachment-preview-title" onClose={onClose} closeOnEscape>
      <header className="modal-header">
        <div><p className="eyebrow">进展附件预览</p><h2 id="pending-attachment-preview-title">{attachment.name}</h2></div>
        <div className="modal-header-actions">
          {(isPdf || isImage || isVideo) && <a className="icon-button" href={sourceUrl} target="_blank" rel="noreferrer" aria-label="在新窗口打开" title="在新窗口打开"><ExternalLink size={17} /></a>}
          <button className="icon-button modal-close-button" type="button" aria-label="关闭" title="关闭" onClick={onClose}><X size={18} /></button>
        </div>
      </header>
      <div className="file-preview-body">
        {isImage ? <ImagePreviewReader src={sourceUrl} alt={attachment.name} />
          : isPdf ? <PdfPreviewReader sourceUrl={sourceUrl} sourceFile={attachment.file} label={attachment.name} />
            : isVideo ? <video className="file-preview-video" src={sourceUrl} controls preload="metadata" />
              : isOffice ? <OfficePreview fileType={fileType} sourceUrl={sourceUrl} />
                : <div className="file-preview-placeholder"><FileArchive size={42} /><strong>{fileType}</strong><span>该格式暂不支持站内完整预览，保存进展后仍可从文件记录打开源文件。</span></div>}
      </div>
    </ModalShell>,
    document.body,
  )
}
