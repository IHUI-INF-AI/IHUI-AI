// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * peak-pricing-service 单测(2026-09-16 立,分时高峰/低谷倍率)。
 *
 * 覆盖点(全部为纯函数,无需连库):
 * - getUtc8WeekdayAndMinute:UTC+8 星期与当日分钟换算
 * - matchPeakRule:同日区间(左闭右开)/ 跨天区间 / 全天 / 星期过滤 / 模型过滤 / enabled
 * - validatePeakRuleInput:各字段边界校验
 *
 * Mock 策略:db 与 @ihui/database 均为表定义,纯函数用不到,直接 mock 掉避免连库。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {} }))
vi.mock('@ihui/database', () => ({ relayPeakPricingRules: {} }))

import {
  getUtc8WeekdayAndMinute,
  matchPeakRule,
  validatePeakRuleInput,
  type PeakPricingRuleInput,
} from '../src/services/peak-pricing-service.js'

/** 构造规则(只填 matchPeakRule 关心的字段) */
function rule(over: Partial<Parameters<typeof matchPeakRule>[0]> = {}) {
  return {
    enabled: true,
    modelId: null,
    daysOfWeek: [] as number[],
    startMinute: 540,
    endMinute: 1080,
    ...over,
  }
}

describe('getUtc8WeekdayAndMinute', () => {
  it('把 UTC 时刻换算为 UTC+8 的星期与当日分钟', () => {
    // 2026-09-16T01:30Z → UTC+8 为 2026-09-16 09:30(周三)
    const { weekday, minute } = getUtc8WeekdayAndMinute(new Date('2026-09-16T01:30:00.000Z'))
    expect(weekday).toBe(3)
    expect(minute).toBe(9 * 60 + 30)
  })

  it('跨 UTC 日界时星期随之进位', () => {
    // 2026-09-15T20:00Z → UTC+8 为 2026-09-16 04:00(周三)
    const { weekday, minute } = getUtc8WeekdayAndMinute(new Date('2026-09-15T20:00:00.000Z'))
    expect(weekday).toBe(3)
    expect(minute).toBe(4 * 60)
  })
})

describe('matchPeakRule', () => {
  it('同日区间按左闭右开命中', () => {
    expect(matchPeakRule(rule(), 'gpt-4o', 3, 540)).toBe(true)
    expect(matchPeakRule(rule(), 'gpt-4o', 3, 570)).toBe(true)
    expect(matchPeakRule(rule(), 'gpt-4o', 3, 1079)).toBe(true)
    expect(matchPeakRule(rule(), 'gpt-4o', 3, 1080)).toBe(false)
    expect(matchPeakRule(rule(), 'gpt-4o', 3, 539)).toBe(false)
  })

  it('startMinute === endMinute 视为全天', () => {
    const allDay = rule({ startMinute: 0, endMinute: 0 })
    expect(matchPeakRule(allDay, 'gpt-4o', 3, 0)).toBe(true)
    expect(matchPeakRule(allDay, 'gpt-4o', 3, 1439)).toBe(true)
  })

  it('startMinute > endMinute 视为跨天区间(如 23:00-07:00)', () => {
    const overnight = rule({ startMinute: 1380, endMinute: 420 })
    expect(matchPeakRule(overnight, 'gpt-4o', 3, 1380)).toBe(true)
    expect(matchPeakRule(overnight, 'gpt-4o', 3, 1439)).toBe(true)
    expect(matchPeakRule(overnight, 'gpt-4o', 3, 0)).toBe(true)
    expect(matchPeakRule(overnight, 'gpt-4o', 3, 419)).toBe(true)
    expect(matchPeakRule(overnight, 'gpt-4o', 3, 420)).toBe(false)
    expect(matchPeakRule(overnight, 'gpt-4o', 3, 600)).toBe(false)
  })

  it('daysOfWeek 为空 = 每天;非空则按星期过滤', () => {
    const weekdays = rule({ daysOfWeek: [1, 2, 3, 4, 5] })
    expect(matchPeakRule(weekdays, 'gpt-4o', 3, 570)).toBe(true)
    expect(matchPeakRule(weekdays, 'gpt-4o', 6, 570)).toBe(false)
    expect(matchPeakRule(weekdays, 'gpt-4o', 0, 570)).toBe(false)
  })

  it('modelId 为空 = 全模型;非空则需归一化后精确相等', () => {
    const scoped = rule({ modelId: 'GPT-4o' })
    expect(matchPeakRule(scoped, 'gpt-4o', 3, 570)).toBe(true)
    expect(matchPeakRule(scoped, 'claude-3', 3, 570)).toBe(false)
    expect(matchPeakRule(rule(), 'any-model', 3, 570)).toBe(true)
  })

  it('未启用的规则永不命中', () => {
    expect(matchPeakRule(rule({ enabled: false }), 'gpt-4o', 3, 570)).toBe(false)
  })
})

describe('validatePeakRuleInput', () => {
  const base: PeakPricingRuleInput = {
    name: '工作日高峰',
    daysOfWeek: [1, 2, 3, 4, 5],
    startMinute: 540,
    endMinute: 1080,
    multiplier: 1.5,
  }

  it('合法入参通过', () => {
    expect(validatePeakRuleInput(base)).toBeUndefined()
  })

  it('名称必填且不超长', () => {
    expect(validatePeakRuleInput({ ...base, name: '' })).toBe('name_required')
    expect(validatePeakRuleInput({ ...base, name: 'x'.repeat(65) })).toBe('name_too_long')
  })

  it('星期取值必须在 0-6', () => {
    expect(validatePeakRuleInput({ ...base, daysOfWeek: [0, 6] })).toBeUndefined()
    expect(validatePeakRuleInput({ ...base, daysOfWeek: [7] })).toBe('days_of_week_invalid')
    expect(validatePeakRuleInput({ ...base, daysOfWeek: [-1] })).toBe('days_of_week_invalid')
  })

  it('分钟边界:start 0-1439,end 0-1440', () => {
    expect(validatePeakRuleInput({ ...base, startMinute: 1439 })).toBeUndefined()
    expect(validatePeakRuleInput({ ...base, startMinute: 1440 })).toBe('start_minute_invalid')
    expect(validatePeakRuleInput({ ...base, endMinute: 1440 })).toBeUndefined()
    expect(validatePeakRuleInput({ ...base, endMinute: 1441 })).toBe('end_minute_invalid')
  })

  it('倍率必须为非负且不超过 100', () => {
    expect(validatePeakRuleInput({ ...base, multiplier: 0 })).toBeUndefined()
    expect(validatePeakRuleInput({ ...base, multiplier: -0.1 })).toBe('multiplier_invalid')
    expect(validatePeakRuleInput({ ...base, multiplier: 101 })).toBe('multiplier_too_large')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
