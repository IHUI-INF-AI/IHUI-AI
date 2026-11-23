// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 倍率覆盖面的纯判据测试(2026-11-23 立)。
 *
 * 钉住四件事:
 *   ① 显式 0 必须保留(不能把"免费"当成"没配"回落成 1);
 *   ② 有 DB 值就覆盖关键词推断;
 *   ③ 裸模型名 / provider 前缀 / 号池 `[provider]` 后缀都能命中同一份覆盖;
 *   ④ 空值/坏值回落推断,不改现价。
 */
import { describe, expect, it } from 'vitest'
import {
  buildPointsMultiplierOverrideMap,
  inferPointsMultiplier,
  lookupPointsMultiplierOverride,
  normalizePointsModelId,
  parsePointsMultiplierOverride,
  resolvePointsMultiplierWithOverride,
} from '../src/services/points-multiplier.js'

describe('points multiplier override', () => {
  it('显式 0 是合法覆盖,不得回落成推断值', () => {
    expect(parsePointsMultiplierOverride('0.00')).toBe(0)
    expect(resolvePointsMultiplierWithOverride('claude-opus-5-5', 0)).toBe(0)
  })

  it('非空 DB 值覆盖关键词推断;空值/坏值回落推断', () => {
    expect(resolvePointsMultiplierWithOverride('claude-opus-5-5', 10)).toBe(10)
    expect(resolvePointsMultiplierWithOverride('claude-opus-5-5', null)).toBe(30)
    expect(resolvePointsMultiplierWithOverride('claude-opus-5-5', undefined)).toBe(30)
    expect(resolvePointsMultiplierWithOverride('claude-opus-5-5', Number.NaN)).toBe(30)
    expect(resolvePointsMultiplierWithOverride('claude-opus-5-5', -1)).toBe(30)
  })

  it('裸名、provider 前缀、号池后缀三种写法命中同一覆盖', () => {
    const map = buildPointsMultiplierOverrideMap([
      {
        modelId: 'claude-opus-5-5',
        providerCode: 'opencode',
        pointsMultiplier: '10.00',
      },
    ])
    expect(lookupPointsMultiplierOverride(map, 'claude-opus-5-5')).toBe(10)
    expect(lookupPointsMultiplierOverride(map, 'opencode/claude-opus-5-5')).toBe(10)
    expect(lookupPointsMultiplierOverride(map, 'claude-opus-5-5 [opencode]')).toBe(10)
  })

  it('同模型多行先到先得,空值行不参与覆盖', () => {
    const map = buildPointsMultiplierOverrideMap([
      { modelId: 'gpt-5.6', providerCode: 'ihui', pointsMultiplier: '10.00' },
      { modelId: 'gpt-5.6', providerCode: 'openrouter', pointsMultiplier: '30.00' },
      { modelId: 'free-model', providerCode: 'x', pointsMultiplier: '' },
    ])
    expect(lookupPointsMultiplierOverride(map, 'gpt-5.6')).toBe(10)
    expect(lookupPointsMultiplierOverride(map, 'free-model')).toBeUndefined()
  })

  it('模型名归一:大小写/空白/号池后缀', () => {
    expect(normalizePointsModelId('  OpenCode/Claude-Opus-5-5 [opencode] ')).toBe(
      'opencode/claude-opus-5-5',
    )
  })
})

describe('points multiplier keyword inference (2026-11-23 cost anomalies)', () => {
  it('轻量后缀优先于父型号,不再把 cheap flash/ocr 抬到 3x/30x', () => {
    expect(inferPointsMultiplier('deepseek-v4.1-flash')).toBe(1)
    expect(inferPointsMultiplier('deepseek-ocr')).toBe(1)
    expect(inferPointsMultiplier('gpt-5-image-mini')).toBe(1)
    expect(inferPointsMultiplier('gpt-5.6-luna')).toBe(1)
  })

  it('thinking 不再等于旗舰;低成本 thinking 模型按标准档兜底', () => {
    expect(inferPointsMultiplier('thinkingmachines/inkling')).toBe(3)
    expect(inferPointsMultiplier('thinkingmachines/inkling-small')).toBe(1)
    expect(inferPointsMultiplier('qwen3-235b-a22b-thinking-2507')).toBe(3)
  })

  it('sao10k 8B 这类名字不再误判旗舰', () => {
    expect(inferPointsMultiplier('sao10k/l3-8b-lunaris-v1')).toBe(1)
    expect(inferPointsMultiplier('sao10k/l3.1-euryale-70b')).toBe(1)
  })

  it('真实旗舰与高级家族保持原档位', () => {
    expect(inferPointsMultiplier('claude-opus-5-5')).toBe(30)
    expect(inferPointsMultiplier('gpt-5.5')).toBe(30)
    expect(inferPointsMultiplier('gpt-5.6-terra-pro')).toBe(30)
    expect(inferPointsMultiplier('gpt-5.4')).toBe(10)
    expect(inferPointsMultiplier('gpt-5-image')).toBe(10)
    expect(inferPointsMultiplier('gemini-2.5-pro')).toBe(10)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
