import { useEffect, useMemo, useRef, useState } from 'react'
import {
  defaultDesignTypeGroups,
  defaultDesignTypes,
  defaultHourlyRate,
  defaultPdfTitle,
  defaultServiceCompanyName,
} from '../config/appConfig'
import {
  api,
  ApiError,
  clearStoredAuth,
  getStoredAuth,
  type AccessToken,
  type AiModelConfig,
  type AiProviderConfig,
  type AuthRole,
  type ReportRecord,
  type StoredAuth,
} from '../lib/api'
import { normalizeDesignTypeGroups } from '../lib/designTypeGroups'
import { normalizeTaskClosure } from '../lib/taskContextInsights'
import { readStateCache, writeStateCache } from '../lib/stateCache'
import type { FileAsset, Task, TaskUpdate, TaxMode } from '../types/domain'
import type { SettingsTab } from '../views/SettingsView'
import type { ToastState } from '../lib/toastQueue'
import { useAttachmentRuntime } from './useAttachmentRuntime'
import { useBackendRuntime, type BackendStatus } from './useBackendRuntime'

type Notify = (message: string, tone?: ToastState['tone']) => void

export function useWorkspaceData(notify: Notify) {
  const [auth, setAuth] = useState<StoredAuth | null>(getStoredAuth)
  const [bootCache] = useState(() => readStateCache())
  const bootTasks = useMemo(() => bootCache?.tasks.map(normalizeTaskClosure) ?? [], [bootCache])
  const [role, setRole] = useState<AuthRole>(bootCache?.role ?? 'guest')
  const [accessTokens, setAccessTokens] = useState<AccessToken[]>(bootCache?.accessTokens ?? [])
  const [newTokenId, setNewTokenId] = useState('')
  const [authError, setAuthError] = useState('')
  const [isLoaded, setIsLoaded] = useState(Boolean(bootCache))
  const [taskItems, setTaskItems] = useState<Task[]>(bootTasks)
  const taskItemsRef = useRef<Task[]>(bootTasks)
  const [updateItems, setUpdateItems] = useState<TaskUpdate[]>(bootCache?.updates ?? [])
  const [fileItems, setFileItems] = useState<FileAsset[]>(bootCache?.files ?? [])
  const [reports, setReports] = useState<ReportRecord[]>(bootCache?.reports ?? [])
  const [hourlyRate, setHourlyRate] = useState(bootCache?.settings?.hourlyRate ?? defaultHourlyRate)
  const [pdfTitle, setPdfTitle] = useState(bootCache?.settings?.pdfTitle || defaultPdfTitle)
  const [serviceCompanyName, setServiceCompanyName] = useState(bootCache?.settings?.serviceCompanyName || defaultServiceCompanyName)
  const [taxMode, setTaxMode] = useState<TaxMode>(bootCache?.settings?.taxMode ?? 'salary')
  const [designTypeGroups, setDesignTypeGroups] = useState(defaultDesignTypeGroups)
  const [aiModelConfig, setAiModelConfig] = useState<AiModelConfig | null>(null)
  const [aiProviderConfigs, setAiProviderConfigs] = useState<AiProviderConfig[]>([])
  const [settingsEntry, setSettingsEntry] = useState<{ tab: SettingsTab; nonce: number }>({ tab: 'ai', nonce: 0 })
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('连接中')
  const isAdmin = role === 'admin' && Boolean(auth)
  const { attachmentAnalyses, setAttachmentAnalyses } = useAttachmentRuntime({
    initialAnalyses: bootCache?.attachmentAnalyses ?? [],
    isLoaded,
    role,
    files: fileItems,
    setFiles: setFileItems,
  })
  const {
    backendSyncSlow,
    resetBackendSyncSlow,
    isOffline,
    storageUsage,
  } = useBackendRuntime({ backendStatus, isAdmin })

  useEffect(() => {
    taskItemsRef.current = taskItems
  }, [taskItems])

  const refreshState = async () => {
    const state = await api.getState()
    const normalizedTasks = state.tasks.map(normalizeTaskClosure)
    writeStateCache({ ...state, tasks: normalizedTasks })
    setTaskItems(normalizedTasks)
    setUpdateItems(state.updates)
    setFileItems(state.files)
    setAttachmentAnalyses(state.attachmentAnalyses ?? [])
    setReports(state.reports ?? [])
    setRole(state.role)
    const storedForCheck = getStoredAuth()
    if (storedForCheck?.role === 'admin' && state.role !== 'admin') {
      clearStoredAuth()
      setAuth(null)
      setAuthError('管理员登录已失效（密码可能已修改），请重新登录')
    }
    setAccessTokens(state.accessTokens ?? [])
    setHourlyRate(state.settings.hourlyRate)
    setPdfTitle(state.settings.pdfTitle || defaultPdfTitle)
    setServiceCompanyName(state.settings.serviceCompanyName || defaultServiceCompanyName)
    setTaxMode(state.settings.taxMode ?? 'salary')
    setDesignTypeGroups(normalizeDesignTypeGroups(
      state.settings.designTypeGroups ?? [{ name: '常用类型', items: state.settings.designTypes ?? defaultDesignTypes }],
    ))
    setAiModelConfig(state.settings.aiModel ?? null)
    setBackendStatus('已接入 D1/R2')
    resetBackendSyncSlow()
    setIsLoaded(true)
    return normalizedTasks
  }

  const retryRefreshState = async () => {
    setBackendStatus('连接中')
    resetBackendSyncSlow()
    try {
      await refreshState()
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `重新同步失败：${error.message}` : '重新同步失败，请稍后再试')
    }
  }

  useEffect(() => {
    // Initial and credential-change state hydration is the intended effect here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshState().catch((error) => {
      if (error instanceof ApiError && error.status === 401) {
        clearStoredAuth()
        setAuth(null)
        setRole('guest')
        setAuthError('登录已失效（口令可能被停用或已过期），已切换为游客只读')
        void refreshState().catch((publicError) => {
          setBackendStatus('后端异常')
          setIsLoaded(true)
          notify(publicError instanceof Error ? `后端连接失败：${publicError.message}` : '后端连接失败')
        })
        return
      }
      setBackendStatus('后端异常')
      setIsLoaded(true)
      notify(error instanceof Error ? `后端连接失败：${error.message}` : '后端连接失败')
    })
    // State hydration intentionally follows credential changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, notify])

  useEffect(() => {
    if (!isAdmin) return undefined
    let cancelled = false
    api.getAiProviderConfigs()
      .then((result) => {
        if (!cancelled) setAiProviderConfigs(result.providers)
      })
      .catch(() => {
        if (!cancelled) setAiProviderConfigs([])
      })
    return () => {
      cancelled = true
    }
  }, [isAdmin, aiModelConfig?.updatedAt])

  return {
    auth, setAuth, role, setRole, accessTokens, setAccessTokens, newTokenId, setNewTokenId,
    authError, setAuthError, isLoaded, taskItems, setTaskItems, taskItemsRef,
    updateItems, setUpdateItems, fileItems, setFileItems, reports, setReports,
    hourlyRate, setHourlyRate, pdfTitle, setPdfTitle, serviceCompanyName, setServiceCompanyName,
    taxMode, setTaxMode, designTypeGroups, setDesignTypeGroups, aiModelConfig, setAiModelConfig,
    aiProviderConfigs, setAiProviderConfigs, settingsEntry, setSettingsEntry,
    backendStatus, setBackendStatus, backendSyncSlow, isOffline, storageUsage,
    attachmentAnalyses, refreshState, retryRefreshState, isAdmin,
  }
}
