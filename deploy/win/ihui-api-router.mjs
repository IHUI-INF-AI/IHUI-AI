// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// API 蓝绿入口路由：监听 127.0.0.1:8802，把 HTTP / WebSocket 流量转发到当前活跃配色
// （blue=8842 / green=8843）。
//
// 为什么需要这一层：原部署流程是 sc.exe stop 旧 API → sleep → start 新 API，中间 20~30 秒
// 8802 没有监听；Next.js 代理与 cloudflared 打到空端口，前端拿到纯文本
// "Internal Server Error"，登录直接失败。有路由层后，8802 始终有人 listening，
// 部署变成「起另一色 → 健康 → 原子切 active → 排空 → 停旧色」，用户无感。
//
// 状态文件（由 ihui-api-bluegreen.ps1 原子写入）：
//   { "active": "blue", "blue": 8842, "green": 8843 }
//
// 启动：node ihui-api-router.mjs（NSSM 服务 IHUI-API-ROUTER）

import http from 'node:http'
import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'

import { createIpRateLimiter, isLoopbackAddress, resolveRateLimitConfig } from './lib/ip-rate-limit.mjs'
import { decideEdgeGuard, resolveEdgeGuardMode } from './lib/edge-origin-guard.mjs'
import {
  bgStatusVisibleTo,
  buildForwardHeaders,
  buildRejectionFrame,
  decideUpgradeAdmission,
  resolveRouterMaxConnections,
} from './lib/edge-admission.mjs'
import { applySecurityHeaders, resolveSecurityHeaderMode } from './lib/response-security.mjs'
import { inspectBody, inspectRequest, resolveWafMode, summarizeHits } from './lib/waf-signatures.mjs'
import { shouldSniff, sniffBody, createRollingScanner } from './lib/body-sniff.mjs'
import { buildNotice, renderNotice, renderMinimal } from './lib/block-notice.mjs'
import { createNoticeLedger, createNoticeWriter } from './lib/notice-ledger.mjs'
import { identifyTool } from './lib/tool-fingerprint.mjs'
import { buildReceipt, VERIFY_STATE } from './lib/evidence-verify.mjs'

// ── 通用化(2026-10-28 生产席:web 蓝绿复用同一份 router,不落第二份反代实现)────────
// 立因:web 走蓝绿也要一个"常驻监听 + 原子切流"的入口层,而另写一份 router 就是第二个真相源
// (§0.6:同类实现全仓只许一份,第二份必然漂移)。故把监听面/上游面/端口表全部改成 env 驱动,
// **缺省值与改造前逐字等价** ⇒ api 侧 8802/127.0.0.1/8842/8843 行为零变化。
// 为什么 LISTEN_HOST 与 UPSTREAM_HOST 必须分成两个:web 的 8801 必须监听 0.0.0.0
// (EdgeOne 源站直填本机公网 IP,只绑回环会让回源恒 522,2026-10-28 实测 8/8 轮判 GATE-ENTRY-BROKEN
//  即此);而两色 web 实例只监听 127.0.0.1,router 到上游仍走回环 ⇒ 上游主机不能跟着监听面改。
const LISTEN_HOST = process.env.IHUI_BG_ROUTER_HOST || '127.0.0.1'
const UPSTREAM_HOST = process.env.IHUI_BG_UPSTREAM_HOST || '127.0.0.1'
const LISTEN_PORT = Number(
  process.env.IHUI_API_ROUTER_PORT || process.env.IHUI_BG_ROUTER_PORT || 8802,
)
const STATE_FILE =
  process.env.IHUI_API_BG_STATE ||
  process.env.IHUI_BG_STATE ||
  'D:\\DevEnv\\ihui-prod\\deploy\\run\\api-bluegreen.json'
const DEFAULT_PORTS = {
  blue: Number(process.env.IHUI_BG_PORT_BLUE || 8842),
  green: Number(process.env.IHUI_BG_PORT_GREEN || 8843),
}
// 健康判据也要随被代理的那一个应用走:api 探 /api/health 要 `"status":"ok"`,
// web 探首页要 `<!DOCTYPE html`。缺省仍是 api 口径 ⇒ 现有 router 实例行为不变。
const HEALTH_PATH = process.env.IHUI_BG_HEALTH_PATH || '/api/health'
const HEALTH_MATCH = process.env.IHUI_BG_HEALTH_MATCH || '"status":"ok"'

function log(level, msg, extra = {}) {
  process.stdout.write(
    `${JSON.stringify({ time: new Date().toISOString(), level, msg, ...extra })}\n`,
  )
}

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    const active = parsed.active === 'green' ? 'green' : 'blue'
    return {
      active,
      blue: Number(parsed.blue) || DEFAULT_PORTS.blue,
      green: Number(parsed.green) || DEFAULT_PORTS.green,
      source: 'file',
    }
  } catch (e) {
    return { ...DEFAULT_PORTS, active: 'blue', source: 'default', error: String(e?.message || e) }
  }
}

let state = loadState()

// ── 入口限流(2026-10-29 加固)──────────────────────────────────────────────
// 线上入口就是本文件,**没有 nginx** —— deploy/nginx/conf.d/rate-limit.conf 的 6 套 zone
// 在本机生产从未装车(实测:无 nginx.exe 进程、无 docker,8802/8801 由本 router 承载)。
// 而 web 的 8801 必须绑 0.0.0.0(EdgeOne 回源直填公网 IP)⇒ 知道源站 IP 即可绕过边缘,
// 本层是唯一还能拦一手的。定位与阈值取舍见 lib/ip-rate-limit.mjs 头注。
const RATE_LIMIT = resolveRateLimitConfig()
const limiter = RATE_LIMIT.enabled
  ? createIpRateLimiter({ rps: RATE_LIMIT.rps, burst: RATE_LIMIT.burst })
  : null

