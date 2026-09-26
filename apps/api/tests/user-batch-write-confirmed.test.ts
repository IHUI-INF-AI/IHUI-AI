// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 三处用户面批量写的「库确认条数」离线回归(2026-09-26 立,零真实 DB)。
 *
 * 缺陷形状(与本批 chat.ts batch / admin-sys role / admin-demand-square / admin registerCrud 同型):
 *   affected/deleted 由请求侧自算 ⇒ "传别人的 id 一行都没删"与"删成功"返回完全同形,
 *   UI 显示"已删除"而库里那条还在。
 * 修法:db 层回报命中集合(DELETE/UPDATE ... RETURNING { id }),路由侧一律经
 *   utils/batch-outcome.ts 的唯一出口 batchWriteOutcome(requested, confirmed) 推出
 *   deleted/restored 与 missedIds;既有响应键与 status code 逐字不变。
 *
 * 判据分工:
 *  - 用例 1/3/4:确认集 < 请求集 ⇒ 计数只算库确认的,未命中逐条点名("传别人 id"这一型的证明);
 *  - 用例 2:全命中 ⇒ missedIds 空数组 + 整包形态只多 missedIds 一个键(等价回归);
 *  - 用例 5:400/403/404 校验分支文案逐字锁死(防顺手改文案);
 *  - 用例 6:重复 id 不重复计(与出口的 dedupeIds 语义一致);
 *  - returning 调用断言:确认集必须由 RETURNING 回报(db 层改动有牙证明),
 *    摘掉 .returning 则 mockDbRows 拿不到东西、deleted 归 0 ⇒ 用例 1/3/4 红。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyError } from 'fastify'

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

const { mockDbRows, mockDbCalls, mockFindFileById, mockFindFileByIdIncludeTrashed, mockFindProjectById } =
  vi.hoisted(() => ({
    /** 每次链式 await 的解析值 = "库确认命中的行",由每个用例现设 */
    mockDbRows: vi.fn((): { id: string }[] => []),
    /** 记录链上每一步(entry=delete/update/select…,method=where/set/returning…),供 returning 断言 */
    mockDbCalls: [] as Array<{ entry: string; method: string }>,
    mockFindFileById: vi.fn(),
    mockFindFileByIdIncludeTrashed: vi.fn(),
    mockFindProjectById: vi.fn(),
  }))

vi.mock('../src/plugins/auth.js', () => ({
  // workspace.ts 的 requireAuth 走 authenticate,messageRoutes 的 preHandler 走 checkAuth;
  // 两者都只负责把 request.userId 落上(鉴权本身不是本票射程)。
  authenticate: vi.fn(async (request: FastifyRequest) => {
    request.userId = 'user-1'
    return { userId: 'user-1' }
  }),
  checkAuth: vi.fn(async (request: FastifyRequest) => {
    request.userId = 'user-1'
    return true
  }),
}))

/**
 * db 链式 mock:任何 db.<verb>(...) 之后的每步都返回同一 step,await 时解析为 mockDbRows()。
 * delete 与 update 的 .returning({ id }) 都必须经由这里被记录 —— 用例对 mockDbCalls 断言。
 */
vi.mock('../src/db/index.js', () => {
  const makeChain = (entry: string) => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'values', 'set', 'returning', 'orderBy', 'limit', 'offset']) {
      step[m] = vi.fn(() => {
        mockDbCalls.push({ entry, method: m })
        return step
      })
    }
    step.then = (resolve: (v: unknown) => void) => resolve(mockDbRows())
    return step
  }
  const db = {
    select: vi.fn(() => makeChain('select')),
    insert: vi.fn(() => makeChain('insert')),
    update: vi.fn(() => makeChain('update')),
    delete: vi.fn(() => makeChain('delete')),
    execute: vi.fn(async () => []),
    transaction: vi.fn(),
  }
  return { db, dbRead: { select: db.select } }
})

vi.mock('../src/db/message-queries.js', () => ({
  findAnnouncements: vi.fn(),
  findAnnouncementById: vi.fn(),
  createAnnouncement: vi.fn(),
  updateAnnouncement: vi.fn(),
  deleteAnnouncement: vi.fn(),
  findEduMessages: vi.fn(),
  findEduMessageById: vi.fn(),
  markEduMessageRead: vi.fn(),
  countUnreadEduMessages: vi.fn(),
}))

