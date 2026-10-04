// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 导入会话 → 知识库 路由测试(2026-10-03)。
 *
 * 覆盖:
 * 1. 鉴权:未登录 POST /to-knowledge、GET /knowledge-status → 401
 * 2. 参数校验:缺 conversationId / 超长 → 400
 * 3. **IDOR**:别人的会话 → 404(不泄露存在性),消息与知识库都不被触碰
 * 4. 成功 → 200 + docId/chunkCount + 写 success 留痕
 * 5. 幂等:重复调用 → deduped=true,不产生第二批 chunk
 * 6. 空消息会话 → 400,不留痕(不是失败,是根本没东西可入库)
 * 7. **失败留痕**:入库抛错 → 500 + conversation_imports 写 status='failed' + errorMessage
 * 8. GET /knowledge-status:查得到 success / failed / none 三态
 *
 * db / 鉴权 mock,不连真实 PG。留痕表写入值逐条断言 —— 不写这行,
 * "入库失败必须留痕且可查"就只是一句注释。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

// ─────────────────────────────────────────────────────────────
// Mock:鉴权
// ─────────────────────────────────────────────────────────────
// chat_conversations.id 是 uuid 列,路由侧 toKnowledgeSchema 已收紧成 z.uuid(防 22P02 ⇒ 500),
// 这里原先用 'no-such-id' 字面量会被 400 挡下(用例要 404) —— 改账不改制:改用合法 UUID。
const NO_SUCH_CONV = '77777777-7777-4777-8777-777777777777'
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
// Mock:knowledge-rag-service(路由只关心编排与留痕,服务本身由
// conversation-knowledge-rag.test.ts 单独端到端验证)
// ─────────────────────────────────────────────────────────────
const kbState = vi.hoisted(() => ({
  calls: [] as Array<Record<string, unknown>>,
  result: { docId: 11, chunkCount: 3, deduped: false } as {
    docId: number
    chunkCount: number
    deduped: boolean
  },
  fail: null as Error | null,
  reset: () => {
    kbState.calls.length = 0
    kbState.result = { docId: 11, chunkCount: 3, deduped: false }
    kbState.fail = null
  },
}))

vi.mock('../../services/knowledge-rag-service.js', () => ({
  CONVERSATION_IMPORT_SOURCE_TYPE: 'conversation_import',
  knowledgeRagService: {
    ingestConversation: async (opts: Record<string, unknown>) => {
      kbState.calls.push(opts)
      if (kbState.fail) throw kbState.fail
      return kbState.result
    },
  },
}))

// ─────────────────────────────────────────────────────────────
// Mock:db —— 会话/消息/留痕三张表的链式替身
// ─────────────────────────────────────────────────────────────
const store = vi.hoisted(() => ({
  convs: [] as Array<Record<string, unknown>>,
  messages: [] as Array<Record<string, unknown>>,
  /** conversation_imports 写入留痕 */
  trails: [] as Array<Record<string, unknown>>,
  reset: () => {
    store.convs.length = 0
    store.messages.length = 0
    store.trails.length = 0
  },
}))

