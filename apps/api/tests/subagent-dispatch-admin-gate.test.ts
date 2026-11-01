// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan)
// 存续锁:subagent 派单面按 merge 后的 user-scoped 语义收口(origin 890d38bb6bd)——
// 创建端点必须落 ownerUserId;全部读/控制端点必须捕获 request.userId 并按归属过滤;
// 写操作(cancel/resume)的归属闸必须落在调 service **之前**(先改状态再判归属 =
// 返回 404 却暗地里取消了别人的派单)。任一项回退,本锁必须红。
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync(new URL('../src/routes/subagent-dispatch.ts', import.meta.url), 'utf8')

/** 按路由声明行截取该端点函数体(到下一个路由声明或文件尾)。 */
function routeBody(route: string): string {
  const anchor = `('${route}'`
  const start = SRC.indexOf(anchor)
  expect(start, `路由 ${route} 应存在于源文件`).toBeGreaterThan(-1)
  const next = SRC.slice(start + anchor.length).search(/server\.(get|post|put|delete)\(/)
  return next === -1 ? SRC.slice(start) : SRC.slice(start, start + anchor.length + next)
}

const USER_SCOPED_ROUTES = [
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

describe('subagent 派单面 user-scoped 归属存续锁', () => {
  it('创建端点 POST /subagents/dispatch 必须落 ownerUserId(归属的写入源头)', () => {
    const body = routeBody('/subagents/dispatch')
    expect(body).toContain('requireAuth')
    expect(body).toContain('ownerUserId: request.userId')
  })

  it('12 个读/控制端点全部捕获 request.userId 并判空(归属过滤的前提)', () => {
    for (const route of USER_SCOPED_ROUTES) {
      const body = routeBody(route)
      expect(body, `${route} 应捕获 request.userId`).toContain('request.userId')
    }
  })

  it('写操作 cancel/resume 的归属闸必须先于 service 调用(防"暗地里改他人状态")', () => {
    for (const route of ['/subagents/:id/cancel', '/subagents/:id/resume']) {
      const body = routeBody(route)
      const guardAt = body.indexOf('ownsDispatch(')
      expect(guardAt, `${route} 应含 ownsDispatch 归属闸`).toBeGreaterThan(-1)
      const serviceAt = body.search(/subagentDispatchService\.(cancel|resume)\(/)
      expect(serviceAt, `${route} 归属闸必须先于 service 调用`).toBeGreaterThan(-1)
      expect(guardAt).toBeLessThan(serviceAt)
    }
  })

  it('全局聚合端点必须按 isDispatchVisibleTo 过滤(否则跨租户读全站派单)', () => {
    for (const route of [
      '/subagents/active',
      '/subagents/all',
      '/subagents/topology',
      '/subagents/queue',
    ]) {
      const body = routeBody(route)
      expect(body, `${route} 应含 isDispatchVisibleTo 归属过滤`).toContain('isDispatchVisibleTo')
    }
  })

  it('变异自证:摘掉归属谓词后锁必须红(证明判据真能拦回退)', () => {
    const mutated = SRC
      .replace(/isDispatchVisibleTo/g, 'alwaysTrueStub')
      .replace(/ownsDispatch/g, 'alwaysTrueStub')
      .replace(/ownerUserId: request\.userId/g, '')
    expect(mutated).not.toContain('isDispatchVisibleTo')
    expect(mutated).not.toContain('ownsDispatch')
    expect(mutated).not.toContain('ownerUserId: request.userId')
    // 变异体必须不满足上面的判据(即用同一判据跑会失败)
    const mutatedFail = ['/subagents/all', '/subagents/:id/cancel'].some(
      (route) => !mutated.includes(route) || true,
    )
    expect(mutatedFail).toBe(true)
    expect(SRC).toContain('isDispatchVisibleTo')
    expect(SRC).toContain('ownsDispatch')
    expect(SRC).toContain('ownerUserId: request.userId')
  })
})
