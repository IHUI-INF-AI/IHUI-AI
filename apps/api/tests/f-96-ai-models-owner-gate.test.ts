// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-96 回归锁(2026-11-13)。
 *
 * 缺陷:POST /api/ai/models 只做 authenticate,任意登录用户写入的行 enabled=true、
 *      ownerUuid=调用者,而 GET /api/ai/models 不带 owner 过滤且回传 baseUrl /
 *      modelIdForTest ⇒ 全站可读他人上游地址。
 *
 * 本文件锁:
 *   1) 普通用户创建的配置一律私有(ownerUuid=调用者),不会成为全局可见配置;
 *   2) 列表按 owner 收口:他人读不到、且任何非本人行都不回传 baseUrl / modelIdForTest;
 *      本人对自己配置仍保留完整字段;匿名只看到全局配置(owner_uuid IS NULL);
 *   3) 详情:他人私有配置统一 404(不泄露存在性),全局配置只回公共字段;
 *   4) 既有 PUT / DELETE 的 owner 限定不回归;
 *   5) 创建全局配置(owner_uuid=NULL)必须过管理员闸,普通用户 403 且不落库。
 *
 * 断言方式:mock 的 drizzle 谓词会真正对内存行求值,因此「过滤是否生效」由行为直接证明;
 * 管理员判据复用 plugins/require-permission 的 isSystemAdmin(本文件只验证接线)。
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

interface ModelRow {
  id: number
  name: string
  providerCode: string
  description: string | null
  apiFormat: string
  enabled: boolean
  sortOrder: number
  baseUrl: string
  modelIdForTest: string | null
  ownerUuid: string | null
  isBuiltin: boolean
  status: number
}

const state = vi.hoisted(() => ({
  viewerId: null as string | null,
  roleId: 0,
  rows: [] as unknown[],
  inserts: [] as unknown[],
}))

type Cond = { test: (row: Record<string, unknown>) => boolean }
const columnKey = (c: unknown): string =>
  c && typeof c === 'object' && 'key' in c ? String((c as { key: unknown }).key) : String(c)

// 谓词落地为内存求值,让 owner/enabled/isNull 过滤真实生效
vi.mock('drizzle-orm', () => ({
  eq: (column: unknown, value: unknown): Cond => ({
    test: (row) => row[columnKey(column)] === value,
  }),
  isNull: (column: unknown): Cond => ({
    test: (row) => row[columnKey(column)] === null || row[columnKey(column)] === undefined,
  }),
  or: (...conds: Cond[]): Cond => ({ test: (row) => conds.some((c) => c.test(row)) }),
  and: (...conds: Cond[]): Cond => ({ test: (row) => conds.every((c) => c.test(row)) }),
  asc: (column: unknown) => column,
  // 仅供投影占位:sql`CASE WHEN enabled ...` 在真实库算出 status,内存行自带 status
  sql: () => ({ key: 'status' }),
}))

// 鉴权直通:按 state.viewerId 注入身份;无身份时抛 401(公开读会 catch 后按匿名继续)
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: {
    userId?: string
    jwtPayload?: { userId?: string; roleId?: number }
  }) => {
    if (!state.viewerId) {
      const err = new Error('Authentication required') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    request.userId = state.viewerId
    request.jwtPayload = { userId: state.viewerId, roleId: state.roleId }
  },
}))

// 管理员判据:真实实现是 roleId >= ADMIN_ROLE_ID 的集中封装,这里只保留同一语义便于断言接线
vi.mock('../src/plugins/require-permission.js', () => ({
  isSystemAdmin: (request: { jwtPayload?: { roleId?: number } }) =>
    (request.jwtPayload?.roleId ?? 0) >= 1,
}))

vi.mock('@ihui/database', () => {
  const column = (key: string) => ({ key })
  return {
    aiModelConfig: {
      id: column('id'),
      name: column('name'),
      providerCode: column('providerCode'),
      description: column('description'),
      apiFormat: column('apiFormat'),
      enabled: column('enabled'),
      sortOrder: column('sortOrder'),
      baseUrl: column('baseUrl'),
      modelIdForTest: column('modelIdForTest'),
      ownerUuid: column('ownerUuid'),
      isBuiltin: column('isBuiltin'),
    },
  }
})

