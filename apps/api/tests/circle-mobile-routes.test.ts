// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333'
const VICTIM_USER_ID = '44444444-4444-4444-8444-444444444444'
const CANDIDATE_A = '55555555-5555-4555-8555-555555555555'
const CANDIDATE_B = '66666666-6666-4666-8666-666666666666'
const TAG_X = '77777777-7777-4777-8777-777777777777'
const TAG_Y = '88888888-8888-4888-8888-888888888888'

const q = vi.hoisted(() => ({
  checkAuth: vi.fn(),
  authenticate: vi.fn(),
  findRecommendedUsers: vi.fn(),
  findFollowingIds: vi.fn(),
  findHotTags: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({ checkAuth: q.checkAuth, authenticate: q.authenticate }))
vi.mock('../src/db/social-queries.js', () => ({
  findRecommendedUsers: q.findRecommendedUsers,
  findFollowingIds: q.findFollowingIds,
  findHotTags: q.findHotTags,
}))

import { circleMobileRoutes } from '../src/routes/circle-mobile-routes.js'

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify()
  await app.register(circleMobileRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
  q.checkAuth.mockImplementation(async (request: { userId?: string }) => {
    request.userId = AUTH_USER_ID
    return true
  })
  q.findRecommendedUsers.mockResolvedValue({
    list: [
      {
        id: CANDIDATE_A,
        nickname: '甲',
        avatar: 'https://cdn/a.png',
        bio: '写代码的',
        followerCount: 42,
      },
      { id: CANDIDATE_B, nickname: null, avatar: null, bio: null, followerCount: 7 },
    ],
    total: 2,
  })
  q.findFollowingIds.mockResolvedValue([CANDIDATE_A])
  q.findHotTags.mockResolvedValue({
    list: [
      { id: TAG_X, name: '人工智能', slug: 'rengongzhineng', usageCount: 12, description: null },
      { id: TAG_Y, name: '路亚', slug: 'luya', usageCount: 3, description: '钓鱼' },
    ],
    total: 2,
  })
})

describe('GET /api/circles/users/recommend', () => {
  it('list 内逐条给 id/nickname/avatar/bio/followed;昵称缺失如实给空串,空 avatar/bio 不出现', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/circles/users/recommend?page=1&pageSize=10',
    })
    expect(res.statusCode).toBe(200)
    expect(q.findRecommendedUsers).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      excludeUserId: AUTH_USER_ID,
    })
    expect(q.findFollowingIds).toHaveBeenCalledWith(AUTH_USER_ID, [CANDIDATE_A, CANDIDATE_B])
    expect(res.json().data.list).toEqual([
      {
        id: CANDIDATE_A,
        nickname: '甲',
        avatar: 'https://cdn/a.png',
        bio: '写代码的',
        followed: true,
      },
      { id: CANDIDATE_B, nickname: '', followed: false },
    ])
    expect(res.json().data.total).toBe(2)
  })

  it('副榜为空时不逐行查关注(候选集原样交给查询层,由查询层短路)', async () => {
    q.findRecommendedUsers.mockResolvedValue({ list: [], total: 0 })
    const res = await app.inject({ method: 'GET', url: '/api/circles/users/recommend' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.list).toEqual([])
    expect(q.findFollowingIds).toHaveBeenCalledWith(AUTH_USER_ID, [])
  })
})

