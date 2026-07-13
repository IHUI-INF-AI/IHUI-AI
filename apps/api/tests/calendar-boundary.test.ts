import { describe, it, expect } from 'vitest'
import {
  toDate,
  isLeapYear,
  daysInMonth,
  daysInYear,
  dayStart,
  dayEnd,
  dayBoundary,
  monthStart,
  monthEnd,
  monthBoundary,
  yearStart,
  yearEnd,
  yearBoundary,
  quarterBoundary,
  isoWeek,
  weekBoundary,
  isCrossYear,
  isCrossMonth,
  isCrossDay,
  CalendarService,
} from '../src/utils/calendar-boundary'

describe('calendar-boundary — toDate', () => {
  it('Date 原样副本', () => {
    const d = new Date(Date.UTC(2024, 5, 15, 10, 30, 0))
    const out = toDate(d)
    expect(out.getTime()).toBe(d.getTime())
    expect(out).not.toBe(d) // 副本非同引用
  })

  it('number 毫秒时间戳', () => {
    const ms = Date.UTC(2024, 0, 1)
    expect(toDate(ms).getTime()).toBe(ms)
  })

  it('ISO 字符串带 Z', () => {
    expect(toDate('2024-01-15T08:00:00Z').getTime()).toBe(Date.UTC(2024, 0, 15, 8, 0, 0))
  })

  it('纯日期字符串', () => {
    const out = toDate('2024-03-01')
    expect(out.getUTCFullYear()).toBe(2024)
    expect(out.getUTCMonth()).toBe(2)
    expect(out.getUTCDate()).toBe(1)
  })

  it('非法字符串抛 TypeError', () => {
    expect(() => toDate('not-a-date')).toThrow(TypeError)
  })
})

describe('calendar-boundary — isLeapYear', () => {
  it('2000 是闰年（能被 400 整除）', () => {
    expect(isLeapYear(2000)).toBe(true)
  })
  it('2100 不是闰年（能被 100 整除但不能被 400）', () => {
    expect(isLeapYear(2100)).toBe(false)
  })
  it('2024 是闰年（能被 4 整除）', () => {
    expect(isLeapYear(2024)).toBe(true)
  })
  it('2023 不是闰年', () => {
    expect(isLeapYear(2023)).toBe(false)
  })
  it('1900 不是闰年', () => {
    expect(isLeapYear(1900)).toBe(false)
  })
})

describe('calendar-boundary — daysInMonth', () => {
  it('大月 31 天', () => {
    expect(daysInMonth(2024, 1)).toBe(31) // Jan
    expect(daysInMonth(2024, 3)).toBe(31) // Mar
    expect(daysInMonth(2024, 5)).toBe(31) // May
    expect(daysInMonth(2024, 7)).toBe(31) // Jul
    expect(daysInMonth(2024, 8)).toBe(31) // Aug
    expect(daysInMonth(2024, 10)).toBe(31) // Oct
    expect(daysInMonth(2024, 12)).toBe(31) // Dec
  })
  it('小月 30 天', () => {
    expect(daysInMonth(2024, 4)).toBe(30) // Apr
    expect(daysInMonth(2024, 6)).toBe(30) // Jun
    expect(daysInMonth(2024, 9)).toBe(30) // Sep
    expect(daysInMonth(2024, 11)).toBe(30) // Nov
  })
  it('2 月闰年 29 天', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2000, 2)).toBe(29)
  })
  it('2 月平年 28 天', () => {
    expect(daysInMonth(2023, 2)).toBe(28)
    expect(daysInMonth(2100, 2)).toBe(28)
  })
  it('非法 month 抛 RangeError', () => {
    expect(() => daysInMonth(2024, 0)).toThrow(RangeError)
    expect(() => daysInMonth(2024, 13)).toThrow(RangeError)
  })
})

