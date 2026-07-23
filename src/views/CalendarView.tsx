import { type CSSProperties, useMemo } from 'react'
import type { Task } from '../types/domain'
import { addIsoDays, calendarDayMeta, calendarDaysForMonth, dateRangeValues, weekdayLabels } from '../lib/calendar'
import { datePart, formatMonthDay, formatMonthDayTime, isoDate, isoDateFromLocalDate, localDateFromIsoDate, monthPart } from '../lib/dateTime'

export type CalendarDisplayMode = '日' | '周' | '月'

const calendarHours = Array.from({ length: 17 }, (_, index) => index + 7)
const calendarHourHeight = 54

function startOfCalendarWeek(value: string) {
  const date = localDateFromIsoDate(value)
  const offset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - offset)
  return isoDateFromLocalDate(date)
}

function calendarTaskStartsAt(task: Task) {
  if (!task.date.includes('T')) {
    return null
  }
  const hour = Number(task.date.slice(11, 13))
  const minute = Number(task.date.slice(14, 16))
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null
  }
  return hour * 60 + minute
}

function calendarTaskDurationMinutes(task: Task) {
  const hours = task.actualHours > 0 ? task.actualHours : task.estimatedHours
  return Math.max(30, Math.round((Number.isFinite(hours) && hours > 0 ? hours : 1) * 60))
}

function calendarTaskRange(task: Task, getTaskLifecycleDate: (task: Task) => string) {
  const start = datePart(task.date || task.settlementMonth || isoDate())
  const lifecycleEnd = datePart(getTaskLifecycleDate(task) || '')
  const plannedEnd = datePart(task.estimatedDate || '')
  const rawEnd = task.status === '已验收'
    ? lifecycleEnd || plannedEnd || start
    : plannedEnd || lifecycleEnd || start
  const end = rawEnd >= start ? rawEnd : start
  return { start, end }
}

function compareCalendarTasks(a: Task, b: Task, getTaskLifecycleDate: (task: Task) => string) {
  const rangeCompare = calendarTaskRange(a, getTaskLifecycleDate).start.localeCompare(calendarTaskRange(b, getTaskLifecycleDate).start)
  if (rangeCompare !== 0) {
    return rangeCompare
  }
  return a.title.localeCompare(b.title)
}

function chunkCalendarWeeks(days: ReturnType<typeof calendarDaysForMonth>) {
  const weeks: typeof days[] = []
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7))
  }
  return weeks
}

