// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// IHUI-AI Alertmanager 告警中转(NSSM 常驻服务,Node 无依赖):微信 + 品牌邮件两条腿
// =============================================================================
// 作用: 接收 Prometheus/Alertmanager 的 webhook_configs 推送(OpenAPI 格式 JSON,
//        POST /alert),去重/节流后并行扇出到 ① Server酱(sctapi.ftqq.com)→ 个人微信
//        ② 品牌告警邮件("智汇通报"版式)。
//
// 为什么需要它:
//   - Alertmanager 的 webhook_configs 只发 JSON;Server酱 只收 form/x-www-form-urlencoded。
//   - Alertmanager 自带的 email 集成用 Go text/template 渲染,**不可能**带本仓邮件版式
//     (2026-09-23 实测收到过一条无样式探针邮件后已撤销),故运维邮件必须走这里 →
//     唯一出口是 apps/api/scripts/notify-deploy-failure.ts,而不是在本文件里发信。
//   - SendKey 与服务器口令同源于仓库外的独立密钥文件,不进 git。
//
// 节流/去重(关键,避免触发 Server酱"每天 5 次"发送上限):
//   - 去重: 同一 (alertname, instance) 4 小时内只推一次,重复告警仅刷新最后时间。
//   - 合并: 同一批次内多个告警合并成一条微信推送。
//   - 冷却: 距离上次成功推送 < 60s 则丢弃(防抖)。
//   - 预算: 微信腿每日上限 SCT_DAILY_BUDGET(默认 4),邮件腿每日上限
//     BRIDGE_MAIL_DAILY_BUDGET(默认 10,与仓库既有"运维邮件 ≤10 封/天"同口径)。
//
// 两条投递腿(2026-09-24 接邮件腿,方向来自 PROJECT_PLAN ⑨ 的结论):
//   去重后的同一批告警**并行**扇出到 ① 微信(Server酱,主通道) ② 邮件。
//   邮件正文一律经 apps/api/scripts/notify-deploy-failure.ts 的 `--message-file` 派发,
//   版式由 apps/api/src/services/email-templates.ts 的 renderSystemAlertEmail 单点决定 ——
//   本文件**不得**出现 SMTP/Resend 传输层、色值或模板字符串(守门 81「品牌邮件通道对账」)。
//   两条腿各自记结果、各自吃预算:任一条失败/抛错都不得影响另一条(Alertmanager 自带
//   email 集成已被撤销 —— 它用 Go text/template 渲染,不可能带本仓版式)。
//
// 配置(环境变量,均可省略):
//   BRIDGE_PORT  监听端口(默认 9096)
//   SCT_SENDKEY  Server酱 SendKey(缺省读仓库外的密钥文件,再缺省用空)
//   SCT_COOLDOWN_SECS 相邻两次成功推送最小间隔(默认 60)
//   SCT_DEDUP_MIN   同一告警去重窗口分钟数(默认 240=4h);**邮件腿复用同一窗口与同一份去重状态**
//   SCT_DAILY_BUDGET 微信腿每日条数上限(默认 4)
//   SCT_QUEUE_MAX    冷却补发队列上限批数(默认 10)
//   LOG_FILE      日志文件(默认 D:\DevEnv\logs\alert-webhook-bridge.log)
//   STATE_FILE    去重/预算状态文件(默认 D:\DevEnv\state\alert-bridge-state.json)
//   BRIDGE_MAIL_ENABLED      邮件腿开关(缺省=开;0/false/off/no 显式关闭)
//   BRIDGE_MAIL_DAILY_BUDGET 邮件腿每日上限(默认 10)
//   BRIDGE_MAIL_TO           收件人覆盖;**缺省不传 --to**,由派发器回读 apps/api/.env 的 ALERT_EMAIL_TO
//   BRIDGE_MAIL_TIMEOUT_MS   派发器单次调用墙上时钟上限(默认 90000)
//
// 命令行旗标(2026-09-24 新增;**不带旗标时行为与既有服务完全一致**):
//   (缺省)         作为常驻服务监听 webhook
//   --self-test    逻辑自检(零网络、零子进程、零微信/邮件投递),失败 exit 1
//   --mail-dry-run 只问品牌派发器"通道是否齐备"(派发器 --dry-run 不发网络请求),不启服务
//   --help         打印本说明
// 日志: D:\DevEnv\logs\alert-webhook-bridge.log
// =============================================================================
'use strict'

const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

// ── 配置 ──────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.BRIDGE_PORT || '9096', 10)
let SENDKEY = process.env.SCT_SENDKEY || ''
const COOLDOWN_SECS = parseInt(process.env.SCT_COOLDOWN_SECS || '60', 10)
const DEDUP_WINDOW_MIN = parseInt(process.env.SCT_DEDUP_MIN || '240', 10)
const LOG_FILE = process.env.LOG_FILE || 'D:\\DevEnv\\logs\\alert-webhook-bridge.log'
const DAILY_BUDGET = parseInt(process.env.SCT_DAILY_BUDGET || '4', 10)
const QUEUE_MAX_BATCHES = parseInt(process.env.SCT_QUEUE_MAX || '10', 10)
const STATE_FILE = process.env.STATE_FILE || 'D:\\DevEnv\\state\\alert-bridge-state.json'

