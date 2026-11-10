// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 告警推送服务 — 邮件通道回归测试(2026-11-10 立)。
 *
 * 本文件此前**没有测试**,而邮件通道正是本轮修复的落点,故逐条钉住行为:
 * ① From 是品牌身份,不是 SMTP 登录账号(旧显示名不得生效,地址段回落账号)
 * ② 地址与账号一致时保留配置里的大小写/写法
 * ③ 混合收件人按语言分两封,主题/正文/时间各自成套
 * ④ transporter 带 family: 4(IPv6 ENETUNREACH 静默失败的防护)
 * ⑤ 一组投递失败不影响另一组,任一组送达即 true
 * ⑥ SMTP 未配置 → email === false 且不建 transport
 *
 * 测试模式:vi.mock 掉 nodemailer(对齐同目录 mail-relay-notifier.test.ts)。
 * 测试文件豁免 any(mock 类型断言必需,AGENTS.md §3)。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// =============================================================================
// Mock 声明(hoisted)
// =============================================================================

const { mockSendMail, mockCreateTransport, mockClose } = vi.hoisted(() => ({
  mockSendMail: vi.fn(),
  mockCreateTransport: vi.fn(),
  mockClose: vi.fn(),
}))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}))

import { pushAlertWithResult, type AlertNotification } from '../src/services/alert-notification-service.js'

/** sendMail 实际收到的参数(只取本文件断言用到的字段) */
interface SendMailArg {
  from: string
  to: string
  subject: string
  html: string
  text: string
}

/** 其它渠道的环境变量全集:一律不配置,避免真发 fetch 到外部端点 */
const OTHER_CHANNEL_ENVS = [
  'DINGTALK_WEBHOOK',
  'DINGTALK_SECRET',
  'WECHAT_WORK_WEBHOOK',
  'FEISHU_WEBHOOK',
  'PAGERDUTY_ROUTING_KEY',
  'PAGERDUTY_API_URL',
  'SLACK_WEBHOOK',
  'TEAMS_WEBHOOK',
  'GENERIC_WEBHOOK_URL',
  'GENERIC_WEBHOOK_AUTH_HEADER',
] as const

/** 取第 n 次 sendMail 的参数 */
function sentMail(index: number): SendMailArg {
  const arg = mockSendMail.mock.calls[index]?.[0] as SendMailArg | undefined
  expect(arg, `第 ${index + 1} 次 sendMail 应当存在`).toBeTruthy()
  return arg!
}

