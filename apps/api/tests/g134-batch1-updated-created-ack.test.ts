// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 134 后续批①(承 ② 裁定 B):updated/created 布尔 ACK 存量清偿 9 处的针对性回归。
 *
 * 判据:响应里的 updated/created 必须是「库侧真确认」的派生值 ——
 *   - 直写链:UPDATE … RETURNING 命中行数(0 行 ⇒ false,1 行 ⇒ true);
 *   - 委托链:被委托函数返回的 RETURNING 命中结果(不抛错才可能 true)。
 * 本文件用假 DB / 假委托函数覆盖「0 行受影响」与「1 行受影响」两条分支,
 * 确保任何一处退回字面量 true 都会立刻红。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify'

const state = vi.hoisted(() => ({
  selectRows: [] as unknown[],
  updateRows: [] as unknown[],
  txRows: [] as unknown[],
}))

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  checkAuth: vi.fn(),
  updateUser: vi.fn(),
  findUserById: vi.fn(),
  createComment: vi.fn(),
  findTicketById: vi.fn(),
  updateVipLevel: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}))

vi.mock('../src/db/index.js', () => {
  function selectChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {
      from: () => chain,
      where: () => chain,
      offset: () => chain,
      limit: () => Promise.resolve(state.selectRows),
      orderBy: () => Promise.resolve(state.selectRows),
    }
    return chain
  }
  function updateChain(pick: () => unknown[]): Record<string, unknown> {
    const chain: Record<string, unknown> = {
      set: () => chain,
      where: () => chain,
      returning: () => Promise.resolve(pick()),
    }
    return chain
  }
  const tx = {
    select: vi.fn(() => selectChain()),
    update: vi.fn(() => updateChain(() => state.txRows)),
    insert: vi.fn(() => updateChain(() => state.txRows)),
  }
  const dbMock = {
    select: vi.fn(() => selectChain()),
    update: vi.fn(() => updateChain(() => state.updateRows)),
    insert: vi.fn(() => updateChain(() => state.updateRows)),
    delete: vi.fn(() => updateChain(() => state.updateRows)),
    transaction: async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
    execute: vi.fn().mockResolvedValue([]),
  }
  return { db: dbMock, dbRead: dbMock, dbClient: {} }
})

vi.mock('../src/plugins/auth.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, authenticate: mocks.authenticate, checkAuth: mocks.checkAuth }
})

vi.mock('../src/plugins/require-permission.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, requireAdmin: async () => {} }
})

vi.mock('../src/db/queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, findUserById: mocks.findUserById, updateUser: mocks.updateUser }
})

vi.mock('../src/db/customer-service-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    createComment: mocks.createComment,
    findTicketById: mocks.findTicketById,
  }
})

vi.mock('../src/db/vip-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, updateVipLevel: mocks.updateVipLevel }
})

vi.mock('../src/utils/password-crypto.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, hashPassword: mocks.hashPassword, verifyPassword: mocks.verifyPassword }
})

import { addressRoutes } from '../src/routes/other/address-routes.js'
import { notesRoutes } from '../src/routes/other/notes-routes.js'
import { userLlmConfigRoutes } from '../src/routes/user-llm-configs.js'
import { userLlmConfigV2Routes } from '../src/routes/user-llm-configs-v2.js'
import { miniappCompatRoutes } from '../src/routes/miniapp-compat-routes.js'
import { authExtendedRoutes } from '../src/routes/auth-extended.js'
import { customerServiceRoutes } from '../src/routes/admin-extended/customer-service-routes.js'
import { adminVipRoutes } from '../src/routes/vip.js'

const USER_ID = '00000000-0000-4000-8000-000000000134'
const NOTE_ID = '11111111-1111-4111-8111-111111111111'
const ADDRESS_ID = '22222222-2222-4222-8222-222222222222'
const TICKET_ID = '33333333-3333-4333-8333-333333333333'

