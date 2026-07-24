import { appVersion } from '../config/appConfig'

export type ClientErrorKind = 'render' | 'window-error' | 'unhandled-rejection' | 'resource-error' | 'chunk-load' | 'api-error'

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

function runtimeErrorKind(error: unknown, fallback: ClientErrorKind): ClientErrorKind {
  const message = errorDetails(error).message
  return /dynamically imported module|loading chunk|chunkloaderror|failed to fetch.*module script/i.test(message)
    ? 'chunk-load'
    : fallback
}

function trimDedupeCache(now: number) {
  if (recentlyReported.size < 100) return
  for (const [key, reportedAt] of recentlyReported) {
    if (now - reportedAt >= DEDUPE_WINDOW_MS) recentlyReported.delete(key)
  }
}

export function reportClientError({ kind, error, componentStack = '' }: ClientErrorInput) {
  if (typeof window === 'undefined') return
  const details = errorDetails(error)
  const dedupeKey = `${kind}:${details.message}:${componentStack.slice(0, 200)}`
  const now = Date.now()
  if (now - (recentlyReported.get(dedupeKey) || 0) < DEDUPE_WINDOW_MS) return
  trimDedupeCache(now)
  recentlyReported.set(dedupeKey, now)

  void fetch('/api/client-errors', {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind,
      message: details.message,
      stack: details.stack.replaceAll(window.location.origin, ''),
      componentStack,
      path: window.location.pathname,
      appVersion,
      userAgent: window.navigator.userAgent,
    }),
  }).catch(() => undefined)
}

export function installGlobalErrorReporting() {
  if (typeof window === 'undefined') return () => undefined
  const handleError = (event: Event) => {
    if (event instanceof ErrorEvent) {
      const error = event.error || event.message
      reportClientError({ kind: runtimeErrorKind(error, 'window-error'), error })
      return
    }
    const target = event.target
    if (!(target instanceof HTMLScriptElement) && !(target instanceof HTMLLinkElement)) return
    const source = target instanceof HTMLScriptElement ? target.src : target.href
    const resourcePath = (() => {
      try {
        const url = new URL(source, window.location.origin)
        return url.origin === window.location.origin ? url.pathname : '[external-resource]'
      } catch {
        return '[unknown-resource]'
      }
    })()
    reportClientError({ kind: 'resource-error', error: new Error(`${target.tagName.toLowerCase()} 资源加载失败：${resourcePath}`) })
  }
  const handleRejection = (event: PromiseRejectionEvent) => {
    reportClientError({ kind: runtimeErrorKind(event.reason, 'unhandled-rejection'), error: event.reason })
  }
  window.addEventListener('error', handleError, true)
  window.addEventListener('unhandledrejection', handleRejection)
  return () => {
    window.removeEventListener('error', handleError, true)
    window.removeEventListener('unhandledrejection', handleRejection)
  }
}
