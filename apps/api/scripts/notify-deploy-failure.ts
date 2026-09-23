// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 品牌告警邮件派发器 — 部署失败等运维事件的「智汇通报」邮件统一出口。
 *
 * 背景:
 * - 2026-09-21:GitHub workflow 失败分支补发品牌邮件,替代平台默认纯文本通知。
 * - 2026-09-24:本机 NSSM 部署环(ihui-deploy.ps1)原先在 PowerShell 里手拼纯文本 SMTP/Resend,
 *   用户收到的部署失败邮件永远没有样式;现升级为通用告警派发器,PowerShell 只传参调用,
 *   品牌版式收敛回 email-templates 单一真相源(CI 与本机双端同一「智汇通报」)。
 *
 * 设计约束(不得回退):
 * - 只 import email-templates(纯模板、零副作用),绝不 import email-service —— 后者连带
 *   db/redis,而部署失败时数据库本身可能就是坏的,通知路径不得依赖它。
 * - 不带 --strict 时恒 exit 0:CI 语义(通知失败不改变 job 结果);本机部署环显式加 --strict。
 * - 任何输出不得回显密钥值(§5d);收件人一律脱敏后打印。
 * - env-file 只补齐缺失的进程环境变量,绝不覆盖已有值。
 *
 * 用法见 --help。
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import nodemailer from 'nodemailer'
import { escapeHtml, renderSystemAlertEmail } from '../src/services/email-templates.js'
import type { DispatchEmail } from '../src/services/email-templates.js'

type Severity = 'info' | 'warning' | 'critical'
const SEVERITIES: readonly Severity[] = ['info', 'warning', 'critical']

const DEFAULT_SOURCE = 'github-actions/blue-green-deploy'
const DEFAULT_RESEND_FROM = '智汇AI官方 <IHUI-AI@aizhs.top>'
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/** env-file 只允许补齐这些键:通知链路所需的最小集,避免把整份 .env 灌进进程 */
const ENV_FILL_KEYS: readonly string[] = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'RESEND_API_KEY',
  'RESEND_FROM',
  'ALERT_EMAIL_TO',
]

interface EnvLike {
  [key: string]: string | undefined
}

interface CliArgs {
  to?: string
  title?: string
  severity?: string
  source?: string
  environment?: string
  stage?: string
  trigger?: string
  runUrl?: string
  messageFile?: string
  message?: string
  envFile?: string
  plain: boolean
  strict: boolean
  dryRun: boolean
  help: boolean
}

const HELP_TEXT = [
  '用法: node apps/api/node_modules/tsx/dist/cli.mjs apps/api/scripts/notify-deploy-failure.ts [flags]',
  '',
  '  --to <a@x.com,b@y.com>     收件人,逗号分隔。优先级: 本参数 > process.env.ALERT_EMAIL_TO > env-file 里的 ALERT_EMAIL_TO',
  '  --title <text>             邮件标题,默认 `部署失败 — <environment>`',
  '  --severity <info|warning|critical>  默认 critical;白名单外的值按 warning 处理',
  '  --source <text>            来源标识,默认 `github-actions/blue-green-deploy`(CI 传 blue-green-deploy,本机传 ihui-deployloop)',
  '  --environment <text>       默认 production',
  '  --stage <text>             CI 用,拼进 message',
  '  --trigger <text>           CI 用,拼进 message',
  '  --run-url <url>            CI 用,拼进 message',
  '  --message-file <path>      从 UTF-8 文件读取 message(优先级最高;调用方多行中文走文件,避免命令行参数编码被截)',
  '  --message <text>           直接给 message(优先级低于 --message-file,高于 stage 拼装)',
  '  --plain                    不渲染品牌模板,正文就是纯 message(供调用方的降级通道用);subject 不加 [SEVERITY] 前缀',
  '  --env-file <path>          默认 apps/api/.env;只补齐缺失的进程环境变量,绝不覆盖已有值',
  '  --strict                   任一通道失败或未配置 → exit 1;不带此参数恒 exit 0(CI 语义不能变)',
  '  --dry-run                  渲染并打印通道判定/收件人脱敏/subject/html 字节数,不发任何网络请求',
  '  --help                     打印本用法',
].join('\n')

/**
 * 值标志一律吞掉下一个 argv 项作为值(即便为空串):
 * `--to ''` 必须表达"显式置空收件人"(压过 env),而不是"没传"回落到 env —
 * 否则带 --strict 的空收件人演练会意外命中真实告警邮箱。
 */
function parseCliArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { plain: false, strict: false, dryRun: false, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    switch (token) {
      case '--plain':
        args.plain = true
        break
      case '--strict':
        args.strict = true
        break
      case '--dry-run':
        args.dryRun = true
        break
      case '--help':
      case '-h':
        args.help = true
        break
      case '--to':
        args.to = argv[++i] ?? ''
        break
      case '--title':
        args.title = argv[++i] ?? ''
        break
      case '--severity':
        args.severity = argv[++i] ?? ''
        break
      case '--source':
        args.source = argv[++i] ?? ''
        break
      case '--environment':
        args.environment = argv[++i] ?? ''
        break
      case '--stage':
        args.stage = argv[++i] ?? ''
        break
      case '--trigger':
        args.trigger = argv[++i] ?? ''
        break
      case '--run-url':
        args.runUrl = argv[++i] ?? ''
        break
      case '--message-file':
        args.messageFile = argv[++i] ?? ''
        break
      case '--message':
        args.message = argv[++i] ?? ''
        break
      case '--env-file':
        args.envFile = argv[++i] ?? ''
        break
      default:
        break
    }
  }
  return args
}

function normalizeSeverity(raw: string | undefined): Severity {
  if (raw === undefined) return 'critical'
  return (SEVERITIES as readonly string[]).includes(raw) ? (raw as Severity) : 'warning'
}

/** 极简 dotenv 解析(不引第三方):KEY=VALUE 一行一个,容忍 export 前缀、引号包裹、CRLF */
function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const body = line.startsWith('export ') ? line.slice('export '.length).trim() : line
    const eq = body.indexOf('=')
    if (eq <= 0) continue
    const key = body.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    let value = body.slice(eq + 1).trim()
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

/**
 * 只补缺失项,绝不覆盖进程已有值。CI 未配置的 secret 会以空串注入(SMTP_HOST=""),
 * 空串按"缺失"处理,否则 env-file 补齐通道在 CI 语义下形同虚设。
 */
function fillMissingEnv(
  env: EnvLike,
  fileVars: Readonly<Record<string, string>>,
  keys: readonly string[] = ENV_FILL_KEYS,
): EnvLike {
  const out: Record<string, string | undefined> = { ...env }
  for (const key of keys) {
    const current = out[key]
    if ((current === undefined || current.trim() === '') && fileVars[key] !== undefined) {
      out[key] = fileVars[key]
    }
  }
  return out
}

function splitRecipients(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 收件人三级优先级:显式 --to(即便空串) > 进程 env(含 env-file 补齐后) 的 ALERT_EMAIL_TO */
function resolveTo(explicit: string | undefined, effectiveEnv: EnvLike): string[] {
  return splitRecipients(explicit !== undefined ? explicit : (effectiveEnv.ALERT_EMAIL_TO ?? ''))
}

function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) return '***'
  return `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`
}

function maskEmails(list: readonly string[]): string[] {
  return list.map(maskEmail)
}

interface MessageParts {
  fileContent?: string
  message?: string
  stage?: string
  trigger?: string
  runUrl?: string
}

