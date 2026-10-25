// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * auto-evolve — AI 自进化调度器(四期系列总纲 O65 · 第 0 期,2026-10-25 立)。
 *
 * 单轮职责:取票 → 闸 → 派发 → 记账 → 逃生邮件。守护(git-guardian)只守不开发,
 * 本器补"发起权"那一层:没人开会话也能按节律从派单面取真工作并派给执行端。
 *
 * 判据纪律(违反任何一条 = 本器自己变成它要防的事故):
 *  - 取票唯一入口 = `plan-tasks.mjs --open --dispatchable --exclude-inflight`(§1 派单口径),
 *    本器不自带第二份"什么算可派"的判据;取不到派单面 ⇒ exit 2 显式「未判定」,不猜。
 *  - 台账只记真工作:本器只记账、不登记(登记属第 1 期 auto-triage,且必须走 live-doc-edit)。
 *  - 闸门配置形状坏 ⇒ exit 2 未判定,绝不回落默认放行(§0.3:没判绝不写成判过)。
 *  - 起会话通路配置化(sessionCommandTemplate):模板为空 ⇒ dry-run,只取票记账,
 *    按同一纪律绝不冒充"执行过"。
 *  - 逃生邮件只走 notify-deploy-failure 唯一出口(§5e / 守门 81 硬拦自拼 SMTP),
 *    60 分钟节流;收件人现值 = apps/api/.env 的 ALERT_EMAIL_TO(git-guardian 同源解析)。
 *  - 预算闸 = 派发轮数 + token 双闸(第 3 期④接入:起会话 CLI `--json` 终态行 usage 计量后
 *    记账,单会话闸 + 近 24 小时闸;量不到 token 的轮只记墙钟并如实告警,不冒充量到)。
 *
 * 用法:
 *   node scripts/auto-evolve.mjs --once        # 真单轮(需 enabled=true)
 *   node scripts/auto-evolve.mjs --dry-run     # 全流程巡检,不派发、不发信
 *   node scripts/auto-evolve.mjs --status      # 现读闸门与台账,打印当前状态
 *   node scripts/auto-evolve.mjs --install-task # 打印 pwsh 计划任务注册命令(本机 schtasks.exe 在程序黑名单)
 *   node scripts/auto-evolve.mjs --self-test   # 内置断言
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, openSync, closeSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { loadCaps, parseLedger, evaluate, chargeLine } from './cost-breaker.mjs'
import { loadHumanGates, summarize as summarizeHumanGates } from './human-gates.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const GATES_JSON = join(ROOT, 'scripts', 'data', 'auto-evolve-gates.json')
/** O6504 人工阀清单 / O6502 成本熔断(调度层读同一份真源,不另写第二份判据) */
const HUMAN_GATES_JSON = join(ROOT, 'scripts', 'data', 'human-gates.json')
const COST_CAPS_JSON = join(ROOT, 'scripts', 'data', 'cost-caps.json')
const COST_LEDGER = join(ROOT, '.ihui-agent', 'state', 'cost-ledger.jsonl')
const LEDGER = join(ROOT, '.ihui-agent', 'state', 'auto-evolve-ledger.jsonl')
const LOCK_FILE = join(ROOT, '.ihui-agent', 'state', 'auto-evolve.lock')
const ESCAPE_TICK = join(ROOT, '.ihui-agent', 'state', 'auto-evolve-escape-tick.json')
const TMP_DIR = join(ROOT, '.ihui-agent', 'tmp', 'auto-evolve')
const PLAN_TASKS = join(ROOT, 'scripts', 'plan-tasks.mjs')
const MAIL_SCRIPT = join(ROOT, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts')
const TSX_ENTRY = join(ROOT, 'apps', 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs')
const API_ENV = join(ROOT, 'apps', 'api', '.env')
/** ihui-cli 登录态(settings.json 的 apiKey 字段;login 同源存放处,同信任级) */
const CLI_SETTINGS = join(process.env.USERPROFILE ?? '', '.ihui', 'settings.json')
/** JWT secret 探测序(机器事实按当次实测取值:运行面部署副本优先,回落仓内副本) */
const JWT_ENV_CANDIDATES = ['D:/DevEnv/ihui-prod/apps/api/.env', API_ENV]
const JWT_TTL_SECONDS = 8 * 3600
/** 取票参数形状(唯一入口,镜像测试钉死此处;第二份拼装即 §22c 反面) */
export const DISPATCH_ARGS = ['--open', '--dispatchable', '--exclude-inflight']
const ESCAPE_MAIL_THROTTLE_MS = 60 * 60 * 1000

export class GateShapeError extends Error {}

/**
 * 闸门配置加载 + 形状锁。形状坏抛 GateShapeError ⇒ main 落 exit 2「未判定」,
 * 绝不回落默认值放行(§0.3)。
 */
export function loadGates(readFile = (p) => readFileSync(p, 'utf8')) {
  let raw
  try {
    raw = readFile(GATES_JSON)
  } catch (e) {
    throw new GateShapeError(`闸门配置读不到(${GATES_JSON}):${e?.message ?? e}`)
  }
  let g
  try {
    g = JSON.parse(raw)
  } catch (e) {
    throw new GateShapeError(`闸门配置不是合法 JSON:${e?.message ?? e}`)
  }
  const needBool = ['enabled']
  const needPosInt = ['dailyDispatchBudget', 'failureStreakLimit', 'quarantineHours', 'maxSessionMinutes']
  for (const k of needBool) {
    if (typeof g[k] !== 'boolean') throw new GateShapeError(`闸门形状坏:${k} 必须是 boolean`)
  }
  for (const k of needPosInt) {
    if (!Number.isInteger(g[k]) || g[k] <= 0) throw new GateShapeError(`闸门形状坏:${k} 必须是正整数`)
  }
  if (g.failureStreakLimit < 2) throw new GateShapeError('闸门形状坏:failureStreakLimit 至少为 2(=1 时首败即封票,误伤面过大)')
  if (!Array.isArray(g.ticketWhitelist) || g.ticketWhitelist.length === 0) {
    throw new GateShapeError('闸门形状坏:ticketWhitelist 必须是非空数组(第一期靠白名单兜底,不许全放行)')
  }
  for (const p of g.ticketWhitelist) {
    if (typeof p !== 'string' || !p.trim()) throw new GateShapeError('闸门形状坏:ticketWhitelist 出现非字符串/空白项')
  }
  if (typeof g.sessionCommandTemplate !== 'string') {
    throw new GateShapeError('闸门形状坏:sessionCommandTemplate 必须是字符串(空串 = dry-run 档)')
  }
  return g
}

/**
 * 票键 = 去登记前缀/注记/租约牌后的标题指纹(同票跨会话识别;不按行号,行号一次 append 就挪位)。
 * 租约牌只剥「进行中@」形态(claimMarkOf 同族口径),标题内部普通括号不剥;
 * 误差方向刻意设计成"两形态算两票"(多派一次有白名单/预算兜着)而不是"两票合一"(漏派)。
 */
export function ticketKeyOf(rowText) {
  const stripped = String(rowText)
    .replace(/^[-*]\s*\[[ x]\]\s*/, '')
    .replace(/^（进行中@[^）]*）\s*/, '')
    .replace(/（进行中@[^）]*）\s*$/, '')
    .replace(/〔[^〕]*〕/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return createHash('sha256').update(stripped).digest('hex').slice(0, 16)
}

/**
 * 白名单判定:只匹配**标题区**(第一个 `**…**` 加粗段;无加粗段 ⇒ 行首前 60 字),
 * 不匹配全文 —— 实测(2026-10-25 --once 真派)第 3 期票的**正文**含"依赖升级"就命中了,
 * 而它的标题"第 3 期·进化回流"根本不是白名单票类。宽匹配 = 大工程票被误派。
 */
export function matchWhitelist(rowText, patterns) {
  const m = /\*\*([^*]+)\*\*/.exec(String(rowText))
  const hay = (m ? m[1] : String(rowText).slice(0, 60)).toLowerCase()
  return patterns.some((p) => hay.includes(String(p).toLowerCase()))
}

/**
 * 解析 plan-tasks 派单面输出:只认「判定面」标记之后的 `  L<行号>  - [ ] …` 登记行,
 * 元信息行(--exclude-inflight 摘除/惰判/剔除统计)一律忽略。
 */
export function parseTicketRows(stdout) {
  const text = String(stdout ?? '')
  const marker = text.lastIndexOf('判定面')
  const face = marker >= 0 ? text.slice(marker) : text
  const rows = []
  for (const line of face.split(/\r?\n/)) {
    const m = /^\s*L(\d+)\s+- \[ \](.*)$/.exec(line)
    if (m) rows.push({ line: Number(m[1]), text: m[2].trim() })
  }
  return rows
}

/** {promptFile}/{ticketLine}/{ticketKey} 占位填充;未知占位原样保留(不猜) */
export function fillTemplate(tpl, { promptFile, ticketLine, ticketKey }) {
  return String(tpl)
    .replaceAll('{promptFile}', promptFile ?? '')
    .replaceAll('{ticketLine}', ticketLine ?? '')
    .replaceAll('{ticketKey}', ticketKey ?? '')
}

/**
 * 起会话 token 计量(第 3 期④):唯一可信取数口 = CLI `--json` 事件流的终态行
 * `{"type":"complete",…,"usage":{promptTokens,completionTokens,totalTokens,estimatedCostUsd}}`
 * (会话文件不落 usage,文本模式只有人读排版)。
 * 取最后一个 complete 行;没读到 / 字段坏 ⇒ measured:false —— 不把"量不到"读成 0。
 */
export function parseSessionUsage(stdout) {
  const lines = String(stdout ?? '').split(/\r?\n/)
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].trim()
    if (!t.startsWith('{')) continue
    let e
    try {
      e = JSON.parse(t)
    } catch {
      continue
    }
    if (e?.type !== 'complete') continue
    const total = Number(e?.usage?.totalTokens)
    if (!Number.isFinite(total) || total < 0) return { tokens: 0, costUsd: 0, measured: false }
    const cost = Number(e?.usage?.estimatedCostUsd)
    return {
      tokens: Math.floor(total),
      costUsd: Number.isFinite(cost) && cost > 0 ? cost : 0,
      measured: true,
    }
  }
  return { tokens: 0, costUsd: 0, measured: false }
}

function todayKey(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function readLedger() {
  try {
    return readFileSync(LEDGER, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l)
        } catch {
          return null
        }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

function record(entry) {
  mkdirSync(dirname(LEDGER), { recursive: true })
  appendFileSync(LEDGER, `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`, 'utf8')
}

/** 同票连败计数:该 key 最近连续的 session-failed/session-timeout 条数(遇到任何其他 action 打断) */
export function failureStreakOf(ledger, key) {
  let n = 0
  for (let i = ledger.length - 1; i >= 0; i--) {
    const e = ledger[i]
    if (e.ticketKey !== key) continue
    if (e.action === 'session-failed' || e.action === 'session-timeout') n++
    else break
  }
  return n
}

/** 封票到期时刻(未封 = null):该 key 最近一条 quarantined 的 until */
export function quarantinedUntilOf(ledger, key, now = Date.now()) {
  for (let i = ledger.length - 1; i >= 0; i--) {
    const e = ledger[i]
    if (e.ticketKey === key && e.action === 'quarantined') {
      const until = Date.parse(e.until)
      if (Number.isFinite(until) && until > now) return until
      return null
    }
  }
  return null
}

export function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e?.code === 'EPERM'
  }
}

/**
 * 手写 HS256 JWT(零依赖;与 packages/auth/src/jwt.ts 同形:sub=userId、iss/aud、HS256)。
 * 关键判据(实测 2026-10-25):verifyAccessToken 强制要求 **sub** claim(缺 ⇒ 401 且文案被
 * 错误目录吞成"提交的信息有误"),签发侧 setSubject(userId) 这一步不能少。
 * roleId 恒 0(最小权限;校验只认 sub,角色 claim 只是 RBAC 装饰)。
 */
export function signSessionJwt(secret, { userId, ttlSeconds = JWT_TTL_SECONDS, now = Math.floor(Date.now() / 1000) }) {
  const b64u = (b) => Buffer.from(b).toString('base64url')
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64u(
    JSON.stringify({ sub: userId, userId, phone: '', familyId: randomUUID(), roleId: 0, iat: now, iss: 'ihui-ai', aud: 'ihui-ai-users', exp: now + ttlSeconds })
  )
  const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

function resolveJwtSecret() {
  for (const p of JWT_ENV_CANDIDATES) {
    try {
      const m = /^JWT_SECRET=(.+)$/m.exec(readFileSync(p, 'utf8'))
      if (m && m[1].trim().length >= 32) return { secret: m[1].trim(), from: p }
    } catch {
      /* 候选不在位 ⇒ 试下一个 */
    }
  }
  return null
}

/**
 * 派发前供值:现签短命 JWT 写进 ihui-cli 登录态(settings.json 的 apiKey 字段,
 * login 同源存放处)。凭据全程只在内存与该机器态文件,终端零输出(不入聊天不入日志)。
 * secret 探测不到 ⇒ 返回 { ok:false },调用方落「未判定」不派发。
 */
export async function mintSessionCredential({ userId, writeSettings = (jwt) => writeCliSettingsJwt(jwt) } = {}) {
  const found = resolveJwtSecret()
  if (!found) return { ok: false, why: 'JWT_SECRET 探测不到(候选 .env 均缺或强度不足)' }
  const uid = userId ?? (await resolveMachineUserId())
  if (!uid) return { ok: false, why: '机器账号 userId 取不到(库查不到或连接失败)' }
  writeSettings(signSessionJwt(found.secret, { userId: uid }))
  return { ok: true, from: found.from }
}

function writeCliSettingsJwt(jwt) {
  const s = JSON.parse(readFileSync(CLI_SETTINGS, 'utf8'))
  s.apiKey = jwt
  writeFileSync(CLI_SETTINGS, JSON.stringify(s, null, 2), 'utf8')
}

/**
 * 机器账号 userId 现读:users 表 role 最高的首个账号(只读 SELECT,每轮现读不缓存)。
 * 连接串走候选 .env 同源;查不到 ⇒ null(调用方落未判定)。
 */
async function resolveMachineUserId() {
  for (const envPath of JWT_ENV_CANDIDATES) {
    try {
      const m = /^DATABASE_URL=(.+)$/m.exec(readFileSync(envPath, 'utf8'))
      if (!m) continue
      const { createRequire } = await import('node:module')
      const postgres = createRequire(join(ROOT, 'apps', 'api', 'package.json'))('postgres')
      const sql = postgres(m[1].trim())
      try {
        const rows = await sql.unsafe('SELECT id FROM users ORDER BY role_id DESC, created_at ASC LIMIT 1')
        const id = rows[0]?.id
        if (typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id)) return id
        return null
      } finally {
        await sql.end({ timeout: 5 })
      }
    } catch {
      /* 该候选连接失败 ⇒ 试下一个;都失败落 null */
    }
  }
  return null
}

/** 收件人现值 = apps/api/.env 的 ALERT_EMAIL_TO(git-guardian 同源;缺键 ⇒ 告警链不判死,只不发) */
function resolveMailTo(envFile = API_ENV) {
  const fromEnv = String(process.env.ALERT_EMAIL_TO || '').trim()
  if (fromEnv) return fromEnv
  try {
    const m = /^\s*ALERT_EMAIL_TO\s*=\s*(.+?)\s*$/.exec(readFileSync(envFile, 'utf8'))
    return m ? m[1].trim() : ''
  } catch {
    return ''
  }
}

function escapeThrottled(now = Date.now()) {
  try {
    const last = JSON.parse(readFileSync(ESCAPE_TICK, 'utf8')).at
    return now - Number(last) < ESCAPE_MAIL_THROTTLE_MS
  } catch {
    return false
  }
}

function markEscape(now = Date.now()) {
  mkdirSync(dirname(ESCAPE_TICK), { recursive: true })
  writeFileSync(ESCAPE_TICK, JSON.stringify({ at: now }), 'utf8')
}

/**
 * 逃生邮件:只经 notify-deploy-failure 唯一出口(守门 81);出口不在位/无收件人 ⇒ 打印并
 * 落「未判定」返回 false,绝不冒充已发(§0.3)。
 */
function sendEscapeMail(gates, alertId, title, bodyText) {
  const to = resolveMailTo()
  if (!to) {
    console.error('⚠️ 逃生邮件未判定:apps/api/.env 缺 ALERT_EMAIL_TO(§5e 告警链排除),现场已落台账')
    return false
  }
  if (!existsSync(TSX_ENTRY) || !existsSync(MAIL_SCRIPT)) {
    console.error(`⚠️ 逃生邮件未判定:出口不在位(tsx=${existsSync(TSX_ENTRY)} script=${existsSync(MAIL_SCRIPT)})`)
    return false
  }
  mkdirSync(TMP_DIR, { recursive: true })
  const msgFile = join(TMP_DIR, `escape-${Date.now()}.md`)
  writeFileSync(msgFile, bodyText, 'utf8')
  const r = spawnSync(
    process.execPath,
    [
      TSX_ENTRY,
      MAIL_SCRIPT,
      '--to',
      to,
      '--title',
      title,
      '--severity',
      'warning',
      '--source',
      'auto-evolve',
      '--alert-id',
      alertId,
      '--message-file',
      msgFile,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], cwd: ROOT, windowsHide: true, timeout: 60_000, encoding: 'utf8' }
  )
  try {
    unlinkSync(msgFile)
  } catch {
    /* 用完即删,删不掉不遮蔽主流程 */
  }
  if (r.status !== 0) {
    console.error(`⚠️ 逃生邮件投递失败(status=${r.status}):${String(r.stderr ?? '').slice(-200)}`)
    return false
  }
  return true
}