describe('calendar-boundary — daysInYear', () => {
  it('闰年 366 天', () => {
    expect(daysInYear(2024)).toBe(366)
    expect(daysInYear(2000)).toBe(366)
  })
  it('平年 365 天', () => {
    expect(daysInYear(2023)).toBe(365)
    expect(daysInYear(2100)).toBe(365)
  })
})

describe('calendar-boundary — day 边界', () => {
  const noon = new Date(Date.UTC(2024, 5, 15, 12, 30, 45)) // 2024-06-15 12:30:45 UTC

  it('dayStart 返回当天 00:00 UTC', () => {
    const start = dayStart(noon)
    expect(start.getTime()).toBe(Date.UTC(2024, 5, 15, 0, 0, 0))
  })
  it('dayEnd 返回次日 00:00 UTC', () => {
    const end = dayEnd(noon)
    expect(end.getTime()).toBe(Date.UTC(2024, 5, 16, 0, 0, 0))
  })
  it('dayBoundary 含 start/end/date/weekday', () => {
    const b = dayBoundary(noon)
    expect(b.start.getTime()).toBe(Date.UTC(2024, 5, 15, 0, 0, 0))
    expect(b.end.getTime()).toBe(Date.UTC(2024, 5, 16, 0, 0, 0))
    expect(b.date.getTime()).toBe(noon.getTime())
    // 2024-06-15 是周六 → getUTCDay()=6 → weekday=5 (0=Mon)
    expect(b.weekday).toBe(5)
  })
  it('dayBoundary 周一 weekday=0', () => {
    const monday = new Date(Date.UTC(2024, 5, 17, 10, 0, 0)) // 2024-06-17 周一
    expect(dayBoundary(monday).weekday).toBe(0)
  })
  it('dayBoundary 周日 weekday=6', () => {
    const sunday = new Date(Date.UTC(2024, 5, 16, 10, 0, 0)) // 2024-06-16 周日
    expect(dayBoundary(sunday).weekday).toBe(6)
  })
})

describe('calendar-boundary — month 边界', () => {
  const mid = new Date(Date.UTC(2024, 1, 15, 10, 0, 0)) // 2024-02-15

  it('monthStart 返回当月 1 日 00:00 UTC', () => {
    expect(monthStart(mid).getTime()).toBe(Date.UTC(2024, 1, 1, 0, 0, 0))
  })
  it('monthEnd 返回下月 1 日 00:00 UTC', () => {
    expect(monthEnd(mid).getTime()).toBe(Date.UTC(2024, 2, 1, 0, 0, 0))
  })
  it('monthBoundary 含 year/month/days', () => {
    const b = monthBoundary(mid)
    expect(b.year).toBe(2024)
    expect(b.month).toBe(2)
    expect(b.days).toBe(29) // 闰年 2 月
    expect(b.start.getTime()).toBe(Date.UTC(2024, 1, 1, 0, 0, 0))
    expect(b.end.getTime()).toBe(Date.UTC(2024, 2, 1, 0, 0, 0))
  })
  it('12 月 monthEnd 跨年', () => {
    const dec = new Date(Date.UTC(2024, 11, 15, 10, 0, 0))
    expect(monthEnd(dec).getTime()).toBe(Date.UTC(2025, 0, 1, 0, 0, 0))
  })
})

describe('calendar-boundary — year 边界', () => {
  const mid = new Date(Date.UTC(2024, 5, 15, 10, 0, 0))

  it('yearStart 返回当年 1 月 1 日 00:00 UTC', () => {
    expect(yearStart(mid).getTime()).toBe(Date.UTC(2024, 0, 1, 0, 0, 0))
  })
  it('yearEnd 返回次年 1 月 1 日 00:00 UTC', () => {
    expect(yearEnd(mid).getTime()).toBe(Date.UTC(2025, 0, 1, 0, 0, 0))
  })
  it('yearBoundary 含 year/days/isLeap', () => {
    const b = yearBoundary(mid)
    expect(b.year).toBe(2024)
    expect(b.days).toBe(366)
    expect(b.isLeap).toBe(true)
  })
  it('平年 yearBoundary', () => {
    const b = yearBoundary(new Date(Date.UTC(2023, 5, 15)))
    expect(b.days).toBe(365)
    expect(b.isLeap).toBe(false)
  })
})