/** message 优先级:--message-file 内容 > --message > stage/trigger/run-url 拼装(后者含固定影响说明) */
function composeMessage(parts: MessageParts): string {
  if (parts.fileContent !== undefined) return parts.fileContent
  if (parts.message !== undefined) return parts.message
  return [
    parts.stage ? `失败阶段:${parts.stage}` : '',
    parts.trigger ? `触发人:${parts.trigger}` : '',
    parts.runUrl ? `构建日志:${parts.runUrl}` : '',
    '影响:该次部署未生效,线上仍由原环境承载流量,请尽快排查修复后重新部署。',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * SMTP 通道 From 构造:经 smtp.qq.com 中继时 From 邮箱段必须等于登录账号,否则被 550 拒。
 * 仅当 SMTP_FROM 为带 `<...>` 的显示名形态且其邮箱段大小写不敏感等于 SMTP_USER 才整串采用
 * (采用逻辑的意义是"保留自定义显示名";裸地址没有显示名可保留,仍走默认 `"智汇AI官方" <user>`,
 * 与 §5e 发件人品牌统一)。
 */
function resolveSmtpFrom(smtpFrom: string | undefined, smtpUser: string): string {
  const fallback = `"智汇AI官方" <${smtpUser}>`
  const configured = (smtpFrom ?? '').trim()
  const angle = /<([^>]+)>/.exec(configured)
  if (!angle || configured.startsWith('<')) return fallback
  const emailPart = (angle[1] ?? '').trim().toLowerCase()
  return emailPart === smtpUser.trim().toLowerCase() ? configured : fallback
}

function resolveResendFrom(effectiveEnv: EnvLike): string {
  return (effectiveEnv.RESEND_FROM ?? '').trim() || DEFAULT_RESEND_FROM
}

interface ChannelPlan {
  smtp: { available: boolean; missing: string[] }
  resend: { available: boolean; missing: string[] }
}

function planChannels(input: {
  host: string
  user: string
  pass: string
  toCount: number
  resendKey: string
}): ChannelPlan {
  const smtpMissing: string[] = []
  if (!input.host) smtpMissing.push('SMTP_HOST')
  if (!input.user) smtpMissing.push('SMTP_USER')
  if (!input.pass) smtpMissing.push('SMTP_PASS')
  const resendMissing: string[] = []
  if (!input.resendKey) resendMissing.push('RESEND_API_KEY')
  if (input.toCount === 0) {
    smtpMissing.push('ALERT_EMAIL_TO/--to')
    resendMissing.push('ALERT_EMAIL_TO/--to')
  }
  return {
    smtp: { available: smtpMissing.length === 0, missing: smtpMissing },
    resend: { available: resendMissing.length === 0, missing: resendMissing },
  }
}

interface AlertRenderInput {
  severity: Severity
  source: string
  title: string
  message: string
  plain: boolean
  time: string
}

function renderAlertEmail(input: AlertRenderInput): DispatchEmail {
  if (input.plain) {
    const html = `<div style="font-family:Consolas,'Courier New',monospace;font-size:15px;">${escapeHtml(input.message).split(/\r?\n/).join('<br>')}</div>`
    return { subject: input.title, html, text: input.message }
  }
  return renderSystemAlertEmail({
    severity: input.severity,
    source: input.source,
    time: input.time,
    title: input.title,
    message: input.message,
  })
}

interface MailPayload {
  from: string
  to: string
  subject: string
  html: string
  text: string
}

interface SmtpSendOpts {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
}

type SmtpSendFn = (opts: SmtpSendOpts, mail: MailPayload) => Promise<void>

interface FetchResponseLike {
  ok: boolean
  status: number
  text: () => Promise<string>
}

interface FetchInitLike {
  method: 'POST'
  headers: Record<string, string>
  body: string
}

type FetchLike = (url: string, init: FetchInitLike) => Promise<FetchResponseLike>

interface SendConfig {
  to: string[]
  smtp: {
    host: string
    port: number
    user: string
    pass: string
    from: string
    available: boolean
    missing: string[]
  }
  resend: { apiKey: string; from: string; available: boolean; missing: string[] }
}

interface RenderedMail {
  subject: string
  html: string
  text: string
}

interface DispatchResult {
  ok: boolean
  channel: 'smtp' | 'resend' | null
  reasons: string[]
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/**
 * 传输顺序:SMTP(齐备即首选)→ 不可用或抛错则回落 Resend。
 * Resend 是 REST 直连,不 import packages/ 的运行时服务(那条路带 DB 审计)。
 */
async function dispatchMail(
  cfg: SendConfig,
  mail: RenderedMail,
  deps: { sendSmtp: SmtpSendFn; fetchResend: FetchLike },
): Promise<DispatchResult> {
  const reasons: string[] = []
  if (cfg.smtp.available) {
    try {
      await deps.sendSmtp(
        {
          host: cfg.smtp.host,
          port: cfg.smtp.port,
          secure: cfg.smtp.port === 465,
          user: cfg.smtp.user,
          pass: cfg.smtp.pass,
        },
        {
          from: cfg.smtp.from,
          to: cfg.to.join(','),
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        },
      )
      return { ok: true, channel: 'smtp', reasons }
    } catch (e) {
      reasons.push(`SMTP 发送失败,回落 Resend: ${errText(e)}`)
    }
  } else {
    reasons.push(`SMTP 通道不可用(缺 ${cfg.smtp.missing.join('、')})`)
  }
  if (cfg.resend.available) {
    try {
      const res = await deps.fetchResend(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.resend.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: cfg.resend.from,
          to: [...cfg.to],
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        }),
      })
      if (res.ok) return { ok: true, channel: 'resend', reasons }
      const body = await res.text().catch(() => '')
      reasons.push(`Resend HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`)
    } catch (e) {
      reasons.push(`Resend 请求失败: ${errText(e)}`)
    }
  } else {
    reasons.push(`Resend 通道不可用(缺 ${cfg.resend.missing.join('、')})`)
  }
  return { ok: false, channel: null, reasons }
}

