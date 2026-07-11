/**
 * 日历边界计算（bug138）。
 *
 * 给出任意时间点，返回自然天/月/年/季度的 UTC 边界。
 * 正确处理闰年（2000 是闰年、2100 不是）、大小月、ISO 周编号。
 *
 * 所有边界均以 UTC 返回，避免时区歧义。
 * 迁移自旧架构 bug138_calendar_boundary.py。
 */

/** 周起始日。 */
export type WeekStart = 'MONDAY' | 'SUNDAY'

/** 日边界。 */
export interface DayBoundary {
  /** 当天 00:00:00 UTC */
  start: Date
  /** 次日 00:00:00 UTC（即当天结束） */
  end: Date
  /** 日期部分 */
  date: Date
  /** 星期几（0=周一 … 6=周日） */
  weekday: number
}

/** 月边界。 */
export interface MonthBoundary {
  year: number
  month: number // 1-12
  start: Date
  end: Date
  days: number
}

/** 年边界。 */
export interface YearBoundary {
  year: number
  start: Date
  end: Date
  days: number
  isLeap: boolean
}

/** 季度边界。 */
export interface QuarterBoundary {
  year: number
  quarter: number // 1-4
  start: Date
  end: Date
}

/** 周边界。 */
export interface WeekBoundary {
  start: Date
  end: Date
  /** ISO 周编号 */
  isoWeek: number
  /** ISO 年（跨年周可能与前/后一年对齐） */
  isoYear: number
}

/** 输入类型：Date / ISO 字符串 / 毫秒时间戳。 */
export type DateInput = Date | string | number

/** 把各种输入转成 Date（UTC）。 */
export function toDate(v: DateInput): Date {
  if (v instanceof Date) return new Date(v.getTime())
  if (typeof v === 'number') return new Date(v)
  if (typeof v === 'string') {
    const s = v.trim()
    // 处理 Z 后缀
    const normalized = s.endsWith('Z') ? s : s
    const d = new Date(normalized)
    if (Number.isNaN(d.getTime())) {
      // 尝试常见无时区格式
      const d2 = new Date(s + 'Z')
      if (!Number.isNaN(d2.getTime())) return d2
      throw new TypeError(`无法解析时间字符串: ${v}`)
    }
    return d
  }
  throw new TypeError(`不支持的时间类型: ${typeof v}`)
}

/** 判断闰年（2000 是，2100 不是，2024 是）。 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** 返回某年某月的天数（大小月 + 闰年 2 月）。 */
export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) {
    throw new RangeError('month 必须在 1-12')
  }
  // Date.UTC(year, month, 0) 返回上个月最后一天
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** 返回某年的天数（365 或 366）。 */
export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365
}

