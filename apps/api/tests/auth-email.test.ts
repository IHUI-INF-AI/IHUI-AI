import { describe, it, expect, vi } from 'vitest'

// Mock config:全部零值,确保 sendEmail 走 stub 通道(不实际发邮件)
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    SMTP_HOST: '',
    SMTP_PORT: 587,
    SMTP_USER: '',
    SMTP_PASS: '',
    SMTP_FROM: 'noreply@ihui.ai',
    SMTP_ENABLED: false,
    MAIL_PROVIDER: 'auto',
    RESEND_API_KEY: '',
    RESEND_FROM: '',
    TENCENT_SES_SECRET_ID: '',
    TENCENT_SES_SECRET_KEY: '',
    TENCENT_SES_FROM: '',
    TENCENT_SES_REGION: 'ap-hongkong',
  },
}))

import {
  isDomesticEmail,
  resolveProvider,
  sendEmail,
  sendVerificationEmail,
} from '../src/services/email-service.js'

describe('email-service — isDomesticEmail', () => {
  it('qq.com 是国内邮箱', () => {
    expect(isDomesticEmail('test@qq.com')).toBe(true)
  })
  it('foxmail.com 是国内邮箱', () => {
    expect(isDomesticEmail('test@foxmail.com')).toBe(true)
  })
  it('163.com 是国内邮箱', () => {
    expect(isDomesticEmail('test@163.com')).toBe(true)
  })
  it('126.com 是国内邮箱', () => {
    expect(isDomesticEmail('test@126.com')).toBe(true)
  })
  it('yeah.net 是国内邮箱', () => {
    expect(isDomesticEmail('test@yeah.net')).toBe(true)
  })
  it('sina.com 是国内邮箱', () => {
    expect(isDomesticEmail('test@sina.com')).toBe(true)
  })
  it('sina.cn 是国内邮箱', () => {
    expect(isDomesticEmail('test@sina.cn')).toBe(true)
  })
  it('sohu.com 是国内邮箱', () => {
    expect(isDomesticEmail('test@sohu.com')).toBe(true)
  })
  it('139.com 是国内邮箱', () => {
    expect(isDomesticEmail('test@139.com')).toBe(true)
  })
  it('aliyun.com 是国内邮箱', () => {
    expect(isDomesticEmail('test@aliyun.com')).toBe(true)
  })
  it('189.cn 是国内邮箱', () => {
    expect(isDomesticEmail('test@189.cn')).toBe(true)
  })
  it('wo.cn 是国内邮箱', () => {
    expect(isDomesticEmail('test@wo.cn')).toBe(true)
  })
  it('263.net 是国内邮箱', () => {
    expect(isDomesticEmail('test@263.net')).toBe(true)
  })
  it('vip.qq.com 是国内邮箱', () => {
    expect(isDomesticEmail('test@vip.qq.com')).toBe(true)
  })
  it('vip.163.com 是国内邮箱', () => {
    expect(isDomesticEmail('test@vip.163.com')).toBe(true)
  })

  it('gmail.com 是国外邮箱', () => {
    expect(isDomesticEmail('test@gmail.com')).toBe(false)
  })
  it('outlook.com 是国外邮箱', () => {
    expect(isDomesticEmail('test@outlook.com')).toBe(false)
  })
  it('yahoo.com 是国外邮箱', () => {
    expect(isDomesticEmail('test@yahoo.com')).toBe(false)
  })
  it('hotmail.com 是国外邮箱', () => {
    expect(isDomesticEmail('test@hotmail.com')).toBe(false)
  })
  it('icloud.com 是国外邮箱', () => {
    expect(isDomesticEmail('test@icloud.com')).toBe(false)
  })

  it('大写域名自动转小写后匹配', () => {
    expect(isDomesticEmail('test@QQ.COM')).toBe(true)
    expect(isDomesticEmail('test@Gmail.Com')).toBe(false)
  })

  it('无 @ 的字符串返回 false', () => {
    expect(isDomesticEmail('not-an-email')).toBe(false)
  })
})

describe('email-service — resolveProvider (auto + 全部 provider 未配置 → stub)', () => {
  it('qq.com 邮箱在 auto 模式下走 stub(无 provider 配置)', () => {
    expect(resolveProvider('test@qq.com')).toBe('stub')
  })
  it('gmail.com 邮箱在 auto 模式下走 stub(无 provider 配置)', () => {
    expect(resolveProvider('test@gmail.com')).toBe('stub')
  })
  it('auto 模式下强制未配置的 resend 不会返回 resend', () => {
    expect(resolveProvider('test@gmail.com')).not.toBe('resend')
  })
  it('auto 模式下强制未配置的 tencent 不会返回 tencent', () => {
    expect(resolveProvider('test@qq.com')).not.toBe('tencent')
  })
})

describe('email-service — sendEmail (stub 模式)', () => {
  it('未配置任何 provider 时返回 stub=true', async () => {
    const result = await sendEmail({
      to: 'test@example.com',
      subject: '测试',
      html: '<p>test</p>',
    })
    expect(result.sent).toBe(false)
    expect(result.stub).toBe(true)
    expect(result.provider).toBe('stub')
  })

  it('stub 模式不抛错', async () => {
    await expect(
      sendEmail({
        to: 'test@example.com',
        subject: '测试',
        html: '<p>test</p>',
      }),
    ).resolves.not.toThrow()
  })
})

describe('email-service — sendVerificationEmail (3 scenes + default)', () => {
  it('register 场景 stub 模式成功返回', async () => {
    const result = await sendVerificationEmail('test@example.com', '123456', 'register')
    expect(result.provider).toBe('stub')
    expect(result.stub).toBe(true)
  })

  it('login 场景 stub 模式成功返回', async () => {
    const result = await sendVerificationEmail('test@example.com', '123456', 'login')
    expect(result.provider).toBe('stub')
    expect(result.stub).toBe(true)
  })

  it('reset 场景 stub 模式成功返回', async () => {
    const result = await sendVerificationEmail('test@example.com', '123456', 'reset')
    expect(result.provider).toBe('stub')
    expect(result.stub).toBe(true)
  })

  it('不传 scene 默认 login', async () => {
    const result = await sendVerificationEmail('test@example.com', '123456')
    expect(result.provider).toBe('stub')
    expect(result.stub).toBe(true)
  })

  it('带 nickname 的 stub 模式也成功', async () => {
    const result = await sendVerificationEmail(
      'test@example.com',
      '654321',
      'register',
      'Alice',
    )
    expect(result.provider).toBe('stub')
    expect(result.stub).toBe(true)
  })
})
