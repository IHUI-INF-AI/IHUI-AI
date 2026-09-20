// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O7:根级令牌端点(/oauth/token、/oauth/introspect、/oauth/revoke)+ 发现表面工具回归测试。
 *
 * 铁律:不连生产 PG(8810)/ Redis(8811) —— 所有 db/redis 走 vi.mock,
 * JWT 用 @ihui/auth 真实现 + setup-env 的测试密钥(纯内存运算,不落库)。
 *
 * 覆盖矩阵(与任务书一一对应):
 *  1. redirect_uri 精确匹配 + `:/` 边界回归(`https:evil.test` 解析成功但 hostname 为空)
 *  2. code_verifier 错 → invalid_grant(经路由,不是只测纯函数)
 *  3. 授权码并发二次消费 → 只成功一次
 *  4. 轮换竞态 → 第二次 invalid_grant + family 全族撤销
 *  5. revokeFamilyByJti 的 family 语义(按 familyId 撤销,不新写一套)
 *  6. token_type_hint 错仍命中(双表兜底)
 *  7. access/M2M token 不被当 refresh token(典型用即拒)
 *  8. error_uri 非白名单被丢;RFC 错误体带数字 code ≠ 0
 *  9. discovery issuer 优先级,且不取查询参数
 * 10. 公开客户端默认被拒(未开 OAUTH_ALLOW_PUBLIC_WITHOUT_SECRET 时失败关闭)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

// ─── 可变 config(测试内直接改字段,省掉整套 vi.resetModules 体操) ────────────
const cfg = vi.hoisted(() => ({
  value: {
    PORT: 8802,
    PUBLIC_BASE_URL: '',
    OAUTH_ISSUER: '',
    OAUTH_REQUIRE_PKCE: false,
    OAUTH_ALLOW_PUBLIC_WITHOUT_SECRET: false,
    OAUTH_ERROR_URI_HOSTS: '',
    OAUTH_ERROR_URI_BASE: '',
    OAUTH_M2M_TOKEN_TTL_SECONDS: 900,
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!',
    NODE_ENV: 'test' as const,
  },
}))

vi.mock('../src/config/index.js', () => ({
  get config() {
    return cfg.value
  },
}))

// ─── 假 Redis 黑名单(断言吊销写入,不碰真 Redis) ─────────────────────────────
const blacklistCalls = vi.hoisted(() => ({ add: [] as string[], has: [] as string[] }))
const fakeBlacklistAdd = vi.hoisted(() => vi.fn(async (token: string) => { blacklistCalls.add.push(token) }))
const fakeBlacklistHas = vi.hoisted(() =>
  vi.fn(async (token: string) => {
    blacklistCalls.has.push(token)
    return false
  }),
)

vi.mock('@ihui/auth', async (importOriginal) => {
  const actual = (await importOriginal<Record<string, unknown>>()) as Record<string, unknown>
  class FakeTokenBlacklist {
    add(token: string): Promise<void> {
      return fakeBlacklistAdd(token)
    }
    has(token: string): Promise<boolean> {
      return fakeBlacklistHas(token)
    }
  }
  return { ...actual, TokenBlacklist: FakeTokenBlacklist }
})

// ─── DB 层全部 mock ──────────────────────────────────────────────────────────
const dbMocks = vi.hoisted(() => ({
  claimAuthorizationCode: vi.fn(),
  claimRefreshToken: vi.fn(),
  revokeFamilyByFamilyId: vi.fn(),
  findRefreshToken: vi.fn(),
  findUserById: vi.fn(),
  createAuditLog: vi.fn(),
}))

vi.mock('../src/db/oauth-token-queries.js', () => ({
  claimAuthorizationCode: dbMocks.claimAuthorizationCode,
  claimRefreshToken: dbMocks.claimRefreshToken,
  revokeFamilyByFamilyId: dbMocks.revokeFamilyByFamilyId,
  countActiveTokensInFamily: vi.fn(async () => 0),
}))

vi.mock('../src/db/queries.js', () => ({
  findRefreshToken: dbMocks.findRefreshToken,
  findUserById: dbMocks.findUserById,
}))

vi.mock('../src/db/oauth-queries.js', () => ({
  createAuditLog: dbMocks.createAuditLog,
}))

