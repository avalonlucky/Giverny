const PSD_PREVIEW_MAX_SIDE = 1800

export function isPsdFile(file: File) {
  return file.name.toLowerCase().endsWith('.psd') || file.type === 'image/vnd.adobe.photoshop'
}

function fileNameWithoutExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, '')
}

function canvasToPngFile(canvas: HTMLCanvasElement, fileName: string) {
  return new Promise<File | undefined>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(undefined)
        return
      }
      resolve(new File([blob], `${fileNameWithoutExtension(fileName)}-preview.png`, { type: 'image/png' }))
    }, 'image/png')
  })
}

export async function createPsdPreviewFile(file: File) {
  if (!isPsdFile(file)) {
    return undefined
  }

  const { readPsd } = await import('ag-psd')
  const psd = readPsd(await file.arrayBuffer(), {
    skipLayerImageData: true,
    skipThumbnail: true,
    skipLinkedFilesData: true,
  })
  const sourceCanvas = psd.canvas
  if (!sourceCanvas?.width || !sourceCanvas.height) {
    return undefined
  }

  const scale = Math.min(1, PSD_PREVIEW_MAX_SIDE / Math.max(sourceCanvas.width, sourceCanvas.height))
  const width = Math.max(1, Math.round(sourceCanvas.width * scale))
  const height = Math.max(1, Math.round(sourceCanvas.height * scale))
  const previewCanvas = document.createElement('canvas')
  previewCanvas.width = width
  previewCanvas.height = height
  const context = previewCanvas.getContext('2d')
  if (!context) {
    return undefined
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height, 0, 0, width, height)
  return canvasToPngFile(previewCanvas, file.name)
}