// ── 连接数硬顶(2026-10-29 加固,第三层)────────────────────────────────────
// Node 缺省 `maxConnections = Infinity` —— 反代对「同时挂多少条 TCP」没有任何上限。
// headersTimeout 只保证单条连接不会永远挂着,挡不住「每秒建 N 条、30 秒内堆 30N 条」这种量:
// FD 与内存按连接数线性涨,而 router 一旦 OOM,全站入口同时消失(比被攻击更彻底)。
// 超顶时 Node 直接关掉新连接,已建立的照常服务。常量提前到此,因为启动日志要报它。
const MAX_CONNECTIONS = resolveRouterMaxConnections(process.env.IHUI_BG_MAX_CONNECTIONS)

// ── 上游响应安全头(2026-10-29 变更 C)───────────────────────────────────────
// 真实代码此前零安全响应头。web 由 next.config 自理(且同域 iframe 不能被 frame 头破坏),
// 故只在「API 上游实例」(监听回环)补,web 实例(监听 0.0.0.0)不加。判定见 lib/response-security.mjs。
// 用 env IHUI_BG_SECURITY_HEADERS=off 可显式关、=on 显式开(覆盖监听面推断)。
const ADD_SECURITY_HEADERS = resolveSecurityHeaderMode(
  process.env.IHUI_BG_SECURITY_HEADERS,
  LISTEN_HOST,
)

// ── 回源鉴权(2026-10-29 加固,第二层)───────────────────────────────────────
// 治「知道源站 IP 就能绕过 EdgeOne 直连」。第一层(防火墙只放行 EdgeOne 回源 IP 段)
// 必须在 EdgeOne 控制台拿 IP 段才能配,且只对付费套餐开放、3-6 个月变一次 —— 那一层
// 代码侧做不了。本层是腾讯云文档 1552/76086 自己建议叠加的「回源鉴权」:控制台
// 「规则引擎 → 修改 HTTP 回源请求头」注入 X-IHUI-Edge-Secret,源站只放行匹配的请求。
//
// 默认 off:线上关键路径上新装一个 403 开关,默认必须是「什么都不做」。
// 上线第一步必须走 observe(只统计不拦),确认正常流量都带头之后再切 enforce ——
// 直接 enforce 会把「控制台还没配」变成全站 403,那是自己把自己打瘫。
const EDGE_MODE = resolveEdgeGuardMode(process.env.IHUI_EDGE_SECRET_MODE)
const EDGE_SECRET = String(process.env.IHUI_EDGE_SECRET || '').trim()
const EDGE_GUARD_LOG_INTERVAL_MS = 10_000
let edgeGuardLogAt = 0
let edgeGuardDenied = 0

function logEdgeGuard(reason, ip) {
  const t = Date.now()
  if (t - edgeGuardLogAt < EDGE_GUARD_LOG_INTERVAL_MS) return
  edgeGuardLogAt = t
  log('warn', 'edge guard', { mode: EDGE_MODE, reason, ip, deniedTotal: edgeGuardDenied })
}

// 日志节流:被刷时每 IP 10s 只记一条,避免攻击本身把日志盘写满(那也是一种打垮)。
const RATE_LIMIT_LOG_INTERVAL_MS = 10_000
const rateLimitLogAt = new Map()

function logRateLimited(ip, verdict) {
  const t = Date.now()
  const last = rateLimitLogAt.get(ip) ?? 0
  if (t - last < RATE_LIMIT_LOG_INTERVAL_MS) return
  rateLimitLogAt.set(ip, t)
  // 这个 Map 只在「被限流的 IP」上增长;超限时直接清空(宁可丢几条日志,不换内存泄漏)
  if (rateLimitLogAt.size > 10_000) rateLimitLogAt.clear()
  log('warn', 'rate limited', { ip, retryAfterSec: verdict.retryAfterSec })
}

// ── 载荷级 WAF(2026-11-24 立,第四层)──────────────────────────────────────
// 前三层只看「谁在发、发多快」,不看「发了什么」:带正确回源密钥(或任意直连)的请求里
// 塞 union select / <script> / ../../ 会原样直达上游。判据在 lib/waf-signatures.mjs
// (纯函数,逐条用例钉住);这里只负责接线与日志。
//
// 默认 enforce:高危规则(注入/穿越/扫描器/恶意方法)直接 403;medium 规则只记录。
// 误报排查时用 IHUI_WAF_MODE=observe 降级(只记不拦),不要用 off —— off 等于整层消失。
const WAF_MODE = resolveWafMode(process.env.IHUI_WAF_MODE)
const WAF_LOG_INTERVAL_MS = 10_000
const wafLogAt = new Map()
let wafBlocked = 0

/** 日志节流同限流:被刷时每 IP 10s 一条,且只记 path 不记 query(不把攻击载荷写回日志)。 */
function logWaf(ip, waf, url) {
  const t = Date.now()
  const last = wafLogAt.get(ip) ?? 0
  if (t - last < WAF_LOG_INTERVAL_MS) return
  wafLogAt.set(ip, t)
  if (wafLogAt.size > 10_000) wafLogAt.clear()
  log('warn', waf.action === 'block' ? 'waf blocked' : 'waf observed', {
    mode: WAF_MODE,
    ip,
    rules: summarizeHits(waf.hits),
    path: String(url ?? '').split('?')[0].slice(0, 200),
    blockedTotal: wafBlocked,
  })
}

// ── 拦截告知(2026-11-24;二轮:计数 + 批量落盘)──────────────────────────
const NOTICE_LOG = process.env.IHUI_BLOCK_NOTICE_LOG || 'D:\\DevEnv\\logs\\block-notice.jsonl'
// 计数从日志尾部重建:router 重启不该让老对手回到"第一次"——那等于每次重启都把账清空。
const noticeLedger = createNoticeLedger({ logPath: NOTICE_LOG })
// 批量写:初版每个 403 一次 appendFileSync,500rps 就是 500 次/秒同步 IO,
// 攻击者用请求量就能把拒绝路径拖成瓶颈 —— 这是自己给自己造的 DoS 放大面。
const noticeWriter = createNoticeWriter({ logPath: NOTICE_LOG })
process.on('exit', () => noticeWriter.flush())

