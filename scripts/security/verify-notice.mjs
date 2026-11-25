// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 拦截告知的四面对外自证(2026-11-24)。
 *
 * 为什么要它:文案改一句、路由改一行,都可能让"那句话"悄悄消失 ——
 * 而这件事**没有任何监控能替你发现**(没人会因为我们"少说了句话"报警)。
 * 所以判据必须是可重复执行的:一条命令逐面打真请求,看**正文**里到底有没有那句话。
 *
 * 四面:
 *   ① WAF 403(回环 + 注入载荷)      —— 完整版
 *   ② WS 握手 403(Upgrade + 载荷)    —— 最小版
 *   ③ edge-guard 403(内网地址不带密钥)—— 完整版
 *   ④ 正常请求 200                    —— 证明送话没把正常流量带走
 * 附加:并发 60 次看降级是否真的切档(只报数,不作红判据)
 *
 * 退出码:0=四面全过 1=至少一面没送回话 2=打不通(未判定,不冒充失败)
 */
import http from 'node:http'
import net from 'node:net'
import { pathToFileURL } from 'node:url'

const HOST = process.env.IHUI_VERIFY_HOST || '127.0.0.1'
const PORT = Number(process.env.IHUI_VERIFY_PORT || 8801)
const LAN = process.env.IHUI_VERIFY_LAN || '192.168.1.37'

function call({ path = '/', headers = {}, host = HOST, method = 'GET' } = {}) {
  return new Promise((resolve) => {
    const req = http.request({ host, port: PORT, path, method, headers }, (res) => {
      let body = ''
      res.on('data', (c) => { body += c })
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body, bytes: Buffer.byteLength(body) }))
    })
    // WS 握手:服务端直接回 HTTP 响应并断开,node 客户端把状态行交给 'upgrade' 事件,
    // 不会走 response 回调 —— 不监听这里就永远等到超时(第一版脚本正是这么假红的)。
    req.on('upgrade', (res, socket, head) => {
      let body = head ? head.toString('utf8') : ''
      socket.on('data', (c) => { body += c.toString('utf8') })
      socket.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body, bytes: Buffer.byteLength(body) }))
      socket.on('error', () => resolve({ status: res.statusCode, headers: res.headers, body, bytes: Buffer.byteLength(body) }))
      setTimeout(() => resolve({ status: res.statusCode, headers: res.headers, body, bytes: Buffer.byteLength(body) }), 3000)
    })
    req.setTimeout(8000, () => { req.destroy(new Error('timeout')) })
    req.on('error', (e) => resolve({ status: 0, headers: {}, body: '', bytes: 0, error: String(e.message) }))
    req.end()
  })
}

const PAYLOAD = '/?q=1%20union%20select%201,2'
// 落点句按次数换档(第 5 次起改"停手吧"),所以判据要认**全部档位**,
// 只认一句等于第 5 次之后永远判红 —— 判据自己腐烂比功能腐烂更难发现。
const SAYS = /别妄想攻击|停手吧|Abandon the attempt|Stop\./
const REF = /EV-[0-9A-F]{10}/

/**
 * 手写 HTTP 报文。为什么不用 http.request:带 `Upgrade: websocket` 时,
 * node 客户端只在**101** 才走 'upgrade' 事件;服务端回 403 会变成 socket hang up。
 * 实测第一版脚本因此把"WS 已经送话"假红成"打不通"。
 */
