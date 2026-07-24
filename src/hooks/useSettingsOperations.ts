import type { Dispatch, SetStateAction } from 'react'
import { defaultPdfTitle, defaultServiceCompanyName, type DesignTypeGroup } from '../config/appConfig'
import type { ConfirmDialogState } from '../components/ConfirmDialogModal'
import {
  api,
  ApiError,
  clearStoredAuth,
  setStoredAuth,
  type AiModelConfig,
  type AiModelEndpointConfig,
  type AiModelRouteKey,
  type TokenScope,
} from '../lib/api'
import { isoDate, pad } from '../lib/dateTime'
import { normalizeDesignTypeGroups } from '../lib/designTypeGroups'
import { clearStateCache } from '../lib/stateCache'
import type { TaxMode } from '../types/domain'
import type { ToastState } from '../lib/toastQueue'
import type { useWorkspaceData } from './useWorkspaceData'

type Notify = (message: string, tone?: ToastState['tone']) => void
type WorkspaceData = ReturnType<typeof useWorkspaceData>

function nowStamp() {
  const now = new Date()
  return `${isoDate()} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export function useSettingsOperations({
  workspace,
  notify,
  setConfirmDialog,
  setIsLoginModalOpen,
  setIsAccountMenuOpen,
}: {
  workspace: WorkspaceData
  notify: Notify
  setConfirmDialog: Dispatch<SetStateAction<ConfirmDialogState | null>>
  setIsLoginModalOpen: Dispatch<SetStateAction<boolean>>
  setIsAccountMenuOpen: Dispatch<SetStateAction<boolean>>
}) {
  const {
    setAuth, setRole, accessTokens, setAccessTokens, setNewTokenId,
    setAuthError, taskItems, updateItems, fileItems, reports,
    hourlyRate, setHourlyRate, pdfTitle, setPdfTitle, serviceCompanyName, setServiceCompanyName,
    taxMode, setTaxMode, setDesignTypeGroups, setAiModelConfig, setBackendStatus,
  } = workspace

  const handleExportBackup = () => {
    const payload = {
      exportedAt: nowStamp(),
      settings: { hourlyRate, pdfTitle, serviceCompanyName, taxMode },
      tasks: taskItems,
      updates: updateItems,
      files: fileItems,
      reports,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `worklog-backup-${isoDate()}.json`
    link.click()
    URL.revokeObjectURL(url)
    notify('备份已导出到下载目录')
  }

  const handleUnlock = async (email: string, key: string, turnstileToken?: string) => {
    try {
      const result = await api.login(email, key, turnstileToken)
      const credentials = { email, role: result.role }
      setStoredAuth(credentials)
      setAuthError('')
      setBackendStatus('连接中')
      setRole(result.role)
      setAuth(credentials)
      setIsLoginModalOpen(false)
      notify(result.role === 'admin' ? '管理员已登录' : '访问口令已登录')
    } catch (error) {
      setAuthError(error instanceof ApiError && error.status === 401
        ? '账号或密码不正确'
        : error instanceof Error ? `登录失败：${error.message}` : '登录失败，请重试')
    }
  }

  const handleSignOut = () => {
    void api.logout().catch(() => {})
    clearStoredAuth()
    clearStateCache()
    setAuth(null)
    setRole('guest')
    setAccessTokens([])
    setAuthError('')
    setIsAccountMenuOpen(false)
    setIsLoginModalOpen(false)
    notify('已退出管理员身份，当前为游客只读')
  }

  const handleChangeAdminPassword = async (currentPassword: string, newPassword: string) => {
    try {
      await api.changeAdminPassword({ currentPassword, newPassword })
      notify('管理员密码已更新')
    } catch (error) {
      notify(error instanceof Error ? `密码更新失败：${error.message}` : '密码更新失败')
      throw error
    }
  }

  const handleCreateAccessToken = async (label: string, expiresInDays: number | null, scope: TokenScope) => {
    try {
      const created = await api.createAccessToken({ label, expiresInDays, scope })
      setAccessTokens((current) => [created, ...current])
      setNewTokenId(created.id)
      try {
        await window.navigator.clipboard.writeText(created.token)
        notify('口令已生成并复制到剪贴板')
      } catch {
        notify('口令已生成，请在列表中复制')
      }
    } catch (error) {
      notify(error instanceof Error ? `口令生成失败：${error.message}` : '口令生成失败')
    }
  }

  const handleToggleAccessToken = async (tokenId: string, disabled: boolean) => {
    try {
      const saved = await api.setAccessTokenDisabled(tokenId, disabled)
      setAccessTokens((current) => current.map((token) => token.id === tokenId ? saved : token))
      notify(disabled ? '口令已停用' : '口令已恢复')
    } catch (error) {
      notify(error instanceof Error ? `操作失败：${error.message}` : '操作失败')
    }
  }

  const handleDeleteAccessToken = async (tokenId: string) => {
    const token = accessTokens.find((item) => item.id === tokenId)
    setConfirmDialog({
      eyebrow: '删除口令',
      title: `确定删除「${token?.label || '该口令'}」吗？`,
      body: '正在使用这个口令登录的设备会立即失效，删除后无法恢复。',
      confirmText: '确认删除',
      tone: 'danger',
      details: [token?.expiresAt ? `有效期：${token.expiresAt}` : '永久有效', token?.lastUsedAt ? `最后使用：${token.lastUsedAt}` : '尚未使用'],
      onConfirm: async () => {
        try {
          await api.deleteAccessToken(tokenId)
          setAccessTokens((current) => current.filter((token) => token.id !== tokenId))
          notify('口令已删除')
        } catch (error) {
          notify(error instanceof Error ? `删除失败：${error.message}` : '删除失败')
        }
      },
    })
  }

  const handleCopyAccessToken = async (token: string) => {
    try {
      await window.navigator.clipboard.writeText(token)
      notify('口令已复制')
    } catch {
      notify(token)
    }
  }

  const handleRateChange = async (rate: number) => {
    setHourlyRate(rate)
    try {
      const result = await api.setHourlyRate(rate)
      setHourlyRate(result.hourlyRate)
      setBackendStatus('已接入 D1/R2')
      notify('小时单价已写入 D1')
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `单价保存失败：${error.message}` : '单价保存失败')
    }
  }

  const saveTextSetting = async (
    value: string,
    fallback: string,
    save: (next: string) => Promise<{ pdfTitle?: string; serviceCompanyName?: string }>,
    apply: (next: string) => void,
    success: string,
    failure: string,
  ) => {
    const next = value.trim() || fallback
    apply(next)
    try {
      const saved = await save(next)
      apply(saved.pdfTitle ?? saved.serviceCompanyName ?? next)
      notify(success)
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `${failure}：${error.message}` : failure)
    }
  }

  const handlePdfTitleChange = (title: string) => saveTextSetting(
    title, defaultPdfTitle, api.setPdfTitle, setPdfTitle, 'PDF 抬头已保存', 'PDF 抬头保存失败',
  )
  const handleServiceCompanyNameChange = (name: string) => saveTextSetting(
    name, defaultServiceCompanyName, api.setServiceCompanyName, setServiceCompanyName, '服务公司名称已保存', '服务公司名称保存失败',
  )

  const handleTaxModeChange = async (mode: TaxMode) => {
    setTaxMode(mode)
    try {
      const saved = await api.setTaxMode(mode)
      setTaxMode(saved.taxMode)
      setBackendStatus('已接入 D1/R2')
      notify('计税方式已保存')
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `计税方式保存失败：${error.message}` : '计税方式保存失败')
    }
  }

  const handleDesignTypeGroupsChange = async (nextGroups: DesignTypeGroup[]) => {
    const safeGroups = normalizeDesignTypeGroups(nextGroups)
    setDesignTypeGroups(safeGroups)
    try {
      const result = await api.setDesignTypeGroups(safeGroups)
      setDesignTypeGroups(result.designTypeGroups)
      setBackendStatus('已接入 D1/R2')
      notify('设计类型已写入 D1')
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `设计类型保存失败：${error.message}` : '设计类型保存失败')
    }
  }

  const handleAiModelConfigChange = async (
    payload: Partial<Pick<AiModelConfig, 'mode' | 'provider' | 'baseUrl' | 'model' | 'runtimeUrl'>> & {
      apiKey?: string
      clearApiKey?: boolean
      routes?: Partial<Record<AiModelRouteKey, Partial<Pick<AiModelEndpointConfig, 'provider' | 'baseUrl' | 'model'>>>>
      routeApiKeys?: Partial<Record<AiModelRouteKey, string>>
      clearRouteApiKeys?: AiModelRouteKey[]
    },
  ) => {
    try {
      const saved = await api.setAiModelConfig(payload)
      setAiModelConfig(saved)
      setBackendStatus('已接入 D1/R2')
      notify(saved.mode === 'baml-runtime' ? 'BAML Runtime 模型配置已保存' : 'AI 模型配置已保存')
    } catch (error) {
      setBackendStatus('后端异常')
      notify(error instanceof Error ? `AI 模型配置保存失败：${error.message}` : 'AI 模型配置保存失败')
    }
  }

  return {
    handleExportBackup, handleUnlock, handleSignOut, handleChangeAdminPassword,
    handleCreateAccessToken, handleToggleAccessToken, handleDeleteAccessToken, handleCopyAccessToken,
    handleRateChange, handlePdfTitleChange, handleServiceCompanyNameChange, handleTaxModeChange,
    handleDesignTypeGroupsChange, handleAiModelConfigChange,
  }
}