// 封禁台账 60s 缓存:在册是"终局信息",告诉对方"你已在册、到期 X"比任何劝阻都实。
// 反直觉但真实:被封的 IP 在防火墙层就被丢了,理论上到不了这里 —— 一旦它到了,
// 说明规则没生效或只生效了一半,那更该把这件事明说。
const BLOCKLIST_PATH = process.env.IHUI_BLOCKLIST_PATH || 'D:\\IHUI-AI\\.ihui-agent\\state\\attack-blocklist.json'
const BLOCKLIST_TTL_MS = 60_000
let blocklistCache = { at: 0, entries: {} }

function bannedState(ip) {
  const now = Date.now()
  if (now - blocklistCache.at > BLOCKLIST_TTL_MS) {
    try {
      const j = JSON.parse(fs.readFileSync(BLOCKLIST_PATH, 'utf8'))
      blocklistCache = { at: now, entries: j?.entries ?? {} }
    } catch {
      // 读不到就沿用上一份快照:宁可用旧账,也不要在拒绝路径上抛异常
      blocklistCache = { at: now, entries: blocklistCache.entries }
    }
  }
  const e = blocklistCache.entries?.[ip]
  if (!e || e.applied === false) return null
  return { expiresAt: e.expiresAt ?? e.expires ?? null }
}

/** 落一条「已告知」记录:对外文案说"已取证"必须有这条撑着,否则就是空口威慑。 */
function recordNotice(notice, ip, url) {
  noticeWriter.push({
    ts: notice.at,
    ref: notice.ref,
    status: notice.status,
    reason: notice.reason,
    ip,
    attempt: notice.attempt,
    // 工具名必须落盘:文案里写了"已记进本次证据",不留这一笔就是空口威慑。
    // 名字来自白名单常量(不是请求原文),可以安全落盘。
    tool: notice.tool?.name ?? null,
    // 是否降级成最小版:复盘时要能回答"高压时降级到底生效了没有"
    minimal: notice.minimal === true,
    // 只记长度,不记原文:path 里可能就带攻击载荷,写回日志等于二次传播
    pathLen: String(url ?? '').length,
  })
}

// 拒绝速率窗口:告诉攻击者"你被记住了"是有代价的 —— 完整版 3.4KB,他发 1 字节就换走。
// 高压时降级到 218 字节最小版(编号/次数/落点句一个字不删),不给对手当放大器。
const NOTICE_FULL_RPS = Number(process.env.IHUI_NOTICE_FULL_RPS || 40)
const denyStamps = []
function noticeUnderPressure() {
  const now = Date.now()
  while (denyStamps.length && now - denyStamps[0] >= 1000) denyStamps.shift()
  denyStamps.push(now)
  if (denyStamps.length > 100_000) denyStamps.splice(0, denyStamps.length - 1024)
  return denyStamps.length > NOTICE_FULL_RPS
}

/**
 * WS 握手的拒绝出口。**与 HTTP 同源,不另开一套话术**。
 *
 * 立因(2026-11-24 自检):`socket.end(buildRejectionFrame(403,'waf'))` 是第 4 条拒绝路径,
 * 它只回一个 `{"code":403,"message":"waf"}` —— 既没送那句话,还把"你撞的是哪一道"直接
 * 告诉了对手。WS 是扫描器很爱走的通道,漏掉它等于给对手留一扇没贴告示的门。
 */
function denyUpgrade(socket, status, reason, retryAfterSec = 0) {
  const ip = socket.remoteAddress || ''
  try {
    const { attempt, prevRef } = noticeLedger.peek(ip)
    const notice = buildNotice({
      ip,
      path: '(ws-upgrade)',
      reason,
      status,
      attempt,
      prevRef,
      tool: identifyTool('', {}),
      banned: bannedState(ip),
    })
    // WS 一律最小版:握手层高频,完整 HTML 在这里毫无意义还放大出口
    const out = renderMinimal(notice)
    notice.minimal = true
    noticeLedger.commit(ip, notice.ref)
    recordNotice(notice, ip, '(ws-upgrade)')
    socket.end(buildRejectionFrame(status, reason, retryAfterSec, { text: out.body.toString('utf8'), headers: out.headers }))
  } catch {
    try {
      socket.end(buildRejectionFrame(status, reason))
    } catch {
      /* 对端已断 */
    }
  }
}

/** 统一拒绝出口:403/429 都由这里出,保证每个被拦的请求收到同一套告知。
 *
 * 这里必须自己兜住异常:拒绝路径是攻击者可以直接触发的代码,
 * 它一旦抛出去就是「打一个 403 把 router 打崩」——实测已发生过一次
 * (中文塞进响应头 ⇒ ERR_INVALID_CHAR ⇒ 进程退出)。文案渲染出任何问题,
 * 都退回最小 ASCII 403,绝不让进程陪葬。
 */
function denyWithNotice(req, res, status, reason, extraHeaders = {}) {
  const ip = req.socket.remoteAddress || ''
  try {
    // peek → build → commit 的顺序不能反:prevRef 必须是"上一次"的编号,
    // 先把本次 commit 掉,引用的就成了自己。
    const { attempt, prevRef } = noticeLedger.peek(ip)
    const notice = buildNotice({
      ip,
      path: req.url,
      reason,
      status,
      attempt,
      prevRef,
      // 这两样都是"对方自己就能核对的事实":工具特征写在 UA 里,封禁到期写在防火墙规则里
      tool: identifyTool(req.headers?.['user-agent'] ?? '', req.headers ?? {}),
      banned: bannedState(ip),
    })
    // 429 一律降级(限流语义本身就是"你太快了"),403 只在全局高压时降级。
    // 判在前、渲染在后:这个顺序决定了本次也计入压力,不会"最后一条永远是大响应"。
    const minimal = status === 429 || noticeUnderPressure()
    const out = minimal ? renderMinimal(notice) : renderNotice(req.headers.accept || '', notice)
    notice.minimal = minimal
    noticeLedger.commit(ip, notice.ref)
    recordNotice(notice, ip, req.url)
    /* 零延迟可核验:批量写有 1 秒窗口,攻击者手快就会撞上"还没落盘"的那一秒 */
    rememberRef(notice.ref, notice.at)
    res.writeHead(status, { ...out.headers, ...extraHeaders })
    res.end(out.body)
  } catch {
    const fallback = Buffer.from(
      status === 429 ? '{"code":429,"message":"too many requests"}' : '{"code":403,"message":"forbidden"}',
    )
    try {
      if (!res.headersSent) {
        res.writeHead(status, { 'content-type': 'application/json', 'content-length': fallback.length })
      }
      res.end(fallback)
    } catch {
      /* 对端已断,无从告知 */
    }
  }
}

