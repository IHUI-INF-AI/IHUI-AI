// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { coerceKnownOr, narrowKnown } from '../src/enum-coerce.js'

/**
 * G-815963(2026-10-01):未知枚举兜底的唯一出口 —— 正反成对。
 * 纪律核心:安全档必须是"不再产生副作用"的那一档(终态/只读/禁用),
 * 禁止兜到初始态把已终态的账放回可写集合。
 */

/** 示例登记域:终态档是 cancelled(幂等、无副作用);running 是初始态,禁止当兜底档 */
const DEMO_STATUSES = ['running', 'completed', 'cancelled', 'failed'] as const
type DemoStatus = (typeof DEMO_STATUSES)[number]

describe('coerceKnownOr(G-815963 未知枚举兜底唯一出口)', () => {
  it('已知值原样返回并收窄为字面量联合', () => {
    const v: DemoStatus = coerceKnownOr('completed', DEMO_STATUSES, 'cancelled')
    expect(v).toBe('completed')
  })

  it('未知值(未来档)⇒ 兜到显式声明的终态/无副作用档,不是初始态', () => {
    // 未来版本写入的新档,旧二进制读到时不得被猜成 running(可写集合)
    const v: DemoStatus = coerceKnownOr('aborted', DEMO_STATUSES, 'cancelled')
    expect(v).toBe('cancelled')
    expect(DEMO_STATUSES.includes(v as never)).toBe(true)
  })

  it('非字符串类型(undefined/null/数字/对象)同样兜到安全档', () => {
    expect(coerceKnownOr(undefined, DEMO_STATUSES, 'cancelled')).toBe('cancelled')
    expect(coerceKnownOr(null, DEMO_STATUSES, 'cancelled')).toBe('cancelled')
    expect(coerceKnownOr(3, DEMO_STATUSES, 'cancelled')).toBe('cancelled')
    expect(coerceKnownOr({}, DEMO_STATUSES, 'cancelled')).toBe('cancelled')
  })

  it('同形反例(钉纪律):把初始态当 safe 传会在编译层可选,但机制上不做任何隐式纠正 —— 出口只收窄,不替人选档', () => {
    // 该用例钉住"出口不做隐式档位纠正"这一语义:传什么 safe 就兜什么,
    // 档位选择的纪律由调用点评审把守(正反两侧都写出来,防有人给出口加"聪明"兜底)。
    const v: DemoStatus = coerceKnownOr('who-knows', DEMO_STATUSES, 'running')
    expect(v).toBe('running')
  })

  it('全集值域闭合:known 里没有的档不可能被返回(结构保证)', () => {
    for (const probe of ['x', 'RUNNING', 'completed ', '']) {
      const v = coerceKnownOr(probe, DEMO_STATUSES, 'failed')
      expect(DEMO_STATUSES).toContain(v)
    }
  })
})

/**
 * narrowKnown 与 coerceKnownOr 共用同一把值域尺子,但未知值的落点不同:
 * 纯呈现域(涉及资金/身份的徽章文案)把未知猜成任何一个已知档都是谎报,所以返回 null。
 */
describe('narrowKnown(G-815963 纯呈现域的同一把尺子)', () => {
  it('合法值逐字不变(出口不得改写已合法的值)', () => {
    for (const s of DEMO_STATUSES) {
      expect(narrowKnown(s, DEMO_STATUSES)).toBe(s)
    }
  })

  it('未知值 ⇒ null,不得被猜成任何已知档', () => {
    expect(narrowKnown('aborted', DEMO_STATUSES)).toBeNull()
    expect(narrowKnown('completed ', DEMO_STATUSES)).toBeNull()
    expect(narrowKnown(undefined, DEMO_STATUSES)).toBeNull()
    expect(narrowKnown(null, DEMO_STATUSES)).toBeNull()
    expect(narrowKnown(2, DEMO_STATUSES)).toBeNull()
  })

  it('两条出口对"什么算已知"必须同判(共用一把尺子,不得两处各写一遍 includes)', () => {
    const probes = ['completed', 'aborted', 'RUNNING', '', undefined, 7]
    for (const p of probes) {
      // coerceKnownOr 在已知时原样返回、未知时兜 safe;narrowKnown 在已知时原样返回、未知时 null
      // ⇒ "已知"这个判定对两者必须一致,否则呈现与决策会对同一行给出相反结论
      const coerced = coerceKnownOr(p, DEMO_STATUSES, 'cancelled')
      const hit = narrowKnown(p, DEMO_STATUSES)
      expect(hit === null).toBe(coerced !== p)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
