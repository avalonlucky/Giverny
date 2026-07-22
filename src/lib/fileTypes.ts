import { authedPreviewUrl } from './api'
import type { FileAsset } from '../types/domain'

export const inlineImageFileTypes = new Set(['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG', 'BMP'])
export const inlineDocumentFileTypes = new Set(['PDF', 'AI'])
export const officeFileTypes = new Set(['DOCX', 'XLSX', 'PPTX', 'DOC', 'XLS', 'PPT'])
export const videoFileTypes = new Set(['MP4', 'MOV', 'WEBM', 'M4V', 'OGV'])

const trustedFileExtensions = new Set([
  ...inlineImageFileTypes,
  ...inlineDocumentFileTypes,
  ...officeFileTypes,
  ...videoFileTypes,
  'PSD',
  'TXT',
  'MD',
  'CSV',
  'JSON',
  'ZIP',
  'RAR',
  '7Z',
])

export type InferredFileKind = 'image' | 'pdf' | 'ai' | 'psd' | 'office' | 'video' | 'text' | 'archive' | 'unknown'
type FileTypeInput = { name?: string; type?: string; mimeType?: string }

function extensionFromTrustedName(name: string | undefined) {
  const matched = String(name ?? '').match(/\.([^.]+)$/)
  const extension = (matched?.[1] ?? '').trim().toUpperCase()
  if (!extension) {
    return ''
  }
  const normalized = extension === 'JPEG' ? 'JPG' : extension
  return trustedFileExtensions.has(normalized) ? normalized : ''
}

function typeFromMime(mimeType: string | undefined) {
  const mime = String(mimeType ?? '').toLowerCase()
  if (!mime) return ''
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'JPG'
  if (mime === 'image/png') return 'PNG'
  if (mime === 'image/webp') return 'WEBP'
  if (mime === 'image/gif') return 'GIF'
  if (mime === 'image/svg+xml') return 'SVG'
  if (mime === 'image/bmp') return 'BMP'
  if (mime === 'application/pdf') return 'PDF'
  if (mime.startsWith('video/')) {
    if (mime.includes('quicktime')) return 'MOV'
    if (mime.includes('webm')) return 'WEBM'
    if (mime.includes('ogg')) return 'OGV'
    return 'MP4'
  }
  if (mime.includes('wordprocessingml.document')) return 'DOCX'
  if (mime.includes('presentationml.presentation')) return 'PPTX'
  if (mime.includes('spreadsheetml.sheet')) return 'XLSX'
  if (mime === 'application/msword') return 'DOC'
  if (mime === 'application/vnd.ms-powerpoint') return 'PPT'
  if (mime === 'application/vnd.ms-excel') return 'XLS'
  if (mime.startsWith('text/')) return mime.includes('csv') ? 'CSV' : 'TXT'
  if (mime.includes('zip')) return 'ZIP'
  return ''
}

function kindForFileType(fileType: string): InferredFileKind {
  const type = fileType.toUpperCase()
  if (isInlineImageFileType(type)) return 'image'
  if (type === 'PDF') return 'pdf'
  if (type === 'AI') return 'ai'
  if (type === 'PSD') return 'psd'
  if (isOfficeFileType(type)) return 'office'
  if (videoFileTypes.has(type)) return 'video'
  if (['TXT', 'MD', 'CSV', 'JSON'].includes(type)) return 'text'
  if (['ZIP', 'RAR', '7Z'].includes(type)) return 'archive'
  return 'unknown'
}

export function inferFileType(input: FileTypeInput) {
  const mimeType = input.mimeType || (input.type?.includes('/') ? input.type : '')
  const fromMime = typeFromMime(mimeType)
  const rawType = input.type && !input.type.includes('/') ? input.type.trim().toUpperCase() : ''
  const normalizedRawType = rawType === 'JPEG' ? 'JPG' : rawType
  const fromExistingType = trustedFileExtensions.has(normalizedRawType) ? normalizedRawType : ''
  const fromName = extensionFromTrustedName(input.name)
  const type = fromMime || fromExistingType || fromName || 'FILE'
  return {
    type,
    kind: kindForFileType(type),
    mimeType: mimeType || '',
    extension: fromName,
  }
}

export function fileTypeForAsset(file: FileAsset | undefined) {
  return inferFileType({ name: file?.name, type: file?.type, mimeType: file?.mimeType })
}

export function fileTypeForFile(file: File) {
  return inferFileType({ name: file.name, mimeType: file.type })
}

export function isInlineImageFileType(fileType: string) {
  return inlineImageFileTypes.has(fileType.toUpperCase())
}

export function isInlineDocumentFileType(fileType: string) {
  return inlineDocumentFileTypes.has(fileType.toUpperCase())
}

export function isOfficeFileType(fileType: string) {
  return officeFileTypes.has(fileType.toUpperCase())
}

function appendQueryParam(url: string | undefined, key: string, value: string) {
  if (!url) {
    return undefined
  }
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
}

export function fileDocumentPreviewSource(file: FileAsset | undefined) {
  if (!file) {
    return undefined
  }
  const fileType = fileTypeForAsset(file).type
  return authedPreviewUrl(fileType === 'AI' ? appendQueryParam(file.sourceUrl, 'as', 'pdf') : file.sourceUrl)
}

export function fileThumbnailSource(file: FileAsset | undefined) {
  if (!file) {
    return undefined
  }
  const kind = fileTypeForAsset(file).kind
  return ['pdf', 'ai', 'psd', 'office', 'video'].includes(kind) ? fileDocumentPreviewSource(file) : undefined
}
