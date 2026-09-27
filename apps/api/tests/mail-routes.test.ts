// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * mail 路由测试(/api/mail/send + /api/mail/send/html,人侧 JWT 或内部服务令牌)。
 *
 * 装车证明五件事:
 * ① /send 产出的 html 必须含机械风横幅关键字 —— 证明版式来自品牌层
 *    renderNoticeEmail(email-templates.ts)而不是旧的手搓 <br/> 拼接;
 * ② /send 的 text 字段仍原样送达(纯文本客户端可读);
 * ③ 调用方不传 from 时行为不变(202 + 响应结构不变);
 * ④ 限流配置真实挂在两个路由的 config 上 —— 双通道断言:
 *    路由注册对象捕获 + @fastify/rate-limit 真跑到第 11 次 429;
 * ⑤ 鉴权面(2026-09-27 补):两端点自 073de24a525 起挂 checkAuthOrInternalService,
 *    匿名请求一律 401。此前测试按"公开无鉴权"建裸 app,所以当路由被加上鉴权后
 *    这 8 条用例集体从 202 变 401 —— 而**没有任何一道门会喊**,因为门不跑测试。
 *    现在走真鉴权链(真签的 access token + 真 verifyAccessToken),只 mock 掉
 *    authenticate 里那一次用户状态查询;并补匿名/坏 token/refresh 当 access 三臂,
 *    让"鉴权在场"这件事本身成为被测对象而不是装配前提。
 *
 * 测试隔离:sendEmail 与 getUserStatus 全程 vi.mock,不触碰 SMTP/DB;
 * JWT_SECRET 由 tests/setup-env.ts 兜底(>=32 字符,NODE_ENV=test 允许 test- 前缀)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import rateLimit from '@fastify/rate-limit'
import { signAccessToken, signRefreshToken } from '@ihui/auth'

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
}))

vi.mock('../src/services/email-service.js', () => ({
  sendEmail: mocks.sendEmail,
}))

// authenticate 在验签后查一次用户状态(P2-14 加固),这里只把那次 DB 查询换掉;
// 验签、challenge 拒绝、CSRF、401 归一全部走真实现。
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

import mailRoutes from '../src/routes/mail'
import authPlugin, { checkAuthOrInternalService } from '../src/plugins/auth'

/** sendEmail 实参中本测试关心的字段 */
interface CapturedSendOptions {
  to: string
  subject: string
  html: string
  text?: string
}

function firstSendCall(): CapturedSendOptions {
  const call = mocks.sendEmail.mock.calls[0]
  if (!call) throw new Error('sendEmail 未被调用')
  return call[0] as CapturedSendOptions
}

const USER_ID = '6b8cd0f6-546f-44c8-853a-5f96edbe08be'
let accessToken = ''
let refreshToken = ''

function authHeader(): Record<string, string> {
  if (!accessToken) throw new Error('accessToken 未签发:顶层 beforeAll 没跑到')
  return { authorization: `Bearer ${accessToken}` }
}

// 顶层 beforeAll 先于各 describe 的 beforeAll 执行,所以 buildApp 里的路由拿得到 token
beforeAll(async () => {
  accessToken = await signAccessToken({
    userId: USER_ID,
    phone: '',
    familyId: 'f-mail-test',
    roleId: 0,
  })
  refreshToken = await signRefreshToken({
    userId: USER_ID,
    phone: '',
    familyId: 'f-mail-test',
    roleId: 0,
  })
})

async function buildApp(): Promise<FastifyInstance> {
  // 与 server.ts 装配一致:先注册全局 rate-limit,路由级 config 才能生效;
  // authPlugin 提供 request.userId/jwtPayload 装饰器(preHandler 的前置)
  const app = Fastify({ logger: false })
  await app.register(rateLimit, { max: 1000, timeWindow: '1 minute' })
  await app.register(authPlugin)
  await app.register(mailRoutes, { prefix: '/api/mail' })
  await app.ready()
  return app
}

describe('POST /api/mail/send — 品牌模板层装车', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(() => {
    mocks.sendEmail.mockReset()
    mocks.sendEmail.mockResolvedValue({ sent: false, stub: true, provider: 'stub' })
  })

  it('html 含机械风横幅关键字(版式来自 renderNoticeEmail,非手搓)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/mail/send',
      headers: authHeader(),
      payload: { to: 'user@example.com', subject: '开会提醒', text: '明天十点' },
    })
    expect(res.statusCode).toBe(202)
    const options = firstSendCall()
    // 机械风刊头横幅唯一标识(email-templates.ts renderDispatchEmail 的眉+题头)
    expect(options.html).toContain('THE&nbsp;MECHANICAL&nbsp;DISPATCH')
    expect(options.html).toContain('43.82°N')
    // 栏目眉来自本端点传入的 tag;旧手搓版式绝无这些结构
    expect(options.html).toContain('SYSTEM // NOTICE')
    expect(options.html).not.toMatch(/<br\/>/)
  })

  it('text 字段仍在且等于调用方原文;subject 语义不变', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/mail/send',
      headers: authHeader(),
      payload: { to: 'user@example.com', subject: '主题A', text: '第一行\n第二行' },
    })
    const options = firstSendCall()
    expect(options.text).toBe('第一行\n第二行')
    expect(options.subject).toBe('主题A')
  })

  it('模板内部已转义,无二次转义(&lt; 不叠成 &amp;lt;)', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/mail/send',
      headers: authHeader(),
      payload: { to: 'user@example.com', subject: 's', text: '<b>&x</b>' },
    })
    const options = firstSendCall()
    expect(options.html).toContain('&lt;b&gt;&amp;x&lt;/b&gt;')
    expect(options.html).not.toContain('&amp;lt;')
  })

  it('调用方不传 from 时行为不变(202 + 响应结构不变)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/mail/send',
      headers: authHeader(),
      payload: { to: 'user@example.com', subject: 's', text: 't' },
    })
    expect(res.statusCode).toBe(202)
    expect(res.json()).toEqual({
      code: 0,
      message: 'success',
      data: {
        accepted: ['user@example.com'],
        stub: true,
        message: '邮件发送降级为 stub(未配置 SMTP)',
      },
    })
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('fullTo 拼接逻辑不变(to+cc+bcc 逗号合并)', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/mail/send',
      headers: authHeader(),
      payload: {
        to: 'a@example.com',
        cc: 'b@example.com',
        bcc: 'c@example.com',
        subject: 's',
        text: 't',
      },
    })
    expect(firstSendCall().to).toBe('a@example.com,b@example.com,c@example.com')
  })
})

