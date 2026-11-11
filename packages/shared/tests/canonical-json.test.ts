// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 86F ②:canonical JSON 唯一实现的行为钉。
 *
 * JSON 域内(链上存量 current_hash 的计算面)与 `audit-log-service.ts` 原私有
 * 实现逐字节等价 —— 任何"顺手修正"域内分支都会让重算与存量断裂,本文件域内
 * 用例即防此。JSON 域外分支(Date/undefined/function/Symbol/BigInt/循环引用)
 * 已按 DBG-24/DBG-20129(2026-11-11)修正为对任意 unknown 输入防御,域外用例
 * 钉新契约。
 */
import { describe, expect, it } from 'vitest'
import { canonicalStringify } from '../src/utils/canonical-json.js'

describe('canonicalStringify(86F 唯一实现 = 链计算版逐字)', () => {
  it('对象 key 递归升序,与插入顺序无关', () => {
    expect(canonicalStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}')
    expect(canonicalStringify({ z: { y: 1, x: 2 }, a: [3, { b: 1, a: 2 }] })).toBe(
      '{"a":[3,{"a":2,"b":1}],"z":{"x":2,"y":1}}',
    )
    // 两个插入顺序相反的对象 ⇒ 同一串字节(导出可复现/签名可复算的根基)
    expect(canonicalStringify({ alpha: 'x', zeta: 1 })).toBe(
      canonicalStringify({ zeta: 1, alpha: 'x' }),
    )
  })

  it('数组保序逐项递归,标量走 JSON.stringify', () => {
    expect(canonicalStringify([1, 'a', true, null])).toBe('[1,"a",true,null]')
    expect(canonicalStringify(null)).toBe('null')
    expect(canonicalStringify('he"llo')).toBe('"he\\"llo"')
    expect(canonicalStringify(42)).toBe('42')
  })

  it('链哈希输入形态:8 字段数组 + metadata 对象嵌套,字节稳定', () => {
    const payload = canonicalStringify([
      '0'.repeat(64),
      '2026-09-28T10:00:00.000Z',
      '',
      'auth.login',
      '',
      '',
      '',
      { b: 1, a: 'x' },
    ])
    expect(payload).toBe(
      '["' +
        '0'.repeat(64) +
        '","2026-09-28T10:00:00.000Z","","auth.login","","","",{"a":"x","b":1}]',
    )
  })

  it('JSON 域外分支按 DBG-24/DBG-20129 修正:恒返回 string、对齐 JSON.stringify、防御任意输入', () => {
    // 顶层 undefined:原返回 primitive undefined(类型撒谎 ⇒ Buffer.from 崩),现落 'null'
    expect(canonicalStringify(undefined)).toBe('null')
    // 对象成员 undefined:整键消失(对齐 JSON.stringify,原落非法 '{"a":undefined}')
    expect(canonicalStringify({ a: undefined, b: 1 })).toBe('{"b":1}')
    expect(canonicalStringify({ a: undefined })).toBe('{}')
    // 数组成员 undefined:落 null(对齐 JSON.stringify,原落 '[1,,2]')
    expect(canonicalStringify([undefined])).toBe('[null]')
    expect(canonicalStringify([1, undefined, 2])).toBe('[1,null,2]')
    // Date:原落 "{}"(与 JSON.stringify 分叉),现同 JSON.stringify 的 ISO 串
    const d = new Date('2026-09-28T10:00:00.000Z')
    expect(canonicalStringify(d)).toBe('"2026-09-28T10:00:00.000Z"')
    expect(canonicalStringify({ at: d })).toBe('{"at":"2026-09-28T10:00:00.000Z"}')
    // function/Symbol:顶层与数组成员落 null,对象成员整键消失(同 JSON.stringify 语义)
    expect(canonicalStringify(() => 1)).toBe('null')
    expect(canonicalStringify(Symbol('x'))).toBe('null')
    expect(canonicalStringify({ f: () => 1, s: Symbol('s'), n: 1 })).toBe('{"n":1}')
    // BigInt:原直接抛 TypeError,现十进制字符串表示
    expect(canonicalStringify(10n)).toBe('"10"')
    // 循环引用:原无限递归栈溢出,现抛受控 TypeError
    const cyc: Record<string, unknown> = { a: 1 }
    cyc.self = cyc
    expect(() => canonicalStringify(cyc)).toThrow(TypeError)
    // 共享引用非循环:同一对象出现在兄弟位置仍合法
    const shared = { x: 1 }
    expect(canonicalStringify({ p: shared, q: shared })).toBe('{"p":{"x":1},"q":{"x":1}}')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
