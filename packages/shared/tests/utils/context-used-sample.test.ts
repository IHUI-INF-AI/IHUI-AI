// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-404:瞬时 0 投影判据(纯函数)的成对测试。
// 直接 import 生产模块(§22c:测试内不得复制实现/重写判据)。

import { describe, expect, it } from 'vitest'

import {
  CONTEXT_TRUSTED_ZERO_PHASES,
  isContextTrustedZeroPhase,
  resolveContextUsedSample,
  type ContextSamplePhase,
} from '../../src/utils/context-used-sample'

describe('CONTEXT_TRUSTED_ZERO_PHASES(封闭例外表)', () => {
  it('表非空 —— 空扫不得被读成"全部已判"(空表会让消费端对账测试恒真通过)', () => {
    expect(CONTEXT_TRUSTED_ZERO_PHASES.length).toBeGreaterThan(0)
  })

  it('表员均为非空、互异的字符串(登记表自洽)', () => {
    const members: readonly string[] = CONTEXT_TRUSTED_ZERO_PHASES
    for (const m of members) expect(m.length).toBeGreaterThan(0)
    expect(new Set(members).size).toBe(members.length)
  })

  it('isContextTrustedZeroPhase 与表同源:表内真、表外假(判据不另写名单)', () => {
    for (const m of CONTEXT_TRUSTED_ZERO_PHASES) {
      expect(isContextTrustedZeroPhase(m)).toBe(true)
    }
    expect(isContextTrustedZeroPhase('streaming')).toBe(false)
    expect(isContextTrustedZeroPhase('unknown')).toBe(false)
  })
})

describe('resolveContextUsedSample(唯一投影出口)', () => {
  it('规则①:非例外阶段收到 0 且有可信 prev ⇒ 保留 prev 并标 held(阳性)', () => {
    for (const phase of ['streaming', 'unknown'] satisfies readonly ContextSamplePhase[]) {
      const r = resolveContextUsedSample({ used: 60000 }, { used: 0 }, phase)
      expect(r).toEqual({ used: 60000, held: true })
    }
  })

  it('规则②:例外阶段收到 0 ⇒ 接受为真 0,不得被规则①吞掉(例外成对对照)', () => {
    for (const phase of CONTEXT_TRUSTED_ZERO_PHASES) {
      const r = resolveContextUsedSample({ used: 60000 }, { used: 0 }, phase)
      expect(r).toEqual({ used: 0, held: false })
    }
  })

  it('规则③:next.used === undefined ⇒ "未收到"语义逐字不变(held false,used undefined)', () => {
    // 有 prev、无 prev、例外阶段、非例外阶段四个方向都必须维持同一结果 ——
    // 例外表不得反过来把 undefined 洗成 0,非例外也不得因 undefined 触发 held。
    expect(resolveContextUsedSample({ used: 60000 }, { used: undefined }, 'streaming')).toEqual({
      used: undefined,
      held: false,
    })
    expect(resolveContextUsedSample(null, { used: undefined }, 'streaming')).toEqual({
      used: undefined,
      held: false,
    })
    for (const phase of CONTEXT_TRUSTED_ZERO_PHASES) {
      expect(resolveContextUsedSample({ used: 60000 }, { used: undefined }, phase).used).toBeUndefined()
    }
  })

  it('非例外阶段收到 0 但 prev 无可信数值(null/prev.used undefined)⇒ 如实接受 0,不造别的数', () => {
    expect(resolveContextUsedSample(null, { used: 0 }, 'streaming')).toEqual({
      used: 0,
      held: false,
    })
    expect(resolveContextUsedSample({ used: undefined }, { used: 0 }, 'streaming')).toEqual({
      used: 0,
      held: false,
    })
  })

  it('非 0 采样一律原样接受(held 只在恰 0 时发生,判值用 === 0 不用 falsy)', () => {
    expect(resolveContextUsedSample({ used: 60000 }, { used: 72000 }, 'streaming')).toEqual({
      used: 72000,
      held: false,
    })
    expect(resolveContextUsedSample({ used: 60000 }, { used: 1 }, 'streaming')).toEqual({
      used: 1,
      held: false,
    })
  })

  it('options.exceptions 是测试构造口:换表即换结论(证明例外判值确实来自表,不是硬编码 if)', () => {
    // 表内阶段在自定义空表下不再被信 ⇒ held 兜底(反证例外通道有牙)
    expect(
      resolveContextUsedSample({ used: 60000 }, { used: 0 }, 'compact', { exceptions: [] }),
    ).toEqual({ used: 60000, held: true })
    // 自定义含 'auto-compaction' 的表 ⇒ 接受(正证走的就是传入表)
    expect(
      resolveContextUsedSample(
        { used: 60000 },
        { used: 0 },
        'auto-compaction',
        { exceptions: ['auto-compaction'] },
      ),
    ).toEqual({ used: 0, held: false })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
