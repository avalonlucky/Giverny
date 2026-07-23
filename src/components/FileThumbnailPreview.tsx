import { useEffect, useRef, useState } from 'react'
import { FileArchive, FileImage, FileText } from 'lucide-react'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { OfficePreview } from './FilePreviewReaders'
import { authedPreviewUrl } from '../lib/api'
import { fileDocumentPreviewSource, fileTypeForAsset, isInlineImageFileType, isOfficeFileType, videoFileTypes } from '../lib/fileTypes'
import { createPsdPreviewFile } from '../lib/psdPreview'
import { PDF_PREVIEW_TIMEOUT_MS, withPreviewTimeout } from '../lib/previewTimeout'
import type { FileAsset } from '../types/domain'

export function FileThumbnailPreview({ file, inspector = false }: { file: FileAsset; inspector?: boolean }) {
  const fileType = fileTypeForAsset(file).type
  const previewUrl = authedPreviewUrl(file.previewUrl)
  const sourceUrl = fileDocumentPreviewSource(file)

  if ((previewUrl && !file.previewFallback) || (isInlineImageFileType(fileType) && sourceUrl)) {
    return <img src={previewUrl ?? sourceUrl} alt={file.name} loading="lazy" />
  }

  if (['PDF', 'AI'].includes(fileType) && sourceUrl) {
    return <PdfThumbnail sourceUrl={sourceUrl} label={file.name} />
  }

  if (fileType === 'PSD' && sourceUrl) {
    return <PsdThumbnail sourceUrl={sourceUrl} label={file.name} />
  }

  if (isOfficeFileType(fileType) && sourceUrl) {
    return (
      <div className={`file-thumbnail-office ${inspector ? 'inspector' : ''}`}>
        <OfficePreview fileType={fileType} sourceUrl={sourceUrl} compact />
      </div>
    )
  }

  if (videoFileTypes.has(fileType) && sourceUrl) {
    return <video className="file-thumbnail-video" src={sourceUrl} muted playsInline preload="metadata" />
  }

  return (
    <div className={`file-thumb-placeholder ${inspector ? 'file-thumb-document-large' : ''}`}>
      {fileType === 'PDF' ? <FileText size={42} /> : <FileArchive size={42} />}
      <strong>{fileType}</strong>
      <span>暂时无法生成缩略图</span>
    </div>
  )
}

function PdfThumbnail({ sourceUrl, label }: { sourceUrl: string; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const renderFirstPage = async () => {
      try {
        setFailed(false)
        await withPreviewTimeout((async () => {
          const response = await fetch(sourceUrl, { credentials: 'same-origin', signal: controller.signal })
          if (!response.ok) {
            throw new Error('PDF 读取失败')
          }
          const data = await response.arrayBuffer()
          const pdfjs = await import('pdfjs-dist')
          pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
          const document = await pdfjs.getDocument({ data }).promise
          const page = await document.getPage(1)
          const baseViewport = page.getViewport({ scale: 1 })
          const targetWidth = 720
          const viewport = page.getViewport({ scale: targetWidth / baseViewport.width })
          const canvas = canvasRef.current
          if (!canvas || cancelled) {
            return
          }
          const context = canvas.getContext('2d')
          if (!context) {
            throw new Error('Canvas 不可用')
          }
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          await page.render({ canvasContext: context, viewport }).promise
        })(), PDF_PREVIEW_TIMEOUT_MS, 'PDF 首页渲染超时')
      } catch (error) {
        controller.abort()
        console.warn('PDF thumbnail generation failed', error)
        if (!cancelled) {
          setFailed(true)
        }
      }
    }
    void renderFirstPage()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [sourceUrl])

  if (failed) {
    return (
      <div className="file-thumb-placeholder">
        <FileText size={42} />
        <strong>PDF</strong>
        <span>PDF 可正常打开，暂无首页预览</span>
      </div>
    )
  }

  return <canvas ref={canvasRef} className="file-thumbnail-canvas" aria-label={`${label} 第一页缩略图`} />
}

export function PsdThumbnail({ sourceUrl, label }: { sourceUrl: string; label: string }) {
  const [previewUrl, setPreviewUrl] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''
    const renderPsd = async () => {
      try {
        const response = await fetch(sourceUrl)
        if (!response.ok) {
          throw new Error('PSD 读取失败')
        }
        const source = new File([await response.blob()], label, { type: 'image/vnd.adobe.photoshop' })
        const preview = await createPsdPreviewFile(source)
        if (!preview || cancelled) {
          throw new Error('PSD 无合成预览')
        }
        objectUrl = URL.createObjectURL(preview)
        setPreviewUrl(objectUrl)
      } catch (error) {
        console.warn('PSD thumbnail generation failed', error)
        if (!cancelled) {
          setFailed(true)
        }
      }
    }
    void renderPsd()
    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [label, sourceUrl])

  if (previewUrl) {
    return <img src={previewUrl} alt={label} loading="lazy" />
  }

  return (
    <div className="file-thumb-placeholder">
      <FileImage size={42} />
      <strong>PSD</strong>
      <span>{failed ? '缩略图生成失败' : '正在生成缩略图'}</span>
    </div>
  )
}


