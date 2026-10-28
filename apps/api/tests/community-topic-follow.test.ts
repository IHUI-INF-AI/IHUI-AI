// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * POST /api/circles/topic/:tid/follow 形状锁(守门 8 裸路径 BP 腿死调用补注册)。
 *
 * 钉住四件事:
 *  ① 关注关系落在 subscriptions 表(经 social-queries 的 subscribe/unsubscribe,路由不重写 SQL),
 *     target_type 取 'tag' —— social.ts 的 TARGET_TYPES 在册值,不是新档位、不是新迁移;
 *  ② 一次 POST 翻转一次(两端调用点声明的语义),翻转前态由 isSubscribed 量出来,不靠客户端自报;
 *  ③ followerCount 是 countSubscribers 的 COUNT(*) 实算,不是 +1/−1 累加;
 *  ④ 归属只认 JWT 主体:话题不存在 ⇒ 404 且零写;id 非 uuid ⇒ 400 且不进库;未登录 ⇒ 401 且零写。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333'
const VICTIM_USER_ID = '44444444-4444-4444-8444-444444444444'
const TAG_ID = '77777777-7777-4777-8777-777777777777'

const q = vi.hoisted(() => ({
  authenticate: vi.fn(),
  checkAuth: vi.fn(),
  findTagById: vi.fn(),
  isSubscribed: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  countSubscribers: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({ checkAuth: q.checkAuth, authenticate: q.authenticate }))
vi.mock('../src/db/social-queries.js', () => ({
  findTagById: q.findTagById,
  isSubscribed: q.isSubscribed,
  subscribe: q.subscribe,
  unsubscribe: q.unsubscribe,
  countSubscribers: q.countSubscribers,
}))
vi.mock('../src/db/sensitive-words-queries.js', () => ({
  sanitizeUgcInput: vi.fn().mockResolvedValue({ ok: true, fields: { content: { text: '' } } }),
}))
// 本族其它路由会真取库 ⇒ 一律 mock,测试结构上不连生产/共享实例(§5 测试隔离铁律)
vi.mock('../src/db/index.js', () => {
  const chain = (): Record<string, unknown> =>
    new Proxy({} as Record<string, unknown>, {
      get: (_t, prop: string) =>
        prop === 'then'
          ? (resolve: (v: unknown) => void) => resolve([])
          : vi.fn().mockReturnValue(chain()),
    })
  return { db: chain(), dbRead: chain(), dbClient: {} }
})

import topicsRoutes from '../src/routes/community/topics.js'

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify()
  await app.register(topicsRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
  q.authenticate.mockImplementation(async (request: { userId?: string }) => {
    request.userId = AUTH_USER_ID
  })
  q.findTagById.mockResolvedValue({ id: TAG_ID, name: '路亚', usageCount: 3 })
  q.isSubscribed.mockResolvedValue(false)
  q.subscribe.mockResolvedValue(undefined)
  q.unsubscribe.mockResolvedValue(undefined)
  q.countSubscribers.mockResolvedValue(7)
})

const followUrl = (tid: string) => `/api/circles/topic/${tid}/follow`

describe('POST /api/circles/topic/:tid/follow', () => {
  it('未关注 ⇒ 落一条 tag 订阅,返回 followed:true,followerCount 取实算的 7(不是 0+1)', async () => {
    const res = await app.inject({ method: 'POST', url: followUrl(TAG_ID), body: {} })
    expect(res.statusCode).toBe(200)
    expect(q.findTagById).toHaveBeenCalledWith(TAG_ID)
    expect(q.isSubscribed).toHaveBeenCalledWith({
      userId: AUTH_USER_ID,
      targetType: 'tag',
      targetId: TAG_ID,
    })
    expect(q.subscribe).toHaveBeenCalledWith({
      userId: AUTH_USER_ID,
      targetType: 'tag',
      targetId: TAG_ID,
    })
    expect(q.unsubscribe).not.toHaveBeenCalled()
    expect(q.countSubscribers).toHaveBeenCalledWith('tag', TAG_ID)
    expect(res.json().data).toEqual({ topicId: TAG_ID, followed: true, followerCount: 7 })
    expect(res.json().code).toBe(0)
  })

  it('已关注 ⇒ 再点一次走 unsubscribe 并返回 followed:false(翻转,不是幂等 upsert)', async () => {
    q.isSubscribed.mockResolvedValue(true)
    q.countSubscribers.mockResolvedValue(6)
    const res = await app.inject({ method: 'POST', url: followUrl(TAG_ID), body: {} })
    expect(res.statusCode).toBe(200)
    expect(q.unsubscribe).toHaveBeenCalledWith({
      userId: AUTH_USER_ID,
      targetType: 'tag',
      targetId: TAG_ID,
    })
    expect(q.subscribe).not.toHaveBeenCalled()
    expect(res.json().data).toEqual({ topicId: TAG_ID, followed: false, followerCount: 6 })
  })

  it('话题不存在 ⇒ 404,且不落一条指向不存在话题的订阅(零写)', async () => {
    q.findTagById.mockResolvedValue(undefined)
    const res = await app.inject({ method: 'POST', url: followUrl(TAG_ID), body: {} })
    expect(res.statusCode).toBe(404)
    expect(q.subscribe).not.toHaveBeenCalled()
    expect(q.unsubscribe).not.toHaveBeenCalled()
    expect(q.isSubscribed).not.toHaveBeenCalled()
    expect(q.countSubscribers).not.toHaveBeenCalled()
  })

  it('id 非 uuid(旧 circle_dynamic 整数域)⇒ 400 且零查询零写', async () => {
    for (const tid of ['123', '0', 'abc', '']) {
      const res = await app.inject({ method: 'POST', url: followUrl(tid), body: {} })
      expect(res.statusCode, tid).toBe(400)
    }
    expect(q.findTagById).not.toHaveBeenCalled()
    expect(q.subscribe).not.toHaveBeenCalled()
    expect(q.unsubscribe).not.toHaveBeenCalled()
  })

  it('未登录 ⇒ 401 且零查询零写(归属不得由客户端补)', async () => {
    q.authenticate.mockImplementation(async () => {
      throw Object.assign(new Error('请先登录'), { statusCode: 401 })
    })
    const res = await app.inject({ method: 'POST', url: followUrl(TAG_ID), body: {} })
    expect(res.statusCode).toBe(401)
    expect(q.findTagById).not.toHaveBeenCalled()
    expect(q.subscribe).not.toHaveBeenCalled()
    expect(q.unsubscribe).not.toHaveBeenCalled()
  })

  it('客户端自报 userId 无效:body/query 里的身份进不了写入口径', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${followUrl(TAG_ID)}?userId=${VICTIM_USER_ID}`,
      body: { userId: VICTIM_USER_ID, user_id: VICTIM_USER_ID },
    })
    expect(res.statusCode).toBe(200)
    const written = JSON.stringify(q.subscribe.mock.calls)
    expect(written).not.toContain(VICTIM_USER_ID)
    expect(q.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userId: AUTH_USER_ID, targetType: 'tag' }),
    )
  })
})

describe('注册即装车 + 调用点逐字对账(判"做不了"要有证据,判"做了"也要)', () => {
  const HERE = dirname(fileURLToPath(import.meta.url))
  const apiRoot = resolve(HERE, '..')
  const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }).trim()

  const readHead = (rel: string) =>
    execFileSync('git', ['-C', REPO_ROOT, 'show', `HEAD:${rel}`], {
      encoding: 'utf8',
      maxBuffer: 1 << 26,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

  it('routes/index.ts 仍把 communityRoutes 以 prefix /api 挂上(前缀合成才是 /api/circles/…)', () => {
    const src = readFileSync(join(apiRoot, 'src/routes/index.ts'), 'utf8')
    expect(
      /server\.register\(\s*communityRoutes\s*,\s*\{\s*prefix:\s*'\/api'\s*\}\s*\)/u.test(src),
    ).toBe(true)
    // community.ts 是 hub,topics 子路由必须在 hub 里注册
    const hub = readFileSync(join(apiRoot, 'src/routes/community.ts'), 'utf8')
    expect(/server\.register\(\s*topicsRoutes\s*\)/u.test(hub)).toBe(true)
  })

  it('路由字面量合成 /api 前缀后,逐字等于 RN 与小程序两条调用点(漂移即红)', () => {
    const routeSrc = readFileSync(join(apiRoot, 'src/routes/community/topics.ts'), 'utf8')
    const inner = new Set(
      [...routeSrc.matchAll(/server\.post\(\s*'([^']*)'/gu)].map((m) => `/api${m[1]}`),
    )
    expect(inner.has('/api/circles/topic/:tid/follow')).toBe(true)

    const rnSrc = readFileSync(
      join(apiRoot, '../mobile-rn/src/screens/TopicDetailScreen.tsx'),
      'utf8',
    )
    const taroSrc = readFileSync(
      join(apiRoot, '../miniapp-taro/src/pkg-content/topic/detail.tsx'),
      'utf8',
    )
    const rnCalled = [...rnSrc.matchAll(/fetchApi\(\s*`([^`]+)`/gu)].map((m) => m[1] ?? '')
    const taroCalled = [...taroSrc.matchAll(/post\(\s*`([^`]+)`/gu)].map((m) => m[1] ?? '')
    const topicCalls = [...rnCalled, ...taroCalled].filter((p) => p.includes('/circles/topic/'))
    // 两端各一条话题关注调用点,少了任何一端 = 跨端漂移(§9 多端同步)
    expect(topicCalls.length).toBeGreaterThanOrEqual(2)
    // 把 `${...}` 插值段折成 :param 后必须逐字命中在册形状(与守门 8 BP 腿同一归一)
    for (const p of topicCalls) {
      expect(inner.has(`/api${p.replace(/\$\{[^}]*\}/gu, ':tid')}`), p).toBe(true)
    }
  })

  it('target_type 用的是在册档位:落点字面量 = social.ts TARGET_TYPES 里的 tag', () => {
    const routeSrc = readFileSync(join(apiRoot, 'src/routes/community/topics.ts'), 'utf8')
    expect(/const TOPIC_TARGET_TYPE = 'tag'/u.test(routeSrc)).toBe(true)
    const socialSrc = readFileSync(join(apiRoot, 'src/routes/social.ts'), 'utf8')
    expect(
      /const TARGET_TYPES = \['user', 'project', 'tag', 'category'\] as const/u.test(socialSrc),
    ).toBe(true)
  })

  it('零迁移证据:话题关注落进 subscriptions 既有列(varchar target_type/target_id + 联合唯一)', () => {
    const schemaSrc = readFileSync(
      join(apiRoot, '../../packages/database/src/schema/social.ts'),
      'utf8',
    )
    expect(
      /targetType: varchar\('target_type', \{ length: 32 \}\)\.notNull\(\)/u.test(schemaSrc),
    ).toBe(true)
    expect(
      /targetId: varchar\('target_id', \{ length: 128 \}\)\.notNull\(\)/u.test(schemaSrc),
    ).toBe(true)
    expect(/unique\(\)\.on\(t\.userId, t\.targetType, t\.targetId\)/u.test(schemaSrc)).toBe(true)
    // 反向锁:user_follows 仍是纯「用户↔用户」(两侧都是 users FK)⇒ 话题放不进它,
    // 本轮没有偷偷往那张表塞第三种目标
    const followsBlock = schemaSrc.slice(
      schemaSrc.indexOf('export const userFollows'),
      schemaSrc.indexOf('export const userFavorites'),
    )
    expect(followsBlock).not.toMatch(/topic/iu)
    expect(followsBlock.match(/references\(\(\) => users\.id/gu)?.length).toBe(2)
  })

  it('双向对照:HEAD 面尚未落地时这条路由必须读不到、已落地时两面同形(判据不是恒真)', () => {
    const headSrc = readHead('apps/api/src/routes/community/topics.ts')
    const worktreeSrc = readFileSync(join(apiRoot, 'src/routes/community/topics.ts'), 'utf8')
    expect(/\/circles\/topic\/:tid\/follow/u.test(worktreeSrc)).toBe(true)
    if (headSrc === worktreeSrc) {
      // 本次注册已落地 ⇒ 两面同形,判据在 HEAD 同样必须给 true(否则是取材面读错)
      expect(/\/circles\/topic\/:tid\/follow/u.test(headSrc)).toBe(true)
    } else {
      expect(/\/circles\/topic\/:tid\/follow/u.test(headSrc)).toBe(false)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