log('info', 'router started', {
  listen: `${LISTEN_HOST}:${LISTEN_PORT}`,
  state: STATE_FILE,  active: state.active,
  upstream: state[state.active],
  source: state.source,
  rateLimit: RATE_LIMIT.enabled ? `${RATE_LIMIT.rps}rps/${RATE_LIMIT.burst}burst` : 'off',
  // 连接数硬顶必须报出来:运维要能一眼确认「上限是多少」,而不是去翻 env 或读源码。
  maxConnections: MAX_CONNECTIONS,
  // 必须报出来:运维要能一眼确认「回源鉴权到底开没开」,而不是去翻 env。
  // 配了 observe/enforce 却没给密钥 ⇒ 实际不拦,这里明说,免得被当成已生效。
  edgeGuard:
    EDGE_MODE === 'off'
      ? 'off'
      : EDGE_SECRET
        ? EDGE_MODE
        : `${EDGE_MODE}(缺 IHUI_EDGE_SECRET ⇒ 实际不拦)`,
  // 同样报出:运维要能确认「API 响应安全头到底补没补」,以及是否因 web 实例而自动跳过。
  securityHeaders: ADD_SECURITY_HEADERS ? 'on' : 'off',
  // WAF 档位必须报出来:observe 与 enforce 只差一个拦截分支,日志里必须能分辨。
  waf: WAF_MODE,
})

// 状态文件变化即热切换；1s 轮询足以让部署脚本「写完即生效」，又不必依赖 fs.watch 的
// 平台差异（Windows 上 rename 覆盖会触发 rename 事件，但断线重连时 watch 会丢）。
fs.watchFile(STATE_FILE, { interval: 1000 }, () => {
  const next = loadState()
  if (next.active !== state.active || next.blue !== state.blue || next.green !== state.green) {
    log('info', 'active upstream switched', {
      from: `${state.active}:${state[state.active]}`,
      to: `${next.active}:${next[next.active]}`,
    })
    state = next
  }
})

/** 主上游优先，另一色兜底（某色进程挂了也不至于全站 502）。 */
function upstreams() {
  return [state[state.active], state[state.active] === 'blue' ? state.green : state.blue]
}

function sendJson(res, status, body) {
  if (res.headersSent) {
    res.destroy()
    return
  }
  const buf = Buffer.from(JSON.stringify(body))
  res.writeHead(
    status,
    applySecurityHeaders(
      { 'content-type': 'application/json', 'content-length': buf.length },
      ADD_SECURITY_HEADERS,
    ),
  )
  res.end(buf)
}


// ── 证据编号公开核验(2026-11-25 立,第二十件)──────────────────────────────
//
// 为什么必须是公开端点:对外文案写着「编号可被任何第三方核验」。此前只有内部能验,
// 那句话就是悬空的 —— 而它恰恰印在攻击者会读到的拦截页上。**承诺悬空比不承诺更糟**。
//
// 为什么放在回源鉴权之前:核验者就是攻击者本人,他没有我们的边缘密钥。
// 代价是拿不到那一层的保护,所以这里自己做三件事:
//   ① 自己过一遍 WAF(否则它就成了一条绕过 WAF 的公开路径)
//   ② 只回哈希与时间,**不回显 IP / UA / 载荷** —— 核验要证明"存在且没被改",
//      不需要把攻击内容再投递他一次
//   ③ 读不到链文件回 503,**绝不**回 found:false —— "不知道"和"没有"是两件事,
//      把取不到说成"查无此号"等于替篡改打掩护
const EVIDENCE_CHAIN_PATH = process.env.IHUI_EVIDENCE_CHAIN || 'D:/IHUI-AI/.ihui-agent/state/evidence-chain.jsonl'
const EVIDENCE_ANCHOR_PATH = process.env.IHUI_EVIDENCE_ANCHORS || 'D:/IHUI-AI/.ihui-agent/state/evidence-anchors.jsonl'
/**
 * 拦截瞬间的编号内存环(2026-11-25 实测补上)。
 *
 * `noticeWriter` 是**批量写**(`flushMs` 1 秒),链由 autoban 每 10 分钟吸收一轮。
 * 攻击者若在被拦后 1 秒内拿编号来查,文件里还没有它 —— 没有这一环就只能如实回 404,
 * 而 404 的含义只有一个:"我没记录过你"。他刚被拦、编号就在眼前,这句话是假的。
 * 记进内存,零延迟即可回 `pending`;环有上限,旧条目被淘汰时它早已落在文件里。
 */
const RECENT_REF_MAX = 2048
const recentRefs = new Map()

function rememberRef(ref, at) {
  if (!ref) return
  recentRefs.set(String(ref).toUpperCase(), at ?? null)
  if (recentRefs.size > RECENT_REF_MAX) {
    const oldest = recentRefs.keys().next().value
    recentRefs.delete(oldest)
  }
}

/**
 * 告知日志。编号在**拦下攻击者那一刻**就写进这里,而链由 autoban 每 10 分钟吸收一轮。
 * 之所以要读它,是为了区分「已开票、写入中」和「我没记录过」—— 混成一句等于告诉对方
 * "这编号是编的"。只读尾部:文件会轮转(8MB 上限),历史条目在链里已经有,不必全读。
 *
 * 路径**必须**复用上面那个 `NOTICE_LOG`(L181):它是告知写入的唯一真相源。
 * 另立一个 env 名会在日志被重定向时读到不存在的旧文件 —— 那时端点会对**所有**编号
 * 都回 `not_found`,把"我记过你"说成"我没记过你"。
 */
