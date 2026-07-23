export function readMergedLocalCache<T extends object>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback
  }
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<T>) } : fallback
  } catch {
    return fallback
  }
}

export function writeJsonLocalCache(key: string, value: unknown) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(key, JSON.stringify(value))
}

export function removeLocalCache(key: string) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(key)
}
