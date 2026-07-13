import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
    REDIS_URL: 'redis://localhost:6379/0',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
  },
}))

import {
  calculateMonthBoundaries,
  calculateMonthlyPeriods,
  calculateMonthlyPeriodsForMonth,
} from '../src/services/settlement-service.js'

describe('settlement-service — 结算周期纯函数', () => {
  describe('calculateMonthBoundaries', () => {
    it('返回月份第一天 00:00:00 到下月第一天 00:00:00', () => {
      const { start, end } = calculateMonthBoundaries(2025, 6)
      expect(start).toEqual(new Date(2025, 5, 1, 0, 0, 0, 0))
      expect(end).toEqual(new Date(2025, 6, 1, 0, 0, 0, 0))
    })

    it('1 月边界跨年', () => {
      const { start, end } = calculateMonthBoundaries(2025, 1)
      expect(start).toEqual(new Date(2025, 0, 1))
      expect(end).toEqual(new Date(2025, 1, 1))
    })

    it('12 月边界跨年', () => {
      const { start, end } = calculateMonthBoundaries(2025, 12)
      expect(start).toEqual(new Date(2025, 11, 1))
      expect(end).toEqual(new Date(2026, 0, 1))
    })

    it('end - start 为该月天数 × 86400000', () => {
      const { start, end } = calculateMonthBoundaries(2025, 2)
      const days = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
      expect(days).toBe(28)
    })

    it('闰年 2 月 29 天', () => {
      const { start, end } = calculateMonthBoundaries(2024, 2)
      const days = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
      expect(days).toBe(29)
    })
  })

  describe('calculateMonthlyPeriods', () => {
    it('单月内返回 1 个周期', () => {
      const from = new Date(2025, 5, 15, 10, 0, 0)
      const to = new Date(2025, 5, 20, 10, 0, 0)
      const result = calculateMonthlyPeriods(from, to)
      expect(result.periods).toHaveLength(1)
      expect(result.periods[0]!.issueNo).toBe(1)
      expect(result.periods[0]!.start).toEqual(from)
      expect(result.periods[0]!.end).toEqual(to)
    })

    it('跨 2 个月返回 2 个周期', () => {
      const from = new Date(2025, 5, 15)
      const to = new Date(2025, 6, 15)
      const result = calculateMonthlyPeriods(from, to)
      expect(result.periods).toHaveLength(2)
      expect(result.periods[0]!.issueNo).toBe(1)
      expect(result.periods[0]!.start).toEqual(from)
      expect(result.periods[0]!.end).toEqual(new Date(2025, 6, 1))
      expect(result.periods[1]!.issueNo).toBe(2)
      expect(result.periods[1]!.start).toEqual(new Date(2025, 6, 1))
      expect(result.periods[1]!.end).toEqual(to)
    })

    it('跨 3 个月返回 3 个周期', () => {
      const from = new Date(2025, 0, 15)
      const to = new Date(2025, 2, 15)
      const result = calculateMonthlyPeriods(from, to)
      expect(result.periods).toHaveLength(3)
      expect(result.periods.map((p) => p.issueNo)).toEqual([1, 2, 3])
    })

    it('from >= to 返回空周期', () => {
      const from = new Date(2025, 5, 20)
      const to = new Date(2025, 5, 15)
      const result = calculateMonthlyPeriods(from, to)
      expect(result.periods).toHaveLength(0)
    })

    it('from === to 返回空周期', () => {
      const d = new Date(2025, 5, 15)
      const result = calculateMonthlyPeriods(d, d)
      expect(result.periods).toHaveLength(0)
    })

    it('跨年返回多周期', () => {
      const from = new Date(2025, 11, 15)
      const to = new Date(2026, 1, 15)
      const result = calculateMonthlyPeriods(from, to)
      expect(result.periods).toHaveLength(3)
    })

    it('保留 from/to 原始值', () => {
      const from = new Date(2025, 5, 15)
      const to = new Date(2025, 6, 15)
      const result = calculateMonthlyPeriods(from, to)
      expect(result.from).toEqual(from)
      expect(result.to).toEqual(to)
    })

    it('正好在月初开始', () => {
      const from = new Date(2025, 5, 1, 0, 0, 0)
      const to = new Date(2025, 6, 1, 0, 0, 0)
      const result = calculateMonthlyPeriods(from, to)
      expect(result.periods).toHaveLength(1)
      expect(result.periods[0]!.start).toEqual(from)
      expect(result.periods[0]!.end).toEqual(to)
    })
  })

  describe('calculateMonthlyPeriodsForMonth', () => {
    it('返回单月一个完整周期', () => {
      const result = calculateMonthlyPeriodsForMonth(2025, 6)
      expect(result.periods).toHaveLength(1)
      expect(result.periods[0]!.issueNo).toBe(1)
      expect(result.periods[0]!.start).toEqual(new Date(2025, 5, 1))
      expect(result.periods[0]!.end).toEqual(new Date(2025, 6, 1))
    })

    it('from/to 等于月边界', () => {
      const result = calculateMonthlyPeriodsForMonth(2025, 1)
      expect(result.from).toEqual(new Date(2025, 0, 1))
      expect(result.to).toEqual(new Date(2025, 1, 1))
    })

    it('12 月跨年', () => {
      const result = calculateMonthlyPeriodsForMonth(2025, 12)
      expect(result.to).toEqual(new Date(2026, 0, 1))
    })
  })
})