interface RunDeps {
  readTextFile: (p: string) => string
  sendSmtp: SmtpSendFn
  fetchResend: FetchLike
  now: () => string
}

interface RunOutcome {
  help: boolean
  dryRun: boolean
  strict: boolean
  sent: boolean
  channel: 'smtp' | 'resend' | null
  subject: string
  htmlBytes: number
  toMasked: string[]
  smtp: { available: boolean; missing: string[]; from: string }
  resend: { available: boolean; missing: string[]; from: string }
  reasons: string[]
  warnings: string[]
  htmlHasDispatchBanner: boolean
}

/** 默认 env-file 从脚本自身位置推导(§15 禁硬编码盘符):apps/api/scripts → apps/api/.env */
function defaultEnvFilePath(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env')
}

function stripBom(text: string): string {
  // PowerShell 5.1 写出的 UTF-8 带 BOM,不去掉会在邮件正文首行冒出乱码
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

async function runCore(argv: readonly string[], env: EnvLike, deps: RunDeps): Promise<RunOutcome> {
  const args = parseCliArgs(argv)
  const warnings: string[] = []
  if (args.help) {
    return {
      help: true,
      dryRun: false,
      strict: args.strict,
      sent: false,
      channel: null,
      subject: '',
      htmlBytes: 0,
      toMasked: [],
      smtp: { available: false, missing: [], from: '' },
      resend: { available: false, missing: [], from: '' },
      reasons: [],
      warnings,
      htmlHasDispatchBanner: false,
    }
  }

  let fileVars: Record<string, string> = {}
  const envFilePath = args.envFile || defaultEnvFilePath()
  try {
    fileVars = parseDotenv(deps.readTextFile(envFilePath))
  } catch (e) {
    // 默认路径缺失是常态(干净 checkout / CI 只有进程 env),不值得噪音;显式传了却读不到必须说
    if (args.envFile !== undefined) {
      warnings.push(`--env-file 读取失败,仅用进程环境变量: ${errText(e)}`)
    }
  }
  const effective = fillMissingEnv(env, fileVars)

  const to = resolveTo(args.to, effective)
  const severity = normalizeSeverity(args.severity)
  const environment = args.environment || 'production'
  const source = args.source || DEFAULT_SOURCE
  const title = args.title ?? `部署失败 — ${environment}`

  let fileContent: string | undefined
  if (args.messageFile !== undefined) {
    try {
      fileContent = stripBom(deps.readTextFile(args.messageFile))
    } catch (e) {
      warnings.push(`--message-file 读取失败,回落其他消息来源: ${errText(e)}`)
    }
  }
  const message = composeMessage({
    fileContent,
    message: args.message,
    stage: args.stage,
    trigger: args.trigger,
    runUrl: args.runUrl,
  })
  const rendered = renderAlertEmail({
    severity,
    source,
    title,
    message,
    plain: args.plain,
    time: deps.now(),
  })

  const host = (effective.SMTP_HOST ?? '').trim()
  const user = (effective.SMTP_USER ?? '').trim()
  // pass 不 trim:授权码/口令可能含首尾空白
  const pass = effective.SMTP_PASS ?? ''
  const port = Number.parseInt(effective.SMTP_PORT ?? '', 10) || 465
  const resendKey = (effective.RESEND_API_KEY ?? '').trim()
  const plan = planChannels({ host, user, pass, toCount: to.length, resendKey })
  const cfg: SendConfig = {
    to,
    smtp: {
      host,
      port,
      user,
      pass,
      from: resolveSmtpFrom(effective.SMTP_FROM, user),
      available: plan.smtp.available,
      missing: plan.smtp.missing,
    },
    resend: {
      apiKey: resendKey,
      from: resolveResendFrom(effective),
      available: plan.resend.available,
      missing: plan.resend.missing,
    },
  }

  const base: Omit<RunOutcome, 'sent' | 'channel' | 'reasons'> = {
    help: false,
    dryRun: args.dryRun,
    strict: args.strict,
    subject: rendered.subject,
    htmlBytes: Buffer.byteLength(rendered.html, 'utf8'),
    toMasked: maskEmails(to),
    smtp: { available: cfg.smtp.available, missing: cfg.smtp.missing, from: cfg.smtp.from },
    resend: { available: cfg.resend.available, missing: cfg.resend.missing, from: cfg.resend.from },
    warnings,
    htmlHasDispatchBanner: rendered.html.includes('MECHANICAL'),
  }

  if (args.dryRun) {
    const channel: 'smtp' | 'resend' | null = cfg.smtp.available
      ? 'smtp'
      : cfg.resend.available
        ? 'resend'
        : null
    return { ...base, sent: false, channel, reasons: [] }
  }
  const result = await dispatchMail(cfg, rendered, {
    sendSmtp: deps.sendSmtp,
    fetchResend: deps.fetchResend,
  })
  return { ...base, sent: result.ok, channel: result.channel, reasons: result.reasons }
}

/** --strict 才允许非零退出;dry-run/help 只渲染不发送,恒 0 */
function computeExitCode(o: {
  strict: boolean
  sent: boolean
  dryRun: boolean
  help: boolean
}): 0 | 1 {
  return o.strict && !o.sent && !o.dryRun && !o.help ? 1 : 0
}

const defaultSendSmtp: SmtpSendFn = async (opts, mail) => {
  const transporter = nodemailer.createTransport({
    host: opts.host,
    port: opts.port,
    secure: opts.secure,
    auth: opts.pass ? { user: opts.user, pass: opts.pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  })
  try {
    await transporter.sendMail(mail)
  } finally {
    transporter.close()
  }
}

const defaultRunDeps: RunDeps = {
  readTextFile: (p) => readFileSync(p, 'utf8'),
  sendSmtp: defaultSendSmtp,
  fetchResend: (url, init) => globalThis.fetch(url, init),
  now: () => new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }),
}

