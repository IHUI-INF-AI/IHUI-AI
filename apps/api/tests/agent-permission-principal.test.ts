// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'

const ME = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'

/**
 * 只 mock 两处:权限门(承载层写 request.userId 的那一步)与判定服务(把它的入参取出来断)。
 * 路由本体、zod 解析、preHandler 挂载关系全部跑真实代码(§22c:判据不复制进测试)。
 */
const mockCalculate = vi.fn(async (_agentId: string, _userId?: string) => ({
  type: 'free',
  accountType: '免费',
  hasPermission: true,
}))
vi.mock('../src/services/agent-service.js', () => ({
  calculateAgentPermission: (agentId: string, userId?: string) => mockCalculate(agentId, userId),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: async (request: { userId?: string }) => {
    request.userId = ME
  },
  requireAdmin: async () => undefined,
  requirePermission: () => async () => undefined,
  requireAnyPermission: () => async () => undefined,
  // agent-extended 的读路由直接调同步 isSystemAdmin(request);缺导出会让该分支 500
  isSystemAdmin: () => false,
}))

vi.mock('../src/plugins/auth.js', () => ({
  requireActiveUser: async () => undefined,
}))

import agentExtendedRoutes from '../src/routes/agent-extended.js'

describe('GET /api/agent-ext/permission/:agentId —— 归属主体只认承载层', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(agentExtendedRoutes, { prefix: '/api/agent-ext' })
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
  })

  it('客户端自报 ?userId= 指向他人 ⇒ 403,绝不参与判定', async () => {
    mockCalculate.mockClear()
    const res = await server.inject({
      method: 'GET',
      url: `/api/agent-ext/permission/agent-9?userId=${OTHER}`,
    })
    // F-07(2026-11-08):`?userId=` 不再被忽略而是显式拒绝 —— 客户端不能用自己的 query
    // 决定"查谁",更不能拿它探测他人权限;与 F-04/F-05 同口径(动作授权失败 → 403)。
    expect(res.statusCode).toBe(403)
    expect(res.json()).toMatchObject({ code: 403, message: '无权查询他人的智能体权限' })
    // 拒绝发生在判定之前:服务一次都不该被调到(否则"403 只是表象"
    expect(mockCalculate.mock.calls.length).toBe(0)
  })

  it('不带 query 时同样取承载层身份(现状唯一可达路径)', async () => {
    mockCalculate.mockClear()
    const res = await server.inject({ method: 'GET', url: '/api/agent-ext/permission/agent-9' })
    expect(res.statusCode).toBe(200)
    expect(mockCalculate.mock.calls[0]?.[1]).toBe(ME)
    expect(res.json().data).toMatchObject({ hasPermission: true })
  })

  it('非法 userId 形状在 zod 就被拦(不是静默当未登录跑一遍判定)', async () => {
    mockCalculate.mockClear()
    const res = await server.inject({
      method: 'GET',
      url: '/api/agent-ext/permission/agent-9?userId=not-a-uuid',
    })
    expect(res.statusCode).toBeGreaterThanOrEqual(400)
    expect(mockCalculate).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
