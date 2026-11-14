// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-538 回归锁(2026-11-13)。
 *
 * 病灶:relay-conversation-service 的 getOrCreateConversation / appendMessage 全仓无调用,
 * 导致 routes/relay-conversations 的列表恒空、PATCH/DELETE 恒 404。
 *
 * 本文件锁:
 *   ① relay 完成链路写入口调用后,GET /developer/conversations 非空且消息可读;
 *   ② 同一 logId 重试不重复落消息/累加统计(幂等键 = llm_call_logs.id + role);
 *   ③ 未登录访问会话 API 仍 401。
 *
 * 只 mock db(内存假实现)与 requireAuth,不触达真实 PG / Redis / 网络。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const fake = vi.hoisted(() => {
  type Row = Record<string, any>
  const state: { conversations: Row[]; messages: Row[] } = { conversations: [], messages: [] }
  let seq = 0

  const camel = (s: string) => s.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase())

  const rowsFor = (table: unknown): Row[] => {
    const name = (table as Record<symbol, unknown>)?.[Symbol.for('drizzle:Name')]
    return name === 'relay_messages' ? state.messages : state.conversations
  }

  const kindOf = (node: any): string | undefined => {
    let cls = Object.getPrototypeOf(node)?.constructor
    while (cls) {
      const kind = cls[Symbol.for('drizzle:entityKind')]
      if (typeof kind === 'string') return kind
      cls = Object.getPrototypeOf(cls)
    }
    return undefined
  }

  /** 从 drizzle SQL 的 queryChunks 抽取 (列名, 参数值) 对,只覆盖 eq/and 组合。 */
  const collectFilters = (condition: any): Array<[string, unknown]> => {
    const pairs: Array<[string, unknown]> = []
    let pending: string | null = null
    const walk = (node: any): void => {
      if (node === undefined || node === null) return
      if (typeof node === 'number' || typeof node === 'string' || typeof node === 'boolean') {
        if (pending) pairs.push([pending, node])
        pending = null
        return
      }
      if (typeof node !== 'object') return
      // drizzle 的列实例是 PgUUID/PgInteger 等子类,统一按「有 table + name」识别。
      if (typeof node.name === 'string' && node.table) {
        pending = node.name
        return
      }
      if (kindOf(node) === 'Param') {
        if (pending) pairs.push([pending, node.value])
        pending = null
        return
      }
      if (Array.isArray(node)) {
        node.forEach(walk)
        return
      }
      if (Array.isArray(node.queryChunks)) node.queryChunks.forEach(walk)
    }
    walk(condition)
    return pairs
  }

  const matches = (row: Row, condition: any): boolean =>
    collectFilters(condition).every(([col, value]) => row[camel(col)] === value)

  const makeSelect = (selected?: any) => {
    const q: any = {
      rows: [] as Row[],
      filter: undefined as any,
      limitN: undefined as number | undefined,
      offsetN: 0,
      from(table: unknown) {
        q.rows = rowsFor(table)
        return q
      },
      where(condition: any) {
        q.filter = condition
        return q
      },
      orderBy() {
        return q
      },
      limit(n: number) {
        q.limitN = n
        return q
      },
      offset(n: number) {
        q.offsetN = n
        return q
      },
      then(resolve: any, reject: any) {
        try {
          let rows = q.rows as Row[]
          if (q.filter) rows = rows.filter((row) => matches(row, q.filter))
          if (selected && typeof selected === 'object' && 'c' in selected) {
            return Promise.resolve([{ c: rows.length }]).then(resolve, reject)
          }
          rows = rows.slice(q.offsetN)
          if (q.limitN !== undefined) rows = rows.slice(0, q.limitN)
          return Promise.resolve(rows).then(resolve, reject)
        } catch (e) {
          return Promise.reject(e).then(resolve, reject)
        }
      },
    }
    return q
  }

  const makeInsert = (table: unknown) => ({
    values(values: Row | Row[]) {
      const list = Array.isArray(values) ? values : [values]
      return {
        returning() {
          const inserted = list.map((value) => {
            seq += 1
            const row: Row = {
              id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
              messageCount: 0,
              totalTokens: 0,
              totalCostCents: 0,
              createdAt: new Date(),
              lastMessageAt: new Date(),
              ...value,
            }
            rowsFor(table).push(row)
            return row
          })
          return Promise.resolve(inserted)
        },
      }
    },
  })

  const makeUpdate = (table: unknown) => ({
    set(values: Row) {
      return {
        where(condition: any) {
          for (const row of rowsFor(table)) {
            if (!matches(row, condition)) continue
            for (const [key, value] of Object.entries(values)) {
              if (value && typeof value === 'object' && Array.isArray((value as any).queryChunks)) {
                // 形如 message_count = message_count + 1 / + $1 的增量表达式
                const byParam = collectFilters(value).find(([col]) => camel(col) === key)?.[1]
                const inlineDelta = ((value as any).queryChunks as any[])
                  .map((c) =>
                    c?.constructor?.name === 'StringChunk'
                      ? /^\s*\+\s*(\d+)\s*$/.exec(String(c.value?.[0] ?? ''))?.[1]
                      : undefined,
                  )
                  .find((v) => v !== undefined)
                const delta = byParam ?? (inlineDelta !== undefined ? Number(inlineDelta) : 0)
                row[key] = Number(row[key] ?? 0) + Number(delta)
              } else {
                row[key] = value
              }
            }
          }
          return Promise.resolve([])
        },
      }
    },
  })

  const tx = {
    select: (selected?: any) => makeSelect(selected),
    insert: (table: unknown) => makeInsert(table),
    update: (table: unknown) => makeUpdate(table),
  }

  return {
    state,
    db: {
      select: (selected?: any) => makeSelect(selected),
      insert: (table: unknown) => makeInsert(table),
      update: (table: unknown) => makeUpdate(table),
      transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
    dbRead: { select: (selected?: any) => makeSelect(selected) },
    reset() {
      state.conversations.length = 0
      state.messages.length = 0
      seq = 0
    },
  }
})

