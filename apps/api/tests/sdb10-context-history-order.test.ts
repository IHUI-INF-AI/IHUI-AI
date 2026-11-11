// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// SDB-10：历史按 createTime DESC 取回（新→旧），旧实现先逐行 push user/assistant，
// 再对展平后的数组整体 reverse，得到 [a旧,u旧,a新,u新]，回答排在提问之前。
// 这里用假 dbRead 返回真实倒序行，按索引断言「同一行的 user 先于 assistant」，
// 防止只翻数组、不修配对。
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as DrizzleOrm from 'drizzle-orm'

type Row = {
  content: string | null
  answer: string | null
  chatId: string | null
  tokens: number | null
}

const state = vi.hoisted(() => ({ rows: [] as Row[] }))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof DrizzleOrm>()
  return {
    ...actual,
    eq: (col: unknown, value: unknown) => ({ op: 'eq', col: String(col), value }),
    and: (...conds: unknown[]) => ({ op: 'and', conds }),
    desc: (col: unknown) => ({ op: 'desc', col: String(col) }),
  }
})

vi.mock('@ihui/database', () => ({
  zhsUserAgentContext: {
    userUuid: 'zhsUserAgentContext.userUuid',
    contextKey: 'zhsUserAgentContext.contextKey',
    sessionId: 'zhsUserAgentContext.sessionId',
    createTime: 'zhsUserAgentContext.createTime',
    content: 'zhsUserAgentContext.content',
    contextValue: 'zhsUserAgentContext.contextValue',
    tokens: 'zhsUserAgentContext.tokens',
  },
}))

vi.mock('../src/db/index.js', () => {
  const builder = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => Promise.resolve(state.rows),
  }
  return { db: {}, dbRead: { select: () => builder }, dbClient: {} }
})

import {
  getConversationHistory,
  type ChatMessage,
} from '../src/services/context-manager-service.js'

/** 构造一行历史；rows 由调用方按「新→旧」顺序给出，模拟 orderBy desc。 */
function row(
  content: string | null,
  answer: string | null,
  chatId = 'c',
  tokens = 0,
): Row {
  return { content, answer, chatId, tokens }
}

/** 取某条消息在数组里的下标，找不到即为 -1。 */
function indexOf(messages: ChatMessage[], role: ChatMessage['role'], content: string): number {
  return messages.findIndex((m) => m.role === role && m.content === content)
}

describe('SDB-10 上下文历史按轮次保持 user → assistant 时序', () => {
  beforeEach(() => {
    state.rows = []
  })

  it('两轮历史 ⇒ [u旧, a旧, u新, a新]', async () => {
    state.rows = [row('u新', 'a新'), row('u旧', 'a旧')]

    const messages = await getConversationHistory({ userUuid: 'u1' })

    expect(messages.map((m) => `${m.role}:${m.content}`)).toEqual([
      'user:u旧',
      'assistant:a旧',
      'user:u新',
      'assistant:a新',
    ])
  })

  it('每个 assistant 都排在其对应 user 之后（索引比较）', async () => {
    state.rows = [
      row('u3', 'a3'),
      row('u2', 'a2'),
      row('u1', 'a1'),
    ]

    const messages = await getConversationHistory({ userUuid: 'u1' })

    for (const n of ['1', '2', '3']) {
      const userIndex = indexOf(messages, 'user', `u${n}`)
      const answerIndex = indexOf(messages, 'assistant', `a${n}`)
      expect(userIndex).toBeGreaterThanOrEqual(0)
      expect(answerIndex).toBeGreaterThan(userIndex)
    }
    // 轮次本身仍按时间升序
    expect(indexOf(messages, 'user', 'u1')).toBeLessThan(indexOf(messages, 'user', 'u2'))
    expect(indexOf(messages, 'user', 'u2')).toBeLessThan(indexOf(messages, 'user', 'u3'))
  })

  it('只有 user 无 answer 的残行不破坏其他轮次配对', async () => {
    state.rows = [
      row('u新', 'a新'),
      row('u残', null),
      row('u旧', 'a旧'),
    ]

    const messages = await getConversationHistory({ userUuid: 'u1' })

    expect(messages.map((m) => `${m.role}:${m.content}`)).toEqual([
      'user:u旧',
      'assistant:a旧',
      'user:u残',
      'user:u新',
      'assistant:a新',
    ])
    expect(indexOf(messages, 'assistant', 'a旧')).toBeGreaterThan(indexOf(messages, 'user', 'u旧'))
    expect(indexOf(messages, 'assistant', 'a新')).toBeGreaterThan(indexOf(messages, 'user', 'u新'))
  })

  it('只有 answer 无 user 的残行不破坏其他轮次配对', async () => {
    state.rows = [
      row(null, 'a残'),
      row('u旧', 'a旧'),
    ]

    const messages = await getConversationHistory({ userUuid: 'u1' })

    expect(messages.map((m) => `${m.role}:${m.content}`)).toEqual([
      'user:u旧',
      'assistant:a旧',
      'assistant:a残',
    ])
    expect(indexOf(messages, 'assistant', 'a旧')).toBeGreaterThan(indexOf(messages, 'user', 'u旧'))
  })

  it('chatId / totalTokens 仍与所属行绑定', async () => {
    state.rows = [
      row('u新', 'a新', 'chat-new', 20),
      row('u旧', 'a旧', 'chat-old', 10),
    ]

    const messages = await getConversationHistory({ userUuid: 'u1' })

    expect(messages[0]).toMatchObject({ role: 'user', content: 'u旧', chatId: 'chat-old' })
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      content: 'a旧',
      chatId: 'chat-old',
      totalTokens: '10',
    })
    expect(messages[2]).toMatchObject({ role: 'user', content: 'u新', chatId: 'chat-new' })
    expect(messages[3]).toMatchObject({
      role: 'assistant',
      content: 'a新',
      chatId: 'chat-new',
      totalTokens: '20',
    })
  })

  it('单轮历史行为不变 ⇒ [u, a]', async () => {
    state.rows = [row('u单', 'a单')]

    await expect(getConversationHistory({ userUuid: 'u1' })).resolves.toMatchObject([
      { role: 'user', content: 'u单' },
      { role: 'assistant', content: 'a单' },
    ])
  })

  it('空历史行为不变 ⇒ []', async () => {
    await expect(getConversationHistory({ userUuid: 'u1' })).resolves.toEqual([])
  })
})
