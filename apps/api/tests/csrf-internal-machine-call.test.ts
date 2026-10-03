// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * #23 控制面断点:CSRF 钩子(onRequest)抢在路由鉴权之前 403,使
 * `Authorization: Bearer <AGENT_CONTROL_INTERNAL_SECRET>`(非 JWT 形态的裸密钥)
 * 形态的合法内部调用永远走不到自己的鉴权分支。
 *
 * 本文件把修复钉成四类断言(缺一不可,均不只测状态码):
 *  A. 阳性:密钥正确 + 非安全方法 + "像 bearer"的头 ⇒ 不被 CSRF 403,且**落到路由
 *     自己的内部密钥分支**(authenticate 未被调用才是走了那一支;只断 200 会把
 *     "JWT 分支碰巧也通"误当修复生效)。
 *  B. fail-closed:密钥错误/缺失/环境未配置 ⇒ 仍然拒;且豁免根据是**密钥验真**,
 *     不是路径、不是头名在场(旧写法 presence 即豁免,任何进程带头绕过 CSRF)。
 *  C. 回归对照:真浏览器形态(无 bearer、无内部凭据、缺 CSRF 对)仍被 403;
 *     isPlausibleBearerCredential 的既有形态豁免一个字没放宽。
 *  D. 授权先于写:越权尝试必须**没发出任何写/推送**(pending 登记数与端点表逐字
 *     不变)—— 只断 401/403 会放过"先改了状态再抛错"这一型(仓库既有要求)。
 *  E. 唯一实现形状锁:钩子与路由都经 utils/internal-principal,旧 presence-only
 *     豁免与路由本地密钥比较不得回来(行为断言对"换回旧写法"照样全绿的那一维,
 *     只能靠源码面钉 —— §22c 同型)。
 *
 * 夹具形态:mock 鉴权(不触真 JWT/DB)、mock config(显式密钥,不读 .env)、
 * mock db(internal-service-token.ts 静态依赖),与 internal-service-token-constant-time
 * / agent-control-addressed-delivery 两个既有夹具同源;不连生产 PG/Redis(§5 铁律)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'

// vi.mock 工厂被提升到文件顶部,工厂内引用的常量必须在 vi.hoisted 里(否则 TDZ)。
const { CTRL_SECRET, AI_CALLBACK_SECRET_TEST, TEST_JWT_SECRET } = vi.hoisted(() => ({
  CTRL_SECRET: 'ctrl-raw-secret-not-jwt-shaped-9f3a',
  AI_CALLBACK_SECRET_TEST: 'internal-secret-value-for-csrf-test-0123456789',
  TEST_JWT_SECRET: 'csrf-g373-machine-call-secret-at-least-32-chars-0123456789',
}))
/**
 * 形态合法但**签名伪造**的 JWT（反向对照用：必须不被 CSRF 豁免）。
 * 2026-10-04(G-373)起,判据是凭据自证而非形态,故本常量只出现在"必须 403"的断言里。
 */
const JWT_SHAPED_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1LTEifQ.ZmFrZXNpZw'

/** 内存形态的 developer_api_keys 表:替代真库(不连生产 PG,§5 测试隔离铁律)。 */
const { apiKeyTable } = vi.hoisted(() => ({
  apiKeyTable: new Map<string, { status: string; expiresAt: Date | null }>(),
}))

/** 用**本服务端密钥**现签一枚真 JWT（正向豁免用）。 */
async function signRealJwt(): Promise<string> {
  const { SignJWT } = await import('jose')
  return await new SignJWT({ phone: '', familyId: 'f1', roleId: 0 })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-1')
    .setIssuer('ihui-ai')
    .setAudience('ihui-ai-users')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(TEST_JWT_SECRET))
}

const { mockAuthenticate, mockCheckAuth, mockCheckAuthOrInternal } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn<(request: unknown) => Promise<unknown>>(),
  mockCheckAuth: vi.fn<(request: unknown, reply: unknown) => Promise<boolean>>(),
  mockCheckAuthOrInternal: vi.fn<(request: unknown, reply: unknown) => Promise<boolean>>(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: mockCheckAuth,
  checkAuthOrInternalService: mockCheckAuthOrInternal,
}))

