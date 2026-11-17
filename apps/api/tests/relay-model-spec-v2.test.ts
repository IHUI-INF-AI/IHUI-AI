// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 规格宣告 v2(2026-11-17):多档上下文 + 思考默认档 + 档位归一。
 *
 * 三件事都要守住同一条纪律:**无一手出处不写数字**。所以"多档"只在运营显式登记时出现,
 * 单档仍由 `context_window` 表达(`context_windows` 不重复宣告);"默认档"只在覆盖里
 * 声明且必须落在档位表内。归一则只做能明确判定的映射,判不了原样透传。
 */
import { describe, expect, it } from 'vitest'
import {
  deriveModelSpec,
  modelSpecToWire,
  normalizeReasoningEffort,
  parseModelSpecEnv,
} from '../src/services/relay-model-spec.js'

describe('多档上下文', () => {
  it('W1 族级单值 ⇒ 归一成一档,wire 不出 context_windows(不重复宣告)', () => {
    const spec = deriveModelSpec('deepseek-v4-pro')
    expect(spec.contextWindows).toEqual([96 * 1024])
    const wire = modelSpecToWire(spec)
    expect(wire['context_window']).toBe(96 * 1024)
    expect(wire).not.toHaveProperty('context_windows')
  })

  it('W2 覆盖声明多档 ⇒ 升序去重后随 wire 出场', () => {
    const parsed = parseModelSpecEnv(
      JSON.stringify([{ match: 'multi-ctx', contextWindows: [400000, 128000, 400000, -1] }]),
    )
    expect(parsed.rejected).toEqual([])
    const spec = deriveModelSpec('multi-ctx', parsed.overrides)
    expect(spec.contextWindows).toEqual([128000, 400000])
    const wire = modelSpecToWire(spec)
    expect(wire['context_windows']).toEqual([128000, 400000])
    // 单值字段取首档,保持旧客户端可用
    expect(wire['context_window']).toBe(128000)
  })

  it('W3 只有 contextWindows 而无 contextWindow 也算有效条目(不再整条被拒)', () => {
    const parsed = parseModelSpecEnv(JSON.stringify([{ match: 'only-list', contextWindows: [1] }]))
    expect(parsed.overrides).toHaveLength(1)
  })
})

describe('思考默认档', () => {
  it('W4 覆盖声明 thinkingDefault ⇒ wire 出 default_level', () => {
    const parsed = parseModelSpecEnv(
      JSON.stringify([{ match: 'dflt', thinkingLevels: ['low', 'high'], thinkingDefault: 'low' }]),
    )
    const spec = deriveModelSpec('dflt', parsed.overrides)
    expect(spec.thinking.defaultLevel).toBe('low')
    const wire = modelSpecToWire(spec) as { thinking: Record<string, unknown> }
    expect(wire.thinking['default_level']).toBe('low')
  })

  it('W5 thinkingDefault 不在档位表 ⇒ 整条拒收(不宣告不存在的档)', () => {
    const parsed = parseModelSpecEnv(
      JSON.stringify([{ match: 'bad', thinkingLevels: ['low'], thinkingDefault: 'ultra' }]),
    )
    expect(parsed.overrides).toEqual([])
    expect(parsed.rejected[0]?.reason).toContain('不在 thinkingLevels')
  })

  it('W6 未声明默认档 ⇒ 不写 default_level(不猜)', () => {
    const spec = deriveModelSpec('kimi-k2-thinking')
    expect(spec.thinking.defaultLevel).toBeNull()
    const wire = modelSpecToWire(spec) as { thinking: Record<string, unknown> }
    expect(wire.thinking).not.toHaveProperty('default_level')
  })
})

describe('思考档位归一', () => {
  it('W7 大小写/空白差异 ⇒ 换成上游原始拼写', () => {
    expect(normalizeReasoningEffort(' HIGH ', ['low', 'medium', 'High'])).toBe('High')
  })

  it('W8 数字档 ⇒ 取数值最近的一档(等距取档位表里靠前的那档)', () => {
    // 4 与 3、5 等距 ⇒ 取先出现的 3(更省,且结果稳定不随表序抖动)
    expect(normalizeReasoningEffort(4, ['1', '3', '5'])).toBe('3')
    expect(normalizeReasoningEffort(2, ['1', '3', '5'])).toBe('1')
  })

  it('W9 语义跨体系(high 对数字档)⇒ 原样透传,不静默改写', () => {
    expect(normalizeReasoningEffort('high', ['1', '3'])).toBe('high')
  })

  it('W10 无档位表 / 未传 ⇒ 保持原值', () => {
    expect(normalizeReasoningEffort('high', [])).toBe('high')
    expect(normalizeReasoningEffort(undefined, ['low'])).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
