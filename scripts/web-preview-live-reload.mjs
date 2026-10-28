// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/web-preview-live-reload.mjs — RN H5 预览(:8806)自动刷新「重载桥」
//
// 台账 G-977963 第②半根治(:2026-10-10):预览页改完代码不自己刷新。
// 取证结论(可在本仓重跑,判据见 scripts/check-web-preview-live-reload.mjs):
//   `hot=false` 是第三方包 @expo/cli@57.0.15 的 build/src/start/server/middleware/
//   metroOptions.js `createBundleUrlSearchParams()` 里硬编码 `hot: String(false)`
//   (上一行注释原文 "TODO: Is this still needed?"),**不读任何启动参数/配置**
//   ⇒ 本仓传参改不动它,按台账令转第二条通道:注入轻量监听,收到即 reload。
//
// 通道三环,全部现测于本机运行中的 :8806(未重启它):
//   ① 改动文件 → Metro 自带文件 watch → 在 ws:/hot 上推
//      `{type:'update', body:{isInitialUpdate:false,...}}` 与 `{type:'update-done', body:{changeId}}`
//      (实测 App.tsx touch 后 2.1s 到达,增量 200–300ms 完成);
//   ② 本桥(纯 ws 客户端)在 /hot 上用**页面注入的同一条 bundle URL** 注册,
//      收到 ① 即去抖,向 ws:/message 广播 `{version:2, method:'reload'}`
//      (@expo/cli createMessageSocket.js:本地 socket 的 client 广播受信任,
//      reload/devMenu 在白名单内,实测回环中继 OK);
//   ③ 页面侧监听**已经在被服务的 bundle 里**(expo/src/async-require/messageSocket.ts:
//      `case 'reload': window.location.reload()`),收到即整页重载;
//      响应头 no-store ⇒ 重载必拿最新代码。
// 本桥不需要改 node_modules、不需要重启 :8806、不开新端口(纯客户端)。
//
// 用法:
//   node scripts/web-preview-live-reload.mjs [--port=8806] [--debounce=350] [--verbose]
//   node scripts/web-preview-live-reload.mjs --status      打印状态文件并退出(新鲜=0,陈旧/缺失=1)
//   node scripts/web-preview-live-reload.mjs --ping        手动发一次 reload 广播(会真的刷新所有打开的预览页)
//   scripts/dev-stack.mjs 的 web-preview.start() 会幂等拉起本桥(单实例见下)。
//
// 单实例:启动时读 .tmp-sync/web-preview-live-reload.pid,若该 node 进程仍存活则直接退出 0
// (dev-stack 每次重拉 web-preview 都会再拉一次本脚本,不判重会堆积)。
// 状态心跳:每 15s 写 .tmp-sync/web-preview-live-reload.status.json
//   {phase:'bootstrapping'|'listening'|'backoff', reloadsSent, lastTrigger, port, pid, ts}
// 断线自愈:/hot 断开或 :8806 不可达 ⇒ 指数退避(1s→15s)后重新抓 HTML/注册;
// 服务没起时本桥安静等待,不退出、不判红。

import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STATE_DIR = path.join(ROOT, '.tmp-sync')
export const STATUS_FILE = path.join(STATE_DIR, 'web-preview-live-reload.status.json')
const PID_FILE = path.join(STATE_DIR, 'web-preview-live-reload.pid')

// 与 @expo/cli build/src/start/server/metro/dev-server/utils/socketMessages.js 对齐:
// 该服务器只转发 JSON 里 version===2 的消息(parseRawMessage),不带 version 会被静默丢弃(实测 NO-ECHO)。
export const PROTOCOL_VERSION = 2
export const RELOAD_MSG = JSON.stringify({ version: PROTOCOL_VERSION, method: 'reload' })
export const HEARTBEAT_MS = 15_000
/** 状态文件算"陈旧"的界限:心跳丢三拍。判据与门共用这一份,不得在别处再写字面量。 */
export const STATUS_STALE_AFTER_MS = 3 * HEARTBEAT_MS

/** 从 :8806 首页 HTML 提取页面注入的 bundle URL(相对路径,逐字含 hot=false)。找不到返回 null。 */
export function extractBundleUrl(html) {
  const m = /<script[^>]+src="([^"]+\.bundle\?[^"]+)"/i.exec(html || '')
  return m ? m[1] : null
}