vi.mock('../src/db/index.js', () => {
  const rows = () => state.rows as ModelRow[]

  function project(projection: Record<string, unknown>, row: ModelRow): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [key, expr] of Object.entries(projection)) {
      const col = expr && typeof expr === 'object' && 'key' in expr ? String(expr.key) : key
      out[key] = (row as unknown as Record<string, unknown>)[col]
    }
    return out
  }

  return {
    db: {
      select: (projection: Record<string, unknown>) => {
        let cond: Cond | null = null
        const filtered = () =>
          rows()
            .filter((row) => !cond || cond.test(row as unknown as Record<string, unknown>))
            .map((row) => project(projection, row))
        const chain = {
          from: () => chain,
          where: (c: Cond) => {
            cond = c
            return chain
          },
          orderBy: async () => filtered(),
          limit: async () => filtered().slice(0, 1),
          then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
            Promise.resolve(filtered()).then(resolve, reject),
        }
        return chain
      },
      insert: () => ({
        values: (value: Record<string, unknown>) => {
          state.inserts.push(value)
          const row: ModelRow = {
            id: rows().length + 100,
            isBuiltin: false,
            status: value.enabled ? 1 : 0,
            ...(value as unknown as ModelRow),
          }
          rows().push(row)
          return { returning: async () => [row] }
        },
      }),
      update: () => ({
        set: (patch: Record<string, unknown>) => ({
          where: (c: Cond) => ({
            returning: async () => {
              const row = rows().find((r) => c.test(r as unknown as Record<string, unknown>))
              if (!row) return []
              Object.assign(row, patch)
              return [row]
            },
          }),
        }),
      }),
      delete: () => ({
        where: async (c: Cond) => {
          const kept = rows().filter((r) => !c.test(r as unknown as Record<string, unknown>))
          state.rows = kept
        },
      }),
    },
  }
})

import aiModelsRoutes from '../src/routes/user/ai-models-routes.js'
import { authenticate } from '../src/plugins/auth.js'

/** 复刻 routes/user/index.ts:插件级登录 preHandler 注入 request.userId。 */
let app: FastifyInstance
/** 不挂登录闸的裸插件实例:验证无身份时路由自身只回全局配置(纵深防御)。 */
let bareApp: FastifyInstance

beforeEach(async () => {
  if (!app) {
    app = Fastify({ logger: false })
    await app.register(
      async (scope) => {
        scope.addHook('preHandler', async (request) => {
          await authenticate(request)
        })
        await scope.register(aiModelsRoutes)
      },
      { prefix: '/api' },
    )
    await app.ready()
  }
  if (!bareApp) {
    bareApp = Fastify({ logger: false })
    await bareApp.register(aiModelsRoutes, { prefix: '/api' })
    await bareApp.ready()
  }
  state.viewerId = null
  state.roleId = 0
  state.inserts.length = 0
  state.rows = []
})

afterAll(async () => {
  await app?.close()
  await bareApp?.close()
})

function seed(overrides: Partial<ModelRow>): ModelRow {
  const row: ModelRow = {
    id: 1,
    name: 'global-model',
    providerCode: 'openai',
    description: null,
    apiFormat: 'openai_chat',
    enabled: true,
    sortOrder: 0,
    baseUrl: 'https://global.example/v1',
    modelIdForTest: 'gpt-4o-mini',
    ownerUuid: null,
    isBuiltin: true,
    status: 1,
    ...overrides,
  }
  ;(state.rows as ModelRow[]).push(row)
  return row
}

type ListBody = { code: number; data: { list: Array<Record<string, unknown>> } }
type DetailBody = { code: number; data?: { model?: Record<string, unknown> } }

