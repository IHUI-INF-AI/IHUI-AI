// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 头尾预算判据(2026-11-23,对齐 DSH dsh-output-retention):
 * 截断必须保留头尾与精确省略数,且切口不得留下孤立代理项(否则 emoji 变 �)。
 */

import { describe, expect, it } from 'vitest'
import {
  truncateBothEnds,
  truncateWithoutSplittingSurrogatePair,
} from '../src/services/output-budget.js'

function hasLoneSurrogate(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    const high = code >= 0xd800 && code <= 0xdbff
    const low = code >= 0xdc00 && code <= 0xdfff
    if (high) {
      if (
        i + 1 >= text.length ||
        !(text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff)
      )
        return true
      i++
    } else if (low) {
      return true
    }
  }
  return false
}

describe('output budget', () => {
  it('未超限原样返回,omittedChars 为 0', () => {
    const result = truncateBothEnds('hello', 100)
    expect(result.text).toBe('hello')
    expect(result.truncated).toBe(false)
    expect(result.omittedChars).toBe(0)
  })

  it('超限保留头尾并精确报告省略数', () => {
    const raw = 'A'.repeat(100)
    const result = truncateBothEnds(raw, 10)
    expect(result.truncated).toBe(true)
    expect(result.headChars + result.tailChars + result.omittedChars).toBe(raw.length)
    expect(result.text.startsWith('A')).toBe(true)
    expect(result.text.endsWith('A')).toBe(true)
    expect(result.text).toContain('输出截断')
  })

  it('emoji 切口不产生孤立代理项', () => {
    const raw = `${'a'.repeat(5)}${'😀'.repeat(10)}${'z'.repeat(5)}`
    const result = truncateBothEnds(raw, 10)
    expect(hasLoneSurrogate(result.text)).toBe(false)
    expect(result.omittedChars).toBe(raw.length - result.headChars - result.tailChars)
  })

  it('按码元预算截前缀时丢弃半个代理对', () => {
    expect(truncateWithoutSplittingSurrogatePair('😀😀', 1)).toBe('')
    expect(truncateWithoutSplittingSurrogatePair('😀😀', 2)).toBe('😀')
    expect(truncateWithoutSplittingSurrogatePair('abc', 2)).toBe('ab')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