/** 自然天边界。 */
export function dayStart(v: DateInput): Date {
  const d = toDate(v)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export function dayEnd(v: DateInput): Date {
  const start = dayStart(v)
  return new Date(start.getTime() + 24 * 60 * 60 * 1000)
}

export function dayBoundary(v: DateInput): DayBoundary {
  const d = toDate(v)
  const start = dayStart(v)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return {
    start,
    end,
    date: new Date(d.getTime()),
    weekday: d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1, // 0=Mon
  }
}

/** 自然月边界。 */
export function monthStart(v: DateInput): Date {
  const d = toDate(v)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

export function monthEnd(v: DateInput): Date {
  const d = toDate(v)
  const nextMonth = d.getUTCMonth() === 11 ? 0 : d.getUTCMonth() + 1
  const nextYear = d.getUTCMonth() === 11 ? d.getUTCFullYear() + 1 : d.getUTCFullYear()
  return new Date(Date.UTC(nextYear, nextMonth, 1))
}

export function monthBoundary(v: DateInput): MonthBoundary {
  const d = toDate(v)
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth() + 1
  return {
    year,
    month,
    start: monthStart(v),
    end: monthEnd(v),
    days: daysInMonth(year, month),
  }
}

/** 自然年边界。 */
export function yearStart(v: DateInput): Date {
  const d = toDate(v)
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
}

export function yearEnd(v: DateInput): Date {
  const d = toDate(v)
  return new Date(Date.UTC(d.getUTCFullYear() + 1, 0, 1))
}

export function yearBoundary(v: DateInput): YearBoundary {
  const d = toDate(v)
  const year = d.getUTCFullYear()
  return {
    year,
    start: yearStart(v),
    end: yearEnd(v),
    days: daysInYear(year),
    isLeap: isLeapYear(year),
  }
}

/** 自然季度边界。 */
export function quarterStart(v: DateInput): Date {
  const d = toDate(v)
  const quarter = Math.floor(d.getUTCMonth() / 3)
  const startMonth = quarter * 3
  return new Date(Date.UTC(d.getUTCFullYear(), startMonth, 1))
}

export function quarterEnd(v: DateInput): Date {
  const d = toDate(v)
  const quarter = Math.floor(d.getUTCMonth() / 3)
  const endMonth = quarter * 3 + 3
  const endYear = endMonth > 11 ? d.getUTCFullYear() + 1 : d.getUTCFullYear()
  const adjMonth = endMonth > 11 ? endMonth - 12 : endMonth
  return new Date(Date.UTC(endYear, adjMonth, 1))
}

export function quarterBoundary(v: DateInput): QuarterBoundary {
  const d = toDate(v)
  const quarter = Math.floor(d.getUTCMonth() / 3) + 1
  return {
    year: d.getUTCFullYear(),
    quarter,
    start: quarterStart(v),
    end: quarterEnd(v),
  }
}

/**
 * ISO 周编号。
 *
 * ISO 8601 规定：每周从周一开始，每年的第一周是包含该年第一个周四的周。
 * 跨年时 ISO 年可能与日历年不同。
 */
export function isoWeek(v: DateInput): { year: number; week: number } {
  const d = toDate(v)
  // 复制到 UTC 日期
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  // getUTCDay: 0=Sun … 6=Sat；ISO 需要 1=Mon … 7=Sun
  const dayNum = date.getUTCDay() || 7
  // 移到本周周四（ISO 周年取决于周四所在年）
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const isoYear = date.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const weekNum = 1 + Math.floor((date.getTime() - yearStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
  return { year: isoYear, week: weekNum }
}

/** 自然周边界。 */
export function weekBoundary(v: DateInput, weekStart: WeekStart = 'MONDAY'): WeekBoundary {
  const d = toDate(v)
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const wd = date.getUTCDay() // 0=Sun … 6=Sat
  // 周一为起始：offset = (wd + 6) % 7
  // 周日为起始：offset = wd
  const offset = weekStart === 'MONDAY' ? (wd + 6) % 7 : wd
  const start = new Date(date.getTime() - offset * 24 * 60 * 60 * 1000)
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
  const iso = isoWeek(v)
  return {
    start,
    end,
    isoWeek: iso.week,
    isoYear: iso.year,
  }
}

/** 判断两个时间是否跨年。 */
export function isCrossYear(start: DateInput, end: DateInput): boolean {
  return toDate(start).getUTCFullYear() !== toDate(end).getUTCFullYear()
}

/** 判断两个时间是否跨月。 */
export function isCrossMonth(start: DateInput, end: DateInput): boolean {
  const a = toDate(start)
  const b = toDate(end)
  return a.getUTCFullYear() !== b.getUTCFullYear() || a.getUTCMonth() !== b.getUTCMonth()
}

/** 判断两个时间是否跨天。 */
export function isCrossDay(start: DateInput, end: DateInput): boolean {
  const a = dayStart(start)
  const b = dayStart(end)
  return a.getTime() !== b.getTime()
}

/**
 * 日历服务：封装常用边界查询并统计调用次数。
 */
export class CalendarService {
  private readonly weekStart: WeekStart
  private readonly stats: Record<string, number> = {
    day: 0,
    month: 0,
    year: 0,
    week: 0,
    quarter: 0,
  }

  constructor(weekStart: WeekStart = 'MONDAY') {
    this.weekStart = weekStart
  }

  day(v: DateInput): DayBoundary {
    this.stats.day = (this.stats.day ?? 0) + 1
    return dayBoundary(v)
  }

  month(v: DateInput): MonthBoundary {
    this.stats.month = (this.stats.month ?? 0) + 1
    return monthBoundary(v)
  }

  year(v: DateInput): YearBoundary {
    this.stats.year = (this.stats.year ?? 0) + 1
    return yearBoundary(v)
  }

  week(v: DateInput): WeekBoundary {
    this.stats.week = (this.stats.week ?? 0) + 1
    return weekBoundary(v, this.weekStart)
  }

  quarter(v: DateInput): QuarterBoundary {
    this.stats.quarter = (this.stats.quarter ?? 0) + 1
    return quarterBoundary(v)
  }

  getStats(): Record<string, number> {
    return { ...this.stats }
  }
}