/**
 * 归类 /hot 上的服务端消息(纯函数,镜像测试直接喂真机读数形状)。
 * @param raw 服务端原文
 * @param opts.registered 本连接是否已完成 bundle-registered(注册前收到的 error 是
 *   自家 GraphNotFound 类故障 ⇒ bootstrap-error,不能当"页面该重载"的信号)
 */
export function classifyHotMessage(raw, { registered = true } = {}) {
  let msg
  try {
    msg = JSON.parse(String(raw))
  } catch {
    return { kind: 'ignore', reason: 'unparsable' }
  }
  if (!msg || typeof msg.type !== 'string') return { kind: 'ignore', reason: 'no-type' }
  switch (msg.type) {
    case 'bundle-registered':
      return { kind: 'registered', reason: 'registered' }
    case 'update':
      if (msg.body && msg.body.isInitialUpdate === false) {
        return { kind: 'trigger', reason: 'hot-update', revisionId: msg.body.revisionId }
      }
      return { kind: 'ignore', reason: 'initial-update' }
    case 'update-done':
      // 实测:增量完成体带 changeId,初始注册完成体为 {};changeId 即"图已新鲜"凭据
      if (msg.body && msg.body.changeId) {
        return { kind: 'trigger', reason: 'hot-update-done', changeId: msg.body.changeId }
      }
      return { kind: 'ignore', reason: 'initial-update-done' }
    case 'error':
      return registered
        ? { kind: 'trigger', reason: 'hot-error' } // 编译错了也要重载:预览必须如实反映代码状态
        : { kind: 'bootstrap-error', reason: 'pre-register-error' }
    default:
      return { kind: 'ignore', reason: 'other:' + msg.type }
  }
}

/** 命令行解析(纯函数)。 */
export function parseArgs(argv) {
  const opts = { port: 8806, debounceMs: 350, verbose: false, status: false, ping: false }
  for (const a of argv) {
    const m = /^--(port|debounce)=(\d+)$/.exec(a)
    if (m) opts[m[1] === 'port' ? 'port' : 'debounceMs'] = Number(m[2])
    else if (a === '--verbose') opts.verbose = true
    else if (a === '--status') opts.status = true
    else if (a === '--ping') opts.ping = true
  }
  return opts
}

/**
 * 汇总判读(纯函数,供 --status 与镜像测试):状态文件读数 + 服务器可达性 ⇒ 退出码。
 * 优先级:未判定(>8806 不可达,机器运行态,不判红)> 红 > 绿。
 */
export function decideStatus(
  { reachable, status } /* status: 解析后的状态文件或 null */,
  now = Date.now(),
) {
  if (!reachable) {
    return { code: 2, line: `未判定::8806 不可达(预览服务没起 ≠ 桥坏了,AGENTS §12e 不判红)` }
  }
  if (!status) {
    return { code: 1, line: '红:桥未运行(:8806 在,但没有自动刷新看守)' }
  }
  const ageMs = now - Date.parse(status.ts || 0)
  if (!Number.isFinite(ageMs) || ageMs > STATUS_STALE_AFTER_MS) {
    return { code: 1, line: `红:桥状态陈旧(心跳 ${Math.round(ageMs / 1000)}s 前)` }
  }
  return {
    code: 0,
    line: `绿:phase=${status.phase} reloadsSent=${status.reloadsSent ?? 0} pid=${status.pid ?? '?'}`,
  }
}

// —————————————————————————— 运行态(不进镜像测试的薄胶水) ——————————————————————————

const log = (verbose, ...a) => console.log(`[wplr ${new Date().toISOString()}]`, ...a)

function httpGetText(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (c) => (body += c))
      res.on('end', () => resolve({ status: res.statusCode, body }))
    })
    req.on('timeout', () => req.destroy(new Error('http-timeout')))
    req.on('error', reject)
  })
}

/** 完整 GET 并丢弃(预热 Metro 图:没有 revision 就没有 /hot 注册对象;已存在时为增量,毫秒级)。 */
function httpDrain(url, timeoutMs = 320_000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now()
    let bytes = 0
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      res.on('data', (c) => (bytes += c.length))
      res.on('end', () => resolve({ bytes, ms: Date.now() - t0 }))
      res.on('error', reject)
    })
    req.on('timeout', () => req.destroy(new Error('drain-timeout')))
    req.on('error', reject)
  })
}

