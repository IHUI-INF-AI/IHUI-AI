// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-413 残余敞口① —— SSO 服务端**签发侧**的反斜杠洞(2026-10-01 立)。
 *
 * 病灶(HEAD 现读 `apps/api/src/routes/auth-sso.ts:125`):
 *   if (s.startsWith('/') && !s.startsWith('//')) return true
 * ⇒ `/\evil.com` 被当作"站内相对路径"放行,而 WHATWG 解析器在 special-scheme 的
 * "special authority ignore slashes" 状态里把 `\` 与 `/` **等值处理**,于是它落到
 * `https://evil.com` —— 而这一跳携带的正是刚签发的 sso_code(30 秒一次性授权码)。
 * web 侧那把尺子(`apps/web/src/lib/sso-redirect-guard.ts` 的 `isSameOriginRelative`)
 * 2026-09-28 已补第二字符 `\` 判据,服务端这把没有 ⇒ 两把尺子对同一件事各判各的。
 *
 * 为什么打真路由而不是单测那个函数:`isSafeRedirectUri` 是模块私有的 const,且它的
 * 真实语义由 `generateCodeSchema.refine` → `/sso/code` handler 决定;"签发没发生"这一
 * 副作用判据只能从端点这一层量(只断言状态码会放过"先落了库再抛错"那一型)。
 *
 * 测试隔离铁律(AGENTS §5):不连生产 PostgreSQL/Redis —— 鉴权面与 DB 面全桩,
 * redis 用内存 Map,签发副作用直接数 `redis.set` 的调用次数。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import type { Redis as IORedisClient } from 'ioredis'

const { mockAuthenticate, mockFindUserById, mockRedisSet, mockRedisGet, mockRedisDel } = vi.hoisted(
  () => ({
    mockAuthenticate: vi.fn(),
    mockFindUserById: vi.fn(),
    mockRedisSet: vi.fn(),
    mockRedisGet: vi.fn(),
    mockRedisDel: vi.fn(),
  }),
)

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: vi.fn(),
}))

vi.mock('../src/db/queries.js', () => ({
  findUserById: mockFindUserById,
  revokeAllUserRefreshTokens: vi.fn(),
  findRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
}))

vi.mock('../src/db/rbac-queries.js', () => ({ getUserPermissions: vi.fn() }))
vi.mock('../src/services/token-service.js', () => ({ issueTokenPair: vi.fn() }))

import { authSsoRoutes } from '../src/routes/auth-sso.js'

/** 本站 origin —— 判"这一跳出没跳出本站"的唯一基准 */
const SITE_ORIGIN = 'https://aizhs.top'

/** 已签发授权码的次数:`redis.set('sso:code:…')` 是签发唯一的落库动作 */
function issuedCount(): number {
  return mockRedisSet.mock.calls.length
}

async function requestSsoCode(redirectUri: string): Promise<{ statusCode: number; body: unknown }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sso/code',
    headers: { authorization: 'Bearer test-token' },
    payload: { clientId: 'web', redirectUri },
  })
  return { statusCode: res.statusCode, body: res.json() }
}

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  // 内存桩冒充 server.redis(签发副作用只有这一次 set);类型按插件的增广面收敛,不用 any
  app.decorate('redis', {
    set: mockRedisSet,
    get: mockRedisGet,
    del: mockRedisDel,
  } as unknown as IORedisClient)
  await app.register(authSsoRoutes, { prefix: '/api/auth' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  mockAuthenticate.mockReset()
  mockAuthenticate.mockImplementation(async (request: { userId?: string }) => {
    request.userId = 'user-001'
  })
  mockFindUserById.mockReset()
  mockFindUserById.mockResolvedValue({ id: 'user-001', phone: '13800000001', roleId: 0, familyId: 'fam-001' })
  mockRedisSet.mockReset()
  mockRedisGet.mockReset()
  mockRedisDel.mockReset()
})

describe('G-413① WHATWG 独立基准:哪些形态真的会离开本站', () => {
  // 这一组不碰被测代码,只量浏览器/node 同一套 URL 算法,给下面的判据提供"为什么必须拒"的依据。
  it.each([
    ['/\\evil.com', SITE_ORIGIN],
    ['/\\/evil.com', SITE_ORIGIN],
    ['//evil.com', SITE_ORIGIN],
    ['///evil.com', SITE_ORIGIN],
  ])('`%s` 借本站 base 解析后落到**别的 origin**(⇒ 必须拒)', (target, base) => {
    expect(new URL(target, base).origin).not.toBe(base)
  })

  it('`\\evil.com`(裸反斜杠开头)借本站 base 解析仍是站内 —— 拒它是"不接受任何非 / 开头形态"的既有档,不是新规则', () => {
    expect(new URL('\\evil.com', SITE_ORIGIN).origin).toBe(SITE_ORIGIN)
  })

  it('`/ /evil.com`(斜杠+空格)解析后**仍是本站**,与 `/\\evil.com` 不同族 ⇒ 不得为它新增"空格"规则', () => {
    const resolved = new URL('/ /evil.com', SITE_ORIGIN)
    expect(resolved.origin).toBe(SITE_ORIGIN)
    expect(resolved.pathname).toBe('/%20/evil.com')
  })

  it.each(['/learn?x=1', '/a\\b', '/dashboard'])(
    '站内相对 `%s` 解析后仍在本站 ⇒ 放行是功能正确,不是放过漏洞',
    (target) => {
      expect(new URL(target, SITE_ORIGIN).origin).toBe(SITE_ORIGIN)
    },
  )
})

describe('G-413① 签发侧必须拒掉的反斜杠 / 协议形态(断言副作用没发生)', () => {
  const refusedTargets = [
    '/\\evil.com', // 票面点名的洞:第二字符是反斜杠
    '/\\/evil.com', // 同族多反斜杠
    '//evil.com', // 协议相对(修复前已拒,当回归对照)
    '\\evil.com', // 不以 / 开头
    'https://evil.com', // 含协议 + 不在 env origin 白名单
    'javascript:alert(1)', // 自执行协议
    'data:text/html;base64,PHNjcmlwdD4=',
    'vfile://x', // 未注册的自定义 scheme
    'about:blank',
    '//evil.com/\\x', // 协议相对 + 反斜杠混写
  ]

  it.each(refusedTargets)('`%s` ⇒ 400 且**一个 code 都没签发**', async (target) => {
    const res = await requestSsoCode(target)
    expect(res.statusCode).toBe(400)
    // 副作用判据:签发 = redis.set('sso:code:<code>');只断 400 会放过"先落库再报错"
    expect(issuedCount()).toBe(0)
    expect(mockRedisSet.mock.calls.every(([key]) => !String(key).startsWith('sso:code:'))).toBe(true)
  })

  it('反斜杠形态的拒绝消息点名它是"站内相对路径"档的判据(不是被别的档误伤)', async () => {
    const res = await requestSsoCode('/\\evil.com')
    const body = res.body as { message?: string }
    expect(body.message).toContain('站内相对路径')
  })
})

describe('G-413① 正向对照:合法回跳仍照常签发(否则只是把功能改坏了)', () => {
  const acceptedTargets = [
    '/learn?x=1', // 站内相对 + query
    '/dashboard', // 站内相对(既有测试同款)
    '/a\\b', // 站内相对、路径**中段**含反斜杠:第二字符不是 \ ⇒ 不得受影响
    '/edu/edu-management/list?a=1&b=2',
  ]

  it.each(acceptedTargets)('`%s` ⇒ 200 且签发一个 code', async (target) => {
    const res = await requestSsoCode(target)
    expect(res.statusCode).toBe(200)
    const data = (res.body as { data?: { code?: string; redirectUri?: string } }).data
    expect(typeof data?.code).toBe('string')
    expect(data?.redirectUri).toBe(target)
    expect(issuedCount()).toBe(1)
    expect(mockRedisSet.mock.calls[0]?.[0]).toBe(`sso:code:${data?.code}`)
  })

  // 深链档与 localhost 档是 mobile-rn / desktop / cli 的 SSO 闭环(AGENTS §9),本票刻意不动。
  it('deep-link `ihui://sso/callback` 仍放行(env 未配 ⇒ 默认白名单 `ihui`)', async () => {
    const res = await requestSsoCode('ihui://sso/callback')
    expect(res.statusCode).toBe(200)
    expect(issuedCount()).toBe(1)
  })

  it('localhost 回调 `http://localhost:1738/callback` 仍放行(cli 本地回调服务器)', async () => {
    const res = await requestSsoCode('http://localhost:1738/callback')
    expect(res.statusCode).toBe(200)
    expect(issuedCount()).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
