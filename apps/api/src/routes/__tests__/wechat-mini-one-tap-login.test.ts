// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'

const wechatMocks = vi.hoisted(() => ({
  isWechatMiniConfigured: vi.fn(() => true),
  jscode2session: vi.fn(),
  getPhoneNumber: vi.fn(),
}))

const userMocks = vi.hoisted(() => ({
  findUserByPhone: vi.fn(),
  createUser: vi.fn(),
  saveRefreshToken: vi.fn(),
  findThirdPartyAccount: vi.fn(),
  createThirdPartyBinding: vi.fn(),
  gateLoginIpWhitelist: vi.fn(),
  // 免鉴权断言用:一旦被调用就抛,路由若误挂 authenticate 会直接 401
  authenticate: vi.fn(async () => {
    throw Object.assign(new Error('should not be called'), { statusCode: 401 })
  }),
}))

vi.mock('../../services/oauth-providers.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, ...wechatMocks }
})

vi.mock('../../db/queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    findUserByPhone: userMocks.findUserByPhone,
    createUser: userMocks.createUser,
    saveRefreshToken: userMocks.saveRefreshToken,
  }
})

vi.mock('../../db/oauth-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    findThirdPartyAccount: userMocks.findThirdPartyAccount,
    createThirdPartyBinding: userMocks.createThirdPartyBinding,
  }
})

vi.mock('../../plugins/auth.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, authenticate: userMocks.authenticate }
})

vi.mock('../user/ip-whitelist-guard.js', () => ({
  gateLoginIpWhitelist: userMocks.gateLoginIpWhitelist,
}))

vi.mock('../../db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn(async () => 1),
}))

// resolveUserPermissions 对 roleId=0 的用户会真查 RBAC 表 ⇒ 桩掉,否则成功路径整例 500
vi.mock('../../db/rbac-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, getUserPermissions: vi.fn(async () => [] as string[]) }
})

vi.mock('@ihui/auth', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    signAccessToken: vi.fn(async () => 'access-jwt'),
    signRefreshToken: vi.fn(async () => 'refresh-jwt'),
  }
})

import { authExtendedRoutes } from '../auth-extended.js'

const URL = '/api/auth/wechat/mini/one-tap-login'
const BODY = { loginCode: 'login-code-1', phoneCode: 'phone-code-1' }

const activeUser = {
  id: 'u-1',
  phone: '13800138000',
  roleId: 0,
  familyId: 'f-1',
  status: 1,
}