describe('alert-notification-service · 邮件通道', () => {
  const ORIG_ENV = { ...process.env }

  const alert = (overrides: Partial<AlertNotification> = {}): AlertNotification => ({
    title: '磁盘使用率超过阈值',
    message: '节点 node-3 磁盘使用率 92%,请在 15 分钟内处置',
    severity: 'critical',
    source: 'ops-watch',
    ...overrides,
  })

  beforeEach(() => {
    mockSendMail.mockReset()
    mockCreateTransport.mockReset()
    mockClose.mockReset()
    // createTransport 返回带 sendMail / close 的 transporter
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail, close: mockClose })

    // 默认一套可用的 SMTP 配置(单条国内收件人)
    process.env.SMTP_HOST = 'smtp.test'
    process.env.SMTP_PORT = '465'
    process.env.SMTP_USER = '502319984@qq.com'
    process.env.SMTP_PASS = 'test-pass'
    process.env.SMTP_FROM = '智汇AI官方 <noreply@aizhs.top>'
    process.env.ALERT_EMAIL_TO = '502319984@qq.com'

    // 清掉宿主机上可能存在的其它渠道配置:一旦残留就会真发 fetch,
    // 既污染断言也会把测试流量打到线上 webhook。
    for (const key of OTHER_CHANNEL_ENVS) delete process.env[key]
  })

  afterEach(() => {
    process.env = { ...ORIG_ENV }
  })

  // ① 防的是:有人把 `from` 改回 `cfg.user`(收件箱显示 502319984),
  //    或直接沿用 SMTP_FROM 的显示名(收件箱显示「智汇AI官方」)。
  it('① From 恒为「"智汇AI" <地址>」,地址回落 SMTP 登录账号,配置里的显示名不生效', async () => {
    process.env.SMTP_USER = '502319984@qq.com'
    process.env.SMTP_FROM = '智汇AI官方 <noreply@aizhs.top>'
    process.env.ALERT_EMAIL_TO = '502319984@qq.com'

    const res = await pushAlertWithResult(alert())

    expect(res.email, 'SMTP 配置齐全且有收件人时,邮件渠道应成功').toBe(true)
    expect(mockSendMail).toHaveBeenCalledTimes(1)
    const arg = sentMail(0)

    // 全等断言:显示名是品牌名,地址段是登录账号(QQ 中继 550 约束)
    expect(arg.from).toBe('"智汇AI" <502319984@qq.com>')
    // 旧显示名「智汇AI官方」与裸账号这两种历史形态都不许再出现
    expect(arg.from).not.toContain('智汇AI官方')
    expect(arg.from).not.toBe('502319984@qq.com')
    // 配置里的 noreply@aizhs.top 与账号不一致 ⇒ 必须回落,不得被采用
    expect(arg.from).not.toContain('noreply@aizhs.top')
  })

  // ② 防的是:有人为了「地址必须等于账号」而干脆把地址段硬编码成账号,
  //    那样换账号/换域名时配置里的地址就再也进不来。
  it('② 地址与账号一致时保留配置里的地址,显示名仍被强制为品牌名', async () => {
    process.env.SMTP_USER = 'a@b.com'
    process.env.SMTP_FROM = '某某 <a@b.com>'
    process.env.ALERT_EMAIL_TO = 'a@b.com'

    const res = await pushAlertWithResult(alert())

    expect(res.email).toBe(true)
    expect(mockSendMail).toHaveBeenCalledTimes(1)
    const arg = sentMail(0)

    expect(arg.from).toBe('"智汇AI" <a@b.com>')
    expect(arg.from).not.toContain('某某')
  })

  // ③ 防的是:混合收件人只渲染一次 —— 总有一边收到看不懂的语言。
  //    同时钉住「前缀/字段名/时间格式」三件事必须成套,不能主题中文、正文英文。
  it('③ 混合收件人按语言分两封:国内走中文、海外走英文,互不串味', async () => {
    process.env.SMTP_USER = '502319984@qq.com'
    process.env.SMTP_FROM = '智汇AI官方 <noreply@aizhs.top>'
    process.env.ALERT_EMAIL_TO = '502319984@qq.com,ops@example.com'

    const res = await pushAlertWithResult(alert({ severity: 'critical' }))

    expect(res.email).toBe(true)
    expect(mockSendMail, '两组收件人各一封,不能合并成一封也不能漏发').toHaveBeenCalledTimes(2)

    const calls = mockSendMail.mock.calls.map(
      (c) => c[0] as SendMailArg,
    )
    const zh = calls.find((c) => c.to === '502319984@qq.com')
    const en = calls.find((c) => c.to === 'ops@example.com')
    expect(zh, '国内收件人必须单独收到一封').toBeTruthy()
    expect(en, '海外收件人必须单独收到一封').toBeTruthy()

    // 中文那封:中文级别前缀 + 中文字段名
    expect(zh!.subject).toContain('[严重]')
    expect(zh!.subject.startsWith('['), '主题必须是「[级别] 标题」形态').toBe(true)
    expect(zh!.html).toContain('严重级别')
    expect(zh!.html, '中文正文里不该出现英文栏目标签').not.toContain('SEVERITY')

    // 英文那封:英文级别前缀 + 英文字段名
    expect(en!.subject).toMatch(/^\[(CRITICAL|WARNING|INFO)\]/)
    expect(en!.html).toContain('SEVERITY')
    expect(en!.html, '英文正文里不该出现中文字段名').not.toContain('严重级别')

    // 同一品牌身份,两封的 From 必须一字不差
    expect(zh!.from).toBe(en!.from)
    expect(zh!.from).toBe('"智汇AI" <502319984@qq.com>')
  })

  // ④ 防的是 2026-10-01 那次:本机解析到 AAAA 记录而 IPv6 出网不通,
  //    nodemailer 以 ENETUNREACH 静默失败(且重试只重踩同一个不可达地址)。
  it('④ createTransport 的参数里带 family: 4,强制 IPv4 出网', async () => {
    await pushAlertWithResult(alert())

    expect(mockCreateTransport).toHaveBeenCalledTimes(1)
    const opts = mockCreateTransport.mock.calls[0]?.[0] as Record<string, unknown>
    expect(opts.family, 'family 必须透传给 net.connect,否则 IPv6 优先会静默失败').toBe(4)
    // 顺带钉住连接参数没被 family 的 spread 挤掉
    expect(opts.host).toBe('smtp.test')
    expect(opts.port).toBe(465)
    expect(opts.secure).toBe(true)
  })

  // ⑤ 防的是:一组渲染/投递失败被当成整体失败(或提前 return),把另一组也一起吞掉。
  //    注意 pushEmail 对每组有 1 次重试(PUSH_RETRY=1),所以"整组失败"= 2 次调用。
  it('⑤ 一组投递失败不影响另一组:中文组全失败、英文组送达 ⇒ 仍返回 true', async () => {
    process.env.SMTP_USER = '502319984@qq.com'
    process.env.SMTP_FROM = '智汇AI官方 <noreply@aizhs.top>'
    process.env.ALERT_EMAIL_TO = '502319984@qq.com,ops@example.com'

    // 前两次 = 中文组的首投 + 重试,都失败;第三次 = 英文组首投,成功
    mockSendMail
      .mockRejectedValueOnce(new Error('550 mailbox unavailable'))
      .mockRejectedValueOnce(new Error('550 mailbox unavailable'))
      .mockResolvedValueOnce({ messageId: 'ok-en' })

    const res = await pushAlertWithResult(alert())

    expect(res.email, '任一组送达即视为告警已到人').toBe(true)
    expect(mockSendMail, '中文组 2 次(首投+重试),英文组 1 次 —— 说明没有提前 return').toHaveBeenCalledTimes(3)
    expect(sentMail(0).to).toBe('502319984@qq.com')
    expect(sentMail(1).to).toBe('502319984@qq.com')
    expect(sentMail(2).to, '中文组失败后英文组必须仍被投递').toBe('ops@example.com')
    expect(mockClose, '无论成败 transporter 都要关闭,不能泄漏连接').toHaveBeenCalledTimes(1)
  })

  // ⑥ 防的是:SMTP 未配置时仍然 createTransport / 抛错,把告警链路整体带崩。
  it('⑥ SMTP_HOST 缺失 → email === false,不建 transport 也不抛', async () => {
    delete process.env.SMTP_HOST

    const res = await pushAlertWithResult(alert())

    expect(res.email).toBe(false)
    expect(mockCreateTransport, '未配置 SMTP 却建连接 = 白等超时').not.toHaveBeenCalled()
    expect(mockSendMail).not.toHaveBeenCalled()
    // 其它渠道本就未配置,必须全部 false(而不是抛错/悬挂)
    expect(res).toEqual({
      dingtalk: false,
      wechat: false,
      feishu: false,
      email: false,
      pagerduty: false,
      slack: false,
      teams: false,
      generic: false,
    })
  })
})
