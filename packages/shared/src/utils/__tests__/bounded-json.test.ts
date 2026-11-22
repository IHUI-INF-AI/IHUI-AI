// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  boundedStringifyJson,
  jsonStringBytes,
  BoundedJsonError,
  DEFAULT_MAX_JSON_BYTES,
  MAX_JSON_NODES,
  MAX_JSON_DEPTH,
} from '../bounded-json'

describe('jsonStringBytes — 对齐 Buffer.byteLength(JSON.stringify(s))', () => {
  it('纯 ASCII:逐字符 1 字节 + 首尾引号', () => {
    expect(jsonStringBytes('hello')).toBe(Buffer.byteLength('"hello"', 'utf8'))
    expect(jsonStringBytes('')).toBe(2)
    expect(jsonStringBytes('a')).toBe(3)
  })

  it('多字节 BMP(CJK):每字 3 字节', () => {
    expect(jsonStringBytes('你好')).toBe(Buffer.byteLength('"你好"', 'utf8'))
  })

  it('4 字节 emoji(代理对合并 = 4 字节,不双计)', () => {
    expect(jsonStringBytes('👍')).toBe(Buffer.byteLength('"👍"', 'utf8'))
    expect(jsonStringBytes('👍')).toBe(6) // 2 引号 + 4 字节
  })

  it('需要转义的控制字符按 JSON 转义后计字节', () => {
    expect(jsonStringBytes('\n')).toBe(Buffer.byteLength('"\\n"', 'utf8')) // \n = 2 字节转义
    expect(jsonStringBytes('\t')).toBe(Buffer.byteLength('"\\t"', 'utf8'))
    expect(jsonStringBytes('\r')).toBe(Buffer.byteLength('"\\r"', 'utf8'))
    expect(jsonStringBytes('"')).toBe(Buffer.byteLength('"\\\\"', 'utf8')) // \" = 2 字节
    expect(jsonStringBytes('\\')).toBe(Buffer.byteLength(JSON.stringify('\\'), 'utf8')) // JSON.stringify(\\) = " \ \ " = 4 字节
  })

  it('U+0000 等 <0x20 控制字符按 \\u00XX = 6 字节', () => {
    expect(jsonStringBytes('\x00')).toBe(Buffer.byteLength('"\\u0000"', 'utf8'))
    expect(jsonStringBytes('\x01')).toBe(Buffer.byteLength('"\\u0001"', 'utf8'))
  })

  it('全字符谱:逐字符比对 Buffer.byteLength,100% 对齐', () => {
    // 覆盖 ASCII + 拉丁 + CJK + emoji + 控制字符 + 孤立代理
    const chars: string[] = []
    for (let i = 0x20; i < 0x80; i++) chars.push(String.fromCharCode(i))
    for (let i = 0x80; i < 0x100; i++) chars.push(String.fromCharCode(i))
    for (let i = 0x4e00; i < 0x4e20; i++) chars.push(String.fromCharCode(i))
    for (let i = 0x1f600; i < 0x1f610; i++) chars.push(String.fromCodePoint(i))
    for (let i = 0; i < 0x20; i++) chars.push(String.fromCharCode(i))
    chars.push('\ud800') // 孤立高代理
    chars.push('\udc00') // 孤立低代理
    chars.push('\ud83d\ude00') // 正常代理对

    for (const c of chars) {
      const expected = Buffer.byteLength(JSON.stringify(c), 'utf8')
      const actual = jsonStringBytes(c)
      expect(actual, `字符 U+${c.codePointAt(0)!.toString(16)} 字节数不一致`).toBe(expected)
    }
  })

  it('混合长串:与 Buffer.byteLength 端到端对齐', () => {
    const s = 'hello 👍 world 你好 \n\t"quoted"'
    expect(jsonStringBytes(s)).toBe(Buffer.byteLength(JSON.stringify(s), 'utf8'))
  })
})

