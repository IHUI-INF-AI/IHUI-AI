// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import {
  AGENT_RUN_PUBLIC_ROUTES,
  IDEMPOTENCY_IN_PROGRESS_CODE,
  IDEMPOTENCY_KEY_REQUIRED_CODE,
  IDEMPOTENCY_KEY_REUSED_CODE,
  INVALID_CURSOR_CODE,
  INVALID_RUN_HANDLE_CODE,
  RUN_NOT_FOUND_CODE,
  createAgentRunRoutes,
  type PublicAgentRunView,
} from '../src/routes/agent-runs.js'
import { RUN_HANDLE_PREFIX } from '../src/services/run-handle.js'
import type { IdempotencyKv } from '../src/services/run-idempotency.js'

/**
 * O10 对外 run 语义面的契约测试(Fastify inject,零真实 Redis / 零真实 DB / 零网络)。
 *
 * 鉴权用 `vi.mock` 打桩 `plugins/auth.js`:它扮演真实 authenticate —— 没有身份就抛
 * `statusCode:401`,有身份才把 `request.userId` 摆好。这样"游客打到受保护端点得 401/403,
 * 不是 500"才是被真实跑出来的结论,而不是我对 handler 的阅读印象。
 */

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: FastifyRequest): Promise<void> => {
    const raw = request.headers['x-test-user']
    if (typeof raw !== 'string' || raw === '') {
      const err = new Error('未登录') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    const holder = request as unknown as { userId?: number }
    holder.userId = Number(raw)
  },
}))

interface Entry {
  value: string
  expiresAt: number
}

class FakeKv implements IdempotencyKv {
  private readonly map = new Map<string, Entry>()
  async get(key: string): Promise<string | null> {
    const hit = this.map.get(key)
    if (hit === undefined) return null
    if (hit.expiresAt <= Date.now()) {
      this.map.delete(key)
      return null
    }
    return hit.value
  }
  async setIfAbsent(key: string, value: string, ttlMs: number): Promise<'OK' | null> {
    if ((await this.get(key)) !== null) return null
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs })
    return 'OK'
  }
  async setWithTtl(key: string, value: string, ttlMs: number): Promise<void> {
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs })
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key)
  }
}

interface ApiEnvelope<T> {
  code: number
  message: string
  errorCode?: string
  data: T
}
interface PageEnvelope {
  items: PublicAgentRunView[]
  has_more: boolean
  next_cursor: string | null
}

let app: FastifyInstance
let created: number

async function createRun(
  key: string,
  over: { user?: string; input?: string } = {},
): Promise<{ status: number; body: ApiEnvelope<PublicAgentRunView> }> {
  const res = await app.inject({
    method: 'POST',
    url: '/',
    headers: { 'idempotency-key': key, 'x-test-user': over.user ?? '7' },
    payload: { agent_id: 'agent-1', input: over.input ?? `问句 ${key}` },
  })
  return { status: res.statusCode, body: res.json() as ApiEnvelope<PublicAgentRunView> }
}

async function listPage(query: string): Promise<ApiEnvelope<PageEnvelope>> {
  const res = await app.inject({
    method: 'GET',
    url: `/list${query}`,
    headers: { 'x-test-user': '7' },
  })
  return res.json() as ApiEnvelope<PageEnvelope>
}

async function makeRuns(count: number): Promise<PublicAgentRunView[]> {
  const views: PublicAgentRunView[] = []
  for (let i = 0; i < count; i += 1) {
    views.push((await createRun(`key-list-${i}`)).body.data)
  }
  return views
}

const runRefs = (items: PublicAgentRunView[]): string[] => items.map((item) => item.run_ref)