vi.mock('@ihui/shared', () => ({
  toUserFriendlyMessage: (err: unknown) => String(err),
}))

// internal-service-token.ts(密钥比较唯一实现的家)静态 import db;本测试全程不查库,
// 桩掉以杜绝任何真实池被拉进加载图。
// 该桩同时供 csrf 钩子经动态 import 加载的 utils/api-key-presence.ts 使用
// (Bearer `ihui_` 族的豁免判据要查库;不桩则会真去连库,表现为用例耗时数秒
// 且结果取决于环境可达性)。eq(col, v) 的字面量裹在 SQL 对象的 queryChunks 里
// 一个 Param 形状的 chunk 上,故按下面 literalOf 取值。
vi.mock('../src/db/index.js', () => {
  const literalOf = (cond: unknown): string | undefined => {
    const chunks = (cond as { queryChunks?: unknown[] })?.queryChunks
    if (!Array.isArray(chunks)) return undefined
    for (const chunk of chunks) {
      if (typeof chunk === 'string') return chunk
      if (chunk && typeof chunk === 'object') {
        const v = (chunk as { value?: unknown }).value
        if (typeof v === 'string') return v
      }
    }
    return undefined
  }
  const db = {
    select: (_cols?: unknown) => {
      const self = {
        _key: '',
        from: () => self,
        where: (cond: unknown) => {
          self._key = literalOf(cond) ?? ''
          return self
        },
        limit: async () => {
          const row = apiKeyTable.get(self._key)
          return row ? [{ status: row.status, expiresAt: row.expiresAt }] : []
        },
      }
      return self
    },
  }
  return { db, dbRead: db, dbReader: db }
})

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
    REDIS_URL: 'redis://localhost:6379/0',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    AI_SERVICE_URL: 'http://localhost:8803',
    AI_CALLBACK_SECRET: AI_CALLBACK_SECRET_TEST,
  },
}))

import csrfPlugin, { isPlausibleBearerCredential } from '../src/plugins/csrf.js'
import { agentControlRoutes, __test__ } from '../src/routes/agent-control.js'
import {
  isVerifiedAgentControlInternalCall,
  isVerifiedInternalServiceCall,
} from '../src/utils/internal-principal.js'

const PREFIX = '/api/agent-control'
const WRONG_BEARER = `Bearer ${CTRL_SECRET.replace(/9f3a$/, 'zzzz')}`
const EXECUTE_BODY = {
  requestId: 'req-csrf-23',
  category: 'browser',
  action: 'click',
  params: {},
  timeout: 1000,
}

let app: FastifyInstance
let savedCtrlSecret: string | undefined

async function obtainCsrfPair(): Promise<{ token: string; cookieValue: string }> {
  const res = await app.inject({ method: 'GET', url: '/api/csrf-token' })
  const body = res.json()
  const setCookie = res.headers['set-cookie'] as string | string[]
  const cookieStr = Array.isArray(setCookie) ? setCookie[0]! : setCookie
  const match = /XSRF-TOKEN=([^;]+)/.exec(cookieStr)
  return { token: body.data.csrfToken as string, cookieValue: match![1]! }
}

function asRequest(headers: Record<string, string>) {
  return { headers } as unknown as Parameters<typeof isVerifiedInternalServiceCall>[0]
}

beforeAll(async () => {
  savedCtrlSecret = process.env.AGENT_CONTROL_INTERNAL_SECRET
  process.env.AGENT_CONTROL_INTERNAL_SECRET = CTRL_SECRET
  // @ihui/auth 的 getJwtSecret() 读 process.env.JWT_SECRET(不是 mock 的 config),
  // 与本文件 signRealJwt() 用的必须是同一把,否则"真签名"也验不过。
  process.env.JWT_SECRET = TEST_JWT_SECRET
  apiKeyTable.clear()

  app = Fastify({ logger: false })
  await app.register(cookie)
  await app.register(csrfPlugin)
  app.post('/api/protected', async (_req, reply) => reply.send({ ok: true }))
  await app.register(agentControlRoutes, { prefix: PREFIX })
  await app.ready()
})

