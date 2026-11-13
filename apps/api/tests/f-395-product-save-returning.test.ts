// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-395 回归锁(2026-11-13)。
 *
 * 病灶:商品写接口把「无返回行」当成功 —— INSERT/UPDATE 的 `returning()` 为空
 * (未落库 / 目标已被并发删除)时仍回 2xx,后台 toast 显示「保存成功」,线上商品没变;
 * PUT 传空对象或只传不可落库的可选列时,`set` 只剩 `updatedAt`,同样回 200。
 *
 * 本文件锁:
 *   ① 新增商品:INSERT returning 空数组 ⇒ 409,不得回 200/201,且无 data;
 *   ② 新增商品:正常返回 ⇒ 2xx 且 data 含真实行(id/name);
 *   ③ 更新商品:UPDATE returning 空数组 ⇒ 404,不得回 200,且无 data;
 *   ④ 更新商品:正常返回 ⇒ 200 且 data 含真实行;
 *   ⑤ 更新商品:空对象 / 只含不可落库可选列 ⇒ 400,且零写库(不再假成功);
 *   ⑥ 上下架:UPDATE returning 空数组 ⇒ 404;正常 ⇒ 200 且 status 如实;
 *   ⑦ 源码锁:商品 POST/PUT/PATCH 写块均含 `.returning()` + 空判 404/409;
 *   ⑧ 反向对照:删掉 POST 的空判,扫描器必须变红(防恒绿)。
 *
 * 只 mock requireAdmin / db,不触达真实 PG。
 */
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async (request: { userId?: string }) => {
    request.userId = 'f395-admin'
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  dbRead: { select: vi.fn() },
  dbClient: {},
}))

import { db } from '../src/db/index.js'
import { adminShopRoutes } from '../src/routes/admin-shop-routes.js'

const SRC = readFileSync(path.resolve(__dirname, '../src/routes/admin-shop-routes.ts'), 'utf8')
const PID = '42'

const productRow = (over: Record<string, unknown> = {}) => ({
  id: 42,
  productUuid: null,
  name: '月卡',
  price: 1999,
  tokenAmount: null,
  type: 'vip',
  status: 1,
  sort: 0,
  isRecurring: false,
  billingPeriod: 'month',
  trialDays: 0,
  createdAt: new Date('2026-11-13T00:00:00.000Z'),
  updatedAt: new Date('2026-11-13T00:00:00.000Z'),
  ...over,
})

interface WriteBlock {
  name: string
  body: string
}

const MARKERS: Array<{ name: string; start: string; end: string }> = [
  { name: 'POST', start: "server.post('/shop/products'", end: "server.get('/shop/products/:id'" },
  { name: 'PUT', start: "server.put('/shop/products/:id'", end: "'/shop/products/:id/status'" },
  { name: 'PATCH', start: "'/shop/products/:id/status'", end: "server.delete('/shop/products/:id'" },
]

/** 按端点切出商品写接口处理块(端点改名会让块变空 ⇒ 直接判红)。 */
function productWriteBlocks(src: string): WriteBlock[] {
  return MARKERS.map((m) => {
    const s = src.indexOf(m.start)
    const e = s > -1 ? src.indexOf(m.end, s + m.start.length) : -1
    return { name: m.name, body: s > -1 && e > s ? src.slice(s, e) : '' }
  })
}

/** 缺 `returning()` 或缺「空行 ⇒ 404/409」空判的写块。 */
function unguardedBlocks(src: string): string[] {
  return productWriteBlocks(src)
    .filter(
      (b) =>
        !/\.returning\(\)/.test(b.body) ||
        !/if \(!row\) return reply\.status\((?:404|409)\)/.test(b.body),
    )
    .map((b) => b.name)
}

