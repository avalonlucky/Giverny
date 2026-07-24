import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { api, authedPreviewUrl, type AuthRole } from '../lib/api'
import { createOptionalPreviewFile } from '../lib/attachmentPreview'
import { fileTypeForAsset } from '../lib/fileTypes'
import type { AttachmentAnalysis, FileAsset } from '../types/domain'

export function useAttachmentRuntime({
  initialAnalyses,
  isLoaded,
  role,
  files,
  setFiles,
}: {
  initialAnalyses: AttachmentAnalysis[]
  isLoaded: boolean
  role: AuthRole
  files: FileAsset[]
  setFiles: Dispatch<SetStateAction<FileAsset[]>>
}) {
  const [attachmentAnalyses, setAttachmentAnalyses] = useState(initialAnalyses)
  const analysisPollingRef = useRef({ signature: '', attempts: 0, inFlight: false })
  const previewBackfillAttemptsRef = useRef<Map<number, number>>(new Map())
  const [previewBackfillTick, setPreviewBackfillTick] = useState(0)

  useEffect(() => {
    const activeAnalyses = attachmentAnalyses.filter(
      (analysis) => analysis.status === 'pending' || analysis.status === 'processing',
    )
    if (!isLoaded || activeAnalyses.length === 0) {
      analysisPollingRef.current = { signature: '', attempts: 0, inFlight: false }
      return undefined
    }
    const signature = activeAnalyses
      .map((analysis) => `${analysis.attachmentId}:${analysis.requestedAt}`)
      .sort()
      .join('|')
    if (analysisPollingRef.current.signature !== signature) {
      analysisPollingRef.current = { signature, attempts: 0, inFlight: false }
    }
    if (analysisPollingRef.current.attempts >= 60) return undefined

    const timer = window.setTimeout(() => {
      if (analysisPollingRef.current.inFlight) return
      analysisPollingRef.current.inFlight = true
      analysisPollingRef.current.attempts += 1
      void api.getAttachmentAnalysisStatuses(activeAnalyses.map((analysis) => analysis.attachmentId))
        .then((updatedAnalyses) => {
          const updatedById = new Map(updatedAnalyses.map((analysis) => [analysis.attachmentId, analysis]))
          setAttachmentAnalyses((current) => current.map(
            (analysis) => updatedById.get(analysis.attachmentId) ?? analysis,
          ))
        })
        .catch(() => undefined)
        .finally(() => {
          analysisPollingRef.current.inFlight = false
        })
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [attachmentAnalyses, isLoaded])

  useEffect(() => {
    if (role !== 'admin') return undefined
    const canBackfill = (file: FileAsset) => ['pdf', 'ai', 'psd', 'office', 'video'].includes(fileTypeForAsset(file).kind)
    const targets = files.filter(
      (file) =>
        !file.deletedAt
        && (!file.previewUrl || file.previewFallback)
        && file.sourceUrl
        && canBackfill(file)
        && (previewBackfillAttemptsRef.current.get(file.id) ?? 0) < 3,
    )
    if (targets.length === 0) return undefined

    let cancelled = false
    void (async () => {
      for (const file of targets.slice(0, 6)) {
        if (cancelled) break
        const attempt = (previewBackfillAttemptsRef.current.get(file.id) ?? 0) + 1
        previewBackfillAttemptsRef.current.set(file.id, attempt)
        let repaired = false
        try {
          const sourceUrl = authedPreviewUrl(file.sourceUrl)
          if (!sourceUrl) continue
          const response = await fetch(sourceUrl)
          if (!response.ok) continue
          const blob = await response.blob()
          const sourceFile = new File([blob], file.name, { type: blob.type || file.mimeType || '' })
          const preview = await createOptionalPreviewFile(sourceFile)
          if (!preview) continue
          const result = await api.setFilePreview(file.id, preview)
          if (!cancelled && result?.previewUrl) {
            repaired = true
            setFiles((current) => current.map((item) => (
              item.id === file.id
                ? { ...item, previewUrl: result.previewUrl, previewFallback: Boolean(result.previewFallback) }
                : item
            )))
          }
        } catch (error) {
          console.warn('缩略图补全失败', file.name, error)
        } finally {
          if (!cancelled && !repaired && attempt < 3) {
            window.setTimeout(() => setPreviewBackfillTick((current) => current + 1), attempt * 1600)
          }
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [files, previewBackfillTick, role, setFiles])

  return { attachmentAnalyses, setAttachmentAnalyses }
}
