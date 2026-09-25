// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D30① 信源入口的"装上车"证明(2026-09-25,用户批准挂载 POST /api/webhooks/github)。
 *
 * 四条判据各拦一类真实故障,缺一不可:
 *  1. 路由可达且**缺凭据即 503**——证明它真被挂上、且 fail-closed(不是"挂载即放行");
 *  2. 签名错 → 401——证明豁免只免 CSRF,不免验签;
 *  3. **同前缀下的诱饵路径仍被 CSRF 拦**——证明豁免是精确整路径,不是 `/api/webhooks/` 前缀;
 *     (O19 事故原文:一条参数化/前缀式豁免把整个 router 连带静态子路由一起放开,游客打到
 *      依赖 request.userId 的 handler 直接 500。这条断言就是那道门关上后再也打不开。)
 *  4. 路由表零参数段/零通配——同上,形态层面再钉一次。
 * 第 5 条是源码级"接线锁"(声明式),它单独不成立即为假绿,故与 1–4 同文件共存。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import type * as DrizzleOrm from 'drizzle-orm'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const cfg = vi.hoisted(() => ({ current: { NODE_ENV: 'test' } as Record<string, unknown> }))
// 注意:mock 工厂只在导入时求值一次并被**解构**,所以只能改这个对象的属性,
// 不能整体替换 cfg.current(替换后路由读到的仍是旧对象 —— 第一版就是这么把 401 测成 503 的)。
vi.mock('../src/config/index.js', () => ({ config: cfg.current }))
// 验签失败/缺 secret 两条路径都在触库之前返回;db 只需存在,不允许被真的连上
vi.mock('../src/db/index.js', () => ({ db: {} }))
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof DrizzleOrm>()
  return { ...actual, and: (...a: unknown[]) => a, eq: (a: unknown, b: unknown) => [a, b] }
})

import githubWebhookRoutes from '../src/routes/github-webhook.js'
import csrfPlugin from '../src/plugins/csrf.js'

const HOOK_PATH = '/api/webhooks/github'
/** 同前缀诱饵:它**不在**任何豁免清单里,必须被 CSRF 拦住 */
const DECOY_PATH = '/api/webhooks/other-provider'

async function build(secret: string | undefined): Promise<FastifyInstance> {
  if (secret === undefined) delete cfg.current.GITHUB_WEBHOOK_SECRET
  else cfg.current.GITHUB_WEBHOOK_SECRET = secret
  const app = Fastify({ logger: false })
  await app.register(cookie)
  await app.register(csrfPlugin)
  await app.register(githubWebhookRoutes, { prefix: '/api/webhooks' })
  app.post('/api/webhooks/other-provider', async (_req, reply) => reply.send({ ok: true }))
  await app.ready()
  return app
}

describe('D30① 信源入口挂载', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    app = await build(undefined)
  })
  afterAll(async () => {
    await app.close()
  })

  it('路由表里该路径在位,且 webhooks 族零参数段/零通配', async () => {
    const tree = app.printRoutes()
    expect(tree).toContain('webhooks')
    expect(tree).toContain('github')
    const fam = tree.split(/\r?\n/).filter((l) => l.includes('webhooks'))
    for (const line of fam) {
      expect(line).not.toMatch(/:[A-Za-z_]/)
      expect(line).not.toMatch(/\*/)
    }
  })

  it('缺 GITHUB_WEBHOOK_SECRET → 503(可达且 fail-closed,不是被 CSRF 挡成 403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: HOOK_PATH,
      payload: { action: 'ci_failed' },
    })
    expect(res.statusCode).toBe(503)
    expect(res.statusCode).not.toBe(403)
  })

  it('有 secret 但签名错 → 401(豁免只免 CSRF,不免验签)', async () => {
    const bad = await build('test-secret-value-for-hmac-check')
    const res = await bad.inject({
      method: 'POST',
      url: HOOK_PATH,
      headers: { 'x-hub-signature-256': 'sha256=deadbeef', 'x-github-event': 'workflow_run' },
      payload: { action: 'ci_failed' },
    })
    expect(res.statusCode).toBe(401)
    await bad.close()
  })

  it('同前缀诱饵路径仍被 CSRF 拦 ⇒ 豁免是精确整路径,不是一族前缀', async () => {
    const res = await app.inject({ method: 'POST', url: DECOY_PATH, payload: { x: 1 } })
    expect(res.statusCode).toBe(403)
  })

  it('接线锁:真实注册点存在(routes/index.ts 用同一前缀挂它)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/routes/index.ts'), 'utf8')
    expect(src).toContain("register(githubWebhookRoutes, { prefix: '/api/webhooks' })")
    const csrf = readFileSync(resolve(process.cwd(), 'src/plugins/csrf.ts'), 'utf8')
    expect(csrf).toContain("'/api/webhooks/github'")
    expect(csrf).not.toMatch(/PUBLIC_PREFIXES[\s\S]{0,80}'\/api\/webhooks\/'/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
