// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D20 会话置顶(G-11)零库回归测试(2026-09-26 立)。
 *
 * 覆盖三层判据(本机无 PostgreSQL 在跑,一律 mock,零 DB 副作用):
 * 1. **路由鉴权面**(PATCH /api/chat/conversations/:id 携带 pinned):
 *    未认证 401 / 会话不存在 404 / 非本人会话 403 / 参数类型错 400,
 *    且四类失败路径都必须**未发出 UPDATE 查询**(以 mock 化的 updateConversation
 *    与 db.update 链的调用计数为判据,不只断状态码 —— AGENTS §5 鉴权面条款)。
 * 2. **查询层排序判据**(真 chat-queries + 记录型 db mock):
 *    findConversationsByUser 的 orderBy 表达式序列必须以
 *    pinned DESC → pinned_at DESC 领头(置顶恒最前,先于 last_message_at),
 *    把"只写在 SQL 里的排序"变成可单测的结构断据。
 * 3. **置顶/取消的写入语义**(真 chat-queries.updateConversation):
 *    pinned=true 落 {pinned:true, pinnedAt: Date};pinned=false 落
 *    {pinned:false, pinnedAt:null}(可撤销);不含 pinned 的补丁不得触碰
 *    置顶两列(部分更新不连带改置顶态)。
 *
 * mock 风格与 src/routes/__tests__/conversation-archive.test.ts 同款:
 * config / @ihui/auth / jose / usercenter-queries / db/index.js 全 mock,
 * chat-queries 在路由用例里整模块 mock,在查询层用例里经
 * vi.importActual 取真实实现(其 ./index.js 依赖仍命中本文件的 db mock)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:8810/test',
    REDIS_URL: 'redis://localhost:8811',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

const { mockVerifyAccessToken, chatQueriesMocks, dbState } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  chatQueriesMocks: {
    createConversation: vi.fn(),
    findConversationsByUser: vi.fn(),
    findConversationById: vi.fn(),
    updateConversation: vi.fn(),
    deleteConversation: vi.fn(),
    deleteConversationsBatch: vi.fn(),
    favoriteConversationsBatch: vi.fn(),
    unfavoriteConversationsBatch: vi.fn(),
    setConversationsArchivedBatch: vi.fn(),
    findMessages: vi.fn(),
    createMessage: vi.fn(),
    findMessageById: vi.fn(),
    deleteMessage: vi.fn(),
    clearMessages: vi.fn(),
    favoriteConversation: vi.fn(),
    unfavoriteConversation: vi.fn(),
    rateChatMessage: vi.fn(),
    findFavoriteConversations: vi.fn(),
    archiveConversation: vi.fn(),
    unarchiveConversation: vi.fn(),
    findMessagesForExport: vi.fn(),
    findMessagesCursor: vi.fn(),
    encodeMessageCursor: vi.fn(),
    decodeMessageCursor: vi.fn(),
    findHistoryTurnPage: vi.fn(),
    encodeHistoryCursor: vi.fn(),
    decodeHistoryCursor: vi.fn(),
    findMessagesForShare: vi.fn(),
    saveCompressedContext: vi.fn(),
    setConversationShareToken: vi.fn(),
    findConversationByShareToken: vi.fn(),
    regenerateConversationMessages: vi.fn(),
    editMessageAndTruncateAfter: vi.fn(),
    branchConversationFrom: vi.fn(),
    replaceMessages: vi.fn(),
    updateConversationTitle: vi.fn(),
  },
  /** 记录型 db mock 的旁路状态:查询层用例据此断言 orderBy 序列与 set 载荷 */
  dbState: {
    selects: [] as Array<{ keys: string[]; order: string[] }>,
    sets: [] as Record<string, unknown>[],
    updateCount: 0,
  },
}))

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: mockVerifyAccessToken,
}))

vi.mock('jose', () => ({
  decodeJwt: vi.fn(() => ({ type: 'access' })),
}))

vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

// chat.ts 与真实 chat-queries 的导入面一一对应(缺导出 named import 为 undefined,
// 只有被调用才会炸;路由用例只走 PATCH/GET conversations,其余保持空 mock)。
vi.mock('../src/db/chat-queries.js', () => chatQueriesMocks)