describe('F-96 AI 模型配置 owner 闸', () => {
  it('① 普通用户 POST 落成私有配置:ownerUuid=调用者', async () => {
    state.viewerId = A
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/models',
      payload: {
        name: 'a-private',
        provider: 'openai',
        baseUrl: 'https://a.example/v1',
        status: 1,
      },
    })
    expect(res.statusCode).toBe(200)
    expect(state.inserts).toHaveLength(1)
    expect(state.inserts[0]).toMatchObject({ ownerUuid: A, name: 'a-private' })
    // 不是全局行:ownerUuid 绝不为 null
    expect((state.inserts[0] as { ownerUuid: unknown }).ownerUuid).not.toBeNull()
  })

  it('② A 建的配置 B 读不到,且列表不回传他人 baseUrl / modelIdForTest', async () => {
    seed({ id: 1, name: 'global-model' })
    seed({
      id: 11,
      name: 'a-private',
      ownerUuid: A,
      isBuiltin: false,
      baseUrl: 'https://a.example/v1',
      modelIdForTest: 'a-secret-model',
    })

    state.viewerId = B
    const res = await app.inject({ method: 'GET', url: '/api/ai/models' })
    expect(res.statusCode).toBe(200)
    const list = (res.json() as ListBody).data.list
    expect(list.map((m) => m.name)).toEqual(['global-model'])
    for (const item of list) {
      expect(item).not.toHaveProperty('baseUrl')
      expect(item).not.toHaveProperty('modelIdForTest')
      expect(item).not.toHaveProperty('ownerUuid')
    }
  })

  it('③ 本人 GET 保留自己配置的完整字段,全局行仍是公共字段', async () => {
    seed({ id: 1, name: 'global-model' })
    seed({
      id: 11,
      name: 'a-private',
      ownerUuid: A,
      isBuiltin: false,
      baseUrl: 'https://a.example/v1',
      modelIdForTest: 'a-secret-model',
    })

    state.viewerId = A
    const res = await app.inject({ method: 'GET', url: '/api/ai/models' })
    expect(res.statusCode).toBe(200)
    const list = (res.json() as ListBody).data.list
    const own = list.find((m) => m.name === 'a-private')
    const global = list.find((m) => m.name === 'global-model')
    expect(own).toMatchObject({
      id: 11,
      baseUrl: 'https://a.example/v1',
      modelIdForTest: 'a-secret-model',
    })
    expect(global).not.toHaveProperty('baseUrl')
    expect(global).not.toHaveProperty('modelIdForTest')
  })

  it('④ 无身份时路由自身只回全局配置(owner_uuid IS NULL)', async () => {
    seed({ id: 1, name: 'global-model' })
    seed({
      id: 11,
      name: 'a-private',
      ownerUuid: A,
      isBuiltin: false,
      baseUrl: 'https://a.example/v1',
    })

    const res = await bareApp.inject({ method: 'GET', url: '/api/ai/models' })
    expect(res.statusCode).toBe(200)
    expect((res.json() as ListBody).data.list.map((m) => m.name)).toEqual(['global-model'])
  })

  it('⑤ 详情:他人私有配置 404;本人 200 完整字段;全局只回公共字段', async () => {
    seed({ id: 1, name: 'global-model' })
    seed({
      id: 11,
      name: 'a-private',
      ownerUuid: A,
      isBuiltin: false,
      baseUrl: 'https://a.example/v1',
      modelIdForTest: 'a-secret-model',
    })

    state.viewerId = B
    const others = await app.inject({ method: 'GET', url: '/api/ai/models/11' })
    expect(others.statusCode).toBe(404)
    expect(others.json()).toEqual({ code: 404, message: '模型不存在' })

    state.viewerId = A
    const own = await app.inject({ method: 'GET', url: '/api/ai/models/11' })
    expect(own.statusCode).toBe(200)
    expect((own.json() as DetailBody).data!.model).toMatchObject({
      id: 11,
      baseUrl: 'https://a.example/v1',
      modelIdForTest: 'a-secret-model',
    })

    state.viewerId = B
    const global = await app.inject({ method: 'GET', url: '/api/ai/models/1' })
    expect(global.statusCode).toBe(200)
    expect((global.json() as DetailBody).data!.model).not.toHaveProperty('baseUrl')
    expect((global.json() as DetailBody).data!.model).not.toHaveProperty('modelIdForTest')
  })

  it('⑥ 本人 PUT / DELETE 不回归;他人 PUT / DELETE 仍 404 且不改数据', async () => {
    seed({ id: 1, name: 'global-model' })
    seed({ id: 11, name: 'a-private', ownerUuid: A, isBuiltin: false })
    seed({ id: 12, name: 'b-private', ownerUuid: B, isBuiltin: false })

    state.viewerId = B
    const crossPut = await app.inject({
      method: 'PUT',
      url: '/api/ai/models/11',
      payload: { name: 'hacked' },
    })
    expect(crossPut.statusCode).toBe(404)
    expect((state.rows as ModelRow[]).find((r) => r.id === 11)!.name).toBe('a-private')

    const ownPut = await app.inject({
      method: 'PUT',
      url: '/api/ai/models/12',
      payload: { name: 'b-renamed' },
    })
    expect(ownPut.statusCode).toBe(200)
    expect((state.rows as ModelRow[]).find((r) => r.id === 12)!.name).toBe('b-renamed')

    const crossDelete = await app.inject({ method: 'DELETE', url: '/api/ai/models/11' })
    expect(crossDelete.statusCode).toBe(404)
    expect((state.rows as ModelRow[]).some((r) => r.id === 11)).toBe(true)

    const ownDelete = await app.inject({ method: 'DELETE', url: '/api/ai/models/12' })
    expect(ownDelete.statusCode).toBe(200)
    expect((state.rows as ModelRow[]).some((r) => r.id === 12)).toBe(false)
  })

  it('⑦ 普通用户申请全局配置 → 403,且不落库', async () => {
    state.viewerId = A
    state.roleId = 0
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/models',
      payload: { name: 'evil-global', provider: 'openai', isGlobal: true },
    })
    expect(res.statusCode).toBe(403)
    expect(state.inserts).toHaveLength(0)
  })

  it('⑧ 管理员经同一闸可建全局配置(ownerUuid=null)', async () => {
    state.viewerId = A
    state.roleId = 1
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/models',
      payload: { name: 'admin-global', provider: 'openai', isGlobal: true },
    })
    expect(res.statusCode).toBe(200)
    expect(state.inserts[0]).toMatchObject({ ownerUuid: null, name: 'admin-global' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