// ── 邮件腿(唯一合法出口 = 品牌派发器;守门 81 禁止本文件自拼 SMTP/Resend)──────────
/** 仓库根:从脚本自身位置向上找品牌派发器所在目录(禁硬编码盘符;两处历史位置同为二级目录) */
function findRepoRoot() {
  let dir = __dirname
  for (let i = 0; i < 6; i += 1) {
    if (fs.existsSync(path.join(dir, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return path.resolve(__dirname, '..', '..')
}
const REPO_ROOT = findRepoRoot()
const TSX_ENTRY = path.join(REPO_ROOT, 'apps', 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs')
const BRAND_MAIL_SCRIPT = path.join(REPO_ROOT, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts')
/** 正文临时文件目录(§15:临时物一律项目内,已被 .gitignore 忽略;用后逐个删除) */
const MAIL_TMP_DIR = path.join(REPO_ROOT, '.ihui-agent', 'tmp', 'alertbridge-mail')
/** 默认开:收件人就是值班运维本人,Server酱 免费额度只有 5 条/天(实测已撞满),关掉等于回到"告警静默"。 */
const MAIL_ENABLED = !/^(0|false|off|no)$/i.test(String(process.env.BRIDGE_MAIL_ENABLED || '').trim())
const MAIL_DAILY_BUDGET = parseInt(process.env.BRIDGE_MAIL_DAILY_BUDGET || '10', 10)
const MAIL_TIMEOUT_MS = parseInt(process.env.BRIDGE_MAIL_TIMEOUT_MS || '90000', 10)
/** 空串 ⇒ 不传 --to,由派发器按 process.env → apps/api/.env 的 ALERT_EMAIL_TO 解析(不复制第二份收件人真相) */
const MAIL_TO = String(process.env.BRIDGE_MAIL_TO || '').trim()
const MAIL_SOURCE = 'ihui-alertbridge'


// 从独立密钥文件读取 SendKey(与 monitor.ps1 统一来源,不进 git)
function loadSendKey() {
  if (SENDKEY) return SENDKEY
  const candidates = [
    'D:\\DevEnv\\secrets\\serverchan.txt',
    'D:\\DevEnv\\secrets\\serverchan.key',
  ]
  for (const c of candidates) {
    try {
      const v = fs.readFileSync(c, 'utf8').trim()
      if (v) return v
    } catch (e) { /* next */ }
  }
  return ''
}

function writeLog(msg) {
  const line = `${new Date().toISOString()} ${msg}\n`
  try { fs.appendFileSync(LOG_FILE, line) } catch (e) { /* ignore */ }
  console.log(line.trimEnd())
}

// 在告警文本前追加一行 Server酱的"来源说明",便于在微信里快速识别是 Prometheus 指标告警
function formatAlert(alert) {
  const labels = alert.labels || {}
  const anns = alert.annotations || {}
  const name = labels.alertname || 'unnamed'
  const inst = labels.instance || '-'
  const lv = labels.severity || 'unknown'
  const desc = anns.description || anns.summary || ''
  return `[${lv}] ${name} (${inst})${desc ? '\n' + desc : ''}`
}

let lastPushOk = 0
const dedup = new Map() // key=`name|instance` -> lastPushTs
const MAX_DEDUP_AGE_MS = DEDUP_WINDOW_MIN * 60 * 1000

// ── 每日推送预算(按自然日持久化,重启不失效)──────────────────────────────────────
// 两条腿各有一份预算(微信受 Server酱 5 条/天硬限,邮件受仓库"运维邮件 ≤10 封/天"口径),
// 但**判据共用同一对纯函数** —— 预算语义不得有两份实现。
const quota = { day: '', used: 0 }
const mailQuota = { day: '', used: 0 }
function todayKey() { return new Date().toLocaleDateString('sv') } // 本地时区 YYYY-MM-DD
/** 跨到新的一自然日就归零(原地改写同一个对象,持久化引用不散) */
function ensureQuotaDay(q, day) {
  if (q.day !== day) { q.day = day; q.used = 0 }
  return q
}
/** 还剩几条额度(不消耗) */
function quotaAllows(q, day, limit) { return limit - ensureQuotaDay(q, day).used > 0 }
function budgetRemaining() {
  return DAILY_BUDGET - ensureQuotaDay(quota, todayKey()).used
}
function consumeBudget() {
  ensureQuotaDay(quota, todayKey())
  quota.used += 1
  saveState() // 预算安全关键项:立即持久化
}
/** 邮件腿同口径:寄成一封才计数,并立即持久化 */
function consumeMailBudget() {
  ensureQuotaDay(mailQuota, todayKey())
  mailQuota.used += 1
  saveState()
}

// ── 状态持久化(去重 Map + 两条腿的每日预算)→ 本地文件 ─────────────────────────
let stateDirty = false
let stateSaveTimer = null
function saveState() {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
    const now = Date.now()
    const dedupObj = {}
    for (const [k, ts] of dedup) {
      if (now - Number(ts) < MAX_DEDUP_AGE_MS) dedupObj[k] = Number(ts)
    }
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify({
        quota: { day: todayKey(), used: quota.used },
        mailQuota: { day: todayKey(), used: mailQuota.used },
        dedup: dedupObj,
      }),
      'utf8',
    )
    stateDirty = false
  } catch (e) {
    writeLog(`[state] 保存状态失败: ${e.message}`)
  }
}
function scheduleSave() {
  stateDirty = true
  if (stateSaveTimer) return
  stateSaveTimer = setTimeout(() => { stateSaveTimer = null; if (stateDirty) saveState() }, 3000)
}
function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
    const day = todayKey()
    for (const [q, key] of [[quota, 'quota'], [mailQuota, 'mailQuota']]) {
      const stored = s[key]
      // mailQuota 是本次新增字段:旧状态文件里没有 ⇒ 按"今日未用"起算(不得因缺字段而崩)
      q.day = day
      q.used = stored && stored.day === day ? Number(stored.used) || 0 : 0
    }
    const now = Date.now()
    const stored = s.dedup && typeof s.dedup === 'object' ? s.dedup : {}
    for (const k of Object.keys(stored)) {
      if (now - Number(stored[k]) < MAX_DEDUP_AGE_MS) dedup.set(k, Number(stored[k]))
    }
    writeLog(`[state] 已载入状态: 今日微信预算已用 ${quota.used}/${DAILY_BUDGET}, 邮件预算已用 ${mailQuota.used}/${MAIL_DAILY_BUDGET}, 去重条目 ${dedup.size}`)
  } catch (e) { /* 首启或文件损坏,用默认空态 */ }
}

/** 去重判据(纯函数,注入 store ⇒ 两条腿共用一份去重状态,不造第二份) */
function decideDedup(store, key, nowMs, windowMs) {
  const last = store.get(key)
  store.set(key, nowMs) // 不断刷新该 key 的最后时间(窗口内重复告警仅重置计时)
  return !!(last && nowMs - last < windowMs)
}
/** 一批告警 → 待投递子集(微信腿与邮件腿都从这里取,故两条腿的去重结论天然一致) */
function partitionAlerts(alerts, store, nowMs, windowMs) {
  let dedupedCount = 0
  const toPush = (Array.isArray(alerts) ? alerts : []).filter((a) => {
    const labels = a.labels || {}
    const isDup = decideDedup(store, `${labels.alertname || ''}|${labels.instance || ''}`, nowMs, windowMs)
    if (isDup) dedupedCount++
    return !isDup
  })
  return { toPush, dedupedCount }
}

// ── 脱敏(SendKey 就嵌在请求 URL 里,任何诊断文本落盘前一律过这一层)──────────────
const SECRETISH_LINE_RE = /(api[_-]?key|token|secret|credential|passw|authorization|bearer|sendkey)/i
function redact(text, limit = 200) {
  const hitKey = SENDKEY || process.env.SCT_SENDKEY || ''
  const scrubbed = String(text === undefined || text === null ? '' : text).split('\n').map((line) => {
    let l = line.trimEnd()
    if (hitKey) l = l.split(hitKey).join('***')
    if (SECRETISH_LINE_RE.test(l)) {
      const sep = /[=:]/.exec(l)
      l = sep && sep.index < 40 ? `${l.slice(0, sep.index + 1)}***` : '[已脱敏]'
    }
    return l
  }).join('\n')
  if (!scrubbed.trim()) return '(无内容)'
  return scrubbed.length > limit ? `${scrubbed.slice(0, limit)}…(截断)` : scrubbed
}

// ── 邮件腿:Alertmanager 批次 → 品牌邮件派发器 ─────────────────────────────────
/** Alertmanager 的 severity 标签 → 品牌模板档位(白名单外一律 warning,不猜严重度) */
function mailSeverity(alerts) {
  const rank = { info: 0, warning: 1, critical: 2 }
  const map = {
    info: 'info', debug: 'info', none: 'info',
    warning: 'warning', warn: 'warning', alert: 'warning',
    critical: 'critical', crit: 'critical', error: 'critical', fatal: 'critical', page: 'critical',
  }
  let worst = 'warning'
  for (const a of alerts || []) {
    const raw = String((a.labels || {}).severity || '').trim().toLowerCase()
    const mapped = map[raw] || 'warning'
    if (rank[mapped] > rank[worst]) worst = mapped
  }
  return worst
}

/** 邮件标题:告警名可读,过长时截断为"前 4 项 + 等 N 项"(标题不是正文,别把预算花在长串上) */
function mailTitle(alerts) {
  const names = (alerts || []).map((a) => (a.labels || {}).alertname || 'unnamed')
  const head = names.length <= 4 ? names.join(' / ') : `${names.slice(0, 4).join(' / ')} 等 ${names.length} 项`
  return `基础设施告警 — ${head}`
}

/** 邮件正文(纯文本多行;版式由 renderSystemAlertEmail 单点决定,本函数不得含 HTML) */
function buildMailMessage(alerts) {
  const parts = ['Prometheus 指标告警(Prometheus → Alertmanager → alert-webhook-bridge 链路)', '']
  for (const a of alerts || []) parts.push(formatAlert(a), '')
  parts.push(
    `告警条数:${alerts.length};去重窗口:${DEDUP_WINDOW_MIN} 分钟(同一 alertname+instance 窗口内不重复投递)。`,
    '说明:微信与邮件是同一批告警的两条并行腿;Server酱免费额度(5 条/天)耗尽时本邮件仍会送达。',
    `来源:${MAIL_SOURCE}(本机即生产机,仓库根 ${REPO_ROOT})。`,
  )
  return parts.join('\n')
}

/**
 * 拼派发器 argv(纯函数,--self-test 钉契约)。
 * ⚠️ 绝不传 `--env-file`:tsx v4 会把它劫持转发给 node 自身,路径不存在时 node 直接 exit 9
 *    (仓库既有实现 scripts/check-credential-health.mjs 的同款教训)。派发器默认就回读 apps/api/.env。
 * ⚠️ 多行中文正文只走 `--message-file`,命令行参数还要过一层控制台代码页(GBK),换行/引号会被吃掉。
 */
function buildMailArgv({ title, severity, messageFile, to = '', plain = false, dryRun = false }) {
  const argv = [TSX_ENTRY, BRAND_MAIL_SCRIPT]
  if (to) argv.push('--to', to)
  argv.push('--title', title, '--severity', severity, '--source', MAIL_SOURCE, '--message-file', messageFile)
  if (plain) argv.push('--plain')
  if (dryRun) argv.push('--dry-run')
  argv.push('--strict') // 失败必须非零退出,降级重试才有依据
  return argv
}

/** 正文写成**无 BOM** UTF-8 临时文件(Node 的 utf8 写入天然无 BOM;调用方负责删除) */
function writeMailMessageFile(text) {
  fs.mkdirSync(MAIL_TMP_DIR, { recursive: true })
  const file = path.join(MAIL_TMP_DIR, `${Date.now()}-${process.pid}.txt`)
  fs.writeFileSync(file, text, 'utf8')
  return file
}

/**
 * 派生一次品牌派发器(异步,不阻塞事件循环)。
 * ⚠️ 这里**必须**用 spawn 而不是 spawnSync:本进程是 Alertmanager 的常驻 webhook 接收端,
 * 一次 tsx 冷启 + SMTP 握手要几十秒,spawnSync 会把事件循环钉死 —— 表现是 Alertmanager
 * 推送超时、后续告警全部堆积(与"告警丢投递"同一后果)。超时用 kill 兜底,双 settled 守卫。
 */
function runDispatcher(argv) {
  return new Promise((resolvePromise) => {
    let settled = false
    const done = (r) => { if (!settled) { settled = true; resolvePromise(r) } }
    let child
    try {
      child = spawn(process.execPath, argv, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }) // windowsHide:§5b 禁弹窗
    } catch (e) {
      done({ ok: false, why: `派发器启动失败: ${redact(e && e.message ? e.message : e)}` })
      return
    }
    let out = ''
    let err = ''
    const cap = (s) => (s.length > 64_000 ? s.slice(0, 64_000) : s)
    child.stdout.on('data', (d) => { out = cap(out + d) })
    child.stderr.on('data', (d) => { err = cap(err + d) })
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL') } catch (e) { /* 已退出 */ }
      done({ ok: false, why: `派发器超时(${MAIL_TIMEOUT_MS}ms),已强制结束` })
    }, MAIL_TIMEOUT_MS)
    child.on('error', (e) => { clearTimeout(timer); done({ ok: false, why: `派发器进程异常(${e.code || e.name}): ${redact(e.message)}` }) })
    child.on('close', (code) => {
      clearTimeout(timer)
      done({ ok: code === 0, code, out, err, why: code === 0 ? '已送达' : `exit=${code} ${redact(err || out)}` })
    })
  })
}