// ─── auth-extended 的共享 helper:客户端认证/M2M 用替身,PKCE 闸门用真实现 ──────
const asMocks = vi.hoisted(() => ({
  authenticateOAuthClient: vi.fn(),
  mintClientCredentialsToken: vi.fn(),
  buildTokenPair: vi.fn(),
}))

vi.mock('../src/routes/auth-extended.js', async () => {
  // 不用 importOriginal:auth-extended.ts 顶层 import ../db/index.js,而该模块在
  // 当前工作区里被并发改动打断(configureDataScopeGuard 未定义),会把本套件整体带崩。
  // 这里只暴露 oauth-tokens.ts 真正用到的 4 个符号,PKCE 闸门委托给 @ihui/auth 的真实现,
  // 保证"经路由校验"这条断言测的是真逻辑而不是替身。
  const auth = await import('@ihui/auth')
  return {
    authenticateOAuthClient: asMocks.authenticateOAuthClient,
    mintClientCredentialsToken: asMocks.mintClientCredentialsToken,
    buildTokenPair: asMocks.buildTokenPair,
    gatePkceForSession: (params: {
      session: { codeChallenge: string | null; codeChallengeMethod: string | null }
      codeVerifier?: string | null
      app: unknown
      publicClient: boolean
    }) => {
      const result = auth.evaluatePkce({
        session: params.session,
        codeVerifier: params.codeVerifier,
        isPublicClient: params.publicClient,
        policy: auth.pkcePolicyFromEnv(process.env),
        requirePkceForClient: auth.isModernOAuthClientApp(params.app as { clientSecret?: string }),
      })
      if (result.ok) return { ok: true }
      return {
        ok: false,
        status: result.error === 'invalid_client' ? 401 : 400,
        error: result.error,
        description: result.description,
      }
    },
  }
})

import { oauthTokensRoutes } from '../src/routes/oauth-tokens.js'
import { errorUriFor, isSafeExternalUrl, resolveIssuer } from '../src/utils/oauth-as.js'
import {
  evaluatePkce,
  generatePkceChallenge,
  pkcePolicyFromEnv,
  signAccessToken,
  signRefreshToken,
  validateRedirectUri,
  verifyClientSecret,
  hashClientSecret,
  PUBLIC_CLIENT_SECRET,
  isPublicClientApp,
  type OAuth2Client,
  type PkcePolicy,
} from '@ihui/auth'

const STRICT_POLICY: PkcePolicy = {
  requirePkceForPublicClients: true,
  requirePkceForConfidentialClients: true,
  allowedMethods: ['S256'],
}

const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk~~~43pluschars'

interface AppLike {
  clientId: string
  clientSecret: string
  clientSecretHash: string | null
  redirectUris: string[]
  scopes: string[]
  name: string
  ownerUuid: string | null
  isActive: number
}

function makeApp(overrides: Partial<AppLike> = {}): AppLike {
  return {
    clientId: 'zhs_conf_001',
    clientSecret: 's'.repeat(64),
    clientSecretHash: null,
    redirectUris: ['https://app.example.com/callback'],
    scopes: ['profile', 'read:agents'],
    name: 'Regression App',
    ownerUuid: '11111111-1111-4111-8111-111111111111',
    isActive: 1,
    ...overrides,
  }
}

const mockUser = {
  id: '11111111-1111-4111-8111-111111111111',
  phone: '13800000001',
  roleId: 0,
  familyId: '22222222-2222-4222-8222-222222222222',
}

