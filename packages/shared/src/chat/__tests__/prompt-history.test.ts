// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  PROMPT_HISTORY_LIMIT,
  navigateCursor,
  parsePromptHistory,
  pushPromptEntry,
  resolveHistoryText,
} from '../prompt-history'

describe('pushPromptEntry', () => {
  it('空文本不入栈', () => {
    expect(pushPromptEntry([], '   ')).toEqual([])
    expect(pushPromptEntry([], '')).toEqual([])
  })

  it('普通文本入栈到队尾(最新在末尾)', () => {
    expect(pushPromptEntry([], 'hello')).toEqual(['hello'])
    expect(pushPromptEntry(['a'], 'b')).toEqual(['a', 'b'])
  })

  it('连续重复不入栈(Codex 语义)', () => {
    const once = pushPromptEntry([], 'same')
    const twice = pushPromptEntry(once, 'same')
    expect(twice).toEqual(['same'])
  })

  it('非连续相同可再次入栈', () => {
    const s = pushPromptEntry(['a', 'b'], 'a')
    expect(s).toEqual(['a', 'b', 'a'])
  })

  it('超过 50 条时淘汰最旧,保留最近 50 条', () => {
    let entries: string[] = []
    for (let i = 0; i < PROMPT_HISTORY_LIMIT + 20; i++) {
      entries = pushPromptEntry(entries, `m${i}`)
    }
    expect(entries).toHaveLength(PROMPT_HISTORY_LIMIT)
    // 最旧 20 条(m0..m19)应被淘汰
    expect(entries[0]).toBe('m20')
    expect(entries[entries.length - 1]).toBe(`m${PROMPT_HISTORY_LIMIT + 19}`)
  })
})

describe('navigateCursor', () => {
  it('prev 向上(更旧)前进,cursor 上限 = 栈长', () => {
    expect(navigateCursor(0, 'prev', 3)).toBe(1)
    expect(navigateCursor(2, 'prev', 3)).toBe(3)
    expect(navigateCursor(3, 'prev', 3)).toBe(3) // 封顶在最旧
  })

  it('next 向下(更新)后退,cursor 下限 = 0(草稿)', () => {
    expect(navigateCursor(3, 'next', 3)).toBe(2)
    expect(navigateCursor(1, 'next', 3)).toBe(0)
    expect(navigateCursor(0, 'next', 3)).toBe(0) // 封底在草稿
  })
})

describe('resolveHistoryText', () => {
  const entries = ['first', 'second', 'third']

  it('cursor=0 返回草稿', () => {
    expect(resolveHistoryText(entries, 0, 'draft')).toBe('draft')
  })

  it('cursor=1 返回最新(队尾 third)', () => {
    expect(resolveHistoryText(entries, 1, 'draft')).toBe('third')
  })

  it('cursor=栈长 返回最旧(first)', () => {
    expect(resolveHistoryText(entries, 3, 'draft')).toBe('first')
  })
})

describe('游标前进后退 + 到底回草稿(端到端)', () => {
  it('↑↑ 到最旧再 ↓↓ 回到草稿', () => {
    const entries = ['a', 'b', 'c'] // a 最旧, c 最新
    // 模拟从草稿(cursor=0)开始上翻
    let cursor = 0
    cursor = navigateCursor(cursor, 'prev', entries.length) // 1 -> c
    expect(resolveHistoryText(entries, cursor, '')).toBe('c')
    cursor = navigateCursor(cursor, 'prev', entries.length) // 2 -> b
    expect(resolveHistoryText(entries, cursor, '')).toBe('b')
    cursor = navigateCursor(cursor, 'prev', entries.length) // 3 -> a
    expect(resolveHistoryText(entries, cursor, '')).toBe('a')
    // 再 ↑ 封顶仍 a
    cursor = navigateCursor(cursor, 'prev', entries.length)
    expect(resolveHistoryText(entries, cursor, '')).toBe('a')
    // ↓ ↓ ↓ 回到草稿
    cursor = navigateCursor(cursor, 'next', entries.length) // 2 -> b
    expect(resolveHistoryText(entries, cursor, '')).toBe('b')
    cursor = navigateCursor(cursor, 'next', entries.length) // 1 -> c
    expect(resolveHistoryText(entries, cursor, '')).toBe('c')
    cursor = navigateCursor(cursor, 'next', entries.length) // 0 -> draft
    expect(resolveHistoryText(entries, cursor, 'DRAFT')).toBe('DRAFT')
  })
})

describe('parsePromptHistory', () => {
  it('null / 空返回空数组', () => {
    expect(parsePromptHistory(null)).toEqual([])
    expect(parsePromptHistory('')).toEqual([])
  })

  it('合法 JSON 数组只保留字符串项', () => {
    expect(parsePromptHistory('["x",123,{"a":1},"y"]')).toEqual(['x', 'y'])
  })

  it('损坏 JSON / 非数组返回空数组', () => {
    expect(parsePromptHistory('{not json')).toEqual([])
    expect(parsePromptHistory('{"a":1}')).toEqual([])
  })
})
