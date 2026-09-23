// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * notify-deploy-failure 品牌告警派发器单测。
 *
 * 铁律:全部走注入的假实现 —— 测试不得真发邮件、不得连库、不得碰网络。
 * §22c/§22d:通过 __test__ 导出直接消费源函数,禁止复制镜像实现。
 */

import { describe, it, expect } from 'vitest'
import { __test__ as t } from '../scripts/notify-deploy-failure.js'

interface SmtpCall {
  opts: { host: string; port: number; secure: boolean; user: string; pass: string }
  mail: { from: string; to: string; subject: string; html: string; text: string }
}

interface FetchCall {
  url: string
  init: { method: 'POST'; headers: Record<string, string>; body: string }
}

interface FetchResponseLike {
  ok: boolean
  status: number
  text: () => Promise<string>
}

interface FakeDeps {
  readTextFile: (p: string) => string
  sendSmtp: (o: SmtpCall['opts'], mail: SmtpCall['mail']) => Promise<void>
  fetchResend: (url: string, init: FetchCall['init']) => Promise<FetchResponseLike>
  now: () => string
}

function makeDeps(
  opts: {
    files?: Record<string, string>
    smtpError?: Error
    resendResponse?: { ok: boolean; status: number; body?: string }
  } = {},
): { deps: FakeDeps; smtpCalls: SmtpCall[]; fetchCalls: FetchCall[] } {
  const smtpCalls: SmtpCall[] = []
  const fetchCalls: FetchCall[] = []
  const deps: FakeDeps = {
    readTextFile: (p) => {
      const c = opts.files?.[p]
      if (c === undefined) throw new Error(`ENOENT: no such file ${p}`)
      return c
    },
    sendSmtp: async (o, mail) => {
      smtpCalls.push({ opts: o, mail })
      if (opts.smtpError) throw opts.smtpError
    },
    fetchResend: async (url, init) => {
      fetchCalls.push({ url, init })
      const ok = opts.resendResponse?.ok ?? true
      const status = opts.resendResponse?.status ?? 200
      const body = opts.resendResponse?.body ?? ''
      return { ok, status, text: async () => body }
    },
    now: () => '2026-09-24 10:00:00',
  }
  return { deps, smtpCalls, fetchCalls }
}

/** 断言"调用确实发生了"并收窄 noUncheckedIndexedAccess 的 undefined */
function must<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new Error(`${what} 不存在(预期调用未发生)`)
  return v
}

const SMTP_ENV: Record<string, string> = {
  SMTP_HOST: 'smtp.qq.com',
  SMTP_PORT: '465',
  SMTP_USER: 'ihui@qq.com',
  SMTP_PASS: 'auth-code-1',
  ALERT_EMAIL_TO: 'ops@example.com',
}

function fullSmtpCfg(over?: { smtpAvailable?: boolean; smtpMissing?: string[] }) {
  return {
    to: ['a@x.com', 'b@y.com'],
    smtp: {
      host: 'h',
      port: 465,
      user: 'u',
      pass: 'p',
      from: '"智汇AI官方" <u>',
      available: over?.smtpAvailable ?? true,
      missing: over?.smtpMissing ?? [],
    },
    resend: { apiKey: 'key', from: '智汇AI官方 <IHUI-AI@aizhs.top>', available: true, missing: [] },
  }
}

const MAIL = { subject: 'S', html: '<html>H</html>', text: 'T' }

describe('parseCliArgs', () => {
  it('解析全部值参数与布尔开关', () => {
    const a = t.parseCliArgs([
      '--to',
      'x@y.z',
      '--title',
      'T',
      '--severity',
      'warning',
      '--source',
      'ihui-deployloop',
      '--environment',
      'staging',
      '--stage',
      's',
      '--trigger',
      'u',
      '--run-url',
      'https://r',
      '--message-file',
      '/tmp/m.txt',
      '--message',
      'mm',
      '--env-file',
      '/tmp/e.env',
      '--plain',
      '--strict',
      '--dry-run',
    ])
    expect(a.to).toBe('x@y.z')
    expect(a.title).toBe('T')
    expect(a.severity).toBe('warning')
    expect(a.source).toBe('ihui-deployloop')
    expect(a.environment).toBe('staging')
    expect(a.stage).toBe('s')
    expect(a.trigger).toBe('u')
    expect(a.runUrl).toBe('https://r')
    expect(a.messageFile).toBe('/tmp/m.txt')
    expect(a.message).toBe('mm')
    expect(a.envFile).toBe('/tmp/e.env')
    expect(a.plain).toBe(true)
    expect(a.strict).toBe(true)
    expect(a.dryRun).toBe(true)
    expect(a.help).toBe(false)
  })

  it('--to 传空串必须记为"显式置空"(压过 env),不是"没传"', () => {
    const a = t.parseCliArgs(['--to', ''])
    expect('to' in a).toBe(true)
    expect(a.to).toBe('')
    expect(t.resolveTo(a.to, { ALERT_EMAIL_TO: 'ops@x.com' })).toEqual([])
  })

  it('--help 与 -h 等价;未知参数被忽略不抛错', () => {
    expect(t.parseCliArgs(['--help']).help).toBe(true)
    expect(t.parseCliArgs(['-h']).help).toBe(true)
    const a = t.parseCliArgs(['--bogus', 'value'])
    expect(a.to).toBeUndefined()
    expect(a.plain).toBe(false)
  })
})

