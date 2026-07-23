import type { BackendState } from './api'
import { removeLocalCache, writeJsonLocalCache } from './localCache'

const STATE_CACHE_KEY = 'designer-worklog-state-cache-v2'
const STATE_CACHE_SCHEMA_VERSION = 2
const STATE_CACHE_TTL_MS = 30 * 60 * 1000

type StateCacheEnvelope = {
  version: number
  cachedAt: number
  state: BackendState
}

export function readStateCache(): BackendState | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(STATE_CACHE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as Partial<StateCacheEnvelope>
    if (parsed.version !== STATE_CACHE_SCHEMA_VERSION || typeof parsed.cachedAt !== 'number' || !parsed.state) {
      removeLocalCache(STATE_CACHE_KEY)
      return null
    }
    if (Date.now() - parsed.cachedAt > STATE_CACHE_TTL_MS) {
      removeLocalCache(STATE_CACHE_KEY)
      return null
    }
    return parsed.state
  } catch {
    return null
  }
}

export function writeStateCache(state: BackendState) {
  try {
    writeJsonLocalCache(STATE_CACHE_KEY, {
      version: STATE_CACHE_SCHEMA_VERSION,
      cachedAt: Date.now(),
      state,
    } satisfies StateCacheEnvelope)
  } catch {
    // The snapshot only speeds up first paint; quota failures can fall back to the loading state.
  }
}

export function clearStateCache() {
  removeLocalCache(STATE_CACHE_KEY)
}
