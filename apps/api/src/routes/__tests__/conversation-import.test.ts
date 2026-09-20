// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 外部会话导入路由测试(D28,2026-09-20 立)。
 *
 * 覆盖:
 * 1. 鉴权:未登录 POST /parse、POST /commit → 401
 * 2. POST /parse:无文件 400 / 成功 → 原样透传 ai-service 状态码与 JSON
 *    / ai-service 4xx 透传 / ai-service 不可达 502
 * 3. POST /commit:body 校验 400 / 成功 → 201 + 会话/消息落库(保留原始时间戳)
 *    + 批次记录 status=success / 时间戳缺省回退 / 消息写入失败 500 / 批次记录失败不阻塞 201
 * 4. GET /history:成功返回倒序列表
 *
 * db / 鉴权 / ai-service-fetch 均 mock,不连真实 PG 与 ai-service;
 * multipart 用真插件 + 手工 boundary 请求体(参照 p0-audit-gaps 模式)。
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'

// ─────────────────────────────────────────────────────────────
// Mock:鉴权层(authState.fail 控 401;路由 import 的是 authenticate)
// ─────────────────────────────────────────────────────────────
const authState = vi.hoisted(() => ({ fail: false, userId: 'user-1' }))

vi.mock('../../plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string }) => {
    if (authState.fail) {
      const e = new Error('未登录') as Error & { statusCode?: number }
      e.statusCode = 401
      throw e
    }
    request.userId = authState.userId
  },
}))

// ─────────────────────────────────────────────────────────────
// Mock:aiServiceFetch(记录转发调用,按测试预置响应/抛错)
// ─────────────────────────────────────────────────────────────
const fetchState = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; init: Record<string, unknown> }>,
  fail: false,
  status: 200,
  body: null as unknown,
  reset: () => {
    fetchState.calls.length = 0
    fetchState.fail = false
    fetchState.status = 200
    fetchState.body = null
  },
}))

vi.mock('../../utils/ai-service-fetch.js', () => ({
  aiServiceFetch: async (_request: unknown, path: string, init: Record<string, unknown> = {}) => {
    fetchState.calls.push({ path, init })
    if (fetchState.fail) {
      throw new Error('connect ECONNREFUSED')
    }
    return {
      status: fetchState.status,
      headers: { get: () => 'application/json; charset=utf-8' },
      text: async () => JSON.stringify(fetchState.body),
    }
  },
}))

// ─────────────────────────────────────────────────────────────
// Mock:@ihui/database(列名占位,供 drizzle 操作符引用)
// ─────────────────────────────────────────────────────────────
vi.mock('@ihui/database', () => ({
  chatConversations: {
    id: 'id',
    userId: 'user_id',
    title: 'title',
    model: 'model',
    metadata: 'metadata',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    lastMessageAt: 'last_message_at',
  },
  chatMessages: {
    id: 'id',
    conversationId: 'conversation_id',
    role: 'role',
    content: 'content',
    reasoning: 'reasoning',
    tokens: 'tokens',
    createdAt: 'created_at',
  },
  conversationImports: {
    id: 'id',
    ownerUuid: 'owner_uuid',
    source: 'source',
    conversationId: 'conversation_id',
    fileName: 'file_name',
    parsedCount: 'parsed_count',
    importedCount: 'imported_count',
    failedCount: 'failed_count',
    status: 'status',
    errorMessage: 'error_message',
    importedAt: 'imported_at',
  },
}))

// ─────────────────────────────────────────────────────────────
// Mock:db 层 — 链式 thenable builder,按队列消费预置结果。
// 插入链两种消费路径:
//   .returning() → 消费 insertQueue(会话插入)
//   直接 await   → 走 then,awaitIndex 计数(failAwaitIndex 控制第 N 次失败)
// commit 中插入顺序:returning(会话) → await#0(消息) → await#1(批次记录)
// ─────────────────────────────────────────────────────────────
const store = vi.hoisted(() => ({
  selectQueue: [] as Array<unknown[] | Error>,
  insertQueue: [] as unknown[][],
  insertValues: [] as unknown[],
  awaitIndex: 0,
  failAwaitIndex: -1,
  reset: () => {
    store.selectQueue.length = 0
    store.insertQueue.length = 0
    store.insertValues.length = 0
    store.awaitIndex = 0
    store.failAwaitIndex = -1
  },
  pushSelect: (r: unknown[] | Error) => store.selectQueue.push(r),
}))

