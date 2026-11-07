// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 批次 3(2026-11-06):账本 store 写入单测。
 *
 * 只测不连库的写入口(mock db/index.js):
 *  - 合法 ledger ⇒ 走部分唯一索引的 onConflictDoUpdate(幂等锚点);
 *  - 非法 categories(缺类/未知名/重复) ⇒ 整笔不落,且不触碰 db;
 *  - 同 (conversation, message) 连续两次 ⇒ 两次都走冲突更新(不产生"先查后插"窗口);
 *  - db 抛错 ⇒ 返回 false 且不冒泡(流式链路不能因账本失败中断)。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMocks = vi.hoisted(() => {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
  const values = vi.fn((_row: unknown) => ({ onConflictDoUpdate }))
  const insert = vi.fn((_table: unknown) => ({ values }))
  return { insert, values, onConflictDoUpdate }
})

vi.mock('../../db/index.js', () => ({
  db: { insert: dbMocks.insert },
}))

import {
  isValidContextLedger,
  recordBudgetStop,
  recordCompactionBoundary,
  recordContextLedger,
} from '../chat-ledger-store.js'
import type { CompactBoundary, ContextLedger } from '@ihui/shared'

const USER = '11111111-1111-4111-8111-111111111111'
const CONV = '22222222-2222-4222-8222-222222222222'
const MSG = '33333333-3333-4333-8333-333333333333'

const CATEGORIES = [
  { category: 'system_prompt', tokens: 1200, percent: 12 },
  { category: 'system_tools', tokens: 300, percent: 3 },
  { category: 'skills', tokens: 200, percent: 2 },
  { category: 'messages', tokens: 2600, percent: 26 },
  { category: 'other', tokens: 200, percent: 2 },
  { category: 'free_space', tokens: 5500, percent: 55 },
  { category: 'auto_compact', tokens: 100, percent: 1 },
] as const

const LEDGER: ContextLedger = {
  model: 'gpt-4o-mini',
  contextLimit: 10_000,
  usedTokens: 4500,
  percentage: 45,
  categories: [...CATEGORIES],
  tokenizer: 'heuristic',
  compacted: false,
  capturedAt: '2026-11-06T10:00:00.000Z',
}

const BOUNDARY: CompactBoundary = {
  trigger: 'llm',
  tokensBefore: 8800,
  tokensAfter: 3200,
  messagesSummarized: 12,
  durationMs: 480,
  preservedSegment: {
    head: null,
    anchor: { index: 5, role: 'assistant', excerpt: '关键结论' },
    tail: { index: 17, role: 'user', excerpt: '最新问题' },
  },
  removedRange: { startIndex: 1, endIndex: 16 },
}

function makeLogger() {
  return { debug: vi.fn(), warn: vi.fn() }
}

