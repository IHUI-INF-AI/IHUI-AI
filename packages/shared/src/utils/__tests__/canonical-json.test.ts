// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 86F 合一行为锁:JSON 域内必须与**原 audit-log-service 私有版**逐字节同形
 * (链上存量 current_hash 由它算,任何"顺手修正"域内分支都是行为变更)。
 * 成对正反例:同内容换键序 ⇒ 同串;换内容 ⇒ 必不同串。
 * JSON 域外分支已按 DBG-24/DBG-20129(2026-11-11)修正(域外形态不在 JSONB
 * 读出值域内,不触碰存量哈希)。
 */
import { describe, expect, it } from 'vitest'
import { canonicalStringify } from '../canonical-json'

describe('canonicalStringify(唯一实现=原链哈希版逐字)', () => {
  it('对象 key 递归排序:同内容换键序得到同一串', () => {
    const a = canonicalStringify({ b: 1, a: { d: 4, c: 3 } })
    const b = canonicalStringify({ a: { c: 3, d: 4 }, b: 1 })
    expect(a).toBe(b)
    expect(a).toBe('{"a":{"c":3,"d":4},"b":1}')
  })

  it('数组保序(顺序即内容,不得排序)', () => {
    expect(canonicalStringify([2, 1])).toBe('[2,1]')
    expect(canonicalStringify([2, 1])).not.toBe(canonicalStringify([1, 2]))
  })

  it('JSON 域标量逐字 = JSON.stringify', () => {
    expect(canonicalStringify(null)).toBe('null')
    expect(canonicalStringify(42)).toBe('42')
    expect(canonicalStringify('x')).toBe('"x"')
    expect(canonicalStringify(true)).toBe('true')
  })

  it('值变 ⇒ 串变(反向对照:排序实现不得把不同内容折叠成同串)', () => {
    expect(canonicalStringify({ a: 1 })).not.toBe(canonicalStringify({ a: 2 }))
    expect(canonicalStringify({ a: null })).not.toBe(canonicalStringify({ a: 0 }))
  })

  it('undefined 分支已按 DBG-24 修正:恒返回 string(原返回 primitive undefined 系类型撒谎)', () => {
    // 原实现对 undefined 返回 JSON.stringify(undefined)(JS undefined),下游
    // Buffer.from(undefined) 直接崩;现顶层 undefined 落 'null',对象成员整键消失。
    expect(canonicalStringify(undefined)).toBe('null')
    expect(canonicalStringify({ a: undefined })).toBe('{}')
  })

  it('Date/循环引用/BigInt 防御已按 DBG-20129 收口', () => {
    expect(canonicalStringify(new Date('2026-09-28T10:00:00.000Z'))).toBe(
      '"2026-09-28T10:00:00.000Z"',
    )
    const cyc: Record<string, unknown> = {}
    cyc.me = cyc
    expect(() => canonicalStringify(cyc)).toThrow(TypeError)
    expect(canonicalStringify(42n)).toBe('"42"')
  })

  it('嵌套数组里的对象同样排序(递归覆盖,不是只排顶层)', () => {
    const s = canonicalStringify([{ b: 1, a: 2 }])
    expect(s).toBe('[{"a":2,"b":1}]')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
