// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票59(消息级版本切换 1/3)回归:regenerate 从物理删除改 sibling 分支(零库,mock 链)。
//
// 病灶:regenerateConversationMessages 曾物理 DELETE 目标 AI 消息及其之后全部行
// (createdAt >= target.createdAt)并 reset 投影 —— 旧回复被销毁,无版本可言。
//
// 修法(2026-10-07):不删任何行;开分支三步 —— root 判定(目标已是再生版本则回根)、
// root 标记(首次补 siblingIndex=0,幂等)、返回 nextSiblingIndex = 族内 max+1。
// 并发纪律(O82 同款):事务内先锁会话行 FOR UPDATE 再读 max,序号不撞号。
// 新回复以 (parentMessageId = rootId, siblingIndex = next) 经 createMessage 落库。
//
// 判据有牙:把实现改回 DELETE ⇒ 用例①当场炸(tx.delete 装了哨兵);丢会话行锁 ⇒ ②③的
// forUpdateCalls 断言必红;root 标记丢掉 ⇒ ②的 updateSets 断言必红;再生存生回根算错 ⇒ ③必红;
// 静态对账块守住 schema 两列 / 迁移文件 / journal 条目 / createMessage 放通缺一即红。
// 本机无 PostgreSQL 在跑(AGENTS §5b),真实库断言不可执行 —— 与
// chat-messages-insert-paths.test.ts 同款取静态对账口径。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: mockDb,
  dbRead: mockDb,
}))

import { regenerateConversationMessages } from '../src/db/chat-queries.js'

/** db.select 链(findMessageById 用):from/where/limit 后解析 rows */
function dbSelectChain(rows: unknown[]) {
  const step: Record<string, unknown> = {}
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset']) step[m] = vi.fn(() => step)
  step.then = (resolve2: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(rows).then(resolve2, reject)
  return step
}

/**
 * 事务级 mock:
 *  - select({maxIdx}) → [{maxIdx}](族内最大序号);select({count}) → [{count}];
 *    select({id})(会话行锁)→ [];
 *  - update().set(obj) 记录载荷;.for('update') 计数;
 *  - delete/insert 装哨兵:被调即抛 —— 旧物理删除实现当场炸,判据自带牙。
 */
function makeTx(maxIdx: number | null, count: number) {
  const state = { forUpdateCalls: 0, updateSets: [] as Record<string, unknown>[] }
  const selectChain = (rows: unknown[]) => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'groupBy'])
      step[m] = vi.fn(() => step)
    step.for = vi.fn(() => {
      state.forUpdateCalls += 1
      return Promise.resolve(rows)
    })
    step.then = (resolve2: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve2, reject)
    return step
  }
  const updateChain = () => {
    const step: Record<string, unknown> = {}
    step.set = vi.fn((obj: Record<string, unknown>) => {
      state.updateSets.push(obj)
      return step
    })
    for (const m of ['where', 'returning']) step[m] = vi.fn(() => step)
    step.then = (resolve2: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve([]).then(resolve2, reject)
    return step
  }
  const tx: Record<string, unknown> = {
    select: vi.fn((fields: Record<string, unknown>) => {
      if ('maxIdx' in fields) return selectChain([{ maxIdx }])
      if ('count' in fields) return selectChain([{ count }])
      return selectChain([])
    }),
    update: vi.fn(() => updateChain()),
    delete: vi.fn(() => {
      throw new Error('票59:regenerate 不得再物理删除')
    }),
    insert: vi.fn(() => {
      throw new Error('票59:regenerate 路径不应由本函数落新消息')
    }),
  }
  return { tx, state }
}

function targetRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mmmmmmmm-2222-4222-8222-222222222222',
    conversationId: 'cccccccc-1111-4111-8111-111111111111',
    role: 'assistant',
    content: '旧回复',
    parentMessageId: null,
    siblingIndex: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

describe('票59①:regenerate 不再物理删除(哨兵判据)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('全程零 DELETE、零 INSERT(tx 与 db 两级哨兵未被触发)', async () => {
    const target = targetRow()
    mockDb.select.mockReturnValue(dbSelectChain([target]))
    const { tx, state } = makeTx(0, 5)
    mockDb.transaction.mockImplementation((fn: (t: unknown) => Promise<unknown>) => fn(tx))

    const result = (await regenerateConversationMessages(target.conversationId, target.id)) as {
      regeneratedFrom: string
      remainingCount: number
      rootId: string
      nextSiblingIndex: number
    }
    expect(result.regeneratedFrom).toBe(target.id)
    expect(mockDb.delete).not.toHaveBeenCalled()
    expect(mockDb.insert).not.toHaveBeenCalled()
    expect(state.updateSets).toHaveLength(1) // 仅 root 标记一次写
  })
})