// 本机 node 宿主下不写 stdio 的子进程调用会稳定 EBUSY(AGENTS §12g):显式给全。
function pidAlive(pid) {
  if (!pid || pid <= 0) return false
  try {
    const r = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], {
      windowsHide: true,
      encoding: 'utf8',
      timeout: 8000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const m = (r.stdout || '').match(/^\s*"([^"]+)"/m)
    return !!m && m[1].toLowerCase() === 'node.exe'
  } catch {
    return false
  }
}

class Bridge {
  constructor(opts) {
    this.opts = opts
    this.v = {
      port: opts.port,
      phase: 'bootstrapping',
      reloadsSent: 0,
      lastTrigger: null,
      pid: process.pid,
    }
    this.pending = null
    this.msgWs = null
    this.msgQueue = []
    this.stopped = false
  }

  writeStatus() {
    this.v.ts = new Date().toISOString()
    fs.mkdirSync(STATE_DIR, { recursive: true })
    try {
      fs.writeFileSync(STATUS_FILE, JSON.stringify(this.v, null, 1))
    } catch {
      /* 状态写不进不致命(审计会据此判陈旧并点名) */
    }
  }

  // —— /message 常驻发送端(断开即重连;广播重载是幂等的,多发只会多刷一次) ——
  ensureMessageSocket() {
    // readyState:0=CONNECTING、1=OPEN 都可继续用;2/3 正在关/已关 ⇒ 换新
    if (this.msgWs && this.msgWs.readyState <= 1) return this.msgWs
    const ws = new WebSocket(`ws://127.0.0.1:${this.opts.port}/message`)
    ws.onopen = () => {
      for (const m of this.msgQueue.splice(0)) ws.send(m)
    }
    ws.onerror = () => {
      try {
        ws.close()
      } catch {
        /* noop */
      }
    }
    this.msgWs = ws
    return ws
  }

  sendReloadMsg() {
    const ws = this.ensureMessageSocket()
    // readyState:0=CONNECTING(onopen 里会冲队列) 1=OPEN 2/3=CLOSING/CLOSED(ensure 已换新)
    if (ws.readyState === 1) ws.send(RELOAD_MSG)
    else this.msgQueue.push(RELOAD_MSG)
  }

  scheduleReload(reason) {
    if (this.pending) clearTimeout(this.pending)
    this.pending = setTimeout(() => {
      this.pending = null
      this.v.reloadsSent = (this.v.reloadsSent || 0) + 1
      this.v.lastTrigger = { reason, at: new Date().toISOString() }
      log(this.opts.verbose, `reload sent #${this.v.reloadsSent} reason=${reason}`)
      this.writeStatus()
      try {
        this.sendReloadMsg()
      } catch (e) {
        log(false, `reload 发送失败(不阻塞,下个改动还会再触发): ${e.message}`)
      }
    }, this.opts.debounceMs)
  }

