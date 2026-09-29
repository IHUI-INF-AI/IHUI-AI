// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  STDERR_TAIL_LIMIT_BYTES,
  boundUtf8,
  truncateUtf8Head,
  truncateUtf8Tail,
  utf8ByteLength,
} from '../src/utils/utf8-bound.js'

describe('truncateUtf8Head:按字节预算切头不切多字节(b75-3#2)', () => {
  it('中文:预算落在多字节中间 → 回退到完整字符边界,无 U+FFFD', () => {
    const text = '中'.repeat(10) // 30 字节
    const cut = truncateUtf8Head(text, 7) // 7B = 2 个完整中文(6B) + 第 3 个中文的首字节
    expect(cut).toBe('中中')
    expect(utf8ByteLength(cut)).toBeLessThanOrEqual(7)
    expect(cut.includes('\uFFFD')).toBe(false)
  })

  it('emoji(4 字节序列):预算落在序列中间 → 整个 emoji 丢弃', () => {
    const text = 'a👍b' // 1 + 4 + 1 = 6 字节
    const cut = truncateUtf8Head(text, 3) // a + 👍 的前 2 字节
    expect(cut).toBe('a')
    expect(cut.includes('\uFFFD')).toBe(false)
  })

  it('预算内原样返回', () => {
    const text = 'hello 世界'
    expect(truncateUtf8Head(text, 100)).toBe(text)
  })

  it('预算 0 → 空串;负预算 → 空串', () => {
    expect(truncateUtf8Head('中文', 0)).toBe('')
    expect(truncateUtf8Head('中文', -1)).toBe('')
  })
})

describe('truncateUtf8Tail:stderr 保尾语义(上游 64KiB 同型)', () => {
  it('保尾部;头部被切断的多字节整段丢弃,无 U+FFFD', () => {
    const text = '中'.repeat(5) + 'END' // 15 + 3 = 18 字节
    const cut = truncateUtf8Tail(text, 10) // start=8 落在第 3 个中文续字节上 → 跳到第 4 个中文首字节
    expect(cut).toBe('中中END') // 保尾 9 字节 = 2 个中文 + END
    expect(utf8ByteLength(cut)).toBeLessThanOrEqual(10)
    expect(cut.includes('\uFFFD')).toBe(false)
  })

  it('64KiB 上限常量成文,超限保尾命中末尾标记', () => {
    expect(STDERR_TAIL_LIMIT_BYTES).toBe(65536)
    const text = 'x'.repeat(70_000) + 'tail-marker'
    const cut = truncateUtf8Tail(text, STDERR_TAIL_LIMIT_BYTES)
    expect(cut.endsWith('tail-marker')).toBe(true)
    expect(utf8ByteLength(cut)).toBeLessThanOrEqual(STDERR_TAIL_LIMIT_BYTES)
  })

  it('预算内原样返回', () => {
    const text = 'err: 根因在尾部'
    expect(truncateUtf8Tail(text, 1000)).toBe(text)
  })
})

describe('boundUtf8:按正文形状有界化', () => {
  it('不超限原样返回 truncated=false', () => {
    const value = { hello: '世界' }
    const bounded = boundUtf8(value, 1000)
    expect(bounded.truncated).toBe(false)
    expect(bounded.result).toBe(value)
  })

  it('字符串超限切头', () => {
    const bounded = boundUtf8('中'.repeat(20), 10)
    expect(bounded.truncated).toBe(true)
    expect(bounded.result).toBe('中中中')
    expect(utf8ByteLength(bounded.result as string)).toBeLessThanOrEqual(10)
  })

  it('数组逐项累加:放不下的连同其后全部去尾', () => {
    const arr = ['ab', '中文', 'x'.repeat(100)]
    const bounded = boundUtf8(arr, 20)
    expect(bounded.truncated).toBe(true)
    expect(bounded.result).toEqual(['ab', '中文'])
    expect(utf8ByteLength(JSON.stringify(bounded.result))).toBeLessThanOrEqual(20)
  })

  it('stdout/stderr 各分一半预算;一路用不完的余额让给另一路;exitCode 恒保留', () => {
    // overhead 38B → 预算 162B;stderr 40B(< 半额 81B)原样保留,余额让给 stdout → 122B
    const bounded = boundUtf8({ exitCode: 1, stdout: 'o'.repeat(1000), stderr: 'e'.repeat(40) }, 200)
    expect(bounded.truncated).toBe(true)
    const out = bounded.result as { exitCode: number; stdout: string; stderr: string }
    expect(out.exitCode).toBe(1)
    expect(out.stderr).toBe('e'.repeat(40))
    expect(out.stdout).toBe('o'.repeat(122))
    expect(utf8ByteLength(JSON.stringify(out))).toBeLessThanOrEqual(200)
  })

  it('两路都超限时各得一半预算', () => {
    const bounded = boundUtf8({ exitCode: 2, stdout: 'o'.repeat(1000), stderr: 'e'.repeat(1000) }, 234)
    expect(bounded.truncated).toBe(true)
    const out = bounded.result as { exitCode: number; stdout: string; stderr: string }
    expect(out.exitCode).toBe(2)
    expect(out.stdout).toBe('o'.repeat(98))
    expect(out.stderr).toBe('e'.repeat(98))
    expect(utf8ByteLength(JSON.stringify(out))).toBeLessThanOrEqual(234)
  })

  it('其它对象超限退化为切头 JSON 文本', () => {
    const bounded = boundUtf8({ k: 'x'.repeat(100) }, 30)
    expect(bounded.truncated).toBe(true)
    expect(typeof bounded.result).toBe('string')
    expect(utf8ByteLength(bounded.result as string)).toBeLessThanOrEqual(30)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
