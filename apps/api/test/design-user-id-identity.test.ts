// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Design 预览/评论的归属字段回归(2026-09-25,同型 P0:apps/api/src/routes/tasks.ts:270)
//
// 缺陷指纹:`userId: Number(userId)` 对 users.id 的 UUID 恒得 NaN,而**同一函数内**紧邻的
// userName 用的是 string 形态的 userId ⇒ 显示名一直正常、归属字段一直是 null。
// Redis 分区键 userKey(userId) 本来就是 string uuid,所以隔离没坏、只有字段坏 ——
// 这也是为什么此前没有任何测试抓到它:既有 design-preview.test.ts 把身份 mock 成 '1',
// Number('1') 恰好等于 1,于是断言 userId: 1 一直为真。
// 本文件用**真实 uuid 形态的身份**跑通全链(不 mock 鉴权判据),把这条钉死。
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { signAccessToken } from '@ihui/auth'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

const redis = vi.hoisted(() => ({
  store: new Map<string, string>(),
  lists: new Map<string, string[]>(),
  keys: [] as string[],
}))

function createMockRedis() {
  return {
    get: vi.fn(async (k: string) => {
      redis.keys.push(k)
      return redis.store.get(k) ?? null
    }),
    set: vi.fn(async (k: string, v: string) => {
      redis.store.set(k, v)
      return 'OK'
    }),
    lpush: vi.fn(async (k: string, v: string) => {
      const arr = redis.lists.get(k) ?? []
      arr.unshift(v)
      redis.lists.set(k, arr)
      return arr.length
    }),
    lrange: vi.fn(async (k: string, start: number, end: number) => {
      const arr = redis.lists.get(k) ?? []
      const len = arr.length
      const s = start < 0 ? Math.max(len + start, 0) : start
      const e = end < 0 ? len + end + 1 : end + 1
      return arr.slice(s, e)
    }),
  }
}

import { designRoutes } from '../src/routes/design.js'

/** users.id 的真实形态:UUID 字符串。绝不能用 '1' —— 那会让 Number() 假装有值。 */
const USER_UUID = 'cccccccc-3333-4333-8333-cccccccccccc'

describe('/design 归属字段(P0 同型回归)', () => {
  let app: FastifyInstance
  let headers: Record<string, string> = {}

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.decorate('redis', createMockRedis() as never)
    await app.register(designRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    redis.store.clear()
    redis.lists.clear()
    redis.keys.length = 0
    const token = await signAccessToken({
      userId: USER_UUID,
      phone: '',
      familyId: 'f-1',
      roleId: 0,
    })
    headers = { authorization: `Bearer ${token}` }
  })

  it('POST /design/preview:userId 是调用者的 UUID,而不是 null / NaN', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/design/preview',
      headers,
      payload: { name: '登录页', html: '<div>hello</div>' },
    })
    expect(res.statusCode).toBe(201)
    const preview = (res.json() as { data: { preview: { userId: unknown } } }).data.preview
    expect(preview.userId).toBe(USER_UUID)
    // 落进 Redis 的那份也必须带归属(缺陷形态下 JSON.stringify(NaN) → null)
    const stored = redis.store.get(`design-preview:${USER_UUID}`)
    expect(stored).toBeTruthy()
    expect(stored).toContain(USER_UUID)
    expect(stored).not.toContain('"userId":null')
  })

  it('GET /design/previews:回读同一条记录的 userId 仍是 UUID', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/design/preview',
      headers,
      payload: { name: 'A', html: '<p>x</p>' },
    })
    const res = await app.inject({ method: 'GET', url: '/api/design/previews', headers })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: { previews: { userId: unknown }[] } }
    expect(body.data.previews).toHaveLength(1)
    expect(body.data.previews[0]?.userId).toBe(USER_UUID)
    // 隔离仍按 string uuid 分区(这一条修复前后都成立,登记在此是为了防止"顺手改坏键")
    expect(redis.keys).toContain(`design-preview:${USER_UUID}`)
  })

  it('POST /design/comments:同一对象内 userId 与 userName 同源(都是 UUID 字符串)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/design/comments',
      headers,
      payload: { previewId: 'p-1', content: '这里改一下' },
    })
    expect(res.statusCode).toBe(201)
    const comment = (res.json() as { data: { userId: unknown; userName: string } }).data
    expect(comment.userId).toBe(USER_UUID)
    // 指纹:phone 为空时 userName 走 `User ${userId}`,它一直是好的;
    // 两字段必须同源同形态,否则就是"显示名正常、归属字段坏"的那一型。
    expect(comment.userName).toBe(`User ${USER_UUID}`)
    const raw = redis.lists.get('design-comments:p-1')?.[0]
    expect(raw).toBeTruthy()
    expect(raw).toContain(USER_UUID)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