/** 生产里的 other 组合根会挂 authenticate preHandler;这里只注册被测子路由并复刻该钩子。 */
const otherSubRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request) => {
    await mocks.authenticate(request)
  })
  await server.register(addressRoutes)
  await server.register(notesRoutes)
}

describe('守门 134 后续批① —— updated/created 由库侧真确认派生', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(otherSubRoutes, { prefix: '/api' })
    await app.register(userLlmConfigRoutes, { prefix: '/api/user' })
    await app.register(userLlmConfigV2Routes, { prefix: '/api/v2/user' })
    await app.register(miniappCompatRoutes, { prefix: '/api' })
    await app.register(authExtendedRoutes, { prefix: '/api' })
    await app.register(customerServiceRoutes, { prefix: '/api' })
    await app.register(adminVipRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    state.selectRows = []
    state.updateRows = []
    state.txRows = []
    mocks.authenticate.mockImplementation(async (request: { userId?: string }) => {
      request.userId = USER_ID
      return { userId: USER_ID, roleId: 99 }
    })
    mocks.checkAuth.mockImplementation(async (request: { userId?: string }) => {
      request.userId = USER_ID
      return true
    })
    mocks.updateUser.mockResolvedValue({ id: USER_ID })
    mocks.findUserById.mockResolvedValue({
      id: USER_ID,
      nickname: null,
      avatar: null,
      email: null,
      bio: null,
      gender: null,
      birthday: null,
    })
    mocks.findTicketById.mockResolvedValue({ id: TICKET_ID })
    mocks.hashPassword.mockResolvedValue('hashed-new')
    mocks.verifyPassword.mockResolvedValue(true)
  })

  // ① auth-extended.ts PUT /auth/profile(扩展字段直写 users 的 RETURNING)
  it('PUT /auth/profile:库侧 RETURNING 0 行 ⇒ updated=false', async () => {
    state.updateRows = []
    const res = await app.inject({
      method: 'PUT',
      url: '/api/auth/profile',
      payload: { avatar: '/uploads/a.png' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.updated).toBe(false)
  })

  it('PUT /auth/profile:库侧 RETURNING 1 行 ⇒ updated=true', async () => {
    state.updateRows = [{ id: USER_ID }]
    const res = await app.inject({
      method: 'PUT',
      url: '/api/auth/profile',
      payload: { avatar: '/uploads/a.png' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.updated).toBe(true)
  })

  // ② miniapp-compat-routes.ts POST /user/password
  it('POST /user/password:库侧 RETURNING 0 行 ⇒ updated=false', async () => {
    state.selectRows = [{ passwordHash: 'old-hash' }]
    state.updateRows = []
    const res = await app.inject({
      method: 'POST',
      url: '/api/user/password',
      payload: { oldPassword: 'old123', newPassword: 'new123' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.updated).toBe(false)
  })

  it('POST /user/password:库侧 RETURNING 1 行 ⇒ updated=true', async () => {
    state.selectRows = [{ passwordHash: 'old-hash' }]
    state.updateRows = [{ id: USER_ID }]
    const res = await app.inject({
      method: 'POST',
      url: '/api/user/password',
      payload: { oldPassword: 'old123', newPassword: 'new123' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.updated).toBe(true)
  })

  // ③ other/address-routes.ts POST /addresses/:id/default(事务内 UPDATE … RETURNING)
  it('POST /addresses/:id/default:事务 RETURNING 0 行 ⇒ updated=false', async () => {
    state.selectRows = [{ id: ADDRESS_ID, userId: USER_ID }]
    state.txRows = []
    const res = await app.inject({ method: 'POST', url: `/api/addresses/${ADDRESS_ID}/default` })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.updated).toBe(false)
  })

  it('POST /addresses/:id/default:事务 RETURNING 1 行 ⇒ updated=true', async () => {
    state.selectRows = [{ id: ADDRESS_ID, userId: USER_ID }]
    state.txRows = [{ id: ADDRESS_ID }]
    const res = await app.inject({ method: 'POST', url: `/api/addresses/${ADDRESS_ID}/default` })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.updated).toBe(true)
  })

  // ④ other/notes-routes.ts PUT /notes/:id
  it('PUT /notes/:id:库侧 RETURNING 0 行 ⇒ updated=false', async () => {
    state.selectRows = [{ id: NOTE_ID, userId: USER_ID }]
    state.updateRows = []
    const res = await app.inject({
      method: 'PUT',
      url: `/api/notes/${NOTE_ID}`,
      payload: { content: '新内容' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.updated).toBe(false)
  })

  it('PUT /notes/:id:库侧 RETURNING 1 行 ⇒ updated=true', async () => {
    state.selectRows = [{ id: NOTE_ID, userId: USER_ID }]
    state.updateRows = [{ id: NOTE_ID }]
    const res = await app.inject({
      method: 'PUT',
      url: `/api/notes/${NOTE_ID}`,
      payload: { content: '新内容' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.updated).toBe(true)
  })

  // ⑤ user-llm-configs-v2.ts PUT /llm-providers/:id
  it('PUT /llm-providers/:id:库侧 RETURNING 0 行 ⇒ updated=false', async () => {
    state.selectRows = [{ id: 1, ownerUuid: USER_ID }]
    state.updateRows = []
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v2/user/llm-providers/1',
      payload: { name: '新名称' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.updated).toBe(false)
  })

  it('PUT /llm-providers/:id:库侧 RETURNING 1 行 ⇒ updated=true', async () => {
    state.selectRows = [{ id: 1, ownerUuid: USER_ID }]
    state.updateRows = [{ id: 1 }]
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v2/user/llm-providers/1',
      payload: { name: '新名称' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.updated).toBe(true)
  })

  // ⑥ user-llm-configs.ts PUT /llm-configs/:id
  it('PUT /llm-configs/:id:库侧 RETURNING 0 行 ⇒ updated=false', async () => {
    state.selectRows = [{ id: 1, ownerUuid: USER_ID }]
    state.updateRows = []
    const res = await app.inject({
      method: 'PUT',
      url: '/api/user/llm-configs/1',
      payload: { name: '新名称' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.updated).toBe(false)
  })

  it('PUT /llm-configs/:id:库侧 RETURNING 1 行 ⇒ updated=true', async () => {
    state.selectRows = [{ id: 1, ownerUuid: USER_ID }]
    state.updateRows = [{ id: 1 }]
    const res = await app.inject({
      method: 'PUT',
      url: '/api/user/llm-configs/1',
      payload: { name: '新名称' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.updated).toBe(true)
  })

  // ⑦ admin-extended/customer-service-routes.ts POST /admin/customer-service/send
  it('POST /admin/customer-service/send:委托返回行无 id ⇒ created=false', async () => {
    mocks.createComment.mockResolvedValue({})
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/customer-service/send',
      payload: { ticketId: TICKET_ID, content: '回复内容' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.created).toBe(false)
  })

  it('POST /admin/customer-service/send:委托 INSERT … RETURNING 返回行 ⇒ created=true', async () => {
    mocks.createComment.mockResolvedValue({ id: 'comment-1' })
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/customer-service/send',
      payload: { ticketId: TICKET_ID, content: '回复内容' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.created).toBe(true)
  })

  // ⑧ vip.ts PUT /vip/levels/:id(委托 updateVipLevel 的命中集)
  it('PUT /vip/levels/:id:委托命中集为空 ⇒ updated=false', async () => {
    mocks.updateVipLevel.mockResolvedValue({ updated: false })
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/vip/levels/1',
      payload: { levelName: '新等级' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.updated).toBe(false)
  })

  it('PUT /vip/levels/:id:委托命中集有行 ⇒ updated=true', async () => {
    mocks.updateVipLevel.mockResolvedValue({ updated: true })
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/vip/levels/1',
      payload: { levelName: '新等级' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.updated).toBe(true)
  })
})
