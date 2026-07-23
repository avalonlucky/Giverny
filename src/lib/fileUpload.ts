import { isoDate, pad } from './dateTime'
import { splitFileName } from './fileName'
import type { PendingProgressAttachment } from '../types/taskUi'

// 大文件会自动拆成 8MB 分片写入 R2，不受 Worker 单次请求体 100MB 限制。
const UPLOAD_HARD_LIMIT = 200 * 1024 * 1024
const UPLOAD_SOFT_LIMIT = 50 * 1024 * 1024

export function validateUploadFile(file: File) {
  if (file.size > UPLOAD_HARD_LIMIT) {
    throw new Error(`「${file.name}」超过 ${(UPLOAD_HARD_LIMIT / 1024 / 1024).toFixed(0)}MB，无法上传`)
  }
  return file.size > UPLOAD_SOFT_LIMIT
}

export function sanitizeAttachmentName(value: string, fallbackName: string) {
  const fallback = splitFileName(fallbackName)
  const candidate = splitFileName(value)
  const base = candidate.base
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[.\s-]+$/g, '')
    .trim()
    .slice(0, 90)
  const extension = fallback.extension || candidate.extension
  return `${base || fallback.base || '过程附件'}${extension}`
}

export function renamedFile(file: File, name: string) {
  const normalizedName = sanitizeAttachmentName(name, file.name)
  return normalizedName === file.name
    ? file
    : new File([file], normalizedName, { type: file.type, lastModified: file.lastModified })
}

export function pastedImageName(file: File) {
  const now = new Date()
  const extension = splitFileName(file.name).extension || (file.type === 'image/jpeg' ? '.jpg' : '.png')
  return `粘贴截图_${isoDate()}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}${extension}`
}

export function looksLikeUntidyFileName(value: string) {
  const base = splitFileName(value).base.toLowerCase()
  return /^(img|dsc|pxl|screenshot|screen shot|截屏|截图|微信图片|ishot)[-_ ]?\d*/i.test(base)
    || /^\d{8,}$/.test(base.replace(/\D/g, ''))
    || /^[0-9a-f]{8}-[0-9a-f-]{20,}$/i.test(base)
}

async function blobBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('图片读取失败'))
    reader.readAsDataURL(blob)
  })
}

export async function imageFileBase64(file: File) {
  if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) {
    return ''
  }
  const dataUrl = await blobBase64(file)
  return dataUrl.slice(dataUrl.indexOf(',') + 1)
}

export async function imageUrlBase64(url: string | undefined) {
  if (!url) {
    return ''
  }
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    if (!blob.type.startsWith('image/') || blob.size > 8 * 1024 * 1024) {
      return ''
    }
    const dataUrl = await blobBase64(blob)
    return dataUrl.slice(dataUrl.indexOf(',') + 1)
  } catch {
    return ''
  }
}

export type PreparedImageFiles = { uploadFile: File; previewFile?: File }

const IMAGE_ARCHIVE_MAX_SIDE = 2400
const IMAGE_THUMBNAIL_MAX_SIDE = 480
const IMAGE_OPTIMIZATION_WORKER_SOURCE = `
let queue = Promise.resolve();
const render = async (bitmap, maxSide, type, quality) => {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.convertToBlob({ type, quality });
};
const processImage = async ({ id, file }) => {
  const bitmap = await createImageBitmap(file);
  try {
    const compressible = /image\\/(jpeg|jpg|png|webp)/i.test(file.type);
    const archiveType = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const shouldOptimize = compressible && (file.size >= 900 * 1024 || Math.max(bitmap.width, bitmap.height) > ${IMAGE_ARCHIVE_MAX_SIDE});
    const uploadBlob = shouldOptimize ? await render(bitmap, ${IMAGE_ARCHIVE_MAX_SIDE}, archiveType, 0.86) : null;
    const previewBlob = await render(bitmap, ${IMAGE_THUMBNAIL_MAX_SIDE}, 'image/jpeg', 0.78);
    self.postMessage({ id, uploadBlob: uploadBlob && uploadBlob.size < file.size ? uploadBlob : null, previewBlob });
  } finally {
    bitmap.close();
  }
};
self.onmessage = (event) => {
  queue = queue.then(() => processImage(event.data)).catch((error) => {
    self.postMessage({ id: event.data.id, error: error instanceof Error ? error.message : 'Image optimization failed' });
  });
};
`

let imageOptimizationWorker: Worker | null = null
let imageOptimizationRequestId = 0
const imageOptimizationRequests = new Map<number, {
  resolve: (value: { uploadBlob?: Blob; previewBlob?: Blob }) => void
  reject: (reason?: unknown) => void
}>()
let mainThreadImageOptimizationQueue: Promise<void> = Promise.resolve()