function acquireLock() {
  mkdirSync(dirname(LOCK_FILE), { recursive: true })
  let fd
  try {
    fd = openSync(LOCK_FILE, 'wx')
  } catch {
    // 锁在:判持锁 pid 是否还活着;死锁(进程不在)才抢占,活锁让路
    try {
      const { pid } = JSON.parse(readFileSync(LOCK_FILE, 'utf8'))
      if (isPidAlive(pid)) return { held: true, pid }
    } catch {
      /* 锁文件坏 = 无有效持有者,抢 */
    }
    try {
      unlinkSync(LOCK_FILE)
    } catch {
      /* 抢不掉就当让路 */
      return { held: true, pid: null }
    }
    return acquireLock()
  }
  writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }), 'utf8')
  closeSync(fd)
  return { held: false }
}

function releaseLock() {
  try {
    unlinkSync(LOCK_FILE)
  } catch {
    /* 已被下一轮抢占清理 */
  }
}

function pickTickets() {
  const r = spawnSync(process.execPath, [PLAN_TASKS, ...DISPATCH_ARGS], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    windowsHide: true,
    timeout: 120_000,
    encoding: 'utf8',
  })
  if (r.error) throw new Error(`派单面取不到:${r.error.message}`)
  const rows = parseTicketRows(r.stdout)
  if (rows.length === 0 && r.status !== 0) {
    throw new Error(`派单面未判定(status=${r.status}):${String(r.stderr ?? r.stdout ?? '').slice(-300)}`)
  }
  return rows
}

