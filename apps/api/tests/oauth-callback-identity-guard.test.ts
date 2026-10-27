// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OAuth 回调的身份不变量:主体标识为空 ⇒ 不许建用户、不许落绑定、不许发 token。
 *
 * 立因(2026-10-22 逐条读码 + 线上现测):`POST /api/auth/:platform/callback` 的微信网站应用分支
 * 验了第一段 `sns/oauth2/access_token`,**没验第二段 `sns/userinfo`**。而微信在这类接口上的
 * 失败形态是 HTTP 200 + `body.errcode`(40001/40003 等),于是 `wxUser.openid` 会是 undefined,
 * `openId` 就带着空值继续往下走。
 *
 * 它今天没造成事故,纯属侥幸:`nickname ?? \`用户${openId.slice(-6)}\`` 恰好先抛 TypeError ⇒ 500。
 * **不变量靠求值顺序兜住,等于没有不变量** —— 昵称一旦有值(或有人重排那行模板),
 * 就会静默造出一个 `open_id` 为空的用户 + 一条空绑定,并且当场把合法 token 发出去。
 * §5「认证不等于授权」那条铁律说的就是这件事:主体标识必须显式入参、不得可缺省。
 *
 * 所以本文件断言的是**副作用没发生**(mock 的 createUser / createThirdPartyBinding 零调用),
 * 而不是只看状态码 —— 只看状态码的"拒绝"测试,在实现退化成"照常建号但返回 400"时照样绿。
 * 并成对给一条正向对照:标识正常时必须建号成功,否则这一族会退化成"一律拒绝"也测不出。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import type { Redis } from 'ioredis'

const dbMocks = vi.hoisted(() => ({
  findUserByPhone: vi.fn(),
  findUserById: vi.fn(),
  createUser: vi.fn(),
  findThirdPartyAccount: vi.fn(),
  createThirdPartyBinding: vi.fn(),
  saveRefreshToken: vi.fn(),
  getUserStatus: vi.fn(),
  getUserPermissions: vi.fn(),
  gateLoginIpWhitelist: vi.fn(),
}))

vi.mock('../src/db/queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    findUserByPhone: dbMocks.findUserByPhone,
    findUserById: dbMocks.findUserById,
    createUser: dbMocks.createUser,
    saveRefreshToken: dbMocks.saveRefreshToken,
  }
})
vi.mock('../src/db/oauth-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    findThirdPartyAccount: dbMocks.findThirdPartyAccount,
    createThirdPartyBinding: dbMocks.createThirdPartyBinding,
  }
})
vi.mock('../src/db/usercenter-queries.js', () => ({ getUserStatus: dbMocks.getUserStatus }))
vi.mock('../src/db/rbac-queries.js', () => ({ getUserPermissions: dbMocks.getUserPermissions }))
// 登录 IP 白名单闸不桩掉会在成功路径真查库 ⇒ 正向对照整例 500(与同族 wechat-mini 用例同一处理)
vi.mock('../src/routes/user/ip-whitelist-guard.js', () => ({
  gateLoginIpWhitelist: dbMocks.gateLoginIpWhitelist,
}))

import { authExtendedRoutes } from '../src/routes/auth-extended.js'
import {
  OAUTH_CONSENT_KEY_PREFIX,
  OAUTH_CONSENT_TTL_SECONDS,
} from '../src/services/oauth-consent.js'

/** 发起期同意记录的 Redis 内存替身:回调在查/建用户前会一次性消费该 key。 */
class FakeRedis {
  private readonly store = new Map<string, { value: string; expiresAt: number | null }>()

  async set(key: string, value: string, _ex?: string, ttlSeconds?: number): Promise<'OK'> {
    this.store.set(key, {
      value,
      expiresAt: typeof ttlSeconds === 'number' ? Date.now() + ttlSeconds * 1000 : null,
    })
    return 'OK'
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key)
    if (!entry) return null
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key)
      return null
    }
    return entry.value
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0
  }

  clear(): void {
    this.store.clear()
  }
}

const consentRedis = new FakeRedis()

/** 预置一条发起期同意记录:这些用例考的是"空主体标识不得建号",不是同意闸本身。 */
async function seedConsent(platform: string, state: string): Promise<void> {
  await consentRedis.set(
    OAUTH_CONSENT_KEY_PREFIX + state,
    JSON.stringify({ platform, agreementAccepted: true, createdAt: new Date().toISOString() }),
    'EX',
    OAUTH_CONSENT_TTL_SECONDS,
  )
}