describe('boundedStringifyJson — 语义对齐 JSON.stringify', () => {
  it('标量:null/boolean/number/string', () => {
    expect(boundedStringifyJson(null)).toBe('null')
    expect(boundedStringifyJson(true)).toBe('true')
    expect(boundedStringifyJson(false)).toBe('false')
    expect(boundedStringifyJson(42)).toBe('42')
    expect(boundedStringifyJson(-3.14)).toBe('-3.14')
    expect(boundedStringifyJson('hi')).toBe('"hi"')
  })

  it('NaN/Infinity ⇒ null(对齐 JSON.stringify)', () => {
    expect(boundedStringifyJson(Number.NaN)).toBe('null')
    expect(boundedStringifyJson(Number.POSITIVE_INFINITY)).toBe('null')
    expect(boundedStringifyJson(Number.NEGATIVE_INFINITY)).toBe('null')
  })

  it('undefined/function/symbol(对象内)整键丢弃', () => {
    expect(boundedStringifyJson({ a: 1, b: undefined })).toBe('{"a":1}')
    expect(boundedStringifyJson({ a: 1, b: () => {} })).toBe('{"a":1}')
    expect(boundedStringifyJson({ a: 1, b: Symbol('s') })).toBe('{"a":1}')
  })

  it('undefined/function/symbol(数组内)⇒ null(对齐 JSON.stringify)', () => {
    expect(boundedStringifyJson([1, undefined, 2])).toBe('[1,null,2]')
    expect(boundedStringifyJson([1, () => {}, 2])).toBe('[1,null,2]')
  })

  it('数组嵌套', () => {
    expect(boundedStringifyJson([1, [2, 3], [4, [5]]])).toBe('[1,[2,3],[4,[5]]]')
  })

  it('对象嵌套', () => {
    expect(boundedStringifyJson({ a: { b: { c: 1 } } })).toBe('{"a":{"b":{"c":1}}}')
  })

  it('顶层 undefined/function/symbol ⇒ null(对齐 JSON.stringify)', () => {
    expect(boundedStringifyJson(undefined)).toBe('null')
    expect(boundedStringifyJson(() => {})).toBe('null')
  })

  it('toJSON 方法:调用后继续序列化', () => {
    const obj = { toJSON: () => ({ x: 1 }) }
    expect(boundedStringifyJson(obj)).toBe('{"x":1}')
  })

  it('bigint:转为字符串(对齐 JSON.stringify)', () => {
    expect(boundedStringifyJson(42n)).toBe('"42"')
  })

  it('键名转义', () => {
    expect(boundedStringifyJson({ 'a"b': 1 })).toBe('{"a\\"b":1}')
  })
})

describe('boundedStringifyJson — 三重护栏', () => {
  it('超字节预算 ⇒ BoundedJsonError(tooLarge)', () => {
    const big = 'x'.repeat(1000)
    expect(() => boundedStringifyJson({ s: big }, 100)).toThrow(BoundedJsonError)
    try {
      boundedStringifyJson({ s: big }, 100)
    } catch (e) {
      const err = e as BoundedJsonError
      expect(err.result.ok).toBe(false)
      expect(err.result.reason).toBe('tooLarge')
      expect(err.result.limit).toBe(100)
    }
  })

  it('深度超限 ⇒ BoundedJsonError(tooComplex, depth)', () => {
    let obj: unknown = 1
    for (let i = 0; i < MAX_JSON_DEPTH + 10; i++) obj = { inner: obj }
    try {
      boundedStringifyJson(obj)
      expect.unreachable('should throw')
    } catch (e) {
      const err = e as BoundedJsonError
      expect(err.result.ok).toBe(false)
      expect(err.result.reason).toBe('tooComplex')
      expect(err.result.limit).toBe(MAX_JSON_DEPTH)
    }
  })

  it('节点数超限 ⇒ BoundedJsonError(tooComplex, nodes)', () => {
    // 构造 >MAX_JSON_NODES 个节点的宽对象;传超大 maxBytes 才能测到节点护栏
    // (否则字节数先触发 tooLarge)。
    const obj: Record<string, number> = {}
    for (let i = 0; i < MAX_JSON_NODES + 10; i++) obj[`k${i}`] = i
    try {
      boundedStringifyJson(obj, Number.MAX_SAFE_INTEGER)
      expect.unreachable('should throw')
    } catch (e) {
      const err = e as BoundedJsonError
      expect(err.result.reason).toBe('tooComplex')
      expect(err.result.limit).toBe(MAX_JSON_NODES)
    }
  })

  it('循环引用 ⇒ TypeError(对齐 canonical-json)', () => {
    const a: Record<string, unknown> = { x: 1 }
    a.self = a
    expect(() => boundedStringifyJson(a)).toThrow(TypeError)
  })
})

describe('boundedStringifyJson — 迭代遍历(防栈溢出)', () => {
  it('深嵌套数组不栈溢出(深度 < MAX_JSON_DEPTH)', () => {
    let arr: unknown = 1
    for (let i = 0; i < 100; i++) arr = [arr]
    const json = boundedStringifyJson(arr)
    expect(json).toContain('1')
    // 验证深度:有 100 层 [ 嵌套
    const depth = (json.match(/\[/g) ?? []).length
    expect(depth).toBe(100)
  })

  it('深嵌套对象不栈溢出', () => {
    let obj: unknown = 1
    for (let i = 0; i < 100; i++) obj = { v: obj }
    const json = boundedStringifyJson(obj)
    expect(json).toContain('1')
    const depth = (json.match(/\{/g) ?? []).length
    expect(depth).toBe(100)
  })
})

describe('DEFAULT_MAX_JSON_BYTES', () => {
  it('等于 256KB(对齐 WorkBuddy MCP_SERVER_MAX_JSON_FIELD_BYTES)', () => {
    expect(DEFAULT_MAX_JSON_BYTES).toBe(256 * 1024)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
