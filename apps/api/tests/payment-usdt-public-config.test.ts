// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * G-944 USDT_TRC20_ADDRESS 空值 fail-closed —— 公开可用性端点两臂钉桩。
 *
 * 判的是什么:GET /api/payment/usdt/public-config 的 available 判定与
 * createUsdtPayment 的拒单口径一致 —— env 未配置 ⇒ available=false(前端据此
 * 隐藏该收款方式);配了但形态非法 ⇒ 同样 false;合法值 ⇒ true。
 * 且响应只回布尔,不回显地址原文(与「坏值不回显」同一取向)。
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'a'.repeat(64)
  process.env.REDIS_URL ??= 'redis://localhost:6379'
})

// db mock:public-config 只经 getUsdtPaymentConfig 读 system_configs(空行 ⇒ rate/networks 走默认)
vi.mock('../src/db/index.js', () => ({
  db: { insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }) },
  dbRead: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([] as Array<{ key: string; value: string }>),
      }),
    }),
  },
}))

vi.mock('../src/config/index.js', () => ({
  config: { USDT_CONFIRM_TRC20_MIN: 1, USDT_CONFIRM_ERC20_MIN: 1 },
}))

// 路由文件顶层 import 的鉴权插件:本端点无 preHandler,mock 掉避免牵进 auth 依赖树
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
}))

const paymentUsdtRoutes = (await import('../src/routes/payment-usdt.js')).default

const REAL_TRON = 'TMtTpPEMduWurHLi6Fe8XjfcP5Y5AMMnbG'
const ERC20_SAMPLE = '0xdAC17F958D2ee523a2206206994597C13D831ec7'

const origTron = process.env.USDT_TRC20_ADDRESS
const origErc = process.env.USDT_ERC20_ADDRESS

afterEach(() => {
  if (origTron === undefined) delete process.env.USDT_TRC20_ADDRESS
  else process.env.USDT_TRC20_ADDRESS = origTron
  if (origErc === undefined) delete process.env.USDT_ERC20_ADDRESS
  else process.env.USDT_ERC20_ADDRESS = origErc
})

let server: FastifyInstance
beforeAll(async () => {
  server = Fastify({ logger: false })
  server.register(paymentUsdtRoutes, { prefix: '/api' })
  await server.ready()
})
afterAll(async () => {
  await server.close()
})

async function getPublicConfig() {
  const res = await server.inject({ method: 'GET', url: '/api/payment/usdt/public-config' })
  expect(res.statusCode).toBe(200)
  return res.json() as {
    code: number
    data: { networks: Record<'TRC20' | 'ERC20', { available: boolean }> }
  }
}

describe('GET /payment/usdt/public-config — 两臂钉桩(有值可用 / 空值拒)', () => {
  it('TRC20 空值 ⇒ available=false;ERC20 有合法值 ⇒ true(同族对照臂)', async () => {
    delete process.env.USDT_TRC20_ADDRESS
    process.env.USDT_ERC20_ADDRESS = ERC20_SAMPLE
    const body = await getPublicConfig()
    expect(body.code).toBe(0)
    expect(body.data.networks.TRC20.available).toBe(false)
    expect(body.data.networks.ERC20.available).toBe(true)
  })

  it('TRC20 有合法值 ⇒ available=true', async () => {
    process.env.USDT_TRC20_ADDRESS = REAL_TRON
    process.env.USDT_ERC20_ADDRESS = ERC20_SAMPLE
    const body = await getPublicConfig()
    expect(body.data.networks.TRC20.available).toBe(true)
    expect(body.data.networks.ERC20.available).toBe(true)
  })

  it('TRC20 配了但形态非法 ⇒ 同样 available=false(拒单口径一致)', async () => {
    process.env.USDT_TRC20_ADDRESS = 'T0' + 'a'.repeat(32)
    const body = await getPublicConfig()
    expect(body.data.networks.TRC20.available).toBe(false)
  })

  it('响应不回显地址原文(公开端点只回布尔)', async () => {
    process.env.USDT_TRC20_ADDRESS = REAL_TRON
    process.env.USDT_ERC20_ADDRESS = ERC20_SAMPLE
    const res = await server.inject({ method: 'GET', url: '/api/payment/usdt/public-config' })
    expect(res.body).not.toContain(REAL_TRON)
    expect(res.body).not.toContain(ERC20_SAMPLE)
    expect(res.body).not.toContain('TMtT')
    expect(res.body).not.toContain('0xdAC1')
  })

  it('端点公开可达(无鉴权 preHandler)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/payment/usdt/public-config' })
    expect(res.statusCode).toBe(200)
  })
})
