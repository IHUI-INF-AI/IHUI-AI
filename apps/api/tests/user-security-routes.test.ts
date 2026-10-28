// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const AUTH_USER_ID = '11111111-1111-4111-8111-111111111111'
const VICTIM_USER_ID = '22222222-2222-4222-8222-222222222222'

const q = vi.hoisted(() => ({
  checkAuth: vi.fn(),
  findUserById: vi.fn(),
  findUserPreferences: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({ checkAuth: q.checkAuth }))
vi.mock('../src/db/queries.js', () => ({ findUserById: q.findUserById }))
vi.mock('../src/db/user-preferences-queries.js', () => ({
  // 具名出口在查询层;这里只把 group 词表按同一取值交出去,路由若抄别的字面量当场可见
  USER_PREFERENCE_GROUPS: { security: 'security' },
  findUserPreferences: q.findUserPreferences,
}))

import { userSecurityRoutes } from '../src/routes/user-security-routes.js'

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify()
  await app.register(userSecurityRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
  // 真 checkAuth 的契约:成功后把令牌主体写进 request.userId,由承载层显式注入
  q.checkAuth.mockImplementation(async (request: { userId?: string }) => {
    request.userId = AUTH_USER_ID
    return true
  })
  q.findUserById.mockResolvedValue({ passwordHash: '$2b$12$hash', twoFactorEnabled: true })
  q.findUserPreferences.mockResolvedValue({
    list: [{ id: 'p1', group: 'security', key: 'biometric', value: '1', updatedAt: new Date() }],
    total: 1,
  })
})

describe('GET /api/user/security', () => {
  it('四项开关逐一映射:password_hash 非空即已设密码、2FA 取列值、偏好按 group=security 读', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/user/security' })
    expect(res.statusCode).toBe(200)
    expect(q.findUserById).toHaveBeenCalledWith(AUTH_USER_ID)
    expect(q.findUserPreferences).toHaveBeenCalledWith(AUTH_USER_ID, 'security')
    expect(res.json().data).toEqual({
      passwordEnabled: true,
      biometricEnabled: true,
      twoFactorEnabled: true,
      loginAlert: false,
    })
  })

  it('未配置如实回落 false(不写死 true、不返回 null 打碎 boolean 契约)', async () => {
    q.findUserById.mockResolvedValue({ passwordHash: null, twoFactorEnabled: false })
    q.findUserPreferences.mockResolvedValue({ list: [], total: 0 })
    const res = await app.inject({ method: 'GET', url: '/api/user/security' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({
      passwordEnabled: false,
      biometricEnabled: false,
      twoFactorEnabled: false,
      loginAlert: false,
    })
    for (const value of Object.values(res.json().data)) expect(typeof value).toBe('boolean')
  })

  it('用户不存在返回 404 且不再读偏好', async () => {
    q.findUserById.mockResolvedValue(undefined)
    const res = await app.inject({ method: 'GET', url: '/api/user/security' })
    expect(res.statusCode).toBe(404)
    expect(q.findUserPreferences).not.toHaveBeenCalled()
  })
})

describe('反向断言:鉴权先于取数 / 自报身份无效 / 非法参数零查询', () => {
  it('① 无凭据 ⇒ 401 且一次查询都不发(副作用没发生)', async () => {
    q.checkAuth.mockImplementation(
      async (_request: unknown, reply: { status: (n: number) => { send: (b: unknown) => unknown } }) => {
        reply.status(401).send({ code: 401, message: '请先登录', data: null })
        return false
      },
    )
    const res = await app.inject({ method: 'GET', url: '/api/user/security' })
    expect(res.statusCode).toBe(401)
    expect(q.findUserById).not.toHaveBeenCalled()
    expect(q.findUserPreferences).not.toHaveBeenCalled()
  })

  it('② 客户端自报 userId 无效:既不被采纳也不被静默摘除 ⇒ 400 且零查询', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/user/security?userId=${VICTIM_USER_ID}` })
    expect(res.statusCode).toBe(400)
    expect(q.findUserById).not.toHaveBeenCalled()
    expect(q.findUserPreferences).not.toHaveBeenCalled()
    // 正向对照:同样这对查询在带凭据的合法请求里确实发了,且用的是钩子注入的主体
    const ok = await app.inject({ method: 'GET', url: '/api/user/security' })
    expect(ok.statusCode).toBe(200)
    expect(q.findUserById).toHaveBeenCalledWith(AUTH_USER_ID)
    expect(q.findUserById).not.toHaveBeenCalledWith(VICTIM_USER_ID)
  })

  it('③ 非法分页/参数 ⇒ 400 且零查询', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/user/security?page=abc' })
    expect(res.statusCode).toBe(400)
    expect(q.findUserById).not.toHaveBeenCalled()
    expect(q.findUserPreferences).not.toHaveBeenCalled()
  })
})

describe('注册即装车(造好没接线是本仓最高频失效型)', () => {
  const HERE = dirname(fileURLToPath(import.meta.url))
  const apiRoot = resolve(HERE, '..')
  const INDEX_PATH = 'apps/api/src/routes/index.ts'

  // 派生 git 必须显式接管 stdio(§12g),cwd 不可靠 ⇒ 一律 -C 到仓库根
  const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }).trim()

  const judge = (src: string) =>
    /import\s*\{\s*userSecurityRoutes\s*\}\s*from\s*'\.\/user-security-routes\.js'/u.test(src) &&
    /server\.register\(\s*userSecurityRoutes\s*,\s*\{\s*prefix:\s*'\/api'\s*\}\s*\)/u.test(src)

  it('routes/index.ts 必须 import 且以 prefix /api 注册 userSecurityRoutes', () => {
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
    // 未落地的那一刻:HEAD 里没有这一行 ⇒ 判据必须给 false。
    // 落地后两面同形 ⇒ 同一条判据在 HEAD 也必须给 true(否则取材面读错了)。
    if (headSrc === worktreeSrc) {
      expect(judge(headSrc)).toBe(true)
    } else {
      expect(judge(headSrc)).toBe(false)
    }
    expect(judge(worktreeSrc)).toBe(true)
    // 取材面自证:HEAD 面确实装着上一枚已落地的同类注册(不是空串糊出来的 false)
    expect(
      /server\.register\(\s*courseMobileRoutes\s*,\s*\{\s*prefix:\s*'\/api'\s*\}\s*\)/u.test(headSrc),
    ).toBe(true)
  })

  it('路由内字面量 + 注册 prefix 合成后逐字等于 RN 调用点(漂移即红)', () => {
    const routeSrc = readFileSync(join(apiRoot, 'src/routes/user-security-routes.ts'), 'utf8')
    const inner = new Set([...routeSrc.matchAll(/server\.get\(\s*'([^']*)'/gu)].map((m) => `/api${m[1]}`))
    const screenSrc = readFileSync(
      join(apiRoot, '../mobile-rn/src/screens/SecuritySettingsScreen.tsx'),
      'utf8',
    )
    const called = [...screenSrc.matchAll(/fetchApi<[^>]*>\(\s*'([^']+)'/gu)].map((m) => m[1])
    expect(called).toContain('/user/security')
    for (const p of called) expect(inner.has(`/api${p}`), `/api${p} 未在册`).toBe(true)
    expect(inner.size).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
