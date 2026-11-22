// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /v1/models 峰谷价宣告 —— 判据测试(2026-11-17)。
 *
 * P1 专属规则优先于通用规则,且最多 5 条。
 * P2 无命中 ⇒ null(整键省略),不是空数组。
 * P3 模型名大小写/写法差异按 normalizeModelId 归一(与全仓同一把尺)。
 * P4 同一条规则不重复出现(专属+通用双声明只出一次)。
 */
import { describe, it, expect } from 'vitest'
import {
  pickPeakWindowsForModel,
  PEAK_WINDOWS_LIMIT,
  type PeakWindowSource,
} from '../src/services/relay-model-peak-declaration.js'

const win = (over: Partial<PeakWindowSource>): PeakWindowSource => ({
  ruleName: 'rule',
  modelId: null,
  daysOfWeek: [],
  startMinute: 0,
  endMinute: 1440,
  multiplier: 1.2,
  ...over,
})

describe('pickPeakWindowsForModel', () => {
  it('P1 专属规则排在通用规则前面', () => {
    const windows = [
      win({
        ruleName: '通用高峰',
        modelId: null,
        startMinute: 540,
        endMinute: 1140,
        multiplier: 1.5,
      }),
      win({
        ruleName: '专属高峰',
        modelId: 'GPT-5.1',
        startMinute: 540,
        endMinute: 1140,
        multiplier: 2,
      }),
    ]
    const picked = pickPeakWindowsForModel(windows, 'gpt-5.1')
    expect(picked?.map((w) => w.rule_name)).toEqual(['专属高峰', '通用高峰'])
  })

  it('P1b 最多 5 条', () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      win({
        ruleName: `r${i}`,
        startMinute: i * 60,
        endMinute: (i + 1) * 60,
        multiplier: 1 + i / 10,
      }),
    )
    const picked = pickPeakWindowsForModel(many, 'gpt-5')
    expect(picked).toHaveLength(PEAK_WINDOWS_LIMIT)
  })

  it('P2 无命中 ⇒ null(整键省略,不是空数组)', () => {
    const windows = [win({ ruleName: '别家专属', modelId: 'claude-opus-4.1' })]
    expect(pickPeakWindowsForModel(windows, 'gpt-5.1')).toBeNull()
    expect(pickPeakWindowsForModel([], 'gpt-5.1')).toBeNull()
  })

  it('P3 模型名按 normalizeModelId 归一(大小写/空白差异仍命中)', () => {
    const windows = [win({ ruleName: '专属', modelId: '  GPT-5.1  ' })]
    const picked = pickPeakWindowsForModel(windows, 'gpt-5.1')
    expect(picked).toHaveLength(1)
    expect(picked?.[0]?.timezone).toBe('UTC+8')
  })

  it('P4 同一条规则(专属+通用)只出现一次', () => {
    const same = { ruleName: '同一条', startMinute: 540, endMinute: 1140, multiplier: 1.5 }
    const windows = [win({ ...same, modelId: 'gpt-5.1' }), win({ ...same, modelId: null })]
    const picked = pickPeakWindowsForModel(windows, 'gpt-5.1')
    expect(picked).toHaveLength(1)
  })

  it('P5 只宣告乘子与时段,不带绝对价格字段', () => {
    const picked = pickPeakWindowsForModel([win({})], 'gpt-5')
    expect(Object.keys(picked?.[0] ?? {}).sort()).toEqual([
      'active_now',
      'days_of_week',
      'end_minute',
      'multiplier',
      'rule_name',
      'start_minute',
      'timezone',
    ])
  })

  it('P6 active_now 按 UTC+8 现读时刻判定(窗口内 true / 窗口外 false)', () => {
    const officeHour = win({ ruleName: '白天峰', startMinute: 540, endMinute: 660 })
    const inWindow = pickPeakWindowsForModel(
      [officeHour],
      'gpt-5',
      PEAK_WINDOWS_LIMIT,
      new Date('2026-11-18T10:00:00+08:00'),
    )
    expect(inWindow?.[0]?.active_now).toBe(true)
    const outWindow = pickPeakWindowsForModel(
      [officeHour],
      'gpt-5',
      PEAK_WINDOWS_LIMIT,
      new Date('2026-11-18T20:00:00+08:00'),
    )
    expect(outWindow?.[0]?.active_now).toBe(false)
  })

  it('P7 跨天窗口(23:00-07:00)与计费侧同语义:凌晨 true、中午 false', () => {
    const overnight = win({
      ruleName: '夜间谷',
      startMinute: 1380,
      endMinute: 420,
      multiplier: 0.5,
    })
    const earlyMorning = pickPeakWindowsForModel(
      [overnight],
      'gpt-5',
      PEAK_WINDOWS_LIMIT,
      new Date('2026-11-18T01:00:00+08:00'),
    )
    expect(earlyMorning?.[0]?.active_now).toBe(true)
    const noon = pickPeakWindowsForModel(
      [overnight],
      'gpt-5',
      PEAK_WINDOWS_LIMIT,
      new Date('2026-11-18T12:00:00+08:00'),
    )
    expect(noon?.[0]?.active_now).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
