// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-815954 回归:agent-runtime 会话 upsert 的 jsonb 写策略(离线,不连库:mock db 链)。
//
// 病灶:persistSession 的 onConflictDoUpdate 曾对 messages/metadata 做整列覆盖 ——
// metadata 整块覆盖会吃掉行内"显式清空"墓碑,并丢掉旧版回滚快照字段(新版 Reader 不再携带的键)。
//
// 修法(按票面上游形状,抄判据不抄实现):逐列声明写策略 ——
//  - messages:全量真相(内存 SessionManager 是转写唯一权威,显式清空即空数组整列落盘);
//  - metadata:具名成员合并 `sql`agent_runtime_sessions.metadata || <点名成员>::jsonb``:
//    · 只写本次点名的成员(undefined 归一为 null,与显式 null 一样落成行内墓碑,防止重启复活旧值);
//    · 行内未被点名的旧成员保留(缺席 = 不触碰)。
//
// 判据有牙:量的是 PgDialect 编译后的 SQL 面,不是源码文本 ——
// 把 metadata 改回整列覆盖(set 里放普通对象)⇒ 用例①必红;改回 excluded 整块 ⇒ 用例①的 not.toMatch 必红。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

vi.mock('../src/db/index.js', () => ({
  db: mockDb,
  dbRead: mockDb,
}))

import {
  persistSession,
  resetSessionStoreDbState,
} from '../src/services/agent-runtime/session-store.js'
import type { Session } from '../src/services/clawdbot/session-manager.js'

/** 捕获 insert 链上 .values() / .onConflictDoUpdate() 收到的参数 */
function insertChain() {
  const captured: { valuesArg?: unknown; conflictArg?: unknown } = {}
  const step: Record<string, unknown> = {}
  for (const m of ['values', 'onConflictDoUpdate', 'onConflictDoNothing', 'returning']) {
    step[m] = vi.fn((arg?: unknown) => {
      if (m === 'values') captured.valuesArg = arg
      else if (m === 'onConflictDoUpdate') captured.conflictArg = arg
      return step
    })
  }
  step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve([]).then(resolve, reject)
  return { step, captured }
}

function upsertSetOf(chain: ReturnType<typeof insertChain>): Record<string, unknown> {
  expect(chain.captured.conflictArg).toBeDefined()
  return (chain.captured.conflictArg as { set: Record<string, unknown> }).set
}

/** 把 upsert set 里的 metadata 片段编译成 SQL 文本 + 参数(量 SQL 面,不量源码) */
function compiledMetadata(set: Record<string, unknown>): { sql: string; payload: string } {
  const q = new PgDialect().sqlToQuery(set.metadata as SQL)
  expect(q.params).toHaveLength(1)
  expect(typeof q.params[0]).toBe('string')
  return { sql: q.sql, payload: q.params[0] as string }
}

/** 模拟 Postgres jsonb `||`:浅合并,右侧逐键覆盖(含 null),左侧独有键保留 */
function pgJsonbConcat(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  return { ...existing, ...incoming }
}

function makeSession(context?: Partial<Session['context']>): Session {
  return {
    id: 'sess_g815954',
    botId: 'default',
    userId: 'user_1',
    status: 'active',
    context: { botId: 'default', userId: 'user_1', messages: [], metadata: {}, ...context },
    createdAt: 1_700_000_000_000,
    lastActiveAt: 1_700_000_000_000,
  }
}

describe('G-815954:agent-runtime 会话 upsert 的 jsonb 逐列声明写策略', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSessionStoreDbState()
  })

  it('① metadata 必须是具名成员合并 SQL(行内列 || 点名成员::jsonb),禁整列覆盖/excluded', async () => {
    const msgs = [{ id: 'm1', role: 'user' as const, content: 'hi', timestamp: 1 }]
    const chain = insertChain()
    mockDb.insert.mockReturnValue(chain.step)
    await persistSession(makeSession({ metadata: { model: 'gpt-x' }, messages: msgs }))

    const set = upsertSetOf(chain)
    const { sql: rendered } = compiledMetadata(set)
    expect(rendered).toMatch(/"agent_runtime_sessions"\."metadata"\s*\|\|\s*\$\d+::jsonb/)
    // 整块 excluded 覆盖即红(票面重开触发条件)
    expect(rendered).not.toMatch(/excluded/)
    // messages 逐列声明为全量真相:原数组整列落盘(非 SQL/excluded)
    expect(set.messages).toBe(msgs)
    expect(set.status).toBe('active')
  })

  it('② 点名成员只含本次写入的键:未点名的行内旧成员不进参数(缺席=不触碰)', async () => {
    const chain = insertChain()
    mockDb.insert.mockReturnValue(chain.step)
    await persistSession(makeSession({ metadata: { model: 'gpt-x' } }))

    const { payload } = compiledMetadata(upsertSetOf(chain))
    expect(JSON.parse(payload)).toEqual({ model: 'gpt-x' })
    // 模拟合并:行内旧成员(含旧版回滚快照字段)在普通更新后仍存活
    const merged = pgJsonbConcat({ model: 'old', legacySnapshot: 'rollback-field' }, JSON.parse(payload))
    expect(merged).toEqual({ model: 'gpt-x', legacySnapshot: 'rollback-field' })
  })

  it('③ 显式清空(null)落成行内墓碑,不被合并吃掉', async () => {
    const chain = insertChain()
    mockDb.insert.mockReturnValue(chain.step)
    await persistSession(makeSession({ metadata: { model: null } }))

    const { payload } = compiledMetadata(upsertSetOf(chain))
    // JSON.stringify 不得丢弃 null 成员;墓碑必须写进参数
    expect(JSON.parse(payload)).toEqual({ model: null })
    const merged = pgJsonbConcat({ model: 'old', legacy: 'keep' }, JSON.parse(payload))
    expect(merged).toEqual({ model: null, legacy: 'keep' })
  })

  it('④ undefined 成员归一为 null(上游形状:undefined 与 null 都写成明确空值)', async () => {
    const chain = insertChain()
    mockDb.insert.mockReturnValue(chain.step)
    await persistSession(makeSession({ metadata: { cleared: undefined } }))

    const { payload } = compiledMetadata(upsertSetOf(chain))
    expect(JSON.parse(payload)).toEqual({ cleared: null })
  })

  it('⑤ 空 metadata({})= 零具名成员:行内既有内容分毫不动', async () => {
    const chain = insertChain()
    mockDb.insert.mockReturnValue(chain.step)
    await persistSession(makeSession({ metadata: {} }))

    const { payload } = compiledMetadata(upsertSetOf(chain))
    expect(JSON.parse(payload)).toEqual({})
    const merged = pgJsonbConcat({ model: 'old', legacy: 'keep' }, JSON.parse(payload))
    expect(merged).toEqual({ model: 'old', legacy: 'keep' })
  })

  it('⑥ 首次 insert(.values)路径不变:仍携带完整 metadata/messages(建行即全量真相)', async () => {
    const msgs = [{ id: 'm1', role: 'assistant' as const, content: 'yo', timestamp: 2 }]
    const chain = insertChain()
    mockDb.insert.mockReturnValue(chain.step)
    await persistSession(makeSession({ metadata: { model: 'gpt-x' }, messages: msgs }))

    const values = chain.captured.valuesArg as Record<string, unknown>
    expect(values.metadata).toEqual({ model: 'gpt-x' })
    expect(values.messages).toBe(msgs)
    expect(values.id).toBe('sess_g815954')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
