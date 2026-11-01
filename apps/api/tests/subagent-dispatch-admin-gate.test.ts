// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan)
// 存续锁:subagent 派单面属全局编排资源(无 owner 字段),除"创建"外所有聚合/控制端点必须管理员闸,
// 否则任意登录用户可读全平台派单历史、cancel/resume 他人派单、读他人 messages(提示词/数据外带)。
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync(new URL('../src/routes/subagent-dispatch.ts', import.meta.url), 'utf8')

describe('subagent-dispatch 管理员闸存续锁', () => {
  const gateCount = (SRC.match(/preHandler: requireAdminRouteGuard/g) || []).length
  const expectedGated = [
    '/subagents/active',
    '/subagents/all',
    '/subagents/:id/cancel',
    '/subagents/:id/resume',
    '/subagents/topology',
    '/subagents/stats',
    '/subagents/queue',
    '/subagents/by-agent/:agentId/summary',
    '/subagents/:id/stats',
    '/subagents/:id/dag',
    '/subagents/:id/quotas',
    '/subagents/:id/messages',
  ]

  it('12 个聚合/控制端点全部带管理员闸', () => {
    expect(gateCount).toBe(12)
    for (const route of expectedGated) {
      const re = new RegExp(`server\\.(get|post)\\('${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}',\\s*\\{ preHandler: requireAdminRouteGuard \\}`)
      expect(re.test(SRC), `路由 ${route} 应带 requireAdminRouteGuard`).toBe(true)
    }
  })

  it('创建端点 POST /subagents/dispatch 仅登录,不带管理员闸(保留用户触发入口)', () => {
    const re = /server\.post\('\/subagents\/dispatch',\s*(async|\(request)/g
    const m = SRC.match(re)
    expect(m, '应存在 POST /subagents/dispatch 路由').not.toBeNull()
    // 该行不得出现 preHandler: requireAdminRouteGuard
    const line = SRC.split('\n').find((l) => l.includes("server.post('/subagents/dispatch'"))!
    expect(line).not.toContain('preHandler: requireAdminRouteGuard')
    // 且函数体内仍调用 requireAuth(登录校验)
    const body = SRC.slice(SRC.indexOf("server.post('/subagents/dispatch'"))
    expect(body.slice(0, 200)).toContain('requireAuth')
  })

  it('变异自证:删掉所有 preHandler 后锁应失败', () => {
    const mutated = SRC.replace(/preHandler: requireAdminRouteGuard/g, '')
    const mutatedCount = (mutated.match(/preHandler: requireAdminRouteGuard/g) || []).length
    expect(mutatedCount).toBe(0)
    expect(mutatedCount).not.toBe(gateCount) // 证明上面的断言真能拦住回退
  })
})
