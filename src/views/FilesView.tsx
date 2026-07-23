import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Download, Folder, RotateCcw, Trash2, X } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { FileContextMenu } from '../components/FileContextMenu'
import { FileThumbnailPreview } from '../components/FileThumbnailPreview'
import { TaskSearchBox } from '../components/TaskUi'
import { authedPreviewUrl } from '../lib/api'
import { fileTypeForAsset } from '../lib/fileTypes'
import { parseFileTags, serializeFileTags } from '../lib/fileMetadata'
import { monthLabelOf } from '../lib/month'
import { taskSettlementMonth } from '../lib/taskSettlement'
import type { AttachmentAnalysis, FileAsset, Task } from '../types/domain'

export default function FilesView({
  files,
  tasks,
  attachmentAnalyses,
  currentMonthValue,
  focusFileId = 0,
  onFocusHandled,
  onPreviewFile,
  onDeleteFile,
  onDownloadFile,
  onUpdateFile,
  onRetryAnalysis,
  canWrite,
  canDelete,
}: {
  files: FileAsset[]
  tasks: Task[]
  attachmentAnalyses: AttachmentAnalysis[]
  currentMonthValue: string
  focusFileId?: number
  onFocusHandled?: () => void
  onPreviewFile: (file: FileAsset) => void
  onDeleteFile: (fileId: number) => void
  onDownloadFile: (file: FileAsset) => void
  onUpdateFile: (fileId: number, changes: { name?: string; tag?: string }) => Promise<FileAsset>
  onRetryAnalysis: (attachmentId: number) => Promise<void>
  canWrite: boolean
  canDelete: boolean
}) {
  // 仅展示「已验收」任务的验收文件——未验收任务（进行中/待验收）即便预上传了验收稿也不显示，
  // 避免「还没验收却出现验收文件」。任务回到待验收（撤回验收）时也会自动隐藏。
  const acceptedTaskIds = useMemo(
    () => new Set(tasks.filter((task) => task.status === '已验收').map((task) => task.id)),
    [tasks],
  )
  const acceptanceFiles = useMemo(
    () => files.filter((file) => file.scope === 'acceptance' && acceptedTaskIds.has(file.taskId)),
    [files, acceptedTaskIds],
  )
  const analysisByAttachment = useMemo(
    () => new Map(attachmentAnalyses.map((analysis) => [analysis.attachmentId, analysis])),
    [attachmentAnalyses],
  )
  const [fileQuery, setFileQuery] = useState('')
  const [fileContextMenu, setFileContextMenu] = useState<{ x: number; y: number; file: FileAsset } | null>(null)
  const [focusFileField, setFocusFileField] = useState<'name' | 'tag' | null>(null)
  const [openMonths, setOpenMonths] = useState<Set<string>>(() => new Set([currentMonthValue]))
  const filteredFiles = useMemo(() => {
    const query = fileQuery.trim().toLowerCase()
    return acceptanceFiles.filter((file) => {
      const matchesQuery =
        !query ||
        [file.name, file.task, file.type, file.tag ?? ''].some((value) => value.toLowerCase().includes(query))
      return matchesQuery
    })
  }, [acceptanceFiles, fileQuery])
  const projectRecords = useMemo(() => {
    const taskMap = new Map(tasks.map((task) => [task.id, task]))
    const fileTaskIds = [...new Set(filteredFiles.map((file) => file.taskId))]
    return fileTaskIds
      .map((taskId) => {
        const task = taskMap.get(taskId)
        const projectFiles = filteredFiles
          .filter((file) => file.taskId === taskId)
          .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
        const latestUploadedAt = projectFiles[0]?.uploadedAt ?? ''
        const settlementMonth = task ? taskSettlementMonth(task) : ''
        const month = /^\d{4}-\d{2}$/.test(settlementMonth)
          ? settlementMonth
          : latestUploadedAt.slice(0, 7)
        return {
          id: taskId,
          title: task?.title ?? projectFiles[0]?.task ?? '未关联任务',
          type: task?.type ?? '未分类',
          contact: task?.contact ?? '',
          acceptanceNote: task?.acceptanceNote ?? '',
          month: /^\d{4}-\d{2}$/.test(month) ? month : currentMonthValue,
          files: projectFiles,
          latestUploadedAt,
        }
      })
      .sort((a, b) => {
        const monthOrder = b.month.localeCompare(a.month)
        return monthOrder || b.latestUploadedAt.localeCompare(a.latestUploadedAt)
      })
  }, [currentMonthValue, filteredFiles, tasks])
  const monthGroups = useMemo(() => {
    const groups = new Map<string, typeof projectRecords>()
    projectRecords.forEach((project) => {
      groups.set(project.month, [...(groups.get(project.month) ?? []), project])
    })
    return [...groups.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, projects]) => ({
        month,
        projects,
        fileCount: projects.reduce((sum, project) => sum + project.files.length, 0),
      }))
  }, [projectRecords])
  const [selectedProjectId, setSelectedProjectId] = useState(() => projectRecords[0]?.id ?? 0)
  const selectedProject = projectRecords.find((task) => task.id === selectedProjectId) ?? projectRecords[0]
  const selectedFiles = selectedProject?.files ?? []
  const [selectedFileId, setSelectedFileId] = useState(0)
  const selectedFile = selectedFiles.find((file) => file.id === selectedFileId)

  // 从语义搜索跳转过来：定位到该文件所属项目文件夹并选中它，自动展开月份、滚动到位、高亮其 AI 分析。
  useEffect(() => {
    if (!focusFileId) {
      return
    }
    const target = acceptanceFiles.find((file) => file.id === focusFileId)
    if (target) {
      const project = projectRecords.find((record) => record.id === target.taskId)
      requestAnimationFrame(() => {
        if (project) {
          setOpenMonths((current) => new Set(current).add(project.month))
        }
        setSelectedProjectId(target.taskId)
        setSelectedFileId(focusFileId)
        document.querySelector(`[data-file-id="${focusFileId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
    }
    onFocusHandled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusFileId])

  const openFileSource = (file: FileAsset) => {
    const sourceUrl = authedPreviewUrl(file.sourceUrl)
    if (sourceUrl) {
      window.open(sourceUrl, '_blank', 'noreferrer')
    }
  }
  const focusInspectorField = (file: FileAsset, field: 'name' | 'tag') => {
    setSelectedFileId(file.id)
    setFocusFileField(field)
  }
  const openFileContextMenu = (event: React.MouseEvent, file: FileAsset) => {
    event.preventDefault()
    setSelectedFileId(file.id)
    setFileContextMenu({ x: event.clientX, y: event.clientY, file })
  }

  useEffect(() => {
    if (!fileContextMenu) {
      return
    }
    const closeMenu = () => setFileContextMenu(null)
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }
    window.addEventListener('click', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [fileContextMenu])

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT' || target?.isContentEditable
      if (event.key === 'Escape' && selectedFile) {
        setSelectedFileId(0)
        setFocusFileField(null)
        return
      }
      if (event.code === 'Space' && selectedFile && !isTyping) {
        event.preventDefault()
        onPreviewFile(selectedFile)
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [onPreviewFile, selectedFile])

  return (
    <section className="view-stack">
      <section className="file-library-header">
        <p>按项目归档 · 点进项目查看验收交付件，AI 已自动解析</p>
        <TaskSearchBox
          value={fileQuery}
          onChange={setFileQuery}
          placeholder="搜索文件、项目、标签、关联任务"
          className="file-library-search"
        />
      </section>

      <section className="file-library-layout">
        <aside className="file-project-list">
          {monthGroups.length === 0 && (
            <EmptyState
              title="还没有验收交付件"
              description="任务提交验收时上传的交付文件会按项目自动归档到这里，AI 也会同步解析内容供搜索。"
            />
          )}
          {monthGroups.map((group) => {
            const isOpen = Boolean(fileQuery.trim()) || openMonths.has(group.month)
            return (
              <section className={`file-tree-month ${isOpen ? 'open' : ''}`} key={group.month}>
                <button
                  className="file-tree-month-header"
                  type="button"
                  onClick={() => {
                    setOpenMonths((current) => {
                      const next = new Set(current)
                      if (next.has(group.month)) {
                        next.delete(group.month)
                      } else {
                        next.add(group.month)
                      }
                      return next
                    })
                  }}
                >
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <strong>{monthLabelOf(group.month)}</strong>
                  <span>{group.projects.length} 项 · {group.fileCount} 文件</span>
                </button>
                {isOpen && (
                  <div className="file-tree-projects">
                    {group.projects.map((project) => (
                      <button
                        className={`file-project-row ${selectedProject?.id === project.id ? 'active' : ''}`}
                        key={project.id}
                        type="button"
                        onClick={() => {
                          setSelectedProjectId(project.id)
                          setSelectedFileId(0)
                        }}
                      >
                        <Folder size={14} />
                        <span>{project.title}</span>
                        <em>{project.files.length}</em>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </aside>

        <section className="file-project-detail">
          <div className="file-project-heading">
            <div>
              <h2>{selectedProject?.title ?? '选择一个项目'}</h2>
              <p>
                {selectedProject
                  ? `${selectedProject.contact || '未填写对接人'} · ${selectedProject.type} · ${selectedFiles.length} 个验收文件`
                  : '点击左侧项目查看验收文件'}
              </p>
            </div>
          </div>
          {selectedProject?.acceptanceNote && (
            <div className="file-project-note">
              <strong>最新交付说明</strong>
              <span>{selectedProject.acceptanceNote}</span>
            </div>
          )}
          <div className="grouped-file-grid">
            {selectedFiles.map((file) => {
              const fileType = fileTypeForAsset(file).type
              return (
                <article
                  className={`file-thumb-card ${selectedFile?.id === file.id ? 'selected' : ''}`}
                  key={file.id}
                  data-file-id={file.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedFileId(file.id)}
                  onDoubleClick={() => onPreviewFile(file)}
                  onContextMenu={(event) => openFileContextMenu(event, file)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onPreviewFile(file)
                    }
                  }}
                >
                  <div className="file-thumb-preview visual-preview">
                    <span className={`file-format-badge type-${fileType.toLowerCase()}`}>{fileType}</span>
                    <FileThumbnailPreview file={file} />
                  </div>
                  <div className="file-thumb-info">
                    <h2>{file.name}</h2>
                    <p>{file.size} · {file.uploadedAt.slice(0, 10)}</p>
                    <div className="file-thumb-tags">
                      <span>验收文件</span>
                      {parseFileTags(file.tag).filter((tag) => tag !== '验收文件').slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}
                    </div>
                  </div>
                </article>
              )
            })}
            {selectedProject && selectedFiles.length === 0 && <p className="calendar-empty-hint">这个项目下还没有文件。</p>}
          </div>
        </section>
        {selectedFile && (
          <FileInspector
            key={selectedFile.id}
            file={selectedFile}
            analysis={analysisByAttachment.get(selectedFile.id)}
            onPreview={onPreviewFile}
            onDownload={onDownloadFile}
            onDelete={onDeleteFile}
            onUpdateFile={onUpdateFile}
            onRetryAnalysis={onRetryAnalysis}
            focusField={focusFileField}
            onFocusHandled={() => setFocusFileField(null)}
            onClose={() => {
              setSelectedFileId(0)
              setFocusFileField(null)
            }}
            canWrite={canWrite}
            canDelete={canDelete}
          />
        )}
      </section>
      {fileContextMenu && (
        <FileContextMenu
          menu={fileContextMenu}
          onClose={() => setFileContextMenu(null)}
          onPreview={onPreviewFile}
          onOpen={openFileSource}
          onDownload={onDownloadFile}
          onFocusName={(file) => focusInspectorField(file, 'name')}
          onFocusTag={(file) => focusInspectorField(file, 'tag')}
          onDelete={onDeleteFile}
          canWrite={canWrite}
          canDelete={canDelete}
        />
      )}
    </section>
  )
}

function FileInspector({
  file,
  analysis,
  onPreview,
  onDownload,
  onDelete,
  onUpdateFile,
  onRetryAnalysis,
  focusField,
  onFocusHandled,
  onClose,
  canWrite,
  canDelete,
}: {
  file: FileAsset | undefined
  analysis?: AttachmentAnalysis
  onPreview: (file: FileAsset) => void
  onDownload: (file: FileAsset) => void
  onDelete: (fileId: number) => void
  onUpdateFile: (fileId: number, changes: { name?: string; tag?: string }) => Promise<FileAsset>
  onRetryAnalysis: (attachmentId: number) => Promise<void>
  focusField?: 'name' | 'tag' | null
  onFocusHandled?: () => void
  onClose: () => void
  canWrite: boolean
  canDelete: boolean
}) {
  const nameInputRef = useRef<HTMLInputElement>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)
  const [draftName, setDraftName] = useState(file?.name ?? '')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState(() => parseFileTags(file?.tag))
  const [isSaving, setIsSaving] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    // File metadata is editable draft state; reset it when the selected file changes to avoid cross-file overwrites.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftName(file?.name ?? '')
    setTagInput('')
    setTags(parseFileTags(file?.tag))
  }, [file?.id, file?.name, file?.tag])

  useEffect(() => {
    if (!focusField || !file) {
      return
    }
    const input = focusField === 'name' ? nameInputRef.current : tagInputRef.current
    input?.focus()
    input?.select()
    onFocusHandled?.()
  }, [file, focusField, onFocusHandled])

  if (!file) return null

  const fileType = fileTypeForAsset(file).type
  const sourceUrl = authedPreviewUrl(file.sourceUrl)
  const saveMetadata = async (nextTags = tags) => {
    setIsSaving(true)
    try {
      const updatedFile = await onUpdateFile(file.id, { name: draftName, tag: serializeFileTags(nextTags) })
      setTags(parseFileTags(updatedFile.tag))
    } finally {
      setIsSaving(false)
    }
  }
  const addTag = async () => {
    const nextTag = tagInput.trim()
    if (!nextTag) {
      return
    }
    const nextTags = Array.from(new Set([...tags, nextTag]))
    setTags(nextTags)
    setTagInput('')
    await saveMetadata(nextTags)
  }
  const removeTag = async (tag: string) => {
    const nextTags = tags.filter((item) => item !== tag)
    setTags(nextTags)
    await saveMetadata(nextTags)
  }

  return (
    <>
      <button className="file-inspector-scrim" type="button" aria-label="关闭文件详情" onClick={onClose} />
      <aside className="file-inspector" aria-label={`${file.name} 文件详情`}>
        <header className="file-inspector-header">
          <div>
            <span>{fileType}</span>
            <strong>验收文件</strong>
          </div>
          <button type="button" onClick={onClose}>
            关闭 <X size={16} />
          </button>
        </header>
        {canWrite ? <label className="inspector-field file-inspector-name">
          <span>文件名</span>
          <input ref={nameInputRef} value={draftName} onChange={(event) => setDraftName(event.target.value)} onBlur={() => void saveMetadata()} />
        </label> : <div className="inspector-field file-inspector-name"><span>文件名</span><strong>{file.name}</strong></div>}
        <p className="file-inspector-subtitle">{file.task} · {file.type}</p>
        <button className="file-inspector-preview" type="button" onClick={() => onPreview(file)}>
          <span className={`file-format-badge type-${fileType.toLowerCase()}`}>{fileType}</span>
          <FileThumbnailPreview file={file} inspector />
        </button>
        <p className="file-inspector-preview-hint">双击文件卡或按空格可放大预览</p>
        <dl className="inspector-meta">
          <div>
            <dt>关联任务</dt>
            <dd>{file.task}</dd>
          </div>
          <div>
            <dt>尺寸 / 大小</dt>
            <dd>{file.size}</dd>
          </div>
          <div>
            <dt>上传日期</dt>
            <dd>{file.uploadedAt}</dd>
          </div>
          <div>
            <dt>文件类型</dt>
            <dd><span className="file-meta-chip">验收文件</span></dd>
          </div>
        </dl>
      {canWrite && <label className="inspector-field">
        <span>标签</span>
        <input
          ref={tagInputRef}
          value={tagInput}
          onChange={(event) => setTagInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void addTag()
            }
          }}
          placeholder={isSaving ? '保存中…' : '输入标签后按回车'}
        />
      </label>}
      <div className="inspector-tags">
        {tags.length === 0 && <em>暂无标签</em>}
        {tags.map((tag) => (
          <span key={tag}>
            {tag}
            {canWrite && <button type="button" aria-label={`移除标签 ${tag}`} onClick={() => void removeTag(tag)}>
              <Trash2 size={12} />
            </button>}
          </span>
        ))}
      </div>
      <section className="file-understanding">
        <div className="file-understanding-header">
          <div>
            <span>交付件理解</span>
            <strong>
              {!analysis ? '等待分析' : analysis.status === 'completed' ? '已完成' : analysis.status === 'processing' ? '分析中' : analysis.status === 'pending' ? '排队中' : '需要重试'}
            </strong>
          </div>
          {canDelete && <button
            type="button"
            className="ghost-button compact-button"
            disabled={isRetrying || analysis?.status === 'processing'}
            onClick={() => {
              setIsRetrying(true)
              void onRetryAnalysis(file.id).finally(() => setIsRetrying(false))
            }}
          >
            <RotateCcw size={13} />
            {isRetrying ? '提交中' : '重新分析'}
          </button>}
        </div>
        {analysis?.status === 'completed' ? (
          <>
            <p className="file-understanding-summary">{analysis.summary}</p>
            <div className="file-understanding-meta">
              <span>{analysis.contentType || file.type}</span>
              <span>{analysis.provider} / {analysis.model}</span>
              <strong className="analysis-confidence">置信度{analysis.confidence || '中'}</strong>
            </div>
            <div className="file-understanding-sections">
              <AnalysisList title="需求匹配" items={analysis.requirementMatches} emptyText="暂无明确匹配结论" />
              <AnalysisList title="质量分析" items={analysis.qualityIssues} emptyText="未发现明确质量问题" />
              <AnalysisList title="风险与建议" items={[...analysis.risks, ...analysis.suggestions]} emptyText="暂无额外风险或建议" />
            </div>
          </>
        ) : (
          <p className={`file-understanding-message ${analysis?.status === 'failed' || analysis?.status === 'unsupported' ? 'error' : ''}`}>
            {analysis?.errorMessage || '文件上传后会自动解析内容，并结合任务需求给出质量与风险判断。'}
          </p>
        )}
      </section>
      <div className="inspector-actions">
        <button className="primary-button" type="button" onClick={() => onDownload(file)}>
          <Download size={15} />
          下载
        </button>
        <button className="ghost-button" type="button" onClick={() => sourceUrl && window.open(sourceUrl, '_blank', 'noreferrer')}>
          打开原文件
        </button>
        {canDelete && <button className="ghost-button danger-text-button" type="button" onClick={() => onDelete(file.id)}>
          删除
        </button>}
      </div>
      </aside>
    </>
  )
}

function AnalysisList({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
  return (
    <section>
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul>
          {items.slice(0, 5).map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </section>
  )
}
