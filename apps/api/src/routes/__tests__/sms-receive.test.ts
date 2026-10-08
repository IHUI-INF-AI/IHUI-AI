// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/admin/sms-receive 路由测试(管理员短信接码,d1jiema 平台对接)。
 *
 * 覆盖:401 未登录 / 502 token 未配置 / 平台 ERROR: 归一 / 成功 / pending /
 * 验证码提取 / 400 参数错误 / GET /used 60s 冷却 429 /
 * received 落台账(platform/usageKind 判定) / GET /phone-history 台账查询 /
 * GET /related-msgs 全局时间线(解析/空响应/ERROR/账密未配置/400)。
 * fetch 全局 mock(服务层走原生 fetch,不发真实请求)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// config 单例 mock:D1JIEMA_TOKEN/账密可按用例切换(空串=未配置档)
const mockConfig = vi.hoisted(() => ({
  D1JIEMA_TOKEN: '',
  D1JIEMA_ACCT: '',
  D1JIEMA_PASSWORD: '',
}))
vi.mock('../../config/index.js', () => ({ config: mockConfig }))

vi.mock('@ihui/auth', () => ({ verifyAccessToken: vi.fn() }))
vi.mock('../../db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))
vi.mock('jose', () => ({ decodeJwt: vi.fn(() => ({ type: 'access' })) }))

// 台账读写 mock:不连真实库,断言路由层落库参数
vi.mock('../../db/sms-receive-queries.js', () => ({
  recordSmsReceived: vi.fn().mockResolvedValue(undefined),
  getPhoneHistory: vi.fn().mockResolvedValue([]),
}))

import smsReceiveRoutes from '../admin/sms-receive.js'
import { verifyAccessToken } from '@ihui/auth'
import { recordSmsReceived, getPhoneHistory } from '../../db/sms-receive-queries.js'

const AUTH_HEADERS = { authorization: 'Bearer mock-admin-token' }

function mockAdminAuth(): void {
  vi.mocked(verifyAccessToken).mockResolvedValue({
    userId: 'mock-admin-id',
    phone: '13800000000',
    familyId: '11111111-1111-4111-8111-111111111111',
    roleId: 1,
  })
}

/** 构造全局 fetch mock,记录调用并按序返回文本 */
function mockFetchText(responses: string[]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn()
  for (const text of responses) {
    fetchMock.mockResolvedValueOnce(new Response(text, { status: 200 }))
  }
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('Admin SMS Receive — d1jiema 对接', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(smsReceiveRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminAuth()
    mockConfig.D1JIEMA_TOKEN = 'test-d1jiema-token'
    mockConfig.D1JIEMA_ACCT = 'test-acct'
    mockConfig.D1JIEMA_PASSWORD = 'test-pwd'
    // 默认兜底 stub:防止个别用例漏 stub 时真实请求打到 d1jiema 平台
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ERROR:no-mock', { status: 200 })))
  })

  it('无 auth 返回 401', async () => {
    vi.mocked(verifyAccessToken).mockRejectedValue(
      Object.assign(new Error('Authentication required'), { statusCode: 401 }),
    )
    const res = await app.inject({ method: 'POST', url: '/api/admin/sms-receive/balance' })
    expect(res.statusCode).toBe(401)
  })

  it('D1JIEMA_TOKEN 未配置返回 502 且提示未配置', async () => {
    mockConfig.D1JIEMA_TOKEN = ''
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/sms-receive/balance',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(502)
    expect(res.json().message).toContain('未配置')
  })

  it('balance 成功返回平台余额,URL 携带 code=leftAmount 与 token', async () => {
    const fetchMock = mockFetchText(['12.34'])
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/sms-receive/balance',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.balance).toBe('12.34')
    const calledUrl = String(fetchMock.mock.calls[0]?.[0] ?? '')
    expect(calledUrl).toContain('code=leftAmount')
    expect(calledUrl).toContain('token=test-d1jiema-token')
  })

  it('平台 ERROR: 前缀归一为 502 并透出错误正文', async () => {
    mockFetchText(['ERROR:余额不足'])
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/sms-receive/phone',
      headers: AUTH_HEADERS,
      payload: { keyWord: '毛竹' },
    })
    expect(res.statusCode).toBe(502)
    expect(res.json().message).toContain('余额不足')
  })

  it('phone 成功取号返回手机号', async () => {
    mockFetchText(['16512345678'])
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/sms-receive/phone',
      headers: AUTH_HEADERS,
      payload: { keyWord: '毛竹', cardType: '虚卡' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.phone).toBe('16512345678')
  })

  it('phone 取号遇脱敏号自动释放重取,直到拿到全号', async () => {
    // 平台偶发返回脱敏号(如 165****7249),getMsg 拒收(手机号格式错误) → 服务层自动释放重取
    const fetchMock = mockFetchText(['165****7249', '释放成功', '19138172097'])
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/sms-receive/phone',
      headers: AUTH_HEADERS,
      payload: { keyWord: 'trae' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.phone).toBe('19138172097')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('code=release')
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('165****7249')
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('code=getPhone')
  })

  it('phone 连续 5 次脱敏号返回 502(防死循环烧号)', async () => {
    mockFetchText([
      '165****7249', '释放成功',
      '165****7249', '释放成功',
      '165****7249', '释放成功',
      '165****7249', '释放成功',
      '165****7249', '释放成功',
    ])
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/sms-receive/phone',
      headers: AUTH_HEADERS,
      payload: { keyWord: 'trae' },
    })
    expect(res.statusCode).toBe(502)
    expect(res.json().message).toContain('脱敏号')
  })

  it('phone 参数错误返回 400(非法手机号)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/sms-receive/phone',
      headers: AUTH_HEADERS,
      payload: { keyWord: '毛竹', phone: 'abc' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe(400)
  })

  it('message 未收到短信返回 pending', async () => {
    mockFetchText(['[尚未收到]请稍后再试'])
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/sms-receive/message',
      headers: AUTH_HEADERS,
      payload: { phone: '16512345678', keyWord: '毛竹' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.status).toBe('pending')
  })

  it('message 收到短信返回 received 并提取验证码', async () => {
    mockFetchText(['【毛竹】验证码9876,5分钟内有效'])
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/sms-receive/message',
      headers: AUTH_HEADERS,
      payload: { phone: '16512345678', keyWord: '毛竹' },
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data.status).toBe('received')
    expect(data.code).toBe('9876')
    expect(data.raw).toContain('毛竹')
  })

  it('release 成功返回 ok', async () => {
    mockFetchText(['释放成功'])
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/sms-receive/release',
      headers: AUTH_HEADERS,
      payload: { phone: '16512345678' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.ok).toBe(true)
  })

  it('release/message/phone-history 接受平台脱敏号(含 *)', async () => {
    // 平台 getPhone 返回脱敏号(如 193****6470),回传校验必须放行 *(实测平台接受脱敏号 release)
    const masked = '193****6470'
    mockFetchText(['释放成功'])
    const releaseRes = await app.inject({
      method: 'POST',
      url: '/api/admin/sms-receive/release',
      headers: AUTH_HEADERS,
      payload: { phone: masked },
    })
    expect(releaseRes.statusCode).toBe(200)
    expect(releaseRes.json().data.ok).toBe(true)

    mockFetchText(['[尚未收到]请稍后再试'])
    const msgRes = await app.inject({
      method: 'POST',
      url: '/api/admin/sms-receive/message',
      headers: AUTH_HEADERS,
      payload: { phone: masked, keyWord: 'trae' },
    })
    expect(msgRes.statusCode).toBe(200)
    expect(msgRes.json().data.status).toBe('pending')

    const histRes = await app.inject({
      method: 'GET',
      url: `/api/admin/sms-receive/phone-history?phone=${encodeURIComponent(masked)}`,
      headers: AUTH_HEADERS,
    })
    expect(histRes.statusCode).toBe(200)
  })

  it('send 目标号码 toPhone 不接受脱敏/非法字符返回 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/sms-receive/send',
      headers: AUTH_HEADERS,
      payload: { phone: '193****6470', toPhone: '138****0000', content: 'hello' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe(400)
  })

  it('used 冷却期内返回 429(限频 1 次/分钟)', async () => {
    mockFetchText(['record-1\nrecord-2'])
    const first = await app.inject({
      method: 'GET',
      url: '/api/admin/sms-receive/used',
      headers: AUTH_HEADERS,
    })
    expect(first.statusCode).toBe(200)
    expect(first.json().data.items).toEqual(['record-1', 'record-2'])
    const second = await app.inject({
      method: 'GET',
      url: '/api/admin/sms-receive/used',
      headers: AUTH_HEADERS,
    })
    expect(second.statusCode).toBe(429)
  })

  it('message received(登录文案)落台账:platform=trae usageKind=login', async () => {
    mockFetchText(['【trae】验证码058967,用于手机验证码登录,5分钟内有效。'])
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/sms-receive/message',
      headers: AUTH_HEADERS,
      payload: { phone: '16512345678', keyWord: 'trae' },
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data.status).toBe('received')
    expect(data.platform).toBe('trae')
    expect(data.usageKind).toBe('login')
    expect(vi.mocked(recordSmsReceived)).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '16512345678',
        keyword: 'trae',
        platform: 'trae',
        usageKind: 'login',
        smsCode: '058967',
      }),
    )
  })

  it('message received(注册文案)落台账 usageKind=register', async () => {
    mockFetchText(['【毛竹】验证码9876,您正在注册账号,5分钟内有效。'])
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/sms-receive/message',
      headers: AUTH_HEADERS,
      payload: { phone: '16512345678', keyWord: '毛竹' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.usageKind).toBe('register')
    expect(vi.mocked(recordSmsReceived)).toHaveBeenCalledWith(
      expect.objectContaining({ usageKind: 'register', platform: '毛竹' }),
    )
  })

  it('phone-history 返回本地台账流水', async () => {
    vi.mocked(getPhoneHistory).mockResolvedValueOnce([
      {
        id: '0b8f9a1e-1111-4111-8111-111111111111',
        phone: '16512345678',
        keyword: 'trae',
        platform: 'trae',
        usageKind: 'login',
        smsCode: '058967',
        smsRaw: '【trae】验证码058967,用于手机验证码登录,5分钟内有效。',
        receivedAt: new Date('2026-10-08T12:00:00Z'),
      },
    ])
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/sms-receive/phone-history?phone=16512345678',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const items = res.json().data.items
    expect(items).toHaveLength(1)
    expect(items[0].platform).toBe('trae')
    expect(items[0].usageKind).toBe('login')
    expect(vi.mocked(getPhoneHistory)).toHaveBeenCalledWith('16512345678', 20)
  })

  it('phone-history 参数错误返回 400(非法手机号)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/sms-receive/phone-history?phone=abc',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe(400)
  })

  it('phone-history 未登录返回 401', async () => {
    vi.mocked(verifyAccessToken).mockRejectedValue(
      Object.assign(new Error('Authentication required'), { statusCode: 401 }),
    )
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/sms-receive/phone-history?phone=16512345678',
    })
    expect(res.statusCode).toBe(401)
  })

  it('related-msgs 成功解析平台全局时间线(时间+标记)', async () => {
    const fetchMock = mockFetchText([
      '17:38 N ***内容仅使用过的用户通过“获取验证码”按钮可见*** 17:36 Y ***内容仅使用过的用户通过“获取验证码”按钮可见*** 16:44 N ***内容仅使用过的用户通过“获取验证码”按钮可见***',
    ])
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/sms-receive/related-msgs?phone=19138172097',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const items = res.json().data.items
    expect(items).toEqual([
      { time: '17:38', flag: 'N' },
      { time: '17:36', flag: 'Y' },
      { time: '16:44', flag: 'N' },
    ])
    // 走网页版 trsCode 体系,p 参数按 phoneNo\nacct\npassword 传递
    const calledUrl = String(fetchMock.mock.calls[0]?.[0] ?? '')
    expect(calledUrl).toContain('trsCode=relatedMsgs')
    expect(calledUrl).toContain(encodeURIComponent('19138172097\ntest-acct\ntest-pwd'))
  })

  it('related-msgs 空响应返回空数组(处女号)', async () => {
    mockFetchText([''])
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/sms-receive/related-msgs?phone=16512345678',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.items).toEqual([])
  })

  it('related-msgs 平台 ERROR: 前缀归一为 502', async () => {
    mockFetchText(['ERROR:查询失败'])
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/sms-receive/related-msgs?phone=16512345678',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(502)
    expect(res.json().message).toContain('查询失败')
  })

  it('related-msgs 网页版账密未配置返回 502 且提示未配置', async () => {
    mockConfig.D1JIEMA_ACCT = ''
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/sms-receive/related-msgs?phone=16512345678',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(502)
    expect(res.json().message).toContain('未配置')
  })

  it('related-msgs 参数错误返回 400(非法手机号)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/sms-receive/related-msgs?phone=abc',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe(400)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
