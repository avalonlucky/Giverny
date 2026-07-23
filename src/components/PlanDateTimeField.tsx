import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronDown, ChevronUp } from 'lucide-react'
import { MonthYearPickerPanel } from './MonthYearPickerPanel'
import { calendarDaysForMonth, weekdayLabels } from '../lib/calendar'
import { datePart, formatPlanDateTime, isoDate, isoDateTime, localDateFromIsoDate, monthPart, pad, toDateTimeInputValue } from '../lib/dateTime'
import { monthLabelOf } from '../lib/month'

const TIME_STEP_MINUTES = 5

export function PlanDateTimeField({
  label,
  value,
  onChange,
  isActive = false,
  readOnly = false,
  saved = false,
  control,
  includeTime = true,
  pickerId,
  activePickerId,
  onActivePickerChange,
  afterInput,
  commitValidInputOnChange = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  isActive?: boolean
  readOnly?: boolean
  saved?: boolean
  control?: ReactNode
  /** Date-only fields reuse this picker without the hour/minute columns. */
  includeTime?: boolean
  pickerId?: string
  activePickerId?: string | null
  onActivePickerChange?: (pickerId: string | null) => void
  afterInput?: ReactNode
  commitValidInputOnChange?: boolean
}) {
  const fieldRef = useRef<HTMLDivElement | null>(null)
  const inputWrapRef = useRef<HTMLDivElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const formatValue = (rawValue: string) => includeTime ? formatPlanDateTime(rawValue) : rawValue.replace(/-/g, '/')
  const [draft, setDraft] = useState(() => formatValue(value))
  const [syncedValue, setSyncedValue] = useState(value)
  const [localPickerOpen, setLocalPickerOpen] = useState(false)
  const [popoverPosition, setPopoverPosition] = useState<{ left: number; top: number } | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => monthPart(value || isoDate()))
  const [pickerView, setPickerView] = useState<'calendar' | 'month'>('calendar')
  const hourListRef = useRef<HTMLDivElement | null>(null)
  const minuteListRef = useRef<HTMLDivElement | null>(null)
  const controlledPicker = Boolean(pickerId && onActivePickerChange)
  const isPickerOpen = controlledPicker ? activePickerId === pickerId : localPickerOpen

  const setPickerOpen = useCallback((nextOpen: boolean) => {
    if (controlledPicker) {
      onActivePickerChange?.(nextOpen ? pickerId ?? null : null)
      return
    }
    setLocalPickerOpen(nextOpen)
  }, [controlledPicker, onActivePickerChange, pickerId])

  if (value !== syncedValue) {
    setSyncedValue(value)
    setDraft(formatValue(value))
  }

  const normalizeDateTimeInput = (input: string) => {
    const match = input.trim().match(includeTime
      ? /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?$/
      : /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
    if (!match) {
      return ''
    }
    const [, year, month, day, hour = '9', minute = '0'] = match
    const monthNumber = Number(month)
    const dayNumber = Number(day)
    const hourNumber = Number(hour)
    const minuteNumber = Number(minute)
    if (monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > 31 || hourNumber < 0 || hourNumber > 23 || minuteNumber < 0 || minuteNumber > 59) {
      return ''
    }
    const normalizedDate = `${year}-${pad(monthNumber)}-${pad(dayNumber)}`
    const normalized = includeTime ? `${normalizedDate}T${pad(hourNumber)}:${pad(minuteNumber)}` : normalizedDate
    const date = new Date(includeTime ? normalized : `${normalized}T00:00`)
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== Number(year) || date.getMonth() + 1 !== monthNumber || date.getDate() !== dayNumber) {
      return ''
    }
    return normalized
  }

  const commitDraft = () => {
    if (readOnly) {
      setDraft(formatValue(value))
      return
    }
    const normalized = normalizeDateTimeInput(draft)
    if (normalized) {
      onChange(normalized)
      setDraft(formatValue(normalized))
      return
    }
    setDraft(formatValue(value))
  }

  const selectedValue = toDateTimeInputValue(includeTime ? (value || isoDateTime()) : `${value || isoDate()}T00:00`)
  const selectedDate = datePart(selectedValue)
  const selectedHour = selectedValue.slice(11, 13)
  const selectedMinute = selectedValue.slice(14, 16)
  const calendarDays = calendarDaysForMonth(calendarMonth)
  const calendarYear = Number(calendarMonth.slice(0, 4))
  const selectedMonth = Number(calendarMonth.slice(5, 7))
  const yearOptions = Array.from({ length: 11 }, (_, index) => calendarYear - 5 + index)

  const updatePopoverPosition = useCallback(() => {
    const wrap = inputWrapRef.current
    if (!wrap) {
      return
    }
    const wrapRect = wrap.getBoundingClientRect()
    const popoverWidth = popoverRef.current?.offsetWidth ?? Math.min(396, window.innerWidth - 48)
    const popoverHeight = popoverRef.current?.offsetHeight ?? 250
    const viewportGutter = window.innerWidth <= 640 ? 16 : 24
    const popoverGap = 8
    const maxLeft = Math.max(viewportGutter, window.innerWidth - viewportGutter - popoverWidth)
    const left = Math.min(Math.max(wrapRect.right - popoverWidth, viewportGutter), maxLeft)
    const belowTop = wrapRect.bottom + popoverGap
    const aboveTop = wrapRect.top - popoverGap - popoverHeight
    const preferredTop = belowTop + popoverHeight <= window.innerHeight - viewportGutter || aboveTop < viewportGutter
      ? belowTop
      : aboveTop
    const maxTop = Math.max(viewportGutter, window.innerHeight - viewportGutter - popoverHeight)
    const top = Math.min(Math.max(preferredTop, viewportGutter), maxTop)
    setPopoverPosition({ left, top })
  }, [])

  useEffect(() => {
    if (!isPickerOpen) {
      return
    }
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (!fieldRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    const frame = window.requestAnimationFrame(() => {
      updatePopoverPosition()
      if (pickerView === 'calendar') {
        hourListRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'center' })
        minuteListRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'center' })
      }
    })
    window.addEventListener('resize', updatePopoverPosition)
    window.addEventListener('scroll', updatePopoverPosition, true)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      window.removeEventListener('resize', updatePopoverPosition)
      window.removeEventListener('scroll', updatePopoverPosition, true)
      window.cancelAnimationFrame(frame)
    }
  }, [isPickerOpen, pickerView, selectedHour, selectedMinute, calendarYear, setPickerOpen, updatePopoverPosition])

  const shiftMonth = (offset: number) => {
    const current = localDateFromIsoDate(`${calendarMonth}-01`)
    current.setMonth(current.getMonth() + offset)
    setCalendarMonth(`${current.getFullYear()}-${pad(current.getMonth() + 1)}`)
  }

  const applyDatePart = (dateValue: string) => {
    if (readOnly) {
      return
    }
    const next = includeTime ? `${dateValue}T${selectedHour}:${selectedMinute}` : dateValue
    onChange(next)
    setDraft(formatValue(next))
    setCalendarMonth(monthPart(next))
    if (!includeTime) {
      setPickerOpen(false)
    }
  }

  const applyTimePart = (part: 'hour' | 'minute', rawValue: string) => {
    if (readOnly) {
      return
    }
    const digits = rawValue.replace(/\D/g, '')
    if (!digits) {
      return
    }
    const max = part === 'hour' ? 23 : 59
    const nextValue = pad(Math.max(0, Math.min(max, Number(digits))))
    const next = part === 'hour' ? `${selectedDate}T${nextValue}:${selectedMinute}` : `${selectedDate}T${selectedHour}:${nextValue}`
    onChange(next)
    setDraft(formatPlanDateTime(next))
  }

  const applyToday = () => {
    if (readOnly) {
      return
    }
    const now = includeTime ? isoDateTime() : isoDate()
    onChange(now)
    setDraft(formatValue(now))
    setCalendarMonth(monthPart(now))
  }

  const applyClear = () => {
    if (readOnly) {
      return
    }
    onChange('')
    setDraft('')
    setPickerOpen(false)
  }

  const chooseMonth = (year: number, month: number) => {
    setCalendarMonth(`${year}-${pad(month)}`)
    setPickerView('calendar')
  }

  return (
    <div ref={fieldRef} className={`field date-field ${isActive ? 'active' : ''} ${readOnly ? 'readonly' : ''} ${saved ? 'field-saved' : ''}`}>
      <span className="field-label-row">
        <span>{label}</span>
        {control}
      </span>
      <div ref={inputWrapRef} className={`date-input-wrap${afterInput ? ' date-input-wrap-with-ref' : ''}`}>
        <input
          type="text"
          inputMode="numeric"
          value={draft}
          placeholder={includeTime ? 'YYYY/MM/DD HH:mm' : 'YYYY/MM/DD'}
          readOnly={readOnly}
          onChange={(event) => {
            const nextDraft = event.target.value
            setDraft(nextDraft)
            if (commitValidInputOnChange) {
              const normalized = normalizeDateTimeInput(nextDraft)
              if (normalized) {
                onChange(normalized)
              }
            }
          }}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }
          }}
        />
        {afterInput}
        <button
          type="button"
          aria-label={`选择${label}`}
          title={readOnly ? '打开右侧开关后可编辑' : `选择${label}`}
          disabled={readOnly}
          onClick={() => {
            if (!readOnly) {
              if (!isPickerOpen) {
                setCalendarMonth(monthPart(value || isoDate()))
                setPickerView('calendar')
              }
              setPickerOpen(!isPickerOpen)
            }
          }}
        >
          <CalendarDays size={16} />
        </button>
        {isPickerOpen && typeof document !== 'undefined' && createPortal((
          <div
            ref={popoverRef}
            className="date-time-popover"
            style={popoverPosition === null
              ? { visibility: 'hidden' }
              : { left: `${popoverPosition.left}px`, top: `${popoverPosition.top}px` }}
            role="dialog"
            aria-label={`${label}选择器`}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setPickerOpen(false)
              }
            }}
          >
            {pickerView === 'month' ? (
              <>
                <div className="date-time-popover-header">
                  <button
                    type="button"
                    className="date-time-month-trigger"
                    aria-label="选择年份和月份"
                    aria-expanded="true"
                    onClick={() => setPickerView('calendar')}
                  >
                    <strong>{monthLabelOf(calendarMonth)}</strong>
                    <ChevronDown size={14} />
                  </button>
                </div>
                <MonthYearPickerPanel
                  year={calendarYear}
                  month={selectedMonth}
                  yearOptions={yearOptions}
                  onYearChange={(year) => setCalendarMonth(`${year}-${pad(selectedMonth)}`)}
                  onMonthChange={(month) => chooseMonth(calendarYear, month)}
                />
              </>
            ) : (
              <div className={`date-time-picker-main ${includeTime ? '' : 'date-only'}`}>
                <div className="date-time-calendar-pane">
                  <div className="date-time-popover-header">
                    <button
                      type="button"
                      className="date-time-month-trigger"
                      aria-label="选择年份和月份"
                      aria-expanded="false"
                      onClick={() => setPickerView('month')}
                    >
                      <strong>{monthLabelOf(calendarMonth)}</strong>
                      <ChevronDown size={14} />
                    </button>
                    <div className="date-time-calendar-navigation" aria-label="切换月份">
                      <button type="button" aria-label="上个月" title="上个月" onClick={() => shiftMonth(-1)}>
                        <ChevronUp size={16} />
                      </button>
                      <button type="button" aria-label="下个月" title="下个月" onClick={() => shiftMonth(1)}>
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="date-time-weekdays">
                    {weekdayLabels.map((day) => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>
                  <div className="date-time-days">
                    {calendarDays.map((day) => (
                      <button
                        type="button"
                        key={day.value}
                        aria-label={day.value}
                        className={`${day.inMonth ? '' : 'muted'} ${day.value === selectedDate ? 'active' : ''}`}
                        onClick={() => applyDatePart(day.value)}
                      >
                        {day.day}
                      </button>
                    ))}
                  </div>
                </div>
                {includeTime && (
                  <>
                    <div className="date-time-scroll-column" ref={hourListRef} aria-label="选择小时">
                      {Array.from({ length: 24 }, (_, hour) => pad(hour)).map((hour) => (
                        <button
                          type="button"
                          className={hour === selectedHour ? 'active' : ''}
                          aria-pressed={hour === selectedHour}
                          key={hour}
                          onClick={() => applyTimePart('hour', hour)}
                        >
                          {hour}
                        </button>
                      ))}
                    </div>
                    <div className="date-time-scroll-column" ref={minuteListRef} aria-label="选择分钟">
                      {Array.from({ length: 60 / TIME_STEP_MINUTES }, (_, index) => pad(index * TIME_STEP_MINUTES)).map((minute) => (
                        <button
                          type="button"
                          className={minute === selectedMinute ? 'active' : ''}
                          aria-pressed={minute === selectedMinute}
                          key={minute}
                          onClick={() => applyTimePart('minute', minute)}
                        >
                          {minute}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="date-time-popover-actions">
              <button type="button" onClick={applyClear}>清除</button>
              <button type="button" onClick={applyToday}>今天</button>
            </div>
          </div>
        ), document.body)}
      </div>
    </div>
  )
}