describe('POST /api/auth/wechat/mini/one-tap-login — 微信手机号一键登录', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(cookie)
    await app.register(authExtendedRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    wechatMocks.isWechatMiniConfigured.mockReturnValue(true)
    wechatMocks.getPhoneNumber.mockResolvedValue('13800138000')
    wechatMocks.jscode2session.mockResolvedValue({
      openId: 'ox-1',
      unionId: 'uy-1',
      sessionKey: 'sk',
    })
    userMocks.findUserByPhone.mockResolvedValue({ ...activeUser })
    userMocks.createUser.mockResolvedValue({ ...activeUser })
    userMocks.findThirdPartyAccount.mockResolvedValue(undefined)
    userMocks.createThirdPartyBinding.mockResolvedValue(undefined)
    userMocks.saveRefreshToken.mockResolvedValue(undefined)
    userMocks.gateLoginIpWhitelist.mockResolvedValue({ allowed: true })
  })

  const post = (body: unknown) => app.inject({ method: 'POST', url: URL, payload: body as object })

  it('免鉴权:不带 Authorization 也能完成登录,并拿到 token 对 + user(形状对齐 /login/sms)', async () => {
    const res = await post(BODY)
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.accessToken).toBe('access-jwt')
    expect(body.data.refreshToken).toBe('refresh-jwt')
    // 页面直接读 data.user 填昵称头像;退化成只回 userId 就等于逼前端再打一次 profile
    expect(body.data.user).toBeTruthy()
    expect(body.data.user.id).toBe('u-1')
    // 反向锁:这支端点结构上不得调用 authenticate(否则新用户永远进不来)
    expect(userMocks.authenticate).not.toHaveBeenCalled()
  })

  it('手机号只来自 phoneCode 向微信换取,不接受 body 自报(§5 不得信客户端)', async () => {
    const res = await post({ ...BODY, phone: '13900000000' })
    expect(res.statusCode).toBe(400)
    expect(wechatMocks.getPhoneNumber).not.toHaveBeenCalled()
    expect(userMocks.createUser).not.toHaveBeenCalled()
    // 对照:同一具手机号只能通过 phoneCode 换回来,走通后确实拿得到登录态
    const ok = await post(BODY)
    expect(ok.json().data.user.id).toBe('u-1')
    expect(wechatMocks.getPhoneNumber).toHaveBeenCalledWith('phone-code-1')
  })

  it('缺任一 code ⇒ 400,且绝不碰微信接口', async () => {
    for (const bad of [{ phoneCode: 'x' }, { loginCode: 'x' }, {}, { loginCode: '' }]) {
      const res = await post(bad)
      expect(res.statusCode).toBe(400)
    }
    expect(wechatMocks.getPhoneNumber).not.toHaveBeenCalled()
    expect(wechatMocks.jscode2session).not.toHaveBeenCalled()
  })

  it('未配置微信小程序 ⇒ 503 明确失败,不得回 mock success 冒充登录成功', async () => {
    wechatMocks.isWechatMiniConfigured.mockReturnValue(false)
    const res = await post(BODY)
    expect(res.statusCode).toBe(503)
    expect(res.json().data ?? {}).not.toHaveProperty('accessToken')
  })

  it('手机号无对应用户 ⇒ 建号并绑定 openId(首登即注册)', async () => {
    userMocks.findUserByPhone.mockResolvedValue(undefined)
    const res = await post(BODY)
    expect(res.statusCode).toBe(200)
    expect(userMocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '13800138000', status: 1 }),
    )
    expect(userMocks.createThirdPartyBinding).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-1', openId: 'ox-1', platform: 'wechat' }),
    )
  })

  it('已绑定过 ⇒ 不再重复建绑定', async () => {
    userMocks.findThirdPartyAccount.mockResolvedValue({ userId: 'u-1', openId: 'ox-1' })
    const res = await post(BODY)
    expect(res.statusCode).toBe(200)
    expect(userMocks.createThirdPartyBinding).not.toHaveBeenCalled()
  })

  it('该微信已绑到别的账号 ⇒ 409,且不发 token、不静默改绑', async () => {
    userMocks.findThirdPartyAccount.mockResolvedValue({ userId: 'someone-else', openId: 'ox-1' })
    const res = await post(BODY)
    expect(res.statusCode).toBe(409)
    const body = res.json()
    expect(body.data ?? {}).not.toHaveProperty('accessToken')
    expect(userMocks.createThirdPartyBinding).not.toHaveBeenCalled()
    expect(userMocks.saveRefreshToken).not.toHaveBeenCalled()
  })

  it('账号被禁用 ⇒ 403 且不发 token', async () => {
    userMocks.findUserByPhone.mockResolvedValue({ ...activeUser, status: 0 })
    const res = await post(BODY)
    expect(res.statusCode).toBe(403)
    expect(res.json().data ?? {}).not.toHaveProperty('accessToken')
    expect(userMocks.saveRefreshToken).not.toHaveBeenCalled()
  })

  it('微信换码失败 ⇒ 401,响应里不得出现微信原文或 code', async () => {
    wechatMocks.getPhoneNumber.mockRejectedValue(
      new Error('40001 invalid credential access_token 泄露点 abc123'),
    )
    const res = await post(BODY)
    expect(res.statusCode).toBe(401)
    const text = res.payload
    expect(text).not.toContain('40001')
    expect(text).not.toContain('abc123')
    expect(text).not.toContain('phone-code-1')
    expect(userMocks.saveRefreshToken).not.toHaveBeenCalled()
  })

  it('IP 白名单门禁拦下 ⇒ 不发 token', async () => {
    // mock 必须返回**真实 reply 句柄**:路由是 `return gate.reply`,
    // 早先这里塞了个假对象 {statusCode:403},Fastify 把它当响应体序列化成了 200 ——
    // 那是 mock 不成立,不是代码错。
    userMocks.gateLoginIpWhitelist.mockImplementation(async (_req, reply) => ({
      allowed: false,
      reply: reply.status(403).send({ code: 403, message: 'IP 不在允许范围内' }),
    }))
    const res = await post(BODY)
    expect(res.statusCode).toBe(403)
    expect(userMocks.saveRefreshToken).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