vi.mock('../src/db/index.js', () => {
  const UPDATED_ROW: Record<string, unknown> = {
    id: 'cccccccc-3333-4333-8333-333333333333',
    userId: 'aaaaaaaa-1111-4111-8111-111111111111',
    title: '会话',
    model: 'gpt-4o',
    systemPrompt: null,
    metadata: null,
    lastMessageAt: null,
    lastReadAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    archivedAt: null,
    compressedAt: null,
    compressedContext: null,
    shareToken: null,
    pinned: false,
    pinnedAt: null,
    historyProjectionState: null,
  }
  type Rows = Record<string, unknown>[]

  interface SelectChain {
    from(_t: unknown): SelectChain
    where(_c: unknown): SelectChain
    orderBy(...cols: unknown[]): SelectChain
    limit(_n: number): SelectChain
    offset(_n: number): SelectChain
    groupBy(..._c: unknown[]): SelectChain
    then(
      onfulfilled: ((value: Rows) => unknown) | undefined,
      onrejected?: ((reason: unknown) => unknown) | undefined,
    ): Promise<unknown>
  }
  interface UpdateChain {
    set(obj: Record<string, unknown>): UpdateChain
    where(_c: unknown): UpdateChain
    returning(): UpdateChain
    then(
      onfulfilled: ((value: Rows) => unknown) | undefined,
      onrejected?: ((reason: unknown) => unknown) | undefined,
    ): Promise<unknown>
  }

  // drizzle SQL 对象没有可裸调的 toString/toQuery(toQuery 需驱动上下文),
  // 但其 queryChunks 递归里带着列元数据(name=SQL 列名,tableName=表名)与
  // ' DESC' 字符串块 —— 按此把排序表达式还原成 "table.column DESC" 供断言。
  const describeOrderTerm = (node: unknown, seen: Set<unknown> = new Set()): string => {
    if (node === null || node === undefined || seen.has(node)) return ''
    seen.add(node)
    if (typeof node === 'string') return node
    if (typeof node !== 'object') return ''
    const o = node as Record<string, unknown>
    // PgColumn 实例:name 是 SQL 列名(pinned / pinned_at / …);tableName 并非
    // 实例自有属性,拿得到就限定,拿不到只落列名(本查询内列名已互异)
    if (typeof o.name === 'string') {
      return typeof o.tableName === 'string' ? `${o.tableName}.${o.name}` : o.name
    }
    // StringChunk(如 ' desc' 运算符块):字符串装在自有 value 数组里
    if (Array.isArray(o.value)) {
      return o.value.filter((v): v is string => typeof v === 'string').join('')
    }
    if (typeof o.value === 'string') return o.value
    if (Array.isArray(o.queryChunks)) {
      return o.queryChunks
        .map((q) => describeOrderTerm(typeof q === 'function' ? (q as () => unknown)() : q, seen))
        .filter(Boolean)
        .join(' ')
    }
    return ''
  }

  const makeSelectChain = (
    capture: { keys: string[]; order: string[] } | null,
    resolveRows: () => Rows,
  ): SelectChain => {
    const self: SelectChain = {
      from: () => self,
      where: () => self,
      orderBy: (...cols) => {
        if (capture) capture.order.push(...cols.map((c) => describeOrderTerm(c)))
        return self
      },
      limit: () => self,
      offset: () => self,
      groupBy: () => self,
      then: (onf, onr) => Promise.resolve(resolveRows()).then(onf, onr),
    }
    return self
  }

  const makeUpdateChain = (setObj: Record<string, unknown> | null): UpdateChain => {
    const self: UpdateChain = {
      set: (obj) => {
        dbState.sets.push(obj)
        return makeUpdateChain(obj)
      },
      where: () => self,
      returning: () => self,
      then: (onf, onr) =>
        Promise.resolve([{ ...UPDATED_ROW, ...(setObj ?? {}) }] as Rows).then(onf, onr),
    }
    return self
  }

  const db = {
    select: (fields?: Record<string, unknown>) => {
      const capture = { keys: Object.keys(fields ?? {}), order: [] as string[] }
      dbState.selects.push(capture)
      const isCountQuery = capture.keys.length === 1 && capture.keys[0] === 'count'
      return makeSelectChain(capture, () => (isCountQuery ? [{ count: 0 }] : []))
    },
    insert: (_t: unknown) => ({
      values: (_v: unknown) => ({
        onConflictDoNothing: () => Promise.resolve([]),
        returning: () => Promise.resolve([]),
      }),
    }),
    update: (_t: unknown) => {
      dbState.updateCount += 1
      return makeUpdateChain(null)
    },
    delete: (_t: unknown) => makeSelectChain(null, () => []),
    execute: () => Promise.resolve([]),
    transaction: vi.fn(),
  }
  return { db, dbRead: db }
})