describe('normalizeSeverity', () => {
  it('白名单原样;缺省 critical;白名单外一律 warning', () => {
    expect(t.normalizeSeverity(undefined)).toBe('critical')
    expect(t.normalizeSeverity('info')).toBe('info')
    expect(t.normalizeSeverity('warning')).toBe('warning')
    expect(t.normalizeSeverity('critical')).toBe('critical')
    expect(t.normalizeSeverity('emergency')).toBe('warning')
    expect(t.normalizeSeverity('')).toBe('warning')
  })
})

describe('parseDotenv', () => {
  it('KEY=VALUE / export 前缀 / 引号剥离 / 注释与非法行跳过 / CRLF', () => {
    const map = t.parseDotenv(
      '# comment\r\nKEY=VALUE\nexport SPACE="a b"\nEMPTY=\nQUOTED=\'sq\'\nbad-key=x\nNOEQUALS\nA=b=c\n',
    )
    expect(map).toEqual({ KEY: 'VALUE', SPACE: 'a b', EMPTY: '', QUOTED: 'sq', A: 'b=c' })
  })
})

describe('fillMissingEnv', () => {
  it('绝不覆盖进程已有值;缺失才补;非白名单键不得从文件渗入', () => {
    const merged = t.fillMissingEnv(
      { SMTP_HOST: 'proc.host', DATABASE_URL: 'keep' },
      {
        SMTP_HOST: 'file.host',
        SMTP_USER: 'file.user',
        ALERT_EMAIL_TO: 'file@x.com',
        DATABASE_URL: 'leak',
      },
    )
    expect(merged.SMTP_HOST).toBe('proc.host')
    expect(merged.SMTP_USER).toBe('file.user')
    expect(merged.ALERT_EMAIL_TO).toBe('file@x.com')
    expect(merged.DATABASE_URL).toBe('keep')
  })

  it('CI 未配置 secret 注入空串 → 按缺失处理被 env-file 补齐', () => {
    const merged = t.fillMissingEnv({ SMTP_HOST: '  ' }, { SMTP_HOST: 'file.host' })
    expect(merged.SMTP_HOST).toBe('file.host')
  })
})

describe('resolveTo', () => {
  it('三级优先级:显式 --to > 进程 env > env-file 补齐后的 env(同一 env 面)', () => {
    expect(t.resolveTo('a@x.com, b@y.com ', {})).toEqual(['a@x.com', 'b@y.com'])
    expect(t.resolveTo(undefined, { ALERT_EMAIL_TO: 'ops@x.com,o2@y.com' })).toEqual([
      'ops@x.com',
      'o2@y.com',
    ])
    expect(t.resolveTo(undefined, {})).toEqual([])
  })
})

describe('maskEmail', () => {
  it('本地段只留前 2 字符;无 @ 全遮', () => {
    expect(t.maskEmail('502319984@qq.com')).toBe('50***@qq.com')
    expect(t.maskEmail('ab@x.com')).toBe('ab***@x.com')
    expect(t.maskEmail('nope')).toBe('***')
  })
})

describe('composeMessage', () => {
  it('--message-file > --message > stage 拼装', () => {
    expect(t.composeMessage({ fileContent: 'A', message: 'B', stage: 's' })).toBe('A')
    expect(t.composeMessage({ fileContent: '', message: 'B' })).toBe('')
    expect(t.composeMessage({ message: 'B', stage: 's' })).toBe('B')
  })

  it('stage 拼装保留固定影响说明,省略缺失项', () => {
    const asm = t.composeMessage({ stage: 'job=deploy', runUrl: 'https://r' })
    expect(asm).toContain('失败阶段:job=deploy')
    expect(asm).toContain('构建日志:https://r')
    expect(asm).not.toContain('触发人')
    expect(asm).toContain('影响:该次部署未生效,线上仍由原环境承载流量,请尽快排查修复后重新部署。')
  })
})