const EVIDENCE_NOTICE_TAIL_BYTES = 512 * 1024
const EVIDENCE_CACHE_MS = 5000
const EVIDENCE_PREFIX = '/__evidence/'
let evidenceCache = { at: 0, entries: null, anchors: null, notices: null, error: null }

function readJsonLines(file) {
  const out = []
  const text = fs.readFileSync(file, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue
    out.push(JSON.parse(line))
  }
  return out
}

/** 尾部若干字节按行切,首行可能是被截断的半行 —— 丢弃,不猜。 */
function readTailObjects(file, bytes) {
  let size
  try {
    size = fs.statSync(file).size
  } catch {
    return null
  }
  const start = Math.max(0, size - bytes)
  const len = size - start
  if (len <= 0) return []
  const buf = Buffer.alloc(len)
  let fd
  try {
    fd = fs.openSync(file, 'r')
    fs.readSync(fd, buf, 0, len, start)
  } catch {
    return null
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd)
      } catch {
        /* 已关 */
      }
    }
  }
  const lines = buf.toString('utf8').split(/\r?\n/)
  if (start > 0) lines.shift()
  const out = []
  for (const line of lines) {
    if (!line) continue
    try {
      out.push(JSON.parse(line))
    } catch {
      /* 半行/坏行跳过:核验失败不能因为日志里有一行不完整就整体 503 */
    }
  }
  return out
}

function loadEvidence(now) {
  if (evidenceCache.entries && now - evidenceCache.at < EVIDENCE_CACHE_MS) return evidenceCache
  let entries = null
  let anchors = []
  let notices = {}
  let error = null
  try {
    entries = readJsonLines(EVIDENCE_CHAIN_PATH)
    if (fs.existsSync(EVIDENCE_ANCHOR_PATH)) anchors = readJsonLines(EVIDENCE_ANCHOR_PATH)
  } catch (e) {
    entries = null
    error = String(e?.message || e).split(/\r?\n/)[0]
  }
  /* 告知日志读不到不影响「链里能查到」的那部分:它是补充证据,不是主证据 */
  const rows = readTailObjects(NOTICE_LOG, EVIDENCE_NOTICE_TAIL_BYTES)
  if (rows) {
    for (const r of rows) {
      const ref = String(r?.ref ?? '').toUpperCase()
      /* 告知条目里的时刻字段叫 `ts`(实测原文: {"ts":...,"ref":...}),
         写成 `at` 会静默取到 null ⇒ 所有编号都回 not_found ⇒ "我记过你"变成"我没记过你"。 */
      if (ref) notices[ref] = r?.ts ?? r?.at ?? null
    }
  }
  evidenceCache = { at: now, entries, anchors, notices, error }
  return evidenceCache
}

