import { ExternalLink, FileArchive, FileText, X } from 'lucide-react'
import { authedPreviewUrl } from '../lib/api'
import {
  fileDocumentPreviewSource,
  fileTypeForAsset,
  isInlineDocumentFileType,
  isInlineImageFileType,
  isOfficeFileType,
  videoFileTypes,
} from '../lib/fileTypes'
import type { FileAsset } from '../types/domain'
import { ImagePreviewReader, OfficePreview, PdfPreviewReader } from './FilePreviewReaders'
import { ModalShell } from './ModalShell'

export function FilePreviewModal({ file, onClose }: { file: FileAsset; onClose: () => void }) {
  const fileType = fileTypeForAsset(file).type
  const sourceUrl = fileDocumentPreviewSource(file)
  const previewUrl = authedPreviewUrl(file.previewUrl ?? file.sourceUrl)
  const isImage = isInlineImageFileType(fileType)
  const isRasterPreview = Boolean(file.previewUrl) && !file.previewFallback && ['PSD', 'AI'].includes(fileType)
  const isPdfLike = isInlineDocumentFileType(fileType)
  const isVideo = videoFileTypes.has(fileType)
  const isOffice = isOfficeFileType(fileType)

  return (
    <ModalShell className="file-preview-modal" labelledBy="file-preview-title" onClose={onClose}>
      <header className="modal-header">
        <div>
          <p className="eyebrow">文件预览</p>
          <h2 id="file-preview-title">{file.name}</h2>
        </div>
        <div className="modal-header-actions">
          {sourceUrl && (
            <a className="icon-button" href={sourceUrl} target="_blank" rel="noreferrer" aria-label="在新窗口打开" title="在新窗口打开">
              <ExternalLink size={17} />
            </a>
          )}
          <button className="icon-button modal-close-button" aria-label="关闭" title="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </header>
      <div className="file-preview-body">
        {(isImage || isRasterPreview) && previewUrl ? (
          <ImagePreviewReader src={previewUrl} fallbackSrc={isImage ? sourceUrl : undefined} alt={file.name} />
        ) : isVideo && sourceUrl ? (
          <video className="file-preview-video" src={sourceUrl} controls preload="metadata" />
        ) : isPdfLike && sourceUrl ? (
          <PdfPreviewReader sourceUrl={sourceUrl} label={file.name} />
        ) : isOffice && sourceUrl ? (
          <OfficePreview fileType={fileType} sourceUrl={sourceUrl} />
        ) : (
          <div className="file-preview-placeholder">
            {fileType === 'PDF' ? <FileText size={42} /> : <FileArchive size={42} />}
            <strong>{file.type}</strong>
            <span>该格式无法在浏览器中稳定直接预览，可以在新窗口打开源文件查看或下载。</span>
            {sourceUrl && (
              <a className="primary-button compact-button" href={sourceUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={15} />
                打开源文件
              </a>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  )
}