function dispatchSession(gates, ticket, dryRun) {
  const key = ticketKeyOf(ticket.text)
  if (!gates.sessionCommandTemplate.trim()) {
    return { action: 'template-empty', why: 'sessionCommandTemplate 未配置 ⇒ 本轮只取票记账,不冒充执行(§0.3)' }
  }
  if (dryRun) return { action: 'dryrun-ticket', why: 'dry-run 不真派' }
  mkdirSync(TMP_DIR, { recursive: true })
  const promptFile = join(TMP_DIR, `prompt-${key}-${Date.now()}.md`)
  writeFileSync(
    promptFile,
    [
      `# 派发票(auto-evolve 单轮)`,
      ``,
      `- 票面:${ticket.text}`,
      `- 台账行:L${ticket.line}(PROJECT_PLAN.md,行号会漂移,以题面定位)`,
      ``,
      `按 AGENTS.md 全部强制条款执行本票;只 add 本任务文件;走 safe-commit 五步法;`,
      `提交时绑票键(决策链审计口):PowerShell 先 $env:IHUI_TICKET_KEY='${key}';`,
      `$env:IHUI_TICKET_LINE='<票面前 120 字>';再跑 safe-commit —— 审计器靠它把提交接回本票。`,
      `验证齐绿(typecheck/test/守门末行现读)后才可声明完成;完成即翻勾。`,
      ``,
      `完成判定(硬性,防半成品):`,
      `- 要么完成整票(验证齐绿 + 翻勾 + 提交推送),要么保持未勾并走 live-doc-edit 在票行追加进展注记,禁止"写完了你看下"式半成品提交。`,
      `- 若判定本票工作量超出单会话预算(maxSessionMinutes=${gates.maxSessionMinutes} 分钟),立即停下:不写任何代码,只在票行追加工作量评估注记后正常退出(这是合法完成,不算失败)。`,
    ].join('\n'),
    'utf8'
  )
  const cmd = fillTemplate(gates.sessionCommandTemplate, { promptFile, ticketLine: ticket.text, ticketKey: key })
  const t0 = Date.now()
  // windowsVerbatimArguments 必带(同 probe:node 对 cmd.exe 的默认引用改写会毁模板内引号)
  const r = spawnSync('cmd.exe', ['/d', '/s', '/c', cmd], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    windowsHide: true,
    windowsVerbatimArguments: true,
    timeout: gates.maxSessionMinutes * 60_000,
    encoding: 'utf8',
  })
  try {
    unlinkSync(promptFile)
  } catch {
    /* 用完即删 */
  }
  const durationMs = Date.now() - t0
  // 第 3 期④:token 计量与成败判定分开取 —— 失败/超时的轮也可能有过 usage,能记就记。
  const meter = parseSessionUsage(r.stdout)
  const tokens = meter.measured ? meter.tokens : null
  const tokensMeasured = meter.measured
  const costUsd = meter.costUsd
  if (r.error?.killed || (r.signal === 'SIGTERM' && durationMs >= gates.maxSessionMinutes * 60_000 - 5_000)) {
    return { action: 'session-timeout', exitCode: null, durationMs, why: `超过 maxSessionMinutes=${gates.maxSessionMinutes}`, tokens, tokensMeasured, costUsd }
  }
  if (r.error) return { action: 'session-failed', exitCode: null, durationMs, why: r.error.message, tokens, tokensMeasured, costUsd }
  if (r.status !== 0) {
    return { action: 'session-failed', exitCode: r.status, durationMs, why: `exit=${r.status} ${String(r.stderr ?? '').slice(-200)}`, tokens, tokensMeasured, costUsd }
  }
  return { action: 'session-ok', exitCode: 0, durationMs, why: '', tokens, tokensMeasured, costUsd }
}

