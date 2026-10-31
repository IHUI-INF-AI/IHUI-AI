// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全强化第 14 批:运营面写端点的 admin 闸(2026-10-31)。
 *
 * 病灶(逐条回源确认,不是子代理转述):
 *   `apps/api/src/routes/agents.ts` 与 `agent-extended.ts` 的插件级 preHandler 只做
 *   `checkAuth` / `requireAuth` —— 只证明"已登录"。于是下列运营动作对**任意登录用户**开放:
 *     - POST /api/settlement/{settle,create,sync-existing,sync-single/:id,batch-delete}
 *       ⇒ 把任意结算单标成已结算(不可逆资金动作)、凭空造结算单、批量清空台账;
 *     - PUT  /api/examine/:recordId 及其 approve/reject/return、batch-approve/batch-reject
 *       ⇒ 任意改写/裁决他人审核记录(可把他人申请改到自己名下或直接 status=approved);
 *     - PUT/DELETE /api/agent-ext/buy/:id 与 recalculate-expiration
 *       ⇒ 改/删他人付费购买记录(含 user_id 字段,可把订单转到自己名下);
 *     - DELETE /api/agent-ext/rule-params/:id ⇒ 删他人规则参数。
 *   同文件的兄弟端点(GET /buy/list、/rules/:id 的 PUT/DELETE)都已是 requireAdmin,
 *   说明这些漏配是遗漏而不是设计。
 *
 * 本测试用**真实路由注册**捕获每条路由的 preHandler(不是读源码字符串),
 * 摘掉任意一处 `preHandler: requireAdmin` 即翻红。
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

// 只注册路由、不跑 handler:db 只要满足模块导入即可
vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    insert: () => ({ values: async () => [] }),
    update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
    delete: () => ({ where: async () => [] }),
    execute: async () => [],
  },
  dbRead: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
  },
}))

import { agentsRoutes } from '../src/routes/agents.js'
import agentExtendedRoutes from '../src/routes/agent-extended.js'
import { requireAdmin } from '../src/plugins/require-permission.js'

/** 路由键 = `METHOD path`(与 Fastify 的 routeOptions 一致) */
interface Captured {
  preHandler: unknown
  config: Record<string, unknown>
}

async function capture(plugin: Parameters<FastifyInstance['register']>[0], prefix: string) {
  const app = Fastify({ logger: false })
  const seen = new Map<string, Captured>()
  app.addHook('onRoute', (opts) => {
    const methods = Array.isArray(opts.method) ? opts.method : [opts.method]
    for (const m of methods) {
      seen.set(`${m} ${opts.url}`, {
        preHandler: opts.preHandler,
        config: (opts.config ?? {}) as Record<string, unknown>,
      })
    }
  })
  await app.register(plugin, { prefix })
  await app.ready()
  await app.close()
  return seen
}

/** preHandler 可能是单函数或数组;只关心"requireAdmin 在其中" */
function hasRequireAdmin(entry: Captured | undefined): boolean {
  if (!entry) return false
  const list = Array.isArray(entry.preHandler) ? entry.preHandler : [entry.preHandler]
  return list.some((h) => h === requireAdmin)
}

describe('agents.ts 运营写端点必须有 requireAdmin(第 14 批)', () => {
  let routes: Map<string, Captured>
  beforeAll(async () => {
    routes = await capture(agentsRoutes, '/api')
  })

  it.each([
    ['POST', '/api/settlement/settle'],
    ['POST', '/api/settlement/create'],
    ['POST', '/api/settlement/sync-existing'],
    ['POST', '/api/settlement/sync-single/:buyRecordId'],
    ['POST', '/api/settlement/batch-delete'],
    ['PUT', '/api/examine/:recordId'],
    ['PUT', '/api/examine/:recordId/approve'],
    ['PUT', '/api/examine/:recordId/reject'],
    ['POST', '/api/examine/:recordId/return'],
    ['POST', '/api/examine/batch-approve'],
    ['POST', '/api/examine/batch-reject'],
  ])('%s %s ⇒ requireAdmin', (method, url) => {
    const entry = routes.get(`${method} ${url}`)
    expect(entry, `${method} ${url} 未注册(路由改名则本用例须同步)`).toBeDefined()
    expect(hasRequireAdmin(entry), `${method} ${url} 缺 requireAdmin 闸`).toBe(true)
  })

  it('用户侧提交通道不误伤:/api/examine/submit 不加 admin', () => {
    const entry = routes.get('POST /api/examine/submit')
    expect(entry).toBeDefined()
    expect(hasRequireAdmin(entry)).toBe(false)
  })
})

describe('agent-extended.ts 资金与规则写端点必须有 requireAdmin(第 14 批)', () => {
  let routes: Map<string, Captured>
  beforeAll(async () => {
    routes = await capture(agentExtendedRoutes, '/api/agent-ext')
  })

  it.each([
    ['PUT', '/api/agent-ext/buy/:id'],
    ['DELETE', '/api/agent-ext/buy/:id'],
    ['POST', '/api/agent-ext/buy/:id/recalculate-expiration'],
    ['DELETE', '/api/agent-ext/rule-params/:id'],
  ])('%s %s ⇒ requireAdmin', (method, url) => {
    const entry = routes.get(`${method} ${url}`)
    expect(entry, `${method} ${url} 未注册(路由改名则本用例须同步)`).toBeDefined()
    expect(hasRequireAdmin(entry), `${method} ${url} 缺 requireAdmin 闸`).toBe(true)
  })

  it('用户侧读接口不误伤:/api/agent-ext/upload/:id 仍只是登录面', () => {
    const entry = routes.get('GET /api/agent-ext/upload/:id')
    expect(entry).toBeDefined()
    expect(hasRequireAdmin(entry)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
