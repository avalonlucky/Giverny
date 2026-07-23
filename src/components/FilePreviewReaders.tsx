import { type WheelEvent as ReactWheelEvent, useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, FileImage, FileText, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

type PdfPreviewDocument = {
  numPages: number
  getPage: (pageNumber: number) => Promise<{
    getViewport: (options: { scale: number }) => { width: number; height: number }
    render: (options: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => {
      promise: Promise<void>
      cancel: () => void
    }
  }>
  destroy: () => Promise<void>
}

export function PdfPreviewReader({
  sourceUrl,
  sourceFile,
  label,
}: {
  sourceUrl: string
  sourceFile?: File
  label: string
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const documentRef = useRef<PdfPreviewDocument | null>(null)
  const renderTasksRef = useRef<Array<{ cancel: () => void }>>([])
  const [pageCount, setPageCount] = useState(0)
  const [renderedPages, setRenderedPages] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [scale, setScale] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return undefined
    const updateWidth = () => setViewportWidth(viewport.clientWidth)
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    let loadingTask: { promise: Promise<unknown>; destroy?: () => Promise<void> } | null = null
    const load = async () => {
      try {
        setError('')
        setPageCount(0)
        setRenderedPages(0)
        const data = sourceFile
          ? await sourceFile.arrayBuffer()
          : await fetch(sourceUrl, { credentials: 'same-origin' }).then((response) => {
              if (!response.ok) throw new Error(`PDF 读取失败（${response.status}）`)
              return response.arrayBuffer()
            })
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
        loadingTask = pdfjs.getDocument({ data }) as unknown as typeof loadingTask
        const document = await loadingTask!.promise as PdfPreviewDocument
        if (cancelled) {
          await document.destroy()
          return
        }
        documentRef.current = document
        setPageCount(document.numPages)
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : 'PDF 阅读器加载失败')
        }
      }
    }
    void load()
    return () => {
      cancelled = true
      renderTasksRef.current.forEach((task) => task.cancel())
      renderTasksRef.current = []
      const document = documentRef.current
      documentRef.current = null
      if (document) void document.destroy().catch(() => {})
      else if (loadingTask?.destroy) void loadingTask.destroy().catch(() => {})
    }
  }, [sourceFile, sourceUrl])

  useEffect(() => {
    const pdfDocument = documentRef.current
    if (!pdfDocument || pageCount === 0 || viewportWidth <= 0) return undefined
    let cancelled = false
    renderTasksRef.current.forEach((task) => task.cancel())
    renderTasksRef.current = []
    setRenderedPages(0)
    const renderPages = async () => {
      try {
        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
          if (cancelled) return
          const page = await pdfDocument.getPage(pageNumber)
          const baseViewport = page.getViewport({ scale: 1 })
          const displayScale = Math.max(0.02, ((viewportWidth - 32) / baseViewport.width) * scale)
          const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75)
          const renderViewport = page.getViewport({ scale: displayScale * pixelRatio })
          const canvas = viewportRef.current?.querySelector<HTMLCanvasElement>(`canvas[data-pdf-page="${pageNumber}"]`)
          const context = canvas?.getContext('2d')
          if (!canvas || !context) return
          canvas.width = Math.max(1, Math.ceil(renderViewport.width))
          canvas.height = Math.max(1, Math.ceil(renderViewport.height))
          canvas.style.width = `${Math.max(1, Math.ceil(renderViewport.width / pixelRatio))}px`
          canvas.style.height = `${Math.max(1, Math.ceil(renderViewport.height / pixelRatio))}px`
          context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-surface-strong').trim() || 'white'
          context.fillRect(0, 0, canvas.width, canvas.height)
          const renderTask = page.render({ canvasContext: context, viewport: renderViewport })
          renderTasksRef.current.push(renderTask)
          await renderTask.promise
          if (!cancelled) setRenderedPages(pageNumber)
        }
      } catch (caughtError) {
        if (!cancelled && !(caughtError instanceof Error && caughtError.name === 'RenderingCancelledException')) {
          setError(caughtError instanceof Error ? caughtError.message : 'PDF 页面渲染失败')
        }
      }
    }
    void renderPages()
    return () => {
      cancelled = true
      renderTasksRef.current.forEach((task) => task.cancel())
      renderTasksRef.current = []
    }
  }, [pageCount, scale, viewportWidth])

  const changeScale = (delta: number) => setScale((current) => Math.min(2.5, Math.max(0.5, current + delta)))

  return (
    <div className="pdf-preview-reader">
      <div className="image-preview-toolbar" aria-label="PDF 缩放工具">
        <button type="button" className="icon-button" onClick={() => changeScale(-0.25)} disabled={scale <= 0.5} aria-label="缩小 PDF" title="缩小">
          <ZoomOut size={16} />
        </button>
        <button type="button" className="image-preview-scale" onClick={() => setScale(1)} aria-label="恢复 PDF 适合宽度" title="适合宽度">
          {Math.round(scale * 100)}%
        </button>
        <button type="button" className="icon-button" onClick={() => changeScale(0.25)} disabled={scale >= 2.5} aria-label="放大 PDF" title="放大">
          <ZoomIn size={16} />
        </button>
        <span className="image-preview-toolbar-divider" />
        <span className="pdf-preview-page-status">
          {pageCount > 0 ? `${Math.max(renderedPages, 1)} / ${pageCount} 页` : '正在读取 PDF'}
        </span>
      </div>
      <div ref={viewportRef} className="pdf-preview-viewport" aria-label={`${label} PDF 内容`}>
        {error ? (
          <div className="file-preview-placeholder pdf-native-fallback">
            <FileText size={42} />
            <strong>PDF</strong>
            <span>站内阅读器未能解析这份文件，已切换到浏览器原生阅读器。</span>
            <iframe className="pdf-native-preview" src={sourceUrl} title={`${label} 浏览器原生预览`} />
            <a className="ghost-button compact-button" href={sourceUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={15} />
              在新窗口打开
            </a>
          </div>
        ) : (
          <div className="pdf-preview-pages">
            {Array.from({ length: pageCount }, (_, index) => (
              <canvas data-pdf-page={index + 1} aria-label={`第 ${index + 1} 页`} key={index + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const IMAGE_PREVIEW_MIN_SCALE = 0.25
const IMAGE_PREVIEW_MAX_SCALE = 3
const IMAGE_PREVIEW_SCALE_STEP = 0.25

export function ImagePreviewReader({ src, fallbackSrc, alt }: { src: string; fallbackSrc?: string; alt: string }) {
  const [mode, setMode] = useState<'fit' | 'zoom'>('fit')
  const [scale, setScale] = useState(1)
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const [activeSrc, setActiveSrc] = useState(src)
  const [loadFailed, setLoadFailed] = useState(false)
  const viewportRef = useRef<HTMLDivElement | null>(null)

  const resetViewport = useCallback(() => {
    window.requestAnimationFrame(() => {
      const viewport = viewportRef.current
      if (!viewport) return
      viewport.scrollTo({ top: 0, left: 0 })
    })
  }, [])

  const showFit = () => {
    setMode('fit')
    resetViewport()
  }

  const showActualSize = () => {
    setMode('zoom')
    setScale(1)
    resetViewport()
  }

  const changeScale = (delta: number) => {
    setMode('zoom')
    setScale((current) => Math.min(IMAGE_PREVIEW_MAX_SCALE, Math.max(IMAGE_PREVIEW_MIN_SCALE, current + delta)))
  }

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.metaKey && !event.ctrlKey) return
    event.preventDefault()
    changeScale(event.deltaY < 0 ? IMAGE_PREVIEW_SCALE_STEP : -IMAGE_PREVIEW_SCALE_STEP)
  }

  const imageStyle = mode === 'fit'
    ? undefined
    : {
        width: naturalSize.width ? `${naturalSize.width * scale}px` : `${scale * 100}%`,
        height: naturalSize.height ? `${naturalSize.height * scale}px` : 'auto',
      }

  return (
    <div className="image-preview-reader">
      <div className="image-preview-toolbar" aria-label="图片缩放工具">
        <button type="button" className="icon-button" onClick={() => changeScale(-IMAGE_PREVIEW_SCALE_STEP)} disabled={mode === 'zoom' && scale <= IMAGE_PREVIEW_MIN_SCALE} aria-label="缩小" title="缩小">
          <ZoomOut size={16} />
        </button>
        <button type="button" className="image-preview-scale" onClick={showActualSize} aria-label="按原始尺寸查看" title="按原始尺寸查看">
          {mode === 'fit' ? '适合窗口' : `${Math.round(scale * 100)}%`}
        </button>
        <button type="button" className="icon-button" onClick={() => changeScale(IMAGE_PREVIEW_SCALE_STEP)} disabled={mode === 'zoom' && scale >= IMAGE_PREVIEW_MAX_SCALE} aria-label="放大" title="放大">
          <ZoomIn size={16} />
        </button>
        <span className="image-preview-toolbar-divider" />
        <button type="button" className={`ghost-button compact-button ${mode === 'fit' ? 'is-active' : ''}`} onClick={showFit}>
          <Maximize2 size={14} />
          适合窗口
        </button>
        <button type="button" className={`ghost-button compact-button ${mode === 'zoom' && scale === 1 ? 'is-active' : ''}`} onClick={showActualSize}>
          1:1
        </button>
      </div>
      <div
        ref={viewportRef}
        className={`image-preview-viewport mode-${mode}`}
        onWheel={handleWheel}
        title="按住 Command 或 Ctrl 滚动可缩放"
      >
        {loadFailed ? (
          <div className="file-preview-placeholder">
            <FileImage size={42} />
            <strong>图片读取失败</strong>
            <span>预览图和源文件均未能加载，请检查登录状态或重新上传。</span>
          </div>
        ) : (
          <img
            src={activeSrc}
            alt={alt}
            loading="lazy"
            draggable={false}
            style={imageStyle}
            onLoad={(event) => setNaturalSize({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })}
            onError={() => {
              if (fallbackSrc && activeSrc !== fallbackSrc) {
                setActiveSrc(fallbackSrc)
                return
              }
              setLoadFailed(true)
            }}
          />
        )}
      </div>
    </div>
  )
}

type SpreadsheetPreview = {
  name: string
  rows: string[][]
}[]

function stringifyOfficeCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (value instanceof Date) {
    return value.toLocaleString('zh-CN')
  }
  if (typeof value === 'object') {
    const maybeFormula = value as { result?: unknown; text?: string; richText?: { text?: string }[]; hyperlink?: string }
    if (maybeFormula.result !== undefined) {
      return stringifyOfficeCellValue(maybeFormula.result)
    }
    if (maybeFormula.text) {
      return maybeFormula.text
    }
    if (Array.isArray(maybeFormula.richText)) {
      return maybeFormula.richText.map((item) => item.text ?? '').join('')
    }
    if (maybeFormula.hyperlink) {
      return maybeFormula.hyperlink
    }
    return JSON.stringify(value)
  }
  return String(value)
}

export function OfficePreview({
  fileType,
  sourceUrl,
  compact = false,
}: {
  fileType: string
  sourceUrl: string
  compact?: boolean
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState('正在加载预览…')
  const [error, setError] = useState('')
  const [workbookPreview, setWorkbookPreview] = useState<SpreadsheetPreview>([])
  const isLegacyOffice = ['DOC', 'XLS', 'PPT'].includes(fileType)

  useEffect(() => {
    let cancelled = false

    const renderPreview = async () => {
      setError('')
      setStatus('正在加载预览…')
      setWorkbookPreview([])
      if (!containerRef.current) {
        return
      }
      containerRef.current.replaceChildren()

      if (isLegacyOffice) {
        setStatus('')
        setError('旧版 Office 二进制格式暂不支持稳定浏览器直读，请转为 DOCX / XLSX / PPTX 后可直接预览。')
        return
      }

      try {
        const response = await fetch(sourceUrl)
        if (!response.ok) {
          throw new Error('文件读取失败')
        }
        const buffer = await response.arrayBuffer()
        if (cancelled) {
          return
        }

        if (fileType === 'DOCX') {
          const { renderAsync } = await import('docx-preview')
          await renderAsync(buffer, containerRef.current, undefined, {
            className: 'docx-preview-document',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            breakPages: !compact,
            useBase64URL: true,
          })
          if (!cancelled) {
            setStatus('')
          }
          return
        }

        if (fileType === 'PPTX') {
          const { init } = await import('pptx-preview')
          const previewer = init(
            containerRef.current,
            compact ? { width: 480, height: 270 } : { width: 960, height: 540 },
          )
          await previewer.preview(buffer)
          if (!cancelled) {
            setStatus('')
          }
          return
        }

        if (fileType === 'XLSX') {
          const ExcelJS = await import('exceljs')
          const workbook = new ExcelJS.Workbook()
          await workbook.xlsx.load(buffer)
          const sheets = workbook.worksheets.slice(0, 5).map((sheet) => {
            const rows: string[][] = []
            sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
              if (rowNumber > 60) {
                return
              }
              const values = Array.isArray(row.values) ? row.values.slice(1, 16) : []
              rows.push(values.map(stringifyOfficeCellValue))
            })
            return { name: sheet.name, rows }
          })
          if (!cancelled) {
            setWorkbookPreview(sheets)
            setStatus('')
          }
          return
        }
      } catch (caughtError) {
        if (!cancelled) {
          setStatus('')
          setError(caughtError instanceof Error ? caughtError.message : '预览失败，请打开源文件查看。')
        }
      }
    }

    void renderPreview()

    return () => {
      cancelled = true
    }
  }, [compact, fileType, isLegacyOffice, sourceUrl])

  return (
    <div className={`office-preview office-preview-${fileType.toLowerCase()} ${compact ? 'compact' : ''}`}>
      {status && <div className="office-preview-status">{status}</div>}
      {error && (
        <div className="file-preview-placeholder">
          <FileText size={compact ? 28 : 42} />
          <strong>{fileType}</strong>
          <span>{compact ? '旧版格式无法生成浏览器缩略图' : error}</span>
          {!compact && (
            <a className="primary-button compact-button" href={sourceUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={15} />
              打开源文件
            </a>
          )}
        </div>
      )}
      {fileType === 'XLSX' && workbookPreview.length > 0 && (
        <div className="spreadsheet-preview">
          {workbookPreview.map((sheet) => (
            <section key={sheet.name}>
              <h3>{sheet.name}</h3>
              <div className="spreadsheet-table-wrap">
                <table>
                  <tbody>
                    {sheet.rows.map((row, rowIndex) => (
                      <tr key={`${sheet.name}-${rowIndex}`}>
                        {row.map((cell, cellIndex) => (
                          <td key={`${sheet.name}-${rowIndex}-${cellIndex}`}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
      <div ref={containerRef} className="office-render-root" />
    </div>
  )
}