async function runOnce({ dryRun = false } = {}) {
  let gates
  try {
    gates = loadGates()
  } catch (e) {
    console.error(`❌ 未判定:${e.message}`)
    process.exitCode = 2
    return
  }
  if (!gates.enabled && !dryRun) {
    console.log('⏸ 调度未启用(gates.enabled=false);观察期请用 --dry-run 巡检。不派发、不记派发账。')
    return
  }
  // ---- O6504 人工阀清单前置读 + O6502 成本熔断前置闸(2026-10-25 立,二者均 fail-closed)----
  // 清单读不到/形状坏 ⇒ exit 2 未判定,绝不回落成"没有人工阀"(§0.3)。
  let humanGates
  let costCaps
  try {
    humanGates = loadHumanGates(readFileSync(HUMAN_GATES_JSON, 'utf8'))
    costCaps = loadCaps(readFileSync(COST_CAPS_JSON, 'utf8'))
  } catch (e) {
    console.error(`❌ 未判定:人工阀/成本配置读不到或形状坏(${e.message})⇒ 本轮不派发`)
    process.exitCode = 2
    return
  }
  if (!dryRun) {
    const costEvents = existsSync(COST_LEDGER) ? parseLedger(readFileSync(COST_LEDGER, 'utf8')) : []
    let cost
    try {
      cost = evaluate({ caps: costCaps, events: costEvents, kind: 'session' })
    } catch (e) {
      console.error(`❌ 未判定:成本熔断判不了(${e.message})⇒ 本轮不派发`)
      process.exitCode = 2
      return
    }
    if (!cost.allowed) {
      const summary = `sessions 近1h=${cost.used.hour} 近24h=${cost.used.day} 墙钟=${cost.used.minutesDay.toFixed(1)}min tokens 近1h=${cost.used.tokensHour} 近24h=${cost.used.tokensDay} 单会话峰值=${cost.used.maxTokens}`
      record({ mode: 'dispatch', action: 'budget-exhausted', note: summary })
      console.log(`⏸ 成本熔断:${cost.breaches.join(';')} ⇒ 本轮停转(软停机)`)
      if (!escapeThrottled()) {
        markEscape()
        sendEscapeMail(gates, 'auto-evolve:cost', '[auto-evolve] 成本熔断停转', `调度层会话额度越限:${cost.breaches.join(';')}(${summary})。停派至窗口回落;放量属人工阀 budget-cap-change,须人改 scripts/data/cost-caps.json。`)
      }
      return
    }
  }
  const gateCounts = summarizeHumanGates(humanGates).counts
  console.log(`🛡 人工阀清单:自决 ${gateCounts.autonomous} 条 / 停机等人 ${gateCounts.gates} 条(命中即安全停机,不重试不绕行)`)
  const lock = acquireLock()
  if (lock.held) {
    console.log(`⏭ 上一轮仍在跑(pid=${lock.pid ?? '?'})⇒ 本轮让路(单实例闸)`)
    return
  }
  try {
    const rows = pickTickets()
    const ledger = readLedger()
    let dispatched = 0
    for (const e of ledger) {
      if (e.action === 'dispatched' && String(e.ts ?? '').startsWith(todayKey())) dispatched++
    }
    const summary = `派单面现读 ${rows.length} 行 / 今日已派 ${dispatched}/${gates.dailyDispatchBudget} 轮`
    if (rows.length === 0) {
      record({ mode: dryRun ? 'dryrun' : 'dispatch', action: 'no-ticket', note: summary })
      console.log(`✅ ${summary} ⇒ 无票可派,本轮结束`)
      return
    }
    if (dispatched >= gates.dailyDispatchBudget) {
      record({ mode: dryRun ? 'dryrun' : 'dispatch', action: 'budget-exhausted', note: summary })
      console.log(`⏸ ${summary} ⇒ 预算耗尽,停派`)
      if (!dryRun && !escapeThrottled()) {
        markEscape()
        sendEscapeMail(gates, 'auto-evolve:budget', '[auto-evolve] 每日派发预算耗尽', `今日已派 ${dispatched} 轮达上限 ${gates.dailyDispatchBudget}。调度器自动停派至明日;若需放量改 auto-evolve-gates.json 的 dailyDispatchBudget。`)
      }
      return
    }
    for (const ticket of rows) {
      const key = ticketKeyOf(ticket.text)
      const qUntil = quarantinedUntilOf(ledger, key)
      if (qUntil) {
        console.log(`⏭ L${ticket.line} 封禁中(至 ${new Date(qUntil).toISOString()})⇒ 跳过`)
        continue
      }
      if (!matchWhitelist(ticket.text, gates.ticketWhitelist)) {
        console.log(`⏭ L${ticket.line} 未命中票类白名单 ⇒ 跳过(第一期保守起步)`)
        continue
      }
      if (dispatched >= gates.dailyDispatchBudget) {
        console.log(`⏸ 预算耗尽(本轮中)⇒ 停派`)
        break
      }
      console.log(`→ L${ticket.line} 命中白名单,进入派发闸`)
      if (!dryRun) {
        const mint = await mintSessionCredential()
        if (!mint.ok) {
          record({ mode: 'dispatch', action: 'mint-failed', ticketKey: key, ticketLine: ticket.text.slice(0, 200), why: mint.why })
          console.error(`❌ 未判定:${mint.why} ⇒ 本轮不派发(凭据供值失败,不冒充执行)`)
          process.exitCode = 2
          return
        }
      }
      const res = dispatchSession(gates, ticket, dryRun)
      record({ mode: dryRun ? 'dryrun' : 'dispatch', action: res.action, ticketKey: key, ticketLine: ticket.text.slice(0, 200), exitCode: res.exitCode ?? null, durationMs: res.durationMs ?? null, tokens: res.tokens ?? null, tokensMeasured: res.tokensMeasured === true, costUsd: res.costUsd ?? null, why: res.why ?? '' })
      // O6502 记账腿:只有真派(非 dry-run)且拿到墙钟才进账;记不进去就如实告警,不冒充"额度还够"。
      // 第 3 期④:量到 token 就一并记账(单会话闸 + 24 小时闸的取数口);量不到只记墙钟并留响声。
      if (!dryRun && Number.isFinite(res.durationMs) && res.durationMs > 0) {
        try {
          mkdirSync(dirname(COST_LEDGER), { recursive: true })
          appendFileSync(
            COST_LEDGER,
            chargeLine({
              kind: 'session',
              minutes: Number((res.durationMs / 60000).toFixed(2)),
              tokens: res.tokensMeasured === true ? res.tokens : undefined,
              note: `auto-evolve ${res.action}`,
            }),
            'utf8'
          )
        } catch (e) {
          console.error(`⚠ 成本记账失败(本轮照常收尾,但下一轮判据可能偏松):${e.message}`)
        }
        if (res.tokensMeasured !== true) {
          console.error('⚠ token 计量未判定(终态行无 usage:超时/被杀/非 json 通路)⇒ 本轮只记墙钟,不虚记 token 额度')
        }
      }
      if (res.action === 'template-empty') {
        console.log(`ℹ ${res.why}`)
        return
      }
      if (dryRun) {
        console.log(`✅ dry-run 记账完成(不真派)`)
        return
      }
      dispatched++
      if (res.action === 'session-failed' || res.action === 'session-timeout') {
        const streak = failureStreakOf(readLedger(), key)
        if (streak >= gates.failureStreakLimit) {
          const until = new Date(Date.now() + gates.quarantineHours * 3600_000).toISOString()
          record({ mode: 'dispatch', action: 'quarantined', ticketKey: key, ticketLine: ticket.text.slice(0, 200), until, why: `连败 ${streak} 次(阈值 ${gates.failureStreakLimit})` })
          console.log(`⛔ 同票连败 ${streak} 次 ⇒ 封禁至 ${until}`)
          if (!escapeThrottled()) {
            markEscape()
            sendEscapeMail(gates, `auto-evolve:quarantine:${key.slice(0, 8)}`, '[auto-evolve] 票被自动封禁', `票:L${ticket.line} ${ticket.text.slice(0, 120)}\n连败 ${streak} 次(阈值 ${gates.failureStreakLimit}),自动封禁至 ${until}。封禁明细与连败原因见 ${LEDGER};解封等 until 到期或人工摘除 quarantined 行。`)
          }
        }
        return
      }
      console.log(`✅ 派发完成(action=${res.action},耗时 ${(res.durationMs / 1000).toFixed(1)}s)`)
      return
    }
    console.log('ℹ 候选行全部未命中白名单或在封 ⇒ 本轮无派发')
    record({ mode: dryRun ? 'dryrun' : 'dispatch', action: 'no-whitelist-hit', note: summary })
  } finally {
    releaseLock()
  }
}

