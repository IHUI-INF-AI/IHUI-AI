// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-189(2026-11-13 补完):LLM 分组删除守卫的竞态收口回归。
 *
 * 票面主案(重命名不回写 provider_group)已由 a00d16ca08 在 PUT 侧事务级联封死，
 * 且 DELETE 计数现读组表 label ⇒ 与级联后 provider 同键。本测试钉两格:
 *  ① 行为面:404/409/200 三态与「守卫按组表当前 label 计数」的联动(重命名后仍可正确拦孤儿);
 *  ② 竞态面(本次补刀):DELETE 链上 锁→FOR UPDATE 组行→COUNT→删组 必须在**同一事务**内 ——
 *     修复前三步裸走 db.execute，窗口内并发打标会让守卫算成 0 后删组，制造孤儿 provider。
 *
 * 判据不复制(§22c):全程走生产路由 handler;db 为可编排桩，不连生产库(§5 测试隔离铁律)。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { PgDialect } from 'drizzle-orm/pg-core'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
  return {
    txDepth: 0,
    maxTxDepth: 0,
    seq: [] as string[],
    /** 编排:每条 execute 的 SQL 归一化标签依次吃这里的返回 */
    scripted: [] as unknown[][],
    /** delete 命中集(空 ⇒ 组已被并发抢删) */
    deleteReturns: [{ id: 3 }] as Array<{ id: number }>,
  }
})

function normTag(sqlText: string): string {
  const s = sqlText.replace(/\s+/g, ' ').trim()
  if (/pg_advisory_xact_lock/i.test(s)) return 'lock'
  if (/^SELECT id, group_label AS label FROM ai_model_config_groups/i.test(s))
    return s.includes('FOR UPDATE') ? 'getGroup+lockRow' : 'getGroup'
  if (/SELECT COUNT\(\*\)::int AS cnt FROM ai_model_config/i.test(s)) return 'countProviders'
  if (/^DELETE FROM ai_model_config_groups/i.test(s)) return 'deleteGroup'
  if (/UPDATE ai_model_config_groups/i.test(s)) return 'updateGroup'
  if (/UPDATE ai_model_config\b/i.test(s)) return 'cascadeProviders'
  return 'other:' + s.slice(0, 40)
}

vi.mock('../src/db/index.js', () => {
  const dialect = new PgDialect()
  const exec = (query: unknown) => {
    let text: string
    if (typeof query === 'string') text = query
    else {
      try {
        text = dialect.sqlToQuery(query as never).sql
      } catch {
        text = 'UNPARSEABLE'
      }
    }
    const tag = normTag(text)
    h.seq.push(tag)
    const next = h.scripted.shift()
    if (next !== undefined) return Promise.resolve(next)
    return Promise.resolve([])
  }
  const makeBase = () => ({ execute: exec })
  const db = {
    ...makeBase(),
    transaction: (fn: (tx: { execute: typeof exec }) => Promise<unknown>) => {
      h.txDepth++
      h.maxTxDepth = Math.max(h.maxTxDepth, h.txDepth)
      return fn(makeBase()).finally(() => {
        h.txDepth--
      })
    },
    select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
  }
  return { db, dbRead: db }
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'u1'
  }),
}))

import { userLlmConfigV2Routes } from '../src/routes/user-llm-configs-v2.js'

describe('F-189 DELETE /llm-groups/:id — 守卫与事务收口', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    h.txDepth = 0
    h.maxTxDepth = 0
    h.seq.length = 0
    h.scripted.length = 0
    h.deleteReturns = [{ id: 3 }]
    app = Fastify({ logger: false })
    await app.register(userLlmConfigV2Routes)
    await app.ready()
  })
  afterEach(async () => {
    await app.close()
  })

  it('组不存在 ⇒ 404;链上必须先开事务再取组行(锁序成立)', async () => {
    h.scripted = [[], [], [{ id: 3, label: 'ghost' }], [{ cnt: 9 }]] // [user 锁, 组行⇒空, label 锁(不可达), 计数(不可达)]
    const res = await app.inject({ method: 'DELETE', url: '/llm-groups/3' })
    expect(res.statusCode).toBe(404)
    expect(h.maxTxDepth).toBe(1)
    expect(h.seq).toEqual(['lock', 'getGroup+lockRow'])
  })

  it('组下有 provider ⇒ 409 且计数在事务内,绝不发 DELETE', async () => {
    h.scripted = [[], [{ id: 3, label: 'A' }], [], [{ cnt: 2 }]] // [锁, 组行, label 锁, 计数]
    const res = await app.inject({ method: 'DELETE', url: '/llm-groups/3' })
    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.body).message).toContain('2 个 provider')
    expect(h.maxTxDepth).toBe(1)
    expect(h.seq).toEqual(['lock', 'getGroup+lockRow', 'lock', 'countProviders'])
    expect(h.seq).not.toContain('deleteGroup')
  })

  it('空组 ⇒ 200;锁→组行锁(重读当前 label)→按该 label 计数→删,四步同事务(竞态窗口封死)', async () => {
    // A' 场景:组曾被重命名,组表当前 label 即级联后 provider 所写 value ⇒ 重读组表即自洽
    h.scripted = [[], [{ id: 3, label: 'B' }], [], [{ cnt: 0 }], [{ id: 3 }]]
    const res = await app.inject({ method: 'DELETE', url: '/llm-groups/3' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).data.deleted).toBe(true)
    expect(h.maxTxDepth).toBe(1)
    expect(h.seq).toEqual(['lock', 'getGroup+lockRow', 'lock', 'countProviders', 'deleteGroup'])
  })

  it('并发抢删:组行锁后 DELETE 命中 0 行 ⇒ 404,不得谎报 deleted:true', async () => {
    h.scripted = [[], [{ id: 3, label: 'B' }], [], [{ cnt: 0 }], []] // delete RETURNING 空 ⇒ 已被他席删
    const res = await app.inject({ method: 'DELETE', url: '/llm-groups/3' })
    expect(res.statusCode).toBe(404)
    expect(h.seq.slice(0, 4)).toEqual(['lock', 'getGroup+lockRow', 'lock', 'countProviders'])
  })

  it('守卫按组表 label 计数(不是 id 强转):GROUP 先于 COUNT,COUNT 在持锁事务内', async () => {
    // 桩实现不解析参数 ⇒ 以序列形态证明 COUNT 发生在读到组行之后(而非用请求 id 拼查)。
    h.scripted = [[], [{ id: 7, label: '独立标签X' }], [], [{ cnt: 1 }]]
    const res = await app.inject({ method: 'DELETE', url: '/llm-groups/7' })
    expect(res.statusCode).toBe(409)
    expect(h.seq.indexOf('getGroup+lockRow')).toBeLessThan(h.seq.indexOf('countProviders'))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