describe('resolveSmtpFrom', () => {
  it('SMTP_FROM 未设 → "智汇AI官方" <SMTP_USER>', () => {
    expect(t.resolveSmtpFrom(undefined, 'bot@qq.com')).toBe('"智汇AI官方" <bot@qq.com>')
    expect(t.resolveSmtpFrom('   ', 'bot@qq.com')).toBe('"智汇AI官方" <bot@qq.com>')
  })

  it('<...> 邮箱段大小写不敏感匹配登录账号且含显示名 → 整串采用', () => {
    expect(t.resolveSmtpFrom('"自定义" <Bot@QQ.com>', 'bot@qq.com')).toBe('"自定义" <Bot@QQ.com>')
  })

  it('裸地址(无显示名可保留)→ 仍走默认带显示名构造,中继同样安全', () => {
    expect(t.resolveSmtpFrom('bot@qq.com', 'bot@qq.com')).toBe('"智汇AI官方" <bot@qq.com>')
    expect(t.resolveSmtpFrom('<bot@qq.com>', 'bot@qq.com')).toBe('"智汇AI官方" <bot@qq.com>')
  })

  it('邮箱段不匹配 → 回落默认(防 smtp.qq.com 550)', () => {
    expect(t.resolveSmtpFrom('"其他" <other@qq.com>', 'bot@qq.com')).toBe(
      '"智汇AI官方" <bot@qq.com>',
    )
  })
})

describe('resolveResendFrom', () => {
  it('RESEND_FROM 优先;缺省用 aizhs.top 已验证域', () => {
    expect(t.resolveResendFrom({ RESEND_FROM: 'X <x@aizhs.top>' })).toBe('X <x@aizhs.top>')
    expect(t.resolveResendFrom({})).toBe('智汇AI官方 <IHUI-AI@aizhs.top>')
  })
})

describe('planChannels', () => {
  it('齐备 → 双通道可用', () => {
    const p = t.planChannels({ host: 'h', user: 'u', pass: 'p', toCount: 1, resendKey: 'k' })
    expect(p.smtp).toEqual({ available: true, missing: [] })
    expect(p.resend.available).toBe(true)
  })

  it('逐项点名缺失;无收件人时两通道同时不可用', () => {
    const p = t.planChannels({ host: 'h', user: 'u', pass: '', toCount: 1, resendKey: '' })
    expect(p.smtp.available).toBe(false)
    expect(p.smtp.missing).toEqual(['SMTP_PASS'])
    expect(p.resend.missing).toEqual(['RESEND_API_KEY'])
    const noTo = t.planChannels({ host: 'h', user: 'u', pass: 'p', toCount: 0, resendKey: 'k' })
    expect(noTo.smtp.available).toBe(false)
    expect(noTo.resend.available).toBe(false)
    expect(noTo.smtp.missing).toContain('ALERT_EMAIL_TO/--to')
    expect(noTo.resend.missing).toContain('ALERT_EMAIL_TO/--to')
  })
})

describe('renderAlertEmail', () => {
  it('品牌通道:subject 带 [SEVERITY] 前缀,html 命中机械风横幅且逐行渲染', () => {
    const r = t.renderAlertEmail({
      severity: 'critical',
      source: 'ihui-deployloop',
      title: '部署失败 — production',
      message: '第一行\n第二行',
      plain: false,
      time: '2026-09-24 10:00:00',
    })
    expect(r.subject).toBe('[CRITICAL] 部署失败 — production')
    expect(r.html).toContain('MECHANICAL')
    expect(r.html).toContain('第一行')
    expect(r.html).toContain('第二行')
    expect(r.text).toContain('第一行')
  })

  it('info 徽章为 [INFO]', () => {
    const r = t.renderAlertEmail({
      severity: 'info',
      source: 's',
      title: 'T',
      message: 'm',
      plain: false,
      time: 't',
    })
    expect(r.subject).toBe('[INFO] T')
  })

  it('--plain:subject 不加前缀,正文就是 message,无品牌版式', () => {
    const r = t.renderAlertEmail({
      severity: 'critical',
      source: 's',
      title: '部署失败 — production',
      message: '第一行\n第二行',
      plain: true,
      time: 't',
    })
    expect(r.subject).toBe('部署失败 — production')
    expect(r.text).toBe('第一行\n第二行')
    expect(r.html).toContain('第一行')
    expect(r.html).toContain('<br>')
    expect(r.html).not.toContain('MECHANICAL')
  })
})