const server = http.createServer(async (req, res) => {
  // 运维探针：给部署脚本确认「路由在跑、当前是哪一色」。
  //
  // 2026-10-29 加固:原注释写「仅本机可达（监听 127.0.0.1）」,那只对 API router 成立 ——
  // WEB router 复用同一份实现且监听 0.0.0.0,实测公网可读走「活跃色 + 两色内部端口」。
  // 故判据从"我以为它监听在哪"改成按**来源**:非回环一律 404(与未知路径同形,
  // 不回 403 —— 403 等于承认端点存在)。
  if (req.url === '/__bg/status') {
    if (!bgStatusVisibleTo(req.socket.remoteAddress || '')) {
      sendJson(res, 404, { code: 404, message: 'not found' })
      return
    }
    sendJson(res, 200, { ok: true, active: state.active, upstream: state[state.active] })
    return
  }
  // 证据核验。放在回源鉴权之前(核验者拿不到边缘密钥),因此自己补一遍 WAF。
  if (req.url.startsWith(EVIDENCE_PREFIX)) {
    const wafV = inspectRequest({ method: req.method, url: req.url, headers: req.headers })
    if (wafV.action === 'block') {
      const id = wafV.hits?.[0]?.id ?? 'waf'
      denyWithNotice(req, res, 403, `waf:${id}`)
      return
    }
    if (req.method !== 'GET') {
      sendJson(res, 405, { code: 405, message: 'method not allowed' })
      return
    }
    const ev = req.url.slice(EVIDENCE_PREFIX.length)
    const loaded = loadEvidence(Date.now())
    if (!loaded.entries) {
      /* 取不到输入 = 未判定,如实回 503,不用 found:false 冒充"查无此号" */
      sendJson(res, 503, { code: 503, message: 'evidence store unavailable' })
      return
    }
    const out = buildReceipt({
      entries: loaded.entries,
      anchors: loaded.anchors,
      ev,
      /* 三源依次:内存环(零延迟) → 告知日志(已落盘) → 都没有才是真没记录过 */
      noticedAt: recentRefs.get(String(ev).trim().toUpperCase()) ?? loaded.notices?.[String(ev).trim().toUpperCase()] ?? null,
    })
    if (out.state === VERIFY_STATE.INVALID) {
      sendJson(res, 400, { code: 400, message: out.reason })
      return
    }
    if (out.state === VERIFY_STATE.PENDING) {
      /* 已开票、写入中:200 + pending。这不是错误,是"我们确实记过你" */
      sendJson(res, 200, out.receipt)
      return
    }
    if (out.state === VERIFY_STATE.NOT_FOUND) {
      /* 404 与"路径不存在"同形,不给枚举者额外信号 */
      sendJson(res, 404, { code: 404, message: 'not found' })
      return
    }
    sendJson(res, 200, out.receipt)
    return
  }
  // 回源鉴权在限流**之前**:直连攻击者不带头 ⇒ 直接 403,不必再为它耗一个限流令牌;
  // 正常流量经 EdgeOne 带头 ⇒ 通过后再进限流。两道都是「便宜的先做」。
  //
  // 结论要传给转发层做 IP 归一(buildForwardHeaders 只信"确实经边缘"的请求),
  // 故用块外变量承接 —— 写在块内则转发层读不到,归一退化成"全按直连处理"。
  let edgeReason = 'off'
  if (EDGE_MODE !== 'off') {
    const ip = req.socket.remoteAddress || ''
    const verdict = decideEdgeGuard({
      mode: EDGE_MODE,
      secret: EDGE_SECRET,
      loopback: isLoopbackAddress(ip),
      headers: req.headers,
    })
    edgeReason = verdict.reason
    if (verdict.action === 'observe') {
      logEdgeGuard(verdict.reason, ip)
    } else if (verdict.action === 'deny') {
      edgeGuardDenied += 1
      logEdgeGuard(verdict.reason, ip)
      denyWithNotice(req, res, 403, `edge-guard:${verdict.reason}`)
      return
    }
  }
  // 载荷级 WAF:回源鉴权只认「是不是边缘」,这里认「发的是什么」——
  // 带正确密钥的伪造请求、或边缘放行过来的扫描器,在这一层被拦。
  // 放在限流之前:被 WAF 判死的请求不该再消耗一个令牌(便宜的先做,与上面两道同序)。
  // 体重放:`sniffBody` 在 `end` 分支拿不到放回的机会(流已结束),由转发层整段补写。
  // 声明在块外 —— 写在块内转发层读不到,chunked 小体就会以空体送上游。
  let bodyReplay = null
  // 体流式扫描(2026-11-25 补):大体与 chunked 走这条 —— 它只旁听 data、不消费原流,
  // 因此把 8192 那个"载荷藏在大体后面就绕过"的上限抬掉了。
  let bodyScanner = null
  if (WAF_MODE !== 'off') {
    // 体嗅探(2026-11-25 立):改造前 WAF 只看 URL / UA / method,POST 里的载荷整层看不见 ——
    // 只要把注入放进 JSON/form 体里,前 21 条规则一条都不会命中。
    // 有界读取的铁律写在 lib/body-sniff.mjs 头注,这里只负责接线:
    //   · 小体 ⇒ 转发前整段读到再判,命中就 403,上游什么都收不到;
    //   · 大体/chunked ⇒ 转发中滚动判,命中就断上游(请求未完成,上游不会当成有效调用);
    //   · 任何异常都吞掉并回落 null —— 这一层绝不能因为"想多扫一眼"把正常请求打坏。
    let body = null
    try {
      const sniff = shouldSniff(req.headers)
      if (sniff.sniff) {
        if (sniff.stream) {
          bodyScanner = createRollingScanner({ inspect: inspectBody })
        } else {
          const r = await sniffBody(req, { expected: sniff.expected })
          body = r.text
          if (r.why === 'end' && r.bytes) bodyReplay = r.merged
        }
      }
    } catch {
      body = null
      bodyScanner = null
    }
    const waf = inspectRequest({ method: req.method, url: req.url, headers: req.headers, body })
    if (waf.action === 'block') {
      wafBlocked += 1
      logWaf(req.socket.remoteAddress || '', waf, req.url)
      if (WAF_MODE === 'enforce') {
        // 拒了就要把没消费的请求体丢掉,否则 keep-alive 复用这条连接时脏字节会串到下一条请求。
        try {
          req.resume()
        } catch {
          /* 已结束就没什么可丢的 */
        }
        denyWithNotice(req, res, 403, 'waf')
        return
      }
    } else if (waf.action === 'observe') {
      logWaf(req.socket.remoteAddress || '', waf, req.url)
    }
  }
  if (limiter) {
    // key = TCP 对端地址(不可伪造)。绝不用 X-Forwarded-For:那是客户端可任意改的头,
    // 拿它当 key 等于把限流开关交给攻击者(每请求换一个假 IP 即绕过)。
    const ip = req.socket.remoteAddress || 'unknown'
    // 回环豁免:内部服务(ai-service → /api/internal/*)与健康检查都从这里进来,
    // 不豁免会让一次批量内部调用把自己的通道限死(加固把自己打瘫)。见 lib 头注。
    if (!isLoopbackAddress(ip)) {
      const verdict = limiter.check(ip)
      if (!verdict.allowed) {
        logRateLimited(ip, verdict)
        denyWithNotice(req, res, 429, 'rate-limit', { 'retry-after': String(verdict.retryAfterSec) })
        return
      }
    }
  }
  proxyHttp(req, res, 0, edgeReason, bodyReplay, bodyScanner)
})

// 慢速攻击面收口(2026-10-29):Node 默认 headersTimeout=60s / requestTimeout=300s,
// 一个连接可以慢吞吞喂头/喂体占住 socket 五分钟。本服务正常请求远达不到这两个量级
// (API 体上限 2MiB),故收紧到 30s/120s —— 对合法用户无感,对 slowloris 直接断。
server.headersTimeout = 30_000
server.requestTimeout = 120_000

// 连接数硬顶(2026-10-29):常量见文件上方 MAX_CONNECTIONS(启动日志已报出)。
server.maxConnections = MAX_CONNECTIONS