  // 一次完整周期:抓 HTML → 取 bundle URL → 预热图 → /hot 注册并转发;socket 断开时返回。
  async cycle() {
    const base = `http://127.0.0.1:${this.opts.port}`
    const { body } = await httpGetText(`${base}/`)
    const rel = extractBundleUrl(body)
    if (!rel) throw new Error('HTML 中没有 .bundle script src(预览页结构变了?跑判据脚本看读数)')
    const entryUrl = `http://localhost:${this.opts.port}${rel}` // host 拼写与页面 currentScript 一致;图 id 只取 path+query
    await httpDrain(entryUrl) // 幂等预热,保证 GraphNotFound 不发生
    this.v.phase = 'bootstrapping'
    this.writeStatus()
    // 只 resolve:onclose 是所有出口(正常断/注册期回炉/20 分钟重注册)的汇合点,
    // 失败由外层 run() 的退避循环兜,所以这里不存在"拒绝"这一条路。
    await new Promise((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${this.opts.port}/hot`)
      let registered = false
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'register-entrypoints', entryPoints: [entryUrl] }))
      }
      ws.onmessage = (e) => {
        const cls = classifyHotMessage(e.data, { registered })
        if (cls.kind === 'registered') {
          registered = true
          this.v.phase = 'listening'
          this.writeStatus()
          log(this.opts.verbose, `listening(port=${this.opts.port})`)
        } else if (cls.kind === 'trigger') {
          this.scheduleReload(cls.reason)
        } else if (cls.kind === 'bootstrap-error') {
          log(false, `注册期收到服务端 error(GraphNotFound 之类),回炉重预热`)
          try {
            ws.close()
          } catch {
            /* resolve 将由 onclose 接手 */
          }
        }
      }
      ws.onerror = () => {
        /* onclose 兜底 resolve;周期循环会退避重试 */
      }
      ws.onclose = () => resolve()
      setTimeout(() => {
        try {
          ws.close()
        } catch {
          /* noop */
        }
      }, 20 * 60_000) // 20 分钟重注册一轮:防服务端静默半死,成本≈0
    })
    this.v.phase = 'backoff'
  }

  async run() {
    let backoff = 1000
    this.heartbeat = setInterval(() => this.writeStatus(), HEARTBEAT_MS)
    this.heartbeat.unref?.()
    while (!this.stopped) {
      try {
        await this.cycle()
        backoff = 1000 // 周期完整走完 ⇒ 回到快速重试
      } catch (e) {
        log(this.opts.verbose, `cycle failed: ${e.message}`)
      }
      if (this.stopped) break
      this.v.phase = 'backoff'
      this.writeStatus()
      await new Promise((r) => setTimeout(r, backoff))
      backoff = Math.min(backoff * 2, 15_000)
    }
  }

  stop() {
    this.stopped = true
    try {
      this.msgWs?.close()
    } catch {
      /* noop */
    }
  }
}

async function pingOnce(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/message`)
  await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('ws-open-timeout')), 4000)
    ws.onopen = () => {
      clearTimeout(to)
      resolve()
    }
    ws.onerror = () => reject(new Error('ws-open-error(检查 :8806 是否在跑)'))
  })
  ws.send(RELOAD_MSG)
  await new Promise((r) => setTimeout(r, 250))
  ws.close()
  console.log(`ping:已向 :${port}/message 广播 reload(所有打开的预览页会整页重载)`)
}

// —————————————————————————— 入口(dual-form:被测试 import 时不自动跑) ——————————————————————————

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const opts = parseArgs(process.argv.slice(2))
  if (typeof WebSocket === 'undefined') {
    console.error('[wplr] 本机 node 无全局 WebSocket(Node>=22.13 才有,见根 package.json engines)。')
    process.exit(1)
  }
  if (opts.ping) {
    pingOnce(opts.port).then(
      () => process.exit(0),
      (e) => {
        console.error('[wplr] ping 失败:', e.message)
        process.exit(1)
      },
    )
  } else if (opts.status) {
    let reachable = true
    await httpGetText(`http://127.0.0.1:${opts.port}/`, 3000).catch(() => (reachable = false))
    let status = null
    try {
      status = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'))
    } catch {
      /* 缺失=未运行 */
    }
    const r = decideStatus({ reachable, status })
    console.log(r.line)
    process.exit(r.code)
  } else {
    // 单实例:已有活着的桥 ⇒ 直接退出(幂等,dev-stack 可放心每次随 web-preview 拉起)
    try {
      const old = Number(fs.readFileSync(PID_FILE, 'utf8').trim())
      if (old && old !== process.pid && pidAlive(old)) {
        console.log(`[wplr] 已有实例在运行(pid=${old}),本实例退出(单实例守卫)`)
        process.exit(0)
      }
    } catch {
      /* 无 pid 文件 = 首次运行 */
    }
    fs.mkdirSync(STATE_DIR, { recursive: true })
    fs.writeFileSync(PID_FILE, String(process.pid))
    const bridge = new Bridge(opts)
    bridge.writeStatus()
    const bye = () => {
      bridge.stop()
      try {
        if (fs.readFileSync(PID_FILE, 'utf8').trim() === String(process.pid))
          fs.rmSync(PID_FILE, { force: true })
      } catch {
        /* noop */
      }
      setTimeout(() => process.exit(0), 300).unref()
    }
    process.on('SIGINT', bye)
    process.on('SIGTERM', bye)
    bridge.run().catch((e) => {
      console.error('[wplr] 意外终止:', e)
      process.exit(1)
    })
  }
}

export const __test__ = {
  extractBundleUrl,
  classifyHotMessage,
  parseArgs,
  decideStatus,
  RELOAD_MSG,
  PROTOCOL_VERSION,
  STATUS_FILE,
  PID_FILE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
