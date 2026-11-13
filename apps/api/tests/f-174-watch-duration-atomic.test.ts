// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-174 回归锁(2026-11-13)。
 *
 * 病灶:`POST /api/behavior/watch` 的 `watchDuration` 客户端可控且无上限,累计时长写回
 * 走"先 SELECT 旧值 → 应用层相加 → UPDATE"两步;增量可报 2147483647,`watch_duration`
 * 又是 int4 ⇒ 第二次上报即 22003 numeric overflow,该用户行为统计永久 500。
 *
 * 本文件锁:
 *   ① 累计走「单条 INSERT ... ON CONFLICT DO UPDATE」,自增表达式引用列本身(原子,不读快照);
 *   ② 自增结果必须被 `LEAST(..., 2000000000)` 截顶(int4 安全值),并先 cast bigint
 *      以免存量接近上限时在 LEAST 生效前就溢出;
 *   ③ 采集到的语句只有 1 条 —— 一旦回退成"先 SELECT 再 UPDATE"两步,本用例立刻变红;
 *   ④ 路由层对单次增量 > 86400 秒直接 400,且不触达 DB。
 *
 * 零连接:db 用 drizzle pg-proxy 的真 SQL 生成器,driver 回调只记录语句并回一行假数据,
 * 不触达真实 PG。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const state = vi.hoisted(() => ({
  calls: [] as Array<{ sql: string; params: unknown[] }>,
}))

vi.mock('../src/db/index.js', async () => {
  const { drizzle } = await import('drizzle-orm/pg-proxy')
  // driver 回调永不连库:只采集 SQL/参数,并按 returning 的列序回一行假数据。
  const db = drizzle(async (sqlText: string, params: unknown[]) => {
    state.calls.push({ sql: sqlText, params })
    return { rows: [['watch-row-1', false]] }
  })
  return { db, dbRead: db }
})

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'f174-user'
    return true
  }),
}))

vi.mock('../src/plugins/require-permission.js', () => ({ requireAdmin: vi.fn() }))

const { behaviorRoutes } = await import('../src/routes/behavior.js')

const CEILING = 2_000_000_000
const PER_REQUEST_MAX = 86_400

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(behaviorRoutes, { prefix: '/api' })
  await app.ready()
  return app
}

describe('F-174 观看时长累计原子性与上限', () => {
  beforeEach(() => {
    state.calls.length = 0
  })

  it('累计时长是单条 upsert:LEAST 截顶 + 引用列本身的原子自增', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/behavior/watch',
      payload: { topicId: 'topic-1', topicType: 'lesson', topicTitle: '课', watchDuration: 60, lastPosition: 12 },
    })
    await app.close()

    expect(res.statusCode).toBe(200)
    // 「读后写」会先发 SELECT，再发 UPDATE ⇒ 两条语句；原子写法只有一条。
    expect(state.calls).toHaveLength(1)
    const stmt = state.calls[0]!
    expect(stmt.sql).toMatch(/insert into "behavior_watch_records"/i)
    expect(stmt.sql).toMatch(/on conflict \("user_id",\s*"topic_id",\s*"topic_type"\) do update/i)
    // 截顶上限存在
    expect(stmt.sql).toMatch(/least\(/i)
    // 自增引用列本身（而不是把应用层算好的新值当参数写回），且先 cast bigint 防中间溢出
    expect(stmt.sql).toMatch(
      /"behavior_watch_records"\."watch_duration"::bigint \+ excluded\.watch_duration/i,
    )
    expect(stmt.params).toContain(CEILING)
    expect(stmt.params).toContain(60)
    // 单条语句里不含任何先读旧值的痕迹
    expect(stmt.sql).not.toMatch(/\bselect\b/i)
  })

  it('首次上报同样走 onConflictDoUpdate（单语句覆盖首插与累加）', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/behavior/watch',
      payload: { topicId: 'topic-2', topicType: 'news' },
    })
    await app.close()

    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ id: 'watch-row-1', updated: true })
    expect(state.calls).toHaveLength(1)
    expect(state.calls[0]!.sql).toMatch(/on conflict .* do update/i)
    expect(state.calls[0]!.sql).toMatch(/least\(/i)
  })

  it('单次增量恰好 86400 秒仍放行', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/behavior/watch',
      payload: { topicId: 'topic-3', topicType: 'lesson', watchDuration: PER_REQUEST_MAX },
    })
    await app.close()

    expect(res.statusCode).toBe(200)
    expect(state.calls).toHaveLength(1)
  })

  it('单次增量超 24h 直接 400，且不落库', async () => {
    const app = await buildApp()
    for (const watchDuration of [PER_REQUEST_MAX + 1, 2_147_483_647]) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/behavior/watch',
        payload: { topicId: 'topic-4', topicType: 'lesson', watchDuration },
      })
      expect(res.statusCode).toBe(400)
    }
    await app.close()

    expect(state.calls).toHaveLength(0)
  })
})
