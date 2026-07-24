import { create } from 'zustand'
import type { AttachmentAnalysis, FileAsset } from '../types/domain'
import { resolveStateValue, type StateSetter, workspaceBootCache } from './storeUtils'

type FileStore = {
  fileItems: FileAsset[]
  attachmentAnalyses: AttachmentAnalysis[]
  setFileItems: StateSetter<FileAsset[]>
  setAttachmentAnalyses: StateSetter<AttachmentAnalysis[]>
  hydrateFileState: (state: Pick<FileStore, 'fileItems' | 'attachmentAnalyses'>) => void
}

export const workspaceBootAttachmentAnalyses = workspaceBootCache?.attachmentAnalyses ?? []

export const useFileStore = create<FileStore>((set) => ({
  fileItems: workspaceBootCache?.files ?? [],
  attachmentAnalyses: workspaceBootAttachmentAnalyses,
  setFileItems: (value) => set((state) => ({ fileItems: resolveStateValue(value, state.fileItems) })),
  setAttachmentAnalyses: (value) => set((state) => ({ attachmentAnalyses: resolveStateValue(value, state.attachmentAnalyses) })),
  hydrateFileState: ({ fileItems, attachmentAnalyses }) => set({ fileItems, attachmentAnalyses }),
}))
