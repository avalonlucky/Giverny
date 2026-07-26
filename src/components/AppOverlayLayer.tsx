import { lazy, Suspense, type ComponentProps, type CSSProperties } from 'react'
import type { DesignTypeGroup } from '../config/appConfig'
import type {
  ActivityItem,
  AiModelConfig,
  AiProviderConfig,
} from '../lib/api'
import { authedPreviewUrl } from '../lib/api'
import { fileThumbnailSource, fileTypeForAsset, isInlineImageFileType } from '../lib/fileTypes'
import { monthLabelOf } from '../lib/month'
import { taskSettlementMonth } from '../lib/taskSettlement'
import type { FileAsset, Task } from '../types/domain'
import type { DailyKnowledgeItem } from '../types/knowledge'
import type { ProgressRecordMode } from '../types/taskUi'
import type { ToastState } from '../lib/toastQueue'
import type { CommandPaletteAction, ShortcutHelpGroup } from './CommandPalette'
import { CommandPalette, ShortcutHelpModal } from './CommandPalette'
import type { ConfirmDialogState } from './ConfirmDialogModal'
import { ConfirmDialogModal } from './ConfirmDialogModal'
import { AdminLoginModal } from './AdminLoginModal'
import { AboutGivernyModal } from './AboutGivernyModal'
import { AttachmentHoverThumbnail } from './AttachmentHoverThumbnail'
import { DailyKnowledgeModal } from './DailyKnowledgeModal'
import { ModalShell } from './ModalShell'
import { NewTaskModal } from './NewTaskModal'
import { TaskDetailModal } from './TaskDetailModal'
import { TaskProgressModal } from './TaskProgressModal'
import { ToastIcon } from './ToastIcon'
import { VoidTaskModal } from './VoidTaskModal'

const SemanticSearchModal = lazy(() => import('./SemanticSearchModal'))
const ChatPanel = lazy(() => import('./ChatPanel').then((module) => ({ default: module.ChatPanel })))
const FilePreviewModal = lazy(() => import('./FilePreviewModal').then((module) => ({ default: module.FilePreviewModal })))

export type ProgressModalTarget = {
  taskId: number
  mode: ProgressRecordMode
  editEntryId?: string
  initialAcceptanceMode?: boolean
}

type Notify = (message: string, tone?: ToastState['tone'], options?: Pick<ToastState, 'actionLabel' | 'onAction' | 'durationMs'>) => void
type TaskProgressProps = ComponentProps<typeof TaskProgressModal>

