// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  renderVerificationEmail,
  renderWelcomeEmail,
  renderSecurityLoginEmail,
  renderMaintenanceNoticeEmail,
  renderChangelogEmail,
  renderLaunchEmail,
  FOUNDER_QR_PATH,
  FOUNDER_WECHAT_ID,
  escapeHtml,
} from '../src/services/email-templates.js'

const mockConfig = vi.hoisted(() => ({
  CORS_ORIGIN: 'http://localhost:8801,http://tauri.localhost',
}))

vi.mock('../src/config/index.js', () => ({ config: mockConfig }))

describe('email-templates — 验证码', () => {
  it('验证码为真实文本且出现在主题/正文/纯文本三处', () => {
    const r = renderVerificationEmail('582914', 'login')
    expect(r.subject).toContain('582914')
    expect(r.html).toContain('582914')
    expect(r.text).toContain('582914')
  })

  it('场景文案映射正确', () => {
    expect(renderVerificationEmail('123456', 'register').subject).toContain('注册')
    expect(renderVerificationEmail('123456', 'reset').subject).toContain('重置密码')
    expect(renderVerificationEmail('123456', 'login').html).toContain('登录账号')
  })

  it('有效期分钟数可配置且注入文案', () => {
    const r = renderVerificationEmail('123456', 'login', undefined, 10)
    expect(r.html).toContain('10 分钟内有效')
    expect(r.text).toContain('10 分钟内有效')
  })

  it('昵称被转义(XSS 防护)', () => {
    const r = renderVerificationEmail('123456', 'login', '<script>alert(1)</script>')
    expect(r.html).not.toContain('<script>')
    expect(r.html).toContain('&lt;script&gt;')
  })
})

describe('email-templates — 欢迎邮件', () => {
  beforeEach(() => {
    mockConfig.CORS_ORIGIN = 'http://localhost:8801,http://tauri.localhost'
  })

  it('按钮为真实 <a> 链接且指向控制台', () => {
    const r = renderWelcomeEmail({
      nickname: '李总',
      maskedId: 'li****uan@aizhs.top',
      initCredits: 100,
    })
    expect(r.html).toContain('href="http://localhost:8801/dashboard"')
    expect(r.html).not.toContain('/console')
    expect(r.html).toContain('进入控制台')
    expect(r.html).toContain('+100')
  })

  it('脱敏 ID 与积分被转义注入', () => {
    const r = renderWelcomeEmail({ nickname: 'A&B', maskedId: 'a****b@x.com', initCredits: 50 })
    expect(r.html).toContain('A&amp;B')
    expect(r.html).toContain('a****b@x.com')
  })
})

describe('email-templates — 创始人直联二维码(所有邮件共享页脚)', () => {
  it('页脚含微信二维码图与真实站内路径', () => {
    const r = renderVerificationEmail('123456', 'login')
    expect(r.html).toContain(`src="http://localhost:8801${FOUNDER_QR_PATH}"`)
    expect(r.html).toContain(FOUNDER_WECHAT_ID)
    expect(r.html).toContain('直接联系创始人李春川')
    expect(r.html).toContain('support@aizhs.top')
  })

  it('二维码图与 SiteFooter QRS 同源(防路径漂移)', () => {
    // web 端 footer-data.ts QRS 声明的个人号二维码路径
    expect(FOUNDER_QR_PATH).toBe('/footer/erweima/wechat-vx.png')
    expect(FOUNDER_WECHAT_ID).toBe('ok502319984')
  })
})

describe('email-templates — 登录安全告警', () => {
  it('信号红配置 + 锁定按钮指向 security 页', () => {
    const r = renderSecurityLoginEmail({
      device: 'Windows · Chrome 140',
      ip: '123.***.**.45',
      location: '中国·长春',
      time: '2026-09-19 01:32',
      riskLevel: 'LOW',
    })
    expect(r.html).toContain('#FF3B2F')
    expect(r.html).toContain('href="http://localhost:8801/settings/login-security"')
    expect(r.html).not.toContain('/console')
    expect(r.html).toContain('123.***.**.45')
    expect(r.text).toContain('/settings/login-security')
  })
})

describe('email-templates — 维护通知', () => {
  it('窗口/范围/停机注入 + 状态页按钮', () => {
    const r = renderMaintenanceNoticeEmail({
      window: '09.21 02:00 - 04:00',
      scope: 'API · 控制台',
      downtime: '≤ 5 分钟',
    })
    expect(r.html).toContain('09.21 02:00 - 04:00')
    expect(r.html).toContain('href="http://localhost:8801/status"')
  })
})

describe('email-templates — 更新日志', () => {
  it('条目标签渲染且 SEC 用信号红', () => {
    const r = renderChangelogEmail({
      version: '2.4.0',
      date: '2026-09-19',
      items: [
        { tag: 'NEW', title: '工作流引擎', desc: '多步编排' },
        { tag: 'SEC', title: '密钥轮换', desc: '一键轮换' },
      ],
    })
    expect(r.html).toContain('[NEW]')
    expect(r.html).toContain('[SEC]')
    expect(r.html).toContain('工作流引擎')
    expect(r.html).toContain('v2.4.0')
  })
})

describe('email-templates — 新品上线', () => {
  it('产品名/版本/特性条注入 + CTA 指向站内真实路径', () => {
    const r = renderLaunchEmail({
      productName: '工作流引擎',
      version: '1.0.0',
      features: [
        { title: '多步编排', desc: '拖拽连线' },
        { title: '模板市场', desc: '一键复用' },
      ],
      ctaPath: '/workflows',
    })
    expect(r.subject).toContain('工作流引擎')
    expect(r.subject).toContain('v1.0.0')
    expect(r.html).toContain('01')
    expect(r.html).toContain('多步编排')
    expect(r.html).toContain('href="http://localhost:8801/workflows"')
    expect(r.html).not.toContain('/console')
    expect(r.text).toContain('多步编排 / 模板市场')
  })

  it('ctaPath 缺失前导斜杠时自动补全', () => {
    const r = renderLaunchEmail({
      productName: 'x',
      version: '1.0.0',
      features: [{ title: 't', desc: 'd' }],
      ctaPath: 'workflows',
    })
    expect(r.html).toContain('href="http://localhost:8801/workflows"')
  })

  it('特性标题被转义(XSS 防护)', () => {
    const r = renderLaunchEmail({
      productName: 'x',
      version: '1.0.0',
      features: [{ title: '<script>alert(1)</script>', desc: 'd' }],
      ctaPath: '/workflows',
    })
    expect(r.html).not.toContain('<script>')
    expect(r.html).toContain('&lt;script&gt;')
  })
})

describe('email-templates — resolveWebOrigin 与转义', () => {
  it('CORS_ORIGIN 为空串时回退到 aizhs.top', () => {
    mockConfig.CORS_ORIGIN = ''
    const r = renderWelcomeEmail({ nickname: 'x', maskedId: 'x', initCredits: 1 })
    expect(r.html).toContain('https://aizhs.top/dashboard')
    expect(r.html).not.toContain('/console')
  })

  it('escapeHtml 覆盖五个危险字符', () => {
    expect(escapeHtml('<a href="x">&\'q\'</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&#39;q&#39;&lt;/a&gt;',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
