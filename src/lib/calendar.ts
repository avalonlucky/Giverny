import { isoDateFromLocalDate, localDateFromIsoDate } from './dateTime'

export function addIsoDays(value: string, amount: number) {
  const date = localDateFromIsoDate(value)
  date.setDate(date.getDate() + amount)
  return isoDateFromLocalDate(date)
}

export const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']
const lunarDayLabels = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十']
const lunarMonthNumbers: Record<string, number> = {
  正月: 1,
  一月: 1,
  二月: 2,
  三月: 3,
  四月: 4,
  五月: 5,
  六月: 6,
  七月: 7,
  八月: 8,
  九月: 9,
  十月: 10,
  冬月: 11,
  十一月: 11,
  腊月: 12,
  十二月: 12,
}
const solarFestivalLabels: Record<string, string> = {
  '01-01': '元旦',
  '02-14': '情人节',
  '03-08': '妇女节',
  '03-12': '植树节',
  '05-01': '劳动节',
  '06-01': '儿童节',
  '09-10': '教师节',
  '10-01': '国庆节',
  '12-25': '圣诞节',
}
const lunarFestivalLabels: Record<string, string> = {
  '1-1': '春节',
  '1-15': '元宵节',
  '2-2': '龙抬头',
  '5-5': '端午节',
  '7-7': '七夕',
  '7-15': '中元节',
  '8-15': '中秋节',
  '9-9': '重阳节',
  '12-8': '腊八节',
  '12-23': '小年',
  '12-24': '小年',
}
const officialHolidayRanges2026 = [
  { name: '元旦', start: '2026-01-01', end: '2026-01-03' },
  { name: '春节', start: '2026-02-15', end: '2026-02-23' },
  { name: '清明节', start: '2026-04-04', end: '2026-04-06' },
  { name: '劳动节', start: '2026-05-01', end: '2026-05-05' },
  { name: '端午节', start: '2026-06-19', end: '2026-06-21' },
  { name: '中秋节', start: '2026-09-25', end: '2026-09-27' },
  { name: '国庆节', start: '2026-10-01', end: '2026-10-07' },
]
const officialWorkdays2026: Record<string, string> = {
  '2026-01-04': '元旦补班',
  '2026-02-14': '春节补班',
  '2026-02-28': '春节补班',
  '2026-05-09': '劳动节补班',
  '2026-09-20': '国庆补班',
  '2026-10-10': '国庆补班',
}

const chineseCalendarFormatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
  month: 'long',
  day: 'numeric',
})

export function dateRangeValues(start: string, end: string) {
  const values: string[] = []
  const current = localDateFromIsoDate(start)
  const last = localDateFromIsoDate(end)
  while (current.getTime() <= last.getTime()) {
    values.push(isoDateFromLocalDate(current))
    current.setDate(current.getDate() + 1)
  }
  return values
}

const officialHolidayMeta: Record<string, { name: string; kind: 'holiday' | 'workday' }> = {
  ...officialHolidayRanges2026.reduce<Record<string, { name: string; kind: 'holiday' | 'workday' }>>((acc, range) => {
    dateRangeValues(range.start, range.end).forEach((value) => {
      acc[value] = { name: range.name, kind: 'holiday' }
    })
    return acc
  }, {}),
  ...Object.fromEntries(Object.entries(officialWorkdays2026).map(([value, name]) => [value, { name, kind: 'workday' as const }])),
}

function getLunarDateParts(value: string) {
  const parts = chineseCalendarFormatter.formatToParts(localDateFromIsoDate(value))
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  const dayValue = Number(parts.find((part) => part.type === 'day')?.value ?? '')
  return {
    month,
    day: Number.isFinite(dayValue) ? dayValue : 0,
  }
}

function isChineseNewYearEve(value: string) {
  const next = getLunarDateParts(addIsoDays(value, 1))
  return next.month.replace('闰', '') === '正月' && next.day === 1
}

export function calendarDayMeta(value: string) {
  const lunar = getLunarDateParts(value)
  const official = officialHolidayMeta[value]
  const solarFestival = solarFestivalLabels[value.slice(5, 10)]
  const lunarMonth = lunarMonthNumbers[lunar.month.replace('闰', '')]
  const lunarFestival = lunarMonth ? lunarFestivalLabels[`${lunarMonth}-${lunar.day}`] : undefined
  const festival = solarFestival ?? lunarFestival ?? (isChineseNewYearEve(value) ? '除夕' : undefined)
  const holidayLabel = festival
    ?? (official?.kind === 'holiday' ? (official.name === '国庆节' ? '黄金周' : official.name) : undefined)
  const officialLabel = official?.kind === 'workday' ? '补班' : official?.kind === 'holiday' ? '休' : undefined
  const lunarLabel = lunar.day === 1 ? lunar.month : lunarDayLabels[lunar.day - 1] ?? ''
  return {
    label: lunarLabel,
    holidayLabel,
    officialLabel,
    isFestival: Boolean(holidayLabel),
    officialKind: official?.kind,
  }
}

export function calendarDaysForMonth(monthValue: string) {
  const [year, month] = monthValue.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const start = new Date(year, month - 1, 1 - startOffset)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      value: isoDateFromLocalDate(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month - 1,
    }
  })
}