import { chatRoutes } from '../src/routes/chat.js'
import { findConversationById, updateConversation } from '../src/db/chat-queries.js'

const USER_A = 'aaaaaaaa-1111-4111-8111-111111111111'
const USER_B = 'bbbbbbbb-2222-4222-8222-222222222222'
const CONV_ID = 'cccccccc-3333-4333-8333-333333333333'
const AUTH_HEADERS = { authorization: 'Bearer mock-user-token' }

function mockAuth(userId: string = USER_A): void {
  mockVerifyAccessToken.mockResolvedValue({
    userId,
    phone: '13800000000',
    familyId: '11111111-1111-4111-8111-111111111111',
    roleId: 1,
  })
}

function mockNoAuth(): void {
  mockVerifyAccessToken.mockRejectedValue(
    Object.assign(new Error('Authentication required'), { statusCode: 401 }),
  )
}

function ownedConversation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: CONV_ID,
    userId: USER_A,
    title: '会话',
    model: 'gpt-4o',
    systemPrompt: null,
    metadata: null,
    lastMessageAt: null,
    lastReadAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    archivedAt: null,
    compressedAt: null,
    compressedContext: null,
    shareToken: null,
    pinned: false,
    pinnedAt: null,
    historyProjectionState: null,
    ...overrides,
  }
}

function resetDbState(): void {
  dbState.selects.length = 0
  dbState.sets.length = 0
  dbState.updateCount = 0
}

/**
 * 真实 chat-queries 中被本测试直接调用的两个函数的本地签名
 * (eslint 禁 import() 类型标注,故不写 typeof import('../src/db/chat-queries.js');
 * 若源签名变化,vi.importActual 后的调用会因参数形状不符而红,不会静默漂移)。
 */
interface RealChatQueriesFace {
  findConversationsByUser: (
    userId: string,
    opts: { page: number; pageSize: number; search?: string; includeArchived?: boolean },
  ) => Promise<{ list: unknown[]; total: number }>
  updateConversation: (
    id: string,
    data: {
      title?: string
      model?: string
      systemPrompt?: string
      metadata?: unknown
      pinned?: boolean
    },
  ) => Promise<unknown>
}

describe('PATCH /api/chat/conversations/:id — 置顶鉴权面(未发出 UPDATE 为硬判据)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(chatRoutes, { prefix: '/api/chat' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    resetDbState()
    mockAuth()
  })

  it('未认证 → 401,且 updateConversation 与 db.update 均未被调用', async () => {
    mockNoAuth()
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/chat/conversations/${CONV_ID}`,
      payload: { pinned: true },
    })
    expect(res.statusCode).toBe(401)
    expect(updateConversation).not.toHaveBeenCalled()
    expect(dbState.updateCount).toBe(0)
  })

  it('会话不存在 → 404,且未发出 UPDATE', async () => {
    vi.mocked(findConversationById).mockResolvedValue(undefined)
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/chat/conversations/${CONV_ID}`,
      headers: AUTH_HEADERS,
      payload: { pinned: true },
    })
    expect(res.statusCode).toBe(404)
    expect(updateConversation).not.toHaveBeenCalled()
    expect(dbState.updateCount).toBe(0)
  })

  it('别人的会话 → 403,且未发出 UPDATE(属主校验先于写入)', async () => {
    vi.mocked(findConversationById).mockResolvedValue(
      ownedConversation({ userId: USER_B }) as never,
    )
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/chat/conversations/${CONV_ID}`,
      headers: AUTH_HEADERS,
      payload: { pinned: true },
    })
    expect(res.statusCode).toBe(403)
    expect(updateConversation).not.toHaveBeenCalled()
    expect(dbState.updateCount).toBe(0)
  })

  it('pinned 非 boolean → 400,且未发出 UPDATE', async () => {
    vi.mocked(findConversationById).mockResolvedValue(ownedConversation() as never)
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/chat/conversations/${CONV_ID}`,
      headers: AUTH_HEADERS,
      payload: { pinned: 'yes' },
    })
    expect(res.statusCode).toBe(400)
    expect(updateConversation).not.toHaveBeenCalled()
    expect(dbState.updateCount).toBe(0)
  })

  it('本人置顶 → 200,updateConversation 收到 {pinned:true},响应回传 pinned', async () => {
    vi.mocked(findConversationById).mockResolvedValue(ownedConversation() as never)
    vi.mocked(updateConversation).mockResolvedValue(
      ownedConversation({ pinned: true, pinnedAt: new Date('2026-09-26T00:00:00.000Z') }) as never,
    )
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/chat/conversations/${CONV_ID}`,
      headers: AUTH_HEADERS,
      payload: { pinned: true },
    })
    expect(res.statusCode).toBe(200)
    expect(updateConversation).toHaveBeenCalledTimes(1)
    expect(updateConversation).toHaveBeenCalledWith(CONV_ID, { pinned: true })
    const body = res.json() as { data: { conversation: { pinned?: boolean } } }
    expect(body.data.conversation.pinned).toBe(true)
  })

  it('本人取消置顶 → 200,payload 透传 {pinned:false}(可撤销)', async () => {
    vi.mocked(findConversationById).mockResolvedValue(ownedConversation({ pinned: true }) as never)
    vi.mocked(updateConversation).mockResolvedValue(ownedConversation({ pinned: false }) as never)
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/chat/conversations/${CONV_ID}`,
      headers: AUTH_HEADERS,
      payload: { pinned: false },
    })
    expect(res.statusCode).toBe(200)
    expect(updateConversation).toHaveBeenCalledWith(CONV_ID, { pinned: false })
  })
})

