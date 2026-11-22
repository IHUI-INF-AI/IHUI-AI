// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-962 裁决报告批 4a(C 组:真死⇒补后端)注册面回归锁。
 *
 * 两类判据:
 *  1. 静态源码扫描——24 条端点中除残段(#64 versions)外全部注册语句在位,
 *     防止后续重构悄悄摘掉路由(与 team-memory-routes-registered.test.ts 同模式);
 *  2. inject 实挂载——webhooks-trigger 插件挂上真实前缀 /api/webhooks 后,
 *     POST /api/webhooks/trigger/:id 可达(修 #99 双前缀),且双前缀路径彻底消失。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('../src/config/index.js', () => ({ config: { AI_SERVICE_URL: 'http://127.0.0.1:1' } }))

import webhookTriggerRoutes from '../src/routes/webhooks-trigger.js'

const routeSrc = (file: string): string =>
  readFileSync(resolve(process.cwd(), 'src/routes', file), 'utf8')

/** 断言某文件存在 `server.<method>(['"]<path>['"]` 注册(允许多行 options 形态)。 */
function expectRegistered(file: string, method: string, path: string): void {
  const escaped = path.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')
  const re = new RegExp(`server\\.${method}\\(\\s*['"]${escaped}['"]`)
  expect(routeSrc(file), `${file} 应注册 ${method.toUpperCase()} ${path}`).toMatch(re)
}

describe('G-962 批 4a developer 族(#54-63/#65/#101)', () => {
  it.each([
    ['get', '/summary'],
    ['get', '/docs'],
    ['get', '/billing'],
    ['get', '/limits'],
    ['get', '/notifications'],
    ['put', '/notifications'],
    ['get', '/sandbox'],
    ['get', '/settings'],
    ['put', '/settings'],
    ['delete', '/settings'],
    ['get', '/team'],
    ['put', '/info'],
  ])('developer.ts 注册 %s %s', (m, p) => {
    expectRegistered('developer.ts', m, p)
  })
})

describe('G-962 批 4a customer-service 族(#50-53)', () => {
  it('admin 段注册 sessions/stats/tickets GET+PUT', () => {
    expectRegistered('customer-service.ts', 'get', '/sessions')
    expectRegistered('customer-service.ts', 'get', '/stats')
    expectRegistered('customer-service.ts', 'get', '/tickets/:id')
    expectRegistered('customer-service.ts', 'put', '/tickets/:id')
  })
})

describe('G-962 批 4a chat/settings(#66-67)与 announcements(#48-49)', () => {
  it('chat.ts 注册 GET/PUT /settings', () => {
    expectRegistered('chat.ts', 'get', '/settings')
    expectRegistered('chat.ts', 'put', '/settings')
  })

  it('content.ts 公开插件腿注册 PATCH/DELETE /announcements/:id(route 级 requireAdmin)', () => {
    expectRegistered('content.ts', 'patch', '/announcements/:id')
    expectRegistered('content.ts', 'delete', '/announcements/:id')
    const src = routeSrc('content.ts')
    expect(src).toContain('G-962 批 4a #48-49')
    // 公开腿两条必须带 route 级 requireAdmin(adminContentRoutes 的单行形态不满足此匹配)
    expect(src).toMatch(
      /server\.patch\(\s*'\/announcements\/:id',\s*\{ preHandler: \[requireAdmin\] \}/,
    )
    expect(src).toMatch(
      /server\.delete\(\s*'\/announcements\/:id',\s*\{ preHandler: \[requireAdmin\] \}/,
    )
  })
})

describe('G-962 批 4a 别文件落点(#102/#76/#99)', () => {
  it('certificate.ts 用户侧注册 GET /certificates(区别于 /certificates/my)', () => {
    expectRegistered('certificate.ts', 'get', '/certificates')
  })

  it('memory.ts 注册 GET /memory/status', () => {
    expectRegistered('memory.ts', 'get', '/memory/status')
  })

  it('webhooks-trigger.ts 局部路径已改 /trigger/:id,双前缀字面量清除', () => {
    const src = routeSrc('webhooks-trigger.ts')
    expect(src).toMatch(/server\.post\(\s*['"]\/trigger\/:id['"]/)
    expect(src).not.toContain("'/webhooks/trigger/:id'")
  })

  it('接线锁:routes/index.ts 仍以 /api/webhooks 前缀挂载该插件', () => {
    const idx = routeSrc('index.ts')
    expect(idx).toContain("register(webhookTriggerRoutes, { prefix: '/api/webhooks' })")
  })
})

describe('G-962 批 4a #99 实挂载(inject)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(webhookTriggerRoutes, { prefix: '/api/webhooks' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('POST /api/webhooks/trigger/:id 可达(路由在位,handler 返回信封 404 触发器不存在)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/webhooks/trigger/nope', payload: {} })
    expect(res.statusCode).toBe(404)
    const body = res.json() as { code?: number; message?: string }
    expect(body.code).toBe(404)
    expect(body.message).toBe('触发器不存在')
  })

  it('双前缀路径 /api/webhooks/webhooks/trigger/:id 已彻底消失(Fastify 原生 404,无信封)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/webhooks/trigger/nope',
      payload: {},
    })
    expect(res.statusCode).toBe(404)
    const body = res.json() as { code?: number }
    expect(body.code).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
