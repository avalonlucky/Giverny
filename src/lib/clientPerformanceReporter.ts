import { appVersion } from '../config/appConfig'

type LayoutShiftEntry = PerformanceEntry & { value: number; hadRecentInput: boolean }
type InteractionEntry = PerformanceEntry & { duration: number; interactionId?: number }
type NetworkInformation = { effectiveType?: string }

const sessionId = typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
const initialPath = typeof window !== 'undefined' ? window.location.pathname : '/'
const metrics = {
  ttfbMs: 0,
  fcpMs: 0,
  lcpMs: 0,
  inpMs: 0,
  cls: 0,
  loadMs: 0,
}

function rounded(value: number, digits = 0) {
  if (!Number.isFinite(value) || value < 0) return 0
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function observe(type: string, onEntries: (entries: PerformanceEntry[]) => void) {
  if (!PerformanceObserver.supportedEntryTypes.includes(type)) return undefined
  try {
    const observer = new PerformanceObserver((list) => onEntries(list.getEntries()))
    observer.observe({
      type,
      buffered: true,
      ...(type === 'event' ? { durationThreshold: 40 } : {}),
    } as PerformanceObserverInit)
    return observer
  } catch {
    return undefined
  }
}

function navigationMetrics() {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  if (!navigation) return { navigationType: 'navigate' }
  metrics.ttfbMs = rounded(navigation.responseStart)
  metrics.loadMs = rounded(navigation.loadEventEnd || navigation.duration)
  return { navigationType: navigation.type || 'navigate' }
}

function deviceClass() {
  if (window.innerWidth <= 640) return 'mobile'
  if (window.innerWidth <= 1180) return 'compact'
  return 'desktop'
}

function sendPerformanceReport() {
  const { navigationType } = navigationMetrics()
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection
  const body = JSON.stringify({
    sessionId,
    path: initialPath,
    appVersion,
    navigationType,
    deviceClass: deviceClass(),
    connectionType: connection?.effectiveType || '',
    metrics: {
      ttfbMs: rounded(metrics.ttfbMs),
      fcpMs: rounded(metrics.fcpMs),
      lcpMs: rounded(metrics.lcpMs),
      inpMs: rounded(metrics.inpMs),
      cls: rounded(metrics.cls, 4),
      loadMs: rounded(metrics.loadMs),
    },
  })
  const blob = new Blob([body], { type: 'application/json' })
  if (navigator.sendBeacon?.('/api/client-performance', blob)) return
  void fetch('/api/client-performance', {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers: { 'content-type': 'application/json' },
    body,
  }).catch(() => undefined)
}

export function installClientPerformanceReporting() {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return () => undefined
  const observers = [
    observe('paint', (entries) => {
      const fcp = entries.find((entry) => entry.name === 'first-contentful-paint')
      if (fcp) metrics.fcpMs = rounded(fcp.startTime)
    }),
    observe('largest-contentful-paint', (entries) => {
      const last = entries.at(-1)
      if (last) metrics.lcpMs = rounded(last.startTime)
    }),
    observe('layout-shift', (entries) => {
      for (const entry of entries as LayoutShiftEntry[]) {
        if (!entry.hadRecentInput) metrics.cls += entry.value
      }
    }),
    observe('event', (entries) => {
      for (const entry of entries as InteractionEntry[]) {
        if ((entry.interactionId || 0) > 0) metrics.inpMs = Math.max(metrics.inpMs, entry.duration)
      }
    }),
  ].filter(Boolean) as PerformanceObserver[]

  const reportTimer = window.setTimeout(sendPerformanceReport, document.readyState === 'complete' ? 10_000 : 15_000)
  const handlePageHide = () => sendPerformanceReport()
  const handleVisibility = () => {
    if (document.visibilityState === 'hidden') sendPerformanceReport()
  }
  window.addEventListener('pagehide', handlePageHide)
  document.addEventListener('visibilitychange', handleVisibility)
  return () => {
    window.clearTimeout(reportTimer)
    observers.forEach((observer) => observer.disconnect())
    window.removeEventListener('pagehide', handlePageHide)
    document.removeEventListener('visibilitychange', handleVisibility)
  }
}
