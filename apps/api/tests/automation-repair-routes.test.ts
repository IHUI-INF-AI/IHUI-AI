// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D30 修复闭环 admin 路由面回归(2026-09-26 立,G-36):
// 独立 encapsulated 插件 + 注入式 guard/service,零 db 零网络。
// 覆盖:admin 闸门拒绝即止步 / 未启用 503(fail-closed,不静默放行)/
//       任务键参数校验(非法形态 400)/ 列表与详情走注入服务。
import { describe, it, expect } from 'vitest'
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'

import { repairAdminRoutes } from '../src/routes/automations.js'
import type { AutomationRepairService } from '../src/services/automation-repair-service.js'
import type { RepairTaskRecord } from '@ihui/types'

function fakeTask(over: Partial<RepairTaskRecord> = {}): RepairTaskRecord {
  return {
    key: 'issue:1',
    source: 'issue',
    repo: 'o/r',
    title: 't',
    goal: 'g',
    url: null,
    issueNumber: 1,
    state: 'pending',
    attempts: 0,
    maxAttempts: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [],
    ...over,
  }
}

function fakeService(task: RepairTaskRecord | null = fakeTask()): AutomationRepairService {
  return {
    repo: 'o/r',
    async ingestPending() {
      return 0
    },
    async claim() {
      return { ok: false, reason: 'not_found' }
    },
    async runNext() {
      return null
    },
    async runCycle() {
      return { ingested: 0, results: [] }
    },
    listTasks: () => (task ? [task] : []),
    getTask: (key: string) => (task && task.key === key ? task : null),
  }
}

const allowGuard = async (): Promise<void> => undefined
const denyGuard = async (_req: FastifyRequest, reply: FastifyReply): Promise<void> => {
  await reply.status(403).send({ code: 403, message: '需要管理员权限' })
}

async function build(opts: {
  service: AutomationRepairService | null
  guard?: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
}) {
  const app = Fastify()
  await app.register(repairAdminRoutes, {
    service: opts.service,
    guard: opts.guard ?? allowGuard,
  })
  await app.ready()
  return app
}

describe('repairAdminRoutes', () => {
  it('guard 拒绝 ⇒ 任何 /repair/* 都不触达服务(集中 admin 闸门)', async () => {
    const app = await build({ service: fakeService(), guard: denyGuard })
    const r = await app.inject({ method: 'GET', url: '/repair/tasks' })
    expect(r.statusCode).toBe(403)
    const r2 = await app.inject({ method: 'POST', url: '/repair/cycle' })
    expect(r2.statusCode).toBe(403)
    await app.close()
  })

  it('服务未装配 ⇒ 503 明确原因,不静默放行', async () => {
    const app = await build({ service: null })
    for (const url of ['/repair/tasks', '/repair/tasks/issue:1']) {
      const r = await app.inject({ method: 'GET', url })
      expect(r.statusCode).toBe(503)
      expect(JSON.parse(r.body).message).toContain('fail-closed')
    }
    const c = await app.inject({ method: 'POST', url: '/repair/cycle' })
    expect(c.statusCode).toBe(503)
    await app.close()
  })

  it('列表/详情走注入服务;任务键形态不符 → 400;不存在 → 404', async () => {
    const app = await build({ service: fakeService(fakeTask({ key: 'issue:42' })) })
    const list = await app.inject({ method: 'GET', url: '/repair/tasks' })
    expect(list.statusCode).toBe(200)
    expect(JSON.parse(list.body).data.items).toHaveLength(1)

    const badState = await app.inject({ method: 'GET', url: '/repair/tasks?state=bogus' })
    expect(badState.statusCode).toBe(400)

    const detail = await app.inject({ method: 'GET', url: '/repair/tasks/issue:42' })
    expect(detail.statusCode).toBe(200)
    expect(JSON.parse(detail.body).data.key).toBe('issue:42')

    const badKey = await app.inject({ method: 'GET', url: '/repair/tasks/nocolonkey' })
    expect(badKey.statusCode).toBe(400)

    const missing = await app.inject({ method: 'GET', url: '/repair/tasks/issue:999' })
    expect(missing.statusCode).toBe(404)
    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