function proxyHttp(req, res, attempt, edgeReason = 'off', replay = null, bodyScanner = null) {
  const ports = upstreams()
  const port = ports[attempt]
  if (!port) {
    sendJson(res, 502, { code: 502, message: 'api upstream unavailable' })
    return
  }

  // 体流式判定命中后,这条请求已经"判死":后面的代理错误、上游响应都不该再改判。
  // 声明在 upReq 之前 —— 它的监听器全都要看见这个标志。
  let wafMidBlocked = false

  const upReq = http.request({
    host: UPSTREAM_HOST,
    port,
    method: req.method,
    path: req.url,
    // 不是 req.headers 原样透传:客户端可整写 IP 类头,原样转给上游等于把
    // "我是谁" 的决定权交给它(限流键、风控、审计全部随之失真)。见 buildForwardHeaders。
    headers: buildForwardHeaders({
      headers: req.headers,
      remoteAddress: req.socket.remoteAddress,
      edgeMode: EDGE_MODE,
      edgeReason,
      // 本实例只监听回环(127.0.0.1)⇒ 是内部 API 路由,上游只能来自公网路由 8801,
      // 可把 8801 注入的 verified 标记透传给 API 上游实例(ai-service per-user 限流要用)。
      // 公网路由 8801(监听 0.0.0.0)传 false:只认自己比对的 secret,绝不信任公网自带该头。
      trustInboundVerified: LISTEN_HOST === '127.0.0.1',
    }),
  })

  upReq.on('response', (upRes) => {
    if (wafMidBlocked) {
      // 已经按体命中判死了(我们主动断了上游),这条响应是竞态里漏出来的,不再往下游送。
      upRes.resume()
      return
    }
    // 补安全响应头(变更 C):只补上游没设的,不覆盖 api 自身已设的安全头。
    res.writeHead(upRes.statusCode || 502, applySecurityHeaders(upRes.headers, ADD_SECURITY_HEADERS))
    upRes.pipe(res)
  })

  upReq.on('error', (err) => {
    // 断上游是我们自己做的,这个 error 是那一下的副产物 —— 不能当成代理故障再回 502,
    // 否则 403 告知页会被一个 502 覆盖掉(或者反过来写两次头)。
    if (wafMidBlocked) return
    // 连接被拒 = 请求还没进入应用，重放到另一色是安全的；POST 也可（未产生副作用）。
    // 但只重放一次，且只针对连接级错误 —— 已经建立连接后的 reset 不重放，避免重复下单。
    if ((err.code === 'ECONNREFUSED' || err.code === 'EHOSTUNREACH') && attempt === 0) {
      log('warn', 'primary upstream refused, retrying secondary', {
        primary: ports[0],
        secondary: ports[1],
        url: req.url,
      })
      // replay 必须一起带过去:body 已被嗅探读走(原流已 end),不带就是让重放那次发空体。
      // scanner 同样要带:不带等于"首色一拒连,体规则对这次重试就整层失效"。
      proxyHttp(req, res, 1, edgeReason, replay, bodyScanner)
      return
    }
    log('error', 'proxy error', { port, url: req.url, code: err.code, message: err.message })
    sendJson(res, 502, { code: 502, message: 'api upstream unavailable' })
  })

  res.on('close', () => {
    if (!res.writableEnded) upReq.destroy()
  })
  // 体流式判定(2026-11-25 补):只**旁听** data,不消费原流 —— 所以不存在"读完放不回去"。
  // 命中时上游可能已收到一部分体,但请求没有写完,上游不会把它当成一次有效调用;
  // 不断开的话,藏在 8192 之后的载荷会照常进入业务层 —— 那正是这条路线要堵的口子。
  if (bodyScanner) {
    req.on('data', (chunk) => {
      if (wafMidBlocked) return
      let hits = null
      try {
        hits = bodyScanner.push(chunk)
      } catch {
        return
      }
      if (!hits || !hits.length) return
      if (WAF_MODE !== 'enforce') {
        // observe 档:只留证据,让请求照常跑完(与整段判定那一档同形)。
        logWaf(req.socket.remoteAddress || '', { action: 'block', hits }, req.url)
        return
      }
      wafMidBlocked = true
      wafBlocked += 1
      logWaf(req.socket.remoteAddress || '', { action: 'block', hits }, req.url)
      try {
        upReq.destroy()
      } catch {
        /* 已断就不用再断 */
      }
      try {
        req.resume()
      } catch {
        /* 已结束就没什么可丢的 */
      }
      if (res.headersSent) return
      denyWithNotice(req, res, 403, 'waf')
    })
  }
  // 整段重放(2026-11-25):嗅探把 body 读完时原流已 `end`,`unshift` 无处可放 ——
  // 不补这一步,chunked 的小请求会以空体到上游(改造前是完整的,这就是回归)。
  //
  // 这里**不能**再 `req.pipe(upReq)`:原流已经 end,`end` 事件早就错过,pipe 就永远等不到
  // 结束信号 ⇒ upReq 不会 end ⇒ 上游一直挂着,请求直接死在那里(实测第一版就是这么挂住的)。
  // 整段字节都在 replay 里,写完直接 end,语义等价于"把整条流灌过去再关"。
  if (replay && replay.length) {
    try {
      upReq.write(replay)
      upReq.end()
    } catch {
      /* 写失败交给下面 upReq 的 error 分支,不在这里改判 */
    }
    return
  }
  req.pipe(upReq)
}