/**
 * 品牌派发器的一次调用:异常/超时一律归为失败,绝不抛出(投递腿不能让服务崩)。
 * 返回 Promise<{ok, skipped?, why}>。
 */
async function dispatchBrandMail({ title, message, severity, plain = false, dryRun = false }) {
  if (!fs.existsSync(TSX_ENTRY) || !fs.existsSync(BRAND_MAIL_SCRIPT)) {
    return { ok: false, why: `品牌派发器缺失(tsx=${fs.existsSync(TSX_ENTRY)} 脚本=${fs.existsSync(BRAND_MAIL_SCRIPT)})` }
  }
  let msgFile = null
  try {
    msgFile = writeMailMessageFile(message)
    const argv = buildMailArgv({ title, severity, messageFile: msgFile, to: MAIL_TO, plain, dryRun })
    const r = await runDispatcher(argv)
    if (!dryRun) return r
    const out = String(r.out || '') + String(r.err || '')
    return { ok: /通道判定 (?:SMTP|Resend): 可用/.test(out), why: `通道判定: ${redact(out.replace(/\r?\n/g, ' / '))}` }
  } catch (e) {
    return { ok: false, why: `派发器调用异常: ${redact(e && e.message ? e.message : e)}` }
  } finally {
    if (msgFile) { try { fs.rmSync(msgFile, { force: true }) } catch (e) { /* 临时文件残留由 .gitignore 兜住 */ } }
  }
}


