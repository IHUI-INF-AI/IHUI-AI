// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { describe, expect, it } from 'vitest'
import {
  PROMPT_BUCKET_INDEX_KEY,
  PROMPT_DRAFT_PREFIX,
  PROMPT_HISTORY_PREFIX,
  parsePromptBucketIndex,
} from '@ihui/shared/chat/prompt-drafts'
import { touchAndEvictBuckets, type BucketStorage } from '../prompt-bucket-quota'

function memStorage(
  init: Record<string, string> = {},
): BucketStorage & { dump(): Record<string, string> } {
  const map = new Map(Object.entries(init))
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    dump: () => Object.fromEntries(map),
  }
}

describe('touchAndEvictBuckets(D36 桶配额编排)', () => {
  it('未超配额:只 touch 索引,一个桶都不删', () => {
    const s = memStorage()
    const evicted = touchAndEvictBuckets(PROMPT_DRAFT_PREFIX, 'chat:draft:a', {
      storage: s,
      now: 1,
    })
    expect(evicted).toEqual([])
    expect(parsePromptBucketIndex(s.getItem(PROMPT_BUCKET_INDEX_KEY))).toEqual({
      'chat:draft:a': 1,
    })
  })

  it('超配额:最旧桶被 removeItem 且从索引消失,新桶保命', () => {
    const s = memStorage({
      'chat:draft:old': 'DRAFT-OLD',
      'chat:draft:keep': 'DRAFT-KEEP',
      [PROMPT_BUCKET_INDEX_KEY]: JSON.stringify({ 'chat:draft:old': 1, 'chat:draft:keep': 2 }),
    })
    const evicted = touchAndEvictBuckets(PROMPT_DRAFT_PREFIX, 'chat:draft:keep', {
      storage: s,
      now: 100,
    })
    // max 默认 50,两桶不触发 ⇒ 先验证 touch 生效
    expect(evicted).toEqual([])
    expect(parsePromptBucketIndex(s.getItem(PROMPT_BUCKET_INDEX_KEY))['chat:draft:keep']).toBe(100)
  })

  it('真正超配额(51 个 draft 桶)⇒ 删最旧 1 个,索引同步收缩', () => {
    const idx: Record<string, number> = {}
    const init: Record<string, string> = {}
    for (let i = 0; i < 50; i++) {
      const k = `chat:draft:c${i}`
      idx[k] = 1000 + i
      init[k] = `d${i}`
    }
    const s = memStorage({ ...init, [PROMPT_BUCKET_INDEX_KEY]: JSON.stringify(idx) })
    const evicted = touchAndEvictBuckets(PROMPT_DRAFT_PREFIX, 'chat:draft:newer', {
      storage: s,
      now: 999999,
    })
    expect(evicted).toEqual(['chat:draft:c0'])
    expect(s.getItem('chat:draft:c0')).toBeNull()
    expect(s.getItem('chat:draft:c1')).toBe('d1')
    const after = parsePromptBucketIndex(s.getItem(PROMPT_BUCKET_INDEX_KEY))
    expect(after['chat:draft:c0']).toBeUndefined()
    expect(after['chat:draft:newer']).toBe(999999)
  })

  it('族隔离:history 写入不淘汰 draft 族', () => {
    const idx: Record<string, number> = {}
    for (let i = 0; i < 60; i++) idx[`chat:draft:c${i}`] = 1000 + i
    const s = memStorage({ [PROMPT_BUCKET_INDEX_KEY]: JSON.stringify(idx) })
    const evicted = touchAndEvictBuckets(PROMPT_HISTORY_PREFIX, 'chat:prompt-history:x', {
      storage: s,
      now: 5000,
    })
    expect(evicted).toEqual([])
    expect(s.getItem('chat:draft:c0')).toBeNull() // draft 桶本来就不在存储假件的 init 里,只查索引没被动
    const after = parsePromptBucketIndex(s.getItem(PROMPT_BUCKET_INDEX_KEY))
    expect(Object.keys(after).filter((k) => k.startsWith('chat:draft'))).toHaveLength(60)
  })

  it('坏索引 ⇒ 不删任何东西并重建(touch 后索引只含当前桶)', () => {
    const s = memStorage({
      'chat:draft:old': 'X',
      [PROMPT_BUCKET_INDEX_KEY]: 'NOT-JSON{{',
    })
    const evicted = touchAndEvictBuckets(PROMPT_DRAFT_PREFIX, 'chat:draft:new', {
      storage: s,
      now: 7,
    })
    expect(evicted).toEqual([])
    expect(s.getItem('chat:draft:old')).toBe('X')
    expect(parsePromptBucketIndex(s.getItem(PROMPT_BUCKET_INDEX_KEY))).toEqual({
      'chat:draft:new': 7,
    })
  })

  it('存储抛错(隐私模式)⇒ 吞掉并返回空,绝不炸输入面', () => {
    const boom: BucketStorage = {
      getItem: () => {
        throw new Error('QuotaExceeded')
      },
      setItem: () => {
        throw new Error('QuotaExceeded')
      },
      removeItem: () => {},
    }
    expect(touchAndEvictBuckets(PROMPT_DRAFT_PREFIX, 'chat:draft:a', { storage: boom })).toEqual([])
  })
})
