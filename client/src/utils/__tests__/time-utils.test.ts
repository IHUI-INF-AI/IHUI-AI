import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  nowDate,
  happenTimeFun,
  formatFullTime,
  formatPrice,
  getYMD,
  formatRelativeTime,
  formatTimeDistance,
} from '../time-utils'

vi.mock('@/utils/i18n', () => ({
  t: vi.fn((key: string, params?: Record<string, number>) => {
    const translations: Record<string, string> = {
      'time.justNow': '刚刚',
      'time.minutesAgo': `${params?.minutes || 0}分钟前`,
      'time.hoursAgo': `${params?.hours || 0}小时前`,
      'time.daysAgo': `${params?.days || 0}天前`,
    }
    return translations[key] || key
  }),
}))

describe('time-utils', () => {
  describe('nowDate', () => {
    it('应该返回当前日期YYYY-MM-DD格式', () => {
      const result = nowDate()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('happenTimeFun', () => {
    it('应该将时间戳转换为日期', () => {
      const timestamp = 1609459200
      const result = happenTimeFun(timestamp)
      expect(result).toBe('2021-01-01')
    })

    it('应该处理0时间戳', () => {
      const result = happenTimeFun(0)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('formatFullTime', () => {
    it('应该将时间戳转换为完整时间', () => {
      const timestamp = 1609459200
      const result = formatFullTime(timestamp)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    })
  })

  describe('formatPrice', () => {
    it('应该将分转换为元', () => {
      expect(formatPrice(100)).toBe('1.00')
      expect(formatPrice(12345)).toBe('123.45')
    })

    it('应该处理字符串输入', () => {
      expect(formatPrice('100')).toBe('1.00')
    })

    it('应该处理null和undefined', () => {
      expect(formatPrice(null)).toBe('0.00')
      expect(formatPrice(undefined)).toBe('0.00')
    })

    it('应该处理NaN', () => {
      expect(formatPrice(NaN)).toBe('0.00')
    })

    it('应该处理0', () => {
      expect(formatPrice(0)).toBe('0.00')
    })

    it('应该处理小数', () => {
      expect(formatPrice(123.45)).toBe('1.23')
    })
  })

  describe('getYMD', () => {
    it('应该将Date对象转换为YYYY-MM-DD格式', () => {
      const date = new Date('2024-01-15')
      const result = getYMD(date)
      expect(result).toBe('2024-01-15')
    })

    it('应该正确处理月份', () => {
      const date = new Date('2024-12-01')
      const result = getYMD(date)
      expect(result).toBe('2024-12-01')
    })
  })

  describe('formatRelativeTime', () => {
    it('应该返回刚刚当小于60秒', () => {
      const now = Math.floor(Date.now() / 1000) - 30
      const result = formatRelativeTime(now)
      expect(result).toBe('刚刚')
    })

    it('应该返回分钟前当小于60分钟', () => {
      const now = Math.floor(Date.now() / 1000) - 120
      const result = formatRelativeTime(now)
      expect(result).toContain('分钟前')
    })

    it('应该返回小时前当小于24小时', () => {
      const now = Math.floor(Date.now() / 1000) - 7200
      const result = formatRelativeTime(now)
      expect(result).toContain('小时前')
    })

    it('应该返回天前当小于30天', () => {
      const now = Math.floor(Date.now() / 1000) - 86400 * 5
      const result = formatRelativeTime(now)
      expect(result).toContain('天前')
    })

    it('应该返回日期当大于30天', () => {
      const now = Math.floor(Date.now() / 1000) - 86400 * 35
      const result = formatRelativeTime(now)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('formatTimeDistance', () => {
    it('应该返回相对时间字符串', () => {
      const now = new Date()
      now.setMinutes(now.getMinutes() - 5)
      const result = formatTimeDistance(now)
      expect(typeof result).toBe('string')
    })

    it('应该处理字符串输入', () => {
      const result = formatTimeDistance('2024-01-01')
      expect(typeof result).toBe('string')
    })

    it('应该处理时间戳输入', () => {
      const result = formatTimeDistance(Date.now() - 60000)
      expect(typeof result).toBe('string')
    })

    it('应该处理无效输入', () => {
      const result = formatTimeDistance('invalid')
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })
})
