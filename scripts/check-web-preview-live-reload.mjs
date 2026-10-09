// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/check-web-preview-live-reload.mjs — :8806 预览自动刷新链路「效果面」判据(只读)
//
// 立尺原因(台账 G-977963 第②半):本仓反复吃过"接线绿而链路不通"的亏,这条判据
// 验的**不是**磁盘上有没有写监听代码,而是**正在被服务的产物与运行中的通道**:
//   A endpoint  :8806 首页 200,且能逐字提取页面注入的 bundle URL(现测含 hot=false);
//   B listener  流扫**在线 bundle**,确认页面侧重载监听真的在交付内容里
//               (expo/src/async-require/messageSocket.ts + window.location.reload());
//   C sockets   /hot 与 /message 两条 WebSocket 在运行进程上可升级连接;
//   E bridge    重载桥(scripts/web-preview-live-reload.mjs)心跳新鲜且 phase 正常;
//   D relay     (仅 --live,有创)两个 /message 客户端互测中继 —— 会把所有打开的
//               预览页真的刷一遍,所以必须显式旗标,默认不跑。
//
// 判据形态与定级(AGENTS §12e/§12f):本门判的是**机器运行态**(服务/进程在不在),
// 与提交内容无关 ⇒ 绝不接进提交链(恒红门的唯一结局是每台被逼 --no-verify,
// 一次绕过≈该枚提交上约 190 道守门全废)。定级=人工/on-call 诊断档:
//   退出码 0 绿 / 1 红(链路真的不通)/ 2 未判定(:8806 不可达 ⇒ 不下红结论)。
// 未判定优先于红:预览服务没起不是"门坏了",仓内口径"取不到 ⇒ 未判定"。
//
// 用法:
//   node scripts/check-web-preview-live-reload.mjs [--port=8806] [--json] [--live]
//   node scripts/tests/check-web-preview-live-reload.test.mjs  # 判据镜像测试(构造输入,不碰网络)

import fs from 'node:fs'
import http from 'node:http'
import { pathToFileURL } from 'node:url'

// 协议与解析单一真相源:import 桥,不另抄一份(§22c 同取向)
import {
  extractBundleUrl,
  classifyHotMessage,
  decideStatus,
  RELOAD_MSG,
  STATUS_FILE,
  STATUS_STALE_AFTER_MS,
} from './web-preview-live-reload.mjs'

const WS_UPGRADE_TIMEOUT_MS = 4000
const BUNDLE_SCAN_CAP_BYTES = 48 * 1024 * 1024 // 现测在线 bundle ≈ 29MB,留裕量
export const LISTENER_MARKERS = ['async-require/messageSocket.ts', 'window.location.reload()']