vi.mock('../src/db/index.js', () => ({
  db: fake.db,
  dbRead: fake.dbRead,
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: async (request: any, reply: any) => {
    if (!request.headers.authorization) {
      return reply.status(401).send({ code: 401, message: '未登录', data: null })
    }
    request.userId = 'f538-user'
  },
}))

import relayConversationsRoutes from '../src/routes/relay-conversations.js'
import { recordRelayConversationTurn } from '../src/services/relay-conversation-service.js'

const USER_ID = 'f538-user'
const AUTH = { authorization: 'Bearer f538-token' }

const turn = {
  userId: USER_ID,
  apiKeyId: '00000000-0000-4000-8000-0000000000aa',
  model: 'gpt-4o-mini',
  promptText: '你好',
  responseText: '你好,有什么可以帮你?',
  logId: '00000000-0000-4000-8000-000000000001',
  promptTokens: 3,
  completionTokens: 8,
  totalTokens: 11,
  costCents: 2,
  latencyMs: 120,
}

describe('F-538 relay 会话历史写入口', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(relayConversationsRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    fake.reset()
  })

  it('① 写入口调用后会话列表非空,消息可读', async () => {
    await recordRelayConversationTurn(turn)

    const list = await app.inject({
      method: 'GET',
      url: '/api/developer/conversations',
      headers: AUTH,
    })
    expect(list.statusCode).toBe(200)
    const body = list.json()
    expect(body.data.total).toBe(1)
    expect(body.data.items).toHaveLength(1)
    expect(body.data.items[0].conversationId).toMatch(/^conv_[0-9a-f]{32}$/)
    expect(body.data.items[0].messageCount).toBe(2)

    const messages = await app.inject({
      method: 'GET',
      url: `/api/developer/conversations/${body.data.items[0].conversationId}/messages`,
      headers: AUTH,
    })
    expect(messages.statusCode).toBe(200)
    expect(messages.json().data.total).toBe(2)
  })

  it('② 同一 logId 重试不重复落库、不重复累加统计', async () => {
    await recordRelayConversationTurn(turn)
    await recordRelayConversationTurn(turn)

    expect(fake.state.conversations).toHaveLength(1)
    expect(fake.state.messages).toHaveLength(2)
    expect(fake.state.messages.filter((m) => m.role === 'assistant')).toHaveLength(1)
    // message_count 只累加一次 user + 一次 assistant
    expect(fake.state.conversations[0]?.messageCount).toBe(2)
  })

  it('③ 未登录访问会话 API 返回 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/developer/conversations' })
    expect(res.statusCode).toBe(401)
  })
})