afterAll(async () => {
  await app.close()
  if (savedCtrlSecret === undefined) delete process.env.AGENT_CONTROL_INTERNAL_SECRET
  else process.env.AGENT_CONTROL_INTERNAL_SECRET = savedCtrlSecret
})

beforeEach(() => {
  mockAuthenticate.mockReset()
  mockCheckAuth.mockReset()
  __test__.endpoints.clear()
  __test__.pending.clear()
})

describe('A. #23 阳性:正确内部密钥不再被 CSRF 拦', () => {
  it('裸密钥 Bearer(非 JWT 形态)+ 无 CSRF 对 → 抵达 /execute 的内部密钥分支', async () => {
    mockAuthenticate.mockRejectedValue(new Error('不应走到 JWT 分支'))
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/execute`,
      payload: EXECUTE_BODY,
      headers: { authorization: `Bearer ${CTRL_SECRET}` },
    })
    // 旧现场:这里返回 403 "CSRF 令牌缺失或无效",路由鉴权根本没执行。
    expect(res.statusCode).toBe(200)
    expect(res.json().data.errorCode).toBe('TARGET_NOT_CONNECTED')
    // 只断 200 不够:必须证明走的是内部密钥支,而不是 JWT 支碰巧放行。
    expect(mockAuthenticate).not.toHaveBeenCalled()
  })
})

describe('B. fail-closed:错误/缺失/未配置一律拒,豁免根据是密钥验真', () => {
  it('错误密钥的裸 Bearer(无 CSRF 对)→ 仍拒(CSRF 403),不因"像内部端点"放行', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/execute`,
      payload: EXECUTE_BODY,
      headers: { authorization: WRONG_BEARER },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('CSRF')
  })

  it('错误密钥 + 合法 CSRF 对 → 落到路由层,按既有语义 401', async () => {
    mockAuthenticate.mockRejectedValue(new Error('invalid token'))
    const { token, cookieValue } = await obtainCsrfPair()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/execute`,
      payload: EXECUTE_BODY,
      headers: {
        authorization: WRONG_BEARER,
        'x-csrf-token': token,
        cookie: `XSRF-TOKEN=${cookieValue}`,
      },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().message).toContain('未授权')
  })

  it('完全没有 Authorization(无 CSRF 对)→ 仍拒', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/execute`,
      payload: EXECUTE_BODY,
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('CSRF')
  })

  it('环境变量未配置密钥时,fail-closed:曾经正确的 Bearer 也不再豁免', async () => {
    delete process.env.AGENT_CONTROL_INTERNAL_SECRET
    try {
      const res = await app.inject({
        method: 'POST',
        url: `${PREFIX}/execute`,
        payload: EXECUTE_BODY,
        headers: { authorization: `Bearer ${CTRL_SECRET}` },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('CSRF')
    } finally {
      process.env.AGENT_CONTROL_INTERNAL_SECRET = CTRL_SECRET
    }
  })

  it('头名在场≠豁免:伪造 x-internal-service-token 值错误 → CSRF 仍 403(旧 presence-only 写法在这一臂是放行)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/protected',
      headers: { 'x-internal-service-token': 'attacker-guess' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('CSRF')
  })

  it('验真通过的 x-internal-service-token → CSRF 豁免,抵达路由', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/protected',
      headers: { 'x-internal-service-token': AI_CALLBACK_SECRET_TEST },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
  })
})

describe('C. 回归对照:真浏览器场景 CSRF 仍然生效,形态豁免未放宽', () => {
  it('带 XSRF cookie 但不带 header token 的非安全方法 → 403', async () => {
    const { cookieValue } = await obtainCsrfPair()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/execute`,
      payload: EXECUTE_BODY,
      headers: { cookie: `XSRF-TOKEN=${cookieValue}` },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('CSRF')
  })

  it('真签名 JWT 的既有豁免不变(CSRF 放行,真伪仍由路由判定)', async () => {
    // 2026-10-04(G-373):本条原先用**签名伪造**的 JWT_SHAPED_TOKEN 断言"CSRF 放行"。
    // 那是"按形态豁免"那一型本身 —— 判据成立后请求整块跳过 CSRF,而该 token 谁都能拼。
    // 现在判据是**凭据自证**,故正向臂改用本服务端密钥现签的真 JWT;反向臂(同形态、
    // 签名伪造 ⇒ 必须仍被 CSRF 拦)紧跟其后,两条合起来才钉住"验签而非形态"这一维。
    mockAuthenticate.mockRejectedValue(new Error('invalid token'))
    const realJwt = await signRealJwt()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/execute`,
      payload: EXECUTE_BODY,
      headers: { authorization: `Bearer ${realJwt}` },
    })
    // 200/401 都说明 CSRF 层没拦(凭据自证通过);这里路由 JWT 支被 mock 拒 ⇒ 401。
    expect(res.statusCode).toBe(401)
    expect(mockAuthenticate).toHaveBeenCalledTimes(1)
  })

  it('同形态但签名伪造的 JWT → CSRF 不再放行(G-373 反向对照:形态≠凭据有效)', async () => {
    mockAuthenticate.mockRejectedValue(new Error('不应走到路由鉴权'))
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/execute`,
      payload: EXECUTE_BODY,
      headers: { authorization: `Bearer ${JWT_SHAPED_TOKEN}` },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('CSRF')
    // 关键:拦在 CSRF 层 ⇒ 路由鉴权根本没被调用(否则就成了"路由替 CSRF 兜底")
    expect(mockAuthenticate).not.toHaveBeenCalled()
  })

  it('乱码 Bearer 不得换取豁免(O17 回归,判据未被放宽)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/protected',
      headers: { authorization: 'Bearer garbage' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('CSRF')
  })
})

describe('D. 授权先于写:未鉴权时不得触碰任何状态(不得"先改了再抛 403")', () => {
  it('/execute 错密钥:pending 登记数与端点表逐字不变(pushNotification 未发生)', async () => {
    mockAuthenticate.mockRejectedValue(new Error('invalid token'))
    __test__.endpoints.set('inst-keep', {
      capability: {
        endpoint: 'extension',
        instanceId: 'inst-keep',
        reportedAt: new Date().toISOString(),
      },
      userId: 'u-keep',
      lastSeen: Date.now(),
    })
    const { token, cookieValue } = await obtainCsrfPair()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/execute`,
      payload: EXECUTE_BODY,
      headers: {
        authorization: WRONG_BEARER,
        'x-csrf-token': token,
        cookie: `XSRF-TOKEN=${cookieValue}`,
      },
    })
    expect(res.statusCode).toBe(401)
    expect(__test__.pending.size).toBe(0) // 授权判定先于派发/登记
    expect(__test__.endpoints.size).toBe(1)
    expect(__test__.endpoints.has('inst-keep')).toBe(true)
    expect(__test__.droppedResults).toEqual({
      tokenMismatch: 0,
      instanceMismatch: 0,
      unattributed: 0,
    })
  })

  it('/capability 鉴权失败:不得把实例写进注册表', async () => {
    mockCheckAuth.mockImplementation(async (_request, reply) => {
      ;(reply as { status: (c: number) => { send: (b: unknown) => unknown } })
        .status(401)
        .send({ code: 401, message: 'Authentication required' })
      return false
    })
    // 带合法 CSRF 对越过钩子,让断言真正落在"路由鉴权 vs 注册表写入"的先后上
    // (若不带对,请求止步于 CSRF 403,压根到不了鉴权分支,那一维就没被检查)。
    const { token, cookieValue } = await obtainCsrfPair()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/capability`,
      payload: {
        endpoint: 'web',
        instanceId: 'inst-ghost',
        uiActions: ['describe'],
        reportedAt: new Date().toISOString(),
      },
      headers: { 'x-csrf-token': token, cookie: `XSRF-TOKEN=${cookieValue}` },
    })
    expect(res.statusCode).toBe(401)
    expect(__test__.endpoints.has('inst-ghost')).toBe(false)
  })
})

describe('E. 唯一出口 + 形状锁(行为断言测不到的那一维只能钉源码面)', () => {
  const apiRoot = resolve(__dirname, '..')
  const csrfSrc = readFileSync(resolve(apiRoot, 'src/plugins/csrf.ts'), 'utf8')
  const ctrlSrc = readFileSync(resolve(apiRoot, 'src/routes/agent-control.ts'), 'utf8')
  const utilSrc = readFileSync(resolve(apiRoot, 'src/utils/internal-principal.ts'), 'utf8')

  it('CSRF 钩子:presence-only 豁免形态不得回来,改走 isVerifiedInternalMachineCall', () => {
    expect(csrfSrc).toContain('isVerifiedInternalMachineCall(request)')
    expect(csrfSrc).not.toMatch(/if \(request\.headers\['x-internal-service-token'\]\) return/)
  })

  it('路由侧:本地密钥比较(isInternalSecret / 直读 env)不得回来,改走共享出口', () => {
    expect(ctrlSrc).toContain('isVerifiedAgentControlInternalCall(request)')
    expect(ctrlSrc).not.toMatch(/\bisInternalSecret\b/)
    expect(ctrlSrc).not.toContain('process.env.AGENT_CONTROL_INTERNAL_SECRET')
  })

  it('密钥比较全仓仅一份实现:唯一出口必须复用 internal-service-token 的 secretsEqual', () => {
    expect(utilSrc).toContain("import('../plugins/internal-service-token.js')")
    expect(utilSrc).toContain('secretsEqual')
    expect(utilSrc).not.toMatch(/timingSafeEqual\(\s*Buffer\.from/) // 不得自己另写明文比较
  })

  it('isPlausibleBearerCredential 判据未被放宽(禁止用"让内部调用不被识别"绕路)', () => {
    expect(csrfSrc).toMatch(
      /return parts\.length === 3 && parts\.every\(\(p\) => p\.length > 0 && \/\^\[A-Za-z0-9_-\]\+\$\/\.test\(p\)\)/,
    )
  })

  it('阳性对照:修复前旧豁免路径对内部裸密钥**结构上不可能成立**(即 #23 现场的根因)', () => {
    // 裸密钥无 `ihui_` 前缀、非三段 ⇒ 形态豁免判 false。修复前该形态的请求在钩子里
    // 没有任何出口(无 cookie 对 ⇒ verifyCsrfToken(undefined, undefined)=false ⇒ 403),
    // 所以 A 组那一臂在旧代码上必红 —— 本断言把"为什么旧行为必然 403"钉在函数本体上。
    expect(isPlausibleBearerCredential(`Bearer ${CTRL_SECRET}`)).toBe(false)
    // 而 JWT 形态仍为 true(判据没被反向收紧误伤既有豁免):
    expect(isPlausibleBearerCredential(`Bearer ${JWT_SHAPED_TOKEN}`)).toBe(true)
  })

  it('出口函数本体:对/错/缺/未配置四臂逐项判定(fail-closed)', async () => {
    await expect(
      isVerifiedInternalServiceCall(
        asRequest({ 'x-internal-service-token': AI_CALLBACK_SECRET_TEST }),
      ),
    ).resolves.toBe(true)
    await expect(
      isVerifiedInternalServiceCall(asRequest({ 'x-internal-service-token': 'nope' })),
    ).resolves.toBe(false)
    await expect(isVerifiedInternalServiceCall(asRequest({}))).resolves.toBe(false)
    await expect(
      isVerifiedAgentControlInternalCall(asRequest({ authorization: `Bearer ${CTRL_SECRET}` })),
    ).resolves.toBe(true)
    await expect(
      isVerifiedAgentControlInternalCall(asRequest({ authorization: WRONG_BEARER })),
    ).resolves.toBe(false)
    await expect(
      isVerifiedAgentControlInternalCall(asRequest({ authorization: 'garbage' })),
    ).resolves.toBe(false)
    const saved = process.env.AGENT_CONTROL_INTERNAL_SECRET
    delete process.env.AGENT_CONTROL_INTERNAL_SECRET
    try {
      await expect(
        isVerifiedAgentControlInternalCall(asRequest({ authorization: `Bearer ${CTRL_SECRET}` })),
      ).resolves.toBe(false)
    } finally {
      process.env.AGENT_CONTROL_INTERNAL_SECRET = saved
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
