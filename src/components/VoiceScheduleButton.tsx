import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LoaderCircle, Mic, X } from 'lucide-react'
import { api, type VoiceScheduleResult } from '../lib/api'
import { formatDurationZh, formatPlanDateTime, isoDateTime } from '../lib/dateTime'

export function ScheduleAnchorSwitch({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`switch-control schedule-anchor-switch ${active ? 'active' : ''}`}
      aria-label={label}
      aria-pressed={active}
      title={label}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
    >
      <i />
    </button>
  )
}

export function VoiceScheduleButton({
  label = '用语音填写时间与工时',
  context,
  currentStart,
  currentDurationMinutes,
  currentEnd,
  onApply,
  disabled = false,
}: {
  label?: string
  context: string
  currentStart?: string
  currentDurationMinutes?: number
  currentEnd?: string
  onApply: (result: VoiceScheduleResult) => void
  disabled?: boolean
}) {
  type BrowserSpeechRecognitionEvent = {
    resultIndex: number
    results: ArrayLike<{ isFinal: boolean; 0?: { transcript?: string } }>
  }
  type BrowserSpeechRecognition = {
    lang: string
    continuous: boolean
    interimResults: boolean
    maxAlternatives: number
    onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null
    onerror: ((event: { error: string }) => void) | null
    onend: (() => void) | null
    start: () => void
    stop: () => void
    abort: () => void
  }
  type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const liveTranscriptRef = useRef('')
  const timeoutRef = useRef<number | null>(null)
  const processingTimeoutRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const runIdRef = useRef(0)
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing'>('idle')
  const [result, setResult] = useState<VoiceScheduleResult | null>(null)
  const [error, setError] = useState('')
  const [liveTranscript, setLiveTranscript] = useState('')

  const clearRecordingTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const clearProcessingTimeout = useCallback(() => {
    if (processingTimeoutRef.current !== null) {
      window.clearTimeout(processingTimeoutRef.current)
      processingTimeoutRef.current = null
    }
  }, [])

  const releaseMedia = useCallback(() => {
    clearRecordingTimeout()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
  }, [clearRecordingTimeout])

  const releaseRecognition = useCallback(() => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    if (!recognition) return
    recognition.onresult = null
    recognition.onerror = null
    recognition.onend = null
    try {
      recognition.abort()
    } catch {
      // 已结束的识别器无需额外处理。
    }
  }, [])

  useEffect(() => () => {
    const recorder = recorderRef.current
    if (recorder?.state === 'recording') recorder.stop()
    abortRef.current?.abort()
    clearProcessingTimeout()
    releaseRecognition()
    releaseMedia()
  }, [clearProcessingTimeout, releaseMedia, releaseRecognition])

  const processVoiceInput = useCallback(async (
    requestVoiceResult: (signal: AbortSignal) => Promise<VoiceScheduleResult>,
    timeoutMs: number,
    timeoutMessage: string,
  ) => {
    const runId = runIdRef.current
    const controller = new AbortController()
    abortRef.current = controller
    setStatus('processing')
    setError('')
    processingTimeoutRef.current = window.setTimeout(() => {
      controller.abort()
    }, timeoutMs)
    try {
      const nextResult = await requestVoiceResult(controller.signal)
      if (runId !== runIdRef.current) return
      setResult(nextResult)
    } catch (caughtError) {
      if (runId !== runIdRef.current) return
      const aborted = caughtError instanceof DOMException && caughtError.name === 'AbortError'
      setError(aborted ? timeoutMessage : caughtError instanceof Error ? caughtError.message : '语音识别失败，请重试。')
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      clearProcessingTimeout()
      if (runId === runIdRef.current) setStatus('idle')
    }
  }, [clearProcessingTimeout])

  const processTranscript = useCallback((transcript: string) => {
    const normalizedTranscript = transcript.trim()
    if (!normalizedTranscript) {
      setError('没有听到清晰语音，请靠近麦克风后重试。')
      setStatus('idle')
      return
    }
    void processVoiceInput(
      (signal) => api.parseVoiceScheduleTranscript({
        transcript: normalizedTranscript,
        referenceTime: isoDateTime(),
        context,
        currentStart,
        currentDurationMinutes,
        currentEnd,
      }, { signal }),
      5_000,
      '时间和工时整理超过 5 秒，请重试或手动填写。',
    )
  }, [context, currentDurationMinutes, currentEnd, currentStart, processVoiceInput])

  const processRecording = useCallback((audio: Blob) => {
    if (audio.size <= 0) {
      setError('没有录到声音，请靠近麦克风后重试。')
      setStatus('idle')
      return
    }
    void processVoiceInput(
      (signal) => api.transcribeVoiceSchedule(audio, {
        referenceTime: isoDateTime(),
        context,
        currentStart,
        currentDurationMinutes,
        currentEnd,
      }, { signal }),
      20_000,
      '浏览器当前不支持实时听写，云端转写超过 20 秒未完成，请重试或手动填写。',
    )
  }, [context, currentDurationMinutes, currentEnd, currentStart, processVoiceInput])

  const stopRecording = useCallback(() => {
    const recognition = recognitionRef.current
    if (recognition) {
      clearRecordingTimeout()
      setStatus('processing')
      recognition.stop()
      return
    }
    const recorder = recorderRef.current
    if (!recorder || recorder.state !== 'recording') return
    recorder.stop()
    setStatus('processing')
  }, [clearRecordingTimeout])

  const startMediaRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('当前浏览器不支持语音录入，请改用最新版 Chrome、Edge 或 Safari。')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      streamRef.current = stream
      const preferredType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = preferredType ? new MediaRecorder(stream, { mimeType: preferredType }) : new MediaRecorder(stream)
      chunksRef.current = []
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const audio = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        chunksRef.current = []
        releaseMedia()
        processRecording(audio)
      }
      recorder.start(250)
      setStatus('recording')
      timeoutRef.current = window.setTimeout(stopRecording, 45_000)
    } catch (caughtError) {
      releaseMedia()
      const denied = caughtError instanceof DOMException && (caughtError.name === 'NotAllowedError' || caughtError.name === 'SecurityError')
      setError(denied ? '麦克风权限未开启，请允许本网站使用麦克风后重试。' : '无法启动麦克风，请检查设备后重试。')
    }
  }, [processRecording, releaseMedia, stopRecording])

  const startRecording = useCallback(async () => {
    runIdRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    clearProcessingTimeout()
    releaseRecognition()
    releaseMedia()
    setResult(null)
    setError('')
    setLiveTranscript('')
    liveTranscriptRef.current = ''
    const speechWindow = window as typeof window & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
    }
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (SpeechRecognition) {
      const runId = runIdRef.current
      const recognition = new SpeechRecognition()
      recognition.lang = 'zh-CN'
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 1
      recognitionRef.current = recognition
      recognition.onresult = (event) => {
        let transcript = ''
        for (let index = 0; index < event.results.length; index += 1) {
          transcript += event.results[index]?.[0]?.transcript || ''
        }
        liveTranscriptRef.current = transcript.trim()
        setLiveTranscript(liveTranscriptRef.current)
      }
      recognition.onerror = (event) => {
        if (runId !== runIdRef.current) return
        clearRecordingTimeout()
        recognitionRef.current = null
        setStatus('idle')
        const message = event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? '麦克风或实时听写权限未开启，请在浏览器地址栏允许后重试。'
          : event.error === 'no-speech'
            ? '没有听到清晰语音，请靠近麦克风后重试。'
            : '实时听写暂不可用，请重试或改用最新版 Chrome、Edge。'
        setError(message)
      }
      recognition.onend = () => {
        if (recognitionRef.current !== recognition || runId !== runIdRef.current) return
        recognitionRef.current = null
        clearRecordingTimeout()
        processTranscript(liveTranscriptRef.current)
      }
      try {
        recognition.start()
        setStatus('recording')
        timeoutRef.current = window.setTimeout(stopRecording, 45_000)
        return
      } catch {
        recognitionRef.current = null
      }
    }
    try {
      await startMediaRecording()
    } catch {
      setError('无法启动语音录入，请检查设备后重试。')
    }
  }, [clearProcessingTimeout, clearRecordingTimeout, processTranscript, releaseMedia, releaseRecognition, startMediaRecording, stopRecording])

  const dismiss = useCallback(() => {
    runIdRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    clearProcessingTimeout()
    releaseRecognition()
    const recorder = recorderRef.current
    if (recorder?.state === 'recording') {
      recorder.ondataavailable = null
      recorder.onstop = null
      recorder.stop()
    }
    releaseMedia()
    setStatus('idle')
    setResult(null)
    setError('')
    setLiveTranscript('')
    liveTranscriptRef.current = ''
  }, [clearProcessingTimeout, releaseMedia, releaseRecognition])

  const statusText = status === 'recording' ? '正在听…' : status === 'processing' ? '正在整理时间与工时…' : error ? '语音录入未完成' : '识别结果'

  const review = status !== 'idle' || result || error
    ? createPortal(
        <section className="voice-schedule-review" role="status" aria-live="polite">
          <div className="voice-schedule-review-head">
            <span className={`voice-schedule-state ${status}`} aria-hidden="true" />
            <strong>
              {statusText}
              {(status === 'recording' || status === 'processing') && (
                <span className="voice-schedule-wave" aria-hidden="true">
                  <i /><i /><i /><i />
                </span>
              )}
            </strong>
            {status === 'recording' && (
              <button
                type="button"
                className="voice-schedule-complete"
                onClick={stopRecording}
              >
                采集完成
              </button>
            )}
            <button type="button" className="voice-schedule-close" aria-label="关闭语音识别结果" title="关闭" onClick={dismiss}>
              <X size={15} />
            </button>
          </div>
          {status === 'recording' && <p>{liveTranscript ? `正在识别：${liveTranscript}` : '可以一次说出开始时间、工时和交付时间中的任意一项或两项。'}</p>}
          {status === 'processing' && <p>正在把语音整理成时间字段，实时听写通常会在 5 秒内完成。</p>}
          {error && <p className="voice-schedule-error">{error}</p>}
          {result && (
            <>
              <blockquote>{result.transcript}</blockquote>
              <div className="voice-schedule-values">
                {result.startAt && <span>开始 {formatPlanDateTime(result.startAt)}{result.derivedField === 'start' ? ' · 自动' : ''}</span>}
                {result.durationMinutes && <span>工时 {formatDurationZh(result.durationMinutes)}{result.derivedField === 'hours' ? ' · 自动' : ''}</span>}
                {result.endAt && <span>交付 {formatPlanDateTime(result.endAt)}{result.derivedField === 'end' ? ' · 自动' : ''}</span>}
              </div>
              {result.warnings.map((warning) => <p className="voice-schedule-error" key={warning}>{warning}</p>)}
              <div className="voice-schedule-actions">
                <button type="button" className="text-button" onClick={() => void startRecording()}>重新说</button>
                <button
                  type="button"
                  className="primary-button compact-button"
                  disabled={result.warnings.length > 0}
                  onClick={() => {
                    onApply(result)
                    dismiss()
                  }}
                >
                  应用到时间与工时
                </button>
              </div>
            </>
          )}
        </section>,
        document.body,
      )
    : null

  return (
    <div className="voice-schedule-control">
      <button
        type="button"
        className="voice-schedule-trigger"
        aria-label={label}
        title={label}
        disabled={disabled || status !== 'idle'}
        onClick={() => void startRecording()}
      >
        {status === 'processing' ? <LoaderCircle size={16} className="spin" /> : <Mic size={17} />}
      </button>
      {review}
    </div>
  )
}

