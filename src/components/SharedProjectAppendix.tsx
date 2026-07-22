import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ExternalLink, FileArchive, FileText, Image as ImageIcon, X } from 'lucide-react'
import type { FileAsset, Task, TaskUpdate, TimeEntry } from '../types/domain'

type ProjectTimelineItem = {
  id: string
  date: string
  title: string
  body: string
}

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

function taskTimeline(task: Task, updates: TaskUpdate[]): ProjectTimelineItem[] {
  const updateItems = updates
    .filter((update) => update.taskId === task.id)
    .map((update) => ({ id: `update-${update.id}`, date: update.date, title: update.title, body: update.body }))
  const entryItems = (task.timeEntries ?? []).map((entry) => ({
    id: `entry-${entry.id}`,
    date: timeEntryDate(entry, task.date),
    title: timelineTitle(entry),
    body: entry.note || '已记录本次进展',
  }))
  const waitingItems = (task.waitingEntries ?? []).map((entry) => ({
    id: `waiting-${entry.id}`,
    date: timeEntryDate(entry, task.date),
    title: entry.reason || '等待记录',
    body: entry.note || '项目进入等待',
  }))
  const createdItem = {
    id: `created-${task.id}`,
    date: task.date,
    title: '项目创建',
    body: task.requirement || '任务已创建',
  }
  const seen = new Set<string>()
  return [...updateItems, ...entryItems, ...waitingItems, createdItem]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((item) => {
      const key = `${datePart(item.date)}|${item.body.trim()}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
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
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<number>>(new Set())
  const [previewFile, setPreviewFile] = useState<FileAsset | null>(null)
  const projects = useMemo(() => tasks
    .map((task) => ({
      task,
      files: files.filter((file) => file.taskId === task.id),
      timeline: taskTimeline(task, updates),
    }))
    .filter((project) => project.files.length > 0 || project.timeline.length > 0)
    .sort((a, b) => {
      const compared = a.task.date.localeCompare(b.task.date) || a.task.id - b.task.id
      return sortDirection === 'asc' ? compared : -compared
    }), [files, sortDirection, tasks, updates])

  if (projects.length === 0) return null

  const toggleTimeline = (taskId: number) => {
    setExpandedTaskIds((current) => {
      const next = new Set(current)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  return (
    <section className="shared-project-appendix" aria-labelledby="shared-project-appendix-title">
      <header className="shared-project-appendix-header">
        <div>
          <h2 id="shared-project-appendix-title">项目与交付</h2>
          <p>共 {projects.length} 个项目，交付文件与进展已按项目归档</p>
        </div>
        <div className="shared-project-sort" aria-label="项目排序">
          <button type="button" className={sortDirection === 'asc' ? 'active' : ''} onClick={() => setSortDirection('asc')}><ArrowUp size={14} />较早在前</button>
          <button type="button" className={sortDirection === 'desc' ? 'active' : ''} onClick={() => setSortDirection('desc')}><ArrowDown size={14} />较新在前</button>
        </div>
      </header>
      <div className="shared-project-list">
        {projects.map(({ task, files: projectFiles, timeline }) => {
          const isExpanded = expandedTaskIds.has(task.id)
          return (
            <article className="shared-project-row" key={task.id} data-task-id={task.id}>
              <header className="shared-project-row-header">
                <time>{datePart(task.date).replaceAll('-', '/')}</time>
                <div className="shared-project-row-main">
                  <h3>{task.title}</h3>
                  <p>{task.type} · {task.status} · {projectFiles.length} 个交付文件 · {timeline.length} 条进展</p>
                </div>
                {timeline.length > 0 && (
                  <button type="button" className="shared-project-timeline-trigger" aria-expanded={isExpanded} onClick={() => toggleTimeline(task.id)}>
                    {isExpanded ? '收起时间线' : '查看时间线'}<ChevronDown size={14} />
                  </button>
                )}
              </header>
              {projectFiles.length > 0 && (
                <div className="shared-project-files" aria-label={`${task.title}的交付文件`}>
                  {projectFiles.map((file) => (
                    <button type="button" className="shared-project-file" key={file.id} onClick={() => setPreviewFile(file)} title={`预览 ${file.name}`}>
                      <span className="shared-project-file-thumb">
                        <SharedFileThumbnail file={file} />
                      </span>
                      <span>{file.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {isExpanded && (
                <div className="shared-project-timeline">
                  {timeline.map((item) => (
                    <div className="shared-project-timeline-item" key={item.id}>
                      <time>{item.date.replace('T', ' ')}</time>
                      <div><strong>{item.title}</strong><p>{item.body}</p></div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          )
        })}
      </div>
      {previewFile && <SharedFilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
    </section>
  )
}
