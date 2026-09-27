// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 86F ②:canonical JSON 唯一实现的行为钉。
 *
 * 合一取的是**链计算用的那份**(`audit-log-service.ts` 原私有实现)逐字 ——
 * 链上存量 current_hash 全部由它算出,任何"顺手修正"都会让重算与存量断裂。
 * 本文件把这些既有形态(含 JSON 域外的 `undefined` 分支)逐字钉死:
 * 谁改了任何一个分支,这里先红,而不是等生产链断。
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

  it('JSON 域外分支逐字保留(既有形态,不在本票修正)', () => {
    // 顶层 undefined:原链计算版走 JSON.stringify(undefined) ⇒ JS undefined 而非字符串。
    // 两消费面输入都来自 PG/JSONB 读出值,JSON 域内不存在 undefined,该分支不可达 ——
    // 如实钉住现状,不静默修正("两处并一处"与"改行为"是两件事)。
    expect(canonicalStringify(undefined)).toBeUndefined()
    // 对象成员 undefined:键保留、值落 "undefined" 字面(与 JSON.stringify 整键消失不同)。
    expect(canonicalStringify({ a: undefined })).toBe('{"a":undefined}')
    // 数组成员 undefined:递归得到 JS undefined,而 Array.prototype.join 把 undefined
    // 当空串 ⇒ [undefined] 落 '[]'、[1,undefined,2] 落 '[1,,2]'(既有形态,如实钉住)。
    expect(canonicalStringify([undefined])).toBe('[]')
    expect(canonicalStringify([1, undefined, 2])).toBe('[1,,2]')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