/**
 * 邮件腿闸门(纯函数,--self-test 直接钉):空批 / 显式关闭 / 预算耗尽 三种情形都"跳过"而非"失败"
 * —— 跳过不该写成投递失败,否则会污染对账。去重不在此处(见 sendMailLeg 注释)。
 */
function mailGate({ enabled, quotaObj, day, limit, count }) {
  if (!count) return { pass: false, skipped: true, why: '本批无可投递告警' }
  if (!enabled) return { pass: false, skipped: true, why: 'BRIDGE_MAIL_ENABLED=0,邮件腿已显式关闭(未尝试投递)' }
  if (!quotaAllows(quotaObj, day, limit)) {
    return { pass: false, skipped: true, why: `当日邮件预算已达上限(${limit}封),本日不再寄信(次日自动重置)` }
  }
  return { pass: true }
}

/**
 * 邮件腿入口。去重不在此处:批次已在 partitionAlerts 里按**同一份**去重状态筛过
 * (SCT_DEDUP_MIN 窗口),故"同一条告警 4h 内不重复寄邮件"天然成立,不再造第二份状态。
 * 品牌模板失败时用同一条通道的 --plain 降级(与 ihui-deploy.ps1 / check-credential-health 同策略:
 * 宁可版式降级,不可静默丢失)。
 */
async function sendMailLeg(toPush) {
  const gate = mailGate({ enabled: MAIL_ENABLED, quotaObj: mailQuota, day: todayKey(), limit: MAIL_DAILY_BUDGET, count: toPush ? toPush.length : 0 })
  if (!gate.pass) return { ok: false, skipped: true, why: gate.why }
  const payload = { title: mailTitle(toPush), message: buildMailMessage(toPush), severity: mailSeverity(toPush) }
  const branded = await dispatchBrandMail(payload)
  if (branded.ok) { consumeMailBudget(); return branded }
  const plain = await dispatchBrandMail({ ...payload, plain: true })
  if (plain.ok) { consumeMailBudget(); return { ok: true, why: `品牌模板失败(${branded.why})→ 降级纯文本已送达` } }
  return { ok: false, why: `品牌模板失败(${branded.why});降级纯文本同样失败(${plain.why})` }
}


/** 单腿执行包装:抛错/异常一律收敛成结论,绝不冒泡到另一条腿 */
async function safeLeg(fn) {
  try {
    const r = await fn()
    return r && typeof r === 'object' ? r : { ok: true, why: '已提交(结论由该腿自身落日志)' }
  } catch (e) {
    return { ok: false, why: `该腿自身异常: ${redact(e && e.message ? e.message : e)}` }
  }
}

/** 两条腿并行扇出(微信为主通道,邮件为并行第二通道;一条失败不得影响另一条) */
async function runLegs(toPush, mailFn, wechatFn) {
  const [mail, wechat] = await Promise.all([safeLeg(mailFn), safeLeg(wechatFn)])
  return { mail, wechat }
}

function fanoutLegs(toPush) {
  return runLegs(toPush, () => sendMailLeg(toPush), () => enqueueAndDrain(toPush)).then((r) => {
    const m = r.mail
    const tag = m.ok ? '已送达' : m.skipped ? '跳过' : '失败'
    writeLog(`[mail] ${tag}: ${redact(m.why || '')}(本批 ${toPush.length} 条,今日邮件 ${mailQuota.used}/${MAIL_DAILY_BUDGET};微信腿结论见 [push] 行)`)
    return r
  })
}

