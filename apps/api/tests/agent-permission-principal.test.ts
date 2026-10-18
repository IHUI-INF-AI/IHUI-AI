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
const mockCalculate = vi.fn(async () => ({
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

  it('客户端自报 ?userId= 不参与判定:实参第二元仍是承载层身份', async () => {
    mockCalculate.mockClear()
    const res = await server.inject({
      method: 'GET',
      url: `/api/agent-ext/permission/agent-9?userId=${OTHER}`,
    })
    expect(res.statusCode).toBe(200)
    expect(mockCalculate.mock.calls.length).toBe(1)
    expect(mockCalculate.mock.calls[0]?.[1]).toBe(ME)
    // 阳性对照:agentId 确实原样传到第一位(否则"主体对"可能只是因为压根没调用)
    expect(mockCalculate.mock.calls[0]?.[0]).toBe('agent-9')
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
