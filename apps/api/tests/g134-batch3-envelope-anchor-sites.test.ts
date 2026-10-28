// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 134 B8(信封兜底假 ack)5 处站点改真的正/反回归。
 *
 * 病灶:写链零命中时 `success(row ?? { id, updated: true })` 把 `updated: true` 写死,
 * 零命中与真改一行返回同形,客户端拿不到真伪。
 * 改真:updated 一律由库侧 RETURNING(`rawUpdate` 返回的行本体 / `db.execute` 的 RETURNING 行)派生,
 * 命中一行 ⇒ true,零命中(或无写入字段)⇒ false,不再出现字面量 true 兜底。
 *
 * 覆盖站点:
 *   ① agent-extended.ts PUT /need-task/:id(有 rawById 404/403 前置)
 *   ② agent-extended.ts PUT /upload/:id(有 rawById 404/403 前置)
 *   ③ agent-extended.ts PUT /rule-params/:id(无前置)
 *   ④ misc-extended.ts  PUT /remote/:id(有 SELECT 404 前置)
 *   ⑤ system-extended.ts PUT /category-dictionary/:id(无前置,admin 端)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import type { FastifyRequest } from 'fastify'
import Fastify, { type FastifyInstance } from 'fastify'
import type { JWTPayload } from '@ihui/auth'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  requireActiveUser: vi.fn(),
  authenticate: vi.fn(),
  dbExecute: vi.fn(),
  dbSelect: vi.fn(),
  dbInsert: vi.fn(),
  dbUpdate: vi.fn(),
  dbDelete: vi.fn(),
  syncSettlement: vi.fn(),
  calcPermission: vi.fn(),
  getHistory: vi.fn(),
  genOrderNo: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mocks.authenticate,
  requireActiveUser: mocks.requireActiveUser,
  default: vi.fn(),
}))
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: mocks.requireAuth,
  requireAdmin: mocks.requireAdmin,
  requirePermission: vi.fn(() => mocks.requireAuth),
}))
vi.mock('../src/db/index.js', () => ({
  db: {
    execute: mocks.dbExecute,
    select: mocks.dbSelect,
    insert: mocks.dbInsert,
    update: mocks.dbUpdate,
    delete: mocks.dbDelete,
  },
}))
vi.mock('../src/services/settlement-service.js', () => ({
  syncAgentBuyToSettlement: mocks.syncSettlement,
}))
vi.mock('../src/services/agent-service.js', () => ({
  calculateAgentPermission: mocks.calcPermission,
}))
vi.mock('../src/services/context-manager-service.js', () => ({
  getConversationHistory: mocks.getHistory,
}))
vi.mock('../src/utils/crypto-random.js', () => ({
  generateOrderNumber: mocks.genOrderNo,
}))

import agentExtendedRoutes from '../src/routes/agent-extended.js'
import miscExtendedRoutes from '../src/routes/misc-extended.js'
import { adminCategoryDictionaryRoutes } from '../src/routes/system-extended.js'

const USER_ID = '00000000-0000-4000-8000-000000000134'
const REC_ID = '11111111-1111-4111-8111-111111111111'

function makePayload(userId: string): JWTPayload {
  return { userId, phone: '', familyId: '', roleId: 1 }
}

