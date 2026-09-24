// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * email-service 单元测试(智能路由 / Fallback)
 *
 * 覆盖:
 * 1. 智能路由:isDomesticEmail + resolveProvider 在不同 MAIL_PROVIDER 下的判定
 * 2. Fallback 链路:primary provider 失败 → SMTP 兜底 → 最终失败时不抛错
 * 3. 回归保护:SES 通道删除后,任何配置组合下 provider 永不返回 'tencent',
 *    stub 原因枚举与 warn 文案不再出现 TENCENT_SES 相关字样
 *
 * 与 email-e2e-test.ts 的差异:
 * - 本文件是 vitest 单元测试,跑 `pnpm --filter @ihui/api test` 全量套件时自动执行
 * - 不依赖 mock SMTP 服务器 / 真实 API / dotenv 手动加载
 * - 通过 vi.mock config + vi.stubGlobal fetch 实现 provider 切换与降级验证
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// 用 vi.hoisted 让 mock 对象在 mock factory 中可用
const { mockConfig, mockSmtpSendMail, mockLogger } = vi.hoisted(() => ({
  mockConfig: {
    NODE_ENV: 'test' as const,
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: 587,
    SMTP_USER: 'user',
    SMTP_PASS: 'pass',
    SMTP_FROM: 'noreply@aizhs.top',
    SMTP_ENABLED: false,
    MAIL_PROVIDER: 'auto' as 'auto' | 'smtp' | 'resend',
    RESEND_API_KEY: '',
    RESEND_FROM: '',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
    AI_SERVICE_URL: 'http://localhost:8803',
    AI_CALLBACK_SECRET: '',
    TBOX_WEBHOOK_SECRET: '',
    TENCENT_LIVE_CALLBACK_KEY: '',
    TENCENT_LIVE_APP_ID: '',
    TENCENT_LIVE_API_KEY: '',
    CORS_ORIGIN: 'http://localhost:8801',
    HOST: '0.0.0.0',
    PORT: 8802,
    LOG_LEVEL: 'info',
    API_LOG_SAMPLE_RATE: 0.1,
    API_LOG_ENABLED: true,
    API_LOG_BATCH_SIZE: 100,
    API_LOG_FLUSH_INTERVAL_MS: 5000,
    JWT_EXPIRES_IN: '7d',
  },
  // SMTP 兜底链路 mock:sendViaSmtp 内部 `await import('nodemailer')`
  // 后会用 createTransport(...).sendMail(...) 真实连接 SMTP_HOST。
  // 不 mock 时单测会真实连接 smtp.example.com:587 —— 本机 DNS 劫持返回
  // 假 IP 导致 TCP 挂起,15s 超时(2026-08-28 pnpm test 全量失败根因)。
  mockSmtpSendMail: vi.fn().mockResolvedValue({ messageId: '<mock@smtp>' }),
  // logger mock:stub 分支的 warn 行需要被断言(内容/脱敏),且不污染测试输出
  mockLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../src/config/index.js', () => ({
  config: mockConfig,
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: mockLogger,
}))

// mock nodemailer(避免单测打真实网络)
vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({ sendMail: mockSmtpSendMail })),
}))

// mock database(避免任何真实 DB 写入)
vi.mock('@ihui/database', () => ({
  emailLogs: {
    values: vi.fn().mockReturnValue({ execute: vi.fn().mockResolvedValue(undefined) }),
  },
}))

// mock db(避免真实 DB 连接)
vi.mock('../src/db/index.js', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ execute: vi.fn().mockResolvedValue(undefined) }),
    }),
  },
}))

import {
  isDomesticEmail,
  resolveProvider,
  diagnoseMailTransport,
  sendEmail,
} from '../src/services/email-service.js'