describe('票59①:开分支语义(root 判定 / root 标记 / next 序号 / 会话行锁)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('原始消息首次 regenerate:root=自身,补 siblingIndex=0,next=1', async () => {
    const target = targetRow({ parentMessageId: null, siblingIndex: null })
    mockDb.select.mockReturnValue(dbSelectChain([target]))
    const { tx, state } = makeTx(0, 7)
    mockDb.transaction.mockImplementation((fn: (t: unknown) => Promise<unknown>) => fn(tx))

    const result = (await regenerateConversationMessages(target.conversationId, target.id)) as {
      rootId: string
      nextSiblingIndex: number
      remainingCount: number
    }
    expect(result.rootId).toBe(target.id)
    expect(result.nextSiblingIndex).toBe(1)
    expect(result.remainingCount).toBe(7)
    expect(state.forUpdateCalls).toBe(1)
    expect(state.updateSets).toEqual([{ siblingIndex: 0 }])
  })

  it('目标已是再生版本:沿 parent 回根,next = 族内 max + 1,root 不重复标记', async () => {
    const rootId = 'rrrrrrrr-3333-4333-8333-333333333333'
    const target = targetRow({ parentMessageId: rootId, siblingIndex: 2 })
    mockDb.select.mockReturnValue(dbSelectChain([target]))
    const { tx, state } = makeTx(2, 9)
    mockDb.transaction.mockImplementation((fn: (t: unknown) => Promise<unknown>) => fn(tx))

    const result = (await regenerateConversationMessages(target.conversationId, target.id)) as {
      rootId: string
      nextSiblingIndex: number
    }
    expect(result.rootId).toBe(rootId)
    expect(result.nextSiblingIndex).toBe(3)
    expect(state.updateSets).toEqual([])
    expect(state.forUpdateCalls).toBe(1)
  })

  it('消息不存在或不属于该对话:拒绝开分支', async () => {
    mockDb.select.mockReturnValue(dbSelectChain([]))
    await expect(
      regenerateConversationMessages(
        'cccccccc-1111-4111-8111-111111111111',
        'nnnnnnnn-4444-4444-8444-444444444444',
      ),
    ).rejects.toThrow('消息不存在或不属于该对话')
  })
})

describe('票59①:静态对账(schema 两列 / 迁移 / journal / createMessage 放通)', () => {
  const HERE = dirname(fileURLToPath(import.meta.url))
  const QUERIES = resolve(HERE, '../src/db/chat-queries.ts')
  const SCHEMA = resolve(HERE, '../../../packages/database/src/schema/chat.ts')
  const MIGRATION = resolve(
    HERE,
    '../../../packages/database/drizzle/20261007221500_chat_messages_sibling_versions.sql',
  )
  const JOURNAL = resolve(HERE, '../../../packages/database/drizzle/meta/_journal.json')

  it('schema chat_messages 已声明 parentMessageId/siblingIndex 两列', () => {
    const src = readFileSync(SCHEMA, 'utf8')
    expect(src).toContain("uuid('parent_message_id')")
    expect(src).toContain("integer('sibling_index')")
  })

  it('迁移文件存在且为两条 nullable ADD COLUMN(无回填、无默认)', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    expect(sql).toContain('ALTER TABLE "chat_messages" ADD COLUMN "parent_message_id" uuid;')
    expect(sql).toContain('ALTER TABLE "chat_messages" ADD COLUMN "sibling_index" integer;')
    expect(sql).not.toContain('NOT NULL')
    expect(sql).not.toContain('UPDATE ')
  })

  it('journal 已登记该迁移条目(idx 顺延,不撞号)', () => {
    const journal = JSON.parse(readFileSync(JOURNAL, 'utf8')) as {
      entries: Array<{ idx: number; tag: string }>
    }
    const mine = journal.entries.find((e) => e.tag === '20261007221500_chat_messages_sibling_versions')
    expect(mine).toBeDefined()
    const maxIdx = Math.max(...journal.entries.map((e) => e.idx))
    expect(mine!.idx).toBe(maxIdx)
  })

  it('createMessage 已放通 parentMessageId/siblingIndex 透传(input 类型 + values 块)', () => {
    const src = readFileSync(QUERIES, 'utf8')
    const inputStart = src.indexOf('export interface CreateMessageInput')
    const inputBlock = src.slice(inputStart, src.indexOf('}', inputStart))
    expect(inputBlock).toContain('parentMessageId?: string')
    expect(inputBlock).toContain('siblingIndex?: number')
    expect(src).toContain('parentMessageId: input.parentMessageId,')
    expect(src).toContain('siblingIndex: input.siblingIndex,')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
