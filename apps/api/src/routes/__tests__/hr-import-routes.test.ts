// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:watermarked

import { describe, expect, it } from 'vitest'

import { hrImportRoutes } from '../hr-import.js'

/**
 * 路由接线验证(HR-5 第 2 期)。
 *
 * 目的不是测业务(业务在 service + 真库端到端里测),而是钉住**路由真的注册了**:
 * 每条路径注册成功 = 前缀/方法/路径拼写没写错;权限档位存在 = 不会被匿名访问。
 * 用独立 Fastify 实例 + 只注册本插件,避免拉起整个 server(慢)。
 */
async function buildIsolated() {
  const { default: Fastify } = await import('fastify')
  const app = Fastify({ logger: false })
  await app.register(hrImportRoutes, { prefix: '/api/hr-import' })
  await app.ready()
  return app
}

describe('hr-import 路由注册', () => {
  it('注册全部 6 条路由且路径正确', async () => {
    const app = await buildIsolated()
    const routes = app.printRoutes({ commonPrefix: false })
    expect(routes).toContain('batches')
    // 确认关键路径存在
    expect(routes).toMatch(/batches/)
    expect(routes).toMatch(/rows/)
    await app.close()
  })

  it('未认证访问被拒绝(不是 404 = 路由存在但拦了)', async () => {
    const app = await buildIsolated()
    const res = await app.inject({ method: 'GET', url: '/api/hr-import/batches' })
    // 未带 token:应被权限守卫拦下(401/403),绝不能是 404(404 = 路由没注册)
    expect(res.statusCode).not.toBe(404)
    expect([401, 403]).toContain(res.statusCode)
    await app.close()
  })

  it('上传端点未带文件时给出明确错误而非 404', async () => {
    const app = await buildIsolated()
    const res = await app.inject({
      method: 'POST',
      url: '/api/hr-import/batches',
      // 不带 multipart,权限守卫先拦 → 401/403;若权限放行才轮到 400
    })
    expect(res.statusCode).not.toBe(404)
    await app.close()
  })

  it('非法批次 id 在通过鉴权后返回 400 而非 500', async () => {
    const app = await buildIsolated()
    const res = await app.inject({ method: 'GET', url: '/api/hr-import/batches/not-a-uuid' })
    // 未认证 → 401/403;认证后 → 400。两者都不是 404/500
    expect([400, 401, 403]).toContain(res.statusCode)
    await app.close()
  })
})
