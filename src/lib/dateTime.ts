export const pad = (value: number) => String(value).padStart(2, '0')

export function isoDate(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function isoDateTime(offsetMinutes = 0) {
  const date = new Date()
  date.setMinutes(date.getMinutes() + offsetMinutes)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function planDateTimeFromMinuteStamp(stamp: number) {
  const date = new Date(stamp * 60000)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function datePart(value: string) {
  return value.slice(0, 10)
}

export function toDateTimeInputValue(value: string) {
  if (!value) {
    return ''
  }
  return value.includes('T') ? value.slice(0, 16) : `${datePart(value)}T09:00`
}

export function formatPlanDateTime(value: string) {
  if (!value) {
    return ''
  }
  const date = datePart(value).replaceAll('-', '/')
  return value.includes('T') ? `${date} ${value.slice(11, 16)}` : date
}

export function formatDurationZh(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes))
  const hours = Math.floor(safeMinutes / 60)
  const restMinutes = safeMinutes % 60
  if (hours === 0) {
    return `${restMinutes} 分钟`
  }
  if (restMinutes === 0) {
    return `${hours} 小时`
  }
  return `${hours} 小时 ${restMinutes} 分钟`
}

export function monthPart(value: string) {
  return datePart(value).slice(0, 7)
}

export function formatMonthDayTime(value: string) {
  if (!value) {
    return ''
  }
  const date = datePart(value)
  const monthDay = `${date.slice(5, 7)}/${date.slice(8, 10)}`
  return value.includes('T') ? `${monthDay} ${value.slice(11, 16)}` : monthDay
}

export function formatMonthDay(value: string) {
  if (!value) {
    return ''
  }
  const date = datePart(value)
  return `${date.slice(5, 7)}/${date.slice(8, 10)}`
}

export function isoDateFromLocalDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function localDateFromIsoDate(value: string) {
  const [year, month, day] = datePart(value || isoDate()).split('-').map(Number)
  return new Date(year, month - 1, day)
}