// ── 冷却补发队列(有界内存队列;冷却期告警入队,结束后补发,不丢弃)──────────────────
const pendingQueue = []
let pushInFlight = false
let lastDropCount = 0

function enqueueAndDrain(batch) {
  pendingQueue.push(batch)
  lastDropCount = 0
  if (pendingQueue.length > QUEUE_MAX_BATCHES) {
    const dropped = pendingQueue.shift()
    lastDropCount = dropped ? dropped.length : 0
    writeLog(`[queue] 冷却补发队列已达上限(${QUEUE_MAX_BATCHES}批),丢弃最旧一批(${lastDropCount}条)`)
  }
  if (!pushInFlight) drainQueue()
}

async function drainQueue() {
  if (pushInFlight) return
  pushInFlight = true
  try {
    while (pendingQueue.length > 0) {
      if (budgetRemaining() <= 0) {
        writeLog(`[quota][WARN] 当日推送预算已达上限(${DAILY_BUDGET}条),本日静默不再推送,丢弃剩余 ${pendingQueue.length} 批告警(次日自动重置)`)
        pendingQueue.length = 0
        break
      }
      const waitMs = COOLDOWN_SECS * 1000 - (Date.now() - lastPushOk)
      if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs))
      const batch = pendingQueue.shift()
      const ok = await dispatchBatch(batch)
      if (!ok) break
    }
  } finally {
    pushInFlight = false
    // 排队期间有新告警入队:再次触发补发
    if (pendingQueue.length > 0) setImmediate(drainQueue)
  }
}

async function dispatchBatch(toPush) {
  if (budgetRemaining() <= 0) {
    writeLog(`[quota][WARN] 推送预算耗尽,放弃本批(${toPush.length}条)`)
    return false
  }
  const title = `[IHUI-AI 告警] ${toPush.length} 项指标异常`
  const despParts = ['Prometheus 指标告警(Prometheus→Alertmanager 链路)', '--------------------------------']
  for (const a of toPush) despParts.push(formatAlert(a))
  const desp = despParts.join('\n')
  try {
    const verdict = await pushServerChan(title, desp)
    lastPushOk = Date.now()
    consumeBudget()
    writeLog(`[push] 已推送 ${toPush.length} 条告警到微信(${verdict.why}): ${toPush.map((a) => (a.labels || {}).alertname).join(', ')}`)
    return true
  } catch (e) {
    writeLog(`[push] 失败: ${redact(e.message)}`)
    return false
  }
}

/**
 * Server酱返回体判定(纯函数,--self-test 钉契约)。
 * 官方返回体形态:Server酱² Turbo / SC3 = `{"code":0,"message":"","data":{"pushid":…}}`;
 * 旧 v1 = `{"errno":0,"errmsg":"","data":{…}}`。因此**成功信号只有这三种明确形态**:
 *   ① 数字 code === 0  ② 数字 errno === 0  ③ status === 'success'(字符串)。
 * 反例(2026-09-24 用伪造 SendKey 沙箱实测出的真缺陷):旧判据把"2xx + 非 JSON / 无 errno"
 * 一律记成功 ⇒ 网关/拦截页/空体都会写出假成功日志"已推送到微信",真实业务失败静默丢告警。
 * 现在:非 2xx、非 JSON、HTML、缺上述字段 ⇒ 全部判失败。
 */
function judgeServerChanResponse(statusCode, bodyText) {
  const sc = Number(statusCode)
  const body = String(bodyText === undefined || bodyText === null ? '' : bodyText)
  const trimmed = body.trim()
  if (!(sc >= 200 && sc < 300)) return { ok: false, why: `Server酱 HTTP ${sc}: ${redact(trimmed) || '(空响应体)'}` }
  if (!trimmed) return { ok: false, why: 'HTTP 2xx 但响应体为空,拿不到任何成功信号' }
  if (trimmed[0] === '<') return { ok: false, why: `HTTP 2xx 但响应是 HTML(疑似网关/拦截页),无成功信号: ${redact(trimmed, 120)}` }
  let j
  try {
    j = JSON.parse(trimmed)
  } catch (e) {
    return { ok: false, why: `HTTP 2xx 但响应非 JSON,无成功信号: ${redact(trimmed, 120)}` }
  }
  if (!j || typeof j !== 'object') return { ok: false, why: `响应 JSON 不是对象(${redact(trimmed, 60)})` }
  const bizMsg = redact(String(j.message || j.msg || j.errmsg || ''), 120)
  if (typeof j.code === 'number') {
    return j.code === 0 ? { ok: true, why: 'code=0' } : { ok: false, why: `Server酱 code=${j.code}${bizMsg ? ` ${bizMsg}` : ''}` }
  }
  if (typeof j.errno === 'number') {
    return j.errno === 0 ? { ok: true, why: 'errno=0' } : { ok: false, why: `Server酱 errno=${j.errno}${bizMsg ? ` ${bizMsg}` : ''}` }
  }
  if (typeof j.status === 'string') {
    return j.status.toLowerCase() === 'success' ? { ok: true, why: 'status=success' } : { ok: false, why: `Server酱 status=${redact(j.status, 60)}` }
  }
  return { ok: false, why: `响应缺少 code/errno/status 成功信号,拒记成功: ${redact(trimmed, 120)}` }
}

// 调用 Server酱 send 接口(form 表单)。只在 judgeServerChanResponse 判成功时才 resolve。
function pushServerChan(title, desp) {
  if (!SENDKEY) {
    // 旧行为在这里"跳过并算成功" ⇒ 日志写出"已推送微信"却什么都没发(同类假成功)
    return Promise.reject(new Error('未配置 SendKey(不记成功、不消耗预算)'))
  }
  const url = new URL(`https://sctapi.ftqq.com/${SENDKEY}.send`)
  const body = new URLSearchParams({ title, desp }).toString()
  const lib = url.protocol === 'https:' ? https : http
  return new Promise((resolve, reject) => {
    try {
      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname + (url.search || ''),
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: 10000,
        },
        (res) => {
          let data = ''
          res.on('data', (c) => (data += c))
          res.on('end', () => {
            const verdict = judgeServerChanResponse(res.statusCode, data)
            verdict.ok ? resolve(verdict) : reject(new Error(verdict.why))
          })
        },
      )
      req.on('timeout', () => { req.destroy(new Error('Server酱 timeout')) })
      req.on('error', (e) => reject(new Error(`Server酱请求失败: ${redact(e.message)}`)))
      req.write(body)
      req.end()
    } catch (e) { reject(e) }
  })
}

