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
log('info', 'router started', {
  listen: `${LISTEN_HOST}:${LISTEN_PORT}`,
  state: STATE_FILE,
  active: state.active,
  upstream: state[state.active],
  source: state.source,
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
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': buf.length })
  res.end(buf)
}

const server = http.createServer((req, res) => {
  // 运维探针：仅本机可达（监听 127.0.0.1），给部署脚本确认「路由在跑、当前是哪一色」
  if (req.url === '/__bg/status') {
    sendJson(res, 200, { ok: true, active: state.active, upstream: state[state.active] })
    return
  }
  proxyHttp(req, res, 0)
})

function proxyHttp(req, res, attempt) {
  const ports = upstreams()
  const port = ports[attempt]
  if (!port) {
    sendJson(res, 502, { code: 502, message: 'api upstream unavailable' })
    return
  }

  const upReq = http.request({
    host: UPSTREAM_HOST,
    port,
    method: req.method,
    path: req.url,
    headers: req.headers,
  })

  upReq.on('response', (upRes) => {
    res.writeHead(upRes.statusCode || 502, upRes.headers)
    upRes.pipe(res)
  })

  upReq.on('error', (err) => {
    // 连接被拒 = 请求还没进入应用，重放到另一色是安全的；POST 也可（未产生副作用）。
    // 但只重放一次，且只针对连接级错误 —— 已经建立连接后的 reset 不重放，避免重复下单。
    if ((err.code === 'ECONNREFUSED' || err.code === 'EHOSTUNREACH') && attempt === 0) {
      log('warn', 'primary upstream refused, retrying secondary', {
        primary: ports[0],
        secondary: ports[1],
        url: req.url,
      })
      proxyHttp(req, res, 1)
      return
    }
    log('error', 'proxy error', { port, url: req.url, code: err.code, message: err.message })
    sendJson(res, 502, { code: 502, message: 'api upstream unavailable' })
  })

  res.on('close', () => {
    if (!res.writableEnded) upReq.destroy()
  })
  req.pipe(upReq)
}

// WebSocket：手工做 HTTP Upgrade 透传（不引第三方依赖，避免 pnpm 隔离目录解析问题）
server.on('upgrade', (req, socket, head) => {
  const port = upstreams()[0]
  const upSocket = net.connect(port, UPSTREAM_HOST, () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`]
    for (const [k, v] of Object.entries(req.headers)) {
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
  socket.on('error', () => upSocket.destroy())
  socket.on('close', () => upSocket.destroy())
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
