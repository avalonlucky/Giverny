import { create } from 'zustand'
import {
  defaultDesignTypeGroups,
  defaultHourlyRate,
  defaultPdfTitle,
  defaultServiceCompanyName,
  type DesignTypeGroup,
} from '../config/appConfig'
import type { AiModelConfig, AiProviderConfig } from '../lib/api'
import type { BackendStatus } from '../hooks/useBackendRuntime'
import type { TaxMode } from '../types/domain'
import { resolveStateValue, type StateSetter, workspaceBootCache } from './storeUtils'

type SettingsStore = {
  hourlyRate: number
  pdfTitle: string
  serviceCompanyName: string
  taxMode: TaxMode
  designTypeGroups: DesignTypeGroup[]
  aiModelConfig: AiModelConfig | null
  aiProviderConfigs: AiProviderConfig[]
  backendStatus: BackendStatus
  setHourlyRate: StateSetter<number>
  setPdfTitle: StateSetter<string>
  setServiceCompanyName: StateSetter<string>
  setTaxMode: StateSetter<TaxMode>
  setDesignTypeGroups: StateSetter<DesignTypeGroup[]>
  setAiModelConfig: StateSetter<AiModelConfig | null>
  setAiProviderConfigs: StateSetter<AiProviderConfig[]>
  setBackendStatus: StateSetter<BackendStatus>
  hydrateSettingsState: (state: Pick<SettingsStore,
    'hourlyRate' | 'pdfTitle' | 'serviceCompanyName' | 'taxMode' | 'designTypeGroups' | 'aiModelConfig'
  >) => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  hourlyRate: workspaceBootCache?.settings?.hourlyRate ?? defaultHourlyRate,
  pdfTitle: workspaceBootCache?.settings?.pdfTitle || defaultPdfTitle,
  serviceCompanyName: workspaceBootCache?.settings?.serviceCompanyName || defaultServiceCompanyName,
  taxMode: workspaceBootCache?.settings?.taxMode ?? 'salary',
  designTypeGroups: workspaceBootCache?.settings?.designTypeGroups ?? defaultDesignTypeGroups,
  aiModelConfig: workspaceBootCache?.settings?.aiModel ?? null,
  aiProviderConfigs: [],
  backendStatus: '连接中',
  setHourlyRate: (value) => set((state) => ({ hourlyRate: resolveStateValue(value, state.hourlyRate) })),
  setPdfTitle: (value) => set((state) => ({ pdfTitle: resolveStateValue(value, state.pdfTitle) })),
  setServiceCompanyName: (value) => set((state) => ({ serviceCompanyName: resolveStateValue(value, state.serviceCompanyName) })),
  setTaxMode: (value) => set((state) => ({ taxMode: resolveStateValue(value, state.taxMode) })),
  setDesignTypeGroups: (value) => set((state) => ({ designTypeGroups: resolveStateValue(value, state.designTypeGroups) })),
  setAiModelConfig: (value) => set((state) => ({ aiModelConfig: resolveStateValue(value, state.aiModelConfig) })),
  setAiProviderConfigs: (value) => set((state) => ({ aiProviderConfigs: resolveStateValue(value, state.aiProviderConfigs) })),
  setBackendStatus: (value) => set((state) => ({ backendStatus: resolveStateValue(value, state.backendStatus) })),
  hydrateSettingsState: (state) => set({ ...state, backendStatus: '已接入 D1/R2' }),
}))
