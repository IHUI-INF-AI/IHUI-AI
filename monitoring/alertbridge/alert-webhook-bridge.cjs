// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// IHUI-AI Alertmanager → Server酱 告警中转(NSSM 常驻服务,Node 无依赖)
// =============================================================================
// 作用: 接收 Prometheus/Alertmanager 的 webhook_configs 推送(OpenAPI 格式 JSON,
//        POST /alert),转成 Server酱(sctapi.ftqq.com)的 form 表单推到你个人微信。
//
// 为什么需要它:
//   - Alertmanager 的 webhook_configs 只发 JSON;Server酱 只收 form/x-www-form-urlencoded。
//   - 我们复用 monitor.ps1 里已验证可用的 Server酱 SendKey,无需再配真实 SMTP/企微/飞书。
//
// 节流/去重(关键,避免触发 Server酱"每天 5 次"发送上限):
//   - 去重: 同一 (alertname, instance) 4 小时内只推一次,重复告警仅刷新最后时间。
//   - 合并: 同一批次内多个告警合并成一条微信推送。
//   - 冷却: 距离上次成功推送 < 60s 则丢弃(防抖)。
//
// 配置(环境变量,均可省略):
//   BRIDGE_PORT  监听端口(默认 9096)
//   SCT_SENDKEY  Server酱 SendKey(缺省读 D:\DevEnv\secrets\serverchan.txt,再缺省用空)
//   SCT_COOLDOWN_SECS 相邻两次成功推送最小间隔(默认 60)
//   SCT_DEDUP_MIN   同一告警去重窗口分钟数(默认 240=4h)
//   LOG_FILE      日志文件(默认 D:\DevEnv\logs\alert-webhook-bridge.log)
// 日志: D:\DevEnv\logs\alert-webhook-bridge.log
// =============================================================================
'use strict'

const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execFileSync } = require('child_process')

// ── 配置 ──────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.BRIDGE_PORT || '9096', 10)
let SENDKEY = process.env.SCT_SENDKEY || ''
const COOLDOWN_SECS = parseInt(process.env.SCT_COOLDOWN_SECS || '60', 10)
const DEDUP_WINDOW_MIN = parseInt(process.env.SCT_DEDUP_MIN || '240', 10)
const LOG_FILE = process.env.LOG_FILE || 'D:\\DevEnv\\logs\\alert-webhook-bridge.log'
const DAILY_BUDGET = parseInt(process.env.SCT_DAILY_BUDGET || '4', 10)
const QUEUE_MAX_BATCHES = parseInt(process.env.SCT_QUEUE_MAX || '10', 10)
const STATE_FILE = process.env.STATE_FILE || 'D:\\DevEnv\\state\\alert-bridge-state.json'

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
const quota = { day: '', used: 0 }
function todayKey() { return new Date().toLocaleDateString('sv') } // 本地时区 YYYY-MM-DD
function budgetRemaining() {
  if (quota.day !== todayKey()) { quota.day = todayKey(); quota.used = 0 }
  return DAILY_BUDGET - quota.used
}
function consumeBudget() {
  if (quota.day !== todayKey()) { quota.day = todayKey(); quota.used = 0 }
  quota.used += 1
  saveState() // 预算安全关键项:立即持久化
}

// ── 状态持久化(去重 Map + 每日预算)→ 本地文件 ──────────────────────────────────
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
      JSON.stringify({ quota: { day: todayKey(), used: quota.used }, dedup: dedupObj }),
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
    quota.day = s.quota && s.quota.day === todayKey() ? s.quota.day : todayKey()
    quota.used = s.quota && s.quota.day === todayKey() ? Number(s.quota.used) || 0 : 0
    const now = Date.now()
    const stored = s.dedup && typeof s.dedup === 'object' ? s.dedup : {}
    for (const k of Object.keys(stored)) {
      if (now - Number(stored[k]) < MAX_DEDUP_AGE_MS) dedup.set(k, Number(stored[k]))
    }
    writeLog(`[state] 已载入状态: 今日预算已用 ${quota.used}/${DAILY_BUDGET}, 去重条目 ${dedup.size}`)
  } catch (e) { /* 首启或文件损坏,用默认空态 */ }
}

function shouldDedup(key, nowMs) {
  const last = dedup.get(key)
  dedup.set(key, nowMs) // 不断刷新该 key 的最后时间(窗口内重复告警仅重置计时)
  return !!(last && nowMs - last < MAX_DEDUP_AGE_MS)
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
    await pushServerChan(title, desp)
    lastPushOk = Date.now()
    consumeBudget()
    writeLog(`[push] 已推送 ${toPush.length} 条告警到微信: ${toPush.map((a) => (a.labels || {}).alertname).join(', ')}`)
    return true
  } catch (e) {
    writeLog(`[push] 失败: ${e.message}`)
    return false
  }
}

// 调用 Server酱 send 接口(form 表单)
function pushServerChan(title, desp) {
  if (!SENDKEY) {
    writeLog('[push] 未配置 SendKey,跳过推送')
    return
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
            let ok = res.statusCode >= 200 && res.statusCode < 300
            // Server酱 业务码: data.push_id >0 为成功
            try {
              const j = JSON.parse(data)
              if (j && (j.push_id || j.data && j.data.push_id)) ok = true
              if (j && j.errno !== undefined && j.errno !== 0) ok = false
            } catch (e) { /* not json */ }
            ok ? resolve(data) : reject(new Error(`Server酱 HTTP ${res.statusCode}: ${data.slice(0, 200)}`))
          })
        },
      )
      req.on('timeout', () => { req.destroy(new Error('Server酱 timeout')) })
      req.on('error', reject)
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
  // 去重: 只保留"该去重窗口内未推过"的告警(去重 Map 会持久化,重启不重置)
  let dedupedCount = 0
  const toPush = alerts.filter((a) => {
    const labels = a.labels || {}
    const isDup = shouldDedup(`${labels.alertname || ''}|${labels.instance || ''}`, now)
    if (isDup) dedupedCount++
    return !isDup
  })
  scheduleSave() // 去重状态落盘(3s 防抖),重启不丢失

  if (!toPush.length) {
    writeLog(`[alert] 全部命中去重窗口(${alerts.length}条/${{ alerts }.alerts.length}条),跳过推送`)
    return { skipped: dedupedCount }
  }

  // 冷却期内的新告警入队补发(有界队列,满了丢弃最旧批并记日志);不再直接丢弃
  enqueueAndDrain(toPush)
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
    return res.end(JSON.stringify({ ok: true, service: 'alert-webhook-bridge', keyConfigured: !!SENDKEY }))
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
      return res.end(JSON.stringify({ ok: false, error: String(e) }))
    }
  }

  res.writeHead(404)
  res.end()
})

server.listen(PORT, '127.0.0.1', () => {
  SENDKEY = loadSendKey()
  loadState() // 载入去重 + 每日预算(重启不失效)
  writeLog(`alert-webhook-bridge 启动, 监听 127.0.0.1:${PORT}, SendKey ${SENDKEY ? '已配置' : '未配置'}, 每日预算 ${DAILY_BUDGET} 条`)
})

// NSSM 常驻服务:退出前冲刷去重/预算状态(NSSM 停机或 Ctrl+C)
process.on('SIGINT', () => { saveState(); process.exit(0) })
process.on('SIGTERM', () => { saveState(); process.exit(0) })
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