/** 纯判读(镜像测试直接喂构造读数):各轴 ⇒ {code, lines}。优先级 未判定>红>绿。 */
export function decide(r) {
  const lines = []
  let code = 0
  let undetermined = false
  const demote = (c) => {
    if (c === 2) undetermined = true
    else if (c === 1 && code === 0) code = 1
  }
  if (!r.endpoint || r.endpoint.status === 'unreachable') {
    return {
      code: 2,
      lines: [
        `未判定::8806 不可达(${(r.endpoint && r.endpoint.error) || '无'})——后面的轴无法在线判,不猜`,
        `A endpoint : UNREACHABLE`,
      ],
    }
  }
  lines.push(
    `A endpoint : OK bundle=${r.endpoint.bundleUrl ? r.endpoint.bundleUrl.slice(0, 96) + '…' : '?'}`,
  )
  if (!r.endpoint.bundleUrl) {
    demote(1)
    lines.push('  红:HTML 里没有 .bundle script src(注入结构变了)')
  }
  if (r.listener.status === 'unreachable') {
    demote(2)
    lines.push(`B listener : UNREACHABLE(${r.listener.error || '?'})——bundle 取不到,未判定`)
  } else if (r.listener.status === 'ok') {
    const miss = LISTENER_MARKERS.filter((m) => !r.listener.found.includes(m))
    if (miss.length) demote(1)
    lines.push(
      `B listener : ${miss.length ? '红' : 'OK'} 在线 bundle ${Math.round(r.listener.bytes / 1048576)}MB,` +
        (miss.length
          ? `缺标记 ${miss.join(', ')}`
          : `页面侧 reload 监听在交付内容里(${LISTENER_MARKERS.join(' + ')})`),
    )
  } else {
    demote(1)
    lines.push(`B listener : 红 超时/失败(${r.listener.error || 'timeout'})`)
  }
  for (const s of r.sockets || []) {
    if (s.status !== 'open') demote(1)
    lines.push(
      `C socket ${s.path} : ${s.status === 'open' ? 'OK' : '红 ' + (s.status + (s.error ? `(${s.error})` : ''))}`,
    )
  }
  const br = r.bridge
  if (br.status === 'missing' || br.status === 'stale') demote(1)
  const age = Number.isFinite(br.ageMs) ? ` (心跳 ${Math.round(br.ageMs / 1000)}s 前)` : ''
  lines.push(
    `E bridge   : ${br.status === 'ok' ? 'OK' : br.status === 'missing' ? '红 桥未运行(:8806 在而没人看守自动刷新)' : br.status === 'stale' ? '红 心跳陈旧' + age : '未判定 ' + br.status}`,
  )
  if (br.status === 'ok')
    lines.push(
      `  phase=${br.phase} reloadsSent=${br.reloadsSent} lastTrigger=${JSON.stringify(br.lastTrigger)}`,
    )
  if (r.relay) {
    if (r.relay.status === 'ok') {
      lines.push(`D relay    : OK ${r.relay.host} 中继回环收到 ${r.relay.echo}`)
    } else {
      demote(1)
      lines.push(`D relay    : 红 ${r.relay.status}(${r.relay.error || '无中继'})`)
    }
  } else {
    lines.push('D relay    : SKIPPED(有创测试,--live 才跑;跑了会真刷新所有打开的预览页)')
  }
  return { code: undetermined && code === 0 ? 2 : code, lines }
}

// —————————————————————————— 探针(全部只读;--live 的 D 轴除外) ——————————————————————————

function httpGetText(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (c) => (body += c))
      res.on('end', () => resolve({ status: res.statusCode, body }))
    })
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', reject)
  })
}

async function probeEndpoint(port) {
  try {
    const { status, body } = await httpGetText(`http://127.0.0.1:${port}/`)
    if (status !== 200) return { status: 'unreachable', error: `HTTP ${status}`, bundleUrl: null }
    return { status: 'ok', bundleUrl: extractBundleUrl(body) }
  } catch (e) {
    return { status: 'unreachable', error: e.message, bundleUrl: null }
  }
}

/** 流扫在线 bundle 找页面侧监听标记(命中全部即可提前断开,省带宽)。 */
function probeListener(port, bundleRelUrl, timeoutMs = 90_000) {
  return new Promise((resolve) => {
    if (!bundleRelUrl)
      return resolve({ status: 'fail', error: 'no-bundle-url', bytes: 0, found: [] })
    let bytes = 0
    let tail = ''
    const found = new Set()
    const req = http.get(
      { host: '127.0.0.1', port, path: bundleRelUrl, timeout: timeoutMs },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume()
          return resolve({ status: 'fail', error: `HTTP ${res.statusCode}`, bytes: 0, found: [] })
        }
        res.setEncoding('latin1')
        res.on('data', (c) => {
          bytes += Buffer.byteLength(c, 'latin1')
          const s = tail + c
          for (const m of LISTENER_MARKERS) if (s.includes(m)) found.add(m)
          tail = c.slice(-4096)
          if (found.size === LISTENER_MARKERS.length || bytes > BUNDLE_SCAN_CAP_BYTES) {
            req.destroy()
            resolve({ status: 'ok', bytes, found: [...found] })
          }
        })
        res.on('end', () => resolve({ status: 'ok', bytes, found: [...found] }))
        res.on('error', () => resolve({ status: 'ok', bytes, found: [...found] })) // destroy 触发:已扫到的算数
      },
    )
    req.on('timeout', () => {
      req.destroy()
      resolve({ status: 'timeout', error: `>${timeoutMs}ms`, bytes, found: [...found] })
    })
    req.on('error', (e) =>
      resolve({ status: 'fail', error: e.code || e.message, bytes, found: [...found] }),
    )
  })
}

