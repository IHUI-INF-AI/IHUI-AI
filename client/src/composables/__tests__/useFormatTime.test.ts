import { describe, it, expect, vi } from 'vitest'
import { useFormatTime, formatTime, formatRelative } from '../useFormatTime'

describe('useFormatTime composable', () => {
  describe('formatTime', () => {
    it('返回统一 composable API 包含三个函数', () => {
      const api = useFormatTime()
      expect(typeof api.formatTime).toBe('function')
      expect(typeof api.formatDateTime).toBe('function')
      expect(typeof api.formatRelative).toBe('function')
    })

    it('具名导出与 composable 返回的是同一函数', () => {
      const api = useFormatTime()
      expect(api.formatTime).toBe(formatTime)
      expect(api.formatRelative).toBe(formatRelative)
    })

    it('时间戳格式化为 YYYY-MM-DD HH:mm:ss（默认格式）', () => {
      // 2026-06-30 17:00:00 UTC+8 → 时间戳
      const ts = new Date('2026-06-30T17:00:00+08:00').getTime()
      const result = formatTime(ts)
      expect(result).toBe('2026-06-30 17:00:00')
    })

    it('自定义格式 YYYY/MM/DD 生效', () => {
      const ts = new Date('2026-06-30T17:00:00+08:00').getTime()
      const result = formatTime(ts, 'YYYY/MM/DD')
      expect(result).toBe('2026/06/30')
    })

    it('空输入返回空字符串', () => {
      expect(formatTime(undefined)).toBe('')
      expect(formatTime(null as unknown as undefined)).toBe('')
      expect(formatTime('')).toBe('')
    })

    it('无效时间返回空字符串', () => {
      expect(formatTime('not-a-date')).toBe('')
      expect(formatTime('abcd1234')).toBe('')
    })

    it('Date 对象作为输入正常工作', () => {
      const d = new Date('2026-01-15T08:30:00+08:00')
      const result = formatTime(d)
      expect(result).toBe('2026-01-15 08:30:00')
    })
  })

  describe('formatRelative', () => {
    it('刚刚（1 秒内）', () => {
      const now = Date.now()
      expect(formatRelative(now)).toBe('刚刚')
    })

    it('x 分钟前', () => {
      const now = Date.now()
      const fiveMinAgo = now - 5 * 60 * 1000
      expect(formatRelative(fiveMinAgo)).toBe('5 分钟前')
    })

    it('x 小时前', () => {
      const now = Date.now()
      const threeHourAgo = now - 3 * 60 * 60 * 1000
      expect(formatRelative(threeHourAgo)).toBe('3 小时前')
    })

    it('超过 1 天回退到日期格式 YYYY-MM-DD', () => {
      const now = Date.now()
      const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000
      const result = formatRelative(twoDaysAgo)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('空输入返回空字符串', () => {
      expect(formatRelative(undefined)).toBe('')
      expect(formatRelative(null)).toBe('')
    })

    it('无效时间返回空字符串', () => {
      expect(formatRelative('invalid-date')).toBe('')
    })
  })
})
