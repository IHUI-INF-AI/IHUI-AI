// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话可达性判据本体(2026-11-01 立)。
 *
 * 这条出口被 `/api/context/memory` 的读与清两格消费。桩只给"表被问到就返回什么",
 * 不复算任何归属规则(§22c)—— 判据在 db/chat-conversation-access.ts 里只有一份。
 * 射程如实说明:本文件的桩在 `where` 处直接透传,**不校验谓词内容**,所以它判的是
 * "问哪张表、按什么顺序、什么时候不查";`status='accepted'` 那一格的谓词由 SQL 组合本身
 * 保证(drizzle eq),要判到它得连库跑,属集成档(AGENTS §5 测试隔离铁律禁连生产 PG,故不在这里做)。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chatConversationCollaborators, chatConversations } from '@ihui/database'

const { queries } = vi.hoisted(() => ({ queries: [] as string[] }))

function fakeChain(rowsFor: (table: unknown) => unknown[]) {
  const build = (table: unknown) => {
    const chain: Record<string, unknown> = {}
    chain.where = () => chain
    chain.limit = () => Promise.resolve(rowsFor(table))
    return chain
  }
  return {
    select: () => ({
      from: (table: unknown) => {
        queries.push(table === chatConversations ? 'conversations' : 'collaborators')
        return build(table)
      },
    }),
  }
}

const state = vi.hoisted(() => ({ owned: [] as unknown[], collab: [] as unknown[] }))

vi.mock('../src/db/index.js', () => ({
  dbRead: fakeChain((table) => (table === chatConversations ? state.owned : state.collab)),
}))

import { getConversationAccess } from '../src/db/chat-conversation-access.js'

const CONV = '11111111-1111-4111-8111-111111111111'
const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

describe('getConversationAccess', () => {
  beforeEach(() => {
    queries.length = 0
    state.owned = []
    state.collab = []
  })

  it('本人会话 ⇒ owner,且短路:协作表一次都不问', async () => {
    state.owned = [{ id: CONV }]
    await expect(getConversationAccess(CONV, ME)).resolves.toBe('owner')
    expect(queries).toEqual(['conversations'])
  })

  it('非属主但已接受协作 ⇒ collaborator(只认属主会砍断共享会话的笔记面板)', async () => {
    state.collab = [{ id: 'c1' }]
    await expect(getConversationAccess(CONV, ME)).resolves.toBe('collaborator')
    expect(queries).toEqual(['conversations', 'collaborators'])
  })

  it('两表都不命中 ⇒ null(调用方一律 404,不回 403)', async () => {
    await expect(getConversationAccess(CONV, ME)).resolves.toBeNull()
  })

  it.each([
    ['', ME],
    [CONV, ''],
    ['', ''],
  ])('空入参不查库:%s / %s ⇒ null 且零查询', async (conv, user) => {
    await expect(getConversationAccess(conv, user)).resolves.toBeNull()
    expect(queries).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