describe('O7 纯函数层:redirect_uri 边界 + PKCE 策略 + 摘要匹配', () => {
  const client: OAuth2Client = {
    clientId: 'c1',
    clientSecret: 'sec',
    redirectUris: ['https://app.example.com/callback'],
    scopes: [],
    name: 'c1',
  }

  it('redirect_uri 必须逐字符精确匹配(尾斜杠/大小写/多一段都不行)', () => {
    expect(validateRedirectUri(client, 'https://app.example.com/callback')).toBe(true)
    expect(validateRedirectUri(client, 'https://app.example.com/callback/')).toBe(false)
    expect(validateRedirectUri(client, 'https://APP.example.com/callback')).toBe(false)
    expect(validateRedirectUri(client, 'https://app.example.com/callback?x=1')).toBe(false)
    expect(validateRedirectUri(client, '')).toBe(false)
  })

  it('`:/` 边界回归:https:evil.test 会被 WHATWG 补全成合法 host,只能靠精确匹配挡', () => {
    // 解析器实况(踩过一次的坑):`:` 后不跟 `//` 并不会得到空 hostname,
    // 而是被补全成规范形态 —— 所以"protocol + host 都合法"绝不等于"与注册值一致"。
    const tricky = new URL('https:app.example.com/callback')
    expect(tricky.protocol).toBe('https:')
    expect(tricky.hostname).toBe('app.example.com')
    expect(tricky.href).toBe('https://app.example.com/callback')
    // 前缀匹配 / 协议+host 匹配都会放过它,只有逐字符精确匹配能拒
    expect(validateRedirectUri(client, 'https:app.example.com/callback')).toBe(false)
    expect(validateRedirectUri(client, 'https://app.example.com/callback/../evil')).toBe(false)
    expect(validateRedirectUri(client, 'https://app.example.com:443/callback')).toBe(false)
  })

  it('pkcePolicyFromEnv 默认不强制机密客户端(OAUTH_REQUIRE_PKCE 灰度位为 false)', () => {
    delete process.env.OAUTH_REQUIRE_PKCE
    const policy = pkcePolicyFromEnv()
    expect(policy.requirePkceForConfidentialClients).toBe(false)
    expect(policy.requirePkceForPublicClients).toBe(true)
    expect(policy.allowedMethods).toEqual(['S256'])
    expect(pkcePolicyFromEnv({ OAUTH_REQUIRE_PKCE: 'true' }).requirePkceForConfidentialClients).toBe(
      true,
    )
    // 灰度开关绝不能关掉"带了 challenge 就必须校验 verifier"这条
    const noChallengeNoVerifier = evaluatePkce({
      session: { codeChallenge: generatePkceChallenge(VERIFIER, 'S256') },
      codeVerifier: null,
      isPublicClient: false,
      policy: pkcePolicyFromEnv({}),
    })
    expect(noChallengeNoVerifier.ok).toBe(false)
  })

  it('evaluatePkce:challenge 存在而 verifier 错 → invalid_grant;对 → enforced=true', () => {
    const challenge = generatePkceChallenge(VERIFIER, 'S256')
    const wrong = evaluatePkce({
      session: { codeChallenge: challenge, codeChallengeMethod: 'S256' },
      codeVerifier: `${VERIFIER}xxxxxxxx`,
      isPublicClient: false,
      policy: STRICT_POLICY,
    })
    expect(wrong.ok).toBe(false)
    if (!wrong.ok) expect(wrong.error).toBe('invalid_grant')
    const right = evaluatePkce({
      session: { codeChallenge: challenge, codeChallengeMethod: 'S256' },
      codeVerifier: VERIFIER,
      isPublicClient: false,
      policy: STRICT_POLICY,
    })
    expect(right).toEqual({ ok: true, enforced: true })
  })

  it('evaluatePkce:公开客户端无 challenge 一律拒(不给机密客户端豁免留后门)', () => {
    const res = evaluatePkce({
      session: { codeChallenge: null, codeChallengeMethod: null },
      codeVerifier: null,
      isPublicClient: true,
      policy: pkcePolicyFromEnv({}),
    })
    expect(res.ok).toBe(false)
  })

  it('client_secret 只存摘要也能验通;哨兵公开客户端永远不匹配', () => {
    const plain = 's'.repeat(64)
    const app = makeApp({ clientSecret: hashClientSecret(plain) })
    expect(verifyClientSecret(app, plain)).toBe(true)
    expect(verifyClientSecret(app, 'wrong')).toBe(false)
    const publicApp = makeApp({ clientSecret: PUBLIC_CLIENT_SECRET })
    expect(isPublicClientApp(publicApp)).toBe(true)
    expect(verifyClientSecret(publicApp, '')).toBe(false)
  })
})