describe('F-395 商品保存以 returning() 判空,不得假成功', () => {
  let app: FastifyInstance
  let insertReturning: ReturnType<typeof vi.fn>
  let insertValues: ReturnType<typeof vi.fn>
  let updateReturning: ReturnType<typeof vi.fn>
  let updateSet: ReturnType<typeof vi.fn>
  let updateWhere: ReturnType<typeof vi.fn>

  const create = (payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/api/admin/shop/products', payload })

  const put = (payload: Record<string, unknown>) =>
    app.inject({ method: 'PUT', url: `/api/admin/shop/products/${PID}`, payload })

  const patchStatus = (status: string) =>
    app.inject({
      method: 'PATCH',
      url: `/api/admin/shop/products/${PID}/status`,
      payload: { status },
    })

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(adminShopRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    insertReturning = vi.fn().mockResolvedValue([productRow()])
    insertValues = vi.fn(() => ({ returning: insertReturning }))
    const insertMock = db.insert as unknown as ReturnType<typeof vi.fn>
    insertMock.mockReset()
    insertMock.mockReturnValue({ values: insertValues })

    updateReturning = vi.fn().mockResolvedValue([productRow()])
    updateSet = vi.fn()
    updateWhere = vi.fn()
    const updateChain = { set: updateSet, where: updateWhere, returning: updateReturning }
    updateSet.mockReturnValue(updateChain)
    updateWhere.mockReturnValue(updateChain)
    const updateMock = db.update as unknown as ReturnType<typeof vi.fn>
    updateMock.mockReset()
    updateMock.mockReturnValue(updateChain)
  })

  it('① 新增商品:INSERT returning 空 ⇒ 409,不得回 200/201', async () => {
    insertReturning.mockResolvedValue([])
    const res = await create({ name: '月卡', price: 1999, status: 'online' })
    expect(res.statusCode).toBe(409)
    const body = res.json() as { code: number; data?: unknown }
    expect(body.code).toBe(409)
    expect(body.data).toBeUndefined()
    expect(res.statusCode).not.toBe(200)
  })

  it('② 新增商品:正常返回 ⇒ 2xx 且响应含真实行', async () => {
    const res = await create({ name: '月卡', price: 1999, status: 'online' })
    expect(res.statusCode).toBeGreaterThanOrEqual(200)
    expect(res.statusCode).toBeLessThan(300)
    const body = res.json() as { code: number; data: { id: string; name: string } }
    expect(body.code).toBe(0)
    expect(body.data.id).toBe('42')
    expect(body.data.name).toBe('月卡')
    expect(insertReturning).toHaveBeenCalledTimes(1)
  })

  it('③ 更新商品:UPDATE returning 空 ⇒ 404,不得回 200', async () => {
    updateReturning.mockResolvedValue([])
    const res = await put({ name: '季卡' })
    expect(res.statusCode).toBe(404)
    const body = res.json() as { code: number; data?: unknown }
    expect(body.code).toBe(404)
    expect(body.data).toBeUndefined()
  })

  it('④ 更新商品:正常返回 ⇒ 200 且响应含真实行', async () => {
    const res = await put({ price: 2999 })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { code: number; data: { id: string; price: number } }
    expect(body.code).toBe(0)
    expect(body.data.id).toBe('42')
    expect(body.data.price).toBe(1999)
    const payload = updateSet.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload.price).toBe(2999)
    expect(payload).toHaveProperty('updatedAt')
  })

  it('⑤ 更新商品:空对象 / 只含不可落库可选列 ⇒ 400 且零写库', async () => {
    for (const payload of [{}, { stock: 10 }, { desc: '新描述' }]) {
      const res = await put(payload)
      expect(res.statusCode).toBe(400)
      expect((res.json() as { code: number }).code).toBe(400)
    }
    expect(db.update).not.toHaveBeenCalled()
    expect(updateReturning).not.toHaveBeenCalled()
  })

  it('⑥ 上下架:returning 空 ⇒ 404;正常 ⇒ 200 且 status 如实', async () => {
    updateReturning.mockResolvedValueOnce([])
    const miss = await patchStatus('offline')
    expect(miss.statusCode).toBe(404)
    expect((miss.json() as { code: number }).code).toBe(404)
    expect((miss.json() as { data?: unknown }).data).toBeUndefined()

    updateReturning.mockResolvedValueOnce([productRow({ status: 0 })])
    const ok = await patchStatus('offline')
    expect(ok.statusCode).toBe(200)
    expect((ok.json() as { data: { id: string; status: string } }).data).toEqual({
      id: '42',
      status: 'offline',
    })
  })

  it('⑦ 源码锁:商品 POST/PUT/PATCH 写块都带 returning() 空判', () => {
    const blocks = productWriteBlocks(SRC)
    expect(blocks.map((b) => b.name)).toEqual(['POST', 'PUT', 'PATCH'])
    for (const b of blocks) {
      expect(b.body.length, `${b.name} 处理块未切出`).toBeGreaterThan(0)
      expect(b.body, `${b.name} 缺 returning()`).toMatch(/\.returning\(\)/)
      expect(b.body, `${b.name} 缺空判 404/409`).toMatch(
        /if \(!row\) return reply\.status\((?:404|409)\)/,
      )
    }
    expect(unguardedBlocks(SRC)).toEqual([])
  })

  it('⑧ 反向对照:删掉 POST 空判,扫描器必须变红', () => {
    const guard = "if (!row) return reply.status(409).send(error(409, '商品创建失败,请重试'))"
    expect(SRC).toContain(guard)
    const mutated = SRC.replace(guard, '')
    expect(mutated).not.toBe(SRC)
    expect(unguardedBlocks(mutated)).toEqual(['POST'])
  })
})
