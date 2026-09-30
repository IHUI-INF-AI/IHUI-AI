// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-641(2026-09-30):有界追加助手 —— 溢出丢弃计数 + 消费面计数行格式。
 */
import { describe, it, expect } from 'vitest'
import { boundedAppend, droppedNotice } from './bounded-append'

describe('boundedAppend', () => {
  it('未超上限时不丢弃', () => {
    const r = boundedAppend([1, 2], 3, 5)
    expect(r.items).toEqual([1, 2, 3])
    expect(r.dropped).toBe(0)
  })

  it('恰达上限时不丢弃', () => {
    const r = boundedAppend([1, 2, 3, 4], 5, 5)
    expect(r.items).toEqual([1, 2, 3, 4, 5])
    expect(r.dropped).toBe(0)
  })

  it('溢出丢最旧并返回丢弃条数', () => {
    const r = boundedAppend([1, 2, 3, 4, 5], 6, 5)
    expect(r.items).toEqual([2, 3, 4, 5, 6])
    expect(r.dropped).toBe(1)
  })

  it('不修改入参列表', () => {
    const src = [1, 2]
    boundedAppend(src, 3, 2)
    expect(src).toEqual([1, 2])
  })
})

describe('droppedNotice', () => {
  it('计数行形如 …(dropped N)', () => {
    expect(droppedNotice(7)).toBe('…(dropped 7)')
  })
})
