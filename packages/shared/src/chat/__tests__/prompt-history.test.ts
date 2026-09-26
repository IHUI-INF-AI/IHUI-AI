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

// ===== 存储配额淘汰(Codex 对标语义) =====
// web 接线(apps/web/src/hooks/use-prompt-history.ts)按 key 分桶持久化:
// 全局桶 `chat:prompt-history`(未持久化会话)+ 按会话桶 `chat:prompt-history:{id}`,
// 每个桶独立套用 50 条上限,超限淘汰最旧;淘汰发生在写入路径(pushPromptEntry)。
// 此处用内存 Map 模拟该存储形状(key → JSON 字符串数组),纯逻辑层不触碰 localStorage / DOM。
describe('存储配额淘汰', () => {
  const GLOBAL_KEY = 'chat:prompt-history'
  const sessionKey = (id: string) => `chat:prompt-history:${id}`

  /** 模拟 web 端 localStorage 形状:按 key 存 JSON 字符串数组,读回走 parsePromptHistory */
  function makeStore() {
    const map = new Map<string, string>()
    return {
      read: (key: string): string[] => parsePromptHistory(map.get(key) ?? null),
      write: (key: string, entries: readonly string[]) => {
        map.set(key, JSON.stringify(entries))
      },
    }
  }

  it('配额边界:恰好 50 条不淘汰,第 51 条才淘汰最旧一条', () => {
    let entries: string[] = []
    for (let i = 0; i < PROMPT_HISTORY_LIMIT; i++) {
      entries = pushPromptEntry(entries, `m${i}`)
    }
    // 上限内:最旧一条(m0)仍在,未发生淘汰
    expect(entries).toHaveLength(PROMPT_HISTORY_LIMIT)
    expect(entries[0]).toBe('m0')
    // 超限一条:总量封顶,恰好淘汰 m0 一条,最新保留
    entries = pushPromptEntry(entries, 'overflow')
    expect(entries).toHaveLength(PROMPT_HISTORY_LIMIT)
    expect(entries).not.toContain('m0')
    expect(entries[0]).toBe('m1')
    expect(entries[entries.length - 1]).toBe('overflow')
    // 其余 49 条未淘汰项全部保留
    for (let i = 1; i < PROMPT_HISTORY_LIMIT; i++) {
      expect(entries).toContain(`m${i}`)
    }
  })

  it('淘汰后经存储写入再读回,未淘汰项一条不丢、顺序不变', () => {
    const store = makeStore()
    let entries: string[] = []
    for (let i = 0; i < PROMPT_HISTORY_LIMIT + 5; i++) {
      entries = pushPromptEntry(entries, `m${i}`)
    }
    // 模拟 web 接线写入路径:setItem(key, JSON.stringify(next))
    store.write(GLOBAL_KEY, entries)
    // 模拟读回:getItem(key) → parsePromptHistory
    const readBack = store.read(GLOBAL_KEY)
    expect(readBack).toEqual(entries)
    expect(readBack).toHaveLength(PROMPT_HISTORY_LIMIT)
    // 被淘汰的 m0..m4 不在读回结果里,未淘汰的 m5..m54 一条不丢
    expect(readBack[0]).toBe('m5')
    for (let i = 5; i < PROMPT_HISTORY_LIMIT + 5; i++) {
      expect(readBack).toContain(`m${i}`)
    }
  })

  it('全局桶与按会话桶各自独立配额,一个桶超限不影响另一个桶', () => {
    const store = makeStore()
    // 全局桶写入基线 3 条
    let globalEntries: string[] = []
    for (let i = 0; i < 3; i++) {
      globalEntries = pushPromptEntry(globalEntries, `g${i}`)
    }
    store.write(GLOBAL_KEY, globalEntries)
    // 会话桶超限触发淘汰
    let sessionEntries: string[] = []
    for (let i = 0; i < PROMPT_HISTORY_LIMIT + 3; i++) {
      sessionEntries = pushPromptEntry(sessionEntries, `s${i}`)
    }
    store.write(sessionKey('c1'), sessionEntries)
    // 会话桶已淘汰到上限,全局桶读回原样不受牵连
    expect(store.read(sessionKey('c1'))).toHaveLength(PROMPT_HISTORY_LIMIT)
    expect(store.read(GLOBAL_KEY)).toEqual(['g0', 'g1', 'g2'])
    // 反向:全局桶也超限淘汰,会话桶同样不受影响
    let g = store.read(GLOBAL_KEY)
    for (let i = 0; i < PROMPT_HISTORY_LIMIT + 2; i++) {
      g = pushPromptEntry(g, `gx${i}`)
    }
    store.write(GLOBAL_KEY, g)
    expect(store.read(GLOBAL_KEY)).toHaveLength(PROMPT_HISTORY_LIMIT)
    const s1 = store.read(sessionKey('c1'))
    expect(s1).toHaveLength(PROMPT_HISTORY_LIMIT)
    expect(s1[0]).toBe('s3') // 自身的淘汰结果保持不变
    expect(s1[s1.length - 1]).toBe(`s${PROMPT_HISTORY_LIMIT + 2}`)
  })

  it('多个会话桶之间互不影响,各自淘汰各自的最旧', () => {
    const store = makeStore()
    for (const id of ['c1', 'c2']) {
      let entries: string[] = []
      for (let i = 0; i < PROMPT_HISTORY_LIMIT + 1; i++) {
        entries = pushPromptEntry(entries, `${id}-m${i}`)
      }
      store.write(sessionKey(id), entries)
      const readBack = store.read(sessionKey(id))
      expect(readBack).toHaveLength(PROMPT_HISTORY_LIMIT)
      expect(readBack[0]).toBe(`${id}-m1`) // 各自淘汰各自的最旧一条
      expect(readBack[PROMPT_HISTORY_LIMIT - 1]).toBe(`${id}-m${PROMPT_HISTORY_LIMIT}`)
    }
    expect(store.read(GLOBAL_KEY)).toEqual([]) // 全局桶未被波及
  })
})