/**
 * 通路自检(--probe):不经取票,起一个只读会话跑内置自检并要求原样报告末行。
 * 判据 = CLI stdout 含 `"stopReason":"end_turn"`(事件流终态),不猜、不把超时/报错读成通过。
 * 这是调度器的健康信号:enabled=true 后每轮派发前置一个 probe,probe 不过 ⇒ 不派真票。
 */
async function probeSession({ gates, dryRun = false } = {}) {
  const lock = acquireLock()
  if (lock.held) {
    console.log(`⏭ 上一轮仍在跑(pid=${lock.pid ?? '?'})⇒ probe 让路`)
    return
  }
  try {
    const mint = dryRun ? { ok: true } : await mintSessionCredential()
    if (!mint.ok) {
      record({ mode: 'probe', action: 'probe-fail', why: `凭据供值失败:${mint.why}` })
      console.error(`❌ 未判定:${mint.why}`)
      process.exitCode = 2
      return
    }
    mkdirSync(TMP_DIR, { recursive: true })
    const promptFile = join(TMP_DIR, `probe-${Date.now()}.md`)
    writeFileSync(
      promptFile,
      ['只读自检任务(禁止创建或修改任何文件):', '', '运行 `node scripts/auto-evolve.mjs --self-test`,', '然后原样报告其输出的最后一行(形如 "self-test: 全绿" 或 "self-test: N 例红")。'].join('\n'),
      'utf8'
    )
    const cmd = fillTemplate(gates.sessionCommandTemplate, { promptFile, ticketLine: 'probe 自检', ticketKey: 'probe' })
    const t0 = Date.now()
    // windowsVerbatimArguments 必带:node 对 cmd.exe 有默认引用改写,会把模板里的引号拼进
    // 模块路径(实测 'D:\IHUI-AI\"D:\...\"' 型报错);verbatim + 模板零内嵌引号 = 双保险
    const r = spawnSync('cmd.exe', ['/d', '/s', '/c', cmd], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: ROOT,
      windowsHide: true,
      windowsVerbatimArguments: true,
      timeout: gates.maxSessionMinutes * 60_000,
      encoding: 'utf8',
    })
    try {
      unlinkSync(promptFile)
    } catch {
      /* 用完即删 */
    }
    const durationMs = Date.now() - t0
    const passed = r.status === 0 && String(r.stdout ?? '').includes('"stopReason":"end_turn"') && String(r.stdout ?? '').includes('self-test: 全绿')
    record({ mode: 'probe', action: passed ? 'probe-ok' : 'probe-fail', exitCode: r.status ?? null, durationMs, why: passed ? '' : `status=${r.status} stdout 尾部=${String(r.stdout ?? '').slice(-160)}` })
    console.log(passed ? `✅ probe 通过(${(durationMs / 1000).toFixed(1)}s)⇒ 起会话通路健康` : `❌ probe 未通过(status=${r.status})⇒ 记台账 probe-fail`)
    if (!passed) process.exitCode = 1
  } finally {
    releaseLock()
  }
}

