// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-314 回归锁(2026-11-13):邮件发送必须有显式超时,上游黑洞时不得拖住登录请求。
 *
 * 病灶:Resend fetch 无 AbortSignal(undici 默认 ~300s);nodemailer createTransport
 * 未设 connectionTimeout/greetingTimeout/socketTimeout(默认 600s),且从不 close 句柄。
 *
 * 判据:
 * 1. Resend 分支的 fetch 携带 signal(AbortSignal)
 * 2. Resend 抛超时错误 ⇒ 按既有 fallback 结构落到 SMTP 并最终 sent=true
 * 3. createTransport 参数含三个显式超时字段
 * 4. 发送结束(成功/失败)都调用 transporter.close()
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { mockConfig, mockSendMail, mockClose, mockCreateTransport, mockLogger } = vi.hoisted(() => ({
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
  },
  mockSendMail: vi.fn(),
  mockClose: vi.fn(),
  mockCreateTransport: vi.fn(),
  mockLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../src/config/index.js', () => ({ config: mockConfig }))
vi.mock('../src/utils/logger.js', () => ({ logger: mockLogger }))
// email-service 里是 `await import('nodemailer')`,静态 mock 同样生效
vi.mock('nodemailer', () => ({ createTransport: mockCreateTransport }))
vi.mock('@ihui/database', () => ({
  emailLogs: {
    values: vi.fn().mockReturnValue({ execute: vi.fn().mockResolvedValue(undefined) }),
  },
}))
vi.mock('../src/db/index.js', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ execute: vi.fn().mockResolvedValue(undefined) }),
    }),
  },
}))

import { sendEmail } from '../src/services/email-service.js'

const mail = { to: 'user@gmail.com', subject: 'hello', html: '<p>x</p>' }

describe('F-314 邮件发送显式超时', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockConfig.MAIL_PROVIDER = 'auto'
    mockConfig.RESEND_API_KEY = ''
    mockConfig.SMTP_ENABLED = false
    mockConfig.SMTP_HOST = 'smtp.example.com'

    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    mockSendMail.mockReset()
    mockClose.mockReset()
    mockCreateTransport.mockReset()
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail, close: mockClose })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('① Resend 分支的 fetch 携带 AbortSignal', async () => {
    mockConfig.RESEND_API_KEY = 're_test123'
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '' })

    const result = await sendEmail(mail)
    expect(result.sent).toBe(true)
    expect(result.provider).toBe('resend')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('② Resend 超时错误 → 落到 SMTP 兜底,sent=true/provider=smtp', async () => {
    mockConfig.RESEND_API_KEY = 're_test123'
    mockConfig.SMTP_ENABLED = true
    const timeoutErr = new Error('The operation was aborted due to timeout')
    timeoutErr.name = 'TimeoutError'
    fetchMock.mockRejectedValueOnce(timeoutErr)
    mockSendMail.mockResolvedValueOnce({ messageId: '<fallback@smtp>' })

    const result = await sendEmail(mail)

    expect(result.sent).toBe(true)
    expect(result.provider).toBe('smtp')
    expect(mockSendMail).toHaveBeenCalledOnce()
  })

  it('③ createTransport 显式带三个超时字段', async () => {
    mockConfig.SMTP_ENABLED = true
    mockSendMail.mockResolvedValueOnce({ messageId: '<ok@smtp>' })

    const result = await sendEmail({ ...mail, to: 'user@qq.com' })
    expect(result.sent).toBe(true)

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      }),
    )
  })

  it('④ 发送成功后 transporter.close() 被调用', async () => {
    mockConfig.SMTP_ENABLED = true
    mockSendMail.mockResolvedValueOnce({ messageId: '<ok@smtp>' })

    await sendEmail({ ...mail, to: 'user@qq.com' })
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  it('④ 发送失败后 transporter.close() 同样被调用', async () => {
    mockConfig.SMTP_ENABLED = true
    mockSendMail.mockRejectedValueOnce(new Error('550 From mismatch'))

    const result = await sendEmail({ ...mail, to: 'user@qq.com' })
    expect(result.sent).toBe(false)
    expect(result.error).toContain('550')
    expect(mockClose).toHaveBeenCalledTimes(1)
  })
})
