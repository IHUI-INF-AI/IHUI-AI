// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-155 圈子话题写操作归属(A 面契约)。
 * 旧写法只按 circle_dynamic.id 更新/删除,任意登录用户可改删他人话题;创建直接采信 body.memberId。
 * 本夹具钉住:他人 PUT/DELETE 403 且不落库、本人可改、伪造 body.memberId 被忽略(落库为服务端解析值)。
 * 隔离:mock auth / id-mapping / 敏感词 / db,不连库(AGENTS §5)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const ME = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const state = vi.hoisted(() => ({
  tokenUserId: '' as string,
  roleId: 0,
  legacyIds: {} as Record<string, number | null>,
  selectRows: [] as unknown[][],
  updateResult: [] as unknown[],
  insertResult: [] as unknown[],
  deleteResult: [] as unknown[],
  inserted: null as Record<string, unknown> | null,
  updatedSet: null as Record<string, unknown> | null,
}))

vi.mock('../../plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string; jwtPayload?: unknown }) => {
    request.userId = state.tokenUserId
    request.jwtPayload = { roleId: state.roleId }
  }),
}))

vi.mock('../../db/id-mapping-queries.js', () => ({
  getLegacyId: vi.fn(async (_legacyTable: string, newId: string) => state.legacyIds[newId] ?? null),
}))

vi.mock('../../db/sensitive-words-queries.js', () => ({
  sanitizeUgcInput: vi.fn(async (fields: Record<string, string>) => ({
    ok: true,
    fields: Object.fromEntries(
      Object.entries(fields).map(([key, text]) => [key, { ok: true, text, hits: [] }]),
    ),
    hits: [],
  })),
}))

vi.mock('../../db/index.js', () => {
  function createChain(result: unknown[]) {
    const chain: Record<string, any> = {
      then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(result).then(resolve),
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      returning: () => chain,
      onConflictDoNothing: () => chain,
      onConflictDoUpdate: () => chain,
      values: (value: Record<string, unknown>) => {
        state.inserted = value
        return chain
      },
      set: (value: Record<string, unknown>) => {
        state.updatedSet = value
        return chain
      },
    }
    return chain
  }
  return {
    db: {
      execute: vi.fn().mockResolvedValue([]),
      select: vi.fn(() => createChain(state.selectRows.shift() ?? [])),
      insert: vi.fn(() => createChain(state.insertResult)),
      update: vi.fn(() => createChain(state.updateResult)),
      delete: vi.fn(() => createChain(state.deleteResult)),
    },
  }
})

import { db } from '../../db/index.js'
import topicsRoutes from '../community/topics.js'

const TOPIC_URL = '/api/circles/topic'

function resetState(): void {
  state.roleId = 0
  state.legacyIds = {}
  state.selectRows = []
  state.updateResult = []
  state.insertResult = []
  state.deleteResult = []
  state.inserted = null
  state.updatedSet = null
  vi.clearAllMocks()
}

describe('F-155 /circles/topic 写操作归属', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(topicsRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    resetState()
  })

  it('他人 PUT 返回 403,且不执行 update', async () => {
    state.tokenUserId = OTHER
    state.legacyIds = { [ME]: 7, [OTHER]: 9 }
    state.selectRows = [[{ id: 1, memberId: 7, content: '原话题' }]]
    const res = await app.inject({
      method: 'PUT',
      url: `${TOPIC_URL}/1`,
      payload: { content: '越权修改' },
    })
    expect(res.statusCode).toBe(403)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('他人 DELETE 返回 403,且不执行 delete', async () => {
    state.tokenUserId = OTHER
    state.legacyIds = { [ME]: 7, [OTHER]: 9 }
    state.selectRows = [[{ id: 1, memberId: 7, content: '原话题' }]]
    const res = await app.inject({ method: 'DELETE', url: `${TOPIC_URL}/1` })
    expect(res.statusCode).toBe(403)
    expect(db.delete).not.toHaveBeenCalled()
  })

  it('管理员可修改,update 落库一次', async () => {
    // 2026-11-08 F-155 收口:circle_dynamic 写面已收紧为管理员专用(见 topics.ts 注释),
    // 普通用户即便本人也由 requireAdmin 先拒;管理员分支仍保留属主谓词。
    state.roleId = 1
    state.tokenUserId = ME
    state.legacyIds = { [ME]: 7 }
    state.selectRows = [[{ id: 1, memberId: 7, content: '原话题' }]]
    state.updateResult = [[{ id: 1, memberId: 7, content: '已修改' }]]
    const res = await app.inject({
      method: 'PUT',
      url: `${TOPIC_URL}/1`,
      payload: { content: '已修改' },
    })
    expect(res.statusCode).toBe(200)
    expect(db.update).toHaveBeenCalledTimes(1)
    expect(state.updatedSet?.content).toBe('已修改')
  })

  it('管理员创建时伪造 body.memberId 无效,落库为服务端解析的本人 memberId', async () => {
    state.roleId = 1 // F-155 写面已收紧为管理员,见上
    state.tokenUserId = ME
    state.legacyIds = { [ME]: 7 }
    state.insertResult = [{ id: 1, memberId: 7, content: '新话题' }]
    const res = await app.inject({
      method: 'POST',
      url: TOPIC_URL,
      payload: { content: '新话题', circleId: 3, memberId: 999 },
    })
    expect(res.statusCode).toBe(201)
    // 旧写法落库 999 ⇒ 此断言翻红
    expect(state.inserted?.memberId).toBe(7)
  })

  it('无会员映射的新账号 fail-close(403,不落库)', async () => {
    state.tokenUserId = ME
    const res = await app.inject({
      method: 'POST',
      url: TOPIC_URL,
      payload: { content: '新话题', circleId: 3, memberId: 999 },
    })
    expect(res.statusCode).toBe(403)
    expect(db.insert).not.toHaveBeenCalled()
  })
})