function printStatus() {
  let gates
  try {
    gates = loadGates()
  } catch (e) {
    console.error(`❌ 未判定:${e.message}`)
    process.exitCode = 2
    return
  }
  const ledger = readLedger()
  const today = todayKey()
  const dispatched = ledger.filter((e) => e.action === 'dispatched' && String(e.ts ?? '').startsWith(today)).length
  const quarantined = []
  for (const e of ledger) {
    if (e.action !== 'quarantined') continue
    const until = Date.parse(e.until)
    if (Number.isFinite(until) && until > Date.now()) quarantined.push({ key: e.ticketKey, until: e.until, line: e.ticketLine })
  }
  console.log(`闸门:enabled=${gates.enabled} 预算 ${dispatched}/${gates.dailyDispatchBudget} 轮(今日) 连败阈值 ${gates.failureStreakLimit} 封禁 ${gates.quarantineHours}h 会话上限 ${gates.maxSessionMinutes}min`)
  console.log(`起会话通路:${gates.sessionCommandTemplate.trim() ? '已配置' : '未配置(空 ⇒ 只 dry-run,不冒充执行)'}`)
  console.log(`白名单(${gates.ticketWhitelist.length}):${gates.ticketWhitelist.join(' / ')}`)
  // O6504 / O6502 现读:调度层真的把这两份清单读进来了,而不是只写在文档里。
  try {
    const hg = summarizeHumanGates(loadHumanGates(readFileSync(HUMAN_GATES_JSON, 'utf8')))
    console.log(`人工阀:自决 ${hg.counts.autonomous} 条 / 停机等人 ${hg.counts.gates} 条(${hg.gates.map((g) => g.id).join(' / ')})`)
  } catch (e) {
    console.log(`人工阀:❌ 未判定(${e.message})`)
  }
  try {
    const caps = loadCaps(readFileSync(COST_CAPS_JSON, 'utf8'))
    const events = existsSync(COST_LEDGER) ? parseLedger(readFileSync(COST_LEDGER, 'utf8')) : []
    const c = evaluate({ caps, events, kind: 'session' })
    console.log(`成本熔断(session):近1h ${c.used.hour}/${c.caps.perHour ?? '-'} 次 近24h ${c.used.day}/${c.caps.perDay ?? '-'} 次 墙钟 ${c.used.minutesDay.toFixed(1)}/${c.caps.minutesPerDay ?? '-'} 分钟 tokens 近1h ${c.used.tokensHour}/${c.caps.tokensPerHour ?? '-'} 近24h ${c.used.tokensDay}/${c.caps.tokensPerDay ?? '-'} 单会话峰值 ${c.used.maxTokens}/${c.caps.tokensPerSession ?? '-'} ⇒ ${c.allowed ? '放行' : '停转'}`)
  } catch (e) {
    console.log(`成本熔断:❌ 未判定(${e.message})`)
  }
  console.log(`当前封票:${quarantined.length === 0 ? '无' : ''}`)
  for (const q of quarantined) console.log(`  - ${q.key} 至 ${q.until} :: ${q.line}`)
  console.log(`台账最近 5 条:`)
  for (const e of ledger.slice(-5)) console.log(`  ${e.ts} ${e.mode}/${e.action}${e.why ? ` :: ${e.why}` : ''}`)
}