// workspace-queries 用**真实实现**(batchSoftDelete/batchRestore 正是本票改的 db 层):
// 它们对 mock db 链跑 UPDATE ... RETURNING,用例因此同时覆盖"db 层回报命中集"这一半。
// 只有校验环路的三个查询函数被替换(它们不是本票改动点)。
vi.mock('../src/db/workspace-queries.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/db/workspace-queries.js')>()
  return {
    ...actual,
    findFileById: mockFindFileById,
    findFileByIdIncludeTrashed: mockFindFileByIdIncludeTrashed,
    findProjectById: mockFindProjectById,
  }
})

import { messageRoutes } from '../src/routes/message.js'
import { workspaceRoutes } from '../src/routes/workspace.js'

const USER_ID = 'user-1'
const ID_1 = '11111111-1111-4111-8111-111111111111'
const ID_2 = '22222222-2222-4222-8222-222222222222'
const PROJECT_ID = '33333333-3333-4333-8333-333333333333'

function ownedFile(id: string) {
  return { id, projectId: PROJECT_ID }
}
function ownedProject() {
  return { id: PROJECT_ID, userId: USER_ID }
}

async function buildMessageApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  // 与生产装配同形的错误归一(参照 tests/message.test.ts):
  // schema 校验失败的 Fastify 原始错误体是 {statusCode, code:'FST_ERR_VALIDATION', ...},
  // 不经此 handler 会被路由 400 响应 schema 的 code:number 强转打崩成 500。
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    const statusCode =
      error.statusCode && error.statusCode >= 400 && error.statusCode < 600
        ? error.statusCode
        : 500
    reply.status(statusCode).send({
      code: statusCode,
      message: statusCode >= 500 ? '服务器错误' : error.message,
    })
  })
  await app.register(messageRoutes, { prefix: '/api' })
  await app.ready()
  return app
}

async function buildWorkspaceApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(workspaceRoutes, { prefix: '/api/workspace' })
  await app.ready()
  return app
}

beforeEach(() => {
  mockDbCalls.length = 0
  mockDbRows.mockReturnValue([])
  mockFindFileById.mockImplementation(async (id: string) => ownedFile(id))
  mockFindFileByIdIncludeTrashed.mockImplementation(async (id: string) => ownedFile(id))
  mockFindProjectById.mockImplementation(async () => ownedProject())
})

describe('message DELETE /messages/batch-delete:deleted 必须是库确认条数', () => {
  it('① 请求 2 个 id 而库只命中 1 ⇒ deleted=1 且 missedIds 点名另一个("传别人 id 仍显示已删除"这一型的证明)', async () => {
    mockDbRows.mockReturnValue([{ id: ID_1 }])
    const app = await buildMessageApp()
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/messages/batch-delete',
      payload: { ids: [ID_1, ID_2] },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.deleted).toBe(1)
    expect(body.data.missedIds).toEqual([ID_2])
    // db 层改动有牙证明:确认集来自 DELETE ... RETURNING,不是请求侧自算
    expect(mockDbCalls).toContainEqual({ entry: 'delete', method: 'returning' })
    await app.close()
  })

  it('② 全命中 ⇒ missedIds 为空数组,既有键逐字不变(整包形态只多 missedIds)', async () => {
    mockDbRows.mockReturnValue([{ id: ID_1 }, { id: ID_2 }])
    const app = await buildMessageApp()
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/messages/batch-delete',
      payload: { ids: [ID_1, ID_2] },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      code: 0,
      message: 'success',
      data: { deleted: 2, missedIds: [] },
    })
    await app.close()
  })

  it('②b 一个都没命中(全是别人的 id)⇒ deleted=0 且点名全部,仍回 200', async () => {
    mockDbRows.mockReturnValue([])
    const app = await buildMessageApp()
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/messages/batch-delete',
      payload: { ids: [ID_1, ID_2] },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.deleted).toBe(0)
    expect(body.data.missedIds).toEqual([ID_1, ID_2])
    await app.close()
  })

  it('⑥ 重复 id 不重复计账(出口去重:请求 [ID_1, ID_1] 命中 1 ⇒ deleted=1)', async () => {
    mockDbRows.mockReturnValue([{ id: ID_1 }])
    const app = await buildMessageApp()
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/messages/batch-delete',
      payload: { ids: [ID_1, ID_1] },
    })
    const body = res.json()
    expect(body.data.deleted).toBe(1)
    expect(body.data.missedIds).toEqual([])
    await app.close()
  })

  it('⑤(附)400 早退不触库:ids 空数组由 schema 拦下,db 一次都没被调用', async () => {
    const app = await buildMessageApp()
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/messages/batch-delete',
      payload: { ids: [] },
    })
    expect(res.statusCode).toBe(400)
    expect(mockDbCalls.filter((c) => c.entry === 'delete')).toHaveLength(0)
    await app.close()
  })
})