vi.mock('../../db/index.js', () => {
  const makeSelect = () => {
    const b: Record<string, unknown> = {}
    b.from = () => b
    b.where = () => b
    b.orderBy = () => b
    b.limit = () => b
    b.offset = () => b
    b.then = (onF?: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
      const queued = store.selectQueue.shift() ?? []
      const p = queued instanceof Error ? Promise.reject(queued) : Promise.resolve(queued)
      return p.then(onF as (v: unknown) => unknown, onR as (e: unknown) => unknown)
    }
    return b
  }
  const makeInsert = () => {
    const c: Record<string, unknown> = {}
    c.values = (v: unknown) => {
      store.insertValues.push(v)
      return c
    }
    c.returning = () => {
      const queued = store.insertQueue.shift() ?? []
      return queued instanceof Error ? Promise.reject(queued) : Promise.resolve(queued)
    }
    c.onConflictDoNothing = () => c
    c.then = (onF?: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
      const idx = store.awaitIndex++
      const p =
        idx === store.failAwaitIndex ? Promise.reject(new Error('db down')) : Promise.resolve([])
      return p.then(onF as (v: unknown) => unknown, onR as (e: unknown) => unknown)
    }
    return c
  }
  const dbMock = {
    select: () => makeSelect(),
    insert: () => makeInsert(),
    transaction: async (fn: (tx: unknown) => unknown) => fn(dbMock),
  }
  return { db: dbMock, dbRead: dbMock }
})

import { conversationImportRoutes } from '../conversation-import.js'

// ─────────────────────────────────────────────────────────────
// 测试数据与工具
// ─────────────────────────────────────────────────────────────
const CONV_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function buildMultipart(parts: Array<{ name: string; filename?: string; content: string }>): {
  body: string
  boundary: string
} {
  const boundary = '----VitestFormBoundaryXYZ'
  const lines: string[] = []
  for (const p of parts) {
    lines.push(`--${boundary}`)
    if (p.filename) {
      lines.push(`Content-Disposition: form-data; name="${p.name}"; filename="${p.filename}"`)
      lines.push('Content-Type: application/json')
    } else {
      lines.push(`Content-Disposition: form-data; name="${p.name}"`)
    }
    lines.push('')
    lines.push(p.content)
  }
  lines.push(`--${boundary}--`)
  return { body: lines.join('\r\n'), boundary }
}

function makeCommitBody(overrides: Record<string, unknown> = {}) {
  return {
    source: 'claude_code',
    fileName: 'session.json',
    title: '我的 Claude 会话',
    model: 'claude-sonnet-4-5',
    createdAt: '2026-08-01T09:00:00.000Z',
    messages: [
      { role: 'user', content: '你好', createdAt: '2026-08-01T09:00:05.000Z' },
      { role: 'assistant', content: '你好!', createdAt: '2026-08-01T09:00:06.000Z', tokens: 12 },
    ],
    ...overrides,
  }
}

