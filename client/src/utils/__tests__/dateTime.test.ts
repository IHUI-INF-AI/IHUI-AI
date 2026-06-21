import { describe, it, expect } from 'vitest'
import {
  formatDate,
  toDate,
  formatRelative,
  formatDuration,
  isToday,
  isYesterday,
  isTomorrow,
  isThisWeek,
  isThisMonth,
  isThisYear,
  addDays,
  addMonths,
  addYears,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  diffInDays,
  diffInHours,
  diffInMinutes,
  isExpired,
  isExpiringSoon,
  useDateTime,
} from '../dateTime'

describe('dateTime', () => {
  describe('toDate', () => {
    it('应该返回Date对象当输入是Date', () => {
      const date = new Date('2024-01-15')
      expect(toDate(date)).toBe(date)
    })

    it('应该返回Date对象当输入是时间戳', () => {
      const timestamp = 1705276800000
      const result = toDate(timestamp)
      expect(result instanceof Date).toBe(true)
    })

    it('应该返回Date对象当输入是日期字符串', () => {
      const result = toDate('2024-01-15')
      expect(result instanceof Date).toBe(true)
    })

    it('应该返回null当输入为空', () => {
      expect(toDate(null as any)).toBeNull()
      expect(toDate(undefined as any)).toBeNull()
      expect(toDate('')).toBeNull()
    })

    it('应该返回null当输入是无效日期字符串', () => {
      expect(toDate('invalid')).toBeNull()
    })
  })

  describe('formatDate', () => {
    it('应该格式化日期', () => {
      const date = new Date('2024-01-15T10:30:00')
      const result = formatDate(date, { format: 'date' })
      expect(result).toBeDefined()
    })

    it('应该格式化时间', () => {
      const date = new Date('2024-01-15T10:30:00')
      const result = formatDate(date, { format: 'time' })
      expect(result).toBeDefined()
    })

    it('应该格式化日期时间', () => {
      const date = new Date('2024-01-15T10:30:00')
      const result = formatDate(date, { format: 'datetime' })
      expect(result).toBeDefined()
    })

    it('应该格式化完整日期', () => {
      const date = new Date('2024-01-15T10:30:00')
      const result = formatDate(date, { format: 'full' })
      expect(result).toBeDefined()
    })

    it('应该格式化相对时间', () => {
      const date = new Date(Date.now() - 1000 * 60 * 5)
      const result = formatDate(date, { format: 'relative' })
      expect(result).toContain('分钟前')
    })

    it('应该支持显示秒', () => {
      const date = new Date('2024-01-15T10:30:45')
      const result = formatDate(date, { format: 'datetime', showSeconds: true })
      expect(result).toBeDefined()
    })

    it('应该返回空字符串当输入无效', () => {
      expect(formatDate(null as any)).toBe('')
      expect(formatDate('')).toBe('')
    })
  })

  describe('formatRelative', () => {
    it('应该返回刚刚', () => {
      const date = new Date(Date.now() - 1000 * 30)
      expect(formatRelative(date)).toBe('刚刚')
    })

    it('应该返回分钟前', () => {
      const date = new Date(Date.now() - 1000 * 60 * 5)
      expect(formatRelative(date)).toBe('5分钟前')
    })

    it('应该返回小时前', () => {
      const date = new Date(Date.now() - 1000 * 60 * 60 * 3)
      expect(formatRelative(date)).toBe('3小时前')
    })

    it('应该返回天前', () => {
      const date = new Date(Date.now() - 1000 * 60 * 60 * 24 * 5)
      expect(formatRelative(date)).toBe('5天前')
    })

    it('应该返回个月前', () => {
      const date = new Date(Date.now() - 1000 * 60 * 60 * 24 * 60)
      expect(formatRelative(date)).toContain('个月前')
    })

    it('应该返回年前', () => {
      const date = new Date(Date.now() - 1000 * 60 * 60 * 24 * 400)
      expect(formatRelative(date)).toContain('年前')
    })
  })

  describe('formatDuration', () => {
    it('应该格式化毫秒', () => {
      expect(formatDuration(500)).toBe('500毫秒')
    })

    it('应该格式化秒', () => {
      expect(formatDuration(5000)).toBe('5秒')
    })

    it('应该格式化分钟', () => {
      expect(formatDuration(90000)).toBe('1分30秒')
    })

    it('应该格式化小时', () => {
      expect(formatDuration(3600000)).toBe('1小时0分')
    })

    it('应该格式化天', () => {
      expect(formatDuration(90000000)).toBe('1天1小时')
    })
  })

  describe('isToday', () => {
    it('应该返回true当是今天', () => {
      expect(isToday(new Date())).toBe(true)
    })

    it('应该返回false当不是今天', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      expect(isToday(yesterday)).toBe(false)
    })

    it('应该返回false当输入无效', () => {
      expect(isToday(null as any)).toBe(false)
      expect(isToday('')).toBe(false)
    })
  })

  describe('isYesterday', () => {
    it('应该返回true当是昨天', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      expect(isYesterday(yesterday)).toBe(true)
    })

    it('应该返回false当不是昨天', () => {
      expect(isYesterday(new Date())).toBe(false)
    })
  })

  describe('isTomorrow', () => {
    it('应该返回true当是明天', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      expect(isTomorrow(tomorrow)).toBe(true)
    })

    it('应该返回false当不是明天', () => {
      expect(isTomorrow(new Date())).toBe(false)
    })
  })

  describe('isThisWeek', () => {
    it('应该返回true当是本周', () => {
      expect(isThisWeek(new Date())).toBe(true)
    })

    it('应该返回false当不是本周', () => {
      const lastWeek = new Date()
      lastWeek.setDate(lastWeek.getDate() - 8)
      expect(isThisWeek(lastWeek)).toBe(false)
    })
  })

  describe('isThisMonth', () => {
    it('应该返回true当是本月', () => {
      expect(isThisMonth(new Date())).toBe(true)
    })

    it('应该返回false当不是本月', () => {
      const lastMonth = new Date()
      lastMonth.setMonth(lastMonth.getMonth() - 1)
      expect(isThisMonth(lastMonth)).toBe(false)
    })
  })

  describe('isThisYear', () => {
    it('应该返回true当是今年', () => {
      expect(isThisYear(new Date())).toBe(true)
    })

    it('应该返回false当不是今年', () => {
      const lastYear = new Date()
      lastYear.setFullYear(lastYear.getFullYear() - 1)
      expect(isThisYear(lastYear)).toBe(false)
    })
  })

  describe('addDays', () => {
    it('应该添加天数', () => {
      const date = new Date('2024-01-15')
      const result = addDays(date, 5)
      expect(result.getDate()).toBe(20)
    })

    it('应该减去天数', () => {
      const date = new Date('2024-01-15')
      const result = addDays(date, -5)
      expect(result.getDate()).toBe(10)
    })

    it('应该返回新日期当输入无效', () => {
      const result = addDays(null as any, 5)
      expect(result instanceof Date).toBe(true)
    })
  })

  describe('addMonths', () => {
    it('应该添加月份', () => {
      const date = new Date('2024-01-15')
      const result = addMonths(date, 2)
      expect(result.getMonth()).toBe(2)
    })

    it('应该返回新日期当输入无效', () => {
      const result = addMonths(null as any, 2)
      expect(result instanceof Date).toBe(true)
    })
  })

  describe('addYears', () => {
    it('应该添加年份', () => {
      const date = new Date('2024-01-15')
      const result = addYears(date, 1)
      expect(result.getFullYear()).toBe(2025)
    })

    it('应该返回新日期当输入无效', () => {
      const result = addYears(null as any, 1)
      expect(result instanceof Date).toBe(true)
    })
  })

  describe('startOfDay', () => {
    it('应该返回一天的开始时间', () => {
      const date = new Date('2024-01-15T10:30:00')
      const result = startOfDay(date)
      expect(result.getHours()).toBe(0)
      expect(result.getMinutes()).toBe(0)
      expect(result.getSeconds()).toBe(0)
    })

    it('应该返回新日期当输入无效', () => {
      const result = startOfDay(null as any)
      expect(result instanceof Date).toBe(true)
    })
  })

  describe('endOfDay', () => {
    it('应该返回一天的结束时间', () => {
      const date = new Date('2024-01-15T10:30:00')
      const result = endOfDay(date)
      expect(result.getHours()).toBe(23)
      expect(result.getMinutes()).toBe(59)
      expect(result.getSeconds()).toBe(59)
    })

    it('应该返回新日期当输入无效', () => {
      const result = endOfDay(null as any)
      expect(result instanceof Date).toBe(true)
    })
  })

  describe('startOfMonth', () => {
    it('应该返回月份的开始日期', () => {
      const date = new Date('2024-01-15')
      const result = startOfMonth(date)
      expect(result.getDate()).toBe(1)
    })

    it('应该返回新日期当输入无效', () => {
      const result = startOfMonth(null as any)
      expect(result instanceof Date).toBe(true)
    })
  })

  describe('endOfMonth', () => {
    it('应该返回月份的结束日期', () => {
      const date = new Date('2024-01-15')
      const result = endOfMonth(date)
      expect(result.getDate()).toBe(31)
    })

    it('应该返回新日期当输入无效', () => {
      const result = endOfMonth(null as any)
      expect(result instanceof Date).toBe(true)
    })
  })

  describe('diffInDays', () => {
    it('应该计算天数差', () => {
      const date1 = new Date('2024-01-20')
      const date2 = new Date('2024-01-15')
      expect(diffInDays(date1, date2)).toBe(5)
    })

    it('应该返回0当输入无效', () => {
      expect(diffInDays(null as any, new Date())).toBe(0)
      expect(diffInDays(new Date(), null as any)).toBe(0)
    })
  })

  describe('diffInHours', () => {
    it('应该计算小时差', () => {
      const date1 = new Date('2024-01-15T12:00:00')
      const date2 = new Date('2024-01-15T06:00:00')
      expect(diffInHours(date1, date2)).toBe(6)
    })

    it('应该返回0当输入无效', () => {
      expect(diffInHours(null as any, new Date())).toBe(0)
    })
  })

  describe('diffInMinutes', () => {
    it('应该计算分钟差', () => {
      const date1 = new Date('2024-01-15T10:30:00')
      const date2 = new Date('2024-01-15T10:00:00')
      expect(diffInMinutes(date1, date2)).toBe(30)
    })

    it('应该返回0当输入无效', () => {
      expect(diffInMinutes(null as any, new Date())).toBe(0)
    })
  })

  describe('isExpired', () => {
    it('应该返回true当已过期', () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60)
      expect(isExpired(pastDate)).toBe(true)
    })

    it('应该返回false当未过期', () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60)
      expect(isExpired(futureDate)).toBe(false)
    })

    it('应该返回true当输入无效', () => {
      expect(isExpired(null as any)).toBe(true)
    })
  })

  describe('isExpiringSoon', () => {
    it('应该返回true当即将过期', () => {
      const soonDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3)
      expect(isExpiringSoon(soonDate, 7)).toBe(true)
    })

    it('应该返回false当不会很快过期', () => {
      const farDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
      expect(isExpiringSoon(farDate, 7)).toBe(false)
    })

    it('应该返回false当输入无效', () => {
      expect(isExpiringSoon(null as any)).toBe(false)
    })
  })

  describe('useDateTime', () => {
    it('应该返回所有日期时间函数', () => {
      const utils = useDateTime()
      expect(typeof utils.formatDate).toBe('function')
      expect(typeof utils.toDate).toBe('function')
      expect(typeof utils.formatRelative).toBe('function')
      expect(typeof utils.formatDuration).toBe('function')
      expect(typeof utils.isToday).toBe('function')
      expect(typeof utils.isYesterday).toBe('function')
      expect(typeof utils.isTomorrow).toBe('function')
      expect(typeof utils.isThisWeek).toBe('function')
      expect(typeof utils.isThisMonth).toBe('function')
      expect(typeof utils.isThisYear).toBe('function')
      expect(typeof utils.addDays).toBe('function')
      expect(typeof utils.addMonths).toBe('function')
      expect(typeof utils.addYears).toBe('function')
      expect(typeof utils.startOfDay).toBe('function')
      expect(typeof utils.endOfDay).toBe('function')
      expect(typeof utils.startOfMonth).toBe('function')
      expect(typeof utils.endOfMonth).toBe('function')
      expect(typeof utils.diffInDays).toBe('function')
      expect(typeof utils.diffInHours).toBe('function')
      expect(typeof utils.diffInMinutes).toBe('function')
      expect(typeof utils.isExpired).toBe('function')
      expect(typeof utils.isExpiringSoon).toBe('function')
    })
  })
})