/**
 * 计划任务注册(--install-task [--apply])。
 *
 * 本机实测四条通道的结论(2026-10-25,全部现跑取值):
 *  ① schtasks.exe 在 ZCode 宿主程序黑名单(spawn 它会带走本进程)——死路;
 *  ② ScheduledTasks cmdlet 模块本机整体缺失(System32\Modules 与 pwsh7\Modules 均无)——死路;
 *  ③ Schedule.Service COM + **S4U LogonType(5)**:pwsh7 与 5.1 同报 "(49,4):Task:"(80041318),
 *     UserId 换 SID / DOMAIN\user 两形态都一样 ⇒ S4U 在本机 COM 通道死路;
 *  ④ Schedule.Service COM + **InteractiveToken(3)**:✅ 成功(STATE=3 READY 回读验证)。
 * 差异只有 LogonType ⇒ 器物定档 InteractiveToken:任务跑在交互会话(用户不登录则不跑,
 * 本机为常登工作站可接受),窗口风险由派生进程 windowsHide 全覆盖顶住。
 * 差异化教训:别把"S4U 是 guardian 的正确形态"当成"本机 S4U 可用"——同一 COM 接口,
 * LogonType 一格之差就是成与败,凡机器事实按当次实测取值(§0)。
 * 幂等:RegisterTaskDefinition flag 6 = TASK_CREATE_OR_UPDATE,重复执行安全。
 */
function buildInstallTaskPs1() {
  const BS = String.fromCharCode(92)
  return [
    '$ErrorActionPreference = "Stop"',
    '$svc = New-Object -ComObject Schedule.Service',
    '$svc.Connect()',
    '$folder = $svc.GetFolder("\\")',
    '$def = $svc.NewTask(0)',
    '$trig = $def.Triggers.Create(9)',
    '$trig.StartBoundary = (Get-Date).AddMinutes(10).ToString("yyyy-MM-ddTHH:mm:ss")',
    '$trig.Repetition.Interval = "PT1H"',
    '$trig.Repetition.Duration = "P3650D"',
    '$trig.Enabled = $true',
    '$act = $def.Actions.Create(0)',
    `$act.Path = "node.exe"`,
    `$act.Arguments = "scripts/auto-evolve.mjs --once"`,
    `$act.WorkingDirectory = "${ROOT.replace(/\//g, BS)}"`,
    `$def.Principal.UserId = "${[process.env.USERDOMAIN ?? '', process.env.USERNAME ?? ''].join(BS)}"`,
    '$def.Principal.LogonType = 3',
    '$folder.RegisterTaskDefinition("IHUI-AI auto-evolve", $def, 6, $null, $null, 3) | Out-Null',
    '$t = $folder.GetTask("IHUI-AI auto-evolve")',
    'Write-Output ("STATE=" + $t.State + " INTERVAL=" + $t.Definition.Triggers.Item(1).Repetition.Interval + " CMD=" + $t.Definition.Actions.Item(1).Arguments)',
  ].join('\r\n')
}

function installTask({ apply = false } = {}) {
  mkdirSync(TMP_DIR, { recursive: true })
  const ps1 = join(TMP_DIR, 'register-auto-evolve-task.ps1')
  writeFileSync(ps1, buildInstallTaskPs1(), 'utf8')
  if (!apply) {
    console.log(`注册脚本已生成:${ps1}(InteractiveToken 档,每小时;--apply 执行真注册)`)
    return
  }
  const PS51 = 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'
  if (!existsSync(PS51)) {
    console.error('❌ 未判定:Windows PowerShell 5.1 不在位(注册通道的唯一可用宿主)')
    process.exitCode = 2
    return
  }
  const r = spawnSync(PS51, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ps1], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    windowsHide: true,
    timeout: 90_000,
    encoding: 'utf8',
  })
  const out = String(r.stdout ?? '')
  if (r.status === 0 && /STATE=3\s+INTERVAL=PT1H/.test(out)) {
    console.log(`✅ 计划任务已注册(IHUI-AI auto-evolve,每小时,InteractiveToken):${out.trim()}`)
    record({ mode: 'install', action: 'task-registered', why: out.trim() })
  } else {
    console.error(`❌ 注册未判定(status=${r.status}):${(String(r.stderr ?? '')).slice(-200) || out.slice(-200)}`)
    process.exitCode = 2
  }
}

