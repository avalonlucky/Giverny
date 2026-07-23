import { splitFileName } from './fileName'
import { fileTypeForFile } from './fileTypes'
import { createPsdPreviewFile } from './psdPreview'
import { createPdfPreviewFile } from './pdfPreview'
import { PDF_PREVIEW_TIMEOUT_MS, withPreviewTimeout } from './previewTimeout'

export async function createTextPreviewFile(fileName: string, text: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 600
  canvas.height = 420
  const context = canvas.getContext('2d')
  if (!context) {
    return undefined
  }
  context.fillStyle = '#fbfbf7'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#2f3a37'
  context.font = '600 28px -apple-system, "PingFang SC", "Segoe UI", sans-serif'
  context.fillText(splitFileName(fileName).base.slice(0, 18), 38, 58)
  context.fillStyle = '#8c9895'
  context.font = '500 18px -apple-system, "PingFang SC", "Segoe UI", sans-serif'
  context.fillText(splitFileName(fileName).extension.replace('.', '').toUpperCase() || 'TEXT', 38, 90)
  context.strokeStyle = '#e3e7e2'
  context.beginPath()
  context.moveTo(38, 118)
  context.lineTo(562, 118)
  context.stroke()

  context.fillStyle = '#46524f'
  context.font = '22px -apple-system, "PingFang SC", "Segoe UI", sans-serif'
  const normalized = text.replace(/\s+/g, ' ').trim()
  const lines: string[] = []
  let cursor = normalized
  while (cursor && lines.length < 8) {
    let end = Math.min(cursor.length, 22)
    while (end < cursor.length && context.measureText(cursor.slice(0, end)).width < 500) {
      end += 1
    }
    lines.push(cursor.slice(0, end).trim())
    cursor = cursor.slice(end).trim()
  }
  lines.forEach((line, index) => context.fillText(line, 38, 158 + index * 34))
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), 'image/png'))
  if (!blob) {
    return undefined
  }
  return new File([blob], `${splitFileName(fileName).base || 'attachment'}-preview.png`, { type: 'image/png' })
}

// 把视频首帧渲染成 PNG 预览图（MP4 / MOV / WebM 等）
async function createVideoPreviewFile(file: File) {
  const url = URL.createObjectURL(file)
  try {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.src = url
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = () => reject(new Error('视频加载失败'))
    })
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve()
      try {
        video.currentTime = Math.min(0.1, (video.duration || 1) / 2)
      } catch {
        resolve()
      }
      setTimeout(() => resolve(), 1200)
    })
    const width = video.videoWidth
    const height = video.videoHeight
    if (!width || !height) {
      return undefined
    }
    const scale = Math.min(1, 600 / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const context = canvas.getContext('2d')
    if (!context) {
      return undefined
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), 'image/png'))
    if (!blob) {
      return undefined
    }
    const base = file.name.replace(/\.[^.]+$/, '')
    return new File([blob], `${base}-preview.png`, { type: 'image/png' })
  } finally {
    URL.revokeObjectURL(url)
  }
}

// 把离屏渲染好的 DOM 栅格化成 PNG 预览；空白/过小则放弃（回退到类型角标）
async function rasterizeElementToPreviewFile(target: HTMLElement, baseName: string, options?: { width?: number; height?: number }) {
  const html2canvas = (await import('html2canvas')).default
  const canvas = await html2canvas(target, {
    backgroundColor: '#ffffff',
    scale: 1,
    logging: false,
    useCORS: true,
    width: options?.width,
    height: options?.height,
    windowWidth: options?.width ?? target.scrollWidth ?? 960,
  })
  if (canvas.width < 8 || canvas.height < 8) {
    return undefined
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), 'image/png'))
  if (!blob || blob.size < 300) {
    return undefined
  }
  return new File([blob], `${baseName}-preview.png`, { type: 'image/png' })
}