// 主入口: 处理一次 Alertmanager webhook
async function handleAlert(reqBody) {
  const alerts = (reqBody && Array.isArray(reqBody.alerts)) ? reqBody.alerts : []
  if (!alerts.length) {
    writeLog('[alert] 空 alert 列表,忽略')
    return { skipped: 0 }
  }

  const now = Date.now()
  // 去重: 只保留"该去重窗口内未推过"的告警(去重 Map 会持久化,重启不重置)。
  // 两条腿都从这一份 partitionAlerts 结论取批次 ⇒ 邮件与微信共用同一套去重判据/窗口/状态。
  const { toPush, dedupedCount } = partitionAlerts(alerts, dedup, now, MAX_DEDUP_AGE_MS)
  scheduleSave() // 去重状态落盘(3s 防抖),重启不丢失

  if (!toPush.length) {
    writeLog(`[alert] 全部命中去重窗口(${alerts.length}条/${alerts.length}条),跳过推送`)
    return { skipped: dedupedCount }
  }

  // 微信腿:冷却期内的新告警入队补发(有界队列,满了丢弃最旧批并记日志);不再直接丢弃
  // 邮件腿:与微信腿并行扇出,各自记结果、各吃各的预算(微信预算耗尽不影响邮件,反之亦然)
  void fanoutLegs(toPush)
  return { queued: toPush.length, dropped: lastDropCount }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => { data += c; if (data.length > 5e6) req.destroy() })
    req.on('end', () => {
      try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }

  // 健康检查
  if (req.url === '/health' || req.url === '/-/healthy') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ ok: true, service: 'alert-webhook-bridge', keyConfigured: !!SENDKEY, mailEnabled: MAIL_ENABLED }))
  }

  // 仅接受 Alertmanager webhook(v2 API 用 POST /alert 或任意 POST)
  if (req.method === 'POST') {
    let body
    try { body = await parseBody(req) } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ ok: false, error: 'bad json' }))
    }
    try {
      const r = await handleAlert(body)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ ok: true, ...r }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ ok: false, error: redact(String(e)) }))
    }
  }

  res.writeHead(404)
  res.end()
})

// ── 命令行旗标(2026-09-24 新增;缺省形态必须与既有服务逐字一致)──────────────────
/** 纯函数:旗标 → 运行模式。空数组必须落 'serve'(向后兼容的机读证明) */
function parseMode(argv) {
  const a = Array.isArray(argv) ? argv : []
  if (a.includes('--help') || a.includes('-h')) return 'help'
  if (a.includes('--self-test')) return 'self-test'
  if (a.includes('--mail-dry-run')) return 'mail-dry-run'
  return 'serve'
}

function usageText() {
  return [
    '用法: node alert-webhook-bridge.cjs [旗标]',
    '',
    '  (缺省)         作为常驻服务监听 127.0.0.1:' + PORT + '(Alertmanager webhook → 微信 + 邮件两条腿)',
    '  --self-test    逻辑自检:argv 契约 / 无 BOM 写入 / 去重 / 预算 / 两条腿互不影响 /',
    '                 Server酱返回体判定(零网络、零子进程、零投递),失败 exit 1',
    '  --mail-dry-run 只问品牌邮件派发器「通道是否齐备」(派发器 --dry-run 零网络请求),不启服务',
    '',
    '环境变量: BRIDGE_PORT / SCT_SENDKEY / SCT_COOLDOWN_SECS / SCT_DEDUP_MIN / SCT_DAILY_BUDGET',
    '          / SCT_QUEUE_MAX / LOG_FILE / STATE_FILE / BRIDGE_MAIL_ENABLED(缺省=开)',
    '          / BRIDGE_MAIL_DAILY_BUDGET(缺省 10) / BRIDGE_MAIL_TO / BRIDGE_MAIL_TIMEOUT_MS',
    '邮件出口唯一实现: apps/api/scripts/notify-deploy-failure.ts(版式= renderSystemAlertEmail);',
    '本文件不得出现 SMTP/Resend 传输层或模板字符串(守门 81「品牌邮件通道对账」)。',
  ].join('\n')
}