function selfTest() {
  let failed = 0
  const ok = (name, cond) => {
    if (cond) console.log(`  ✅ ${name}`)
    else {
      console.error(`  ❌ ${name}`)
      failed++
    }
  }
  console.log('self-test:')
  // S1 形状锁(成对:好配置过 / 坏配置抛)
  ok('S1a 形状锁:合法配置通过', (() => { try { return loadGates(() => JSON.stringify({ enabled: false, dailyDispatchBudget: 6, failureStreakLimit: 3, quarantineHours: 48, maxSessionMinutes: 45, sessionCommandTemplate: '', ticketWhitelist: ['readme'] })).enabled === false } catch { return false } })())
  ok('S1b 形状锁:缺白名单抛 GateShapeError', (() => { try { loadGates(() => '{}'); return false } catch (e) { return e instanceof GateShapeError } })())
  ok('S1c 形状锁:非法 JSON 抛 GateShapeError', (() => { try { loadGates(() => 'not-json'); return false } catch (e) { return e instanceof GateShapeError } })())
  ok('S1d 形状锁:failureStreakLimit=1 拒(首败即封误伤)', (() => { try { loadGates(() => JSON.stringify({ enabled: true, dailyDispatchBudget: 1, failureStreakLimit: 1, quarantineHours: 1, maxSessionMinutes: 1, sessionCommandTemplate: '', ticketWhitelist: ['x'] })); return false } catch { return true } })())
  // S2 白名单
  ok('S2a 白名单命中(标题区)', matchWhitelist('**README 数字收尾** 同步四语', ['readme']) === true)
  ok('S2b 白名单不命中(标题无关)', matchWhitelist('**重构鉴权中间件** 参考 readme 格式', ['readme', '文档']) === false, )
  ok('S2c 白名单只看标题不进正文(实测缺口回归)', matchWhitelist('**第 3 期·进化回流**:失败票归因沉淀;pnpm 依赖升级自动生成票', ['依赖升级']) === false)
  ok('S2d 无加粗段回落前 60 字', matchWhitelist('- [ ] 补 README 数字对齐说明,其余正文很长很长很长很长很长很长', ['readme']) === true)
  // S3 票键与连败
  const k1 = ticketKeyOf('- [ ] 修 README 数字 〔注记〕')
  const k2 = ticketKeyOf('修 README 数字')
  ok('S3a 票键跨前缀/注记等值', k1 === k2 && k1.length === 16)
  const streakLedger = [
    { ticketKey: 'k', action: 'dispatched' },
    { ticketKey: 'k', action: 'session-failed' },
    { ticketKey: 'other', action: 'session-failed' },
    { ticketKey: 'k', action: 'session-failed' },
  ]
  ok('S3b 连败计数(其他票不打断, dispatched 打断)', failureStreakOf(streakLedger, 'k') === 2)
  ok('S3c 封票未到期判出', (() => { const until = new Date(Date.now() + 3600_000).toISOString(); return quarantinedUntilOf([{ ticketKey: 'k', action: 'quarantined', until }], 'k') !== null })())
  ok('S3d 封票已到期不拦', quarantinedUntilOf([{ ticketKey: 'k', action: 'quarantined', until: new Date(Date.now() - 1000).toISOString() }], 'k') === null)
  // S4 模板
  ok('S4 模板填充', fillTemplate('run --prompt {promptFile} --ticket {ticketKey}', { promptFile: 'a.md', ticketKey: 'kk' }) === 'run --prompt a.md --ticket kk')
  // S5 派单面解析(元信息行忽略)
  const sample = ['── 剔除统计 ──', '  --exclude-inflight:暂移 7 行 ⇒ 出单 2 行 —— L7616 / L7644', '── 7 行(判定面:HEAD blob)──', '  L7626  - [ ] 补号', '  L7643  - [ ] `--allow-dangerous` 确认旁路仍在调用方。'].join('\n')
  const parsed = parseTicketRows(sample)
  ok('S5 解析器:只取判定面 L 行', parsed.length === 2 && parsed[0].line === 7626 && parsed[1].text.includes('allow-dangerous'))
  // S6 锁判活
  ok('S6 pid 判活:自身活 / 不存在者死', isPidAlive(process.pid) === true && isPidAlive(999999999) === false)
  // S7 取票唯一入口形状(源码级:第二份拼装即 §22c 反面)
  ok('S7 取票唯一入口 = plan-tasks + 三旗', PLAN_TASKS.endsWith('plan-tasks.mjs') && DISPATCH_ARGS.join(' ') === '--open --dispatchable --exclude-inflight')
  // S8 token 计量取数(第 3 期④):终态 complete 行的 usage 是唯一取数口,缺失/形状坏一律未判定
  const complete = '{"type":"complete","stopReason":"end_turn","usage":{"promptTokens":900,"completionTokens":100,"totalTokens":1000,"estimatedCostUsd":0.12}}'
  const u1 = parseSessionUsage(`{"type":"start","prompt":"x"}\n${complete}\n`)
  ok('S8a complete 行 usage → tokens/成本', u1.measured === true && u1.tokens === 1000 && u1.costUsd === 0.12)
  ok('S8b 无 complete 行(超时/被杀)→ 未计量', parseSessionUsage('{"type":"message_delta","text":"x"}').measured === false)
  ok('S8c usage 形状坏 → 未计量(不读成 0 tokens 放行)', parseSessionUsage('{"type":"complete","usage":{"totalTokens":"NaN"}}').measured === false)
  if (failed > 0) {
    console.error(`self-test: ${failed} 例红`)
    process.exitCode = 1
  } else {
    console.log('self-test: 全绿')
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const args = process.argv.slice(2)
  main(args).catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

async function main(args) {
  if (args.includes('--self-test')) return selfTest()
  if (args.includes('--status')) return printStatus()
  if (args.includes('--install-task')) return installTask({ apply: args.includes('--apply') })
  if (args.includes('--probe')) {
    let gates
    try {
      gates = loadGates()
    } catch (e) {
      console.error(`❌ 未判定:${e.message}`)
      process.exitCode = 2
      return
    }
    return probeSession({ gates, dryRun: args.includes('--dry-run') })
  }
  if (args.includes('--dry-run')) return runOnce({ dryRun: true })
  const out = await runOnce({ dryRun: false })
  // 感知层顺带轮(第 1 期 auto-triage):派发轮完成后独立进程跑一次分诊;
  // 它的失败不顶红派发轮(未判定记它自己的台账),产出受它自己的每日配额约束。
  if (!args.includes('--no-triage')) {
    const tr = spawnSync(process.execPath, [join(ROOT, 'scripts', 'auto-triage.mjs'), '--once'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: ROOT,
      windowsHide: true,
      timeout: 180_000,
      encoding: 'utf8',
    })
    const tOut = String(tr.stdout ?? '').trim()
    if (tOut) console.log(`── 感知层分诊轮 ──\n${tOut}`)
  }
  // 进化回流写回轮(第 3 期):把部署环反复出现的失败桶提炼成教训并落 lessons.jsonl。
  // 台账尚未产生过决策时 retro 按设计判「未判定」;这里显式跳过并点名原因,不把"还没部署过"读成故障,
  // 也不让 missing 台账每小时刷一条假红。台单一就位,本腿即自动生效。
  if (!args.includes('--no-retro')) {
    const decisionsPath = join(ROOT, '.ihui-agent', 'deploy-decisions.jsonl')
    if (!existsSync(decisionsPath)) {
      console.log(`── 进化回流写回轮 ──\nℹ 跳过:部署决策台账尚未产生(${decisionsPath}),无可提炼的失败桶`)
    } else {
      const rr = spawnSync(process.execPath, [join(ROOT, 'scripts', 'evolution-retro.mjs'), '--apply'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: ROOT,
        windowsHide: true,
        timeout: 120_000,
        encoding: 'utf8',
      })
      const rOut = String(rr.stdout ?? '').trim()
      if (rOut) console.log(`── 进化回流写回轮 ──\n${rOut}`)
      if (rr.status !== 0) {
        console.error(`⚠ 进化回流写回未判定(rc=${rr.status ?? '?'}):${String(rr.stderr ?? '').trim().slice(-300)}`)
      }
    }
  }
  return out
}

export const __test__ = {
  loadGates,
  GateShapeError,
  ticketKeyOf,
  matchWhitelist,
  parseTicketRows,
  fillTemplate,
  parseSessionUsage,
  failureStreakOf,
  quarantinedUntilOf,
  isPidAlive,
  signSessionJwt,
  DISPATCH_ARGS,
  PLAN_TASKS,
  GATES_JSON,
  LEDGER,
  todayKey,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
