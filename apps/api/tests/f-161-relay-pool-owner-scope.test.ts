// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-161 回归锁(2026-11-13)。
 *
 * 病灶:号池插件级 requireAdmin 只判「是不是管理员」,share/unshare/PUT/toggle/DELETE
 * 仅按主键定位 ⇒ 任一管理员可共享/停用/删除其他管理员的个人号。
 *
 * 本文件锁:
 *   ① 非属主管理员对他人个人行执行共享/取消共享/编辑/停用/删除 → 404;
 *   ② 越权请求不产生任何写入(update/delete 影响行数为 0);
 *   ③ 属主本人 → 正常放行;
 *   ④ 全局行(ownerUserId 为空)沿用既有口径仍可管理;
 *   ⑤ 所有按 id 写操作的 where 条件同时含主键与属主边界(本人 or is null)。
 *
 * 只 mock authenticate / db,用 Fastify inject,不触达真实 PG/Redis。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => {
  const state = {
    selectRows: [] as unknown[][],
    updateRows: [] as unknown[][],
    deleteRows: [] as unknown[][],
    selectWheres: [] as unknown[],
    updateWheres: [] as unknown[],
    deleteWheres: [] as unknown[],
    /** 真正命中的写影响('update' / 'delete');越权用例必须为空 */
    effects: [] as Array<'update' | 'delete'>,
  }

  const take = (queue: unknown[][]): unknown[] => (queue.length > 0 ? queue.shift()! : [])

  const selectChain = () => {
    const chain: Record<string, unknown> = {}
    chain.from = () => chain
    chain.where = (cond: unknown) => {
      state.selectWheres.push(cond)
      return chain
    }
    chain.limit = () => chain
    chain.orderBy = () => chain
    chain.offset = () => chain
    chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(take(state.selectRows)).then(resolve, reject)
    return chain
  }

  const updateChain = () => {
    const chain: Record<string, unknown> = {}
    const result = () => {
      const rows = take(state.updateRows)
      if (rows.length > 0) state.effects.push('update')
      return rows
    }
    chain.set = () => chain
    chain.where = (cond: unknown) => {
      state.updateWheres.push(cond)
      return chain
    }
    chain.returning = () => Promise.resolve(result())
    chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(result()).then(resolve, reject)
    return chain
  }

  const deleteChain = () => {
    const chain: Record<string, unknown> = {}
    const result = () => {
      const rows = take(state.deleteRows)
      if (rows.length > 0) state.effects.push('delete')
      return rows
    }
    chain.where = (cond: unknown) => {
      state.deleteWheres.push(cond)
      return chain
    }
    chain.returning = () => Promise.resolve(result())
    chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(result()).then(resolve, reject)
    return chain
  }

  return { state, selectChain, updateChain, deleteChain }
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(
    async (request: {
      headers: Record<string, unknown>
      userId?: string
      jwtPayload?: { userId?: string; roleId?: number }
    }) => {
      const auth = request.headers.authorization
      if (!auth) {
        const err = new Error('Authentication required') as Error & { statusCode: number }
        err.statusCode = 401
        throw err
      }
      const actor = request.headers['x-test-actor']
      request.userId = typeof actor === 'string' ? actor : undefined
      request.jwtPayload = { userId: request.userId, roleId: 1 }
    },
  ),
  requireActiveUser: vi.fn(async () => {}),
  checkAuth: vi.fn(async () => true),
  checkAuthOrInternalService: vi.fn(async () => true),
  hasHumanJwtCredential: vi.fn(() => true),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => h.selectChain()),
    insert: vi.fn(),
    update: vi.fn(() => h.updateChain()),
    delete: vi.fn(() => h.deleteChain()),
  },
  dbRead: { select: vi.fn(() => h.selectChain()) },
  dbClient: {},
}))

import relayAccountPoolRoutes from '../src/routes/admin/relay-account-pool.js'

const OWNER = 'f161-owner-a'
const OTHER = 'f161-owner-b'
const ID = 'f161-acct-1'
const AUTH = 'Bearer f161-admin-token'

/** 账号行最小骨架:providerCode=codex 无签到引擎,避免触发签到旁路网络。 */
function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ID,
    ownerUserId: OWNER,
    providerCode: 'codex',
    uid: 'f161-uid-1',
    name: 'f161-account',
    priority: 10,
    weight: 1,
    tempUnschedulable: false,
    proxyUrl: null,
    isEnabled: true,
    sharedToOps: false,
    credVersion: 1,
    ...overrides,
  }
}

function resetDb() {
  h.state.selectRows.length = 0
  h.state.updateRows.length = 0
  h.state.deleteRows.length = 0
  h.state.selectWheres.length = 0
  h.state.updateWheres.length = 0
  h.state.deleteWheres.length = 0
  h.state.effects.length = 0
}

/** 把 drizzle SQL 条件递归渲染成可读文本(只服务本文件的 where 断言)。 */
function renderSql(node: unknown): string {
  if (node === null || node === undefined) return ''
  if (typeof node !== 'object') return String(node)
  if (Array.isArray(node)) return node.map(renderSql).join('')
  const n = node as Record<string, unknown>
  const ctor = (n as { constructor?: { name?: string } }).constructor?.name
  if (ctor === 'StringChunk') return String(n.value)
  if (ctor === 'Param') return JSON.stringify(n.value)
  if (typeof n.columnType === 'string' && typeof n.name === 'string') return n.name
  if (Array.isArray(n.queryChunks)) return n.queryChunks.map(renderSql).join('')
  return ''
}

