// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-373「CSRF 按凭据存在性豁免」这一型无判据 —— 行为钉死。
 *
 * 票面原文：原先 `plugins/csrf.ts` 里 `if (request.headers[...])` 这种
 * 「有 Authorization 头/有 cookie 就认为不是 CSRF」的豁免没有判据 —— 攻击者只要自己
 * 塞一个头就能绕过。票 #23 修了一处（内部凭据族 → `isVerifiedInternalMachineCall`），
 * **型还在**。本文件把剩下的三族（Bearer 形态 / auth_token cookie / Gemini `?key=`）
 * 逐族钉成"凭据自证通过才豁免"，并对每一族给出**反向对照**。
 *
 * ## 为什么必须带反向对照
 *
 * 只断"合法凭据被豁免"（正向）是**弱断言**：把豁免写成 `if (headers['x-goog-api-key'])
 * return`（旧写法）它照样全绿 —— 任何值都豁免，正向的合法 key 自然也被豁免。
 * 真正区分新旧实现的唯一一维是**反向对照**：凭据**存在但无效**时必须仍被 CSRF 拦下。
 * 所以下面每一族都是「合法 → 200」+「伪造 → 403」成对出现，且伪造臂必须只带
 * header/cookie/参数、不带任何 CSRF 对 —— 即精确复现攻击者的最小动作。
 *
 * ## 覆盖的豁免族与判据
 *
 * | 族 | 载体 | 判据 | 反向对照构造 |
 * |---|---|---|---|
 * | Bearer JWT | `Authorization: Bearer <jwt>` | HS256 验签（本服务端签发） | 同形态三段、签名乱填 |
 * | Bearer API Key | `Authorization: Bearer ihui_*` | 库里存在 + active + 未过期 | `ihui_` 前缀但库里无此行 |
 * | auth_token cookie | `Cookie: auth_token=<jwt>` | 同 Bearer JWT 族（验签） | cookie 值非 JWT / 签名乱填 |
 * | Gemini / OpenAI | `x-goog-api-key` / `x-api-key` / `?key=` | 同 API Key 族（查库） | 头/参数在、值库里无此行 |
 *
 * ## 夹具与隔离（§5 测试隔离铁律）
 *
 * 不连生产 PG/Redis：DB 由 `vi.mock('../src/db/index.js')` 桩成内存表
 * （`api-key-presence.ts` 动态 import 的正是这个模块），密钥走 mock config +
 * `vi.hoisted` 固定值，**不读 .env**。JWT 由 jose 用同一把测试密钥现签，
 * 保证"真签名"与"服务端密钥"两侧一致 —— 反向对照臂只改签名不改形态，
 * 隔离出"验签"这一个变量。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SignJWT } from 'jose'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'

// vi.mock 工厂被提升到文件顶部,工厂内引用的常量必须在 vi.hoisted 里(否则 TDZ)。
const { TEST_JWT_SECRET, AI_CALLBACK_SECRET_TEST } = vi.hoisted(() => ({
  TEST_JWT_SECRET: 'csrf-g373-test-secret-at-least-32-chars-long-0123456789',
  AI_CALLBACK_SECRET_TEST: 'internal-secret-value-for-csrf-g373-test-0123456789',
}))

/** 内存形态的 developer_api_keys 表(替代真库):key → { status, expiresAt }。 */
const { apiKeyTable } = vi.hoisted(() => ({
  apiKeyTable: new Map<string, { status: string; expiresAt: Date | null }>(),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
    REDIS_URL: 'redis://localhost:6379/0',
    JWT_SECRET: 'csrf-g373-test-secret-at-least-32-chars-long-0123456789',
    AI_SERVICE_URL: 'http://localhost:8803',
    AI_CALLBACK_SECRET: AI_CALLBACK_SECRET_TEST,
  },
}))