describe('O7 utils/oauth-as:error_uri 白名单与 issuer 推导', () => {
  beforeEach(() => {
    cfg.value.PUBLIC_BASE_URL = ''
    cfg.value.OAUTH_ISSUER = ''
    cfg.value.OAUTH_ERROR_URI_HOSTS = ''
    cfg.value.OAUTH_ERROR_URI_BASE = ''
    delete process.env.BASE_URL
  })

  it('isSafeExternalUrl:精确主机名白名单,拒后缀混淆/userinfo/内网 IP/非 https/空 host', () => {
    const hosts = ['docs.aizhs.top']
    expect(isSafeExternalUrl('https://docs.aizhs.top/oauth/e1', hosts)).toBe(
      'https://docs.aizhs.top/oauth/e1',
    )
    expect(isSafeExternalUrl('https://evil-docs.aizhs.top/x', hosts)).toBeNull()
    expect(isSafeExternalUrl('https://docs.aizhs.top.evil.test/x', hosts)).toBeNull()
    expect(isSafeExternalUrl('https://docs.aizhs.top@evil.test/x', hosts)).toBeNull()
    expect(isSafeExternalUrl('http://docs.aizhs.top/x', hosts)).toBeNull()
    expect(isSafeExternalUrl('javascript:alert(1)', hosts)).toBeNull()
    expect(isSafeExternalUrl('https://10.0.0.5/x', ['10.0.0.5'])).toBeNull()
    expect(isSafeExternalUrl('https://127.0.0.1:8801/x', ['127.0.0.1'])).toBeNull()
    // `:/` 形态:protocol 合法但 hostname 为空
    expect(isSafeExternalUrl('https:docs.aizhs.top/x', hosts)).toBeNull()
    expect(isSafeExternalUrl(undefined, hosts)).toBeNull()
    expect(isSafeExternalUrl('not a url', hosts)).toBeNull()
  })

  it('errorUriFor:配置基址不在白名单时字段整体丢弃(宁缺不投毒)', () => {
    cfg.value.PUBLIC_BASE_URL = 'https://auth.example.com'
    cfg.value.OAUTH_ERROR_URI_BASE = 'https://phishing.test/docs'
    const issuer = resolveIssuer()
    expect(errorUriFor(issuer, 'invalid_grant')).toBeNull()
    cfg.value.OAUTH_ERROR_URI_BASE = ''
    // 未配基址时落回 issuer 自身文档路径,issuer host 天然在白名单内
    expect(errorUriFor(issuer, 'invalid_grant')).toBe('https://auth.example.com/docs/oauth-errors')
  })

  it('resolveIssuer 优先级:PUBLIC_BASE_URL > OAUTH_ISSUER > BASE_URL > 请求头,且绝不读查询参数', () => {
    cfg.value.PUBLIC_BASE_URL = 'https://a.example.com/'
    cfg.value.OAUTH_ISSUER = 'https://b.example.com'
    process.env.BASE_URL = 'https://c.example.com'
    expect(resolveIssuer()).toBe('https://a.example.com')
    cfg.value.PUBLIC_BASE_URL = ''
    expect(resolveIssuer()).toBe('https://b.example.com')
    cfg.value.OAUTH_ISSUER = ''
    expect(resolveIssuer()).toBe('https://c.example.com')
    delete process.env.BASE_URL
    // 全未配置且没给 request 时必须是空串 —— 宁可不产 issuer,也不能凭空造一个
    // (发现文档宁可 500 也不撒谎;带 request 时的请求头兜底在路由用例里覆盖)
    expect(resolveIssuer()).toBe('')
  })
})