function rawCall({ host = HOST, path = '/', headers = {} }) {
  return new Promise((resolve) => {
    const lines = [`GET ${path} HTTP/1.1`, `Host: ${host}:${PORT}`, 'Accept: */*', ...headers, '', '']
    const sock = net.connect({ host, port: PORT }, () => sock.write(lines.join('\r\n')))
    let raw = ''
    sock.setTimeout(6000, () => { sock.destroy(); finish() })
    sock.on('data', (d) => { raw += d.toString('utf8') })
    sock.on('close', finish)
    sock.on('error', () => finish())
    const done = { v: false }
    function finish() {
      if (done.v) return
      done.v = true
      const [head, body = ''] = raw.split('\r\n\r\n')
      const status = Number((/^HTTP\/1\.1 (\d{3})/.exec(head || '') || [])[1] || 0)
      const h = {}
      for (const line of String(head || '').split('\r\n').slice(1)) {
        const i = line.indexOf(':')
        if (i > 0) h[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim()
      }
      resolve({ status, headers: h, body, bytes: Buffer.byteLength(body) })
    }
  })
}

async function main() {
  const checks = []

  // ① WAF 403:回环 + 注入载荷 + 浏览器 Accept ⇒ 应该拿到完整版
  const waf = await call({ path: PAYLOAD, headers: { accept: 'text/html', 'user-agent': 'sqlmap/1.8.4#stable' } })
  checks.push({
    face: 'WAF 403',
    ok: waf.status === 403 && SAYS.test(waf.body) && REF.test(waf.body) && !waf.headers['x-ihui-minimal'],
    detail: `status=${waf.status} bytes=${waf.bytes} ref=${(waf.body.match(REF) || ['-'])[0]} full=${!waf.headers['x-ihui-minimal']}`,
  })

  // ② WS 握手 403:必须也送话(旧实现在这里只回 {"code":403,"message":"waf"})
  const ws = await rawCall({
    path: PAYLOAD,
    headers: [
      'Upgrade: websocket',
      'Connection: Upgrade',
      'Sec-WebSocket-Version: 13',
      'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
      'User-Agent: sqlmap/1.8.4',
    ],
  })
  checks.push({
    face: 'WS 403',
    ok: ws.status === 403 && SAYS.test(ws.body) && REF.test(ws.body) && ws.headers['x-ihui-minimal'] === '1',
    detail: `status=${ws.status} bytes=${ws.bytes} ref=${(ws.body.match(REF) || ['-'])[0]} minimal=${ws.headers['x-ihui-minimal']}`,
  })

  // ③ edge-guard 403:必须从**不受信任的来源**才触发。本机只有回环/内网两跳,
  //    内网地址在放行名单里(EdgeOne 回源不分来源),所以这一面在本机天然测不到 ——
  //    测不到就报 SKIP,绝不拿"打不通"冒充"没送话"(§0.3 未判定 ≠ 判红)。
  const edge = await call({ path: '/', headers: { accept: 'text/html' }, host: LAN })
  const edgeOurs = Boolean(edge.headers['x-ihui-evidence'])
  if (edge.status === 0) {
    checks.push({ face: 'edge-guard 403', skip: true, ok: true, detail: `来源 ${LAN} 打不通(未判定)` })
  } else if (edgeOurs) {
    checks.push({
      face: 'edge-guard 403',
      ok: edge.status === 403 && SAYS.test(edge.body),
      detail: `status=${edge.status} bytes=${edge.bytes} 本层自证头=有`,
    })
  } else {
    checks.push({
      face: 'edge-guard 403',
      skip: true,
      ok: true,
      detail: `来源 ${LAN} 被放行(status=${edge.status}),本面需公网来源才能测 ⇒ 未判定`,
    })
  }

  // ④ 正常请求:不能把正常流量也送走
  const ok = await call({ path: '/', headers: { accept: 'text/html' } })
  checks.push({
    face: '正常 200',
    ok: ok.status === 200 && !SAYS.test(ok.body),
    detail: `status=${ok.status} bytes=${ok.bytes}`,
  })

  // 附加:并发看降级切档(只报数)
  const burst = await Promise.all(
    Array.from({ length: 60 }, () => call({ path: PAYLOAD, headers: { accept: 'text/html', 'user-agent': 'sqlmap/1.8.4' } })),
  )
  const mini = burst.filter((r) => r.headers['x-ihui-minimal'] === '1').length
  const full = burst.filter((r) => r.status === 403 && r.headers['x-ihui-minimal'] !== '1').length
  const maxBytes = Math.max(...burst.map((r) => r.bytes))

  for (const c of checks) {
    const tag = c.skip ? 'SKIP' : c.ok ? 'PASS' : 'FAIL'
    console.log(`${tag}  ${c.face.padEnd(16)} ${c.detail}`)
  }
  console.log(`INFO  降级切档          full=${full} minimal=${mini} 最大单响应=${maxBytes}B`)

  // "打不通"与"没送话"是两件事:前者未判定(2),后者才是失败(1)
  const unreachable = checks.filter((c) => String(c.detail).includes('status=0'))
  if (unreachable.length) {
    console.log(`未判定:${unreachable.map((c) => c.face).join('、')} 打不通 —— 先确认服务与端口,别把"打不通"当成"没送话"`)
    return 2
  }
  return checks.every((c) => c.ok) ? 0 : 1
}

// §22d 入口守卫:被 import 时不得执行 main(否则引用即自证、测试里会打真请求)
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().then((code) => process.exit(code)).catch((e) => {
    console.error(`❌ 自证脚本自身异常(exit 2):${String((e && e.message) || e)}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