describe('findConversationsByUser — 置顶优先排序(真 chat-queries,零 DB)', () => {
  beforeEach(() => {
    resetDbState()
  })

  it('orderBy 序列必须以 pinned DESC → pinned_at DESC 领头,后接 last_message_at / updated_at', async () => {
    const actual = await vi.importActual<RealChatQueriesFace>('../src/db/chat-queries.js')
    await actual.findConversationsByUser(USER_A, { page: 1, pageSize: 20 })

    // 主查询的 select 字段面含 pinned(区分于 count / 聚合子查询)
    const main = dbState.selects.find((s) => s.keys.includes('pinned'))
    expect(main, '未捕获到含 pinned 字段的主列表查询').toBeDefined()
    const order = main?.order ?? []
    expect(order).toHaveLength(4)
    // 第 1 位 = pinned 列(排除 pinned_at 命中):置顶恒最前,先于时间序
    expect(order[0]).toMatch(/pinned(?!_at)/)
    expect(order[0]?.toUpperCase()).toContain('DESC')
    // 第 2 位 = pinned_at:同为置顶项之间按置顶时间倒序
    expect(order[1]).toContain('pinned_at')
    expect(order[1]?.toUpperCase()).toContain('DESC')
    // 第 3/4 位 = 既有时间序,只在非置顶项之间生效(pinned_at 为 NULL 不影响)
    expect(order[2]).toContain('last_message_at')
    expect(order[3]).toContain('updated_at')
  })
})

describe('updateConversation — 置顶写入语义(真 chat-queries,零 DB)', () => {
  beforeEach(() => {
    resetDbState()
  })

  it('pinned=true → set 落 pinned:true 且 pinnedAt 为 Date;不连带触碰其它列', async () => {
    const actual = await vi.importActual<RealChatQueriesFace>('../src/db/chat-queries.js')
    await actual.updateConversation(CONV_ID, { pinned: true })
    expect(dbState.updateCount).toBe(1)
    expect(dbState.sets).toHaveLength(1)
    const set = dbState.sets[0] ?? {}
    expect(set.pinned).toBe(true)
    expect(set.pinnedAt).toBeInstanceOf(Date)
    expect(set.title).toBeUndefined()
    expect(set.model).toBeUndefined()
    expect(set.updatedAt).toBeInstanceOf(Date)
  })

  it('pinned=false → set 落 pinned:false 且 pinnedAt 置 null(撤销后不再占据最前)', async () => {
    const actual = await vi.importActual<RealChatQueriesFace>('../src/db/chat-queries.js')
    await actual.updateConversation(CONV_ID, { pinned: false })
    const set = dbState.sets[0] ?? {}
    expect(set.pinned).toBe(false)
    expect(set.pinnedAt).toBeNull()
  })

  it('只改标题的补丁不得写入 pinned/pinnedAt(部分更新不连带改置顶态)', async () => {
    const actual = await vi.importActual<RealChatQueriesFace>('../src/db/chat-queries.js')
    await actual.updateConversation(CONV_ID, { title: '新标题' })
    const set = dbState.sets[0] ?? {}
    expect(set.title).toBe('新标题')
    expect('pinned' in set).toBe(false)
    expect('pinnedAt' in set).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