describe('calendar-boundary — quarter 边界', () => {
  it('Q1: 1-3 月', () => {
    const feb = new Date(Date.UTC(2024, 1, 15))
    const b = quarterBoundary(feb)
    expect(b.quarter).toBe(1)
    expect(b.start.getTime()).toBe(Date.UTC(2024, 0, 1, 0, 0, 0))
    expect(b.end.getTime()).toBe(Date.UTC(2024, 3, 1, 0, 0, 0))
  })
  it('Q2: 4-6 月', () => {
    const may = new Date(Date.UTC(2024, 4, 15))
    const b = quarterBoundary(may)
    expect(b.quarter).toBe(2)
    expect(b.start.getTime()).toBe(Date.UTC(2024, 3, 1, 0, 0, 0))
    expect(b.end.getTime()).toBe(Date.UTC(2024, 6, 1, 0, 0, 0))
  })
  it('Q3: 7-9 月', () => {
    const aug = new Date(Date.UTC(2024, 7, 15))
    const b = quarterBoundary(aug)
    expect(b.quarter).toBe(3)
    expect(b.start.getTime()).toBe(Date.UTC(2024, 6, 1, 0, 0, 0))
    expect(b.end.getTime()).toBe(Date.UTC(2024, 9, 1, 0, 0, 0))
  })
  it('Q4: 10-12 月（跨年）', () => {
    const nov = new Date(Date.UTC(2024, 10, 15))
    const b = quarterBoundary(nov)
    expect(b.quarter).toBe(4)
    expect(b.start.getTime()).toBe(Date.UTC(2024, 9, 1, 0, 0, 0))
    expect(b.end.getTime()).toBe(Date.UTC(2025, 0, 1, 0, 0, 0)) // 跨年
  })
})

describe('calendar-boundary — isoWeek', () => {
  it('普通日期 ISO 周', () => {
    // 2024-01-03 是周三，属于 2024 年第 1 周
    const r = isoWeek('2024-01-03T00:00:00Z')
    expect(r.year).toBe(2024)
    expect(r.week).toBe(1)
  })
  it('跨年周：2021-01-01 属于 2020 年第 53 周', () => {
    const r = isoWeek('2021-01-01T00:00:00Z')
    expect(r.year).toBe(2020)
    expect(r.week).toBe(53)
  })
  it('2023-01-01 属于 2022 年第 52 周', () => {
    const r = isoWeek('2023-01-01T00:00:00Z')
    expect(r.year).toBe(2022)
    expect(r.week).toBe(52)
  })
  it('2024-12-30 属于 2025 年第 1 周', () => {
    const r = isoWeek('2024-12-30T00:00:00Z')
    expect(r.year).toBe(2025)
    expect(r.week).toBe(1)
  })
})