describe('外部会话导入路由(D28)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.setErrorHandler((err, _request, reply) => {
      const e = err as Error & { statusCode?: number }
      const statusCode = e.statusCode && e.statusCode >= 400 ? e.statusCode : 500
      reply.status(statusCode).send({ code: statusCode, message: e.message || '服务器错误' })
    })
    await app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024 } })
    await app.register(conversationImportRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    store.reset()
    fetchState.reset()
    authState.fail = false
    authState.userId = 'user-1'
  })

  // ───────────────────────────────────────────────────────────
  // 1. 鉴权
  // ───────────────────────────────────────────────────────────
  describe('鉴权', () => {
    it('未登录 POST /parse → 401', async () => {
      authState.fail = true
      const { body, boundary } = buildMultipart([
        { name: 'file', filename: 's.json', content: '{}' },
      ])
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/parse',
        payload: body,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          'content-length': String(Buffer.byteLength(body)),
        },
      })
      expect(res.statusCode).toBe(401)
    })

    it('未登录 POST /commit → 401', async () => {
      authState.fail = true
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/commit',
        payload: makeCommitBody(),
      })
      expect(res.statusCode).toBe(401)
    })
  })

  // ───────────────────────────────────────────────────────────
  // 2. POST /parse — 转发 ai-service
  // ───────────────────────────────────────────────────────────
  describe('POST /api/conversation-import/parse', () => {
    it('无文件仅字段 → 400', async () => {
      const { body, boundary } = buildMultipart([{ name: 'source', content: 'claude_code' }])
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/parse',
        payload: body,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          'content-length': String(Buffer.byteLength(body)),
        },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toBe('缺少上传的会话导出文件')
    })

    it('成功 → 原样透传 ai-service JSON;转发到 /api/session-import/parse 且不手动设 Content-Type', async () => {
      const parsedBody = {
        code: 0,
        message: 'success',
        data: { conversations: [{ title: 'A', messages: 3 }] },
      }
      fetchState.body = parsedBody
      const { body, boundary } = buildMultipart([
        { name: 'source', content: 'claude_code' },
        { name: 'file', filename: 'session.json', content: '{"conversations":[]}' },
      ])
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/parse',
        payload: body,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          'content-length': String(Buffer.byteLength(body)),
        },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual(parsedBody)
      expect(fetchState.calls).toHaveLength(1)
      expect(fetchState.calls[0]!.path).toBe('/api/session-import/parse')
      const init = fetchState.calls[0]!.init
      expect(init.method).toBe('POST')
      // 不手动设置 Content-Type(FormData 需 fetch 自动生成 boundary)
      expect(init.headers).toBeUndefined()
      const formData = init.body as FormData
      expect(formData).toBeInstanceOf(FormData)
      expect(formData.get('file')).toBeTruthy()
      expect(formData.get('source')).toBe('claude_code')
    })

    it('ai-service 4xx → 状态码与 body 原样透传', async () => {
      const errBody = { code: 422, message: '不支持的导出格式' }
      fetchState.status = 422
      fetchState.body = errBody
      const { body, boundary } = buildMultipart([
        { name: 'file', filename: 'session.json', content: '{}' },
      ])
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/parse',
        payload: body,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          'content-length': String(Buffer.byteLength(body)),
        },
      })
      expect(res.statusCode).toBe(422)
      expect(res.json()).toEqual(errBody)
    })

    it('ai-service 不可达 → 502', async () => {
      fetchState.fail = true
      const { body, boundary } = buildMultipart([
        { name: 'file', filename: 'session.json', content: '{}' },
      ])
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/parse',
        payload: body,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          'content-length': String(Buffer.byteLength(body)),
        },
      })
      expect(res.statusCode).toBe(502)
    })
  })

  // ───────────────────────────────────────────────────────────
  // 3. POST /commit — 落库
  // ───────────────────────────────────────────────────────────
  describe('POST /api/conversation-import/commit', () => {
    it('缺 source / 空 messages / 非法 source / 非法 role → 400', async () => {
      const noSource = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/commit',
        payload: makeCommitBody({ source: undefined }),
      })
      expect(noSource.statusCode).toBe(400)

      const noMessages = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/commit',
        payload: makeCommitBody({ messages: [] }),
      })
      expect(noMessages.statusCode).toBe(400)

      const badSource = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/commit',
        payload: makeCommitBody({ source: 'chatgpt' }),
      })
      expect(badSource.statusCode).toBe(400)

      const badRole = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/commit',
        payload: makeCommitBody({
          messages: [{ role: 'tool', content: 'x' }],
        }),
      })
      expect(badRole.statusCode).toBe(400)
      expect(store.insertValues).toHaveLength(0)
    })

    it('成功 → 201,会话/消息落库且保留原始时间戳,批次记录 status=success', async () => {
      store.insertQueue.push([{ id: CONV_ID }])
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/commit',
        payload: makeCommitBody(),
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.conversationId).toBe(CONV_ID)
      expect(body.data.importedMessages).toBe(2)
      expect(typeof body.data.importId).toBe('string')

      // 会话插入值(原始时间戳保留)
      const convValues = store.insertValues[0] as Record<string, unknown>
      expect(convValues.userId).toBe('user-1')
      expect(convValues.title).toBe('我的 Claude 会话')
      expect(convValues.model).toBe('claude-sonnet-4-5')
      expect((convValues.createdAt as Date).toISOString()).toBe('2026-08-01T09:00:00.000Z')
      expect((convValues.lastMessageAt as Date).toISOString()).toBe('2026-08-01T09:00:06.000Z')
      expect(convValues.metadata).toEqual({
        importedFrom: 'claude_code',
        importedVia: 'conversation-import',
        fileName: 'session.json',
      })

      // 消息插入值(逐条原始时间戳)
      const msgValues = store.insertValues[1] as Array<Record<string, unknown>>
      expect(msgValues).toHaveLength(2)
      expect(msgValues[0]!.conversationId).toBe(CONV_ID)
      expect(msgValues[0]!.role).toBe('user')
      expect(msgValues[0]!.content).toBe('你好')
      expect((msgValues[0]!.createdAt as Date).toISOString()).toBe('2026-08-01T09:00:05.000Z')
      expect(msgValues[1]!.tokens).toBe(12)
      expect((msgValues[1]!.createdAt as Date).toISOString()).toBe('2026-08-01T09:00:06.000Z')

      // 批次记录
      const historyValues = store.insertValues[2] as Record<string, unknown>
      expect(historyValues.source).toBe('claude_code')
      expect(historyValues.conversationId).toBe(CONV_ID)
      expect(historyValues.status).toBe('success')
      expect(historyValues.parsedCount).toBe(2)
      expect(historyValues.importedCount).toBe(2)
      expect(historyValues.ownerUuid).toBe('user-1')
    })

    it('时间戳缺省 → 回退导入时刻(Date 实例)', async () => {
      store.insertQueue.push([{ id: CONV_ID }])
      const before = new Date()
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/commit',
        payload: makeCommitBody({
          createdAt: undefined,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      })
      expect(res.statusCode).toBe(201)
      const after = new Date()
      const convValues = store.insertValues[0] as Record<string, unknown>
      expect(convValues.createdAt).toBeInstanceOf(Date)
      expect((convValues.createdAt as Date).getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect((convValues.createdAt as Date).getTime()).toBeLessThanOrEqual(after.getTime())
      const msgValues = store.insertValues[1] as Array<Record<string, unknown>>
      expect(msgValues[0]!.createdAt).toBeInstanceOf(Date)
    })

    it('消息写入失败 → 500(事务回滚,不写批次记录)', async () => {
      store.insertQueue.push([{ id: CONV_ID }])
      store.failAwaitIndex = 0 // await#0 = 消息插入
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/commit',
        payload: makeCommitBody(),
      })
      expect(res.statusCode).toBe(500)
      // values() 在 await 前已记录:会话 + 消息两次插入尝试均入列,
      // 事务抛错后第 3 次 insert(批次记录)绝不发生
      expect(store.insertValues).toHaveLength(2)
      expect(store.insertValues[1]).toBeInstanceOf(Array) // 消息为批量数组
    })

    it('批次记录写入失败 → 不阻塞交付,仍 201', async () => {
      store.insertQueue.push([{ id: CONV_ID }])
      store.failAwaitIndex = 1 // await#1 = 批次记录插入
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/commit',
        payload: makeCommitBody(),
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().data.conversationId).toBe(CONV_ID)
    })
  })

  // ───────────────────────────────────────────────────────────
  // 4. GET /history
  // ───────────────────────────────────────────────────────────
  describe('GET /api/conversation-import/history', () => {
    it('成功 → 倒序列表 + total', async () => {
      store.pushSelect([
        {
          id: 'imp-2',
          source: 'cursor',
          conversationId: CONV_ID,
          fileName: 'b.json',
          parsedCount: 5,
          importedCount: 5,
          failedCount: 0,
          status: 'success',
          errorMessage: null,
          importedAt: new Date('2026-09-20T10:00:00.000Z'),
        },
      ])
      const res = await app.inject({ method: 'GET', url: '/api/conversation-import/history' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.total).toBe(1)
      expect(body.data.list[0].id).toBe('imp-2')
      expect(body.data.list[0].importedAt).toBe('2026-09-20T10:00:00.000Z')
      expect(body.data.list[0].conversationId).toBe(CONV_ID)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
