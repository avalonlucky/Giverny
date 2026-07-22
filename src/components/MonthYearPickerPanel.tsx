import { useEffect, useRef } from 'react'

type MonthYearPickerPanelProps = {
  year: number
  month?: number
  yearOptions: number[]
  onYearChange: (year: number) => void
  onMonthChange: (month: number) => void
  taskMonthValues?: Set<string>
}

const pad = (value: number) => String(value).padStart(2, '0')

export function MonthYearPickerPanel({
  year,
  month,
  yearOptions,
  onYearChange,
  onMonthChange,
  taskMonthValues,
}: MonthYearPickerPanelProps) {
  const yearListRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      yearListRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [year])

  return (
    <div className="date-time-month-panel month-year-picker-panel">
      <div className="date-time-year-list" ref={yearListRef} aria-label="选择年份">
        {yearOptions.map((option) => (
          <button
            type="button"
            className={option === year ? 'active' : ''}
            aria-pressed={option === year}
            key={option}
            onClick={() => onYearChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="date-time-month-grid" aria-label="选择月份">
        {Array.from({ length: 12 }, (_, index) => index + 1).map((option) => {
          const isSelected = option === month
          const hasTasks = taskMonthValues?.has(`${year}-${pad(option)}`) ?? false
          return (
            <button
              type="button"
              className={`${isSelected ? 'active' : ''} ${hasTasks ? 'has-tasks' : ''}`.trim()}
              key={option}
              aria-pressed={isSelected}
              aria-label={`${year} 年 ${option} 月${hasTasks ? '，有任务' : ''}`}
              onClick={() => onMonthChange(option)}
            >
              {option}月
              {hasTasks && <i aria-hidden="true" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