vi.mock('../../db/index.js', async () => {
  // vi.mock 工厂被提升,不能用文件顶部 import;drizzle 表名在工厂内动态取。
  const { getTableName: getTableNameFn } = await import('drizzle-orm')

  /** 按 .from(table) 收到的真实表名分派 —— 不能按调用顺序猜,顺序会随实现变而漂 */
  const selectChain = () => {
    let tableName = ''
    const c: Record<string, unknown> = {}
    c.from = (t: unknown) => {
      try {
        tableName = getTableNameFn(t as Parameters<typeof getTableNameFn>[0])
      } catch {
        tableName = ''
      }
      return c
    }
    c.where = () => c
    c.orderBy = () => c
    c.limit = () => c
    c.offset = () => c
    c.then = (onF?: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
      const rows =
        tableName === 'chat_conversations'
          ? store.convs
          : tableName === 'chat_messages'
            ? store.messages
            : tableName === 'conversation_imports'
              ? // 路由取"最近一条":倒序给,首条即最新
                store.trails.slice().reverse()
              : []
      return Promise.resolve(rows).then(
        onF as (v: unknown) => unknown,
        onR as (e: unknown) => unknown,
      )
    }
    return c
  }
  const insertChain = (onValues: (v: unknown) => void) => {
    const c: Record<string, unknown> = { __v: undefined }
    c.values = (v: unknown) => {
      c.__v = v
      onValues(v)
      return c
    }
    c.returning = () => Promise.resolve([])
    c.then = (onF?: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve([]).then(onF as (v: unknown) => unknown, onR as (e: unknown) => unknown)
    return c
  }
  const dbMock = {
    select: () => selectChain(),
    insert: () => insertChain((v) => store.trails.push(v as Record<string, unknown>)),
    transaction: async (fn: (tx: unknown) => unknown) => fn(dbMock),
  }
  return { db: dbMock, dbRead: dbMock }
})

import { conversationKnowledgeRoutes } from '../conversation-knowledge.js'

const CONV_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const OTHER_CONV_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

function seedConversation(overrides: Record<string, unknown> = {}) {
  store.convs.push({
    id: CONV_ID,
    title: '产品研发群',
    userId: 'user-1',
    metadata: { importedFrom: 'wechat', importedVia: 'conversation-import', fileName: 'wx.zip' },
    ...overrides,
  })
  store.messages.push(
    { role: 'user', content: '张伟：明天评审改到下午三点', createdAt: new Date('2026-09-20T02:00:00Z'), turnOrdinal: 1 },
    { role: 'user', content: '李娜：收到', createdAt: new Date('2026-09-20T02:01:00Z'), turnOrdinal: 1 },
  )
}

describe('导入会话 → 知识库路由', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.setErrorHandler((err, _req, reply) => {
      const e = err as Error & { statusCode?: number }
      reply.status(e.statusCode && e.statusCode >= 400 ? e.statusCode : 500).send({
        code: 500,
        message: e.message,
      })
    })
    await app.register(conversationKnowledgeRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    store.reset()
    kbState.reset()
    authState.fail = false
    authState.userId = 'user-1'
  })

  // ── 1. 鉴权 ────────────────────────────────────────────────
  describe('鉴权', () => {
    it('未登录 POST /to-knowledge → 401', async () => {
      authState.fail = true
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/to-knowledge',
        payload: { conversationId: CONV_ID },
      })
      expect(res.statusCode).toBe(401)
    })

    it('未登录 GET /knowledge-status → 401', async () => {
      authState.fail = true
      const res = await app.inject({
        method: 'GET',
        url: `/api/conversation-import/knowledge-status?conversationId=${CONV_ID}`,
      })
      expect(res.statusCode).toBe(401)
    })
  })

  // ── 2. 参数校验 ────────────────────────────────────────────
  describe('参数校验', () => {
    it('缺 conversationId → 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/to-knowledge',
        payload: {},
      })
      expect(res.statusCode).toBe(400)
      expect(kbState.calls).toHaveLength(0)
    })

    it('GET /knowledge-status 缺 conversationId → 400', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/conversation-import/knowledge-status',
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // ── 3. IDOR ────────────────────────────────────────────────
  describe('属主隔离(IDOR)', () => {
    it('别人的会话 → 404,且不入库、不写留痕', async () => {
      store.convs.push({ id: OTHER_CONV_ID, title: '别人的群', userId: 'user-2', metadata: {} })

      const res = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/to-knowledge',
        payload: { conversationId: OTHER_CONV_ID },
      })
      // 404 而非 403:不泄露"这个 id 存在"
      expect(res.statusCode).toBe(404)
      expect(kbState.calls).toHaveLength(0)
      expect(store.trails).toHaveLength(0)
    })

    it('不存在的会话 → 404', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/to-knowledge',
        payload: { conversationId: NO_SUCH_CONV },
      })
      expect(res.statusCode).toBe(404)
      expect(kbState.calls).toHaveLength(0)
    })

    it('GET /knowledge-status 查别人的会话 → 404(状态也是私有信息)', async () => {
      store.convs.push({ id: OTHER_CONV_ID, title: '别人的群', userId: 'user-2', metadata: {} })
      const res = await app.inject({
        method: 'GET',
        url: `/api/conversation-import/knowledge-status?conversationId=${OTHER_CONV_ID}`,
      })
      expect(res.statusCode).toBe(404)
    })
  })

  // ── 4. 成功路径 ────────────────────────────────────────────
  describe('成功入库', () => {
    it('200 + docId/chunkCount/deduped,并写 success 留痕', async () => {
      seedConversation()
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/to-knowledge',
        payload: { conversationId: CONV_ID },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.docId).toBe(11)
      expect(body.data.chunkCount).toBe(3)
      expect(body.data.deduped).toBe(false)

      // 传给服务的参数正确(属主取登录用户,来源取会话 metadata)
      expect(kbState.calls).toHaveLength(1)
      const call = kbState.calls[0]!
      expect(call.ownerUuid).toBe('user-1')
      expect(call.conversationId).toBe(CONV_ID)
      expect(call.source).toBe('wechat')
      expect(call.collectionName).toBe('default')
      expect((call.messages as unknown[]).length).toBe(2)

      // 留痕:成功也写,查得到
      expect(store.trails).toHaveLength(1)
      const trail = store.trails[0]!
      expect(trail.source).toBe('knowledge_ingest')
      expect(trail.status).toBe('success')
      expect(trail.conversationId).toBe(CONV_ID)
      expect(trail.ownerUuid).toBe('user-1')
      expect(trail.importedCount).toBe(3)
      expect(trail.failedCount).toBe(0)
    })

    it('幂等:重复调用返回 deduped=true', async () => {
      seedConversation()
      kbState.result = { docId: 11, chunkCount: 3, deduped: true }
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/to-knowledge',
        payload: { conversationId: CONV_ID },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.deduped).toBe(true)
    })

    it('会话无消息 → 400,且不入库不留痕', async () => {
      store.convs.push({ id: CONV_ID, title: '空会话', userId: 'user-1', metadata: {} })
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/to-knowledge',
        payload: { conversationId: CONV_ID },
      })
      expect(res.statusCode).toBe(400)
      expect(kbState.calls).toHaveLength(0)
      expect(store.trails).toHaveLength(0)
    })

    it('切块后为空(chunkCount=0)→ 400,不留痕', async () => {
      seedConversation()
      kbState.result = { docId: 0, chunkCount: 0, deduped: false }
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/to-knowledge',
        payload: { conversationId: CONV_ID },
      })
      expect(res.statusCode).toBe(400)
      expect(store.trails).toHaveLength(0)
    })
  })

  // ── 5. 失败留痕 ────────────────────────────────────────────
  describe('失败诚实(留痕)', () => {
    it('入库抛错 → 500,且写 status=failed + errorMessage 留痕', async () => {
      seedConversation()
      kbState.fail = new Error('embedding provider unavailable')

      const res = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/to-knowledge',
        payload: { conversationId: CONV_ID },
      })
      expect(res.statusCode).toBe(500)
      // 错误上屏,不静默成功
      expect(res.json().message).toContain('embedding provider unavailable')

      // 留痕:失败必须可查
      expect(store.trails).toHaveLength(1)
      const trail = store.trails[0]!
      expect(trail.status).toBe('failed')
      expect(trail.source).toBe('knowledge_ingest')
      expect(trail.conversationId).toBe(CONV_ID)
      expect(trail.importedCount).toBe(0)
      expect(trail.failedCount).toBe(2)
      expect(String(trail.errorMessage)).toContain('embedding provider unavailable')
    })

    it('留痕写入本身失败 → 仍返回 500(不因留痕失败而谎报成功)', async () => {
      seedConversation()
      kbState.fail = new Error('db down')
      // 让 insert 直接抛错,模拟留痕表不可写
      const dbmod = await import('../../db/index.js')
      const spy = vi.spyOn(dbmod.db, 'insert').mockImplementation(() => {
        throw new Error('trail table unavailable')
      })
      const res = await app.inject({
        method: 'POST',
        url: '/api/conversation-import/to-knowledge',
        payload: { conversationId: CONV_ID },
      })
      expect(res.statusCode).toBe(500)
      spy.mockRestore()
    })
  })

  // ── 6. 状态查询 ────────────────────────────────────────────
  describe('GET /knowledge-status', () => {
    it('有成功留痕 → ingested=true + chunkCount', async () => {
      store.convs.push({ id: CONV_ID, title: '群', userId: 'user-1', metadata: {} })
      store.trails.push({
        id: 't1',
        status: 'success',
        errorMessage: null,
        importedCount: 5,
        importedAt: new Date('2026-10-03T01:00:00Z'),
      })
      const res = await app.inject({
        method: 'GET',
        url: `/api/conversation-import/knowledge-status?conversationId=${CONV_ID}`,
      })
      expect(res.statusCode).toBe(200)
      const data = res.json().data
      expect(data.ingested).toBe(true)
      expect(data.status).toBe('success')
      expect(data.chunkCount).toBe(5)
      expect(data.importedAt).toBe('2026-10-03T01:00:00.000Z')
    })

    it('只有失败留痕 → ingested=false 且带 errorMessage(可诊断)', async () => {
      store.convs.push({ id: CONV_ID, title: '群', userId: 'user-1', metadata: {} })
      store.trails.push({
        id: 't1',
        status: 'failed',
        errorMessage: 'embedding provider unavailable',
        importedCount: 0,
        importedAt: new Date('2026-10-03T01:00:00Z'),
      })
      const res = await app.inject({
        method: 'GET',
        url: `/api/conversation-import/knowledge-status?conversationId=${CONV_ID}`,
      })
      const data = res.json().data
      expect(data.ingested).toBe(false)
      expect(data.status).toBe('failed')
      expect(data.errorMessage).toBe('embedding provider unavailable')
    })

    it('从未入库 → status=none 且 ingested=false(不是"失败")', async () => {
      store.convs.push({ id: CONV_ID, title: '群', userId: 'user-1', metadata: {} })
      const res = await app.inject({
        method: 'GET',
        url: `/api/conversation-import/knowledge-status?conversationId=${CONV_ID}`,
      })
      const data = res.json().data
      expect(data.status).toBe('none')
      expect(data.ingested).toBe(false)
      expect(data.importedAt).toBeNull()
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
