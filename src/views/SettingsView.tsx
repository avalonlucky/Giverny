import { lazy, Suspense, type CSSProperties, type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bot,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  KeyRound,
  LoaderCircle,
  LogOut,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  UserCircle,
  X,
  Zap,
} from 'lucide-react'
import {
  appReleaseDate,
  appVersion,
  defaultPdfTitle,
  defaultServiceCompanyName,
  designTypeColorPalette,
  type DesignTypeGroup,
} from '../config/appConfig'
import {
  api,
  type AccessToken,
  type AiModelConfig,
  type AiModelEndpointConfig,
  type AiModelProvider,
  type AiModelRouteKey,
  type AiOperationsCenter,
  type AiProviderConfig,
  type AgentRunMetrics,
  type AuthRole,
  type OpenRouterFreeModel,
  type StorageUsage,
  type TokenScope,
  type WorkspaceSummary,
} from '../lib/api'
import type { AgentFailureCase } from '../types/agent'
import type { TaxMode } from '../types/domain'
import { AiBrandIcon } from '../components/AiBrandIcon'
import { ConfirmDialogModal, type ConfirmDialogState } from '../components/ConfirmDialogModal'
import { GivernyModeSettings } from '../components/GivernyModeSettings'
import { GivernySelect } from '../components/GivernySelect'
import { ModalShell } from '../components/ModalShell'
import { aiModelCategoryLabels, aiModelCategoryOrder, classifyAiModel, type AiModelCategory } from '../lib/aiModels'
import { aiBrandForValue } from '../lib/aiBrands'
import {
  baseUrlForProvider,
  aiProviderOptions,
  aiRouteDefaults,
  defaultModelForProvider,
  directBaseUrlForProvider,
  gatewayBaseUrlForProvider,
  isGatewayBaseUrl,
  officialApiKeyUrlForProvider,
  providerSupportsVision,
} from '../lib/aiProviders'
import { designTypeColorForIndex, nextUnusedDesignTypeColor, validDesignTypeColor } from '../lib/designTypes'
import deepseekBrandIcon from '@lobehub/icons-static-svg/icons/deepseek-color.svg?url'
import doubaoBrandIcon from '@lobehub/icons-static-svg/icons/doubao-color.svg?url'
import geminiBrandIcon from '@lobehub/icons-static-svg/icons/gemini-color.svg?url'
import kimiBrandIcon from '@lobehub/icons-static-svg/icons/kimi.svg?url'
import openaiBrandIcon from '@lobehub/icons-static-svg/icons/openai.svg?url'
import openrouterBrandIcon from '@lobehub/icons-static-svg/icons/openrouter-color.svg?url'
import qwenBrandIcon from '@lobehub/icons-static-svg/icons/qwen-color.svg?url'
import anthropicBrandIcon from '@lobehub/icons-static-svg/icons/anthropic.svg?url'

const AiOperationsCenterPanel = lazy(() => import('../components/AiOperationsCenterPanel'))
const LocalCliConnectionPanel = lazy(() => import('../components/LocalCliConnectionPanel'))

const formatStorageUsage = (usage: StorageUsage | null) => usage?.label ?? '同步中'

const aiRouteMeta: Array<{ key: AiModelRouteKey; title: string; description: string; capability: 'text' | 'vision' }> = [
  { key: 'textPrimary', title: '文字主模型', description: '任务文案、进展、验收和工时建议优先使用', capability: 'text' },
  { key: 'textFallback', title: '文字备用模型', description: 'DeepSeek 不可用或返回无效时自动兜底', capability: 'text' },
  { key: 'visionPrimary', title: '识图主模型', description: '交付件图片、PDF 页面和 PPT 预览优先识别', capability: 'vision' },
  { key: 'visionFallback', title: '识图备用模型', description: 'Gemini 额度不足或识别失败时自动兜底', capability: 'vision' },
]

const aiProviderIconMap: Partial<Record<AiModelProvider, string>> = {
  deepseek: deepseekBrandIcon,
  gemini: geminiBrandIcon,
  kimi: kimiBrandIcon,
  doubao: doubaoBrandIcon,
  qwen: qwenBrandIcon,
  openai: openaiBrandIcon,
  openrouter: openrouterBrandIcon,
  anthropic: anthropicBrandIcon,
}

function aiRoutesFromConfig(config: AiModelConfig | null): Record<AiModelRouteKey, Pick<AiModelEndpointConfig, 'provider' | 'baseUrl' | 'model'>> {
  return aiRouteMeta.reduce((map, route) => {
    const item = config?.[route.key] ?? aiRouteDefaults[route.key]
    return {
      ...map,
      [route.key]: {
        provider: item.provider,
        baseUrl: item.baseUrl,
        model: item.model,
      },
    }
  }, {} as Record<AiModelRouteKey, Pick<AiModelEndpointConfig, 'provider' | 'baseUrl' | 'model'>>)
}

const agentMetricIntentLabels: Record<string, string> = {
  month_finance: '月份财务',
  task_detail: '任务详情',
  task_search: '任务搜索',
  task_disambiguation: '任务消歧',
  workspace_context: '工作台概览',
  general_chat: '普通对话',
  write_create_task: '创建任务',
  write_record_feedback: '记录反馈',
  write_update_task_status: '修改状态',
  write_update_task_fields: '修改字段',
  write_append_progress: '追加进展',
}

