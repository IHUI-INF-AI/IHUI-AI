// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D36 草稿共享层纯逻辑单测:截断 / 安全读取 / 桶配额淘汰计划。
 * 淘汰判据的每条都配成对正反例 —— "≤max 不删"与">max 删最旧"必须各测一次,
 * 否则实现把两个方向都写成空数组也能全绿(本仓"把没判写成判过了"同型)。
 */

import { describe, expect, it } from 'vitest'
import {
  PROMPT_BUCKET_MAX,
  PROMPT_DRAFT_MAX_LENGTH,
  PROMPT_DRAFT_PREFIX,
  PROMPT_HISTORY_PREFIX,
  parsePromptBucketIndex,
  parsePromptDraft,
  planPromptBucketEviction,
  touchPromptBucket,
  truncatePromptDraft,
  type PromptBucketIndex,
} from '../prompt-drafts'

describe('truncatePromptDraft', () => {
  it('超长截断到上限,不拒存', () => {
    const long = 'x'.repeat(PROMPT_DRAFT_MAX_LENGTH + 999)
    expect(truncatePromptDraft(long)).toHaveLength(PROMPT_DRAFT_MAX_LENGTH)
  })
  it('限内原样;非字符串兜空串', () => {
    expect(truncatePromptDraft('abc')).toBe('abc')
    expect(truncatePromptDraft(undefined as unknown as string)).toBe('')
  })
})

describe('parsePromptDraft', () => {
  it('缺失/非字符串 ⇒ 空串;字符串原样', () => {
    expect(parsePromptDraft(null)).toBe('')
    expect(parsePromptDraft(undefined as unknown as null)).toBe('')
    expect(parsePromptDraft('draft')).toBe('draft')
  })
})

describe('parsePromptBucketIndex', () => {
  it('缺失/坏 JSON/数组/非对象 ⇒ 空对象(等价"无年龄证据")', () => {
    expect(parsePromptBucketIndex(null)).toEqual({})
    expect(parsePromptBucketIndex('{')).toEqual({})
    expect(parsePromptBucketIndex('[]')).toEqual({})
    expect(parsePromptBucketIndex('"str"')).toEqual({})
  })
  it('逐值清洗:非有限数/负数条目剔除,合法条目保留', () => {
    const idx = parsePromptBucketIndex(JSON.stringify({ a: 1, b: 'x', c: NaN, d: -2, e: 0 }))
    expect(idx).toEqual({ a: 1, e: 0 })
  })
})

describe('touchPromptBucket', () => {
  it('不可变:新对象携带旧项 + 新 touch', () => {
    const base: PromptBucketIndex = { a: 1 }
    const next = touchPromptBucket(base, 'b', 2)
    expect(base).toEqual({ a: 1 })
    expect(next).toEqual({ a: 1, b: 2 })
  })
})

describe('planPromptBucketEviction', () => {
  const draftKeys = (n: number, t0 = 1000, step = 1000): PromptBucketIndex => {
    const idx: PromptBucketIndex = {}
    for (let i = 0; i < n; i++) idx[`${PROMPT_DRAFT_PREFIX}:${i}`] = t0 + i * step
    return idx
  }

  it('族内 ≤max ⇒ 空数组(正反对照的下半)', () => {
    expect(planPromptBucketEviction(draftKeys(3), PROMPT_DRAFT_PREFIX, 3)).toEqual([])
  })
  it('族内 >max ⇒ 删最旧,数量=超出数', () => {
    const idx = draftKeys(5)
    const evict = planPromptBucketEviction(idx, PROMPT_DRAFT_PREFIX, 3)
    expect(evict).toEqual([`${PROMPT_DRAFT_PREFIX}:0`, `${PROMPT_DRAFT_PREFIX}:1`])
  })
  it('同刻并列按 key 升序定序(删了谁必须可复现)', () => {
    const idx: PromptBucketIndex = {
      [`${PROMPT_DRAFT_PREFIX}:b`]: 5,
      [`${PROMPT_DRAFT_PREFIX}:a`]: 5,
      [`${PROMPT_DRAFT_PREFIX}:c`]: 9,
    }
    expect(planPromptBucketEviction(idx, PROMPT_DRAFT_PREFIX, 2)).toEqual([
      `${PROMPT_DRAFT_PREFIX}:a`,
    ])
  })
  it('族隔离:history 族超配额不动 draft 族,反之亦然', () => {
    const mixed: PromptBucketIndex = {
      ...draftKeys(2),
      [`${PROMPT_HISTORY_PREFIX}:0`]: 1,
      [`${PROMPT_HISTORY_PREFIX}:1`]: 2,
      [`${PROMPT_HISTORY_PREFIX}:2`]: 3,
    }
    expect(planPromptBucketEviction(mixed, PROMPT_DRAFT_PREFIX, 2)).toEqual([])
    const evict = planPromptBucketEviction(mixed, PROMPT_HISTORY_PREFIX, 2)
    expect(evict).toEqual([`${PROMPT_HISTORY_PREFIX}:0`])
  })
  it('裸 key(chat:draft 未持久化会话)计入本族', () => {
    const idx: PromptBucketIndex = {
      [PROMPT_DRAFT_PREFIX]: 1,
      [`${PROMPT_DRAFT_PREFIX}:a`]: 2,
    }
    expect(planPromptBucketEviction(idx, PROMPT_DRAFT_PREFIX, 1)).toEqual([PROMPT_DRAFT_PREFIX])
  })
  it('fail-safe:手拼全非数值索引 ⇒ 一个都不删(没判不写成判过)', () => {
    const idx = {
      [`${PROMPT_DRAFT_PREFIX}:0`]: Number.NaN,
      [`${PROMPT_DRAFT_PREFIX}:1`]: Number.NaN,
    } as unknown as PromptBucketIndex
    expect(planPromptBucketEviction(idx, PROMPT_DRAFT_PREFIX, 1)).toEqual([])
  })
  it('默认上限=PROMPT_BUCKET_MAX:恰好 max+1 个 ⇒ 删 1', () => {
    const idx = draftKeys(PROMPT_BUCKET_MAX + 1)
    const evict = planPromptBucketEviction(idx, PROMPT_DRAFT_PREFIX)
    expect(evict).toHaveLength(1)
    expect(evict[0]).toBe(`${PROMPT_DRAFT_PREFIX}:0`)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