describe('workspace POST /files/batch-delete:deleted 必须是库确认条数', () => {
  it('③ 归属校验全过但 RETURNING 只回 1/2 ⇒ deleted=1 且 missedIds 点名另一个', async () => {
    mockDbRows.mockReturnValue([{ id: ID_1 }])
    const app = await buildWorkspaceApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/files/batch-delete',
      payload: { fileIds: [ID_1, ID_2] },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.deleted).toBe(1)
    expect(body.data.missedIds).toEqual([ID_2])
    // batchSoftDelete 的 UPDATE 链必须带 .returning({ id })(db 层回报命中集)
    expect(mockDbCalls).toContainEqual({ entry: 'update', method: 'returning' })
    await app.close()
  })

  it('⑤ 400 分支文案逐字不变:fileIds 空数组 ⇒ "至少选择一个文件"', async () => {
    const app = await buildWorkspaceApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/files/batch-delete',
      payload: { fileIds: [] },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ code: 400, message: '至少选择一个文件' })
    await app.close()
  })

  it('⑤ 404 分支文案逐字不变:查无此文件 ⇒ "文件 <id> 不存在或已删除"', async () => {
    mockFindFileById.mockResolvedValue(null)
    const app = await buildWorkspaceApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/files/batch-delete',
      payload: { fileIds: [ID_1] },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ code: 404, message: `文件 ${ID_1} 不存在或已删除` })
    expect(mockDbCalls.filter((c) => c.entry === 'update')).toHaveLength(0)
    await app.close()
  })

  it('⑤ 403 分支文案逐字不变:项目属主不符 ⇒ "无权操作部分文件"(不得改成点名式)', async () => {
    mockFindProjectById.mockResolvedValue({ id: PROJECT_ID, userId: 'someone-else' })
    const app = await buildWorkspaceApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/files/batch-delete',
      payload: { fileIds: [ID_1, ID_2] },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ code: 403, message: '无权操作部分文件' })
    expect(mockDbCalls.filter((c) => c.entry === 'update')).toHaveLength(0)
    await app.close()
  })
})

describe('workspace POST /files/batch-restore:restored 必须是库确认条数', () => {
  it('④ 同形:校验全过但 RETURNING 只回 1/2 ⇒ restored=1 且点名未命中', async () => {
    mockDbRows.mockReturnValue([{ id: ID_1 }])
    const app = await buildWorkspaceApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/files/batch-restore',
      payload: { fileIds: [ID_1, ID_2] },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.restored).toBe(1)
    expect(body.data.missedIds).toEqual([ID_2])
    expect(mockDbCalls).toContainEqual({ entry: 'update', method: 'returning' })
    await app.close()
  })

  it('④b 全命中 ⇒ restored 计满且 missedIds 为空(等价回归,键名 restored 不变)', async () => {
    mockDbRows.mockReturnValue([{ id: ID_1 }, { id: ID_2 }])
    const app = await buildWorkspaceApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/workspace/files/batch-restore',
      payload: { fileIds: [ID_1, ID_2] },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      code: 0,
      message: 'success',
      data: { restored: 2, missedIds: [] },
    })
    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
