// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-454 回归锁(2026-11-13,缺陷票 docs/tickets/2026-11/findings-api.md#F-454)。
 *
 * 病灶:POST /api/admin/finance/fund/audit/:id 审批用 status=currentStatus+1 且只拦 >=2,
 * processing(1) 仍可推进到 completed(2) 并再次 frozen-=amount ⇒ 同一单二次释放冻结,
 * 挪用该用户其它待审单的冻结额,使其后续审批/驳回 400 卡死。
 *
 * 本文件用状态机替身驱动真实路由(不连 DB):
 *   ① 首次审批 1→2:释放一次冻结,且释放与状态迁移在同一事务内;
 *   ② 重复审批(已为 2):条件更新 0 行 ⇒ 不再释放,返回 409,不得 500;
 *   ③ 非 1 状态(如 pending 0)不得经此口推进,也不释放冻结。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const harness = vi.hoisted(() => ({
  flow: { id: 'w-1', userId: 'u-1', amount: 500, status: 1 } as {
    id: string
    userId: string | null
    amount: number
    status: number
  } | null,
  statusWrites: [] as number[],
  frozenReleases: [] as number[],
  releaseInTx: [] as boolean[],
  inTx: false,
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'admin-1'
  }),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'admin-1'
  }),
}))

vi.mock('../src/services/two-factor-step-up-store.js', () => ({
  requireStepUpForTwoFactorUser: vi.fn(async () => ({ ok: true, enforced: false })),
}))

vi.mock('../src/db/commission-queries.js', () => ({
  applyWithdrawal: vi.fn(),
  approveWithdrawal: vi.fn(),
  rejectWithdrawal: vi.fn(),
}))

vi.mock('../src/db/index.js', () => {
  function makeSelectChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {}
    for (const method of ['from', 'where', 'limit', 'orderBy']) chain[method] = () => chain
    chain.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve(harness.flow ? [{ ...harness.flow }] : []).then(resolve)
    return chain
  }

  // 从 drizzle SQL 条件里提取数值参数,模拟 WHERE status=<值> 的原子闸:
  // 无状态数值条件(仅 id)⇒ 放行;带状态条件 ⇒ 仅当当前状态命中时更新成功。
  function collectNumbers(node: unknown, out: number[] = []): number[] {
    if (typeof node === 'number') {
      out.push(node)
      return out
    }
    if (!node || typeof node !== 'object') return out
    const chunks = (node as { queryChunks?: unknown[] }).queryChunks
    if (Array.isArray(chunks)) for (const chunk of chunks) collectNumbers(chunk, out)
    const paramValue = (node as { value?: unknown }).value
    if (typeof paramValue === 'number') out.push(paramValue)
    return out
  }

  const tx = {
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: (condition: unknown) => ({
          returning: async () => {
            if ('status' in values) {
              harness.statusWrites.push(Number(values.status))
              const guardNumbers = collectNumbers(condition)
              const current = harness.flow?.status
              const allowed =
                harness.flow !== null &&
                current !== undefined &&
                (guardNumbers.length === 0 || guardNumbers.includes(current))
              if (!allowed || !harness.flow) return []
              harness.flow.status = Number(values.status)
              return [{ ...harness.flow }]
            }
            harness.frozenReleases.push(1)
            harness.releaseInTx.push(harness.inTx)
            return [{ frozenQuantity: 0 }]
          },
        }),
      }),
    }),
  }

  const db = {
    select: vi.fn(() => makeSelectChain()),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(async (fn: (client: unknown) => Promise<unknown>) => {
      harness.inTx = true
      try {
        return await fn(tx)
      } finally {
        harness.inTx = false
      }
    }),
  }
  return { db, dbRead: db }
})

import { financeExtendedRoutes } from '../src/routes/finance-extended.js'

const AUDIT_URL = '/api/admin/finance/fund/audit/w-1'

describe('F-454 资金审核审批只释放一次冻结', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(financeExtendedRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    harness.flow = { id: 'w-1', userId: 'u-1', amount: 500, status: 1 }
    harness.statusWrites.length = 0
    harness.frozenReleases.length = 0
    harness.releaseInTx.length = 0
    harness.inTx = false
  })

  const approve = () =>
    app.inject({
      method: 'POST',
      url: AUDIT_URL,
      payload: { action: 'approve' },
    })

  it('① 首次审批 1→2:释放一次冻结,且释放与状态迁移同事务', async () => {
    const res = await approve()
    expect(res.statusCode).toBe(200)
    expect((res.json() as { data: { status: number } }).data.status).toBe(2)
    expect(harness.statusWrites).toEqual([2])
    expect(harness.frozenReleases).toHaveLength(1)
    expect(harness.releaseInTx).toEqual([true])
  })

  it('② 重复审批(已为 2):条件更新 0 行,不再释放、不报 500', async () => {
    expect((await approve()).statusCode).toBe(200)

    const again = await approve()
    expect(again.statusCode).toBe(409)
    expect((again.json() as { code: number }).code).toBe(409)
    expect(harness.statusWrites).toEqual([2])
    expect(harness.frozenReleases).toHaveLength(1)
  })

  it('③ 非 1 状态(pending 0)不得经此口推进,也不释放冻结', async () => {
    harness.flow = { id: 'w-1', userId: 'u-1', amount: 500, status: 0 }

    const first = await approve()
    const second = await approve()
    expect(first.statusCode).toBe(409)
    expect(second.statusCode).toBe(409)
    expect(harness.statusWrites).toEqual([])
    expect(harness.frozenReleases).toEqual([])
  })
})