describe('dispatchMail', () => {
  it('SMTP 成功即返回,不再走 Resend', async () => {
    const { deps, smtpCalls, fetchCalls } = makeDeps()
    const res = await t.dispatchMail(fullSmtpCfg(), MAIL, {
      sendSmtp: deps.sendSmtp,
      fetchResend: deps.fetchResend,
    })
    expect(res).toEqual({ ok: true, channel: 'smtp', reasons: [] })
    expect(smtpCalls).toHaveLength(1)
    expect(fetchCalls).toHaveLength(0)
    expect(must(smtpCalls[0], 'smtpCalls[0]').opts.secure).toBe(true)
    expect(must(smtpCalls[0], 'smtpCalls[0]').mail.to).toBe('a@x.com,b@y.com')
    expect(must(smtpCalls[0], 'smtpCalls[0]').mail.html).toBe('<html>H</html>')
  })

  it('587 端口 secure=false', async () => {
    const { deps, smtpCalls } = makeDeps()
    const cfg = fullSmtpCfg()
    cfg.smtp.port = 587
    await t.dispatchMail(cfg, MAIL, {
      sendSmtp: deps.sendSmtp,
      fetchResend: deps.fetchResend,
    })
    expect(must(smtpCalls[0], 'smtpCalls[0]').opts.secure).toBe(false)
  })

  it('SMTP 抛错 → 回落 Resend;payload 必须同时含 html+text,带 Authorization: Bearer', async () => {
    const { deps, fetchCalls } = makeDeps({ smtpError: new Error('boom') })
    const res = await t.dispatchMail(fullSmtpCfg(), MAIL, {
      sendSmtp: deps.sendSmtp,
      fetchResend: deps.fetchResend,
    })
    expect(res.ok).toBe(true)
    expect(res.channel).toBe('resend')
    expect(res.reasons[0]).toContain('SMTP 发送失败,回落 Resend')
    expect(res.reasons[0]).toContain('boom')
    expect(fetchCalls).toHaveLength(1)
    expect(must(fetchCalls[0], 'fetchCalls[0]').url).toBe('https://api.resend.com/emails')
    expect(must(fetchCalls[0], 'fetchCalls[0]').init.headers.Authorization).toBe('Bearer key')
    const body = JSON.parse(must(fetchCalls[0], 'fetchCalls[0]').init.body)
    expect(body.html).toBe('<html>H</html>')
    expect(body.text).toBe('T')
    expect(body.to).toEqual(['a@x.com', 'b@y.com'])
    expect(body.from).toBe('智汇AI官方 <IHUI-AI@aizhs.top>')
  })

  it('SMTP 未配置直接跳过(不尝试),走 Resend', async () => {
    const { deps, smtpCalls, fetchCalls } = makeDeps()
    const cfg = fullSmtpCfg({ smtpAvailable: false, smtpMissing: ['SMTP_PASS'] })
    const res = await t.dispatchMail(cfg, MAIL, {
      sendSmtp: deps.sendSmtp,
      fetchResend: deps.fetchResend,
    })
    expect(smtpCalls).toHaveLength(0)
    expect(fetchCalls).toHaveLength(1)
    expect(res.channel).toBe('resend')
    expect(res.reasons[0]).toContain('缺 SMTP_PASS')
  })

  it('Resend HTTP 非 2xx → 失败并带状态码', async () => {
    const { deps } = makeDeps({
      smtpError: new Error('conn reset'),
      resendResponse: { ok: false, status: 422, body: 'invalid' },
    })
    const res = await t.dispatchMail(fullSmtpCfg(), MAIL, {
      sendSmtp: deps.sendSmtp,
      fetchResend: deps.fetchResend,
    })
    expect(res.ok).toBe(false)
    expect(res.reasons.join('\n')).toContain('Resend HTTP 422')
    expect(res.reasons.join('\n')).toContain('conn reset')
  })

  it('双通道都不可用 → 各自点名缺失', async () => {
    const { deps, smtpCalls, fetchCalls } = makeDeps()
    const cfg = {
      ...fullSmtpCfg({ smtpAvailable: false, smtpMissing: ['SMTP_HOST'] }),
      resend: { apiKey: '', from: 'f', available: false, missing: ['RESEND_API_KEY'] },
    }
    const res = await t.dispatchMail(cfg, MAIL, {
      sendSmtp: deps.sendSmtp,
      fetchResend: deps.fetchResend,
    })
    expect(res).toEqual({ ok: false, channel: null, reasons: expect.any(Array) })
    expect(smtpCalls).toHaveLength(0)
    expect(fetchCalls).toHaveLength(0)
    expect(res.reasons.join('\n')).toContain('缺 SMTP_HOST')
    expect(res.reasons.join('\n')).toContain('缺 RESEND_API_KEY')
  })
})