/** WebSocket 轴:能升级即算过(open 后立刻 close,零业务消息,不打扰任何页面)。 */
function probeSocket(port, wsPath) {
  return new Promise((resolve) => {
    if (typeof WebSocket === 'undefined')
      return resolve({ path: wsPath, status: 'fail', error: 'no-global-WebSocket' })
    let done = false
    const fin = (status, error) => {
      if (done) return
      done = true
      resolve({ path: wsPath, status, error })
    }
    const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`)
    const to = setTimeout(() => {
      try {
        ws.close()
      } catch {
        /* noop */
      }
      fin('fail', 'open-timeout')
    }, WS_UPGRADE_TIMEOUT_MS)
    ws.onopen = () => {
      clearTimeout(to)
      try {
        ws.close()
      } catch {
        /* noop */
      }
      fin('open')
    }
    ws.onerror = () => {
      clearTimeout(to)
      fin('fail', 'ws-error')
    }
  })
}

function probeBridge(now) {
  let st = null
  try {
    st = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'))
  } catch {
    return { status: 'missing' }
  }
  const ageMs = now - Date.parse(st.ts || '')
  if (!Number.isFinite(ageMs)) return { status: 'invalid', ageMs: null }
  return {
    status: ageMs > STATUS_STALE_AFTER_MS ? 'stale' : 'ok',
    ageMs,
    phase: st.phase,
    reloadsSent: st.reloadsSent ?? 0,
    lastTrigger: st.lastTrigger,
    pid: st.pid,
  }
}

/** 有创轴 D(仅 --live):两客户端一发一收验中继。**会刷新所有打开的预览页**。 */
async function probeRelay(port) {
  try {
    const a = new WebSocket(`ws://127.0.0.1:${port}/message`)
    await wsOpen(a)
    const b = new WebSocket(`ws://127.0.0.1:${port}/message`)
    await wsOpen(b)
    const echoed = new Promise((resolve) => {
      const to = setTimeout(() => resolve(null), 3000)
      b.onmessage = (e) => {
        clearTimeout(to)
        resolve(String(e.data))
      }
    })
    a.send(RELOAD_MSG)
    const echo = await echoed
    a.close()
    b.close()
    return echo
      ? { status: 'ok', echo, host: '127.0.0.1' }
      : { status: 'no-echo', error: '3s 内无中继回环' }
  } catch (e) {
    return { status: 'fail', error: e.message }
  }
}

function wsOpen(ws) {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('open-timeout')), WS_UPGRADE_TIMEOUT_MS)
    ws.onopen = () => (clearTimeout(to), resolve())
    ws.onerror = () => (clearTimeout(to), reject(new Error('ws-error')))
  })
}

export const __test__ = {
  decide,
  LISTENER_MARKERS,
  extractBundleUrl,
  classifyHotMessage,
  decideStatus,
  RELOAD_MSG,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const argv = process.argv.slice(2)
  const port = Number((argv.find((x) => x.startsWith('--port=')) || '--port=8806').split('=')[1])
  const asJson = argv.includes('--json')
  const live = argv.includes('--live')
  const now = Date.now()

  const endpoint = await probeEndpoint(port)
  const listener =
    endpoint.status === 'ok' && endpoint.bundleUrl
      ? await probeListener(port, endpoint.bundleUrl)
      : { status: 'skipped', bytes: 0, found: [] }
  const sockets =
    endpoint.status === 'unreachable'
      ? []
      : await Promise.all([probeSocket(port, '/hot'), probeSocket(port, '/message')])
  const bridge = probeBridge(now)
  const relay = live && endpoint.status === 'ok' ? await probeRelay(port) : null

  const r = decide({
    endpoint,
    listener:
      listener.status === 'skipped' ? { status: 'unreachable', error: 'skipped' } : listener,
    sockets,
    bridge,
    relay,
  })
  if (asJson) {
    console.log(
      JSON.stringify(
        { code: r.code, port, live, endpoint, listener, sockets, bridge, relay },
        null,
        1,
      ),
    )
  } else {
    console.log(
      `check-web-preview-live-reload: ${r.code === 0 ? 'PASS' : r.code === 2 ? 'UNDETERMINED' : 'FAIL'} (exit ${r.code})`,
    )
    for (const l of r.lines) console.log('  ' + l)
  }
  process.exit(r.code)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