describe('GET /api/circles/topics/hot', () => {
  it('list 逐条只给 id/name/count 三键;count 就是 tags.usage_count 真列,不现造数字', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/circles/topics/hot?page=1&pageSize=10',
    })
    expect(res.statusCode).toBe(200)
    expect(q.findHotTags).toHaveBeenCalledWith({ page: 1, pageSize: 10 })
    expect(res.json().data.list).toEqual([
      { id: TAG_X, name: '人工智能', count: 12 },
      { id: TAG_Y, name: '路亚', count: 3 },
    ])
    expect(res.json().data.total).toBe(2)
    // slug/description 不外泄:调用方契约 HotTopic{id,name,count} 之外一个键都不给
    expect(Object.keys(res.json().data.list[0]).sort()).toEqual(['count', 'id', 'name'])
  })

  it('榜为空 ⇒ 空数组 + total 0(调用方静默渲染,不是报错)', async () => {
    q.findHotTags.mockResolvedValue({ list: [], total: 0 })
    const res = await app.inject({
      method: 'GET',
      url: '/api/circles/topics/hot?page=1&pageSize=10',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.list).toEqual([])
    expect(res.json().data.total).toBe(0)
  })

  it('非法分页 ⇒ 400 且零查询(与推荐关注共用 parsePagination)', async () => {
    for (const qs of ['page=0', 'page=abc', 'pageSize=101', 'pageSize=-1']) {
      const res = await app.inject({ method: 'GET', url: `/api/circles/topics/hot?${qs}` })
      expect(res.statusCode, qs).toBe(400)
    }
    expect(q.findHotTags).not.toHaveBeenCalled()
  })

  it('本榜不读身份:自报 userId 进不了查询参数(整条仍要登录)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/circles/topics/hot?page=1&pageSize=10&userId=${VICTIM_USER_ID}`,
    })
    expect(res.statusCode).toBe(200)
    expect(q.findHotTags).toHaveBeenCalledWith({ page: 1, pageSize: 10 })
    expect(
      q.findHotTags.mock.calls.every((call) => !JSON.stringify(call).includes(VICTIM_USER_ID)),
    ).toBe(true)
  })

  it('无凭据 ⇒ 401 且零查询', async () => {
    q.checkAuth.mockImplementation(
      async (
        _request: unknown,
        reply: { status: (n: number) => { send: (b: unknown) => unknown } },
      ) => {
        reply.status(401).send({ code: 401, message: '请先登录', data: null })
        return false
      },
    )
    const res = await app.inject({
      method: 'GET',
      url: '/api/circles/topics/hot?page=1&pageSize=10',
    })
    expect(res.statusCode).toBe(401)
    expect(q.findHotTags).not.toHaveBeenCalled()
  })
})