describe('email-service — isDomesticEmail', () => {
  it.each([
    'qq.com',
    'foxmail.com',
    '163.com',
    '126.com',
    'yeah.net',
    'sina.com',
    'sina.cn',
    'sohu.com',
    '139.com',
    'aliyun.com',
    '189.cn',
    'wo.cn',
    '263.net',
    'vip.qq.com',
    'vip.163.com',
  ])('%s 是国内邮箱', (domain) => {
    expect(isDomesticEmail(`user@${domain}`)).toBe(true)
  })

  it.each(['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'icloud.com'])(
    '%s 是国外邮箱',
    (domain) => {
      expect(isDomesticEmail(`user@${domain}`)).toBe(false)
    },
  )

  it('域名自动转小写后匹配', () => {
    expect(isDomesticEmail('user@QQ.COM')).toBe(true)
    expect(isDomesticEmail('user@Gmail.Com')).toBe(false)
  })

  it('无 @ 的字符串返回 false', () => {
    expect(isDomesticEmail('not-an-email')).toBe(false)
  })

  it('空字符串返回 false', () => {
    expect(isDomesticEmail('')).toBe(false)
  })
})

describe('email-service — resolveProvider', () => {
  beforeEach(() => {
    // 重置为 auto + 全部 provider 未配置
    mockConfig.MAIL_PROVIDER = 'auto'
    mockConfig.RESEND_API_KEY = ''
    mockConfig.SMTP_ENABLED = false
    mockConfig.SMTP_HOST = ''
  })

  it('auto 模式 + 全部 provider 未配置 → stub', () => {
    expect(resolveProvider('user@qq.com')).toBe('stub')
    expect(resolveProvider('user@gmail.com')).toBe('stub')
  })

  it('auto 模式 + Resend 已配置 + 国外邮箱 → resend', () => {
    mockConfig.RESEND_API_KEY = 're_test123'
    expect(resolveProvider('user@gmail.com')).toBe('resend')
  })

  it('auto 模式 + Resend 已配置 + 国内邮箱 → 不走 resend(走 smtp 或 stub)', () => {
    mockConfig.RESEND_API_KEY = 're_test123'
    // 国内邮箱,resend 优先度低,SMTP 未配 → stub
    expect(resolveProvider('user@qq.com')).toBe('stub')
  })

  it('auto 模式 + 仅 SMTP 配置 + 任何邮箱 → smtp', () => {
    mockConfig.SMTP_ENABLED = true
    mockConfig.SMTP_HOST = 'smtp.example.com'
    expect(resolveProvider('user@qq.com')).toBe('smtp')
    expect(resolveProvider('user@gmail.com')).toBe('smtp')
  })

  it('显式 MAIL_PROVIDER=resend + API Key 未配置 → 不返回 resend(降级)', () => {
    mockConfig.MAIL_PROVIDER = 'resend'
    mockConfig.RESEND_API_KEY = ''
    expect(resolveProvider('user@gmail.com')).toBe('stub')
  })

  it('显式 MAIL_PROVIDER=smtp + SMTP 未启用 → 不返回 smtp(降级)', () => {
    mockConfig.MAIL_PROVIDER = 'smtp'
    mockConfig.SMTP_ENABLED = false
    expect(resolveProvider('user@qq.com')).toBe('stub')
  })

  it('回归保护:SES 删除后,任何配置组合下 provider 永不返回 tencent', () => {
    // 全未配置
    expect(resolveProvider('user@qq.com')).not.toBe('tencent')
    expect(resolveProvider('user@gmail.com')).not.toBe('tencent')
    // 仅 Resend
    mockConfig.RESEND_API_KEY = 're_test123'
    expect(resolveProvider('user@qq.com')).not.toBe('tencent')
    expect(resolveProvider('user@gmail.com')).not.toBe('tencent')
    // 仅 SMTP
    mockConfig.SMTP_ENABLED = true
    mockConfig.SMTP_HOST = 'smtp.example.com'
    expect(resolveProvider('user@qq.com')).not.toBe('tencent')
    expect(resolveProvider('user@gmail.com')).not.toBe('tencent')
  })
})

describe('email-service — sendEmail Fallback 链路', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // 重置为所有 provider 未配置(默认 stub 路径)
    mockConfig.MAIL_PROVIDER = 'auto'
    mockConfig.RESEND_API_KEY = ''
    mockConfig.SMTP_ENABLED = false
    mockConfig.SMTP_HOST = ''

    // 准备 fetch mock
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('stub 模式:不调用 fetch,直接返回 stub=true', async () => {
    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'test',
      html: '<p>x</p>',
    })
    expect(result.stub).toBe(true)
    expect(result.sent).toBe(false)
    expect(result.provider).toBe('stub')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('Resend 成功路径:调用 fetch + Authorization 头 + 返回 sent=true', async () => {
    mockConfig.RESEND_API_KEY = 're_test123'
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'msg-1' }) })

    const result = await sendEmail({
      to: 'user@gmail.com',
      subject: 'hello',
      html: '<p>x</p>',
    })
    expect(result.sent).toBe(true)
    expect(result.provider).toBe('resend')
    // 真实通道走通时不携带"未发送原因"
    expect(result.reasons).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test123')
  })

  it('Resend 失败:返回 sent=false + provider=resend + 不抛错', async () => {
    mockConfig.RESEND_API_KEY = 're_test123'
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    })

    const result = await sendEmail({
      to: 'user@gmail.com',
      subject: 'hello',
      html: '<p>x</p>',
    })
    expect(result.sent).toBe(false)
    expect(result.provider).toBe('resend')
    expect(result.error).toContain('401')
  })

  it('Resend 失败 + SMTP 兜底成功:最终 result.provider=smtp sent=true', async () => {
    // 真实场景:Resend API 报错 → 触发 SMTP 兜底链 → 最终以 smtp 通道发送成功
    // 验证点是 result.provider 切换为 smtp,而不是 resend
    mockConfig.RESEND_API_KEY = 're_test123'
    mockConfig.SMTP_ENABLED = true
    mockConfig.SMTP_HOST = 'smtp.example.com'

    // mock fetch 让 Resend 失败
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'internal error',
    })
    // SMTP 兜底成功(nodemailer 已 mock,确定性 sent=true)
    mockSmtpSendMail.mockClear()
    mockSmtpSendMail.mockResolvedValueOnce({ messageId: '<mock-smtp-1@smtp>' })

    const result = await sendEmail({
      to: 'user@gmail.com',
      subject: 'hello',
      html: '<p>x</p>',
    })

    // 关键断言:provider 从 resend 切换为 smtp(降级成功)
    expect(result.sent).toBe(true)
    expect(result.provider).toBe('smtp')
    expect(mockSmtpSendMail).toHaveBeenCalledOnce()
    expect(mockSmtpSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@gmail.com', subject: 'hello' }),
    )
  })

  it('回归保护:SES 删除后发送结果永不携带 provider=tencent', async () => {
    // Resend 成功
    mockConfig.RESEND_API_KEY = 're_test123'
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'msg-r' }) })
    const r1 = await sendEmail({ to: 'user@gmail.com', subject: 'x', html: '<p>x</p>' })
    expect(r1.provider).not.toBe('tencent')

    // Resend 失败 + SMTP 兜底
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'err' })
    mockConfig.SMTP_ENABLED = true
    mockConfig.SMTP_HOST = 'smtp.example.com'
    mockSmtpSendMail.mockClear()
    mockSmtpSendMail.mockResolvedValueOnce({ messageId: '<mock-r2@smtp>' })
    const r2 = await sendEmail({ to: 'user@qq.com', subject: 'x', html: '<p>x</p>' })
    expect(r2.provider).not.toBe('tencent')

    // 全部失败落 stub
    const r3 = await sendEmail({ to: 'user@qq.com', subject: 'x', html: '<p>x</p>' })
    expect(r3.provider).not.toBe('tencent')
  })

  it('fetch 抛网络异常:被 catch 后返回 sent=false + error 包含异常 message', async () => {
    mockConfig.RESEND_API_KEY = 're_test123'
    fetchMock.mockRejectedValueOnce(new Error('network down'))

    const result = await sendEmail({
      to: 'user@gmail.com',
      subject: 'hello',
      html: '<p>x</p>',
    })
    expect(result.sent).toBe(false)
    expect(result.provider).toBe('resend')
    expect(result.error).toBe('network down')
  })
})