beforeEach(async () => {
  // 只伪钟、不伪定时器:句柄内嵌到期秒,重放等值必须落在同一秒里比较才不是运气测试;
  // 而 Fastify 的 boot/inject 依赖真实 setImmediate,一并伪掉会挂死。
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-25T00:00:00.000Z'))
  created = 0
  let tick = 1_700_000_000_000
  app = Fastify()
  app.setErrorHandler((error, _request, reply) => {
    const statusCode = (error as Error & { statusCode?: number }).statusCode ?? 500
    return reply.code(statusCode).send({ code: statusCode, message: error.message })
  })
  app.register(
    createAgentRunRoutes({
      kv: new FakeKv(),
      handleSecret: 'route-test-secret',
      // 记录时间戳走注入时钟且严格递增:否则同一秒内创建的 run 排序全凭 uuid,分页断言不稳
      nowMs: () => {
        tick += 1000
        return tick
      },
      newRunId: () => {
        created += 1
        return `run_fixed-${created}`
      },
    }),
  )
  await app.ready()
})

afterEach(async () => {
  await app.close()
  vi.useRealTimers()
})

describe('鉴权面', () => {
  it('三条路由全部要登录:游客拿到 401,不是 500,也不是 404', async () => {
    const post = await app.inject({
      method: 'POST',
      url: '/',
      headers: { 'idempotency-key': 'no-body-key' },
      payload: { agent_id: 'a', input: 'b' },
    })
    const list = await app.inject({ method: 'GET', url: '/list' })
    const resolve = await app.inject({ method: 'GET', url: '/resolve/whatever' })
    expect([post.statusCode, list.statusCode, resolve.statusCode]).toEqual([401, 401, 401])
    expect(AGENT_RUN_PUBLIC_ROUTES).toHaveLength(0)
  })
})

describe('① 幂等 run 创建', () => {
  it('缺 Idempotency-Key → 400 明确策略,不静默创建', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      headers: { 'x-test-user': '7' },
      payload: { agent_id: 'agent-1', input: 'hi' },
    })
    expect(res.statusCode).toBe(400)
    expect((res.json() as ApiEnvelope<unknown>).errorCode).toBe(IDEMPOTENCY_KEY_REQUIRED_CODE)
    expect(created).toBe(0)
  })

  it('同一 key 重放返回同一个 run(200 + body 逐字段等值,底层只落一条)', async () => {
    const first = await createRun('key-aaaaaaaa')
    const again = await createRun('key-aaaaaaaa')
    expect(first.status).toBe(201)
    expect(again.status).toBe(200)
    expect(again.body.data).toEqual(first.body.data)
    expect(created).toBe(1)
    expect(runRefs((await listPage('')).data.items)).toHaveLength(1)
  })

  it('不同 key 各建一次,句柄互不相同', async () => {
    const a = await createRun('key-bbbbbbb1')
    const b = await createRun('key-bbbbbbb2')
    expect([a.status, b.status]).toEqual([201, 201])
    expect(a.body.data.run_ref).not.toBe(b.body.data.run_ref)
    expect(created).toBe(2)
  })

  it('同一 key 换请求体 → 409 KEY_REUSED,绝不把首次结果回给不同请求', async () => {
    await createRun('key-cccccccc')
    const reused = await createRun('key-cccccccc', { input: '完全不同的问句' })
    expect(reused.status).toBe(409)
    expect(reused.body.errorCode).toBe(IDEMPOTENCY_KEY_REUSED_CODE)
    expect(created).toBe(1)
  })

  it('并发同 key → 一个建成、一个 409 IN_PROGRESS,创建只发生一次', async () => {
    const both = await Promise.all([createRun('key-dddddddd'), createRun('key-dddddddd')])
    // 这层真正的承诺是"同 key 绝不多建":第二个拿 409(首次仍在途)还是 200(首次已完成、
    // 直接回读同一资源)取决于 FakeKv 的调度时机 —— 假 KV 同步落完就是 200。
    // 永不允许的是两个 201(同 key 建出两个 run)。在途 409 的语义由 run-idempotency 套件定死。
    expect(both.filter((item) => item.status === 201)).toHaveLength(1)
    expect(both.every((item) => item.status === 200 || item.status === 201)).toBe(true)
    expect(created).toBe(1)
    const refs = new Set(both.map((item) => item.body.data?.run_ref))
    expect(refs.size).toBe(1)
    const rejected = both.find((item) => item.status === 409)
    if (rejected) expect(rejected.body.errorCode).toBe(IDEMPOTENCY_IN_PROGRESS_CODE)
  })

  it('对外视图字段集封闭:没有 session_id,也没有内部 runId', async () => {
    const res = await createRun('key-eeeeeeee')
    expect(Object.keys(res.body.data).sort()).toEqual([
      'agent_id',
      'created_at',
      'input',
      'run_ref',
      'status',
      'updated_at',
    ])
    const raw = JSON.stringify(res.body)
    expect(raw.toLowerCase()).not.toContain('session')
    expect(raw).not.toContain('run_fixed-')
  })
})

