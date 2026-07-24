import { useEffect, useRef } from 'react'
import {
  defaultDesignTypes,
  defaultPdfTitle,
  defaultServiceCompanyName,
} from '../config/appConfig'
import {
  api,
  ApiError,
  clearStoredAuth,
  getStoredAuth,
} from '../lib/api'
import { normalizeDesignTypeGroups } from '../lib/designTypeGroups'
import { normalizeTaskClosure } from '../lib/taskContextInsights'
import { writeStateCache } from '../lib/stateCache'
import type { ToastState } from '../lib/toastQueue'
import { useAttachmentRuntime } from './useAttachmentRuntime'
import { useBackendRuntime } from './useBackendRuntime'
import { useAuthStore } from '../stores/authStore'
import { useTaskStore } from '../stores/taskStore'
import { useFileStore } from '../stores/fileStore'
import { useSettingsStore } from '../stores/settingsStore'

type Notify = (message: string, tone?: ToastState['tone']) => void

export function useWorkspaceData(notify: Notify) {
  const {
    auth, setAuth, role, setRole, accessTokens, setAccessTokens, newTokenId, setNewTokenId,
    authError, setAuthError, isLoaded, setIsLoaded,
    hydrateAuthState,
  } = useAuthStore()
  const {
    taskItems, setTaskItems, updateItems, setUpdateItems, reports, setReports,
    hydrateTaskState,
  } = useTaskStore()
  const { fileItems, setFileItems, hydrateFileState } = useFileStore()
  const {
    hourlyRate, setHourlyRate, pdfTitle, setPdfTitle, serviceCompanyName, setServiceCompanyName,
    taxMode, setTaxMode, designTypeGroups, setDesignTypeGroups, aiModelConfig, setAiModelConfig,
    aiProviderConfigs, setAiProviderConfigs, backendStatus, setBackendStatus,
    hydrateSettingsState,
  } = useSettingsStore()
  const taskItemsRef = useRef(taskItems)
  const isAdmin = role === 'admin' && Boolean(auth)
  const { attachmentAnalyses } = useAttachmentRuntime({
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
    hydrateTaskState({ taskItems: normalizedTasks, updateItems: state.updates, reports: state.reports ?? [] })
    hydrateFileState({ fileItems: state.files, attachmentAnalyses: state.attachmentAnalyses ?? [] })
    hydrateAuthState({ role: state.role, accessTokens: state.accessTokens ?? [] })
    const storedForCheck = getStoredAuth()
    if (storedForCheck?.role === 'admin' && state.role !== 'admin') {
      clearStoredAuth()
      setAuth(null)
      setAuthError('管理员登录已失效（密码可能已修改），请重新登录')
    }
    hydrateSettingsState({
      hourlyRate: state.settings.hourlyRate,
      pdfTitle: state.settings.pdfTitle || defaultPdfTitle,
      serviceCompanyName: state.settings.serviceCompanyName || defaultServiceCompanyName,
      taxMode: state.settings.taxMode ?? 'salary',
      designTypeGroups: normalizeDesignTypeGroups(
        state.settings.designTypeGroups ?? [{ name: '常用类型', items: state.settings.designTypes ?? defaultDesignTypes }],
      ),
      aiModelConfig: state.settings.aiModel ?? null,
    })
    resetBackendSyncSlow()
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
  }, [isAdmin, aiModelConfig?.updatedAt, setAiProviderConfigs])

  return {
    auth, setAuth, role, setRole, accessTokens, setAccessTokens, newTokenId, setNewTokenId,
    authError, setAuthError, isLoaded, taskItems, setTaskItems, taskItemsRef,
    updateItems, setUpdateItems, fileItems, setFileItems, reports, setReports,
    hourlyRate, setHourlyRate, pdfTitle, setPdfTitle, serviceCompanyName, setServiceCompanyName,
    taxMode, setTaxMode, designTypeGroups, setDesignTypeGroups, aiModelConfig, setAiModelConfig,
    aiProviderConfigs, setAiProviderConfigs,
    backendStatus, setBackendStatus, backendSyncSlow, isOffline, storageUsage,
    attachmentAnalyses, refreshState, retryRefreshState, isAdmin,
  }
}