async function main(
  argv: readonly string[] = process.argv.slice(2),
  env: EnvLike = process.env,
): Promise<number> {
  try {
    const outcome = await runCore(argv, env, defaultRunDeps)
    for (const w of outcome.warnings) console.error(`[alert-mail] 警告: ${w}`)
    if (outcome.help) {
      console.log(HELP_TEXT)
      return 0
    }
    if (outcome.dryRun) {
      console.log(
        `[dry-run] 通道判定 SMTP: ${
          outcome.smtp.available
            ? `可用(优先使用,from=${outcome.smtp.from})`
            : `不可用(缺 ${outcome.smtp.missing.join('、')})`
        }`,
      )
      console.log(
        `[dry-run] 通道判定 Resend: ${
          outcome.resend.available
            ? `可用(回落通道,from=${outcome.resend.from})`
            : `不可用(缺 ${outcome.resend.missing.join('、')})`
        }`,
      )
      console.log(`[dry-run] 收件人: ${outcome.toMasked.join(', ') || '(空)'}`)
      console.log(`[dry-run] subject: ${outcome.subject}`)
      console.log(
        `[dry-run] html 字节数: ${outcome.htmlBytes};机械风横幅关键字命中: ${
          outcome.htmlHasDispatchBanner ? 'yes' : 'no'
        }`,
      )
      return 0
    }
    if (outcome.sent) {
      console.log(
        `[alert-mail] 已通过 ${outcome.channel} 通道发送告警邮件(收件人 ${outcome.toMasked.length} 个)`,
      )
      return computeExitCode(outcome)
    }
    for (const r of outcome.reasons) console.error(`[alert-mail] ${r}`)
    return computeExitCode(outcome)
  } catch (e) {
    console.error(`[alert-mail] 脚本异常: ${errText(e)}`)
    return parseCliArgs(argv).strict ? 2 : 0
  }
}

// §22d:CLI 直跑与测试 import 双形态隔离,import 本模块不得触发任何网络/文件副作用
const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  void main().then(
    (code) => {
      process.exitCode = code
    },
    (e: unknown) => {
      console.error(`[alert-mail] 未捕获异常: ${errText(e)}`)
      process.exitCode = 2
    },
  )
}

export const __test__ = {
  parseCliArgs,
  normalizeSeverity,
  parseDotenv,
  fillMissingEnv,
  splitRecipients,
  resolveTo,
  maskEmail,
  maskEmails,
  composeMessage,
  resolveSmtpFrom,
  resolveResendFrom,
  planChannels,
  renderAlertEmail,
  dispatchMail,
  runCore,
  computeExitCode,
  defaultEnvFilePath,
  stripBom,
  ENV_FILL_KEYS,
  DEFAULT_SOURCE,
  DEFAULT_RESEND_FROM,
  RESEND_ENDPOINT,
  HELP_TEXT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
