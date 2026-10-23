// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * stop 本地截断纯函数测试(2026-10-23 立)。
 * 覆盖:跨 chunk 命中、holdback 尾巴、flush、多 stop 取最早、emoji 不劈半、聚合响应改写。
 */
import { describe, it, expect } from 'vitest'
import { __test__ as S } from '../src/services/relay-stop-truncate.js'

describe('normalizeStopList', () => {
  it('字符串归一为数组;去重/去空;undefined → 空数组', () => {
    expect(S.normalizeStopList('END')).toEqual(['END'])
    expect(S.normalizeStopList(['a', 'a', '', 'b'])).toEqual(['a', 'b'])
    expect(S.normalizeStopList(undefined)).toEqual([])
    expect(S.normalizeStopList(null)).toEqual([])
  })
})

describe('createStopTruncator(流式)', () => {
  it('stop 跨 chunk 也能命中;命中前文照发,其后丢弃', () => {
    const t = S.createStopTruncator(['END'])
    const out: string[] = []
    let matched = false
    for (const piece of ['he', 'llo', 'E', 'ND', 'TAIL']) {
      const r = t.push(piece)
      out.push(r.text)
      if (r.matched) {
        matched = true
        break
      }
    }
    expect(matched).toBe(true)
    expect(out.join('')).toBe('hello')
  })

  it('未命中时不丢尾巴:最后 maxStopLen-1 个字符由 flush 补出', () => {
    const t = S.createStopTruncator(['END'])
    const first = t.push('hello world')
    expect(first.matched).toBe(false)
    expect(first.text).toBe('hello wor') // 扣留 'ld' 以跨 chunk 检测
    const tail = t.flush()
    expect(tail.text).toBe('ld')
  })

  it('多个 stop 取最早命中;命中后 flush 不再吐内容', () => {
    const t = S.createStopTruncator(['ZZZ', 'b'])
    const r1 = t.push('aaabccc')
    expect(r1.matched).toBe(true)
    expect(r1.text).toBe('aaa')
    expect(t.flush()).toEqual({ text: '', matched: true })
  })

  it('emoji stop 相邻时不会劈出半个代理对', () => {
    const t = S.createStopTruncator(['😀'])
    const r = t.push('x😀y')
    expect(r.matched).toBe(true)
    expect(r.text).toBe('x')
    expect(t.flush().text).toBe('')
  })
})

describe('truncateAtStops / applyStopToCompletion', () => {
  it('一次性截断取最早命中并丢弃其后', () => {
    expect(S.truncateAtStops('abcdef', ['cd', 'b'])).toEqual({ text: 'a', matched: true })
    expect(S.truncateAtStops('abcdef', ['zz'])).toEqual({ text: 'abcdef', matched: false })
    expect(S.truncateAtStops('abc', [])).toEqual({ text: 'abc', matched: false })
  })

  it('聚合后的 chat.completion:只改 message.content 并置 finish_reason=stop', () => {
    const completion = {
      choices: [{ index: 0, message: { role: 'assistant', content: 'helloENDtail' }, finish_reason: null }],
    }
    expect(S.applyStopToCompletion(completion, ['END'])).toBe(true)
    expect(completion.choices[0]?.message.content).toBe('hello')
    expect(completion.choices[0]?.finish_reason).toBe('stop')

    const untouched = { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }
    expect(S.applyStopToCompletion(untouched, ['END'])).toBe(false)
    expect(untouched.choices[0]?.finish_reason).toBe('stop')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
