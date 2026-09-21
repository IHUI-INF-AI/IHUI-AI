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
  renderSystemAlertEmail,
  renderLowBalanceEmail,
  renderNoticeEmail,
  renderPaymentReceiptEmail,
  renderRefundResultEmail,
  renderWithdrawalResultEmail,
  renderRedeemSuccessEmail,
  renderVipExpireEmail,
  renderInvoiceResultEmail,
  renderWalletRechargeEmail,
  BRAND_LOGO_PATH,
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

describe('email-templates — 品牌资产(Logo + 二维码,所有邮件共享)', () => {
  it('刊头含品牌图片 Logo(右上角,真实静态资产路径)', () => {
    const r = renderVerificationEmail('123456', 'login')
    expect(r.html).toContain(`src="http://localhost:8801${BRAND_LOGO_PATH}"`)
    expect(r.html).toContain('alt="IHUI AI"')
    expect(r.html).toContain('width="56" height="56"')
  })

  it('品牌资产路径与 web public 同源(防路径漂移)', () => {
    // web 端 footer-data.ts QRS 声明的个人号二维码路径 + public/images 品牌图
    expect(FOUNDER_QR_PATH).toBe('/footer/erweima/wechat-vx.png')
    expect(FOUNDER_WECHAT_ID).toBe('ok502319984')
    expect(BRAND_LOGO_PATH).toBe('/images/logo.png')
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

describe('email-templates — 运维系统告警', () => {
  it('critical 走信号红,主题保留 [CRITICAL] 前缀(兼容监控过滤规则)', () => {
    const r = renderSystemAlertEmail({
      severity: 'critical',
      source: 'guardian-runner',
      time: '2026-09-21 10:00:00',
      title: 'API 服务 5xx 飙升',
      message: 'error rate 12.4%\nthreshold 5%',
    })
    expect(r.subject).toBe('[CRITICAL] API 服务 5xx 飙升')
    expect(r.html).toContain('#FF3B2F')
    expect(r.html).toContain('[ CRITICAL ]')
    expect(r.html).toContain('guardian-runner')
    expect(r.html).toContain('2026-09-21 10:00:00')
    expect(r.html).toContain('error rate 12.4%')
  })

  it('info 走品牌绿,theme 标签映射正确', () => {
    const r = renderSystemAlertEmail({
      severity: 'info',
      source: 'scheduler',
      time: '2026-09-21 11:00:00',
      title: '例行巡检完成',
      message: 'all green',
    })
    expect(r.subject).toBe('[INFO] 例行巡检完成')
    expect(r.html).toContain('#B4FF00')
    expect(r.html).toContain('ALERT_INFO')
    expect(r.html).not.toContain('#FF3B2F')
  })

  it('message 为真实文本(逐行 div,非 <pre>)且被转义(XSS 防护)', () => {
    const r = renderSystemAlertEmail({
      severity: 'warning',
      source: 's',
      time: 't',
      title: 'x',
      message: '<script>alert(1)</script>',
    })
    expect(r.html).not.toContain('<pre>')
    expect(r.html).not.toContain('<script>')
    expect(r.html).toContain('&lt;script&gt;')
  })
})

describe('email-templates — 余额不足提醒', () => {
  it('充值按钮为真实链接且金额换算正确', () => {
    const r = renderLowBalanceEmail({
      userName: '李总',
      keyName: 'prod-key',
      tokenBalance: 42,
      costBalanceCents: 5000,
      thresholdCents: 1000,
      purchaseUrl: 'https://aizhs.top/purchase',
    })
    expect(r.subject).toContain('余额不足')
    expect(r.html).toContain('href="https://aizhs.top/purchase"')
    expect(r.html).toContain('¥50.00')
    expect(r.html).toContain('¥10.00')
    expect(r.html).toContain('prod-key')
    expect(r.text).toContain('https://aizhs.top/purchase')
  })

  it('keyName 被转义(XSS 防护)', () => {
    const r = renderLowBalanceEmail({
      keyName: '<img src=x onerror=alert(1)>',
      tokenBalance: 1,
      costBalanceCents: 0,
      thresholdCents: 1000,
      purchaseUrl: 'https://aizhs.top/purchase',
    })
    expect(r.html).not.toContain('<img src=x')
    expect(r.html).toContain('&lt;img src=x')
  })
})

describe('email-templates — 通用系统通知', () => {
  it('品牌版式渲染,标题进主题,内容真实文本', () => {
    const r = renderNoticeEmail({
      tag: 'SYSTEM // NOTICE',
      title: '订单状态更新',
      userName: '李总',
      content: '您的订单 A-1001 状态已更新为已支付。',
    })
    expect(r.subject).toBe('订单状态更新')
    expect(r.html).toContain('李总')
    expect(r.html).toContain('您的订单 A-1001 状态已更新为已支付。')
    expect(r.html).toContain('#B4FF00')
    expect(r.html).not.toContain('<pre>')
    expect(r.text).toContain('A-1001')
  })

  it('内容被转义(XSS 防护)且无用户名时省略称呼', () => {
    const r = renderNoticeEmail({
      tag: 'SYSTEM // NOTICE',
      title: '系统通知',
      content: '<script>alert(1)</script>',
    })
    expect(r.html).not.toContain('<script>')
    expect(r.html).toContain('&lt;script&gt;')
    expect(r.html).not.toContain('undefined')
  })
})

describe('email-templates — 支付成功收据', () => {
  it('订单号/商品/金额/状态/按钮齐备,品牌绿 PAID 标记', () => {
    const r = renderPaymentReceiptEmail({
      userName: '李总',
      orderNo: 'IH20260921001',
      productTitle: 'VIP 年卡',
      quantity: 1,
      amountYuan: '365.00',
      payType: 'wechat',
      paidAt: '2026-09-21 12:00:00',
      subscriptionUrl: 'https://aizhs.top/user/subscription',
    })
    expect(r.subject).toContain('IH20260921001')
    expect(r.html).toContain('IH20260921001')
    expect(r.html).toContain('VIP 年卡')
    expect(r.html).toContain('¥365.00')
    expect(r.html).toContain('[ 已支付 / PAID ]')
    expect(r.html).toContain('href="https://aizhs.top/user/subscription"')
    expect(r.html).toContain('#B4FF00')
    expect(r.text).toContain('¥365.00')
  })

  it('数量 >1 显示 ×N;恶意商品名被转义', () => {
    const r = renderPaymentReceiptEmail({
      orderNo: 'X',
      productTitle: '<script>alert(1)</script>',
      quantity: 3,
      amountYuan: '1.00',
      payType: '',
      paidAt: 't',
      subscriptionUrl: 'https://aizhs.top/user/subscription',
    })
    expect(r.html).toContain('×3')
    expect(r.html).not.toContain('<script>')
    expect(r.html).toContain('&lt;script&gt;')
    expect(r.html).toContain('—')
  })
})

describe('email-templates — 退款结果通知', () => {
  it('completed 品牌绿 + 退款成功标记 + 订单按钮', () => {
    const r = renderRefundResultEmail({
      userName: '李总',
      orderNo: 'IH20260921001',
      refundAmountYuan: '365.00',
      status: 'completed',
      finishedAt: '2026-09-21 14:00:00',
      ordersUrl: 'https://aizhs.top/orders',
    })
    expect(r.subject).toContain('退款成功')
    expect(r.subject).toContain('IH20260921001')
    expect(r.html).toContain('¥365.00')
    expect(r.html).toContain('[ 退款成功 ]')
    expect(r.html).toContain('href="https://aizhs.top/orders"')
    expect(r.html).toContain('#B4FF00')
    expect(r.html).not.toContain('#FF3B2F')
    expect(r.text).toContain('¥365.00')
  })

  it('rejected/failed 信号红 + 原因注入 + ghost 按钮', () => {
    const r = renderRefundResultEmail({
      orderNo: 'X1',
      refundAmountYuan: '9.90',
      status: 'rejected',
      reason: '超过退款期限',
      finishedAt: 't',
      ordersUrl: 'https://aizhs.top/orders',
    })
    expect(r.subject).toContain('退款未通过')
    expect(r.html).toContain('#FF3B2F')
    expect(r.html).toContain('[ 退款未通过 ]')
    expect(r.html).toContain('超过退款期限')
  })

  it('恶意原因被转义(XSS 防护)', () => {
    const r = renderRefundResultEmail({
      orderNo: 'X',
      refundAmountYuan: '0.01',
      status: 'failed',
      reason: '<script>alert(1)</script>',
      finishedAt: 't',
      ordersUrl: 'https://aizhs.top/orders',
    })
    expect(r.html).not.toContain('<script>')
    expect(r.html).toContain('&lt;script&gt;')
  })
})

describe('email-templates — 提现结果通知', () => {
  it('approved 品牌绿:到账/手续费/方式/状态齐备,按钮指向提现记录页', () => {
    const r = renderWithdrawalResultEmail({
      userName: '李总',
      amountYuan: '980.00',
      feeYuan: '20.00',
      method: 'wechat',
      status: 'approved',
      processedAt: '2026-09-21 15:00:00',
      withdrawUrl: 'https://aizhs.top/wallet/withdraw/records',
    })
    expect(r.subject).toContain('提现审核通过')
    expect(r.html).toContain('¥980.00')
    expect(r.html).toContain('¥20.00')
    expect(r.html).toContain('[ 打款处理中 / PROCESSING ]')
    expect(r.html).toContain('href="https://aizhs.top/wallet/withdraw/records"')
    expect(r.html).toContain('#B4FF00')
    expect(r.text).toContain('¥980.00')
  })

  it('rejected 信号红 + 驳回原因 + 余额退回文案', () => {
    const r = renderWithdrawalResultEmail({
      amountYuan: '50.00',
      feeYuan: '1.00',
      method: 'alipay',
      status: 'rejected',
      rejectReason: '收款账户信息异常',
      processedAt: 't',
      withdrawUrl: 'https://aizhs.top/wallet/withdraw/records',
    })
    expect(r.subject).toContain('被驳回')
    expect(r.html).toContain('#FF3B2F')
    expect(r.html).toContain('[ 已驳回 / REJECTED ]')
    expect(r.html).toContain('收款账户信息异常')
    expect(r.html).toContain('原路退回您的可用余额')
  })

  it('恶意驳回原因被转义(XSS 防护)', () => {
    const r = renderWithdrawalResultEmail({
      amountYuan: '1.00',
      feeYuan: '0.00',
      method: 'wechat',
      status: 'rejected',
      rejectReason: '<img src=x onerror=alert(1)>',
      processedAt: 't',
      withdrawUrl: 'https://aizhs.top/wallet/withdraw/records',
    })
    expect(r.html).not.toContain('<img src=x')
    expect(r.html).toContain('&lt;img src=x')
  })
})

describe('email-templates — 兑换码成功通知', () => {
  it('码/到账/余额齐备 + 按钮指向 API Key 页', () => {
    const r = renderRedeemSuccessEmail({
      userName: '李总',
      code: 'IHUI-ABCD-EFGH-JKLM',
      tokenAmount: 1000,
      newTokenBalance: 1500,
      keysUrl: 'https://aizhs.top/models/keys',
    })
    expect(r.subject).toContain('+1000')
    expect(r.html).toContain('IHUI-ABCD-EFGH-JKLM')
    expect(r.html).toContain('+1000')
    expect(r.html).toContain('1500')
    expect(r.html).toContain('[ 兑换成功 / OK ]')
    expect(r.html).toContain('href="https://aizhs.top/models/keys"')
    expect(r.text).toContain('+1000')
  })

  it('无限额度(-1)渲染为 ∞;恶意码被转义', () => {
    const r = renderRedeemSuccessEmail({
      code: '<script>alert(1)</script>',
      tokenAmount: 1,
      newTokenBalance: -1,
      keysUrl: 'https://aizhs.top/models/keys',
    })
    expect(r.html).toContain('∞ 无限')
    expect(r.html).not.toContain('<script>')
    expect(r.html).toContain('&lt;script&gt;')
  })
})

describe('email-templates — VIP 过期通知', () => {
  it('信号红警示 + 到期时间 + 续费按钮指向 /vip', () => {
    const r = renderVipExpireEmail({
      userName: '李总',
      expiredAt: '2026-09-20 23:59:59',
      renewUrl: 'https://aizhs.top/vip',
    })
    expect(r.subject).toContain('VIP 会员已到期')
    expect(r.html).toContain('#FF3B2F')
    expect(r.html).toContain('[ 已失效 / EXPIRED ]')
    expect(r.html).toContain('2026-09-20 23:59:59')
    expect(r.html).toContain('href="https://aizhs.top/vip"')
    expect(r.html).toContain('立即续费')
    expect(r.text).toContain('https://aizhs.top/vip')
  })

  it('传入套餐名时展示且被转义(XSS 防护)', () => {
    const r = renderVipExpireEmail({
      vipName: '<script>alert(1)</script> 尊享版',
      expiredAt: 't',
      renewUrl: 'https://aizhs.top/vip',
    })
    expect(r.html).not.toContain('<script>')
    expect(r.html).toContain('&lt;script&gt;')
    expect(r.html).toContain('尊享版')
  })
})

describe('email-templates — 发票结果通知', () => {
  it('issued 品牌绿:类型/抬头/金额/发票号齐备,有 invoiceUrl 时按钮为下载发票', () => {
    const r = renderInvoiceResultEmail({
      invoiceType: 'vat_special',
      title: '智汇科技有限公司',
      amountYuan: '365.00',
      orderNo: 'IH20260921001',
      status: 'issued',
      invoiceNo: 'FP-2026-0001',
      invoiceUrl: 'https://aizhs.top/invoice.pdf',
      finishedAt: '2026-09-21 16:00:00',
      ordersUrl: 'https://aizhs.top/orders',
    })
    expect(r.subject).toContain('发票已开具')
    expect(r.subject).toContain('增值税专用发票')
    expect(r.html).toContain('智汇科技有限公司')
    expect(r.html).toContain('¥365.00')
    expect(r.html).toContain('FP-2026-0001')
    expect(r.html).toContain('[ 开具完成 ]')
    expect(r.html).toContain('href="https://aizhs.top/invoice.pdf"')
    expect(r.html).toContain('下载发票')
    expect(r.html).toContain('#B4FF00')
  })

  it('issued 无 invoiceUrl 时按钮回退到订单页', () => {
    const r = renderInvoiceResultEmail({
      invoiceType: 'plain',
      title: '个人',
      amountYuan: '9.90',
      orderNo: 'X1',
      status: 'issued',
      invoiceNo: 'FP-1',
      finishedAt: 't',
      ordersUrl: 'https://aizhs.top/orders',
    })
    expect(r.html).toContain('href="https://aizhs.top/orders"')
    expect(r.html).not.toContain('下载发票')
  })

  it('rejected 信号红 + 原因;恶意抬头被转义(XSS 防护)', () => {
    const r = renderInvoiceResultEmail({
      invoiceType: 'plain',
      title: '<script>alert(1)</script>',
      amountYuan: '1.00',
      orderNo: 'X',
      status: 'rejected',
      reason: '税号信息有误',
      finishedAt: 't',
      ordersUrl: 'https://aizhs.top/orders',
    })
    expect(r.subject).toContain('未通过')
    expect(r.html).toContain('#FF3B2F')
    expect(r.html).toContain('[ 未通过 ]')
    expect(r.html).toContain('税号信息有误')
    expect(r.html).not.toContain('<script>')
    expect(r.html).toContain('&lt;script&gt;')
  })
})

describe('email-templates — 钱包充值到账通知', () => {
  it('Key 名/扣款/额度/余额齐备 + 按钮指向 API Key 页', () => {
    const r = renderWalletRechargeEmail({
      userName: '李总',
      keyName: '生产环境 Key',
      costYuan: '12.34',
      creditTokens: 1000,
      newTokenBalance: 2000,
      keysUrl: 'https://aizhs.top/models/keys',
    })
    expect(r.subject).toContain('+1000')
    expect(r.html).toContain('生产环境 Key')
    expect(r.html).toContain('¥12.34')
    expect(r.html).toContain('+1000')
    expect(r.html).toContain('2000')
    expect(r.html).toContain('href="https://aizhs.top/models/keys"')
    expect(r.text).toContain('¥12.34')
  })

  it('无限额度(-1)渲染为 ∞;恶意 Key 名被转义(XSS 防护)', () => {
    const r = renderWalletRechargeEmail({
      keyName: '<img src=x onerror=alert(1)>',
      costYuan: '1.00',
      creditTokens: 1,
      newTokenBalance: -1,
      keysUrl: 'https://aizhs.top/models/keys',
    })
    expect(r.html).toContain('∞ 无限')
    expect(r.html).not.toContain('<img src=x')
    expect(r.html).toContain('&lt;img src=x')
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