describe('calendar-boundary — weekBoundary', () => {
  it('MONDAY 起始：周三 → 周一为 start', () => {
    // 2024-06-19 是周三
    const wed = new Date(Date.UTC(2024, 5, 19, 10, 0, 0))
    const b = weekBoundary(wed, 'MONDAY')
    expect(b.start.getTime()).toBe(Date.UTC(2024, 5, 17, 0, 0, 0)) // 周一
    expect(b.end.getTime()).toBe(Date.UTC(2024, 5, 24, 0, 0, 0)) // 下周一
  })
  it('SUNDAY 起始：周三 → 周日为 start', () => {
    const wed = new Date(Date.UTC(2024, 5, 19, 10, 0, 0))
    const b = weekBoundary(wed, 'SUNDAY')
    expect(b.start.getTime()).toBe(Date.UTC(2024, 5, 16, 0, 0, 0)) // 周日
    expect(b.end.getTime()).toBe(Date.UTC(2024, 5, 23, 0, 0, 0)) // 下周日
  })
  it('默认 MONDAY 起始', () => {
    const mon = new Date(Date.UTC(2024, 5, 17, 10, 0, 0)) // 周一
    const b = weekBoundary(mon)
    expect(b.start.getTime()).toBe(Date.UTC(2024, 5, 17, 0, 0, 0))
  })
  it('含 isoWeek/isoYear', () => {
    const b = weekBoundary('2021-01-01T00:00:00Z', 'MONDAY')
    expect(b.isoWeek).toBe(53)
    expect(b.isoYear).toBe(2020)
  })
})

describe('calendar-boundary — isCross 判断', () => {
  it('isCrossYear: 同年 false / 跨年 true', () => {
    expect(isCrossYear('2024-06-15T00:00:00Z', '2024-12-31T23:59:59Z')).toBe(false)
    expect(isCrossYear('2024-12-31T23:59:59Z', '2025-01-01T00:00:00Z')).toBe(true)
  })
  it('isCrossMonth: 同月 false / 跨月 true / 跨年同月 false', () => {
    expect(isCrossMonth('2024-06-15T00:00:00Z', '2024-06-30T23:59:59Z')).toBe(false)
    expect(isCrossMonth('2024-06-30T23:59:59Z', '2024-07-01T00:00:00Z')).toBe(true)
    expect(isCrossMonth('2024-06-15T00:00:00Z', '2025-06-15T00:00:00Z')).toBe(true) // 跨年
  })
  it('isCrossDay: 同天 false / 跨天 true', () => {
    expect(isCrossDay('2024-06-15T00:00:00Z', '2024-06-15T23:59:59Z')).toBe(false)
    expect(isCrossDay('2024-06-15T23:59:59Z', '2024-06-16T00:00:00Z')).toBe(true)
  })
})

describe('calendar-boundary — CalendarService', () => {
  it('封装 day/month/year/week/quarter 并统计', () => {
    const svc = new CalendarService('MONDAY')
    svc.day('2024-06-15T10:00:00Z')
    svc.month('2024-06-15T10:00:00Z')
    svc.year('2024-06-15T10:00:00Z')
    svc.week('2024-06-15T10:00:00Z')
    svc.quarter('2024-06-15T10:00:00Z')
    const stats = svc.getStats()
    expect(stats.day).toBe(1)
    expect(stats.month).toBe(1)
    expect(stats.year).toBe(1)
    expect(stats.week).toBe(1)
    expect(stats.quarter).toBe(1)
  })
  it('day 返回 DayBoundary', () => {
    const svc = new CalendarService()
    const b = svc.day('2024-06-15T10:00:00Z')
    expect(b.start.getTime()).toBe(Date.UTC(2024, 5, 15, 0, 0, 0))
  })
  it('week 默认 MONDAY 起始', () => {
    const svc = new CalendarService() // 默认 MONDAY
    const b = svc.week('2024-06-19T10:00:00Z') // 周三
    expect(b.start.getTime()).toBe(Date.UTC(2024, 5, 17, 0, 0, 0)) // 周一
  })
  it('week SUNDAY 起始', () => {
    const svc = new CalendarService('SUNDAY')
    const b = svc.week('2024-06-19T10:00:00Z') // 周三
    expect(b.start.getTime()).toBe(Date.UTC(2024, 5, 16, 0, 0, 0)) // 周日
  })
  it('多次调用累计统计', () => {
    const svc = new CalendarService()
    svc.day('2024-06-15T10:00:00Z')
    svc.day('2024-06-16T10:00:00Z')
    svc.day('2024-06-17T10:00:00Z')
    expect(svc.getStats().day).toBe(3)
  })
})