function formatAgentMetricDuration(value: number) {
  if (value <= 0) return '—'
  if (value < 1000) return `${value}ms`
  return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}s`
}

export type SettingsTab = 'appearance' | 'settlement' | 'ai' | 'local-cli' | 'design' | 'security' | 'system'

export default function SettingsView({
  initialTab,
  hourlyRate,
  pdfTitle,
  serviceCompanyName,
  taxMode,
  designTypeGroups,
  aiModelConfig,
  aiProviderConfigs: initialAiProviderConfigs,
  role,
  accessTokens,
  newTokenId,
  storageUsage,
  onRateChange,
  onPdfTitleChange,
  onServiceCompanyNameChange,
  onTaxModeChange,
  onDesignTypeGroupsChange,
  onAiModelConfigChange,
  onAiProviderConfigsChange,
  onExportBackup,
  onSignOut,
  onChangePassword,
  onCreateToken,
  onToggleToken,
  onDeleteToken,
  onCopyToken,
}: {
  initialTab: SettingsTab
  hourlyRate: number
  pdfTitle: string
  serviceCompanyName: string
  taxMode: TaxMode
  designTypeGroups: DesignTypeGroup[]
  aiModelConfig: AiModelConfig | null
  aiProviderConfigs: AiProviderConfig[]
  role: AuthRole
  accessTokens: AccessToken[]
  newTokenId: string
  storageUsage: StorageUsage | null
  onRateChange: (rate: number) => void
  onPdfTitleChange: (title: string) => void
  onServiceCompanyNameChange: (name: string) => void
  onTaxModeChange: (mode: TaxMode) => void
  onDesignTypeGroupsChange: (groups: DesignTypeGroup[]) => void | Promise<void>
  onAiModelConfigChange: (
    payload: Partial<Pick<AiModelConfig, 'mode' | 'provider' | 'baseUrl' | 'model' | 'runtimeUrl'>> & {
      apiKey?: string
      clearApiKey?: boolean
      routes?: Partial<Record<AiModelRouteKey, Partial<Pick<AiModelEndpointConfig, 'provider' | 'baseUrl' | 'model'>>>>
      routeApiKeys?: Partial<Record<AiModelRouteKey, string>>
      clearRouteApiKeys?: AiModelRouteKey[]
    },
  ) => void | Promise<void>
  onAiProviderConfigsChange: Dispatch<SetStateAction<AiProviderConfig[]>>
  onExportBackup: () => void
  onSignOut: () => void
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>
  onCreateToken: (label: string, expiresInDays: number | null, scope: TokenScope) => void
  onToggleToken: (tokenId: string, disabled: boolean) => void
  onDeleteToken: (tokenId: string) => void
  onCopyToken: (token: string) => void
}) {
  const [tokenLabel, setTokenLabel] = useState('')
  const [tokenExpiry, setTokenExpiry] = useState('permanent')
  const [tokenScope, setTokenScope] = useState<TokenScope>('viewer')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupItems, setNewGroupItems] = useState<Record<string, string>>({})
  const [addingItemGroup, setAddingItemGroup] = useState<string | null>(null)
  const [activeDesignGroup, setActiveDesignGroup] = useState('')
  const [isAddingGroup, setIsAddingGroup] = useState(false)
  const [groupNameDrafts, setGroupNameDrafts] = useState<Record<string, string>>({})
  const [editingItem, setEditingItem] = useState<{ groupName: string; item: string } | null>(null)
  const [itemEditDraft, setItemEditDraft] = useState('')
  const [serviceCompanyDraft, setServiceCompanyDraft] = useState(serviceCompanyName)
  const [pdfTitleDraft, setPdfTitleDraft] = useState(pdfTitle)
  const [aiModeDraft, setAiModeDraft] = useState<AiModelConfig['mode']>(aiModelConfig?.mode ?? 'deepseek-direct')
  const [aiProviderDraft, setAiProviderDraft] = useState<AiModelConfig['provider']>(aiModelConfig?.provider ?? 'deepseek')
  const [aiBaseUrlDraft, setAiBaseUrlDraft] = useState(aiModelConfig?.baseUrl ?? 'https://api.deepseek.com')
  const [aiModelDraft, setAiModelDraft] = useState(aiModelConfig?.model ?? 'deepseek-v4-flash')
  const [aiRuntimeUrlDraft, setAiRuntimeUrlDraft] = useState(aiModelConfig?.runtimeUrl ?? '')
  const [aiApiKeyDraft, setAiApiKeyDraft] = useState('')
  const [aiRouteDrafts, setAiRouteDrafts] = useState(aiRoutesFromConfig(aiModelConfig))
  const [aiRouteKeyDrafts, setAiRouteKeyDrafts] = useState<Partial<Record<AiModelRouteKey, string>>>({})
  const [testingAiRoute, setTestingAiRoute] = useState<AiModelRouteKey | null>(null)
  const [aiRouteTestResults, setAiRouteTestResults] = useState<Partial<Record<AiModelRouteKey, { ok: boolean; message: string }>>>({})
  const [aiCapabilityTab, setAiCapabilityTab] = useState<'text' | 'vision'>('text')
  const [orFreeModels, setOrFreeModels] = useState<OpenRouterFreeModel[]>([])
  const [orScannedAt, setOrScannedAt] = useState('')
  const [orScanning, setOrScanning] = useState(false)
  const [orError, setOrError] = useState('')
  const [agentMetrics, setAgentMetrics] = useState<AgentRunMetrics | null>(null)
  const [aiOperations, setAiOperations] = useState<AiOperationsCenter | null>(null)
  const [aiOperationsBusy, setAiOperationsBusy] = useState('')
  const [aiAlertBusy, setAiAlertBusy] = useState('')
  const [aiWorkspaces, setAiWorkspaces] = useState<WorkspaceSummary[]>([])
  const [aiWorkspaceSwitching, setAiWorkspaceSwitching] = useState(false)
  const [aiWorkspaceMessage, setAiWorkspaceMessage] = useState('')
  const [agentMetricsDays, setAgentMetricsDays] = useState<7 | 30>(7)
  const [agentMetricsLoading, setAgentMetricsLoading] = useState(false)
  const [agentMetricsError, setAgentMetricsError] = useState('')
  const [agentFailures, setAgentFailures] = useState<AgentFailureCase[]>([])
  const [agentFailurePolicy, setAgentFailurePolicy] = useState('')
  const [agentFailureBusy, setAgentFailureBusy] = useState('')
  const [settingsTab, setSettingsTab] = useState<SettingsTab>(initialTab)
  const [securityTab, setSecurityTab] = useState<'tokens' | 'account'>('tokens')
  const [aiRouteModelOptions, setAiRouteModelOptions] = useState<Partial<Record<AiModelRouteKey, string[]>>>({})
  const [fetchingModelsRoute, setFetchingModelsRoute] = useState<AiModelRouteKey | null>(null)
  const [aiRouteModelError, setAiRouteModelError] = useState<Partial<Record<AiModelRouteKey, string>>>({})
  const [isAiModelSaving, setIsAiModelSaving] = useState(false)
  const [draggingGroupName, setDraggingGroupName] = useState('')
  const [draggingItem, setDraggingItem] = useState<{ groupName: string; item: string } | null>(null)
  const [settingsConfirmDialog, setSettingsConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [isSettingsConfirmDialogBusy, setIsSettingsConfirmDialogBusy] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [isPasswordSaving, setIsPasswordSaving] = useState(false)
  const [aiProviderConfigs, setAiProviderConfigs] = useState<AiProviderConfig[]>(initialAiProviderConfigs)
  const [aiProvidersLoading, setAiProvidersLoading] = useState(false)
  const [providerModal, setProviderModal] = useState<AiModelProvider | null>(null)
  const [providerBaseUrlDraft, setProviderBaseUrlDraft] = useState('')
  const [providerApiKeyDraft, setProviderApiKeyDraft] = useState('')
  const [providerKeyVisible, setProviderKeyVisible] = useState(false)
  const [providerModelsDraft, setProviderModelsDraft] = useState<string[]>([])
  const [providerDefaultModelDraft, setProviderDefaultModelDraft] = useState('')
  const [providerEnabledDraft, setProviderEnabledDraft] = useState(false)
  const [providerBusy, setProviderBusy] = useState<'load' | 'save' | ''>('')
  const [providerNotice, setProviderNotice] = useState('')
  const [providerModelFilter, setProviderModelFilter] = useState('')
  const [providerModelView, setProviderModelView] = useState<'recommended' | 'all' | AiModelCategory>('recommended')
  const [providerError, setProviderError] = useState('')

  const tokenStatus = (token: AccessToken) => {
    if (token.disabled) {
      return { label: '已停用', className: 'status-不计费' }
    }
    if (token.expired) {
      return { label: '已过期', className: 'status-待验收' }
    }
    return { label: '有效', className: 'status-已验收' }
  }

  const tokenScopeOptions: Array<{ value: TokenScope; label: string; desc: string }> = [
    { value: 'collaborator', label: '协作者', desc: '看管理员所见的全部数据，可记进展、传附件、改任务基本信息；不能删除/作废任务、锁定结算、改 AI Key、管理口令、改密码、导出或清空数据。' },
    { value: 'viewer', label: '只读全局', desc: '看管理员所见的全部数据，但完全只读——什么都改不了。适合给对接测试或老板审阅。' },
    { value: 'client', label: '合作伙伴', desc: '看当月任务、进展、交付件和当月结算回单（含金额），只读；看不到往月与全年财务、看不到后台配置。' },
    { value: 'guest', label: '对客访客', desc: '只看进展和对客可见的交付件，只读。适合对外分享。' },
    { value: 'mcp-read', label: 'MCP 只读', desc: '仅允许外部 AI 客户端通过 MCP 查询任务、财务、工时和任务详情；不能登录网站，也不能执行任何写入。' },
  ]
  const tokenScopeLabel = (scope: TokenScope) => tokenScopeOptions.find((option) => option.value === scope)?.label ?? scope
  const activeTokenScope = tokenScopeOptions.find((option) => option.value === tokenScope)

  const handleCreate = () => {
    const expiresInDays = tokenExpiry === 'permanent' ? null : Number(tokenExpiry)
    onCreateToken(tokenLabel.trim() || '未命名口令', expiresInDays, tokenScope)
    setTokenLabel('')
  }

  const savePdfTitle = () => {
    const value = pdfTitleDraft.trim()
    if (value && value !== pdfTitle) {
      onPdfTitleChange(value)
    }
    if (!value) {
      setPdfTitleDraft(defaultPdfTitle)
      onPdfTitleChange(defaultPdfTitle)
    }
  }

  const saveServiceCompanyName = () => {
    const value = serviceCompanyDraft.trim()
    if (value && value !== serviceCompanyName) {
      onServiceCompanyNameChange(value)
    }
    if (!value) {
      setServiceCompanyDraft(defaultServiceCompanyName)
      onServiceCompanyNameChange(defaultServiceCompanyName)
    }
  }

  const addDesignTypeGroup = () => {
    const value = newGroupName.trim()
    if (!value || designTypeGroups.some((group) => group.name === value)) {
      return
    }
    onDesignTypeGroupsChange([...designTypeGroups, { name: value, color: nextUnusedDesignTypeColor(designTypeGroups), items: [] }])
    setNewGroupName('')
  }

  const updateDesignTypeGroupColor = (groupName: string, color: string) => {
    const nextColor = validDesignTypeColor(color)
    if (!nextColor) {
      return
    }
    onDesignTypeGroupsChange(designTypeGroups.map((group) => (group.name === groupName ? { ...group, color: nextColor } : group)))
  }

  const performDeleteDesignTypeGroup = async (name: string) => {
    if (designTypeGroups.length <= 1) {
      return
    }
    await onDesignTypeGroupsChange(designTypeGroups.filter((group) => group.name !== name))
    setGroupNameDrafts((current) => {
      const next = { ...current }
      delete next[name]
      return next
    })
    setNewGroupItems((current) => {
      const next = { ...current }
      delete next[name]
      return next
    })
    setActiveDesignGroup((current) => (current === name ? '' : current))
  }

  const requestDeleteDesignTypeGroup = (name: string) => {
    const group = designTypeGroups.find((item) => item.name === name)
    if (!group || designTypeGroups.length <= 1) {
      return
    }
    setSettingsConfirmDialog({
      eyebrow: '删除设计类型大类',
      title: `确定删除「${name}」吗？`,
      body: '删除大类后，这个大类下的子类会一起从新建任务的选择器中移除。已创建任务的历史记录不会被删除，但后续新建任务不能再选择这些类型。',
      confirmText: '确认删除',
      tone: 'danger',
      details: [`${group.items.length} 个子类`, '影响后续新建任务选项'],
      onConfirm: () => performDeleteDesignTypeGroup(name),
    })
  }

  const renameDesignTypeGroup = (oldName: string) => {
    const nextName = (groupNameDrafts[oldName] ?? oldName).trim()
    if (!nextName || nextName === oldName || designTypeGroups.some((group) => group.name === nextName && group.name !== oldName)) {
      setGroupNameDrafts((current) => ({ ...current, [oldName]: oldName }))
      return
    }
    onDesignTypeGroupsChange(designTypeGroups.map((group) => (group.name === oldName ? { ...group, name: nextName } : group)))
    setGroupNameDrafts((current) => {
      const next = { ...current }
      delete next[oldName]
      return { ...next, [nextName]: nextName }
    })
    setNewGroupItems((current) => {
      const { [oldName]: oldDraft, ...rest } = current
      return oldDraft === undefined ? rest : { ...rest, [nextName]: oldDraft }
    })
    setDraggingGroupName((current) => (current === oldName ? nextName : current))
    setActiveDesignGroup((current) => (current === oldName ? nextName : current))
    setDraggingItem((current) => (current?.groupName === oldName ? { ...current, groupName: nextName } : current))
  }

  const renameDesignTypeItem = (groupName: string, oldItem: string) => {
    const nextItem = itemEditDraft.trim()
    setEditingItem(null)
    setItemEditDraft('')
    if (!nextItem || nextItem === oldItem) return
    if (designTypeGroups.find((g) => g.name === groupName)?.items.includes(nextItem)) return
    onDesignTypeGroupsChange(
      designTypeGroups.map((g) =>
        g.name === groupName ? { ...g, items: g.items.map((it) => (it === oldItem ? nextItem : it)) } : g,
      ),
    )
  }

  const addDesignTypeItem = (groupName: string) => {
    const value = (newGroupItems[groupName] ?? '').trim()
    if (!value) {
      return
    }
    onDesignTypeGroupsChange(
      designTypeGroups.map((group) => (group.name === groupName ? { ...group, items: [...group.items, value] } : group)),
    )
    setNewGroupItems((current) => ({ ...current, [groupName]: '' }))
  }

  const performDeleteDesignTypeItem = async (groupName: string, item: string) => {
    await onDesignTypeGroupsChange(
      designTypeGroups.map((group) => (group.name === groupName ? { ...group, items: group.items.filter((value) => value !== item) } : group)),
    )
  }

  const requestDeleteDesignTypeItem = (groupName: string, item: string) => {
    setSettingsConfirmDialog({
      eyebrow: '删除设计类型子类',
      title: `确定删除「${item}」吗？`,
      body: '删除后，这个子类会从新建任务的设计类型选择器中移除。已创建任务不会被删除，历史任务仍会保留原来的类型文字。',
      confirmText: '确认删除',
      tone: 'danger',
      details: [`所属大类：${groupName}`, '影响后续新建任务选项'],
      onConfirm: () => performDeleteDesignTypeItem(groupName, item),
    })
  }

  const handleSettingsConfirm = async () => {
    if (!settingsConfirmDialog || isSettingsConfirmDialogBusy) {
      return
    }
    setIsSettingsConfirmDialogBusy(true)
    try {
      await settingsConfirmDialog.onConfirm()
      setSettingsConfirmDialog(null)
    } finally {
      setIsSettingsConfirmDialogBusy(false)
    }
  }

  useEffect(() => {
    setAiModeDraft(aiModelConfig?.mode ?? 'deepseek-direct')
    setAiProviderDraft(aiModelConfig?.provider ?? 'deepseek')
    setAiBaseUrlDraft(aiModelConfig?.baseUrl ?? 'https://api.deepseek.com')
    setAiModelDraft(aiModelConfig?.model ?? 'deepseek-v4-flash')
    setAiRuntimeUrlDraft(aiModelConfig?.runtimeUrl ?? '')
    setAiApiKeyDraft('')
    setAiRouteDrafts(aiRoutesFromConfig(aiModelConfig))
    setAiRouteKeyDrafts({})
  }, [aiModelConfig])

  useEffect(() => {
    setAiProviderConfigs(initialAiProviderConfigs)
  }, [initialAiProviderConfigs])

  const loadAiProviderConfigs = useCallback(async () => {
    setAiProvidersLoading(true)
    try {
      const result = await api.getAiProviderConfigs()
      setAiProviderConfigs(result.providers)
      onAiProviderConfigsChange(result.providers)
    } catch (error) {
      setProviderError(error instanceof Error ? error.message : '服务商配置读取失败')
    } finally {
      setAiProvidersLoading(false)
    }
  }, [onAiProviderConfigsChange])

  useEffect(() => {
    if (settingsTab === 'ai' && role === 'admin') void loadAiProviderConfigs()
  }, [loadAiProviderConfigs, role, settingsTab])

  const providerConfigMap = useMemo(() => new Map(aiProviderConfigs.map((config) => [config.provider, config])), [aiProviderConfigs])
  const activeProviderConfigs = useMemo(
    () => aiProviderConfigs.filter((config) => config.enabled && config.hasApiKey && config.models.includes(config.defaultModel)),
    [aiProviderConfigs],
  )

  const openProviderConfig = (provider: AiModelProvider) => {
    const config = providerConfigMap.get(provider)
    setProviderModal(provider)
    setProviderBaseUrlDraft(config?.baseUrl || directBaseUrlForProvider(provider))
    setProviderApiKeyDraft('')
    setProviderKeyVisible(false)
    setProviderModelsDraft(config?.models || [])
    setProviderDefaultModelDraft(config?.defaultModel || config?.models[0] || '')
    setProviderEnabledDraft(config?.enabled ?? false)
    setProviderError('')
    setProviderNotice(config?.models.length ? `当前已保存 ${config.models.length} 个模型` : '')
    setProviderModelFilter('')
    setProviderModelView('recommended')
  }

  // 「推荐」视图：只看文字对话模型，折叠有主版本的日期快照/预览版，剔除老旧代际，按代际新旧排序。
  // 规则随每次「加载模型」返回的最新列表即时计算：新代际自动排最前，其快照自动折叠。
  const providerRecommendedModels = useMemo(() => {
    const modelSet = new Set(providerModelsDraft)
    const stripSuffix = (model: string) => model
      .replace(/-(20\d{2}-\d{2}-\d{2}|\d{3,6})$/, '')
      .replace(/-(preview|latest)$/i, '')
    const legacySeries = /^(qwen-(?:1\.8b|7b|14b|72b)-chat$|qwen1\.5-|qwen2-|qwen2\.5-|qwen3-\d|qwen3-next-|qwq-32b)/i
    const nicheText = /math|(^|-)mt-|translate|character|deep-research|deep-search/i
    const filtered = providerModelsDraft.filter((model) => {
      if (classifyAiModel(model).category !== 'text') return false
      if (legacySeries.test(model) || nicheText.test(model)) return false
      const base = stripSuffix(model)
      if (base !== model && modelSet.has(base)) return false
      return true
    })
    // 版本号从去掉日期/预览后缀的名字里提取，跳过 27b 这类参数规模和 2025 这类年份。
    const seriesVersion = (model: string) => {
      for (const token of stripSuffix(model).match(/\d+(?:\.\d+)?b?/gi) || []) {
        if (!/b$/i.test(token)) {
          const value = parseFloat(token)
          if (value < 100) return value
        }
      }
      return 0
    }
    return [...filtered].sort((a, b) => seriesVersion(b) - seriesVersion(a) || a.localeCompare(b))
  }, [providerModelsDraft])

  const providerModelCategoryCounts = useMemo(() => {
    const counts = new Map<AiModelCategory, number>()
    providerModelsDraft.forEach((model) => {
      const { category } = classifyAiModel(model)
      counts.set(category, (counts.get(category) || 0) + 1)
    })
    return counts
  }, [providerModelsDraft])

  const providerModelTabsVisible = providerModelsDraft.length > 12
    && providerRecommendedModels.length > 0
    && providerRecommendedModels.length < providerModelsDraft.length

  const providerFilteredModels = useMemo(() => {
    const base = !providerModelTabsVisible || providerModelView === 'all'
      ? providerModelsDraft
      : providerModelView === 'recommended'
        ? providerRecommendedModels
        : providerModelsDraft.filter((model) => classifyAiModel(model).category === providerModelView)
    const keyword = providerModelFilter.trim().toLowerCase()
    if (!keyword) return base
    return base.filter((model) => model.toLowerCase().includes(keyword))
  }, [providerModelFilter, providerModelsDraft, providerModelTabsVisible, providerModelView, providerRecommendedModels])

  const loadProviderModels = async () => {
    if (!providerModal || providerBusy) return
    setProviderBusy('load')
    setProviderError('')
    setProviderNotice('')
    try {
      const result = await api.listAiProviderModels({
        provider: providerModal,
        baseUrl: providerBaseUrlDraft.trim(),
        apiKey: providerApiKeyDraft.trim() || undefined,
      })
      setProviderBaseUrlDraft(result.baseUrl)
      setProviderModelsDraft(result.models)
      setProviderDefaultModelDraft((current) => result.models.includes(current) ? current : result.models[0] || '')
      setProviderEnabledDraft(result.models.length > 0)
      if (!result.models.length) setProviderError('该服务商没有返回可用模型')
      else setProviderNotice(`加载成功，共 ${result.models.length} 个模型，请在下方选择默认模型后保存`)
      setProviderModelFilter('')
      setProviderModelView('recommended')
    } catch (error) {
      setProviderError(error instanceof Error ? error.message : '模型列表加载失败')
    } finally {
      setProviderBusy('')
    }
  }

  const saveProviderConfig = async () => {
    if (!providerModal || providerBusy) return
    setProviderBusy('save')
    setProviderError('')
    try {
      const saved = await api.setAiProviderConfig(providerModal, {
        baseUrl: providerBaseUrlDraft.trim(),
        apiKey: providerApiKeyDraft.trim() || undefined,
        models: providerModelsDraft,
        defaultModel: providerDefaultModelDraft,
        enabled: providerEnabledDraft,
      })
      setAiProviderConfigs((current) => [...current.filter((item) => item.provider !== saved.provider), saved])
      onAiProviderConfigsChange((current) => [...current.filter((item) => item.provider !== saved.provider), saved])
      if (saved.defaultModel) {
        const nextRoutes = Object.fromEntries(Object.entries(aiRouteDrafts).map(([route, endpoint]) => [
          route,
          endpoint.provider === saved.provider ? { ...endpoint, baseUrl: saved.baseUrl, model: saved.defaultModel } : endpoint,
        ])) as Record<AiModelRouteKey, Pick<AiModelEndpointConfig, 'provider' | 'baseUrl' | 'model'>>
        const routeChanged = Object.keys(nextRoutes).some((route) => nextRoutes[route as AiModelRouteKey].model !== aiRouteDrafts[route as AiModelRouteKey].model)
        if (routeChanged) {
          setAiRouteDrafts(nextRoutes)
          await onAiModelConfigChange({ routes: nextRoutes })
        }
      }
      setProviderModal(null)
    } catch (error) {
      setProviderError(error instanceof Error ? error.message : '服务商配置保存失败')
    } finally {
      setProviderBusy('')
    }
  }

  const selectDefaultProviderModel = async (route: 'textPrimary' | 'visionPrimary', value: string) => {
    const [providerRaw, ...modelParts] = value.split('::')
    const provider = providerRaw as AiModelProvider
    const model = modelParts.join('::')
    const config = providerConfigMap.get(provider)
    if (!config || !model) return
    const nextRoutes = {
      ...aiRouteDrafts,
      [route]: { provider, baseUrl: config.baseUrl, model },
    }
    setAiRouteDrafts(nextRoutes)
    await onAiModelConfigChange({ routes: nextRoutes })
  }

  const loadAgentMetrics = useCallback(async (days: 7 | 30 = agentMetricsDays) => {
    setAgentMetricsLoading(true)
    setAgentMetricsError('')
    try {
      const [metrics, failures, operations, workspaceResult] = await Promise.all([
        api.getAgentRunMetrics(days),
        api.getAgentFailures(),
        api.getAiOperationsCenter(days),
        api.getWorkspaces(),
      ])
      setAgentMetrics(metrics)
      setAiOperations(operations)
      setAgentFailures(failures.cases)
      setAgentFailurePolicy(failures.policy)
      setAiWorkspaces(workspaceResult.workspaces)
    } catch (error) {
      setAgentMetricsError(error instanceof Error ? error.message : 'Agent 运行指标读取失败')
    } finally {
      setAgentMetricsLoading(false)
    }
  }, [agentMetricsDays])

  const updateOperationsJob = async (jobId: string, action: 'retry' | 'cancel') => {
    setAiOperationsBusy(jobId)
    setAgentMetricsError('')
    try {
      const response = await fetch(`/api/ai/analysis-jobs/${encodeURIComponent(jobId)}/${action}`, { method: 'POST' })
      const payload = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(payload.error || '后台任务操作失败')
      await loadAgentMetrics()
    } catch (error) {
      setAgentMetricsError(error instanceof Error ? error.message : '后台任务操作失败')
    } finally {
      setAiOperationsBusy('')
    }
  }

  const updateOperationsAlert = async (alertId: string, status: 'acknowledged' | 'resolved') => {
    setAiAlertBusy(alertId)
    setAgentMetricsError('')
    try {
      await api.updateAiOperationAlert(alertId, status)
      await loadAgentMetrics()
    } catch (error) {
      setAgentMetricsError(error instanceof Error ? error.message : '告警状态更新失败')
    } finally {
      setAiAlertBusy('')
    }
  }

  const switchAiWorkspace = async (workspaceId: string) => {
    if (!workspaceId || workspaceId === aiOperations?.workspace.id) return
    setAiWorkspaceSwitching(true)
    setAgentMetricsError('')
    setAiWorkspaceMessage('')
    try {
      await api.switchWorkspace(workspaceId)
      window.location.reload()
    } catch (error) {
      setAgentMetricsError(error instanceof Error ? error.message : '工作区切换失败')
      setAiWorkspaceSwitching(false)
    }
  }

  const createAiWorkspace = async (name: string) => {
    const value = name.trim()
    if (!value) return
    setAiWorkspaceSwitching(true)
    setAgentMetricsError('')
    setAiWorkspaceMessage('')
    try {
      const result = await api.createWorkspace(value)
      setAiWorkspaceMessage(`已创建工作区：${result.workspace.name}`)
      await loadAgentMetrics()
    } catch (error) {
      setAgentMetricsError(error instanceof Error ? error.message : '工作区创建失败')
    } finally {
      setAiWorkspaceSwitching(false)
    }
  }

  const addAiWorkspaceMember = async (workspaceId: string, email: string, memberRole: string) => {
    const value = email.trim()
    if (!workspaceId || !value) return
    setAiWorkspaceSwitching(true)
    setAgentMetricsError('')
    setAiWorkspaceMessage('')
    try {
      const result = await api.addWorkspaceMember(workspaceId, { email: value, role: memberRole })
      setAiWorkspaceMessage(result.invited ? `已发送成员邀请：${value}` : `已添加成员：${value}`)
      await loadAgentMetrics()
    } catch (error) {
      setAgentMetricsError(error instanceof Error ? error.message : '成员添加失败')
    } finally {
      setAiWorkspaceSwitching(false)
    }
  }

  const updateAgentFailure = async (failure: AgentFailureCase, status: AgentFailureCase['regressionStatus']) => {
    setAgentFailureBusy(failure.fingerprint)
    try {
      const result = await api.updateAgentFailure(failure.fingerprint, status, status === 'covered' ? '已纳入自动化回归或人工验证。' : '')
      setAgentFailures(result.cases)
      setAgentFailurePolicy(result.policy)
    } catch (error) {
      setAgentMetricsError(error instanceof Error ? error.message : '失败案例更新失败')
    } finally {
      setAgentFailureBusy('')
    }
  }

  useEffect(() => {
    if (settingsTab === 'ai' && role === 'admin') void loadAgentMetrics()
  }, [loadAgentMetrics, role, settingsTab])

  const updateAiRouteDraft = (route: AiModelRouteKey, changes: Partial<Pick<AiModelEndpointConfig, 'provider' | 'baseUrl' | 'model'>>) => {
    setAiRouteDrafts((current) => {
      const next = { ...current[route], ...changes }
      if (changes.provider && changes.provider !== current[route].provider) {
        // 切换供应商时自动联动 Base URL（默认走 AI Gateway）与默认模型，省去手填。
        next.baseUrl = baseUrlForProvider(changes.provider)
        const fallbackModel = defaultModelForProvider(changes.provider)
        if (fallbackModel) {
          next.model = fallbackModel
        }
      }
      return { ...current, [route]: next }
    })
    if (changes.provider) {
      // 供应商变了，之前拉取的模型列表失效，清空避免误导。
      setAiRouteModelOptions((options) => ({ ...options, [route]: undefined }))
      setAiRouteModelError((errors) => ({ ...errors, [route]: undefined }))
    }
  }

  const fetchRouteModels = async (route: AiModelRouteKey) => {
    if (fetchingModelsRoute) {
      return
    }
    setFetchingModelsRoute(route)
    setAiRouteModelError((errors) => ({ ...errors, [route]: undefined }))
    try {
      const draft = aiRouteDrafts[route]
      const result = await api.listAiModels(route, { ...draft, apiKey: aiRouteKeyDrafts[route] })
      if (result.provider !== draft.provider) {
        throw new Error(`供应商校验失败：当前选择 ${draft.provider}，接口却返回 ${result.provider}`)
      }
      setAiRouteModelOptions((options) => ({ ...options, [route]: result.models }))
      if (!result.models.length) {
        setAiRouteModelError((errors) => ({ ...errors, [route]: '该供应商没有返回可用模型' }))
      }
    } catch (error) {
      setAiRouteModelError((errors) => ({ ...errors, [route]: error instanceof Error ? error.message : '获取模型失败' }))
    } finally {
      setFetchingModelsRoute(null)
    }
  }

  useEffect(() => {
    // 进入设置即加载已缓存的 OpenRouter 免费模型扫描结果（cron 每日刷新）
    api.getOpenRouterFreeModels()
      .then((result) => {
        setOrFreeModels(result.models)
        setOrScannedAt(result.scannedAt)
      })
      .catch(() => {})
  }, [])

  const scanFreeModels = async () => {
    if (orScanning) {
      return
    }
    setOrScanning(true)
    setOrError('')
    try {
      const result = await api.scanOpenRouterFreeModels()
      setOrFreeModels(result.models)
      setOrScannedAt(result.scannedAt)
      if (!result.models.length) {
        setOrError('没拉到免费模型，请确认已配置 OpenRouter Key')
      }
    } catch (error) {
      setOrError(error instanceof Error ? error.message : '扫描失败')
    } finally {
      setOrScanning(false)
    }
  }

  const applyFreeModelToRoute = (routeKey: AiModelRouteKey, modelId: string) => {
    setAiRouteDrafts((current) => ({
      ...current,
      [routeKey]: { provider: 'openrouter', baseUrl: directBaseUrlForProvider('openrouter'), model: modelId },
    }))
  }

  const saveAiModelConfig = async (clearApiKey = false, clearRouteApiKey?: AiModelRouteKey) => {
    if (isAiModelSaving) {
      return
    }
    setIsAiModelSaving(true)
    try {
      await onAiModelConfigChange({
        mode: aiModeDraft,
        provider: aiProviderDraft,
        baseUrl: aiBaseUrlDraft.trim(),
        model: aiModelDraft.trim(),
        runtimeUrl: aiRuntimeUrlDraft.trim(),
        apiKey: clearApiKey ? undefined : aiApiKeyDraft.trim() || undefined,
        clearApiKey,
        routes: aiRouteDrafts,
        routeApiKeys: Object.fromEntries(Object.entries(aiRouteKeyDrafts).filter(([, value]) => value?.trim())) as Partial<Record<AiModelRouteKey, string>>,
        clearRouteApiKeys: clearRouteApiKey ? [clearRouteApiKey] : undefined,
      })
      setAiApiKeyDraft('')
      setAiRouteKeyDrafts({})
    } finally {
      setIsAiModelSaving(false)
    }
  }

  const testAiRoute = async (route: AiModelRouteKey, capability: 'text' | 'vision') => {
    if (testingAiRoute) {
      return
    }
    setTestingAiRoute(route)
    setAiRouteTestResults((current) => ({ ...current, [route]: { ok: false, message: '测试中…' } }))
    try {
      const result = await api.testAiModelRoute({ route, capability })
      setAiRouteTestResults((current) => ({
        ...current,
        [route]: { ok: true, message: `${result.provider} / ${result.model} 可用：${result.output}` },
      }))
    } catch (error) {
      setAiRouteTestResults((current) => ({
        ...current,
        [route]: { ok: false, message: error instanceof Error ? error.message : '模型测试失败' },
      }))
    } finally {
      setTestingAiRoute(null)
    }
  }

  const submitPasswordChange = async () => {
    if (isPasswordSaving) {
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('新密码至少需要 8 位')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的新密码不一致')
      return
    }
    setIsPasswordSaving(true)
    setPasswordError('')
    try {
      await onChangePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : '密码更新失败')
    } finally {
      setIsPasswordSaving(false)
    }
  }

  const moveDesignTypeGroup = (targetName: string) => {
    if (!draggingGroupName || draggingGroupName === targetName) {
      return
    }
    const fromIndex = designTypeGroups.findIndex((group) => group.name === draggingGroupName)
    const toIndex = designTypeGroups.findIndex((group) => group.name === targetName)
    if (fromIndex < 0 || toIndex < 0) {
      return
    }
    const nextGroups = [...designTypeGroups]
    const [moved] = nextGroups.splice(fromIndex, 1)
    nextGroups.splice(toIndex, 0, moved)
    onDesignTypeGroupsChange(nextGroups)
  }

  const moveDesignTypeItem = (targetGroupName: string, targetItem: string) => {
    if (!draggingItem || draggingItem.groupName !== targetGroupName || draggingItem.item === targetItem) {
      return
    }
    const nextGroups = designTypeGroups.map((group) => {
      if (group.name !== targetGroupName) {
        return group
      }
      const items = [...group.items]
      const fromIndex = items.indexOf(draggingItem.item)
      const toIndex = items.indexOf(targetItem)
      if (fromIndex < 0 || toIndex < 0) {
        return group
      }
      const [moved] = items.splice(fromIndex, 1)
      items.splice(toIndex, 0, moved)
      return { ...group, items }
    })
    onDesignTypeGroupsChange(nextGroups)
  }

  const activeGroup = designTypeGroups.find((group) => group.name === activeDesignGroup) ?? designTypeGroups[0]

  return (
    <section className="settings-grid">
      <div className="settings-tabs view-mode-tabs">
        <button type="button" className={settingsTab === 'appearance' ? 'active' : ''} onClick={() => setSettingsTab('appearance')}>
          <Palette size={16} />
          外观
        </button>
        <button type="button" className={settingsTab === 'settlement' ? 'active' : ''} onClick={() => setSettingsTab('settlement')}>
          <Briefcase size={16} />
          结算设置
        </button>
        {role === 'admin' && (
          <button type="button" className={settingsTab === 'ai' ? 'active' : ''} onClick={() => setSettingsTab('ai')}>
            <Zap size={16} />
            模型
          </button>
        )}
        <button type="button" className={settingsTab === 'local-cli' ? 'active' : ''} onClick={() => setSettingsTab('local-cli')}>
          <Bot size={16} />
          本机 CLI
        </button>
        {role === 'admin' && (
          <button type="button" className={settingsTab === 'design' ? 'active' : ''} onClick={() => setSettingsTab('design')}>
            <Tag size={16} />
            设计类型
          </button>
        )}
        <button type="button" className={settingsTab === 'security' ? 'active' : ''} onClick={() => setSettingsTab('security')}>
          <ShieldCheck size={16} />
          权限安全
        </button>
        <button type="button" className={settingsTab === 'system' ? 'active' : ''} onClick={() => setSettingsTab('system')}>
          <Settings size={16} />
          系统
        </button>
      </div>
      {settingsTab === 'appearance' && (
        <GivernyModeSettings />
      )}
      {settingsTab === 'settlement' && (
        <div className="settings-group-body settings-tab-body">
          <section className="panel settings-settlement-panel">
            <div className="panel-header compact">
              <div>
                <h2>结算设置</h2>
                <p>用于自动计算月度费用，已锁定的结算单不受影响</p>
              </div>
            </div>
            <div className="form-grid settings-form">
              <label className="field">
                <span>小时单价（元 / 小时）</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={hourlyRate}
                  onChange={(event) => onRateChange(Math.max(0, Number.parseFloat(event.target.value) || 0))}
                />
              </label>
              <label className="field">
                <span>服务公司名称</span>
                <input
                  value={serviceCompanyDraft}
                  placeholder="例如：昂楷科技"
                  onChange={(event) => setServiceCompanyDraft(event.target.value)}
                  onBlur={saveServiceCompanyName}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur()
                    }
                  }}
                />
              </label>
              <label className="field">
                <span>计税方式</span>
                <select value={taxMode} onChange={(event) => onTaxModeChange(event.target.value as TaxMode)}>
                  <option value="salary">工资薪金</option>
                  <option value="labor">劳务报酬</option>
                </select>
              </label>
              <label className="field wide">
                <span>PDF 抬头</span>
                <input
                  value={pdfTitleDraft}
                  placeholder="例如：设计服务工时结算回单"
                  onChange={(event) => setPdfTitleDraft(event.target.value)}
                  onBlur={savePdfTitle}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur()
                    }
                  }}
                />
              </label>
            </div>
          </section>
        </div>
      )}
      {settingsTab === 'local-cli' && (
        <Suspense fallback={<p className="calendar-empty-hint">正在载入本机 CLI 设置…</p>}>
          <LocalCliConnectionPanel renderCliIcon={(cliId) => <AiBrandIcon brand={aiBrandForValue(cliId)} size={20} />} />
        </Suspense>
      )}
      {settingsTab === 'ai' && role === 'admin' && (
        <div className="settings-group-body settings-tab-body">
            <section className="panel model-provider-dashboard">
              <div className="model-defaults-head">
                <div>
                  <span className="model-section-kicker"><Zap size={15} /> 全站生效</span>
                  <h2>默认模型</h2>
                  <p>只展示已启用且成功加载模型的服务商。</p>
                </div>
                {aiProvidersLoading && <span className="model-provider-loading"><LoaderCircle size={14} /> 读取中</span>}
              </div>
              <div className="model-default-grid">
                {([
                  { route: 'textPrimary' as const, label: '文字模型', description: '任务文案、进展、验收、工时与工作助手默认使用' },
                  { route: 'visionPrimary' as const, label: '图片模型', description: '截图、PDF 页面、PPT 和交付件图片分析默认使用' },
                ]).map((item) => {
                  const selectableConfigs = activeProviderConfigs
                    .filter((config) => item.route === 'textPrimary' || providerSupportsVision(config.provider))
                  const selectedRoute = aiRouteDrafts[item.route]
                  const selectedValue = selectableConfigs.some((config) => (
                    config.provider === selectedRoute.provider && config.defaultModel === selectedRoute.model
                  )) ? `${selectedRoute.provider}::${selectedRoute.model}` : ''
                  return (
                    <label className="model-default-field" key={item.route}>
                      <span>{item.label}</span>
                      <GivernySelect
                        value={selectedValue}
                        placeholder="请先配置并启用服务商"
                        ariaLabel={`${item.label} ${item.description}`}
                        options={selectableConfigs.map((config) => ({
                          value: `${config.provider}::${config.defaultModel}`,
                          label: config.defaultModel,
                          group: aiProviderOptions.find((option) => option.value === config.provider)?.label || config.provider,
                          icon: aiProviderIconMap[config.provider]
                            ? <img className="giverny-select-brand-icon" src={aiProviderIconMap[config.provider]} alt="" />
                            : <Sparkles className="giverny-select-brand-icon" size={18} />,
                        }))}
                        onChange={(value) => void selectDefaultProviderModel(item.route, value)}
                      />
                      <small>{item.description}</small>
                    </label>
                  )
                })}
              </div>

              {([
                { title: '文字模型服务商', providers: aiProviderOptions },
                { title: '图片识别服务商', providers: aiProviderOptions.filter((option) => providerSupportsVision(option.value)) },
              ]).map((section) => (
                <div className="model-provider-section" key={section.title}>
                  <div className="model-provider-section-head">
                    <h3>{section.title}</h3>
                    <span>{section.providers.filter((option) => providerConfigMap.get(option.value)?.enabled).length} 家已启用</span>
                  </div>
                  <div className="model-provider-grid">
                    {section.providers.map((option) => {
                      const config = providerConfigMap.get(option.value)
                      const active = Boolean(config?.enabled && config.hasApiKey && config.models.length)
                      const icon = aiProviderIconMap[option.value]
                      return (
                        <button type="button" className="model-provider-card" key={`${section.title}-${option.value}`} onClick={() => openProviderConfig(option.value)}>
                          <span className="model-provider-card-main">
                            <span className="model-provider-icon">{icon ? <img src={icon} alt="" /> : <Sparkles size={19} />}</span>
                            <span><strong>{option.label}</strong><small>{config?.models.length ? `${config.models.length} 个模型` : '尚未加载模型'}</small></span>
                          </span>
                          <i className={active ? 'active' : ''} title={active ? '已激活' : '未激活'} />
                          <span className="model-provider-configure">{active ? '已配置' : '点击配置'} <ChevronRight size={14} /></span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              {providerError && !providerModal && <p className="settings-inline-error">{providerError}</p>}
            </section>
            <Suspense fallback={<section className="panel settings-ai-panel ai-operations-panel"><p className="calendar-empty-hint">正在载入 AI 运行中心…</p></section>}>
              <AiOperationsCenterPanel
                operations={aiOperations}
                loading={agentMetricsLoading}
                jobBusyId={aiOperationsBusy}
                alertBusyId={aiAlertBusy}
                workspaces={aiWorkspaces}
                workspaceSwitching={aiWorkspaceSwitching}
                workspaceMessage={aiWorkspaceMessage}
                onRefresh={() => void loadAgentMetrics()}
                onJobAction={(jobId, action) => void updateOperationsJob(jobId, action)}
                onAlertAction={(alertId, status) => void updateOperationsAlert(alertId, status)}
                onWorkspaceChange={(workspaceId) => void switchAiWorkspace(workspaceId)}
                onWorkspaceCreate={(name) => void createAiWorkspace(name)}
                onWorkspaceMemberAdd={(workspaceId, email, memberRole) => void addAiWorkspaceMember(workspaceId, email, memberRole)}
              />
            </Suspense>
            <section className="panel settings-ai-panel agent-quality-panel">
              <div className="panel-header compact agent-quality-header">
                <div>
                  <h2>Agent 运行质量</h2>
                  <p>仅统计意图、工具、耗时与结果状态，不保存问题、回答、任务名或确认草稿</p>
                </div>
                <div className="agent-quality-actions">
                  <div className="agent-quality-period" aria-label="统计周期">
                    {([7, 30] as const).map((days) => (
                      <button
                        key={days}
                        type="button"
                        className={agentMetricsDays === days ? 'active' : ''}
                        aria-pressed={agentMetricsDays === days}
                        onClick={() => setAgentMetricsDays(days)}
                      >
                        {days} 天
                      </button>
                    ))}
                  </div>
                  <button type="button" className="ghost-button compact-button" disabled={agentMetricsLoading} onClick={() => void loadAgentMetrics()}>
                    <RotateCcw size={14} />
                    {agentMetricsLoading ? '刷新中…' : '刷新'}
                  </button>
                </div>
              </div>
              {agentMetricsError && <p className="settings-inline-error">{agentMetricsError}</p>}
              {!agentMetrics && agentMetricsLoading && <p className="calendar-empty-hint">正在读取 Agent 运行指标…</p>}
              {agentMetrics && (
                <>
                  <div className="agent-quality-metrics" aria-label={`最近 ${agentMetrics.periodDays} 天 Agent 指标`}>
                    <article>
                      <span>总运行</span>
                      <strong>{agentMetrics.summary.totalRuns}</strong>
                      <small>{agentMetrics.periodDays} 天真实请求</small>
                    </article>
                    <article>
                      <span>运行成功率</span>
                      <strong>{agentMetrics.summary.totalRuns ? `${agentMetrics.summary.successRate}%` : '—'}</strong>
                      <small>{agentMetrics.summary.errorRuns} 次失败</small>
                    </article>
                    <article>
                      <span>P95 响应</span>
                      <strong>{formatAgentMetricDuration(agentMetrics.summary.p95DurationMs)}</strong>
                      <small>平均 {formatAgentMetricDuration(agentMetrics.summary.avgDurationMs)}</small>
                    </article>
                    <article>
                      <span>工具调用率</span>
                      <strong>{agentMetrics.summary.totalRuns ? `${agentMetrics.summary.toolUseRate}%` : '—'}</strong>
                      <small>{agentMetrics.summary.approvalRuns} 次审批 · {agentMetrics.summary.selectionRuns} 次消歧</small>
                    </article>
                    <article>
                      <span>估算 Token</span>
                      <strong>{(agentMetrics.summary.promptTokens + agentMetrics.summary.completionTokens).toLocaleString('zh-CN')}</strong>
                      <small>输入 {agentMetrics.summary.promptTokens.toLocaleString('zh-CN')} · 输出 {agentMetrics.summary.completionTokens.toLocaleString('zh-CN')}</small>
                    </article>
                    <article>
                      <span>参考成本</span>
                      <strong>¥ {agentMetrics.summary.estimatedCostCny.toFixed(4)}</strong>
                      <small>按模型内置参考单价估算，不代替供应商账单</small>
                    </article>
                  </div>
                  <div className="agent-quality-details">
                    <div>
                      <h3>请求类型</h3>
                      {agentMetrics.intents.length > 0 ? (
                        <div className="agent-quality-list">
                          {agentMetrics.intents.slice(0, 6).map((item) => (
                            <div key={item.name}><span>{agentMetricIntentLabels[item.name] || item.name}</span><strong>{item.count}</strong></div>
                          ))}
                        </div>
                      ) : <p className="calendar-empty-hint">当前周期还没有运行记录。</p>}
                    </div>
                    <div>
                      <h3>工具调用</h3>
                      {agentMetrics.tools.length > 0 ? (
                        <div className="agent-quality-list">
                          {agentMetrics.tools.slice(0, 6).map((item) => (
                            <div key={item.name}><code>{item.name}</code><strong>{item.count}</strong></div>
                          ))}
                        </div>
                      ) : <p className="calendar-empty-hint">当前周期还没有工具调用。</p>}
                    </div>
                    <div>
                      <h3>质量信号</h3>
                      <div className="agent-quality-list">
                        <div><span>候选消歧</span><strong>{agentMetrics.summary.selectionRuns}</strong></div>
                        <div><span>模型回落</span><strong>{agentMetrics.summary.fallbackRuns}</strong></div>
                        <div><span>执行失败</span><strong>{agentMetrics.summary.errorRuns}</strong></div>
                      </div>
                    </div>
                  </div>
                  <div className={`agent-tuning-advice ${agentMetrics.tuning.eligible ? 'ready' : ''}`}>
                    <div>
                      <h3>模型调优建议</h3>
                      <p>{agentMetrics.tuning.reason}</p>
                    </div>
                    {agentMetrics.tuning.suggestions.length > 0 ? <ul>{agentMetrics.tuning.suggestions.map((item) => <li key={item}>{item}</li>)}</ul> : <small>继续积累真实使用数据，达到门槛后再给出建议。</small>}
                  </div>
                  {agentMetrics.models.length > 0 && (
                    <div className="agent-model-performance">
                      <h3>模型表现</h3>
                      <div className="agent-model-performance-head"><span>模型</span><span>运行</span><span>成功率</span><span>平均响应</span><span>Token</span><span>参考成本</span></div>
                      {agentMetrics.models.map((model) => <div key={model.name}><strong>{model.name}</strong><span>{model.runs}</span><span>{model.successRate}%</span><span>{formatAgentMetricDuration(model.avgDurationMs)}</span><span>{model.tokens.toLocaleString('zh-CN')}</span><span>¥{model.estimatedCostCny.toFixed(4)}</span></div>)}
                    </div>
                  )}
                  <details className="agent-failure-learning" open={agentFailures.some((item) => item.regressionStatus === 'required')}>
                    <summary>失败学习与回归 <span>{agentFailures.filter((item) => item.regressionStatus === 'required').length} 项待覆盖</span></summary>
                    <p>{agentFailurePolicy || '仅保存匿名失败类型、工具和状态，不保存用户业务内容。'}</p>
                    {agentFailures.length === 0 ? <p className="calendar-empty-hint">当前没有记录到失败案例。</p> : <div className="agent-failure-case-list">
                      {agentFailures.slice(0, 20).map((failure) => (
                        <article key={failure.fingerprint}>
                          <div className="agent-failure-case-main">
                            <strong>{agentMetricIntentLabels[failure.intent] || failure.intent}</strong>
                            <span>{failure.category} · {failure.toolName || '无工具'} · HTTP {failure.httpStatus}</span>
                            <small>{failure.occurrences} 次 · 最近 {failure.lastSeenAt.replace('T', ' ').slice(0, 16)}</small>
                          </div>
                          <div className="agent-failure-case-actions">
                            <span className={`status-${failure.regressionStatus}`}>{failure.regressionStatus === 'required' ? '待回归' : failure.regressionStatus === 'covered' ? '已覆盖' : failure.regressionStatus === 'ignored' ? '已忽略' : '候选'}</span>
                            <button type="button" className="ghost-button compact-button" disabled={agentFailureBusy === failure.fingerprint} onClick={() => void updateAgentFailure(failure, 'required')}>加入回归</button>
                            <button type="button" className="primary-button compact-button" disabled={agentFailureBusy === failure.fingerprint} onClick={() => void updateAgentFailure(failure, 'covered')}>标记覆盖</button>
                            <button type="button" className="ghost-button compact-button" disabled={agentFailureBusy === failure.fingerprint} onClick={() => void updateAgentFailure(failure, 'ignored')}>忽略</button>
                          </div>
                        </article>
                      ))}
                    </div>}
                  </details>
                  {agentMetrics.recentFailures.length > 0 && (
                    <details className="agent-quality-failures">
                      <summary>最近失败记录 <span>{agentMetrics.recentFailures.length}</span></summary>
                      <div>
                        {agentMetrics.recentFailures.map((item) => (
                          <p key={`${item.createdAt}-${item.intent}`}>
                            <span>{item.createdAt.replace('T', ' ').slice(0, 16)}</span>
                            <strong>{agentMetricIntentLabels[item.intent] || item.intent}</strong>
                            <em>HTTP {item.status} · {formatAgentMetricDuration(item.durationMs)}</em>
                          </p>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              )}
            </section>
            <section className="panel settings-ai-panel settings-ai-legacy-panel">
              <div className="panel-header compact">
                <div>
                  <h2>AI 模型设置</h2>
                  <p>按「文字模型 / 识图模型」分类，各自配置主力与备用；切换供应商会自动联动 Base URL（默认走 AI Gateway）</p>
                </div>
              </div>
              <div className="settings-ai-tabs">
                <button
                  type="button"
                  className={aiCapabilityTab === 'text' ? 'active' : ''}
                  onClick={() => setAiCapabilityTab('text')}
                >
                  文字模型
                </button>
                <button
                  type="button"
                  className={aiCapabilityTab === 'vision' ? 'active' : ''}
                  onClick={() => setAiCapabilityTab('vision')}
                >
                  识图模型
                </button>
              </div>
              <div className="form-grid settings-form settings-ai-form">
                <label className="field">
                  <span>运行模式</span>
                  <select value={aiModeDraft} onChange={(event) => setAiModeDraft(event.target.value as AiModelConfig['mode'])}>
                    <option value="deepseek-direct">直连 / AI Gateway</option>
                    <option value="baml-runtime">BAML Runtime</option>
                  </select>
                </label>
                {aiModeDraft === 'baml-runtime' && (
                  <>
                    <label className="field wide">
                      <span>BAML Runtime URL</span>
                      <input
                        value={aiRuntimeUrlDraft}
                        placeholder="例如：https://ai-runtime.example.com"
                        onChange={(event) => setAiRuntimeUrlDraft(event.target.value)}
                      />
                    </label>
                    <label className="field wide">
                      <span>BAML Runtime 模型 Key</span>
                      <input
                        type="password"
                        value={aiApiKeyDraft}
                        placeholder={aiModelConfig?.hasApiKey ? `已保存：${aiModelConfig.apiKeyPreview ?? '已保存'}` : '可选，输入后加密保存'}
                        onChange={(event) => setAiApiKeyDraft(event.target.value)}
                      />
                    </label>
                  </>
                )}
              </div>
              <div className="settings-ai-routes">
                {aiRouteMeta.filter((route) => route.capability === aiCapabilityTab).map((route) => {
                  const draft = aiRouteDrafts[route.key]
                  const saved = aiModelConfig?.[route.key]
                  const testResult = aiRouteTestResults[route.key]
                  const modelOptions = aiRouteModelOptions[route.key]
                  const modelError = aiRouteModelError[route.key]
                  return (
                    <article className="settings-ai-route-card" key={route.key}>
                      <div className="settings-ai-route-head">
                        <div>
                          <strong>{route.title}</strong>
                          <span>{route.description}</span>
                        </div>
                        <em className={saved?.hasApiKey ? 'ready' : ''}>
                          {saved?.hasApiKey ? (saved.keySource === 'environment' ? '环境 Key' : '已保存 Key') : '未配置 Key'}
                        </em>
                      </div>
                      <div className="form-grid settings-form settings-ai-route-form">
                        <label className="field">
                          <span>供应商</span>
                          <select value={draft.provider} onChange={(event) => updateAiRouteDraft(route.key, { provider: event.target.value as AiModelConfig['provider'] })}>
                            {aiProviderOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span className="settings-ai-baseurl-label">
                            Base URL
                            {gatewayBaseUrlForProvider(draft.provider) && (
                              <button
                                type="button"
                                className="settings-ai-url-toggle"
                                onClick={() =>
                                  updateAiRouteDraft(route.key, {
                                    baseUrl: isGatewayBaseUrl(draft.baseUrl)
                                      ? directBaseUrlForProvider(draft.provider)
                                      : gatewayBaseUrlForProvider(draft.provider),
                                  })
                                }
                              >
                                {isGatewayBaseUrl(draft.baseUrl) ? '改为直连' : '改走网关'}
                              </button>
                            )}
                          </span>
                          <input value={draft.baseUrl} onChange={(event) => updateAiRouteDraft(route.key, { baseUrl: event.target.value })} />
                          <small className="settings-ai-model-hint">
                            {isGatewayBaseUrl(draft.baseUrl) ? '当前走 AI Gateway（缓存 / 重试 / 用量看板）' : '当前为官方直连'}，改完点「测试」确认是否可用
                          </small>
                        </label>
                        <label className="field">
                          <span>模型</span>
                          <div className="settings-ai-model-pick">
                            <input
                              value={draft.model}
                              name={`ai-model-${route.key}`}
                              autoComplete="off"
                              autoCorrect="off"
                              autoCapitalize="off"
                              spellCheck={false}
                              data-1p-ignore="true"
                              data-lpignore="true"
                              placeholder={defaultModelForProvider(draft.provider) || '输入模型名称'}
                              onChange={(event) => updateAiRouteDraft(route.key, { model: event.target.value })}
                            />
                            <button
                              type="button"
                              className="ghost-button compact-button"
                              onClick={() => void fetchRouteModels(route.key)}
                              disabled={fetchingModelsRoute === route.key}
                            >
                              {fetchingModelsRoute === route.key ? '获取中…' : '获取模型'}
                            </button>
                          </div>
                          {modelOptions && modelOptions.length > 0 && (
                            <select
                              className="settings-ai-model-select"
                              value={modelOptions.includes(draft.model) ? draft.model : ''}
                              onChange={(event) => {
                                if (event.target.value) {
                                  updateAiRouteDraft(route.key, { model: event.target.value })
                                }
                              }}
                            >
                              <option value="">已拉取 {modelOptions.length} 个模型，选择以填入…</option>
                              {modelOptions.map((model) => (
                                <option key={model} value={model}>{model}</option>
                              ))}
                            </select>
                          )}
                          {modelError && <small className="settings-inline-error">{modelError}</small>}
                        </label>
                        <label className="field">
                          <span className="settings-ai-baseurl-label">
                            API Key
                            {officialApiKeyUrlForProvider(draft.provider) && (
                              <a
                                className="settings-ai-key-link"
                                href={officialApiKeyUrlForProvider(draft.provider)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                获取官方 API Key
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </span>
                          <input
                            type="password"
                            value={aiRouteKeyDrafts[route.key] ?? ''}
                            placeholder={saved?.hasApiKey ? `已配置：${saved.apiKeyPreview ?? '已保存'}` : '输入后加密保存'}
                            onChange={(event) => setAiRouteKeyDrafts((current) => ({ ...current, [route.key]: event.target.value }))}
                          />
                        </label>
                      </div>
                      <div className="settings-ai-route-actions">
                        {testResult && <p className={testResult.ok ? 'settings-test-ok' : 'settings-inline-error'}>{testResult.message}</p>}
                        <div>
                          {saved?.keySource === 'setting' && (
                            <button className="ghost-button compact-button" type="button" onClick={() => void saveAiModelConfig(false, route.key)} disabled={isAiModelSaving}>
                              清除 Key
                            </button>
                          )}
                          <button className="ghost-button compact-button" type="button" onClick={() => void testAiRoute(route.key, route.capability)} disabled={testingAiRoute === route.key}>
                            {testingAiRoute === route.key ? '测试中…' : '测试'}
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
              <div className="settings-ai-meta">
                <p className="settings-tool-note">
                  {aiModelConfig?.encryptionReady
                    ? '设置页填写的 API Key 会加密保存在 D1；平台默认 Key 优先放在 Cloudflare Secret，前端只显示保存状态。'
                    : '生产环境还没有配置 AI_SETTINGS_SECRET，暂不能安全保存租户自带 API Key。'}
                </p>
                {aiModeDraft === 'baml-runtime' && !aiModelConfig?.runtimeConfigured && (
                  <p className="settings-inline-error">启用 BAML Runtime 前，需要配置 Runtime URL 或部署环境变量 AI_RUNTIME_URL。</p>
                )}
                <div className="settings-ai-actions">
                  {aiModelConfig?.hasApiKey && (
                    <button className="ghost-button compact-button" type="button" onClick={() => void saveAiModelConfig(true)} disabled={isAiModelSaving}>
                      清除 Key
                    </button>
                  )}
                  <button className="soft-primary-button" type="button" onClick={() => void saveAiModelConfig()} disabled={isAiModelSaving || !aiModelDraft.trim()}>
                    <Sparkles size={17} />
                    {isAiModelSaving ? '保存中…' : '保存 AI 设置'}
                  </button>
                </div>
              </div>
              <details className="settings-workers-ai">
                <summary>
                  <Sparkles size={15} />
                  <span>Workers AI · Cloudflare 自带模型（终极兜底 / 未来全量迁移）</span>
                  <ChevronDown size={16} />
                </summary>
                <div className="settings-workers-ai-body">
                  <p>
                    Workers AI 是 Cloudflare 在边缘 GPU 上托管的一批开源模型（Llama、Qwen、Mistral、Flux 文生图、Whisper 语音、Embedding 等），
                    <strong>无需任何外部厂商账号或 API Key</strong>，从 Worker 里一行 <code>env.AI.run(...)</code> 即可调用，按用量计费且每天有免费额度。
                  </p>
                  <ul>
                    <li><strong>计费单位：Neurons</strong>，<strong>$0.011 / 1,000 Neurons</strong>；每个模型把 token / 生成步数 / 音频秒数折算成 Neurons。</li>
                    <li><strong>每天免费 10,000 Neurons</strong>（Free 与 Paid 计划都送，按天重置），轻量任务基本白嫖。</li>
                    <li>示例：Llama 3.1 8B 约 $0.03 / 百万输入 token、$0.20 / 百万输出 token；Embedding 极便宜；Flux 文生图按张/步计费；Whisper 按音频时长。</li>
                  </ul>
                  <p className="settings-tool-note">
                    规划：等外部付费模型用完后，把全站 AI 切到 Workers AI，省去逐家采购对接。当前可作为「DeepSeek/Gemini → Kimi → Workers AI」链路的<strong>最后一道兜底</strong>，
                    需要时由开发侧在 Worker 加 <code>[ai]</code> 绑定即可启用（暂未开启）。
                  </p>
                </div>
              </details>
              <details className="settings-workers-ai" open>
                <summary>
                  <Sparkles size={15} />
                  <span>OpenRouter 免费模型（每日自动实测可用性）</span>
                  <ChevronDown size={16} />
                </summary>
                <div className="settings-workers-ai-body">
                  <div className="or-free-head">
                    <p className="settings-tool-note">
                      一个 OpenRouter Key 即可调大量 <code>:free</code> 免费模型，但它们经常变动。系统每天自动「拉取 + 逐个实测」，下面只标出真实可用的；点「立即扫描」可手动刷新。
                      {orScannedAt ? <> 上次扫描：{orScannedAt}。</> : null}
                    </p>
                    <button type="button" className="ghost-button compact-button" onClick={() => void scanFreeModels()} disabled={orScanning}>
                      <RotateCcw size={14} />
                      {orScanning ? '扫描中…（约 10-20 秒）' : '立即扫描'}
                    </button>
                  </div>
                  {orError && <p className="settings-inline-error">{orError}</p>}
                  {orFreeModels.length === 0 && !orScanning && <p className="calendar-empty-hint">还没有扫描结果，点「立即扫描」获取。</p>}
                  {orFreeModels.length > 0 && (
                    <div className="or-free-list">
                      {orFreeModels.map((model) => {
                        const statusLabel = model.status === 'ok' ? '可用' : model.status === 'limited' ? '限流' : model.status === 'unavailable' ? '已下架' : '异常'
                        return (
                          <div className={`or-free-row status-${model.status}`} key={model.id}>
                            <div className="or-free-main">
                              <code>{model.id}</code>
                              <div className="or-free-meta">
                                <span className={`or-free-status status-${model.status}`}>{statusLabel}</span>
                                {model.vision && <span className="or-free-vision">可识图</span>}
                                {model.context > 0 && <span>{Math.round(model.context / 1000)}K 上下文</span>}
                              </div>
                            </div>
                            {model.status === 'ok' && (
                              <div className="or-free-actions">
                                <button type="button" className="ghost-button compact-button" onClick={() => applyFreeModelToRoute('textFallback', model.id)}>设为文字备用</button>
                                {model.vision && (
                                  <button type="button" className="ghost-button compact-button" onClick={() => applyFreeModelToRoute('visionFallback', model.id)}>设为识图备用</button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <p className="settings-tool-note">提示：点「设为文字/识图备用」会把对应路由切到该免费模型，记得在上方点「保存 AI 设置」。免费档有速率上限，建议只作备用兜底。</p>
                </div>
              </details>
            </section>
        </div>
      )}
      {settingsTab === 'design' && role === 'admin' && (
        <div className="settings-group-body settings-tab-body">
            <section className="panel settings-design-panel">
              <div className="panel-header compact">
                <div>
                  <h2>设计类型</h2>
                  <p>新建任务时使用二级选择器：大类 / 子类，管理员可自定义增删</p>
                </div>
              </div>
              <div className="design-type-tabs" role="tablist">
                {designTypeGroups.map((group) => (
                  <button
                    type="button"
                    role="tab"
                    key={group.name}
                    aria-selected={activeGroup?.name === group.name}
                    className={`design-type-tab ${activeGroup?.name === group.name ? 'active' : ''} ${draggingGroupName === group.name ? 'dragging' : ''}`}
                    draggable
                    onDragStart={() => setDraggingGroupName(group.name)}
                    onDragEnd={() => setDraggingGroupName('')}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => moveDesignTypeGroup(group.name)}
                    onClick={() => setActiveDesignGroup(group.name)}
                  >
                    <GripVertical size={13} />
                    <i className="design-type-tab-swatch" style={{ '--design-type-color': validDesignTypeColor(group.color) || designTypeColorForIndex(0) } as CSSProperties} />
                    <span>{group.name}</span>
                    <em>{group.items.length}</em>
                  </button>
                ))}
                {isAddingGroup ? (
                  <input
                    className="design-type-tab-add-input"
                    autoFocus
                    value={newGroupName}
                    placeholder="大类名称，回车添加"
                    onChange={(event) => setNewGroupName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        addDesignTypeGroup()
                      }
                      if (event.key === 'Escape') {
                        setNewGroupName('')
                        setIsAddingGroup(false)
                      }
                    }}
                    onBlur={() => {
                      addDesignTypeGroup()
                      setIsAddingGroup(false)
                    }}
                  />
                ) : (
                  <button type="button" className="design-type-tab-add" aria-label="添加大类" onClick={() => setIsAddingGroup(true)}>
                    <Plus size={15} />
                  </button>
                )}
              </div>
              {activeGroup && (
                <div className="design-type-active">
                  <div className="design-type-active-head">
                    <input
                      className="design-type-group-name-input"
                      aria-label={`设计类型大类名称：${activeGroup.name}`}
                      value={groupNameDrafts[activeGroup.name] ?? activeGroup.name}
                      onChange={(event) => setGroupNameDrafts((current) => ({ ...current, [activeGroup.name]: event.target.value }))}
                      onBlur={() => renameDesignTypeGroup(activeGroup.name)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.currentTarget.blur()
                        }
                        if (event.key === 'Escape') {
                          setGroupNameDrafts((current) => ({ ...current, [activeGroup.name]: activeGroup.name }))
                          event.currentTarget.blur()
                        }
                      }}
                    />
                    <div className="design-type-color-editor" aria-label={`${activeGroup.name} 日历颜色`}>
                      <span className="design-type-color-current" style={{ '--design-type-color': validDesignTypeColor(activeGroup.color) || designTypeColorForIndex(0) } as CSSProperties} />
                      <div className="design-type-color-options">
                        {designTypeColorPalette.map((color) => (
                          <button
                            type="button"
                            key={color}
                            className={validDesignTypeColor(activeGroup.color) === color.toLowerCase() ? 'active' : ''}
                            aria-label={`设置 ${activeGroup.name} 颜色为 ${color}`}
                            title={color}
                            style={{ '--design-type-color': color } as CSSProperties}
                            onClick={() => updateDesignTypeGroupColor(activeGroup.name, color)}
                          />
                        ))}
                      </div>
                    </div>
                    <small>{activeGroup.items.length} 个子类</small>
                    <button
                      className="icon-button danger-icon"
                      aria-label={`删除设计类型大类 ${activeGroup.name}`}
                      disabled={designTypeGroups.length <= 1}
                      onClick={() => requestDeleteDesignTypeGroup(activeGroup.name)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="design-type-list plain">
                    {activeGroup.items.map((item) => {
                      const isEditingThisItem = editingItem?.groupName === activeGroup.name && editingItem.item === item
                      return isEditingThisItem ? (
                        <input
                          key={item}
                          className="design-type-item-edit-input"
                          autoFocus
                          value={itemEditDraft}
                          onChange={(e) => setItemEditDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') renameDesignTypeItem(activeGroup.name, item)
                            if (e.key === 'Escape') { setEditingItem(null); setItemEditDraft('') }
                          }}
                          onBlur={() => renameDesignTypeItem(activeGroup.name, item)}
                        />
                      ) : (
                        <span
                          className={`design-type-item ${draggingItem?.groupName === activeGroup.name && draggingItem.item === item ? 'dragging' : ''}`}
                          draggable
                          key={item}
                          onDragStart={() => setDraggingItem({ groupName: activeGroup.name, item })}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => moveDesignTypeItem(activeGroup.name, item)}
                          onDragEnd={() => setDraggingItem(null)}
                        >
                          {item}
                          <button
                            aria-label={`重命名设计类型 ${activeGroup.name} / ${item}`}
                            onClick={() => { setEditingItem({ groupName: activeGroup.name, item }); setItemEditDraft(item) }}
                          >
                            <Pencil size={10} />
                          </button>
                          <button aria-label={`删除设计类型 ${activeGroup.name} / ${item}`} onClick={() => requestDeleteDesignTypeItem(activeGroup.name, item)}>
                            <X size={12} />
                          </button>
                        </span>
                      )
                    })}
                    {addingItemGroup === activeGroup.name ? (
                      <input
                        className="design-type-item-add-input"
                        autoFocus
                        value={newGroupItems[activeGroup.name] ?? ''}
                        placeholder="子类名称，回车添加"
                        onChange={(event) => setNewGroupItems((current) => ({ ...current, [activeGroup.name]: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            addDesignTypeItem(activeGroup.name)
                          }
                          if (event.key === 'Escape') {
                            setNewGroupItems((current) => ({ ...current, [activeGroup.name]: '' }))
                            setAddingItemGroup(null)
                          }
                        }}
                        onBlur={() => {
                          addDesignTypeItem(activeGroup.name)
                          setAddingItemGroup(null)
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="design-type-item-add"
                        aria-label={`为 ${activeGroup.name} 添加子类`}
                        onClick={() => setAddingItemGroup(activeGroup.name)}
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>
        </div>
      )}

      {settingsTab === 'security' && (
        <div className="settings-tab-body">
          {role === 'admin' && (
            <div className="settings-tabs view-mode-tabs settings-subtabs">
              <button type="button" className={securityTab === 'tokens' ? 'active' : ''} onClick={() => setSecurityTab('tokens')}>
                <KeyRound size={15} />
                口令管理
              </button>
              <button type="button" className={securityTab === 'account' ? 'active' : ''} onClick={() => setSecurityTab('account')}>
                <UserCircle size={15} />
                账号安全
              </button>
            </div>
          )}
          {role === 'admin' && securityTab === 'tokens' && (
            <section className="settings-subsection settings-permission-panel">
              <div className="panel-header compact">
                <div>
                  <h2>口令管理</h2>
                  <p>生成或停用后台访问口令</p>
                </div>
              </div>
              <div className="token-create">
                <label className="field">
                  <span>备注</span>
                  <input value={tokenLabel} placeholder="例如：协作设计师 / 合作伙伴财务 / 对接测试" onChange={(event) => setTokenLabel(event.target.value)} />
                </label>
                <label className="field">
                  <span>权限</span>
                  <select value={tokenScope} onChange={(event) => setTokenScope(event.target.value as TokenScope)}>
                    {tokenScopeOptions.map((option) => (
                      <option key={option.value} value={option.value} title={option.desc}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>有效期</span>
                  <select value={tokenExpiry} onChange={(event) => setTokenExpiry(event.target.value)}>
                    <option value="permanent">永久有效</option>
                    <option value="7">7 天</option>
                    <option value="30">30 天</option>
                    <option value="90">90 天</option>
                  </select>
                </label>
                <button className="soft-primary-button" onClick={handleCreate}>
                  <KeyRound size={17} />
                  申请口令
                </button>
              </div>
              {activeTokenScope && <p className="token-scope-hint"><strong>{activeTokenScope.label}</strong>：{activeTokenScope.desc}</p>}
              <div className="token-list">
                {accessTokens.length === 0 && <p className="calendar-empty-hint">还没有生成过口令。</p>}
                {accessTokens.map((token) => {
                  const status = tokenStatus(token)
                  return (
                    <div className={`token-row ${token.id === newTokenId ? 'fresh' : ''}`} key={token.id}>
                      <div className="token-row-main">
                        <strong>{token.label} <em className="token-scope-badge">{tokenScopeLabel(token.scope)}</em></strong>
                        <code>{token.token}</code>
                        <small>
                          创建于 {token.createdAt} · {token.expiresAt ? `${token.expiresAt} 到期` : '永久有效'}
                          {token.lastUsedAt ? ` · 最近使用 ${token.lastUsedAt}` : ' · 未使用过'}
                        </small>
                      </div>
                      <span className={`status-badge ${status.className}`}>{status.label}</span>
                      <div className="token-row-actions">
                        <button className="icon-button" aria-label="复制口令" onClick={() => onCopyToken(token.token)}>
                          <Copy size={15} />
                        </button>
                        <button
                          className="ghost-button compact-button"
                          onClick={() => onToggleToken(token.id, !token.disabled)}
                        >
                          {token.disabled ? '启用' : '停用'}
                        </button>
                        <button className="icon-button danger-icon" aria-label="删除口令" onClick={() => onDeleteToken(token.id)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
          {(role !== 'admin' || securityTab === 'account') && (
            <section className="settings-subsection settings-security-panel">
              <div className="panel-header compact">
                <div>
                  <h2>账号安全</h2>
                  <p>当前登录身份和退出操作</p>
                </div>
              </div>
              <p className="settings-tool-note">当前身份：{role === 'admin' ? '管理员（最高权限）' : '访问口令用户'}；公共电脑用完请退出。</p>
              {role === 'admin' && (
                <details className="settings-password-collapse">
                  <summary>
                    <KeyRound size={15} />
                    <span>修改密码</span>
                    <ChevronDown size={16} />
                  </summary>
                  <div className="password-change-form">
                    <label className="field">
                      <span>当前密码</span>
                      <input
                        type="password"
                        value={currentPassword}
                        placeholder="输入当前密码"
                        onChange={(event) => setCurrentPassword(event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>新密码</span>
                      <input
                        type="password"
                        value={newPassword}
                        placeholder="至少 8 位"
                        onChange={(event) => setNewPassword(event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>确认新密码</span>
                      <input
                        type="password"
                        value={confirmPassword}
                        placeholder="再次输入新密码"
                        onChange={(event) => setConfirmPassword(event.target.value)}
                      />
                    </label>
                    {passwordError && <p className="settings-inline-error">{passwordError}</p>}
                    <button className="ghost-button" onClick={() => void submitPasswordChange()} disabled={!currentPassword || !newPassword || !confirmPassword || isPasswordSaving}>
                      <KeyRound size={16} />
                      {isPasswordSaving ? '保存中…' : '修改密码'}
                    </button>
                  </div>
                </details>
              )}
              <button className="danger-button" onClick={onSignOut}>
                <LogOut size={17} />
                退出登录
              </button>
            </section>
          )}
        </div>
      )}

      {settingsTab === 'system' && (
        <div className="settings-group-body settings-system-body settings-tab-body">
          <section className="settings-subsection settings-backup-panel">
            <div className="panel-header compact">
              <div>
                <h2>数据备份</h2>
                <p>导出当前数据快照</p>
              </div>
            </div>
            <button className="ghost-button" onClick={onExportBackup}>
              <Download size={17} />
              导出备份 JSON
            </button>
          </section>
          <section className="settings-subsection settings-version-panel">
            <div className="panel-header compact">
              <div>
                <h2>产品版本</h2>
                <p>用于确认当前上线批次</p>
              </div>
            </div>
            <dl className="version-meta">
              <div>
                <dt>当前版本</dt>
                <dd>v{appVersion}</dd>
              </div>
              <div>
                <dt>发布时间</dt>
                <dd>{appReleaseDate}</dd>
              </div>
            </dl>
          </section>
          <section className="settings-subsection settings-cloudflare-panel cloudflare-details">
            <div className="panel-header compact">
              <div>
                <h2>系统资源</h2>
                <p>当前正式环境绑定信息</p>
              </div>
            </div>
            <div className="cloudflare-list">
              <span>Worker：designer-worklog（mayeai.com）</span>
              <span>D1：designer-worklog-db</span>
              <span>
                R2：designer-worklog-uploads · {formatStorageUsage(storageUsage)}
                {storageUsage ? ` · ${storageUsage.objectCount} 个对象` : ''}
              </span>
              <span>登录体系：管理员邮箱 + 管理密码，或后台生成的访问口令</span>
            </div>
          </section>
        </div>
      )}
      {providerModal && (
        <ModalShell className="model-provider-modal" labelledBy="model-provider-modal-title" onClose={() => setProviderModal(null)}>
          <div className="modal-header model-provider-modal-head">
            <div className="model-provider-modal-title">
              <span className="model-provider-icon large">
                {aiProviderIconMap[providerModal] ? <img src={aiProviderIconMap[providerModal]} alt="" /> : <Sparkles size={22} />}
              </span>
              <div>
                <h2 id="model-provider-modal-title">{aiProviderOptions.find((option) => option.value === providerModal)?.label} 设置</h2>
                <p>模型服务商</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={providerEnabledDraft}
              className={`giverny-toggle model-provider-enable ${providerEnabledDraft ? 'on' : ''}`}
              title={providerEnabledDraft ? '关闭该模型服务商' : '打开该模型服务商'}
              onClick={() => setProviderEnabledDraft((enabled) => !enabled)}
            >
              <span className="giverny-toggle-track"><span className="giverny-toggle-thumb" /></span>
              <span className="model-provider-enable-state">{providerEnabledDraft ? '打开' : '关闭'}</span>
            </button>
          </div>
          <div className="model-provider-modal-body">
            <label className="field wide">
              <span>Base URL</span>
              <input value={providerBaseUrlDraft} onChange={(event) => setProviderBaseUrlDraft(event.target.value)} placeholder={directBaseUrlForProvider(providerModal)} />
              {(providerModal === 'qwen' || providerModal === 'doubao') && (
                <small className="settings-ai-model-hint">可直接粘贴供应商显示的 API Host，系统会自动补全协议和兼容接口路径。</small>
              )}
              {providerModal === 'qwen' && providerBaseUrlDraft.includes('dashscope.aliyuncs.com') && (
                <small className="settings-ai-model-hint">新版业务空间 Key 请使用创建密钥时显示的专属 API Host；旧公共地址无法读取该空间授权的模型。</small>
              )}
            </label>
            <label className="field wide">
              <span className="settings-ai-baseurl-label">
                API Key
                {officialApiKeyUrlForProvider(providerModal) && <a href={officialApiKeyUrlForProvider(providerModal)} target="_blank" rel="noreferrer">获取官方密钥 <ExternalLink size={12} /></a>}
              </span>
              <div className="provider-key-input">
                <input
                  type={providerKeyVisible ? 'text' : 'password'}
                  value={providerApiKeyDraft}
                  onChange={(event) => setProviderApiKeyDraft(event.target.value)}
                  placeholder={providerConfigMap.get(providerModal)?.hasApiKey ? `已保存：${providerConfigMap.get(providerModal)?.apiKeyPreview || '已配置'}` : '输入 API Key'}
                />
                <button type="button" aria-label={providerKeyVisible ? '隐藏密钥' : '显示密钥'} onClick={() => setProviderKeyVisible((visible) => !visible)}>
                  {providerKeyVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            <div className="provider-model-load-row">
              <div><strong>模型列表</strong><span>验证密钥后，加载该服务商实际可用的模型</span></div>
              <button type="button" className="soft-primary-button" onClick={() => void loadProviderModels()} disabled={Boolean(providerBusy)}>
                {providerBusy === 'load' ? <LoaderCircle size={15} /> : <RotateCcw size={15} />}
                {providerBusy === 'load' ? '加载中…' : '加载模型'}
              </button>
            </div>
            {providerError && <p className="settings-inline-error">{providerError}</p>}
            {!providerError && providerNotice && <p className="settings-test-ok">{providerNotice}</p>}
            <div className="provider-model-list">
              {providerModelsDraft.length > 0 ? (
                <label className="provider-default-model-field">
                  <span className="provider-default-model-head">
                    默认模型
                    <em>{providerDefaultModelDraft ? `当前：${providerDefaultModelDraft}` : '尚未选择'}</em>
                  </span>
                  {providerModelTabsVisible && (
                    <div className="provider-model-tabs" role="tablist" aria-label="模型筛选">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={providerModelView === 'recommended'}
                        className={providerModelView === 'recommended' ? 'active' : ''}
                        onClick={() => setProviderModelView('recommended')}
                      >推荐 {providerRecommendedModels.length}</button>
                      {aiModelCategoryOrder.filter((category) => (providerModelCategoryCounts.get(category) || 0) > 0).map((category) => (
                        <button
                          type="button"
                          role="tab"
                          key={category}
                          aria-selected={providerModelView === category}
                          className={providerModelView === category ? 'active' : ''}
                          onClick={() => setProviderModelView(category)}
                        >{aiModelCategoryLabels[category]} {providerModelCategoryCounts.get(category)}</button>
                      ))}
                      <button
                        type="button"
                        role="tab"
                        aria-selected={providerModelView === 'all'}
                        className={providerModelView === 'all' ? 'active' : ''}
                        onClick={() => setProviderModelView('all')}
                      >全部 {providerModelsDraft.length}</button>
                    </div>
                  )}
                  {providerModelsDraft.length > 8 && (
                    <input
                      className="provider-model-search"
                      value={providerModelFilter}
                      onChange={(event) => setProviderModelFilter(event.target.value)}
                      placeholder={`搜索模型…`}
                    />
                  )}
                  <div className="provider-model-options" role="listbox" aria-label="选择服务商默认模型">
                    {providerFilteredModels.length > 0 ? providerFilteredModels.map((model) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={model === providerDefaultModelDraft}
                        className={model === providerDefaultModelDraft ? 'active' : ''}
                        key={model}
                        onClick={() => setProviderDefaultModelDraft(model)}
                      >
                        <span className="giverny-select-option-main">
                          {aiProviderIconMap[providerModal]
                            ? <img className="giverny-select-brand-icon" src={aiProviderIconMap[providerModal]} alt="" />
                            : <Sparkles className="giverny-select-brand-icon" size={18} />}
                          <span>{model}</span>
                        </span>
                        <span className="provider-model-note" title={classifyAiModel(model).note}>{classifyAiModel(model).note}</span>
                        {model === providerDefaultModelDraft && <CheckCircle2 size={15} />}
                      </button>
                    )) : (
                      <p className="provider-model-empty">
                        没有匹配“{providerModelFilter}”的模型
                        {providerModelTabsVisible && providerModelView === 'recommended' ? '，可切换到「全部」再找找' : ''}
                      </p>
                    )}
                  </div>
                  <small>共 {providerModelsDraft.length} 个模型，列表可滚动。全站模型选择器只展示默认模型；更换后会同步更新正在使用该服务商的路线。</small>
                </label>
              ) : <p>还没有模型。请填写密钥后点击“加载模型”。</p>}
            </div>
          </div>
          <div className="modal-footer model-provider-modal-actions">
            <button type="button" className="text-button model-provider-cancel" onClick={() => setProviderModal(null)}>取消</button>
            <button type="button" className="soft-primary-button" disabled={Boolean(providerBusy) || (providerEnabledDraft && (!providerModelsDraft.length || !providerDefaultModelDraft))} onClick={() => void saveProviderConfig()}>
              {providerBusy === 'save' ? '保存中…' : '保存配置'}
            </button>
          </div>
        </ModalShell>
      )}
      {settingsConfirmDialog && (
        <ConfirmDialogModal
          dialog={settingsConfirmDialog}
          isBusy={isSettingsConfirmDialogBusy}
          onClose={() => setSettingsConfirmDialog(null)}
          onConfirm={() => void handleSettingsConfirm()}
        />
      )}
    </section>
  )
}