/** --self-test:不触网、不派生子进程、不投微信/邮件(所有投递点均以假函数注入) */
async function runSelfTest() {
  const cases = []
  const eq = (label, got, want) => cases.push([label, JSON.stringify(got) === JSON.stringify(want), `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`])
  const norm = (p) => String(p).replace(/\\/g, '/')
  const HOUR = 3600 * 1000

  // ⓪ 向后兼容:不带旗标必须仍是"起服务"
  eq('缺省无旗标 ⇒ 模式为 serve(行为与接线前一致)', parseMode([]), 'serve')
  eq('未知旗标也不得改变缺省模式', parseMode(['--whatever']), 'serve')
  eq('--self-test / --mail-dry-run / --help 各自独立成模式', [parseMode(['--self-test']), parseMode(['--mail-dry-run']), parseMode(['--help'])], ['self-test', 'mail-dry-run', 'help'])

  // ① argv 契约(与 scripts/check-credential-health.mjs 同一份派发器形态)
  const argv = buildMailArgv({ title: 't', severity: 'critical', messageFile: 'm.txt' })
  eq('邮件唯一出口是品牌派发器 notify-deploy-failure', norm(argv[1]).endsWith('apps/api/scripts/notify-deploy-failure.ts'), true)
  eq('经 apps/api 的 tsx 入口运行(不依赖 PATH 上的 pnpm/npx)', norm(argv[0]).endsWith('apps/api/node_modules/tsx/dist/cli.mjs'), true)
  eq('绝不传 --env-file:tsx v4 会劫持它转发给 node,路径不存在时 node 直接 exit 9', argv.includes('--env-file'), false)
  eq('必带 --strict(失败要非零退出,降级重试才有依据)', argv.includes('--strict'), true)
  eq('必带 --message-file(多行中文正文不得走命令行参数)', argv.includes('--message-file'), true)
  eq('--source 固定为 ihui-alertbridge(品牌模板的来源栏)', argv.slice(argv.indexOf('--source'), argv.indexOf('--source') + 2), ['--source', 'ihui-alertbridge'])
  eq('缺省不传 --to ⇒ 由派发器回读 apps/api/.env 的 ALERT_EMAIL_TO(不复制第二份收件人真相)', argv.includes('--to'), false)
  eq('显式 BRIDGE_MAIL_TO 才传 --to(沙箱/换收件人场景)', buildMailArgv({ title: 't', severity: 'warning', messageFile: 'm', to: 'ops@example.com' }).filter((a) => a === '--to' || a === 'ops@example.com'), ['--to', 'ops@example.com'])
  eq('默认不降级、不演练:--plain/--dry-run 都不出现', [argv.includes('--plain'), argv.includes('--dry-run')], [false, false])
  eq('降级/演练标志按需才出现', buildMailArgv({ title: 't', severity: 'warning', messageFile: 'm', plain: true, dryRun: true }).filter((a) => a === '--plain' || a === '--dry-run'), ['--plain', '--dry-run'])
  eq('派发器与 tsx 入口在本仓可解析(缺失=邮件腿直接判不可用,不静默成功)', [fs.existsSync(TSX_ENTRY), fs.existsSync(BRAND_MAIL_SCRIPT)], [true, true])

  // ② 无 BOM UTF-8 写入(多行中文正文的送达前提)
  const probeFile = writeMailMessageFile('第一行:CPU 使用率 95%\n第二行 "quoted" `backtick`\n')
  const probeBytes = fs.readFileSync(probeFile)
  const hasBom = probeBytes[0] === 0xef && probeBytes[1] === 0xbb && probeBytes[2] === 0xbf
  eq('正文文件首字节非 BOM(否则派发器读到乱码)', hasBom, false)
  eq('正文原样往返(中文/引号/反引号未被改写)', fs.readFileSync(probeFile, 'utf8'), '第一行:CPU 使用率 95%\n第二行 "quoted" `backtick`\n')
  fs.rmSync(probeFile, { force: true })
  eq('临时正文用后即删(不在 .ihui-agent/tmp 里堆积)', fs.existsSync(probeFile), false)

  // ③ 去重:两条腿共用同一份状态 ⇒ 邮件不会在窗口内重复寄出
  const store = new Map()
  const alerts = [{ labels: { alertname: 'HighCPU', instance: 'a:9100', severity: 'critical' } }, { labels: { alertname: 'DiskFull', instance: 'b:9100', severity: 'warning' } }]
  eq('首批两条告警全部待投递', partitionAlerts(alerts, store, 1000, HOUR).toPush.length, 2)
  const second = partitionAlerts(alerts, store, 1000 + 60000, HOUR)
  eq('同批再推一次 ⇒ 全部命中去重(邮件/微信两条腿同时被压住)', [second.toPush.length, second.dedupedCount], [0, 2])
  eq('超出窗口后重新放行(去重不得把持续故障压成永久静默)', partitionAlerts(alerts, store, 1000 + 3 * HOUR, HOUR).toPush.length, 2)
  eq('空/非数组输入不炸', partitionAlerts(undefined, store, 1, HOUR).toPush.length, 0)

  // ④ 预算:邮件腿与微信腿各一份,判据同一对纯函数
  const mq = { day: '', used: 0 }
  eq('预算内放行', quotaAllows(mq, '2026-09-24', 10), true)
  mq.day = '2026-09-24'; mq.used = 10
  eq('第 11 封被拦(每日上限 10,防风暴刷信)', quotaAllows(mq, '2026-09-24', 10), false)
  eq('次日自动重置', quotaAllows(mq, '2026-09-25', 10), true)
  eq('跨日时旧计数归零(而非继续累加)', [mq.day, mq.used], ['2026-09-25', 0])
  eq('零条预算 = 一律拦(开关之外的第二道闸)', quotaAllows({ day: '', used: 0 }, '2026-09-24', 0), false)
  eq('邮件闸门:关闭时标 skipped 且不算失败(微信腿不受影响)', mailGate({ enabled: false, quotaObj: { day: '', used: 0 }, day: 'x', limit: 10, count: 1 }), { pass: false, skipped: true, why: 'BRIDGE_MAIL_ENABLED=0,邮件腿已显式关闭(未尝试投递)' })
  eq('邮件闸门:空批次直接跳过', mailGate({ enabled: true, quotaObj: { day: '', used: 0 }, day: 'x', limit: 10, count: 0 }).pass, false)
  eq('邮件闸门:开启且预算内 ⇒ 放行', mailGate({ enabled: true, quotaObj: { day: '', used: 0 }, day: 'x', limit: 10, count: 1 }).pass, true)

  // ⑤ Server酱返回体判定:只在明确成功信号下记成功
  eq('Turbo 官方形态 code=0 ⇒ 成功', judgeServerChanResponse(200, '{"code":0,"message":"","data":{"pushid":"1"}}').ok, true)
  eq('旧 v1 形态 errno=0 ⇒ 成功', judgeServerChanResponse(200, '{"errno":0,"errmsg":"","data":{}}').ok, true)
  eq('status=success ⇒ 成功', judgeServerChanResponse(200, '{"status":"success"}').ok, true)
  eq('反向对照:伪造/异常响应不得记成功 —— 200 + 非 JSON', judgeServerChanResponse(200, 'ok').ok, false)
  eq('反向对照:200 + HTML 拦截页不得记成功', judgeServerChanResponse(200, '<html><body>gateway</body></html>').ok, false)
  eq('反向对照:200 + 空响应体不得记成功', judgeServerChanResponse(200, '').ok, false)
  eq('反向对照:200 + 缺成功字段的 JSON 不得记成功', judgeServerChanResponse(200, '{"foo":1}').ok, false)
  eq('业务码非零判失败并带原因', [judgeServerChanResponse(200, '{"code":40001,"message":"超过当天的发送次数限制[5]"}').ok, /40001/.test(judgeServerChanResponse(200, '{"code":40001,"message":"x"}').why)], [false, true])
  eq('4xx/5xx 判失败(旧行为同样判失败,不得回归)', judgeServerChanResponse(403, '{"code":40001}').ok, false)
  eq('假成功回归钉:旧判据会放行的 push_id 无码体 ⇒ 现按缺信号判失败', judgeServerChanResponse(200, '{"push_id":1}').ok, false)

  // ⑥ 脱敏:SendKey 与密钥样行不得进日志
  SENDKEY = 'SCTFAKEKEY123456abcdefgh'
  eq('诊断文本不回显 SendKey', [redact('请求 https://sctapi.ftqq.com/SCTFAKEKEY123456abcdefgh.send 失败').includes('SCTFAKEKEY123456abcdefgh'), redact('x'.repeat(500)).endsWith('…(截断)')], [false, true])
  eq('密钥样行留键名抹值(诊断仍读得懂)', redact('RESEND_API_KEY=re-secret-value-123'), 'RESEND_API_KEY=***')
  eq('无分隔符可切的命中行整行打码', redact('Bearer eyJhbGciOiJIUzI1Ni5x'), '[已脱敏]')
  eq('普通行原样保留', redact('SMTP 发送失败,回落 Resend'), 'SMTP 发送失败,回落 Resend')

  // ⑦ 版式零手抄:邮件正文必须是纯文本(模板归 renderSystemAlertEmail 单点)
  const msg = buildMailMessage(alerts)
  eq('正文不含任何 HTML 标签(未手抄版式)', /<[a-z!/][^>]*>/i.test(msg), false)
  eq('severity 映射:page→critical、未知→warning', [mailSeverity([{ labels: { severity: 'page' } }]), mailSeverity([{ labels: { severity: 'weird' } }]), mailSeverity([{ labels: { severity: 'info' } }, { labels: { severity: 'critical' } }])], ['critical', 'warning', 'critical'])
  eq('标题过长时截断为"前 4 项 等 N 项"', mailTitle(Array.from({ length: 7 }, (_, i) => ({ labels: { alertname: `A${i}` } }))), '基础设施告警 — A0 / A1 / A2 / A3 等 7 项')

  // ⑧ 两条腿互不影响(注入假腿,零投递)
  const boom = () => { throw new Error('假失败') }
  const fakeOk = () => ({ ok: true, why: '假成功' })
  const r1 = await runLegs([{ labels: {} }], fakeOk, boom)
  eq('微信腿抛错 ⇒ 邮件腿结论仍为成功', [r1.mail.ok, r1.wechat.ok], [true, false])
  const r2 = await runLegs([{ labels: {} }], boom, fakeOk)
  eq('邮件腿抛错 ⇒ 微信腿结论仍为成功(微信是主通道,不得被拖累)', [r2.mail.ok, r2.wechat.ok], [false, true])
  eq('腿的异常被收敛成可诊断结论(不让服务因投递腿崩掉)', /假失败/.test(r2.mail.why), true)

  let bad = 0
  for (const [label, pass, why] of cases) {
    if (!pass) bad++
    console.log(`${pass ? '✓' : '✗'} ${label}${pass ? '' : `  ${why}`}`)
  }
  console.log(`自检 ${cases.length - bad}/${cases.length} 通过`)
  process.exit(bad ? 1 : 0)
}

