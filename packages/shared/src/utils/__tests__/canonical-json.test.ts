// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 86F 合一行为锁:唯一实现必须与**原 audit-log-service 私有版**逐字节同形
 * (链上存量 current_hash 由它算,任何"顺手修正"都是行为变更)。
 * 成对正反例:同内容换键序 ⇒ 同串;换内容 ⇒ 必不同串。
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

  it('undefined 分支保留原形态(JSON.stringify(undefined) 非字符串)——不可达面不修,修=行为变更', () => {
    // 原 audit-log-service 私有版对 undefined 返回 JSON.stringify(undefined)(JS undefined);
    // 本锁钉"逐字同形",不是"这形态正确"。两消费面的真实输入(链 8 字段数组、
    // AuditLogChainRow 全 `| null`、JSONB 读出值)都在 JSON 域,该分支不可达(头注已登记)。
    expect(canonicalStringify(undefined)).toBeUndefined()
  })

  it('嵌套数组里的对象同样排序(递归覆盖,不是只排顶层)', () => {
    const s = canonicalStringify([{ b: 1, a: 2 }])
    expect(s).toBe('[{"a":2,"b":1}]')
  })
})