describe('email-service — sendVerificationEmail', () => {
  beforeEach(() => {
    mockConfig.MAIL_PROVIDER = 'auto'
    mockConfig.RESEND_API_KEY = ''
    mockConfig.SMTP_ENABLED = false
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('register 场景 stub 模式成功返回', async () => {
    const result = await (
      await import('../src/services/email-service.js')
    ).sendVerificationEmail('user@example.com', '123456', 'register')
    expect(result.provider).toBe('stub')
    expect(result.stub).toBe(true)
  })

  it('login 场景 stub 模式成功返回', async () => {
    const result = await (
      await import('../src/services/email-service.js')
    ).sendVerificationEmail('user@example.com', '123456', 'login')
    expect(result.provider).toBe('stub')
  })

  it('reset 场景 stub 模式成功返回', async () => {
    const result = await (
      await import('../src/services/email-service.js')
    ).sendVerificationEmail('user@example.com', '123456', 'reset')
    expect(result.provider).toBe('stub')
  })

  it('不传 scene 默认 login', async () => {
    const result = await (
      await import('../src/services/email-service.js')
    ).sendVerificationEmail('user@example.com', '123456')
    expect(result.provider).toBe('stub')
  })
})

describe('email-service — stub 静默故障可见化(warn + reasons)', () => {
  beforeEach(() => {
    // 复刻 2026-09-23 生产实况:host/user/pass 全配好,唯独 SMTP_ENABLED 缺省 false,
    // ⇒ 国内收件人全部落 stub,一封不发。
    mockConfig.MAIL_PROVIDER = 'auto'
    mockConfig.RESEND_API_KEY = ''
    mockConfig.SMTP_ENABLED = false
    mockConfig.SMTP_HOST = 'smtp.qq.com'
    mockLogger.warn.mockClear()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('stub 分支:result.reasons 点名 smtp_disabled(SMTP 兜底缺口)', async () => {
    const result = await sendEmail({
      to: 'someone@qq.com',
      subject: 'test',
      html: '<p>x</p>',
      scene: 'login',
    })
    expect(result.reasons).toEqual(['smtp_disabled'])
  })

  it('回归保护:stub reasons 与 warn 文案不再出现任何 TENCENT_SES/tencent 字样', async () => {
    const result = await sendEmail({
      to: 'someone@qq.com',
      subject: 'test',
      html: '<p>x</p>',
      scene: 'login',
    })
    expect(result.reasons ?? []).not.toContain('tencent_ses_keys_missing')
    expect(mockLogger.warn).toHaveBeenCalledTimes(1)
    const msg = String(mockLogger.warn.mock.calls[0]![0])
    expect(msg).not.toContain('TENCENT')
    expect(msg).not.toContain('tencent')
  })

  it('stub 分支:logger.warn 一行内含缺失配置提示 + scene,运维无需查代码即知缺什么', async () => {
    await sendEmail({ to: 'someone@qq.com', subject: 'test', html: '<p>x</p>', scene: 'login' })
    expect(mockLogger.warn).toHaveBeenCalledTimes(1)
    const msg = String(mockLogger.warn.mock.calls[0]![0])
    expect(msg).toContain('[email-stub]')
    expect(msg).toContain('SMTP_ENABLED=false')
    expect(msg).toContain('scene: login')
  })

  it('stub 分支 warn 不泄露完整邮箱与任何密钥值', async () => {
    await sendEmail({ to: 'someone@qq.com', subject: 'test', html: '<p>x</p>', scene: 'login' })
    const msg = String(mockLogger.warn.mock.calls[0]![0])
    expect(msg).toContain('s***@qq.com')
    expect(msg).not.toContain('someone@qq.com')
    expect(msg).not.toContain(mockConfig.SMTP_PASS)
  })

  it('scene 缺省时 warn 记为 unspecified,不抛错', async () => {
    const result = await sendEmail({ to: 'someone@qq.com', subject: 'test', html: '<p>x</p>' })
    expect(result.stub).toBe(true)
    expect(String(mockLogger.warn.mock.calls[0]![0])).toContain('scene: unspecified')
  })
})

describe('email-service — 现状钉死:SMTP_ENABLED=false 时国内邮箱落 stub', () => {
  beforeEach(() => {
    mockConfig.MAIL_PROVIDER = 'auto'
    mockConfig.RESEND_API_KEY = ''
    mockConfig.SMTP_ENABLED = false
    mockConfig.SMTP_HOST = 'smtp.qq.com'
  })

  it('SMTP_HOST/USER/PASS 全配好,但 SMTP_ENABLED=false ⇒ qq.com/gmail.com 仍是 stub(生产事故现状)', () => {
    expect(resolveProvider('user@qq.com')).toBe('stub')
    expect(resolveProvider('user@gmail.com')).toBe('stub')
  })

  it('对照:仅把 SMTP_ENABLED 翻成 true ⇒ 同配置立即走 smtp(证明根因是开关不是 host)', () => {
    mockConfig.SMTP_ENABLED = true
    expect(resolveProvider('user@qq.com')).toBe('smtp')
    expect(resolveProvider('user@gmail.com')).toBe('smtp')
  })
})

describe('email-service — diagnoseMailTransport(全局通道体检)', () => {
  beforeEach(() => {
    mockConfig.MAIL_PROVIDER = 'auto'
    mockConfig.RESEND_API_KEY = ''
    mockConfig.SMTP_ENABLED = false
    mockConfig.SMTP_HOST = ''
  })

  it('全不可用:国内/海外双 stub,blockers 汇总两类缺失配置(不含 tencent)', () => {
    const d = diagnoseMailTransport()
    expect(d.providerForDomestic).toBe('stub')
    expect(d.providerForOverseas).toBe('stub')
    expect(d.blockers).toEqual(['smtp_disabled', 'resend_api_key_missing'])
  })

  it('回归保护:诊断输出不再含 tencent 相关原因', () => {
    const d = diagnoseMailTransport()
    expect(d.blockers).not.toContain('tencent_ses_keys_missing')
    expect(d.providerForDomestic).not.toBe('tencent')
    expect(d.providerForOverseas).not.toBe('tencent')
  })

  it('仅 Resend:海外走 resend,国内仍 stub;blockers 不再含 resend_api_key_missing', () => {
    mockConfig.RESEND_API_KEY = 're_test123'
    const d = diagnoseMailTransport()
    expect(d.providerForOverseas).toBe('resend')
    expect(d.providerForDomestic).toBe('stub')
    expect(d.blockers).not.toContain('resend_api_key_missing')
    expect(d.blockers).toContain('smtp_disabled')
  })

  it('SMTP 已开:双路 smtp,blockers 为空(启动期全局 warn 的条件不成立)', () => {
    mockConfig.SMTP_ENABLED = true
    mockConfig.SMTP_HOST = 'smtp.example.com'
    expect(diagnoseMailTransport()).toEqual({
      providerForDomestic: 'smtp',
      providerForOverseas: 'smtp',
      blockers: [],
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
