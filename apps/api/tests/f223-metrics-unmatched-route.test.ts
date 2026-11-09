// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), query: vi.fn(), execute: vi.fn() },
  dbRead: { select: vi.fn(), query: vi.fn(), execute: vi.fn() },
}))
vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import businessMetricsPlugin from '../src/plugins/business-metrics.js'

let server: FastifyInstance | undefined

afterEach(async () => {
  if (server) {
    await server.close()
    server = undefined
  }
})

async function boot(setup?: (app: FastifyInstance) => void): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(businessMetricsPlugin)
  if (setup) setup(app)
  await app.ready()
  return app
}

/** 等 onResponse 钩子里的 setImmediate 指标写入落地。 */
async function flushMetrics(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve))
  await new Promise<void>((resolve) => setImmediate(resolve))
}

async function metricsBody(app: FastifyInstance): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/business-metrics' })
  expect(res.statusCode).toBe(200)
  return res.body
}

function apiCallLines(body: string): string[] {
  return body
    .split('\n')
    .filter((line) => line.startsWith('business_api_call_total{'))
}

describe('F-223 未匹配路由的指标标签必须有界(不按原始 URL 分桶)', () => {
  it('两个任意 404 路径归入同一个 __unmatched__ 序列,原始路径不进标签', async () => {
    server = await boot()
    await server.inject({ method: 'GET', url: '/api/zzz-f223-alpha' })
    await server.inject({ method: 'GET', url: '/api/zzz-f223-beta' })
    await flushMetrics()

    const body = await metricsBody(server)
    const lines = apiCallLines(body)
    const unmatched = lines.filter((line) => line.includes('route="__unmatched__"'))

    expect(unmatched.length).toBeGreaterThan(0)
    expect(body).not.toContain('zzz-f223-alpha')
    expect(body).not.toContain('zzz-f223-beta')
  })

  it('命中的路由按路由模板分桶,参数原值不进标签', async () => {
    server = await boot((app) => {
      app.get('/api/f223-probe/:id', async () => ({ ok: true }))
    })
    const res = await server.inject({ method: 'GET', url: '/api/f223-probe/secret-value-123' })
    expect(res.statusCode).toBe(200)
    await flushMetrics()

    const body = await metricsBody(server)
    const lines = apiCallLines(body)

    expect(lines.some((line) => line.includes('route="/api/f223-probe/:id"'))).toBe(true)
    expect(body).not.toContain('secret-value-123')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
