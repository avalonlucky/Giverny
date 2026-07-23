import { useState } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { MonthYearPickerPanel } from './MonthYearPickerPanel'
import { monthLabelOf } from '../lib/month'
import { pad } from '../lib/dateTime'

export function MonthPicker({
  value,
  taskMonthValues,
  onChange,
  minimal = false,
  iconOnly = false,
}: {
  value: string
  taskMonthValues: Set<string>
  onChange: (value: string) => void
  minimal?: boolean
  iconOnly?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedYear = Number(value.slice(0, 4)) || new Date().getFullYear()
  const selectedMonth = Number(value.slice(5, 7))
  const [displayYear, setDisplayYear] = useState(selectedYear)
  const chooseMonth = (month: number) => {
    onChange(`${displayYear}-${pad(month)}`)
    setIsOpen(false)
  }

  return (
    <div className="month-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false) }}>
      <button
        type="button"
        className={iconOnly ? `topbar-shortcut month-trigger ${isOpen ? 'active' : ''}`.trim() : `select-button month-trigger ${minimal ? 'minimal' : ''} ${isOpen ? 'active' : ''}`.trim()}
        aria-label="选择年份和月份"
        aria-expanded={isOpen}
        title={iconOnly ? `${monthLabelOf(value)}（数字键快速跳月，- / = 为 11 / 12 月）` : '数字键快速跳月，- / = 为 11 / 12 月'}
        onClick={() => { if (!isOpen) setDisplayYear(selectedYear); setIsOpen((open) => !open) }}
      >
        {iconOnly ? <CalendarDays size={16} /> : <><>{!minimal && <CalendarDays size={17} />}</><span>{monthLabelOf(value)}</span><ChevronDown size={16} /></>}
      </button>
      {isOpen && <div className="month-popover" role="dialog" aria-label="选择年份和月份">
        <MonthYearPickerPanel
          year={displayYear}
          month={displayYear === selectedYear ? selectedMonth : undefined}
          yearOptions={Array.from({ length: 11 }, (_, index) => displayYear - 5 + index)}
          taskMonthValues={taskMonthValues}
          onYearChange={setDisplayYear}
          onMonthChange={chooseMonth}
        />
      </div>}
    </div>
  )
}
