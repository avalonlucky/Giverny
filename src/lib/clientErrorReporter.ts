import { appVersion } from '../config/appConfig'

type ClientErrorKind = 'render' | 'window-error' | 'unhandled-rejection'

type ClientErrorInput = {
  kind: ClientErrorKind
  error: unknown
  componentStack?: string
}

const recentlyReported = new Map<string, number>()
const DEDUPE_WINDOW_MS = 60_000

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack || '' }
  }
  if (typeof error === 'string') {
    return { message: error, stack: '' }
  }
  return { message: '未知前端异常', stack: '' }
}

export function reportClientError({ kind, error, componentStack = '' }: ClientErrorInput) {
  if (typeof window === 'undefined') return
  const details = errorDetails(error)
  const dedupeKey = `${kind}:${details.message}:${componentStack.slice(0, 200)}`
  const now = Date.now()
  if (now - (recentlyReported.get(dedupeKey) || 0) < DEDUPE_WINDOW_MS) return
  recentlyReported.set(dedupeKey, now)

  void fetch('/api/client-errors', {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind,
      message: details.message,
      stack: details.stack,
      componentStack,
      path: window.location.pathname,
      appVersion,
      userAgent: window.navigator.userAgent,
    }),
  }).catch(() => undefined)
}

export function installGlobalErrorReporting() {
  if (typeof window === 'undefined') return () => undefined
  const handleError = (event: ErrorEvent) => {
    reportClientError({ kind: 'window-error', error: event.error || event.message })
  }
  const handleRejection = (event: PromiseRejectionEvent) => {
    reportClientError({ kind: 'unhandled-rejection', error: event.reason })
  }
  window.addEventListener('error', handleError)
  window.addEventListener('unhandledrejection', handleRejection)
  return () => {
    window.removeEventListener('error', handleError)
    window.removeEventListener('unhandledrejection', handleRejection)
  }
}