describe('反向断言:鉴权先于取数 / 自报身份无效 / 非法分页零查询', () => {
  it('① 无凭据 ⇒ 401 且一次查询都不发(副榜静默失败,主榜不受影响)', async () => {
    q.checkAuth.mockImplementation(
      async (
        _request: unknown,
        reply: { status: (n: number) => { send: (b: unknown) => unknown } },
      ) => {
        reply.status(401).send({ code: 401, message: '请先登录', data: null })
        return false
      },
    )
    const res = await app.inject({
      method: 'GET',
      url: '/api/circles/users/recommend?page=1&pageSize=10',
    })
    expect(res.statusCode).toBe(401)
    expect(q.findRecommendedUsers).not.toHaveBeenCalled()
    expect(q.findFollowingIds).not.toHaveBeenCalled()
  })

  it('② 客户端自报 userId 无效:followed 只按钩子注入的主体算', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/circles/users/recommend?page=1&pageSize=10&userId=${VICTIM_USER_ID}&user_id=${VICTIM_USER_ID}`,
    })
    expect(res.statusCode).toBe(200)
    expect(q.findRecommendedUsers).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      excludeUserId: AUTH_USER_ID,
    })
    expect(q.findFollowingIds).toHaveBeenCalledWith(AUTH_USER_ID, [CANDIDATE_A, CANDIDATE_B])
    expect(q.findRecommendedUsers).not.toHaveBeenCalledWith(
      expect.objectContaining({ excludeUserId: VICTIM_USER_ID }),
    )
    expect(q.findFollowingIds.mock.calls.every((call) => call[0] === AUTH_USER_ID)).toBe(true)
  })

  it('③ 非法分页参数 ⇒ 400 且零查询(沿用 user/_shared 的 parsePagination,不另写一份)', async () => {
    for (const qs of ['page=0', 'page=abc', 'pageSize=101', 'pageSize=-1']) {
      const res = await app.inject({ method: 'GET', url: `/api/circles/users/recommend?${qs}` })
      expect(res.statusCode, qs).toBe(400)
    }
    expect(q.findRecommendedUsers).not.toHaveBeenCalled()
    expect(q.findFollowingIds).not.toHaveBeenCalled()
  })
})

describe('注册即装车(造好没接线是本仓最高频失效型)', () => {
  const HERE = dirname(fileURLToPath(import.meta.url))
  const apiRoot = resolve(HERE, '..')
  const INDEX_PATH = 'apps/api/src/routes/index.ts'

  const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }).trim()

  const judge = (src: string) =>
    /import\s*\{\s*circleMobileRoutes\s*\}\s*from\s*'\.\/circle-mobile-routes\.js'/u.test(src) &&
    /server\.register\(\s*circleMobileRoutes\s*,\s*\{\s*prefix:\s*'\/api'\s*\}\s*\)/u.test(src)

  it('routes/index.ts 必须 import 且以 prefix /api 注册 circleMobileRoutes', () => {
    const worktreeSrc = readFileSync(join(apiRoot, 'src/routes/index.ts'), 'utf8')
    expect(judge(worktreeSrc)).toBe(true)
  })

  it('双向对照:同一判据喂 HEAD 面必须 false、喂工作树面必须 true(判据有牙,不是恒真)', () => {
    const worktreeSrc = readFileSync(join(apiRoot, 'src/routes/index.ts'), 'utf8')
    const headSrc = execFileSync('git', ['-C', REPO_ROOT, 'show', `HEAD:${INDEX_PATH}`], {
      encoding: 'utf8',
      maxBuffer: 1 << 26,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    if (headSrc === worktreeSrc) {
      // 本次注册已落地 ⇒ 两面同形,判据在 HEAD 同样必须给 true(否则是取材面读错)
      expect(judge(headSrc)).toBe(true)
    } else {
      expect(judge(headSrc)).toBe(false)
    }
    expect(judge(worktreeSrc)).toBe(true)
    expect(
      /server\.register\(\s*courseMobileRoutes\s*,\s*\{\s*prefix:\s*'\/api'\s*\}\s*\)/u.test(
        headSrc,
      ),
    ).toBe(true)
  })

  it('路由内字面量 + 注册 prefix 合成后逐字等于 RN/小程序两处调用点(漂移即红)', () => {
    const routeSrc = readFileSync(join(apiRoot, 'src/routes/circle-mobile-routes.ts'), 'utf8')
    const inner = new Set(
      [...routeSrc.matchAll(/server\.get\(\s*'([^']*)'/gu)].map((m) => `/api${m[1]}`),
    )
    const rnSrc = readFileSync(
      join(apiRoot, '../mobile-rn/src/screens/CircleIndexScreen.tsx'),
      'utf8',
    )
    const taroSrc = readFileSync(
      join(apiRoot, '../miniapp-taro/src/pages/circle/index.tsx'),
      'utf8',
    )
    const rnCalled = [
      ...rnSrc.matchAll(/fetchApi<(?:UserListRes|TopicListRes)>\(\s*'([^']+)'/gu),
    ].map((m) => m[1])
    const taroCalled = [
      ...taroSrc.matchAll(/get<(?:UserListRes|TopicListRes)>\(\s*'([^']+)'/gu),
    ].map((m) => m[1])
    expect(rnCalled).toContain('/circles/users/recommend')
    expect(taroCalled).toContain('/circles/users/recommend')
    expect(rnCalled).toContain('/circles/topics/hot')
    expect(taroCalled).toContain('/circles/topics/hot')
    for (const p of [...rnCalled, ...taroCalled]) {
      expect(inner.has(`/api${p}`), `/api${p} 未在册`).toBe(true)
    }
    expect(inner.size).toBe(2)
  })

  it('整条要登录:preHandler 用 checkAuth,不落在任何公开读面白名单里', () => {
    const routeSrc = readFileSync(join(apiRoot, 'src/routes/circle-mobile-routes.ts'), 'utf8')
    expect(/addHook\(\s*'preHandler'/.test(routeSrc)).toBe(true)
    expect(/checkAuth\(request, reply\)/.test(routeSrc)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
