import { useCallback, useEffect, useRef, useState } from 'react'
import { inferToastTone, trimToastQueue, type ToastState, type ToastTone } from '../lib/toastQueue'

export function useToastNotifications() {
  const [toastQueue, setToastQueue] = useState<ToastState[]>([])
  const timersRef = useRef<number[]>([])

  const notify = useCallback((
    message: string,
    tone: ToastTone = inferToastTone(message),
    options: Pick<ToastState, 'actionLabel' | 'onAction' | 'durationMs'> = {},
  ) => {
    const nextToast: ToastState = { id: Date.now() + Math.random(), message, tone, ...options }
    const duration = options.durationMs ?? (tone === 'error' ? 4200 : 2400)
    setToastQueue((current) => trimToastQueue([...current, nextToast]))
    const timer = window.setTimeout(() => {
      setToastQueue((current) => current.filter((item) => item !== nextToast))
      timersRef.current = timersRef.current.filter((value) => value !== timer)
    }, duration)
    timersRef.current = [...timersRef.current, timer]
  }, [])

  const dismissToast = useCallback((toastId: number) => {
    setToastQueue((current) => current.filter((toast) => toast.id !== toastId))
  }, [])

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
  }, [])

  return { toastQueue, notify, dismissToast }
}