// Word / PPT / Excel 缩略图：用现有预览库离屏渲染首页 / 首张幻灯片 / 首个工作表，再栅格化为图片
async function createOfficePreviewFile(file: File, fileType: 'DOCX' | 'PPTX' | 'XLSX') {
  const buffer = await file.arrayBuffer()
  const base = file.name.replace(/\.[^.]+$/, '')
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-100000px;top:0;background:#ffffff;z-index:-1;overflow:hidden;'
  document.body.appendChild(host)
  try {
    if (fileType === 'DOCX') {
      host.style.width = '794px'
      const { renderAsync } = await import('docx-preview')
      await renderAsync(buffer, host, undefined, { className: 'docx-preview-document', inWrapper: true, breakPages: true, useBase64URL: true })
      await new Promise((resolve) => setTimeout(resolve, 400))
      const page = (host.querySelector('section') as HTMLElement | null) ?? host
      const fullHeight = page.offsetHeight || 1123
      return await rasterizeElementToPreviewFile(page, base, { width: 794, height: Math.min(fullHeight, 1123) })
    }
    if (fileType === 'PPTX') {
      host.style.width = '960px'
      host.style.height = '540px'
      const { init } = await import('pptx-preview')
      const previewer = init(host, { width: 960, height: 540 })
      await previewer.preview(buffer)
      await new Promise((resolve) => setTimeout(resolve, 500))
      return await rasterizeElementToPreviewFile(host, base, { width: 960, height: 540 })
    }
    // XLSX：自建首个工作表的表格再栅格化，稳定可控
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]
    if (!sheet) {
      return undefined
    }
    host.style.width = '900px'
    host.style.padding = '18px'
    host.style.fontFamily = '-apple-system, "PingFang SC", "Segoe UI", sans-serif'
    const table = document.createElement('table')
    table.style.cssText = 'border-collapse:collapse;font-size:13px;color:#1f2a27;'
    let rowCount = 0
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > 22) {
        return
      }
      rowCount += 1
      const tr = document.createElement('tr')
      const values = Array.isArray(row.values) ? row.values.slice(1, 11) : []
      const cellCount = Math.max(values.length, 1)
      for (let index = 0; index < cellCount; index += 1) {
        const isHead = rowNumber === 1
        const cell = document.createElement(isHead ? 'th' : 'td')
        cell.textContent = stringifyCellValue(values[index]).slice(0, 30)
        cell.style.cssText = `border:1px solid #e3e3dd;padding:6px 10px;text-align:left;white-space:nowrap;${isHead ? 'background:#f4f4ee;font-weight:600;' : ''}`
        tr.appendChild(cell)
      }
      table.appendChild(tr)
    })
    if (rowCount === 0) {
      return undefined
    }
    host.appendChild(table)
    await new Promise((resolve) => setTimeout(resolve, 150))
    return await rasterizeElementToPreviewFile(host, base, { width: host.offsetWidth || 900 })
  } catch (error) {
    console.warn('office preview generation failed', fileType, error)
    return undefined
  } finally {
    host.remove()
  }
}

export async function createOptionalPreviewFile(file: File) {
  const inferred = fileTypeForFile(file)
  try {
    if (inferred.kind === 'psd') {
      return await createPsdPreviewFile(file)
    }
    if (inferred.kind === 'pdf') {
      return await withPreviewTimeout(createPdfPreviewFile(file), PDF_PREVIEW_TIMEOUT_MS, 'PDF 首页渲染超时')
    }
    if (inferred.kind === 'video') {
      return await createVideoPreviewFile(file)
    }
    if (inferred.type === 'DOCX') {
      return await createOfficePreviewFile(file, 'DOCX')
    }
    if (inferred.type === 'PPTX') {
      return await createOfficePreviewFile(file, 'PPTX')
    }
    if (inferred.type === 'XLSX') {
      return await createOfficePreviewFile(file, 'XLSX')
    }
  } catch (error) {
    console.warn('preview generation failed', error)
  }
  return undefined
}

function stringifyCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (value instanceof Date) {
    return value.toLocaleString('zh-CN')
  }
  if (typeof value === 'object') {
    const maybeFormula = value as { result?: unknown; text?: string; richText?: { text?: string }[]; hyperlink?: string }
    if (maybeFormula.result !== undefined) {
      return stringifyCellValue(maybeFormula.result)
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