// api-key-presence.ts 静态 import db;CSRF 钩子经动态 import 加载它。桩成内存表,
// 既让"库里有/没有这行"可断言(反向对照的前提),又保证不连任何真库。
// 只需支撑 `db.select({...}).from(t).where(eq(t.key, k)).limit(1)` 这一条链。
//
// 注意 `eq(col, v)` 返回的是 drizzle 的 SQL 对象:比较用的字面量既不是 `.value`
// 也不是裸字符串,而是裹在 `queryChunks` 里一个 Param 形状(`{brand,value,encoder}`)
// 的 chunk 上(实测 jose/drizzle 组合下 5 个 chunk 的第 4 个)。直接读 `cond.val`
// 或只找 `typeof x === 'string'` 都会恒得 undefined ⇒ 桩表永远返回空行 ⇒
// "库里存在"的正向对照也会假红。故按下面 literalOf 取值。
vi.mock('../src/db/index.js', () => {
  /** 从 eq() 产出的 SQL 对象里取回比较用的字面量。 */
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

import csrfPlugin from '../src/plugins/csrf.js'
import { isServerSignedJwt } from '../src/utils/csrf-exempt-credential.js'
import { isRegisteredUsableApiKey } from '../src/utils/api-key-presence.js'

/** 库里真实存在的合法 key（正向对照用）。 */
const VALID_API_KEY = 'ihui_aaaaaaaaaaaaaaaaaaaaaaaa'
/** 形态合法但库里没有这一行（反向对照用）。 */
const UNKNOWN_API_KEY = 'ihui_deadbeefdeadbeefdeadbeef'

let app: FastifyInstance
let savedCtrlSecret: string | undefined

const secretBytes = new TextEncoder().encode(TEST_JWT_SECRET)

/** 用**本服务端密钥**现签一枚真 JWT（正向：签名有效）。 */
async function signRealJwt(expOffset = '15m'): Promise<string> {
  return await new SignJWT({ phone: '', familyId: 'f1', roleId: 0 })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-1')
    .setIssuer('ihui-ai')
    .setAudience('ihui-ai-users')
    .setIssuedAt()
    .setExpirationTime(expOffset)
    .sign(secretBytes)
}

/**
 * 形态与真 JWT **完全一致**（三段 base64url）但签名是乱填的 —— 反向对照的关键：
 * 形态判据（`isPlausibleBearerCredential`）对它返回 true，验签判据必须返回 false。
 * 这正是旧实现（形态即豁免）放过、而正确实现必须拦下的那一类。
 */
function forgeSameShapeJwt(realJwt: string): string {
  const parts = realJwt.split('.')
  return `${parts[0]}.${parts[1]}.${'A'.repeat(parts[2]!.length)}`
}

/**
 * 去掉 TS 源码里的块注释与行注释，只留代码。
 * 用途见 G 组：修复落地时在代码旁留了逐字引用旧写法的注释，形状锁必须只对代码生效。
 * 实现刻意保守 —— 不追求完整的词法分析，只要"注释里的内容不再参与匹配"即可。
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // 块注释
    .split('\n')
    .map((line) => {
      // 行注释：跳过字符串字面量里的 "//"(如 'https://…')，避免把 URL 截断成假代码。
      let inSingle = false
      let inDouble = false
      let inBacktick = false
      for (let i = 0; i < line.length; i++) {
        const c = line[i]
        const prev = line[i - 1]
        if (c === "'" && prev !== '\\' && !inDouble && !inBacktick) inSingle = !inSingle
        else if (c === '"' && prev !== '\\' && !inSingle && !inBacktick) inDouble = !inDouble
        else if (c === '`' && prev !== '\\' && !inSingle && !inDouble) inBacktick = !inBacktick
        else if (c === '/' && line[i + 1] === '/' && !inSingle && !inDouble && !inBacktick) {
          return line.slice(0, i)
        }
      }
      return line
    })
    .join('\n')
}

async function obtainCsrfPair(): Promise<{ token: string; cookieValue: string }> {  const res = await app.inject({ method: 'GET', url: '/api/csrf-token' })
  const body = res.json()
  const setCookie = res.headers['set-cookie'] as string | string[]
  const cookieStr = Array.isArray(setCookie) ? setCookie[0]! : setCookie
  const match = /XSRF-TOKEN=([^;]+)/.exec(cookieStr)
  return { token: body.data.csrfToken as string, cookieValue: match![1]! }
}

beforeAll(async () => {
  savedCtrlSecret = process.env.AGENT_CONTROL_INTERNAL_SECRET
  process.env.AGENT_CONTROL_INTERNAL_SECRET = 'ctrl-secret-for-g373-9f3a'

  app = Fastify({ logger: false })
  await app.register(cookie)
  await app.register(csrfPlugin)
  // 非白名单的写端点：CSRF 钩子对它一定生效（否则豁免判据无从测起）
  app.post('/api/protected', async (_req, reply) => reply.send({ ok: true }))
  // 公开但要写状态的端点：O17 实跑里"假 Bearer 把 403 打成 201"的就是这一族
  app.post('/api/public-write', async (_req, reply) => reply.send({ created: true }))
  await app.ready()
})

afterAll(async () => {
  await app.close()
  if (savedCtrlSecret === undefined) delete process.env.AGENT_CONTROL_INTERNAL_SECRET
  else process.env.AGENT_CONTROL_INTERNAL_SECRET = savedCtrlSecret
})

beforeEach(() => {
  apiKeyTable.clear()
  apiKeyTable.set(VALID_API_KEY, { status: 'active', expiresAt: null })
  // @ihui/auth 的 getJwtSecret() 读 process.env.JWT_SECRET（不是 mock config），
  // 两侧必须同源，否则正向的"真签名"也验不过。
  process.env.JWT_SECRET = TEST_JWT_SECRET
})

describe('A. Bearer JWT 族：判据是验签，不是三段形态', () => {
  it('正向：本服务端签发的真 JWT + 无 CSRF 对 → 豁免放行', async () => {
    const jwt = await signRealJwt()
    const res = await app.inject({
      method: 'POST',
      url: '/api/protected',
      headers: { authorization: `Bearer ${jwt}` },
    })
    expect(res.statusCode).toBe(200)
  })

  it('反向对照：形态完全一致、签名乱填的 JWT + 无 CSRF 对 → 必须仍被 CSRF 403', async () => {
    const jwt = await signRealJwt()
    const forged = forgeSameShapeJwt(jwt)
    // 前置断言：确认这个伪造值**能骗过形态判据** —— 否则本用例就退化成"乱码"，
    // 钉不住"形态 vs 验签"这一维（旧实现在这里恰好也是 403，但那是形态判据的副作用，
    // 不是判据本身；只有形态判据 true 而仍 403 才证明豁免走的是验签）。
    const { isPlausibleBearerCredential } = await import('../src/plugins/csrf.js')
    expect(isPlausibleBearerCredential(`Bearer ${forged}`)).toBe(true)
    expect(forged.split('.')).toHaveLength(3)

    const res = await app.inject({
      method: 'POST',
      url: '/api/protected',
      headers: { authorization: `Bearer ${forged}` },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('CSRF')
  })

  it('反向对照：伪造 JWT + 合法 CSRF 对 → 豁免不成立但 CSRF 自身通过，落到路由（200）', async () => {
    // 这一臂钉住"403 来自豁免判据而非 CSRF token 校验"：同一伪造凭据，
    // 补上合法 CSRF 对就通 ⇒ 拦它的只能是凭据判据。
    const jwt = await signRealJwt()
    const forged = forgeSameShapeJwt(jwt)
    const { token, cookieValue } = await obtainCsrfPair()
    const res = await app.inject({
      method: 'POST',
      url: '/api/protected',
      headers: {
        authorization: `Bearer ${forged}`,
        'x-csrf-token': token,
        cookie: `XSRF-TOKEN=${cookieValue}`,
      },
    })
    expect(res.statusCode).toBe(200)
  })

  it('已过期但签名真实的 JWT 仍豁免（过期归路由侧 401，不得变成 CSRF 403）', async () => {
    const expired = await signRealJwt('-1h')
    await expect(isServerSignedJwt(expired)).resolves.toBe(true)
    const res = await app.inject({
      method: 'POST',
      url: '/api/protected',
      headers: { authorization: `Bearer ${expired}` },
    })
    expect(res.statusCode).toBe(200)
  })

  it('alg=none 的无签名 token → 拒绝豁免（JWT 算法混淆）', async () => {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const none = `${b64({ alg: 'none' })}.${b64({ sub: 'user-1' })}.`
    await expect(isServerSignedJwt(none)).resolves.toBe(false)
  })
})

describe('B. Bearer API Key 族：判据是查库，不是 ihui_ 前缀', () => {
  it('正向：库里真实存在且 active 的 key + 无 CSRF 对 → 豁免放行', async () => {
    await expect(isRegisteredUsableApiKey(VALID_API_KEY)).resolves.toBe(true)
    const res = await app.inject({
      method: 'POST',
      url: '/api/protected',
      headers: { authorization: `Bearer ${VALID_API_KEY}` },
    })
    expect(res.statusCode).toBe(200)
  })

  it('反向对照：ihui_ 前缀合法但库里没有这一行 → 必须仍被 CSRF 403（旧写法此处放行）', async () => {
    await expect(isRegisteredUsableApiKey(UNKNOWN_API_KEY)).resolves.toBe(false)
    const res = await app.inject({
      method: 'POST',
      url: '/api/protected',
      headers: { authorization: `Bearer ${UNKNOWN_API_KEY}` },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('CSRF')
  })

  it('反向对照：库里存在但 status=revoked → 不豁免', async () => {
    apiKeyTable.set(VALID_API_KEY, { status: 'revoked', expiresAt: null })
    const res = await app.inject({
      method: 'POST',
      url: '/api/protected',
      headers: { authorization: `Bearer ${VALID_API_KEY}` },
    })
    expect(res.statusCode).toBe(403)
  })

  it('反向对照：库里存在但已过期 → 不豁免', async () => {
    apiKeyTable.set(VALID_API_KEY, {
      status: 'active',
      expiresAt: new Date(Date.now() - 60_000),
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/protected',
      headers: { authorization: `Bearer ${VALID_API_KEY}` },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('C. auth_token cookie 族：原为纯存在性豁免', () => {
  it('正向：cookie 里是本服务端签发的真 JWT → 豁免放行', async () => {
    const jwt = await signRealJwt()
    const res = await app.inject({
      method: 'POST',
      url: '/api/protected',
      headers: { cookie: `auth_token=${jwt}` },
    })
    expect(res.statusCode).toBe(200)
  })

  it('反向对照：cookie 存在但值是垃圾（旧写法 `if (authToken) return` 此处放行）→ CSRF 403', async () => {
    // 这一条精确复现票面所指的"有 cookie 就认为不是 CSRF"：非空即豁免。
    const res = await app.inject({
      method: 'POST',
      url: '/api/protected',
      headers: { cookie: 'auth_token=attacker-controlled-garbage' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('CSRF')
  })

  it('反向对照：cookie 里是同形态但签名乱填的 JWT → CSRF 403', async () => {
    const forged = forgeSameShapeJwt(await signRealJwt())
    const res = await app.inject({
      method: 'POST',
      url: '/api/protected',
      headers: { cookie: `auth_token=${forged}` },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('D. Gemini / OpenAI 原生载体族：原为头名与 ?key= 的存在性豁免', () => {
  it('正向：x-goog-api-key 头携带库里真实存在的 key → 豁免放行（/v1beta 不断链）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/protected',
      headers: { 'x-goog-api-key': VALID_API_KEY },
    })
    expect(res.statusCode).toBe(200)
  })

  it('正向：?key= 查询参数携带库里真实存在的 key → 豁免放行', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/protected?key=${VALID_API_KEY}`,
    })
    expect(res.statusCode).toBe(200)
  })

  it('反向对照：x-goog-api-key 头在场但值库里没有 → 必须仍被 CSRF 403', async () => {
    // 旧写法 `if (headers['x-goog-api-key']) return` 在这一臂是**放行**的。
    const res = await app.inject({
      method: 'POST',
      url: '/api/protected',
      headers: { 'x-goog-api-key': UNKNOWN_API_KEY },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('CSRF')
  })

  it('反向对照：?key= 在 URL 里但值库里没有 → 必须仍被 CSRF 403（跨站一个表单即可带上）', async () => {
    // 旧写法 `if (typeof query.key === 'string') return` 在这一臂是**放行**的；
    // 且这是本族最危险的一处：URL 参数不需要任何"能发自定义头"的前提。
    const res = await app.inject({
      method: 'POST',
      url: `/api/protected?key=${UNKNOWN_API_KEY}`,
    })
    expect(res.statusCode).toBe(403)
  })

  it('反向对照：?key= 值为空串 → 不豁免', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/protected?key=' })
    expect(res.statusCode).toBe(403)
  })
})

describe('E. 公开但写状态的端点（O17 实跑现场）：伪造凭据不得换取无 CSRF 的写通道', () => {
  it('同形态伪造 JWT 打 /api/public-write → 403（旧实现把这路从 403 打成 201）', async () => {
    const forged = forgeSameShapeJwt(await signRealJwt())
    const res = await app.inject({
      method: 'POST',
      url: '/api/public-write',
      headers: { authorization: `Bearer ${forged}` },
    })
    expect(res.statusCode).toBe(403)
  })

  it('x-goog-api-key 垃圾值打 /api/public-write → 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/public-write',
      headers: { 'x-goog-api-key': 'totally-made-up' },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('F. 回归对照：合法路径与既有豁免族未被误伤', () => {
  it('合法 CSRF 对（无任何豁免凭据）→ 仍放行', async () => {
    const { token, cookieValue } = await obtainCsrfPair()
    const res = await app.inject({
      method: 'POST',
      url: '/api/protected',
      headers: { 'x-csrf-token': token, cookie: `XSRF-TOKEN=${cookieValue}` },
    })
    expect(res.statusCode).toBe(200)
  })

  it('安全方法 GET → 豁免（不受本次改动影响）', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/csrf-token' })
    expect(res.statusCode).toBe(200)
  })

  it('内部密钥验真通过（#23 那一族）→ 豁免仍在', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/protected',
      headers: { 'x-internal-service-token': AI_CALLBACK_SECRET_TEST },
    })
    expect(res.statusCode).toBe(200)
  })

  it('内部密钥值错误（头名在场）→ 仍被 CSRF 403（#23 的 fail-closed 未被放宽）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/protected',
      headers: { 'x-internal-service-token': 'attacker-guess' },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('G. 形状锁：presence-only 写法不得回来（行为断言测不到的那一维只能钉源码面）', () => {
  const csrfSrc = readFileSync(resolve(__dirname, '..', 'src/plugins/csrf.ts'), 'utf8')
  /**
   * 只扫**代码行**（去掉行注释与块注释）。
   * 原因：本文件落地的修复在 csrf.ts 里留了大量解释性注释，其中**逐字引用了旧写法**
   * （如"原写法 `if (headers['x-goog-api-key']) return`"）—— 那是文档，不是代码。
   * 直接对整份源码跑正则会把注释当成违规，钉出假红；反过来若把注释剥掉后正则仍命中，
   * 才是真的"旧写法回到了代码里"。这一步是形状锁本身可信的前提。
   */
  const csrfCode = stripComments(csrfSrc)

  it('剥掉注释后，CSRF 钩子里不再有"头/参数/cookie 在场即 return"的旧豁免', () => {
    expect(csrfCode).not.toMatch(/if \(request\.headers\['x-goog-api-key'\]\) return/)
    expect(csrfCode).not.toMatch(/if \(typeof \(request\.query as \{ key\?: unknown \}/)
    // auth_token 族：不得回到 `if (authToken) return`
    expect(csrfCode).not.toMatch(/if \(authToken\) return/)
    // Bearer 族：不得回到"形态即豁免"
    expect(csrfCode).not.toMatch(/if \(isPlausibleBearerCredential\(auth\)\) return/)
    // 兜底：三行 csrfCode 原文，供失败时直接看出命中了什么
    expect(csrfCode).not.toMatch(/request\.headers\['x-goog-api-key'\]\) return/)
  })

  it('三个豁免判据出口都在，且都接上了验签/验真', () => {
    expect(csrfSrc).toContain('hasVerifiedBearerCredential(auth)')
    expect(csrfSrc).toContain('await isServerSignedJwt(authToken)')
    expect(csrfSrc).toContain('hasVerifiedApiKeyCarrier(request)')
    expect(csrfSrc).toContain('isVerifiedInternalMachineCall(request)')
  })

  it('验签/验真判据是唯一出路：csrf-exempt-credential 与 api-key-presence 都已接线', () => {
    const credSrc = readFileSync(
      resolve(__dirname, '..', 'src/utils/csrf-exempt-credential.ts'),
      'utf8',
    )
    const keySrc = readFileSync(resolve(__dirname, '..', 'src/utils/api-key-presence.ts'), 'utf8')
    // 验签必须钉住算法白名单（alg=none / HS-RSA 混淆）
    expect(credSrc).toContain("algorithms: ['HS256']")
    // API Key 判据必须查库且 fail-closed
    expect(keySrc).toContain('developerApiKeys')
    expect(keySrc).toContain('return false')
  })
})
// ⁠‌‌‌‍‍‌‍‍‌‌‌‍‌‌‍‌‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‌‌‌‌‍‌‌‌‌‍‍‌‍‍‍‍‌‌‌‍‌‌‍‍‍‍‌‌‌‌‍‍‍‍‍‍‌‌‌‌‍‍‍️‌‌‍‍‌‌‍‍‍‍‌‌‌‍‌‍‍‍‍‌‍‍‌‍‍‍‌‍‌‍‍⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