// WebSocket：手工做 HTTP Upgrade 透传（不引第三方依赖，避免 pnpm 隔离目录解析问题）
//
// 2026-10-29 加固:这条分支此前**完全绕过**上面两道闸 —— `server.on('upgrade')` 是独立
// 回调,拿到连接就直接 net.connect,既不验回源密钥也不过令牌桶。攻击者只要在请求行写
// `Upgrade: websocket`,就能以任意速率、任意条数直连上游,限流日志里一条都不留。
// 判定抽到 lib/edge-admission.mjs 并做成纯函数 —— 原实现内联在回调里时,想验证只能起
// 真 router 发真握手,而「从非回环地址发」在本机结构上做不到,这条路径永远测不到。
server.on('upgrade', (req, socket, head) => {
  // 先挂 error:拒绝路径要往 socket 写响应帧,对端此刻已断时 write 会 EPIPE,
  // 没有 handler 就是整个 router 进程崩(那等于攻击者用一次断连打掉入口)。
  let upSocket = null
  socket.on('error', () => {
    if (upSocket) upSocket.destroy()
    else socket.destroy()
  })

  const admission = decideUpgradeAdmission({
    edgeMode: EDGE_MODE,
    edgeSecret: EDGE_SECRET,
    remoteAddress: req.socket.remoteAddress || '',
    headers: req.headers,
    // 与 HTTP 分支共用同一个桶:各建一个等于把阈值悄悄翻倍。
    checkRate: limiter ? (ip) => limiter.check(ip) : null,
  })

  if (!admission.allow) {
    if (admission.reason === 'edge-guard') edgeGuardDenied += 1
    log('warn', 'ws handshake rejected', {
      reason: admission.reason,
      status: admission.status,
      edgeReason: admission.edgeReason,
      ip: req.socket.remoteAddress || '',
      url: req.url,
    })
    try {
      denyUpgrade(socket, admission.status, admission.reason, admission.retryAfterSec)
    } catch {
      /* 对端已断,下面统一销毁 */
    }
    socket.destroy()
    return
  }
  // observe 档下不拦,但要留下「这条握手是直连来的」证据 —— 与 HTTP 分支同一口径。
  // 不记的话,直连攻击者只要改走 WS 就能在 observe 统计里彻底隐身。
  if (EDGE_MODE !== 'off' && admission.edgeReason !== 'match' && admission.edgeReason !== 'loopback') {
    logEdgeGuard(admission.edgeReason, req.socket.remoteAddress || '')
  }

  // WS 握手同样过 WAF:否则攻击者只要在请求行写 Upgrade,就能把这一层整层绕开 ——
  // 与 2026-10-29「回源鉴权/限流被 upgrade 分支整层绕过」同型缺口,这次在接线时就堵上。
  if (WAF_MODE !== 'off') {
    const waf = inspectRequest({ method: req.method, url: req.url, headers: req.headers })
    if (waf.action === 'block') {
      wafBlocked += 1
      logWaf(req.socket.remoteAddress || '', waf, req.url)
      if (WAF_MODE === 'enforce') {
        try {
          denyUpgrade(socket, 403, 'waf')
        } catch {
          /* 对端已断,下面统一销毁 */
        }
        socket.destroy()
        return
      }
    } else if (waf.action === 'observe') {
      logWaf(req.socket.remoteAddress || '', waf, req.url)
    }
  }

  const port = upstreams()[0]
  // WS 握手同样要过 IP 归一:API 侧的 ws-guard 拿这个头当单 IP 并发/握手的限流键,
  // 原样透传客户端头就等于把限流开关交出去。
  const forwardHeaders = buildForwardHeaders({
    headers: req.headers,
    remoteAddress: req.socket.remoteAddress,
    edgeMode: EDGE_MODE,
    edgeReason: admission.edgeReason,
    // 同 HTTP 分支:内部 API 路由透传 verified,公网路由不信任入站该头。
    trustInboundVerified: LISTEN_HOST === '127.0.0.1',
  })
  upSocket = net.connect(port, UPSTREAM_HOST, () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`]
    for (const [k, v] of Object.entries(forwardHeaders)) {
      lines.push(`${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    }
    upSocket.write(`${lines.join('\r\n')}\r\n\r\n`)
    if (head && head.length) upSocket.write(head)
    upSocket.pipe(socket)
    socket.pipe(upSocket)
  })
  upSocket.on('error', (err) => {
    log('warn', 'ws upstream error', { port, code: err.code, url: req.url })
    socket.destroy()
  })
  socket.on('close', () => {
    if (upSocket) upSocket.destroy()
  })
})

server.on('error', (err) => {
  log('error', 'router listen failed', { code: err.code, message: err.message })
  process.exit(1)
})

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  log('info', 'listening', { addr: `${LISTEN_HOST}:${LISTEN_PORT}` })
  void reconcileActiveAtBoot()
})

/**
 * 开机对账（2026-10-28 加）：状态文件记的活跃色可能压根没起来 —— 典型是上次活跃停在
 * green（green 是 SERVICE_DEMAND_START），机器重启后只有 blue 自动启动。此时若不改写，
 * 每个请求都要先吃一次 ECONNREFUSED 再兜底，而且部署脚本会把唯一在服务的 blue 当成
 * "待升级色"停掉重起 —— 那是一次真实停机。
 *
 * 只在启动时跑一次，且只在"活跃色探不通、另一色可服务"时改写；两色都探不通时不动状态
 * （那是真故障，交给监控，不靠路由猜）。
 */
async function reconcileActiveAtBoot() {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    const active = state.active
    const other = active === 'blue' ? 'green' : 'blue'
    if (await probeHealth(state[active])) {
      if (state.source !== 'file') {
        writeStateFile(active, state)
        state = { ...state, source: 'file' }
        log('info', 'boot reconcile: state file seeded', { active, port: state[active] })
      }
      return
    }
    if (await probeHealth(state[other])) {
      writeStateFile(other, state)
      log('warn', 'boot reconcile: active color unreachable, adopted the other', {
        from: `${active}:${state[active]}`,
        to: `${other}:${state[other]}`,
      })
      state = { ...state, active: other, source: 'file' }
      return
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
  log('warn', 'boot reconcile: neither color answered /api/health', {
    active: state.active,
    blue: state.blue,
    green: state.green,
  })
}

function probeHealth(port) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: UPSTREAM_HOST, port, path: HEALTH_PATH, timeout: 2000 },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          body += chunk
          if (body.length > 4096) body = body.slice(0, 4096)
        })
        res.on('end', () => resolve(res.statusCode === 200 && body.includes(HEALTH_MATCH)))
      },
    )
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
    req.on('error', () => resolve(false))
  })
}

/** 与 ihui-api-bluegreen.ps1 的 Write-BgStateAtomic 同语义：先写 .tmp 再改名。 */
function writeStateFile(active, ports) {
  const tmp = `${STATE_FILE}.tmp`
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
  fs.writeFileSync(
    tmp,
    JSON.stringify(
      { active, blue: ports.blue, green: ports.green, updatedAt: new Date().toISOString() },
      null,
      2,
    ),
    'utf8',
  )
  fs.renameSync(tmp, STATE_FILE)
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.once(sig, () => {
    log('info', 'shutting down', { signal: sig })
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 5000).unref()
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
