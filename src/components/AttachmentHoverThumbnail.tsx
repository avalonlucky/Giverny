import { createPortal } from 'react-dom'
import { FileText } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { OfficePreview } from './FilePreviewReaders'
import { PsdThumbnail } from './FileThumbnailPreview'
import { inferFileType } from '../lib/fileTypes'
import { PDF_PREVIEW_TIMEOUT_MS, withPreviewTimeout } from '../lib/previewTimeout'
import { createPdfPreviewFile } from '../lib/pdfPreview'

export function AttachmentHoverThumbnail({
  name,
  type,
  previewUrl,
  previewFallback = false,
  sourceUrl,
  sourceFile,
  compact = false,
  onOpen,
}: {
  name: string
  type?: string
  previewUrl?: string
  previewFallback?: boolean
  sourceUrl?: string
  sourceFile?: File
  compact?: boolean
  onOpen?: () => void
}) {
  const [hoverPreview, setHoverPreview] = useState<{ style: CSSProperties; fieldPlacement: boolean } | null>(null)
  const [generatedPdfPreview, setGeneratedPdfPreview] = useState<{
    source: string
    status: 'ready' | 'failed'
    url?: string
  } | null>(null)
  const inferred = inferFileType({ name, type })
  const extension = inferred.type
  const hasUsablePreview = Boolean(previewUrl && !previewFallback)
  const pdfSourceUrl = !hasUsablePreview && (inferred.kind === 'pdf' || inferred.kind === 'ai') ? sourceUrl : ''
  const pdfSourceFile = !hasUsablePreview && (inferred.kind === 'pdf' || inferred.kind === 'ai') ? sourceFile : undefined
  const pdfSourceKey = pdfSourceFile
    ? `file:${pdfSourceFile.name}:${pdfSourceFile.size}:${pdfSourceFile.lastModified}`
    : pdfSourceUrl
  const psdSourceUrl = !hasUsablePreview && inferred.kind === 'psd' ? sourceUrl : ''
  const officeSourceUrl = !hasUsablePreview && inferred.kind === 'office' ? sourceUrl : ''
  const videoSourceUrl = !hasUsablePreview && inferred.kind === 'video' ? sourceUrl : ''
  const currentPdfPreview = generatedPdfPreview?.source === pdfSourceKey ? generatedPdfPreview : null
  const effectivePreviewUrl = hasUsablePreview ? previewUrl : (currentPdfPreview?.status === 'ready' ? currentPdfPreview.url ?? '' : '')
  const pdfPreviewFailed = currentPdfPreview?.status === 'failed'

  useEffect(() => {
    if ((!pdfSourceUrl && !pdfSourceFile) || hasUsablePreview || !pdfSourceKey) {
      return
    }
    let cancelled = false
    let objectUrl = ''
    const generatePreview = async () => {
      try {
        let source = pdfSourceFile
        if (!source) {
          const remoteSourceUrl = pdfSourceUrl
          if (!remoteSourceUrl) {
            throw new Error('PDF 来源不可用')
          }
          const controller = new AbortController()
          const response = await withPreviewTimeout(
            fetch(remoteSourceUrl, { credentials: 'same-origin', signal: controller.signal }),
            PDF_PREVIEW_TIMEOUT_MS,
            'PDF 读取超时',
          ).catch((error) => {
            controller.abort()
            throw error
          })
          if (!response.ok) {
            throw new Error('PDF 读取失败')
          }
          source = new File([await response.blob()], name, { type: 'application/pdf' })
        }
        const generated = await withPreviewTimeout(createPdfPreviewFile(source), PDF_PREVIEW_TIMEOUT_MS, 'PDF 首页渲染超时')
        if (cancelled) {
          return
        }
        objectUrl = URL.createObjectURL(generated)
        setGeneratedPdfPreview({ source: pdfSourceKey, status: 'ready', url: objectUrl })
      } catch (error) {
        console.warn('PDF shared thumbnail generation failed', name, error)
        if (!cancelled) {
          setGeneratedPdfPreview({ source: pdfSourceKey, status: 'failed' })
        }
      }
    }
    void generatePreview()
    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [hasUsablePreview, name, pdfSourceFile, pdfSourceKey, pdfSourceUrl])

  const media = effectivePreviewUrl
    ? <img src={effectivePreviewUrl} alt="" loading="lazy" />
    : pdfSourceUrl
      ? <span className="attachment-hover-thumb-ext">PDF</span>
      : psdSourceUrl
        ? <PsdThumbnail sourceUrl={psdSourceUrl} label={name} />
        : officeSourceUrl
          ? <OfficePreview fileType={extension} sourceUrl={officeSourceUrl} compact />
          : videoSourceUrl
            ? <video src={videoSourceUrl} muted playsInline preload="metadata" />
            : <span className="attachment-hover-thumb-ext">{extension}</span>
  const hoverMedia = effectivePreviewUrl
    ? <img src={effectivePreviewUrl} alt="" />
    : pdfSourceUrl
      ? <><FileText size={42} /><strong>PDF</strong><span>{pdfPreviewFailed ? '点击查看完整 PDF' : '正在生成首页预览'}</span></>
      : psdSourceUrl
        ? <PsdThumbnail sourceUrl={psdSourceUrl} label={name} />
        : officeSourceUrl
          ? <OfficePreview fileType={extension} sourceUrl={officeSourceUrl} compact />
          : videoSourceUrl
            ? <video src={videoSourceUrl} muted playsInline preload="metadata" />
            : <strong>{extension}</strong>
  const showPreview = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    const attachmentField = element.closest('.progress-attachment-field')?.getBoundingClientRect()
    if (attachmentField && attachmentField.width >= 560) {
      const width = Math.min(360, Math.max(280, attachmentField.width - 150))
      const height = Math.min(340, Math.max(260, attachmentField.bottom - rect.top - 10))
      setHoverPreview({
        fieldPlacement: true,
        style: {
          left: Math.min(rect.right + 24, attachmentField.right - width),
          top: Math.max(8, Math.min(rect.top - 12, window.innerHeight - height - 8)),
          width,
          height,
        },
      })
      return
    }
    const width = 220
    const height = 246
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8)
    const top = rect.top - height - 10 >= 8 ? rect.top - height - 10 : rect.bottom + 10
    setHoverPreview({ fieldPlacement: false, style: { left, top, width, height } })
  }

  return (
    <span
      className={`attachment-hover-thumb-wrap ${compact ? 'compact' : ''}`}
      onMouseEnter={(event) => showPreview(event.currentTarget)}
      onMouseLeave={() => setHoverPreview(null)}
    >
      <button
        type="button"
        className="attachment-hover-thumb"
        title={onOpen ? `预览 ${name}` : name}
        aria-label={onOpen ? `预览 ${name}` : name}
        onClick={onOpen}
      >
        {media}
      </button>
      {hoverPreview && createPortal(
        <span className={`attachment-hover-preview ${hoverPreview.fieldPlacement ? 'field-placement' : ''}`} style={hoverPreview.style} aria-hidden="true">
          <span className="attachment-hover-preview-media">
            {hoverMedia}
          </span>
          <span className="attachment-hover-preview-name">{name}</span>
        </span>,
        document.body,
      )}
    </span>
  )
}