function startServer() {
  server.listen(PORT, '127.0.0.1', () => {
    SENDKEY = loadSendKey()
    loadState() // 载入去重 + 两条腿的每日预算(重启不失效)
    writeLog(`alert-webhook-bridge 启动, 监听 127.0.0.1:${PORT}, SendKey ${SENDKEY ? '已配置' : '未配置'}, 每日预算 微信 ${DAILY_BUDGET} 条 / 邮件 ${MAIL_ENABLED ? `${MAIL_DAILY_BUDGET} 封` : '已关闭'}`)
  })
  // NSSM 常驻服务:退出前冲刷去重/预算状态(NSSM 停机或 Ctrl+C)
  process.on('SIGINT', () => { saveState(); process.exit(0) })
  process.on('SIGTERM', () => { saveState(); process.exit(0) })
}

/** --mail-dry-run:零网络问一次通道判定(不占配额、不动微信腿、不启服务) */
async function runMailDryRun() {
  const r = await dispatchBrandMail({
    title: '【核验信】alert-webhook-bridge 邮件通道演练(dry-run,未发送)',
    message: '这是一条 dry-run 演练正文,不会真的寄出。\n第二行用于验证多行中文经 --message-file 通道原样送达。',
    severity: 'info',
    dryRun: true,
  })
  console.log(`邮件通道(dry-run): ok=${r.ok} ${redact(r.why)}`)
  process.exit(r.ok ? 0 : 1)
}

const MODE = parseMode(process.argv.slice(2))
if (MODE === 'help') {
  console.log(usageText())
  process.exit(0)
} else if (MODE === 'self-test') {
  // 自检自身异常必须 exit 2(与 §22b/§22d 约定一致:1=业务失败,2=脚本异常),不得静默放行
  void runSelfTest().catch((e) => {
    console.error(`❌ 自检自身异常: ${e && e.message ? e.message : e}\n${e && e.stack ? e.stack : ''}`)
    process.exit(2)
  })
} else if (MODE === 'mail-dry-run') {
  void runMailDryRun().catch((e) => {
    console.error(`❌ 通道演练异常: ${redact(e && e.message ? e.message : e)}`)
    process.exit(2)
  })
} else {
  startServer()
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