export function AppOverlayLayer({
  dailyKnowledgeOpen,
  dailyKnowledge,
  dailyKnowledgeLoading,
  isAdmin,
  canUseAgent,
  onRefreshDailyKnowledge,
  onCloseDailyKnowledge,
  onFavoriteDailyKnowledge,
  commandPaletteOpen,
  commandPaletteInitialQuery,
  commandActions,
  onCloseCommandPalette,
  shortcutHelpOpen,
  shortcutHelpGroups,
  onCloseShortcutHelp,
  chatOpen,
  currentMonthValue,
  aiModelConfig,
  aiProviderConfigs,
  chatAnalysisFocusId,
  notify,
  onCloseChat,
  onOpenChatTask,
  semanticSearchOpen,
  files,
  tasks,
  onCloseSemanticSearch,
  onOpenSemanticTask,
  onOpenSemanticFile,
  createTaskOpen,
  newTaskSupplemental,
  designTypeGroups,
  onCloseCreateTask,
  onCreateTask,
  onDesignTypeGroupsChange,
  detailTaskId,
  onCloseTaskDetail,
  onOpenTaskAcceptance,
  onOpenTaskEditFromDetail,
  onOpenTaskProgressFromDetail,
  editTaskId,
  onCloseTaskEdit,
  onSaveTaskEdit,
  progressModalTarget,
  taskActivity,
  onCloseTaskProgress,
  onUpdateTask,
  onCreateTaskUpdate,
  onUploadImage,
  onPreviewFile,
  onUpdateFile,
  onDeleteFile,
  onConfirmAcceptance,
  onUploadAcceptanceFile,
  hourlyRate,
  confirmDialog,
  confirmDialogBusy,
  onCloseConfirmDialog,
  onConfirmDialog,
  voidTaskTarget,
  voidTaskBusy,
  onCloseVoidTask,
  onConfirmVoidTask,
  previewFile,
  onClosePreviewFile,
  loginModalOpen,
  aboutGivernyOpen,
  authError,
  onCloseLogin,
  onCloseAboutGiverny,
  onUnlock,
  showFireworks,
  toastQueue,
  onDismissToast,
}: {
  dailyKnowledgeOpen: boolean
  dailyKnowledge: DailyKnowledgeItem
  dailyKnowledgeLoading: boolean
  isAdmin: boolean
  canUseAgent: boolean
  onRefreshDailyKnowledge: () => void
  onCloseDailyKnowledge: () => void
  onFavoriteDailyKnowledge: (item: DailyKnowledgeItem) => Promise<boolean>
  commandPaletteOpen: boolean
  commandPaletteInitialQuery: string
  commandActions: CommandPaletteAction[]
  onCloseCommandPalette: () => void
  shortcutHelpOpen: boolean
  shortcutHelpGroups: ShortcutHelpGroup[]
  onCloseShortcutHelp: () => void
  chatOpen: boolean
  currentMonthValue: string
  aiModelConfig: AiModelConfig | null
  aiProviderConfigs: AiProviderConfig[]
  chatAnalysisFocusId: string
  notify: Notify
  onCloseChat: () => void
  onOpenChatTask: (taskId: number) => void
  semanticSearchOpen: boolean
  files: FileAsset[]
  tasks: Task[]
  onCloseSemanticSearch: () => void
  onOpenSemanticTask: (taskId: number) => void
  onOpenSemanticFile: (fileId: number) => void
  createTaskOpen: boolean
  newTaskSupplemental: boolean
  designTypeGroups: DesignTypeGroup[]
  onCloseCreateTask: () => void
  onCreateTask: (task: Task) => void
  onDesignTypeGroupsChange: (nextGroups: DesignTypeGroup[]) => void | Promise<void>
  detailTaskId: number
  onCloseTaskDetail: () => void
  onOpenTaskAcceptance: (taskId: number) => void
  onOpenTaskEditFromDetail: (taskId: number) => void
  onOpenTaskProgressFromDetail: (taskId: number) => void
  editTaskId: number
  onCloseTaskEdit: () => void
  onSaveTaskEdit: (taskId: number, changes: Partial<Task>) => void
  progressModalTarget: ProgressModalTarget | null
  taskActivity: ActivityItem[]
  onCloseTaskProgress: () => void
  onUpdateTask: TaskProgressProps['onUpdateTask']
  onCreateTaskUpdate: TaskProgressProps['onCreateTaskUpdate']
  onUploadImage: TaskProgressProps['onUploadImage']
  onPreviewFile: (file: FileAsset) => void
  onUpdateFile: TaskProgressProps['onUpdateFile']
  onDeleteFile: TaskProgressProps['onDeleteFile']
  onConfirmAcceptance?: TaskProgressProps['onConfirmAcceptance']
  onUploadAcceptanceFile?: TaskProgressProps['onUploadAcceptanceFile']
  hourlyRate: number
  confirmDialog: ConfirmDialogState | null
  confirmDialogBusy: boolean
  onCloseConfirmDialog: () => void
  onConfirmDialog: () => void
  voidTaskTarget: Task | null
  voidTaskBusy: boolean
  onCloseVoidTask: () => void
  onConfirmVoidTask: (reason: string) => void
  previewFile: FileAsset | null
  onClosePreviewFile: () => void
  loginModalOpen: boolean
  aboutGivernyOpen: boolean
  authError: string
  onCloseLogin: () => void
  onCloseAboutGiverny: () => void
  onUnlock: (email: string, key: string, turnstileToken?: string) => void | Promise<void>
  showFireworks: boolean
  toastQueue: ToastState[]
  onDismissToast: (toastId: number) => void
}) {
  const detailTask = detailTaskId > 0 ? tasks.find((task) => task.id === detailTaskId) : undefined
  const editTask = editTaskId > 0 ? tasks.find((task) => task.id === editTaskId) : undefined
  const progressTask = progressModalTarget ? tasks.find((task) => task.id === progressModalTarget.taskId) : undefined

  return (
    <>
      {dailyKnowledgeOpen && (
        <DailyKnowledgeModal
          item={dailyKnowledge}
          isLoading={dailyKnowledgeLoading}
          canRefresh={isAdmin}
          onRefresh={onRefreshDailyKnowledge}
          onClose={onCloseDailyKnowledge}
          onFavorite={isAdmin ? onFavoriteDailyKnowledge : undefined}
        />
      )}
      {commandPaletteOpen && <CommandPalette key={commandPaletteInitialQuery} actions={commandActions} initialQuery={commandPaletteInitialQuery} onClose={onCloseCommandPalette} />}
      {shortcutHelpOpen && <ShortcutHelpModal groups={shortcutHelpGroups} onClose={onCloseShortcutHelp} />}
      {chatOpen && canUseAgent && (
        <>
          <div className="chat-backdrop" onDoubleClick={onCloseChat} />
          <Suspense fallback={<div className="chat-panel"><div className="office-preview-status">正在载入工作助手…</div></div>}>
            <ChatPanel
              currentMonthValue={currentMonthValue}
              aiModelConfig={aiModelConfig}
              aiProviderConfigs={aiProviderConfigs}
              initialAnalysisJobId={chatAnalysisFocusId || undefined}
              canConfigureModel={isAdmin}
              onNotify={notify}
              onClose={onCloseChat}
              onOpenTask={onOpenChatTask}
            />
          </Suspense>
        </>
      )}
      {semanticSearchOpen && (
        <Suspense fallback={<div className="command-overlay"><p className="loading-state">正在载入语义搜索…</p></div>}>
          <SemanticSearchModal
            isAdmin={isAdmin}
            files={files}
            tasks={tasks}
            onClose={onCloseSemanticSearch}
            onOpenTask={onOpenSemanticTask}
            renderFileThumbnail={(file) => {
              const fileType = fileTypeForAsset(file).type
              const previewUrl = authedPreviewUrl(file.previewUrl ?? (isInlineImageFileType(fileType) ? file.sourceUrl : undefined))
              return (
                <AttachmentHoverThumbnail
                  name={file.name}
                  type={fileType}
                  previewUrl={previewUrl}
                  previewFallback={Boolean(file.previewFallback)}
                  sourceUrl={fileThumbnailSource(file)}
                  compact
                  onOpen={() => onOpenSemanticFile(file.id)}
                />
              )
            }}
          />
        </Suspense>
      )}
      {createTaskOpen && (
        <Suspense fallback={<ModalShell className="new-task-modal" labelledBy="new-task-loading-title" onClose={onCloseCreateTask} closeOnEscape><div id="new-task-loading-title" className="office-preview-status">正在载入新建任务…</div></ModalShell>}>
          <NewTaskModal designTypeGroups={designTypeGroups} currentMonthValue={currentMonthValue} initialSupplemental={newTaskSupplemental} onClose={onCloseCreateTask} onCreate={onCreateTask} onDesignTypeGroupsChange={onDesignTypeGroupsChange} />
        </Suspense>
      )}
      {detailTask && (
        <TaskDetailModal
          key={detailTask.id}
          task={detailTask}
          onClose={onCloseTaskDetail}
          onOpenAcceptance={onOpenTaskAcceptance}
          canAccept={isAdmin}
          onOpenEdit={onOpenTaskEditFromDetail}
          onOpenProgress={onOpenTaskProgressFromDetail}
        />
      )}
      {editTask && (
        <Suspense fallback={<ModalShell className="new-task-modal" labelledBy="edit-task-loading-title" onClose={onCloseTaskEdit} closeOnEscape><div id="edit-task-loading-title" className="office-preview-status">正在载入任务编辑…</div></ModalShell>}>
          <NewTaskModal
            key={`edit-${editTask.id}`}
            designTypeGroups={designTypeGroups}
            currentMonthValue={currentMonthValue}
            editingTask={editTask}
            onClose={onCloseTaskEdit}
            onCreate={onCreateTask}
            onSave={(changes) => onSaveTaskEdit(editTask.id, changes)}
            onDesignTypeGroupsChange={onDesignTypeGroupsChange}
          />
        </Suspense>
      )}
      {progressTask && progressModalTarget && (
        <TaskProgressModal
          task={progressTask}
          mode={progressModalTarget.mode}
          editEntryId={progressModalTarget.editEntryId}
          files={files}
          activity={taskActivity}
          onClose={onCloseTaskProgress}
          onUpdateTask={onUpdateTask}
          onCreateTaskUpdate={onCreateTaskUpdate}
          onUploadImage={onUploadImage}
          onPreviewFile={onPreviewFile}
          onUpdateFile={onUpdateFile}
          onDeleteFile={onDeleteFile}
          onConfirmAcceptance={onConfirmAcceptance}
          onUploadAcceptanceFile={onUploadAcceptanceFile}
          onNotify={notify}
          initialAcceptanceMode={progressModalTarget.initialAcceptanceMode}
          hourlyRate={hourlyRate}
        />
      )}
      {confirmDialog && <ConfirmDialogModal dialog={confirmDialog} isBusy={confirmDialogBusy} onClose={onCloseConfirmDialog} onConfirm={onConfirmDialog} />}
      {voidTaskTarget && <VoidTaskModal task={voidTaskTarget} monthLabel={monthLabelOf(taskSettlementMonth(voidTaskTarget))} isBusy={voidTaskBusy} onClose={onCloseVoidTask} onConfirm={onConfirmVoidTask} />}
      {previewFile && (
        <Suspense fallback={<ModalShell className="file-preview-modal" labelledBy="file-preview-loading-title" onClose={onClosePreviewFile}><div id="file-preview-loading-title" className="office-preview-status">正在载入文件预览…</div></ModalShell>}>
          <FilePreviewModal file={previewFile} onClose={onClosePreviewFile} />
        </Suspense>
      )}
      {loginModalOpen && <AdminLoginModal error={authError} onClose={onCloseLogin} onSubmit={onUnlock} />}
      {aboutGivernyOpen && <AboutGivernyModal onClose={onCloseAboutGiverny} />}
      {showFireworks && <Fireworks />}
      {toastQueue.length > 0 && (
        <div className="toast-stack" role="region" aria-label="操作提示">
          {toastQueue.map((item) => (
            <div className={`toast toast-${item.tone}`} key={item.id} role={item.tone === 'error' ? 'alert' : 'status'}>
              <ToastIcon tone={item.tone} />
              <span>{item.message}</span>
              {item.actionLabel && item.onAction ? (
                <button type="button" className="toast-action" onClick={() => { void item.onAction?.(); onDismissToast(item.id) }}>{item.actionLabel}</button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function Fireworks() {
  return (
    <div className="fireworks" aria-hidden="true">
      {Array.from({ length: 32 }, (_, index) => <span key={index} style={{ '--i': index } as CSSProperties} />)}
    </div>
  )
}