const WECHAT_KEYS = ['WECHAT_APP_ID', 'WECHAT_APP_SECRET']

let app: FastifyInstance
const originalFetch = globalThis.fetch

/** 微信网站应用两段调用:第一段换 token 成功,第二段 userinfo 返回 200 + errcode(拒绝) */
function stubWechatUserinfoRejected(): void {
  globalThis.fetch = (async (url: string | URL) => {
    const u = String(url)
    if (u.includes('/sns/oauth2/access_token')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'fixture-token', openid: 'o-fixture', unionid: 'u-f' }),
      } as unknown as Response
    }
    if (u.includes('/sns/userinfo')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ errcode: 40003, errmsg: 'input code, but openid is invalid' }),
      } as unknown as Response
    }
    throw new Error(`夹具没准备好的 URL:${u.slice(0, 60)}`)
  }) as never
}

beforeEach(async () => {
  vi.clearAllMocks()
  for (const k of WECHAT_KEYS) delete process.env[k]
  process.env.WECHAT_APP_ID = 'wx-fixture-appid'
  process.env.WECHAT_APP_SECRET = 'wx-fixture-secret'
  dbMocks.findThirdPartyAccount.mockResolvedValue(undefined)
  dbMocks.getUserStatus.mockResolvedValue(1)
  dbMocks.getUserPermissions.mockResolvedValue([])
  dbMocks.saveRefreshToken.mockResolvedValue(undefined)
  dbMocks.gateLoginIpWhitelist.mockResolvedValue({ allowed: true })
  dbMocks.createUser.mockResolvedValue({
    id: 'user-new',
    phone: null,
    email: null,
    username: '',
    nickname: 'x',
    status: 1,
    roleId: 0,
  })
  app = Fastify({ logger: false })
  // 通用回调先过同意闸:用内存 Redis 预置记录(闸本身的用例见 oauth-consent-gate.test.ts)
  consentRedis.clear()
  await seedConsent('wechat', 's')
  app.decorate('redis', consentRedis as unknown as Redis)
  await app.register(cookie)
  await app.register(authExtendedRoutes, { prefix: '/api' })
  await app.ready()
})

describe('OAuth 回调:空主体标识不得建号、不得发 token', () => {
  it('微信第二段被拒(200 + errcode)⇒ 400,且 createUser / createThirdPartyBinding 零调用', async () => {
    stubWechatUserinfoRejected()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/wechat/callback',
      payload: { code: 'FAKE-CODE', state: 's' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe(400)
    // 副作用断言:这是本文件存在的理由
    expect(dbMocks.createUser).not.toHaveBeenCalled()
    expect(dbMocks.createThirdPartyBinding).not.toHaveBeenCalled()
    expect(res.payload).not.toMatch(/accessToken|"token"/)
  })

  it('正向对照:标识正常时这一族必须仍然能建号(防止修成"一律拒绝"的假绿)', async () => {
    globalThis.fetch = (async (url: string | URL) => {
      const u = String(url)
      if (u.includes('/sns/oauth2/access_token')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'fixture-token',
            openid: 'o-real',
            unionid: 'u-real',
          }),
        } as unknown as Response
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          openid: 'o-real',
          unionid: 'u-real',
          nickname: '张三',
          headimgurl: '',
        }),
      } as unknown as Response
    }) as never
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/wechat/callback',
      payload: { code: 'GOOD-CODE', state: 's' },
    })
    expect(res.statusCode).toBe(200)
    expect(dbMocks.createUser).toHaveBeenCalledTimes(1)
    expect(dbMocks.createThirdPartyBinding).toHaveBeenCalledTimes(1)
    // 绑定必须带着非空标识落库,而不是空串
    const arg = dbMocks.createThirdPartyBinding.mock.calls[0]?.[0] as { openId?: string }
    expect(typeof arg.openId === 'string' && arg.openId.length > 0).toBe(true)
  })

  it('未配置那档也不能被"绕过":清掉密钥后仍不得建号', async () => {
    for (const k of WECHAT_KEYS) delete process.env[k]
    stubWechatUserinfoRejected()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/wechat/callback',
      payload: { code: 'FAKE-CODE', state: 's' },
    })
    expect(res.statusCode).toBe(400)
    expect(dbMocks.createUser).not.toHaveBeenCalled()
  })
})

afterEach(() => {
  globalThis.fetch = originalFetch
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