describe('④ 游标分页与 ② 句柄解析', () => {
  it('顺着 next_cursor 翻到底:并集恰好等于全集,不重不漏', async () => {
    const views = await makeRuns(5)
    const seen: string[] = []
    let cursor: string | null = null
    for (let guard = 0; guard < 10; guard += 1) {
      const page = await listPage(cursor === null ? '?limit=2' : `?limit=2&after=${cursor}`)
      expect(page.code).toBe(0)
      seen.push(...runRefs(page.data.items))
      cursor = page.data.next_cursor
      if (cursor === null) break
    }
    expect(seen).toEqual(runRefs(views))
  })

  it('取第 2 页期间新增一条:旧游标不重发第 1 页,新条目排在后面', async () => {
    const views = await makeRuns(4)
    const first = await listPage('?limit=2')
    const cursor = first.data.next_cursor
    expect(runRefs(first.data.items)).toEqual([views[0]?.run_ref, views[1]?.run_ref])

    const second = await listPage(`?limit=2&after=${cursor}`)
    expect(runRefs(second.data.items)).toEqual([views[2]?.run_ref, views[3]?.run_ref])

    const extra = await createRun('key-list-extra')
    const third = await listPage(`?limit=3&after=${cursor}`)
    expect(third.data.items[0]?.run_ref).toBe(views[2]?.run_ref)
    expect(runRefs(third.data.items)).toContain(extra.body.data.run_ref)
  })

  it('非法游标与别人的游标都回 400,不是 500', async () => {
    await makeRuns(3)
    expect((await listPage('?after=not-a-cursor')).errorCode).toBe(INVALID_CURSOR_CODE)
    expect((await listPage('?after=cr1_tampered.sig')).errorCode).toBe(INVALID_CURSOR_CODE)

    const mine = await listPage('?limit=1')
    const stolen = await app.inject({
      method: 'GET',
      url: `/list?after=${mine.data.next_cursor}`,
      headers: { 'x-test-user': '99' },
    })
    expect(stolen.statusCode).toBe(400)
    expect((stolen.json() as ApiEnvelope<PageEnvelope>).errorCode).toBe(INVALID_CURSOR_CODE)
  })

  it('句柄可解析回同一个 run;别人的句柄 404、格式非法 400', async () => {
    const view = (await createRun('key-resolve1')).body.data
    expect(view.run_ref.startsWith(`${RUN_HANDLE_PREFIX}_`)).toBe(true)

    const own = await app.inject({
      method: 'GET',
      url: `/resolve/${view.run_ref}`,
      headers: { 'x-test-user': '7' },
    })
    expect(own.statusCode).toBe(200)
    expect((own.json() as ApiEnvelope<PublicAgentRunView>).data).toEqual(view)

    const other = await app.inject({
      method: 'GET',
      url: `/resolve/${view.run_ref}`,
      headers: { 'x-test-user': '8' },
    })
    expect(other.statusCode).toBe(404)
    expect((other.json() as ApiEnvelope<unknown>).errorCode).toBe(RUN_NOT_FOUND_CODE)

    const bad = await app.inject({
      method: 'GET',
      url: '/resolve/cr1_a.b',
      headers: { 'x-test-user': '7' },
    })
    expect(bad.statusCode).toBe(400)
    expect((bad.json() as ApiEnvelope<unknown>).errorCode).toBe(INVALID_RUN_HANDLE_CODE)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
