import { useEffect, useState } from 'react'
import { api, type StorageUsage } from '../lib/api'

export type BackendStatus = '连接中' | '已接入 D1/R2' | '后端异常'

export function useBackendRuntime({ backendStatus, isAdmin }: { backendStatus: BackendStatus; isAdmin: boolean }) {
  const [backendSyncSlow, setBackendSyncSlow] = useState(false)
  const [isOffline, setIsOffline] = useState(() => (typeof navigator === 'undefined' ? false : !navigator.onLine))
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null)

  useEffect(() => {
    if (backendStatus !== '连接中') return undefined
    const timer = window.setTimeout(() => setBackendSyncSlow(true), 8000)
    return () => window.clearTimeout(timer)
  }, [backendStatus])

  useEffect(() => {
    if (typeof navigator === 'undefined') return undefined
    const updateOnlineState = () => setIsOffline(!navigator.onLine)
    window.addEventListener('online', updateOnlineState)
    window.addEventListener('offline', updateOnlineState)
    return () => {
      window.removeEventListener('online', updateOnlineState)
      window.removeEventListener('offline', updateOnlineState)
    }
  }, [])

  useEffect(() => {
    if (!isAdmin || backendStatus !== '已接入 D1/R2') return undefined
    let cancelled = false
    const loadStorageUsage = async () => {
      try {
        const usage = await api.getStorageUsage()
        if (!cancelled) setStorageUsage(usage)
      } catch {
        if (!cancelled) setStorageUsage(null)
      }
    }
    void loadStorageUsage()
    const timer = window.setInterval(() => void loadStorageUsage(), 5 * 60 * 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [backendStatus, isAdmin])

  return {
    backendSyncSlow: backendStatus === '连接中' && backendSyncSlow,
    resetBackendSyncSlow: () => setBackendSyncSlow(false),
    isOffline,
    storageUsage,
  }
}