function headers(actor: string): Record<string, string> {
  return { authorization: AUTH, 'x-test-actor': actor }
}

/** 属主边界锁:条件必须同时含主键、本人分支与全局行分支。 */
function expectOwnerScoped(cond: unknown, actor: string) {
  const text = renderSql(cond)
  expect(text).toContain('id =')
  expect(text).toContain(`owner_user_id = "${actor}"`)
  expect(text).toContain('owner_user_id is null')
}

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  await app.register(relayAccountPoolRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  resetDb()
})

describe('F-161 ① 非属主管理员越权写:404 且不产生写入', () => {
  it('共享他人个人行(share)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/relay/accounts/${ID}/share`,
      headers: headers(OTHER),
    })
    expect(res.statusCode).toBe(404)
    expect(h.state.effects).toEqual([])
    expect(h.state.updateWheres).toHaveLength(0)
    expectOwnerScoped(h.state.selectWheres[0], OTHER)
  })

  it('取消他人个人行共享(unshare)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/relay/accounts/${ID}/unshare`,
      headers: headers(OTHER),
    })
    expect(res.statusCode).toBe(404)
    expect(h.state.effects).toEqual([])
    expect(h.state.updateWheres).toHaveLength(0)
    expectOwnerScoped(h.state.selectWheres[0], OTHER)
  })

  it('编辑他人个人行(PUT)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/relay/accounts/${ID}`,
      headers: headers(OTHER),
      payload: { name: 'hijacked-by-other-admin' },
    })
    expect(res.statusCode).toBe(404)
    expect(h.state.effects).toEqual([])
    expect(h.state.updateWheres).toHaveLength(0)
    expectOwnerScoped(h.state.selectWheres[0], OTHER)
  })

  it('停用/启用他人个人行(toggle)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/relay/accounts/${ID}/toggle`,
      headers: headers(OTHER),
    })
    expect(res.statusCode).toBe(404)
    expect(h.state.effects).toEqual([])
    expect(h.state.updateWheres).toHaveLength(0)
    expectOwnerScoped(h.state.selectWheres[0], OTHER)
  })

  it('删除他人个人行(DELETE):scoped DELETE 命中 0 行,未删除任何数据', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/admin/relay/accounts/${ID}`,
      headers: headers(OTHER),
    })
    expect(res.statusCode).toBe(404)
    expect(h.state.effects).toEqual([])
    expect(h.state.deleteWheres).toHaveLength(1)
    expectOwnerScoped(h.state.deleteWheres[0], OTHER)
  })
})

describe('F-161 ② 属主本人操作自己的个人行:正常放行', () => {
  it('共享自己的号(share)', async () => {
    h.state.selectRows.push([row({ sharedToOps: false })])
    h.state.updateRows.push([row({ sharedToOps: true, credVersion: 2 })])
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/relay/accounts/${ID}/share`,
      headers: headers(OWNER),
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { data: { sharedToOps: boolean } }).data.sharedToOps).toBe(true)
    expect(h.state.effects).toEqual(['update'])
    expectOwnerScoped(h.state.selectWheres[0], OWNER)
  })

  it('编辑自己的号(PUT)', async () => {
    h.state.selectRows.push([
      {
        name: 'old-name',
        priority: 10,
        weight: 1,
        tempUnschedulable: false,
        proxyUrl: null,
      },
    ])
    h.state.updateRows.push([{ id: ID }])
    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/relay/accounts/${ID}`,
      headers: headers(OWNER),
      payload: { name: 'new-name' },
    })
    expect(res.statusCode).toBe(200)
    expect(h.state.effects).toEqual(['update'])
    expectOwnerScoped(h.state.updateWheres[0], OWNER)
  })

  it('启用自己的号(toggle)', async () => {
    h.state.selectRows.push([row({ isEnabled: false })])
    h.state.updateRows.push([{ id: ID }])
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/relay/accounts/${ID}/toggle`,
      headers: headers(OWNER),
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { data: { isEnabled: boolean } }).data.isEnabled).toBe(true)
    expect(h.state.effects).toEqual(['update'])
    expectOwnerScoped(h.state.updateWheres[0], OWNER)
  })

  it('删除自己的号(DELETE)', async () => {
    h.state.deleteRows.push([row()])
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/admin/relay/accounts/${ID}`,
      headers: headers(OWNER),
    })
    expect(res.statusCode).toBe(200)
    expect(h.state.effects).toEqual(['delete'])
    expectOwnerScoped(h.state.deleteWheres[0], OWNER)
  })
})

describe('F-161 ③ 全局行(ownerUserId 为空)沿用既有口径:仍可管理', () => {
  it('任意管理员可共享全局行', async () => {
    h.state.selectRows.push([row({ ownerUserId: null, sharedToOps: false })])
    h.state.updateRows.push([row({ ownerUserId: null, sharedToOps: true, credVersion: 2 })])
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/relay/accounts/${ID}/share`,
      headers: headers(OTHER),
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { data: { sharedToOps: boolean } }).data.sharedToOps).toBe(true)
    expect(h.state.effects).toEqual(['update'])
    expectOwnerScoped(h.state.selectWheres[0], OTHER)
  })

  it('任意管理员可删除全局行', async () => {
    h.state.deleteRows.push([row({ ownerUserId: null })])
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/admin/relay/accounts/${ID}`,
      headers: headers(OTHER),
    })
    expect(res.statusCode).toBe(200)
    expect(h.state.effects).toEqual(['delete'])
    expectOwnerScoped(h.state.deleteWheres[0], OTHER)
  })
})
