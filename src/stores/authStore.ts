import { create } from 'zustand'
import {
  getStoredAuth,
  type AccessToken,
  type AuthRole,
  type StoredAuth,
} from '../lib/api'
import { resolveStateValue, type StateSetter, workspaceBootCache } from './storeUtils'

type AuthStore = {
  auth: StoredAuth | null
  role: AuthRole
  accessTokens: AccessToken[]
  newTokenId: string
  authError: string
  isLoaded: boolean
  setAuth: StateSetter<StoredAuth | null>
  setRole: StateSetter<AuthRole>
  setAccessTokens: StateSetter<AccessToken[]>
  setNewTokenId: StateSetter<string>
  setAuthError: StateSetter<string>
  setIsLoaded: StateSetter<boolean>
  hydrateAuthState: (state: Pick<AuthStore, 'role' | 'accessTokens'>) => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  auth: getStoredAuth(),
  role: workspaceBootCache?.role ?? 'guest',
  accessTokens: workspaceBootCache?.accessTokens ?? [],
  newTokenId: '',
  authError: '',
  isLoaded: Boolean(workspaceBootCache),
  setAuth: (value) => set((state) => ({ auth: resolveStateValue(value, state.auth) })),
  setRole: (value) => set((state) => ({ role: resolveStateValue(value, state.role) })),
  setAccessTokens: (value) => set((state) => ({ accessTokens: resolveStateValue(value, state.accessTokens) })),
  setNewTokenId: (value) => set((state) => ({ newTokenId: resolveStateValue(value, state.newTokenId) })),
  setAuthError: (value) => set((state) => ({ authError: resolveStateValue(value, state.authError) })),
  setIsLoaded: (value) => set((state) => ({ isLoaded: resolveStateValue(value, state.isLoaded) })),
  hydrateAuthState: ({ role, accessTokens }) => set({ role, accessTokens, isLoaded: true }),
}))
