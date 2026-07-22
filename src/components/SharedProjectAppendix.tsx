import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, CheckCircle2, ExternalLink, FileArchive, FileText, Image as ImageIcon, X } from 'lucide-react'
import type { FileAsset, Task, TaskUpdate, TimeEntry } from '../types/domain'

type ProjectTimelineItem = {
  id: string
  date: string
  title: string
  body: string
  entryId?: string
  files: FileAsset[]
}

const PROJECTS_PER_PAGE = 12

const datePart = (value: string) => value.slice(0, 10)

function timeEntryDate(entry: TimeEntry, fallback: string) {
  const day = datePart(entry.endDate || entry.date || fallback)
  const start = entry.start?.slice(0, 5)
  const end = entry.end?.slice(0, 5)
  return `${day}${start ? ` ${start}` : ''}${end ? `-${end}` : ''}`
}

function timelineTitle(entry: TimeEntry) {
  if (entry.isClientFeedback) return entry.feedbackSource ? `${entry.feedbackSource}反馈` : '反馈记录'
  if (entry.isAcceptanceProgress) return '验收进展'
  if (entry.isRevision) return '修改进展'
  return '进展记录'
}

function taskTimeline(task: Task, updates: TaskUpdate[], files: FileAsset[]): ProjectTimelineItem[] {
  const updateItems = updates
    .filter((update) => update.taskId === task.id)
    .map((update) => ({ id: `update-${update.id}`, date: update.date, title: update.title, body: update.body, files: [] as FileAsset[] }))
  const entryItems = (task.timeEntries ?? []).map((entry) => ({
    id: `entry-${entry.id}`,
    date: timeEntryDate(entry, task.date),
    title: timelineTitle(entry),
    body: entry.note || '已记录本次进展',
    entryId: entry.id,
    files: files.filter((file) => file.entryId === entry.id),
  }))
  const waitingItems = (task.waitingEntries ?? []).map((entry) => ({
    id: `waiting-${entry.id}`,
    date: timeEntryDate(entry, task.date),
    title: entry.reason || '等待记录',
    body: entry.note || '项目进入等待',
    entryId: entry.id,
    files: files.filter((file) => file.entryId === entry.id),
  }))
  const createdItem = {
    id: `created-${task.id}`,
    date: task.date,
    title: '项目创建',
    body: task.requirement || '任务已创建',
    files: [] as FileAsset[],
  }
  const merged = new Map<string, ProjectTimelineItem>()
  for (const item of [...updateItems, ...entryItems, ...waitingItems, createdItem].sort((a, b) => b.date.localeCompare(a.date))) {
    const key = `${datePart(item.date)}|${item.body.trim()}`
    const current = merged.get(key)
    if (current) {
      current.files = [...current.files, ...item.files.filter((file) => !current.files.some((saved) => saved.id === file.id))]
    } else {
      merged.set(key, item)
    }
  }
  const timeline = [...merged.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
  const legacyAcceptanceFiles = files.filter((file) => file.scope === 'acceptance' && !file.entryId)
  const acceptanceItem = timeline.find((item) => item.title === '验收进展')
  if (acceptanceItem) acceptanceItem.files.push(...legacyAcceptanceFiles)
  return timeline
}

function SharedFilePreviewModal({ file, onClose }: { file: FileAsset; onClose: () => void }) {
  const fileType = file.type.toUpperCase()
  const sourceUrl = file.sourceUrl ?? ''
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section className="task-modal file-preview-modal" role="dialog" aria-modal="true" aria-labelledby="shared-preview-title">
        <header className="modal-header">
          <div><p className="eyebrow">文件预览</p><h2 id="shared-preview-title">{file.name}</h2></div>
          <button className="icon-button modal-close-button" aria-label="关闭" title="关闭" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="file-preview-body">
          {file.previewUrl ? (
            <img src={file.previewUrl} alt={file.name} />
          ) : sourceUrl && fileType === 'PDF' ? (
            <iframe className="file-preview-frame" src={sourceUrl} title={file.name} />
          ) : (
            <div className="file-preview-placeholder">
              {fileType === 'PDF' ? <FileText size={42} /> : <FileArchive size={42} />}
              <strong>{file.type}</strong>
              <span>{sourceUrl ? '该格式暂无缩略图，可以直接打开源文件。' : '该文件暂无在线预览。'}</span>
              {sourceUrl && <a className="primary-button compact-button" href={sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />打开源文件</a>}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function SharedFileThumbnail({ file }: { file: FileAsset }) {
  const [failed, setFailed] = useState(false)
  if (!file.previewUrl || failed) return <ImageIcon size={22} aria-hidden="true" />
  return <img src={file.previewUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
}

export function SharedProjectAppendix({ tasks, updates, files }: { tasks: Task[]; updates: TaskUpdate[]; files: FileAsset[] }) {
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [activeTimelineTaskId, setActiveTimelineTaskId] = useState<number | null>(null)
  const [previewFile, setPreviewFile] = useState<FileAsset | null>(null)
  const projects = useMemo(() => tasks
    .map((task) => {
      const projectFiles = files
        .filter((file) => file.taskId === task.id)
        .sort((a, b) => Number(b.final) - Number(a.final) || Number(b.scope === 'acceptance') - Number(a.scope === 'acceptance') || b.uploadedAt.localeCompare(a.uploadedAt))
      return { task, files: projectFiles, timeline: taskTimeline(task, updates, projectFiles) }
    })
    .filter((project) => project.files.length > 0 || project.timeline.length > 0)
    .sort((a, b) => {
      const compared = a.task.date.localeCompare(b.task.date) || a.task.id - b.task.id
      return sortDirection === 'asc' ? compared : -compared
    }), [files, sortDirection, tasks, updates])
  const pageCount = Math.max(1, Math.ceil(projects.length / PROJECTS_PER_PAGE))
  const currentPage = Math.min(page, pageCount)
  const visibleProjects = projects.slice((currentPage - 1) * PROJECTS_PER_PAGE, currentPage * PROJECTS_PER_PAGE)

  const changeSortDirection = (direction: 'asc' | 'desc') => {
    setSortDirection(direction)
    setPage(1)
  }

  useEffect(() => {
    if (activeTimelineTaskId === null) return
    const handleKeydown = (event: KeyboardEvent) => event.key === 'Escape' && setActiveTimelineTaskId(null)
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [activeTimelineTaskId])

  if (projects.length === 0) return null

  return (
    <section className="shared-project-appendix" aria-labelledby="shared-project-appendix-title">
      <header className="shared-project-appendix-header">
        <div>
          <h2 id="shared-project-appendix-title">项目与交付</h2>
          <p>共 {projects.length} 个项目，交付文件与进展已按项目归档</p>
        </div>
        <div className="shared-project-sort" aria-label="项目排序">
          <button type="button" className={sortDirection === 'asc' ? 'active' : ''} onClick={() => changeSortDirection('asc')}><ArrowUp size={14} />较早在前</button>
          <button type="button" className={sortDirection === 'desc' ? 'active' : ''} onClick={() => changeSortDirection('desc')}><ArrowDown size={14} />较新在前</button>
        </div>
      </header>
      <div className="shared-project-list">
        {visibleProjects.map(({ task, files: projectFiles, timeline }, projectIndex) => {
          const isTimelineOpen = activeTimelineTaskId === task.id
          const previewFiles = projectFiles.slice(0, 4)
          const remainingFileCount = Math.max(0, projectFiles.length - previewFiles.length)
          return (
            <article className="shared-project-row" key={task.id} data-task-id={task.id} data-start-date={datePart(task.date)}>
              <header className="shared-project-row-header">
                <div className="shared-project-row-main">
                  <span className="shared-project-index">P{String((currentPage - 1) * PROJECTS_PER_PAGE + projectIndex + 1).padStart(3, '0')}</span>
                  <span className="shared-project-type">{task.type}</span>
                  <h3>{task.title}</h3>
                  <p>{datePart(task.date).replaceAll('-', '/')}</p>
                </div>
              </header>
              <div className="shared-project-gallery" aria-label={`${task.title}的项目文件`}>
                {previewFiles.length > 0 ? (
                  <>
                    <button type="button" className="shared-project-featured-file" aria-label={`预览 ${previewFiles[0].name}`} onClick={() => setPreviewFile(previewFiles[0])} title={`预览 ${previewFiles[0].name}`}>
                      <SharedFileThumbnail file={previewFiles[0]} />
                    </button>
                    {previewFiles.length > 1 && (
                      <div className="shared-project-file-strip">
                        {previewFiles.slice(1).map((file, index) => (
                          <button type="button" className="shared-project-file" key={file.id} aria-label={`预览 ${file.name}`} onClick={() => setPreviewFile(file)} title={`预览 ${file.name}`}>
                            <SharedFileThumbnail file={file} />
                            {remainingFileCount > 0 && index === previewFiles.slice(1).length - 1 && <span>+{remainingFileCount}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="shared-project-empty-file"><FileArchive size={28} /><span>暂无公开附件</span></div>
                )}
              </div>
              <footer className="shared-project-row-footer">
                <span><FileText size={14} />{projectFiles.length} 份文件</span>
                <span className="shared-project-status"><CheckCircle2 size={14} />{task.status}</span>
                {timeline.length > 0 && (
                  <button type="button" className="shared-project-timeline-trigger" aria-expanded={isTimelineOpen} onClick={() => setActiveTimelineTaskId(task.id)}>
                    查看时间线 <ArrowRight size={14} />
                  </button>
                )}
              </footer>
              {isTimelineOpen && (
                <div className="shared-project-timeline-popover" role="dialog" aria-modal="true" aria-label={`${task.title}时间线`}>
                  <header>
                    <div><strong>{task.title}</strong><span>项目时间线</span></div>
                    <button type="button" aria-label="关闭时间线" title="关闭" onClick={() => setActiveTimelineTaskId(null)}><X size={16} /></button>
                  </header>
                  <div className="shared-project-timeline" tabIndex={0}>
                    {timeline.map((item) => (
                      <div className="shared-project-timeline-item" key={item.id}>
                        <time>{item.date.replace('T', ' ')}</time>
                        <div>
                          <strong>{item.title}</strong><p>{item.body}</p>
                          {item.files.length > 0 && (
                            <div className="shared-project-timeline-files" aria-label={`${item.title}附件`}>
                              {item.files.map((file) => (
                                <button type="button" key={file.id} onClick={() => setPreviewFile(file)} title={`预览 ${file.name}`}>
                                  <SharedFileThumbnail file={file} /><span>{file.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>
      {pageCount > 1 && (
        <nav className="shared-project-pagination" aria-label="项目分页">
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
            <button type="button" key={pageNumber} className={pageNumber === currentPage ? 'active' : ''} aria-current={pageNumber === currentPage ? 'page' : undefined} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
          ))}
          <span>共 {projects.length} 个项目</span>
        </nav>
      )}
      {previewFile && <SharedFilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
    </section>
  )
}