export default function CalendarView({
  monthValue,
  mode,
  focusDate,
  tasks,
  getTaskLifecycleDate,
  getTaskColor,
  onOpenTask,
  onFocusDateChange,
  onMonthChange,
}: {
  monthValue: string
  mode: CalendarDisplayMode
  focusDate: string
  tasks: Task[]
  getTaskLifecycleDate: (task: Task) => string
  getTaskColor: (type: string) => string
  onOpenTask: (taskId: number) => void
  onFocusDateChange: (value: string) => void
  onMonthChange: (value: string) => void
}) {
  const selectedDate = focusDate || `${monthValue}-01`
  const today = isoDate()
  const visibleTasks = useMemo(() => tasks.filter((task) => !task.voidedAt), [tasks])
  const taskRanges = useMemo(
    () => new Map(visibleTasks.map((task) => [task.id, calendarTaskRange(task, getTaskLifecycleDate)])),
    [getTaskLifecycleDate, visibleTasks],
  )
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    visibleTasks.forEach((task) => {
      const range = taskRanges.get(task.id) ?? calendarTaskRange(task, getTaskLifecycleDate)
      dateRangeValues(range.start, range.end).forEach((key) => {
        map.set(key, [...(map.get(key) ?? []), task].sort((a, b) => compareCalendarTasks(a, b, getTaskLifecycleDate)))
      })
    })
    return map
  }, [getTaskLifecycleDate, taskRanges, visibleTasks])

  const weekStart = startOfCalendarWeek(selectedDate)
  const weekDays = Array.from({ length: 7 }, (_, index) => addIsoDays(weekStart, index))
  const monthDays = calendarDaysForMonth(monthValue)
  const monthWeeks = useMemo(() => chunkCalendarWeeks(monthDays), [monthDays])

  const setCalendarDate = (value: string) => {
    onFocusDateChange(value)
    if (monthPart(value) !== monthValue) {
      onMonthChange(monthPart(value))
    }
  }

  const calendarTaskColorStyle = (task: Task) => ({
    '--calendar-type-color': getTaskColor(task.type),
  }) as CSSProperties

  const rangeSegmentClass = (task: Task, day: string) => {
    const range = taskRanges.get(task.id) ?? calendarTaskRange(task, getTaskLifecycleDate)
    const isStart = day === range.start
    const isEnd = day === range.end
    return `${isStart ? 'span-start' : 'span-middle'} ${isEnd ? 'span-end' : ''}`
  }

  const monthSegmentsForWeek = (week: typeof monthDays) => {
    const weekStartValue = week[0]?.value ?? selectedDate
    const weekEndValue = week[week.length - 1]?.value ?? selectedDate
    const slots: boolean[][] = []
    return visibleTasks
      .map((task) => {
        const range = taskRanges.get(task.id) ?? calendarTaskRange(task, getTaskLifecycleDate)
        const segmentStart = range.start > weekStartValue ? range.start : weekStartValue
        const segmentEnd = range.end < weekEndValue ? range.end : weekEndValue
        if (segmentEnd < weekStartValue || segmentStart > weekEndValue || segmentStart > segmentEnd) {
          return null
        }
        const startIndex = week.findIndex((day) => day.value === segmentStart)
        const endIndex = week.findIndex((day) => day.value === segmentEnd)
        if (startIndex < 0 || endIndex < 0) {
          return null
        }
        return { task, range, segmentStart, segmentEnd, startIndex, endIndex }
      })
      .filter((segment): segment is NonNullable<typeof segment> => !!segment)
      .sort((a, b) => compareCalendarTasks(a.task, b.task, getTaskLifecycleDate))
      .map((segment) => {
        let slot = slots.findIndex((items) => {
          for (let index = segment.startIndex; index <= segment.endIndex; index += 1) {
            if (items[index]) return false
          }
          return true
        })
        if (slot < 0) {
          slot = slots.length
          slots.push([])
        }
        for (let index = segment.startIndex; index <= segment.endIndex; index += 1) {
          slots[slot][index] = true
        }
        return { ...segment, slot }
      })
      .filter((segment) => segment.slot < 4)
  }

  const renderAllDayTask = (task: Task, day: string) => {
    const range = taskRanges.get(task.id) ?? calendarTaskRange(task, getTaskLifecycleDate)
    return (
    <button
      type="button"
      className={`calendar-allday-chip ${rangeSegmentClass(task, day)}`}
      key={task.id}
      style={calendarTaskColorStyle(task)}
      onClick={() => onOpenTask(task.id)}
      title={`${task.title} · ${formatMonthDay(range.start)} - ${formatMonthDay(range.end)}`}
    >
      {task.title}
    </button>
    )
  }

  const renderTimedTask = (task: Task) => {
    const startsAt = calendarTaskStartsAt(task)
    if (startsAt === null) {
      return null
    }
    const firstMinute = calendarHours[0] * 60
    const lastMinute = (calendarHours.at(-1) ?? 23) * 60
    const top = Math.max(0, ((startsAt - firstMinute) / 60) * calendarHourHeight)
    const height = Math.max(30, Math.min(180, (calendarTaskDurationMinutes(task) / 60) * calendarHourHeight))
    const isOutside = startsAt < firstMinute || startsAt > lastMinute + 59
    return (
      <button
        type="button"
        className={`calendar-timed-event ${isOutside ? 'outside-hours' : ''}`}
        key={task.id}
        style={{
          ...calendarTaskColorStyle(task),
          '--event-top': `${top}px`,
          '--event-height': `${height}px`,
        } as CSSProperties}
        onClick={() => onOpenTask(task.id)}
        title={`${formatMonthDayTime(task.date)} · ${task.title}`}
      >
        <strong>{task.title}</strong>
        <span>{task.type}</span>
      </button>
    )
  }

  const renderHolidayPill = (dayMeta: ReturnType<typeof calendarDayMeta>, key: string) => {
    if (dayMeta.holidayLabel) {
      return (
        <span className="calendar-holiday-pill" key={key}>
          {dayMeta.holidayLabel}
          {dayMeta.officialLabel === '休' && <em>休</em>}
        </span>
      )
    }
    if (dayMeta.officialLabel === '补班') {
      return (
        <span className="calendar-workday-pill" key={key}>
          补班
        </span>
      )
    }
    return null
  }

  const renderScheduleGrid = (days: string[]) => (
    <div className="calendar-schedule">
      <div className="calendar-schedule-header" style={{ '--day-count': days.length } as CSSProperties}>
        <div className="calendar-timezone">GMT+08</div>
        {days.map((day) => {
          const date = localDateFromIsoDate(day)
          const dayMeta = calendarDayMeta(day)
          return (
            <button
              type="button"
              className={`calendar-schedule-day ${day === today ? 'today' : ''} ${day === selectedDate ? 'selected' : ''} ${dayMeta.isFestival ? 'festival' : ''} ${dayMeta.officialKind ? `official-${dayMeta.officialKind}` : ''}`}
              key={day}
              onClick={() => setCalendarDate(day)}
            >
              <span>{weekdayLabels[(date.getDay() + 6) % 7]}</span>
              <strong>{date.getDate()}</strong>
              <small>{dayMeta.label}</small>
            </button>
          )
        })}
      </div>
      <div className="calendar-allday-row" style={{ '--day-count': days.length } as CSSProperties}>
        <div className="calendar-time-label">计划</div>
        {days.map((day) => {
          const dayTasks = tasksByDate.get(day) ?? []
          const dayMeta = calendarDayMeta(day)
          return (
            <div className="calendar-allday-cell" key={day}>
              {renderHolidayPill(dayMeta, `${day}-holiday`)}
              {dayTasks.slice(0, dayMeta.holidayLabel || dayMeta.officialLabel ? 3 : 4).map((task) => renderAllDayTask(task, day))}
              {dayTasks.length > (dayMeta.holidayLabel || dayMeta.officialLabel ? 3 : 4) && <span className="calendar-overflow">+{dayTasks.length - (dayMeta.holidayLabel || dayMeta.officialLabel ? 3 : 4)} 项</span>}
            </div>
          )
        })}
      </div>
      <div className="calendar-time-grid" style={{ '--day-count': days.length } as CSSProperties}>
        <div className="calendar-time-axis">
          {calendarHours.map((hour) => (
            <span key={hour}>{hour < 12 ? `上午${hour}点` : hour === 12 ? '下午12点' : `下午${hour - 12}点`}</span>
          ))}
        </div>
        {days.map((day) => {
          const dayTasks = (tasksByDate.get(day) ?? []).filter((task) => datePart(task.date) === day)
          return (
            <div className="calendar-time-column" key={day}>
              {calendarHours.map((hour) => <span className="calendar-hour-line" key={hour} />)}
              {dayTasks.map(renderTimedTask)}
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <section className="panel google-calendar-panel">
      {mode === '月' ? (
        <div className="google-month-view">
          <div className="google-month-weekdays">
            {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((label) => <span key={label}>{label}</span>)}
          </div>
          <div className="google-month-grid">
            {monthWeeks.map((week) => (
              <div className="google-month-week" key={week[0]?.value}>
                <div className="google-month-week-cells">
                  {week.map((day) => {
                    const dayMeta = calendarDayMeta(day.value)
                    return (
                      <button
                        type="button"
                        className={`google-month-cell ${day.inMonth ? '' : 'outside'} ${day.value === today ? 'today' : ''} ${day.value === selectedDate ? 'selected' : ''} ${dayMeta.isFestival ? 'festival' : ''} ${dayMeta.officialKind ? `official-${dayMeta.officialKind}` : ''}`}
                        key={day.value}
                        onClick={() => setCalendarDate(day.value)}
                      >
                        <span className="google-month-date">
                          <span className="google-month-day">{day.day}</span>
                          <span className="google-month-lunar">
                            {dayMeta.label}
                          </span>
                        </span>
                        <span className="google-month-events">
                          {renderHolidayPill(dayMeta, `${day.value}-holiday`)}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="google-month-week-events" aria-hidden={false}>
                  {monthSegmentsForWeek(week).map((segment) => {
                    const isRangeStart = segment.segmentStart === segment.range.start
                    const isRangeEnd = segment.segmentEnd === segment.range.end
                    return (
                      <button
                        type="button"
                        className={`calendar-event-pill month-span ${isRangeStart ? 'span-start' : 'span-middle'} ${isRangeEnd ? 'span-end' : ''}`}
                        key={`${segment.task.id}-${segment.segmentStart}`}
                        style={{
                          ...calendarTaskColorStyle(segment.task),
                          '--span-column': segment.startIndex + 1,
                          '--span-days': segment.endIndex - segment.startIndex + 1,
                          '--span-slot': segment.slot,
                        } as CSSProperties}
                        onClick={(event) => {
                          event.stopPropagation()
                          onOpenTask(segment.task.id)
                        }}
                        title={`${segment.task.title} · ${formatMonthDay(segment.range.start)} - ${formatMonthDay(segment.range.end)}`}
                      >
                        {segment.task.title}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : renderScheduleGrid(mode === '周' ? weekDays : [selectedDate])}
    </section>
  )
}