describe('守门 134 B8 —— 信封兜底站点改真:updated 由库侧 RETURNING 派生', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    // 前缀对齐生产挂载:agent-ext / misc-ext 命名空间 + admin 字典端
    await app.register(agentExtendedRoutes, { prefix: '/api/agent-ext' })
    await app.register(miscExtendedRoutes, { prefix: '/api/misc-ext' })
    await app.register(adminCategoryDictionaryRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockImplementation(async (req: FastifyRequest) => {
      req.userId = USER_ID
      req.jwtPayload = makePayload(USER_ID)
    })
    mocks.requireAdmin.mockImplementation(async () => undefined)
    mocks.requireActiveUser.mockResolvedValue(undefined)
    mocks.dbExecute.mockReset()
    mocks.dbExecute.mockResolvedValue([])
  })

  // ① agent-extended.ts PUT /need-task/:id
  describe('PUT /api/agent-ext/need-task/:id', () => {
    it('命中一行 ⇒ updated=true 且返回库侧行', async () => {
      mocks.dbExecute
        .mockResolvedValueOnce([{ id: REC_ID, user_id: USER_ID, title: '旧标题' }])
        .mockResolvedValueOnce([{ id: REC_ID, user_id: USER_ID, title: '新标题' }])
      const res = await app.inject({
        method: 'PUT',
        url: `/api/agent-ext/need-task/${REC_ID}`,
        payload: { title: '新标题' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.updated).toBe(true)
      expect(res.json().data.title).toBe('新标题')
    })

    it('前置存在但 UPDATE 零命中 ⇒ updated=false(不回真改同形)', async () => {
      mocks.dbExecute
        .mockResolvedValueOnce([{ id: REC_ID, user_id: USER_ID }])
        .mockResolvedValueOnce([])
      const res = await app.inject({
        method: 'PUT',
        url: `/api/agent-ext/need-task/${REC_ID}`,
        payload: { title: '新标题' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.updated).toBe(false)
      expect(res.json().data.id).toBe(REC_ID)
    })

    it('前置查询零命中 ⇒ 仍走既有 404 语义', async () => {
      mocks.dbExecute.mockResolvedValueOnce([])
      const res = await app.inject({
        method: 'PUT',
        url: `/api/agent-ext/need-task/${REC_ID}`,
        payload: { title: '新标题' },
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().data?.updated).toBeUndefined()
    })
  })

  // ② agent-extended.ts PUT /upload/:id
  describe('PUT /api/agent-ext/upload/:id', () => {
    it('命中一行 ⇒ updated=true 且返回库侧行', async () => {
      mocks.dbExecute
        .mockResolvedValueOnce([{ id: REC_ID, user_id: USER_ID, file_name: '旧.png' }])
        .mockResolvedValueOnce([{ id: REC_ID, user_id: USER_ID, file_name: '新.png' }])
      const res = await app.inject({
        method: 'PUT',
        url: `/api/agent-ext/upload/${REC_ID}`,
        payload: { file_name: '新.png' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.updated).toBe(true)
      expect(res.json().data.file_name).toBe('新.png')
    })

    it('前置存在但 UPDATE 零命中 ⇒ updated=false', async () => {
      mocks.dbExecute
        .mockResolvedValueOnce([{ id: REC_ID, user_id: USER_ID }])
        .mockResolvedValueOnce([])
      const res = await app.inject({
        method: 'PUT',
        url: `/api/agent-ext/upload/${REC_ID}`,
        payload: { file_name: '新.png' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.updated).toBe(false)
    })
  })

  // ③ agent-extended.ts PUT /rule-params/:id(无 404 前置)
  describe('PUT /api/agent-ext/rule-params/:id', () => {
    it('命中一行 ⇒ updated=true 且返回库侧行', async () => {
      mocks.dbExecute.mockResolvedValueOnce([{ id: REC_ID, param_value: 'v2' }])
      const res = await app.inject({
        method: 'PUT',
        url: `/api/agent-ext/rule-params/${REC_ID}`,
        payload: { param_value: 'v2' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.updated).toBe(true)
      expect(res.json().data.param_value).toBe('v2')
    })

    it('UPDATE 零命中 ⇒ updated=false(不写死 true)', async () => {
      mocks.dbExecute.mockResolvedValueOnce([])
      const res = await app.inject({
        method: 'PUT',
        url: `/api/agent-ext/rule-params/${REC_ID}`,
        payload: { param_value: 'v2' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.updated).toBe(false)
      expect(res.json().data.id).toBe(REC_ID)
    })
  })

  // ④ misc-extended.ts PUT /remote/:id(有 SELECT 404 前置)
  describe('PUT /api/misc-ext/remote/:id', () => {
    it('命中一行 ⇒ updated=true 且返回库侧行', async () => {
      mocks.dbExecute
        .mockResolvedValueOnce([
          { id: REC_ID, key: 'r1', value: '{"url":"https://old.example.com"}', description: null },
        ])
        .mockResolvedValueOnce([
          { id: REC_ID, key: 'r1', value: '{"url":"https://new.example.com"}', description: null },
        ])
      const res = await app.inject({
        method: 'PUT',
        url: `/api/misc-ext/remote/${REC_ID}`,
        payload: { url: 'https://new.example.com' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.updated).toBe(true)
      expect(res.json().data.value).toContain('new.example.com')
    })

    it('前置存在但 UPDATE 零命中 ⇒ updated=false', async () => {
      mocks.dbExecute
        .mockResolvedValueOnce([
          { id: REC_ID, key: 'r1', value: '{"url":"https://old.example.com"}', description: null },
        ])
        .mockResolvedValueOnce([])
      const res = await app.inject({
        method: 'PUT',
        url: `/api/misc-ext/remote/${REC_ID}`,
        payload: { url: 'https://new.example.com' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.updated).toBe(false)
      expect(res.json().data.id).toBe(REC_ID)
    })
  })

  // ⑤ system-extended.ts PUT /category-dictionary/:id(无 404 前置,admin 端)
  describe('PUT /api/admin/category-dictionary/:id', () => {
    it('命中一行 ⇒ updated=true 且返回库侧行', async () => {
      mocks.dbExecute.mockResolvedValueOnce([{ id: REC_ID, label: '新标签' }])
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/category-dictionary/${REC_ID}`,
        payload: { label: '新标签' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.updated).toBe(true)
      expect(res.json().data.label).toBe('新标签')
    })

    it('UPDATE 零命中 ⇒ updated=false(不写死 true)', async () => {
      mocks.dbExecute.mockResolvedValueOnce([])
      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/category-dictionary/${REC_ID}`,
        payload: { label: '新标签' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.updated).toBe(false)
      expect(res.json().data.id).toBe(REC_ID)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
