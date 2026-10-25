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
 *  - 预算闸第一版量"每日派发轮数"(起会话 token 用量在通路落地前量不到,量不到的不冒充量到;
 *    token 双闸属第 3 期)。
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
import { createHash } from 'node:crypto'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const GATES_JSON = join(ROOT, 'scripts', 'data', 'auto-evolve-gates.json')
const LEDGER = join(ROOT, '.ihui-agent', 'state', 'auto-evolve-ledger.jsonl')
const LOCK_FILE = join(ROOT, '.ihui-agent', 'state', 'auto-evolve.lock')
const ESCAPE_TICK = join(ROOT, '.ihui-agent', 'state', 'auto-evolve-escape-tick.json')
const TMP_DIR = join(ROOT, '.ihui-agent', 'tmp', 'auto-evolve')
const PLAN_TASKS = join(ROOT, 'scripts', 'plan-tasks.mjs')
const MAIL_SCRIPT = join(ROOT, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts')
const TSX_ENTRY = join(ROOT, 'apps', 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs')
const API_ENV = join(ROOT, 'apps', 'api', '.env')
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

/** 白名单判定:票文本命中任一 pattern(大小写不敏感)即放行 */
export function matchWhitelist(rowText, patterns) {
  const hay = String(rowText).toLowerCase()
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
      `验证齐绿(typecheck/test/守门末行现读)后才可声明完成;完成即翻勾。`,
    ].join('\n'),
    'utf8'
  )
  const cmd = fillTemplate(gates.sessionCommandTemplate, { promptFile, ticketLine: ticket.text, ticketKey: key })
  const t0 = Date.now()
  const r = spawnSync('cmd.exe', ['/d', '/s', '/c', cmd], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    windowsHide: true,
    timeout: gates.maxSessionMinutes * 60_000,
    encoding: 'utf8',
  })
  try {
    unlinkSync(promptFile)
  } catch {
    /* 用完即删 */
  }
  const durationMs = Date.now() - t0
  if (r.error?.killed || (r.signal === 'SIGTERM' && durationMs >= gates.maxSessionMinutes * 60_000 - 5_000)) {
    return { action: 'session-timeout', exitCode: null, durationMs, why: `超过 maxSessionMinutes=${gates.maxSessionMinutes}` }
  }
  if (r.error) return { action: 'session-failed', exitCode: null, durationMs, why: r.error.message }
  if (r.status !== 0) {
    return { action: 'session-failed', exitCode: r.status, durationMs, why: `exit=${r.status} ${String(r.stderr ?? '').slice(-200)}` }
  }
  return { action: 'session-ok', exitCode: 0, durationMs, why: '' }
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
      const res = dispatchSession(gates, ticket, dryRun)
      record({ mode: dryRun ? 'dryrun' : 'dispatch', action: res.action, ticketKey: key, ticketLine: ticket.text.slice(0, 200), exitCode: res.exitCode ?? null, durationMs: res.durationMs ?? null, why: res.why ?? '' })
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
  console.log(`当前封票:${quarantined.length === 0 ? '无' : ''}`)
  for (const q of quarantined) console.log(`  - ${q.key} 至 ${q.until} :: ${q.line}`)
  console.log(`台账最近 5 条:`)
  for (const e of ledger.slice(-5)) console.log(`  ${e.ts} ${e.mode}/${e.action}${e.why ? ` :: ${e.why}` : ''}`)
}

function installTaskCommand() {
  console.log(`# 本机 schtasks.exe 在程序黑名单 ⇒ 注册走 pwsh ScheduledTasks cmdlet(git-guardian 同口径)。`)
  console.log(`# 以下命令在 pwsh 7 里执行一次即完成注册(每小时一轮;重复执行幂等):`)
  console.log(`$action = New-ScheduledTaskAction -Execute 'node.exe' -Argument 'scripts/auto-evolve.mjs --once' -WorkingDirectory '${ROOT}'`)
  console.log(`$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 3650)`)
  console.log(`$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)`)
  console.log(`Register-ScheduledTask -TaskName 'IHUI-AI auto-evolve' -Action $action -Trigger $trigger -Settings $settings -Force`)
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
  ok('S2a 白名单命中', matchWhitelist('同步 README 数字对齐', ['readme']) === true)
  ok('S2b 白名单不命中', matchWhitelist('重构鉴权中间件', ['readme', '文档']) === false)
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
  if (args.includes('--install-task')) return installTaskCommand()
  if (args.includes('--dry-run')) return runOnce({ dryRun: true })
  return runOnce({ dryRun: false })
}

export const __test__ = {
  loadGates,
  GateShapeError,
  ticketKeyOf,
  matchWhitelist,
  parseTicketRows,
  fillTemplate,
  failureStreakOf,
  quarantinedUntilOf,
  isPidAlive,
  DISPATCH_ARGS,
  PLAN_TASKS,
  GATES_JSON,
  LEDGER,
  todayKey,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
