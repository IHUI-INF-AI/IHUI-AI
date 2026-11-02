// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * admin-saas 代理:密钥缺失必须在本进程短路(2026-11-01 安全强化)。
 *
 * 原写法把 `ADMIN_SAAS_API_KEY ?? ''` 的空串照样塞进 x-admin-api-key 发出去。对上游是
 * "拿一把空钥匙敲门":既拿不到数据,又把一次**配置事故**伪装成一次普通的上游 401/403 ——
 * 排障时一路怀疑上游鉴权,而真相是本进程没配 env。
 *
 * 这组用例的两半缺一不可:
 * - 前半:缺密钥时 503,且**一个请求都不发**(不是"发了但上游拒");
 * - 后半:密钥在位时照常转发,并且真的带上了那把钥匙 —— 少了这半,把整段逻辑删掉
 *   (永远 503)也能让前半全绿。
 */
import Fastify from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async () => {},
}))

const originalFetch = globalThis.fetch
let captured: Array<{ url: string; headers: Record<string, string> }> = []

beforeEach(() => {
  captured = []
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    captured.push({ url: String(input), headers: (init?.headers ?? {}) as Record<string, string> })
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
  delete process.env.ADMIN_SAAS_API_KEY
})

async function buildAppWithKey(key: string | undefined) {
  vi.resetModules()
  if (key === undefined) delete process.env.ADMIN_SAAS_API_KEY
  else process.env.ADMIN_SAAS_API_KEY = key
  const { adminSaasProxyRoutes } = await import('../src/routes/admin-saas-proxy.js')
  const app = Fastify()
  await app.register(adminSaasProxyRoutes, { prefix: '/api/admin-saas' })
  await app.ready()
  return app
}

describe('ADMIN_SAAS_API_KEY 缺失', () => {
  it('返回 503 并点名缺哪个 env', async () => {
    const app = await buildAppWithKey(undefined)
    const res = await app.inject({ method: 'GET', url: '/api/admin-saas/users' })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toMatchObject({ code: 503, errorCode: 'SAAS_PROXY_NOT_CONFIGURED' })
    expect(res.json().message).toContain('ADMIN_SAAS_API_KEY')
    await app.close()
  })

  it('一个上游请求都不发(不是"发了但被拒")', async () => {
    const app = await buildAppWithKey(undefined)
    await app.inject({ method: 'GET', url: '/api/admin-saas/users' })
    expect(captured).toHaveLength(0)
    await app.close()
  })

  it('空串与未设置等价(空串也是一把空钥匙)', async () => {
    const app = await buildAppWithKey('')
    const res = await app.inject({ method: 'GET', url: '/api/admin-saas/users' })
    expect(res.statusCode).toBe(503)
    expect(captured).toHaveLength(0)
    await app.close()
  })
})

describe('密钥在位时照常转发(反向牙口)', () => {
  it('转发到 admin-api 并带上密钥', async () => {
    const app = await buildAppWithKey('real-admin-key')
    const res = await app.inject({ method: 'GET', url: '/api/admin-saas/users' })
    expect(res.statusCode).toBe(200)
    expect(captured).toHaveLength(1)
    expect(captured[0]?.url).toContain('/admin/api/users')
    expect(captured[0]?.headers['x-admin-api-key']).toBe('real-admin-key')
    await app.close()
  })
})