describe('POST /api/mail/send/html — 调用方自带 HTML 原样透送', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(() => {
    mocks.sendEmail.mockReset()
    mocks.sendEmail.mockResolvedValue({ sent: false, stub: true, provider: 'stub' })
  })

  it('html 不经品牌模板层,原样送达;text 为剥标签兜底', async () => {
    const callerHtml = '<div class="customer">自带版式</div>'
    const res = await app.inject({
      method: 'POST',
      url: '/api/mail/send/html',
      headers: authHeader(),
      payload: { to: 'user@example.com', subject: 's', html: callerHtml },
    })
    expect(res.statusCode).toBe(202)
    const options = firstSendCall()
    expect(options.html).toBe(callerHtml)
    expect(options.text).toBe('自带版式')
  })
})

describe('限流配置挂在两个路由的 config 上', () => {
  it('路由注册对象自带 config.rateLimit(max 10 / 1 minute)与鉴权 preHandler', async () => {
    interface CapturedRouteOptions {
      config?: { rateLimit?: { max?: number; timeWindow?: string | number } }
      preHandler?: unknown
    }
    const captured: Array<{ path: string; options: CapturedRouteOptions }> = []
    const recorder = {
      post(path: string, options: CapturedRouteOptions) {
        captured.push({ path, options })
      },
    } as unknown as FastifyInstance
    await mailRoutes(recorder, {})
    expect(captured.map((r) => r.path)).toEqual(['/send', '/send/html'])
    for (const route of captured) {
      expect(route.options.config?.rateLimit?.max).toBe(10)
      expect(route.options.config?.rateLimit?.timeWindow).toBe('1 minute')
      // 结构性锁(不吃"行为看起来对"的运气):摘掉 preHandler 或换成别的出口,这一条
      // 立刻红 —— 上面那四条 401 臂只有在这个出口**在场**时才是在测它。
      const hooks = Array.isArray(route.options.preHandler)
        ? route.options.preHandler
        : [route.options.preHandler]
      expect(hooks).toContain(checkAuthOrInternalService)
    }
  })

  it('/send 真跑限流:第 11 次请求 429(档位=10/min)', async () => {
    const app = await buildApp()
    try {
      const payload = { to: 'user@example.com', subject: 's', text: 't' }
      const auth = authHeader()
      for (let i = 0; i < 10; i++) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/mail/send',
          headers: auth,
          payload,
        })
        expect(res.statusCode).toBe(202)
      }
      const limited = await app.inject({
        method: 'POST',
        url: '/api/mail/send',
        headers: auth,
        payload,
      })
      expect(limited.statusCode).toBe(429)
    } finally {
      await app.close()
    }
  })

  it('/send/html 同档位限流:第 11 次请求 429', async () => {
    const app = await buildApp()
    try {
      const payload = { to: 'user@example.com', subject: 's', html: '<p>x</p>' }
      const auth = authHeader()
      for (let i = 0; i < 10; i++) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/mail/send/html',
          headers: auth,
          payload,
        })
        expect(res.statusCode).toBe(202)
      }
      const limited = await app.inject({
        method: 'POST',
        url: '/api/mail/send/html',
        headers: auth,
        payload,
      })
      expect(limited.statusCode).toBe(429)
    } finally {
      await app.close()
    }
  })
})

describe('mail 两端点的鉴权面(2026-09-27 补,073de24a525 挂了 checkAuthOrInternalService)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(() => {
    mocks.sendEmail.mockReset()
    mocks.sendEmail.mockResolvedValue({ sent: false, stub: true, provider: 'stub' })
  })

  const sendBody = { to: 'user@example.com', subject: 's', text: 't' }
  const htmlBody = { to: 'user@example.com', subject: 's', html: '<p>x</p>' }

  it('匿名 POST /send ⇒ 401,且一封都没发出去', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/mail/send', payload: sendBody })
    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe(401)
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('匿名 POST /send/html ⇒ 401,且一封都没发出去', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/mail/send/html', payload: htmlBody })
    expect(res.statusCode).toBe(401)
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('坏 token ⇒ 401(不是 500:验签失败被归一为鉴权结论)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/mail/send',
      headers: { authorization: 'Bearer not.a.jwt' },
      payload: sendBody,
    })
    expect(res.statusCode).toBe(401)
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('refresh token 不得当 access token 用 ⇒ 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/mail/send',
      headers: { authorization: `Bearer ${refreshToken}` },
      payload: sendBody,
    })
    expect(res.statusCode).toBe(401)
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('真签的 access token ⇒ 202(与上面四臂同 app 同路由,证明红在凭据不在装配)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/mail/send',
      headers: authHeader(),
      payload: sendBody,
    })
    expect(res.statusCode).toBe(202)
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