describe('O7 POST /oauth/token + /oauth/introspect + /oauth/revoke', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.decorate('redis', {
      setex: vi.fn(async () => 'OK'),
      exists: vi.fn(async () => 0),
      del: vi.fn(async () => 1),
      smembers: vi.fn(async () => []),
      sadd: vi.fn(async () => 1),
      expire: vi.fn(async () => 1),
    })
    // 与真实 server.ts 的注册方式一致:本插件不带 prefix
    await app.register(oauthTokensRoutes)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    cfg.value.PUBLIC_BASE_URL = 'https://auth.example.com'
    cfg.value.OAUTH_ISSUER = ''
    cfg.value.OAUTH_ERROR_URI_HOSTS = ''
    cfg.value.OAUTH_ERROR_URI_BASE = ''
    cfg.value.OAUTH_ALLOW_PUBLIC_WITHOUT_SECRET = false
    cfg.value.OAUTH_REQUIRE_PKCE = false
    asMocks.authenticateOAuthClient.mockResolvedValue({
      ok: true,
      app: makeApp(),
      publicClient: false,
    })
    asMocks.buildTokenPair.mockResolvedValue({
      accessToken: 'at-new',
      refreshToken: 'rt-new',
      expiresIn: 900,
      refreshExpiresIn: 2592000,
    })
    asMocks.mintClientCredentialsToken.mockResolvedValue({
      ok: true,
      accessToken: 'm2m-at',
      expiresIn: 900,
      scope: 'read:agents',
      clientId: 'zhs_conf_001',
      sub: mockUser.id,
    })
    dbMocks.claimAuthorizationCode.mockResolvedValue({
      clientId: 'zhs_conf_001',
      userId: mockUser.id,
      state: 'st-1',
      scope: 'profile',
      codeChallenge: null,
      codeChallengeMethod: null,
      expiresAt: new Date(Date.now() + 300_000),
    })
    dbMocks.claimRefreshToken.mockResolvedValue({
      userId: mockUser.id,
      familyId: mockUser.familyId,
      expiresAt: new Date(Date.now() + 86400_000),
    })
    dbMocks.revokeFamilyByFamilyId.mockResolvedValue(3)
    dbMocks.findRefreshToken.mockResolvedValue(undefined)
    dbMocks.findUserById.mockResolvedValue(mockUser)
    dbMocks.createAuditLog.mockResolvedValue(undefined)
    blacklistCalls.add.length = 0
    blacklistCalls.has.length = 0
  })

  it('authorization_code 成功:RFC 原生形状(不套 {code,data})+ refresh_token + scope', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      payload: { grant_type: 'authorization_code', code: 'c-1', state: 'st-1' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Record<string, unknown>
    expect(body).toEqual({
      access_token: 'at-new',
      token_type: 'Bearer',
      expires_in: 900,
      refresh_token: 'rt-new',
      scope: 'profile',
    })
    expect(body.code).toBeUndefined()
  })

  it('state 缺失/错配 → invalid_grant,并带数字 code ≠ 0(前端 data.code!==0 判定不失效)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      payload: { grant_type: 'authorization_code', code: 'c-1', state: 'wrong-state' },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json() as { error: string; code: number; error_description?: string }
    expect(body.error).toBe('invalid_grant')
    expect(body.code).toBe(400)
    expect(body.error_description).toContain('state')
  })

  it('授权码二次消费:claimAuthorizationCode 返回 null → invalid_grant(并发只成功一次)', async () => {
    dbMocks.claimAuthorizationCode.mockResolvedValueOnce({
      clientId: 'zhs_conf_001',
      userId: mockUser.id,
      state: null,
      scope: null,
      codeChallenge: null,
      codeChallengeMethod: null,
      expiresAt: new Date(Date.now() + 300_000),
    })
    dbMocks.claimAuthorizationCode.mockResolvedValueOnce(null)
    const first = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      payload: { grant_type: 'authorization_code', code: 'c-1' },
    })
    const second = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      payload: { grant_type: 'authorization_code', code: 'c-1' },
    })
    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(400)
    expect(second.json().error).toBe('invalid_grant')
    expect(dbMocks.claimAuthorizationCode).toHaveBeenCalledTimes(2)
  })

  it('code_verifier 错 → invalid_grant(经路由真实校验,不是只测纯函数)', async () => {
    dbMocks.claimAuthorizationCode.mockResolvedValue({
      clientId: 'zhs_conf_001',
      userId: mockUser.id,
      state: null,
      scope: null,
      codeChallenge: generatePkceChallenge(VERIFIER, 'S256'),
      codeChallengeMethod: 'S256',
      expiresAt: new Date(Date.now() + 300_000),
    })
    const bad = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      payload: { grant_type: 'authorization_code', code: 'c-1', code_verifier: `${VERIFIER}xx` },
    })
    expect(bad.statusCode).toBe(400)
    expect(bad.json().error).toBe('invalid_grant')
    expect(asMocks.buildTokenPair).not.toHaveBeenCalled()

    const good = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      payload: { grant_type: 'authorization_code', code: 'c-1', code_verifier: VERIFIER },
    })
    expect(good.statusCode).toBe(200)
  })

  it('code_verifier 完全缺失(challenge 已存) → 拒绝,不给静默降级留路', async () => {
    dbMocks.claimAuthorizationCode.mockResolvedValue({
      clientId: 'zhs_conf_001',
      userId: mockUser.id,
      state: null,
      scope: null,
      codeChallenge: generatePkceChallenge(VERIFIER, 'S256'),
      codeChallengeMethod: 'S256',
      expiresAt: new Date(Date.now() + 300_000),
    })
    const res = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      payload: { grant_type: 'authorization_code', code: 'c-1' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('invalid_request')
  })

  it('授权码与 client 不匹配 → invalid_grant(不泄露"存在但属别人")', async () => {
    dbMocks.claimAuthorizationCode.mockResolvedValue({
      clientId: 'zhs_some_other_app',
      userId: mockUser.id,
      state: null,
      scope: null,
      codeChallenge: null,
      codeChallengeMethod: null,
      expiresAt: new Date(Date.now() + 300_000),
    })
    const res = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      payload: { grant_type: 'authorization_code', code: 'c-1' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('invalid_grant')
  })

  it('轮换竞态:第二次占位失败 → invalid_grant;重用检测触发 family 全族撤销', async () => {
    const rt = await signRefreshToken({
      userId: mockUser.id,
      phone: mockUser.phone,
      familyId: mockUser.familyId,
      roleId: 0,
    })
    // 第一次占位成功
    dbMocks.claimRefreshToken.mockResolvedValueOnce({
      userId: mockUser.id,
      familyId: mockUser.familyId,
      expiresAt: new Date(Date.now() + 86400_000),
    })
    const first = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      payload: { grant_type: 'refresh_token', refresh_token: rt },
    })
    expect(first.statusCode).toBe(200)
    expect((first.json() as { refresh_token: string }).refresh_token).toBe('rt-new')

    // 第二次:条件 UPDATE 拿 0 行 + 行已 revokedAt → 重用检测
    dbMocks.claimRefreshToken.mockResolvedValueOnce(null)
    dbMocks.findRefreshToken.mockResolvedValueOnce({
      id: 'row-1',
      familyId: mockUser.familyId,
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400_000),
    })
    const second = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      payload: { grant_type: 'refresh_token', refresh_token: rt },
    })
    expect(second.statusCode).toBe(400)
    expect(second.json().error).toBe('invalid_grant')
    expect(dbMocks.revokeFamilyByFamilyId).toHaveBeenCalledWith(mockUser.familyId)
  })

  it('access token / M2M token 不被当 refresh token 使用(典型用即拒)', async () => {
    const at = await signAccessToken({
      userId: mockUser.id,
      phone: mockUser.phone,
      familyId: mockUser.familyId,
      roleId: 0,
    })
    const res = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      payload: { grant_type: 'refresh_token', refresh_token: at },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('invalid_grant')
    // 关键:绝不能走到占位/签发,否则"typ 混用"就等于刷新成功
    expect(dbMocks.claimRefreshToken).not.toHaveBeenCalled()
    expect(asMocks.buildTokenPair).not.toHaveBeenCalled()
  })

  it('client_credentials 走 M2M 签发器,响应不带 refresh_token(RFC 6749 §4.4.3)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      payload: { grant_type: 'client_credentials', scope: 'read:agents' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Record<string, unknown>
    expect(body.access_token).toBe('m2m-at')
    expect(body.refresh_token).toBeUndefined()
    expect(asMocks.mintClientCredentialsToken).toHaveBeenCalled()
  })

  it('未注册的 grant_type → unsupported_grant_type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      payload: { grant_type: 'password' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('unsupported_grant_type')
  })

  it('公开客户端在未开 OAUTH_ALLOW_PUBLIC_WITHOUT_SECRET 时失败关闭', async () => {
    asMocks.authenticateOAuthClient.mockResolvedValue({
      ok: true,
      app: makeApp({ clientSecret: PUBLIC_CLIENT_SECRET }),
      publicClient: true,
    })
    const res = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      payload: { grant_type: 'authorization_code', code: 'c-1', code_verifier: VERIFIER },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().error).toBe('unauthorized_client')
    // 开关打开 + 完整 PKCE 对(challenge 已存 / verifier 正确)才放行
    cfg.value.OAUTH_ALLOW_PUBLIC_WITHOUT_SECRET = true
    dbMocks.claimAuthorizationCode.mockResolvedValue({
      clientId: 'zhs_conf_001',
      userId: mockUser.id,
      state: null,
      scope: null,
      codeChallenge: generatePkceChallenge(VERIFIER, 'S256'),
      codeChallengeMethod: 'S256',
      expiresAt: new Date(Date.now() + 300_000),
    })
    const ok = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      payload: { grant_type: 'authorization_code', code: 'c-1', code_verifier: VERIFIER },
    })
    expect(ok.statusCode).toBe(200)
    // 但开关开了也不给"无 PKCE 的公开客户端"活路:强制不可豁免
    const noPkce = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      payload: { grant_type: 'authorization_code', code: 'c-2' },
    })
    expect(noPkce.statusCode).toBe(400)
  })

  it('introspect:hint 说 access 实际是 refresh → 双表兜底仍命中 active=true', async () => {
    const rt = await signRefreshToken({
      userId: mockUser.id,
      phone: mockUser.phone,
      familyId: mockUser.familyId,
      roleId: 0,
    })
    dbMocks.findRefreshToken.mockResolvedValue({
      id: 'row-1',
      familyId: mockUser.familyId,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400_000),
    })
    const res = await app.inject({
      method: 'POST',
      url: '/oauth/introspect',
      payload: { token: rt, token_type_hint: 'access_token' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { active: boolean; token_use?: string }
    expect(body.active).toBe(true)
    expect(body.token_use).toBe('refresh')
    // 兜底查不能把 refresh token 消费掉
    expect(dbMocks.claimRefreshToken).not.toHaveBeenCalled()
  })

  it('introspect:access token 正常回 claims;已吊销的走黑名单 → active=false', async () => {
    const at = await signAccessToken({
      userId: mockUser.id,
      phone: mockUser.phone,
      familyId: mockUser.familyId,
      roleId: 0,
    })
    const res = await app.inject({
      method: 'POST',
      url: '/oauth/introspect',
      payload: { token: at, token_type_hint: 'nonsense-hint' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { active: boolean; sub: string; token_use: string }
    expect(body.active).toBe(true)
    expect(body.sub).toBe(mockUser.id)
    expect(body.token_use).toBe('access')

    fakeBlacklistHas.mockImplementationOnce(async () => true)
    const revoked = await app.inject({
      method: 'POST',
      url: '/oauth/introspect',
      payload: { token: at },
    })
    expect(revoked.json().active).toBe(false)
  })

  it('introspect:垃圾串 → 200 + active=false(RFC 7662 不报 401)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/oauth/introspect',
      payload: { token: 'not.a.jwt' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().active).toBe(false)
  })

  it('revoke:refresh token 按 family 撤销 + 恒 200 空体;不存在也 200(不做存在性预言机)', async () => {
    const rt = await signRefreshToken({
      userId: mockUser.id,
      phone: mockUser.phone,
      familyId: mockUser.familyId,
      roleId: 0,
    })
    const res = await app.inject({
      method: 'POST',
      url: '/oauth/revoke',
      payload: { token: rt, token_type_hint: 'access_token' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({})
    expect(dbMocks.revokeFamilyByFamilyId).toHaveBeenCalledWith(mockUser.familyId)

    dbMocks.claimRefreshToken.mockResolvedValueOnce(null)
    dbMocks.findRefreshToken.mockResolvedValueOnce(undefined)
    const unknown = await app.inject({
      method: 'POST',
      url: '/oauth/revoke',
      payload: { token: 'garbage-token' },
    })
    expect(unknown.statusCode).toBe(200)
    expect(unknown.json()).toEqual({})
  })

  it('revoke:access token 落 Redis 黑名单(带 exp 的原始串)', async () => {
    const at = await signAccessToken({
      userId: mockUser.id,
      phone: mockUser.phone,
      familyId: mockUser.familyId,
      roleId: 0,
    })
    const res = await app.inject({ method: 'POST', url: '/oauth/revoke', payload: { token: at } })
    expect(res.statusCode).toBe(200)
    expect(blacklistCalls.add).toContain(at)
  })

  it('客户端认证不过时三种 grant 一律带 error=invalid_client + 数字 code', async () => {
    asMocks.authenticateOAuthClient.mockResolvedValue({
      ok: false,
      status: 401,
      error: 'invalid_client',
      description: '应用凭证错误',
    })
    for (const payload of [
      { grant_type: 'authorization_code', code: 'c-1' },
      { grant_type: 'refresh_token', refresh_token: 'x' },
      { grant_type: 'client_credentials' },
    ]) {
      const res = await app.inject({ method: 'POST', url: '/oauth/token', payload })
      expect(res.statusCode).toBe(401)
      const body = res.json() as { error: string; code: number }
      expect(body.error).toBe('invalid_client')
      expect(body.code).toBe(401)
    }
  })

  // 「旧 5 参与旧响应形状零回归」由既有套件 tests/auth-oauth-server.test.ts 逐条钉住
  // (18 例,含 data.access_token / token_type / message 文案断言),本文件不重复注册
  // auth-extended 插件:它顶层 import ../db/index.js,而该模块正被并发任务改动中。
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