function getImageOptimizationWorker() {
  if (imageOptimizationWorker) return imageOptimizationWorker
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return null
  const workerUrl = URL.createObjectURL(new Blob([IMAGE_OPTIMIZATION_WORKER_SOURCE], { type: 'text/javascript' }))
  const worker = new Worker(workerUrl)
  window.setTimeout(() => URL.revokeObjectURL(workerUrl), 0)
  worker.onmessage = (event: MessageEvent<{ id: number; uploadBlob?: Blob; previewBlob?: Blob; error?: string }>) => {
    const request = imageOptimizationRequests.get(event.data.id)
    if (!request) return
    imageOptimizationRequests.delete(event.data.id)
    if (event.data.error) {
      request.reject(new Error(event.data.error))
      return
    }
    request.resolve(event.data)
  }
  worker.onerror = (event) => {
    imageOptimizationRequests.forEach((request) => request.reject(new Error(event.message || '图片后台优化失败')))
    imageOptimizationRequests.clear()
    worker.terminate()
    imageOptimizationWorker = null
  }
  imageOptimizationWorker = worker
  return worker
}

async function renderImageBitmapBlob(bitmap: ImageBitmap, maxSide: number, type: string, quality: number) {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) return undefined
  context.fillStyle = 'white'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise<Blob | undefined>((resolve) => canvas.toBlob((blob) => resolve(blob ?? undefined), type, quality))
}

async function prepareImageOnMainThread(file: File): Promise<PreparedImageFiles> {
  const bitmap = await createImageBitmap(file)
  try {
    const compressible = /image\/(jpeg|jpg|png|webp)/i.test(file.type)
    const archiveType = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
    const shouldOptimize = compressible && (file.size >= 900 * 1024 || Math.max(bitmap.width, bitmap.height) > IMAGE_ARCHIVE_MAX_SIDE)
    const uploadBlob = shouldOptimize ? await renderImageBitmapBlob(bitmap, IMAGE_ARCHIVE_MAX_SIDE, archiveType, 0.86) : undefined
    const previewBlob = await renderImageBitmapBlob(bitmap, IMAGE_THUMBNAIL_MAX_SIDE, 'image/jpeg', 0.78)
    return {
      uploadFile: uploadBlob && uploadBlob.size < file.size
        ? new File([uploadBlob], file.name, { type: uploadBlob.type, lastModified: file.lastModified })
        : file,
      previewFile: previewBlob
        ? new File([previewBlob], `${splitFileName(file.name).base || '附件'}-thumbnail.jpg`, { type: 'image/jpeg' })
        : undefined,
    }
  } finally {
    bitmap.close()
  }
}

export async function prepareImageFiles(file: File): Promise<PreparedImageFiles> {
  if (!file.type.startsWith('image/')) return { uploadFile: file }
  const worker = getImageOptimizationWorker()
  if (worker) {
    try {
      const id = ++imageOptimizationRequestId
      const result = await new Promise<{ uploadBlob?: Blob; previewBlob?: Blob }>((resolve, reject) => {
        imageOptimizationRequests.set(id, { resolve, reject })
        worker.postMessage({ id, file })
      })
      return {
        uploadFile: result.uploadBlob
          ? new File([result.uploadBlob], file.name, { type: result.uploadBlob.type, lastModified: file.lastModified })
          : file,
        previewFile: result.previewBlob
          ? new File([result.previewBlob], `${splitFileName(file.name).base || '附件'}-thumbnail.jpg`, { type: 'image/jpeg' })
          : undefined,
      }
    } catch (error) {
      console.warn('image worker optimization failed, using queued fallback', file.name, error)
    }
  }
  const fallback = mainThreadImageOptimizationQueue
    .then(() => new Promise<void>((resolve) => window.setTimeout(resolve, 0)))
    .then(() => prepareImageOnMainThread(file))
  mainThreadImageOptimizationQueue = fallback.then(() => undefined, () => undefined)
  return fallback.catch((error) => {
    console.warn('image main-thread optimization failed, using original file', file.name, error)
    return { uploadFile: file }
  })
}

export function ensurePendingAttachmentPreparation(attachment: PendingProgressAttachment): Promise<PreparedImageFiles> {
  if (!attachment.file.type.startsWith('image/')) return Promise.resolve({ uploadFile: attachment.file })
  if (attachment.optimizedFile) {
    return Promise.resolve({ uploadFile: attachment.optimizedFile, previewFile: attachment.previewFile })
  }
  if (attachment.preparationPromise) return attachment.preparationPromise
  const preparationPromise = prepareImageFiles(attachment.file).then((prepared) => {
    attachment.optimizedFile = prepared.uploadFile
    attachment.previewFile = prepared.previewFile
    return prepared
  })
  attachment.preparationPromise = preparationPromise
  return preparationPromise
}

export async function ensurePendingAttachmentPreview(attachment: PendingProgressAttachment) {
  return (await ensurePendingAttachmentPreparation(attachment)).previewFile
}
