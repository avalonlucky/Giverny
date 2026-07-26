import type { BackendState } from './api'
import { removeLocalCache, writeJsonLocalCache } from './localCache'

const STATE_CACHE_KEY = 'designer-worklog-state-cache-v2'
const AUTH_STORAGE_KEY = 'designer-worklog-auth'
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
    const authRaw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!authRaw) {
      removeLocalCache(STATE_CACHE_KEY)
      return null
    }
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
    const auth = JSON.parse(authRaw) as { role?: string }
    const cachedRole = parsed.state.role
    const cachedWorkspace = parsed.state.workspace
    const identityMatches = auth.role === cachedRole
      && (auth.role !== 'demo' || cachedWorkspace?.id === 'demo')
      && (auth.role === 'demo' || cachedWorkspace?.id !== 'demo')
    if (!identityMatches) {
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
