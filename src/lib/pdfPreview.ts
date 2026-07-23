import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

export async function createPdfPreviewFile(file: File) {
  const data = await file.arrayBuffer()
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  const doc = await pdfjs.getDocument({ data }).promise
  const page = await doc.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const targetWidth = 600
  const viewport = page.getViewport({ scale: targetWidth / base.width })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas 不可用')
  }
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: context, viewport }).promise
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), 'image/png'))
  if (!blob) {
    throw new Error('PDF 预览生成失败')
  }
  const baseName = file.name.replace(/\.[^.]+$/, '')
  return new File([blob], `${baseName}-preview.png`, { type: 'image/png' })
}