describe('runCore(端到端,零网络)', () => {
  it('--dry-run 不发任何请求,给出通道判定/脱敏收件人/subject/html 字节数', async () => {
    const { deps, smtpCalls, fetchCalls } = makeDeps()
    const o = await t.runCore(['--dry-run', '--message', 'hi'], SMTP_ENV, deps)
    expect(smtpCalls).toHaveLength(0)
    expect(fetchCalls).toHaveLength(0)
    expect(o.dryRun).toBe(true)
    expect(o.sent).toBe(false)
    expect(o.channel).toBe('smtp')
    expect(o.subject).toBe('[CRITICAL] 部署失败 — production')
    expect(o.htmlBytes).toBeGreaterThan(0)
    expect(o.htmlHasDispatchBanner).toBe(true)
    expect(o.toMasked).toEqual(['op***@example.com'])
    expect(o.toMasked.join()).not.toContain('ops@example.com')
  })

  it('--message-file 优先于 --message;读取失败回落并 warning', async () => {
    const { deps, smtpCalls } = makeDeps({ files: { '/tmp/msg.txt': '文件内容A\nB行' } })
    await t.runCore(['--message-file', '/tmp/msg.txt', '--message', '被忽略'], SMTP_ENV, deps)
    expect(must(smtpCalls[0], 'smtpCalls[0]').mail.text).toContain('文件内容A')
    expect(must(smtpCalls[0], 'smtpCalls[0]').mail.text).not.toContain('被忽略')

    const f2 = makeDeps()
    const o2 = await t.runCore(
      ['--message-file', '/nope.txt', '--message', '回退值'],
      SMTP_ENV,
      f2.deps,
    )
    expect(o2.warnings.join()).toContain('--message-file 读取失败')
    expect(must(f2.smtpCalls[0], 'f2.smtpCalls[0]').mail.text).toContain('回退值')
  })

  it('env-file 只补缺失:进程 SMTP_HOST 不被文件覆盖;ALERT_EMAIL_TO 文件层兜底', async () => {
    const { deps, smtpCalls } = makeDeps({
      files: {
        '/e.env': 'SMTP_HOST=file.host\nSMTP_PASS=file.pass\nALERT_EMAIL_TO=file@x.com\n',
      },
    })
    await t.runCore(
      ['--env-file', '/e.env', '--message', 'm'],
      { SMTP_HOST: 'real.host', SMTP_USER: 'u@x.com' },
      deps,
    )
    expect(smtpCalls).toHaveLength(1)
    expect(must(smtpCalls[0], 'smtpCalls[0]').opts.host).toBe('real.host')
    expect(must(smtpCalls[0], 'smtpCalls[0]').opts.pass).toBe('file.pass')
    expect(must(smtpCalls[0], 'smtpCalls[0]').mail.to).toBe('file@x.com')
  })

  it('ALERT_EMAIL_TO:进程 env 压过 env-file;--to 压过两者', async () => {
    const { deps, smtpCalls } = makeDeps({
      files: { '/e.env': 'ALERT_EMAIL_TO=file@x.com\n' },
    })
    await t.runCore(
      ['--env-file', '/e.env', '--message', 'm'],
      { ...SMTP_ENV, ALERT_EMAIL_TO: 'proc@x.com' },
      deps,
    )
    expect(must(smtpCalls[0], 'smtpCalls[0]').mail.to).toBe('proc@x.com')
    await t.runCore(
      ['--env-file', '/e.env', '--to', 'cli@x.com', '--message', 'm'],
      { ...SMTP_ENV, ALERT_EMAIL_TO: 'proc@x.com' },
      deps,
    )
    expect(must(smtpCalls[1], 'smtpCalls[1]').mail.to).toBe('cli@x.com')
  })

  it('显式 --env-file 读不到 → warning;默认路径缺失 → 静默', async () => {
    const { deps } = makeDeps()
    const o = await t.runCore(['--env-file', '/nope/.env', '--message', 'm'], SMTP_ENV, deps)
    expect(o.warnings.join()).toContain('--env-file 读取失败')
    const o2 = await t.runCore(['--message', 'm'], SMTP_ENV, deps)
    expect(o2.warnings).toEqual([])
  })

  it('severity 白名单外 → [WARNING];默认标题 = 部署失败 — <environment>', async () => {
    const { deps, smtpCalls } = makeDeps()
    const o = await t.runCore(['--severity', 'emergency', '--message', 'm'], SMTP_ENV, deps)
    expect(o.subject).toBe('[WARNING] 部署失败 — production')
    const o2 = await t.runCore(
      [
        '--environment',
        'staging',
        '--title',
        '磁盘告警',
        '--source',
        'ihui-deployloop',
        '--message',
        'm',
      ],
      SMTP_ENV,
      deps,
    )
    expect(o2.subject).toBe('[CRITICAL] 磁盘告警')
    expect(must(smtpCalls[1], 'smtpCalls[1]').mail.text).toContain('来源:ihui-deployloop')
  })

  it('--plain 端到端:subject 无前缀,正文即 message', async () => {
    const { deps, smtpCalls } = makeDeps()
    const o = await t.runCore(
      ['--plain', '--title', '裸文本', '--message', '一行\n两行'],
      SMTP_ENV,
      deps,
    )
    expect(o.subject).toBe('裸文本')
    expect(must(smtpCalls[0], 'smtpCalls[0]').mail.text).toBe('一行\n两行')
    expect(must(smtpCalls[0], 'smtpCalls[0]').mail.html).toContain('一行')
    expect(must(smtpCalls[0], 'smtpCalls[0]').mail.html).not.toContain('MECHANICAL')
  })

  it('SMTP 发送抛错 → Resend 回落真实触发(payload 含 html+text + Bearer)', async () => {
    const { deps, fetchCalls } = makeDeps({ smtpError: new Error('connection reset') })
    const o = await t.runCore(
      ['--message', 'm'],
      { ...SMTP_ENV, RESEND_API_KEY: 're_test_key' },
      deps,
    )
    expect(o.sent).toBe(true)
    expect(o.channel).toBe('resend')
    expect(fetchCalls).toHaveLength(1)
    expect(must(fetchCalls[0], 'fetchCalls[0]').init.headers.Authorization).toBe(
      'Bearer re_test_key',
    )
    const body = JSON.parse(must(fetchCalls[0], 'fetchCalls[0]').init.body)
    expect(typeof body.html).toBe('string')
    expect(typeof body.text).toBe('string')
    expect(o.reasons[0]).toContain('connection reset')
    expect(t.computeExitCode(o)).toBe(0)
  })

  it('全通道未配置:--strict 判 1,非 strict 恒 0,reasons 逐项点名', async () => {
    const { deps, smtpCalls, fetchCalls } = makeDeps()
    const o = await t.runCore(['--message', 'm'], {}, deps)
    expect(smtpCalls).toHaveLength(0)
    expect(fetchCalls).toHaveLength(0)
    expect(o.sent).toBe(false)
    expect(o.reasons.join('\n')).toContain('缺 SMTP_HOST')
    expect(o.reasons.join('\n')).toContain('RESEND_API_KEY')
    expect(o.reasons.join('\n')).toContain('ALERT_EMAIL_TO/--to')
    expect(t.computeExitCode({ ...o, strict: true })).toBe(1)
    expect(t.computeExitCode(o)).toBe(0)
  })

  it('computeExitCode:dry-run/help/已发送一律 0', () => {
    expect(t.computeExitCode({ strict: true, sent: false, dryRun: true, help: false })).toBe(0)
    expect(t.computeExitCode({ strict: true, sent: false, dryRun: false, help: true })).toBe(0)
    expect(t.computeExitCode({ strict: true, sent: true, dryRun: false, help: false })).toBe(0)
  })

  it('--help 短路返回', async () => {
    const { deps } = makeDeps()
    const o = await t.runCore(['--help'], {}, deps)
    expect(o.help).toBe(true)
    expect(t.computeExitCode(o)).toBe(0)
  })

  it('stripBom 去 PowerShell BOM;默认 env-file 落在 apps/api/.env', () => {
    expect(t.stripBom('﻿abc')).toBe('abc')
    expect(t.stripBom('abc')).toBe('abc')
    expect(t.defaultEnvFilePath().replace(/\\/g, '/')).toMatch(/apps\/api\/\.env$/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