describe('chat-ledger-store 写入', () => {
  beforeEach(() => {
    dbMocks.insert.mockClear()
    dbMocks.values.mockClear()
    dbMocks.onConflictDoUpdate.mockClear()
    dbMocks.values.mockImplementation((_row: unknown) => ({
      onConflictDoUpdate: dbMocks.onConflictDoUpdate,
    }))
    dbMocks.onConflictDoUpdate.mockResolvedValue(undefined)
    dbMocks.insert.mockImplementation(() => ({ values: dbMocks.values }))
  })

  it('合法 ledger 以 (conversation_id, message_id) 冲突更新写入', async () => {
    const log = makeLogger()
    const written = await recordContextLedger(
      { userId: USER, conversationId: CONV, messageId: MSG, ledger: LEDGER, turnIndex: 3 },
      log,
    )

    expect(written).toBe(true)
    expect(dbMocks.insert).toHaveBeenCalledTimes(1)
    expect(dbMocks.values).toHaveBeenCalledTimes(1)
    const row = dbMocks.values.mock.calls[0]![0] as Record<string, unknown>
    expect(row).toMatchObject({
      userId: USER,
      conversationId: CONV,
      messageId: MSG,
      turnIndex: 3,
      model: 'gpt-4o-mini',
      contextLimit: 10_000,
      usedTokens: 4500,
      percentage: '45.0',
      tokenizer: 'heuristic',
      compacted: false,
    })
    expect((row.categories as unknown[]).length).toBe(7)
    expect(dbMocks.onConflictDoUpdate).toHaveBeenCalledTimes(1)
    const conflict = dbMocks.onConflictDoUpdate.mock.calls[0]![0] as {
      target: unknown[]
      targetWhere: unknown
      set: Record<string, unknown>
    }
    expect(conflict.target).toHaveLength(2)
    // 部分唯一索引的谓词必须随 ON CONFLICT 一起下发,否则 PG 推断不到索引
    expect(conflict.targetWhere).toBeTruthy()
    expect(conflict.set.usedTokens).toBe(4500)
    expect(log.warn).not.toHaveBeenCalled()
  })

  it('非法 categories(缺一类)整笔拒绝,不触碰 db', async () => {
    const log = makeLogger()
    const written = await recordContextLedger(
      {
        userId: USER,
        conversationId: CONV,
        messageId: MSG,
        ledger: {
          ...LEDGER,
          categories: CATEGORIES.slice(0, 6) as unknown as ContextLedger['categories'],
        },
      },
      log,
    )
    expect(written).toBe(false)
    expect(dbMocks.insert).not.toHaveBeenCalled()
    expect(log.debug).toHaveBeenCalled()
  })

  it('非法 categories(未知名/重复)不通过契约校验', () => {
    const unknownCategories = [...CATEGORIES] as unknown as Array<{
      category: string
      tokens: number
      percent: number
    }>
    unknownCategories[0] = { category: 'prompt_cache', tokens: 1, percent: 0.1 }
    expect(
      isValidContextLedger({
        ...LEDGER,
        categories: unknownCategories as unknown as ContextLedger['categories'],
      }),
    ).toBe(false)

    const duplicated = [
      CATEGORIES[0],
      CATEGORIES[0],
      ...CATEGORIES.slice(2),
    ] as unknown as ContextLedger['categories']
    expect(isValidContextLedger({ ...LEDGER, categories: duplicated })).toBe(false)

    expect(isValidContextLedger({ ...LEDGER, contextLimit: 0 })).toBe(false)
    expect(isValidContextLedger(LEDGER)).toBe(true)
  })

  it('同 (conversation, message) 重发仍走冲突更新(幂等)', async () => {
    const log = makeLogger()
    await recordContextLedger(
      { userId: USER, conversationId: CONV, messageId: MSG, ledger: LEDGER },
      log,
    )
    await recordContextLedger(
      {
        userId: USER,
        conversationId: CONV,
        messageId: MSG,
        ledger: { ...LEDGER, usedTokens: 4600, percentage: 46 },
      },
      log,
    )
    expect(dbMocks.insert).toHaveBeenCalledTimes(2)
    expect(dbMocks.onConflictDoUpdate).toHaveBeenCalledTimes(2)
    const secondSet = dbMocks.onConflictDoUpdate.mock.calls[1]![0] as {
      set: Record<string, unknown>
    }
    expect(secondSet.set.usedTokens).toBe(4600)
  })

  it('message_id 为空时普通 insert(不参与部分唯一索引)', async () => {
    const log = makeLogger()
    const written = await recordContextLedger(
      { userId: USER, conversationId: CONV, messageId: null, ledger: LEDGER },
      log,
    )
    expect(written).toBe(true)
    expect(dbMocks.insert).toHaveBeenCalledTimes(1)
    expect(dbMocks.onConflictDoUpdate).not.toHaveBeenCalled()
  })

  it('db 抛错只返回 false + warn,不冒泡', async () => {
    dbMocks.insert.mockImplementationOnce(() => {
      throw new Error('db down')
    })
    const log = makeLogger()
    const written = await recordContextLedger(
      { userId: USER, conversationId: CONV, messageId: MSG, ledger: LEDGER },
      log,
    )
    expect(written).toBe(false)
    expect(log.warn).toHaveBeenCalled()
  })

  it('无会话坐标时不落库(不伪造 conversation_id)', async () => {
    const log = makeLogger()
    const written = await recordContextLedger(
      { userId: USER, conversationId: null, ledger: LEDGER },
      log,
    )
    expect(written).toBe(false)
    expect(dbMocks.insert).not.toHaveBeenCalled()
    expect(log.debug).toHaveBeenCalled()
  })

  it('budget stop: level=stopped + 合法 reasonCode 才落一行', async () => {
    const log = makeLogger()
    const written = await recordBudgetStop(
      {
        userId: USER,
        conversationId: CONV,
        messageId: MSG,
        level: 'stopped',
        reasonCode: 'daily_token_limit',
        scope: 'daily',
        usedTokens: 100,
        limitTokens: 100,
        usagePercent: 100,
        remainingTokens: 0,
      },
      log,
    )
    expect(written).toBe(true)
    const row = dbMocks.values.mock.calls[0]![0] as Record<string, unknown>
    expect(row).toMatchObject({
      level: 'stopped',
      reasonCode: 'daily_token_limit',
      scope: 'daily',
      usagePercent: '100.0',
      remainingTokens: 0,
      conversationId: CONV,
    })
    // 非 stopped / 未知原因码都不写
    expect(await recordBudgetStop({ ...BASE_STOP, level: 'warning' }, log)).toBe(false)
    expect(await recordBudgetStop({ ...BASE_STOP, reasonCode: 'custom_quota' }, log)).toBe(false)
    expect(dbMocks.insert).toHaveBeenCalledTimes(1)
  })

  it('compaction boundary 无会话坐标或非法形状不落库', async () => {
    const log = makeLogger()
    expect(
      await recordCompactionBoundary(
        { userId: USER, conversationId: null, boundary: BOUNDARY },
        log,
      ),
    ).toBe(false)
    expect(
      await recordCompactionBoundary(
        { userId: USER, conversationId: CONV, boundary: { ...BOUNDARY, trigger: '' } },
        log,
      ),
    ).toBe(false)
    expect(dbMocks.insert).not.toHaveBeenCalled()

    expect(
      await recordCompactionBoundary(
        { userId: USER, conversationId: CONV, messageId: 'msg_placeholder', boundary: BOUNDARY },
        log,
      ),
    ).toBe(true)
    const row = dbMocks.values.mock.calls[0]![0] as Record<string, unknown>
    expect(row).toMatchObject({
      conversationId: CONV,
      messageId: null, // 占位串非 UUID ⇒ null,不触发 PG 22P02
      trigger: 'llm',
      tokensBefore: 8800,
      tokensAfter: 3200,
      messagesSummarized: 12,
    })
  })
})

const BASE_STOP = {
  userId: USER,
  conversationId: CONV,
  messageId: MSG,
  level: 'stopped',
  reasonCode: 'daily_token_limit',
  scope: 'daily',
  usedTokens: 100,
  limitTokens: 100,
  usagePercent: 100,
  remainingTokens: 0,
} as const
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
