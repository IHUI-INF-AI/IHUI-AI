// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 豆包「客户端内发起签到」CDP 驱动(2026-11-18):注入 cookie → 打开客户端页面 →
// 调页面内 rspack 模块 f6O(initApiService("ugCampaign")) 的 DailyCheckIn,
// 让客户端自己的请求层补 msToken/a_bogus。输出单行 JSON 供 Python 腿解析。
import { readFileSync } from 'node:fs'

const argv = process.argv.slice(2)
const argOf = (flag, dflt) => {
  const i = argv.indexOf(flag)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt
}
const port = argOf('--port')
const cookieFile = argOf('--cookie-file')
const scene = argOf('--scene', 'pc_incentive_task_mvp_v3')
const group = argOf('--group', scene)
const waitMs = Number(argOf('--wait', '18000'))

if (!port || !cookieFile) {
  console.log(JSON.stringify({ code: null, message: 'usage: --port <p> --cookie-file <f>' }))
  process.exit(0)
}

const cookies = readFileSync(cookieFile, 'utf8').trim().split('; ').map((p) => {
  const i = p.indexOf('=')
  return { name: p.slice(0, i), value: p.slice(i + 1) }
}).filter((c) => c.name && c.value)

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = list.find((t) => t.type === 'page')
if (!page) {
  console.log(JSON.stringify({ code: null, message: 'no page target' }))
  process.exit(0)
}

const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
const send = (method, params) => new Promise((resolve) => {
  const mid = ++id
  pending.set(mid, resolve)
  ws.send(JSON.stringify({ id: mid, method, params }))
})
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
}

const CALL = `(async () => {
  const key = Object.keys(window).find(k => /rspackChunk|webpackChunk/i.test(k))
  if (!key) return JSON.stringify({ code: null, message: 'no chunk global' })
  let req = null
  try { window[key].push([['leg' + Date.now()], {}, (r) => { req = r }]) } catch (e) { return JSON.stringify({ code: null, message: 'chunk push failed' }) }
  if (!req) return JSON.stringify({ code: null, message: 'no require' })
  let api
  try { api = req('f6O').a } catch (e) {
    try { api = req('g1n').initApiService('ugCampaign', req('zl3').a) } catch (e2) { return JSON.stringify({ code: null, message: 'api module missing', detailCode: 'noModule', mods: Object.keys(req.m || {}).length, href: location.href, rs: document.readyState }) }
  }
  let detailCode = null
  try {
    const d = await api.GetCampaignV3Detail({ campaign_group_code: ${JSON.stringify(group)} })
    detailCode = d && d.code
  } catch (e) { detailCode = 'throw:' + String(e && e.message || e).slice(0, 120) }
  if (detailCode !== 0) return JSON.stringify({ code: null, message: 'detail not ok', detailCode })
  try {
    const res = await api.DailyCheckIn({ scene: ${JSON.stringify(scene)} })
    const c = res && res.code
    return JSON.stringify({ code: c, message: (res && (res.msg || res.message)) || '', detailCode })
  } catch (e) {
    const msg = String(e && e.message || e)
    const m = /code=(\\d+)/.exec(msg)
    return JSON.stringify({ code: m ? Number(m[1]) : null, message: msg.slice(0, 160), detailCode })
  }
})()`

async function main() {
  console.log('STAGE start')
  await send('Network.enable')
  for (const c of cookies) {
    await send('Network.setCookie', { name: c.name, value: c.value, domain: '.doubao.com', path: '/', secure: true })
  }
  console.log('STAGE cookies=' + cookies.length)
  const nav = await send('Page.navigate', { url: 'https://www.doubao.com/chat/' })
  console.log('STAGE navigated ' + JSON.stringify(nav.result || {}).slice(0, 80))
  await new Promise((r) => setTimeout(r, waitMs))
  await send('Runtime.enable')
  const probe = await send('Runtime.evaluate', { expression: 'location.href + "|" + document.readyState + "|" + (document.body && document.body.innerText || "").slice(0,160).replace(/\\s+/g," ")', returnByValue: true })
  console.log('STAGE probe ' + (probe.result?.result?.value || ''))
  const r = await send('Runtime.evaluate', { expression: CALL, awaitPromise: true, returnByValue: true })
  const v = r.result?.result?.value
  console.log(v && v.startsWith('{') ? v : JSON.stringify({ code: null, message: String(v || r.result?.exceptionDetails?.text || '') }))
}

ws.onopen = () => main().then(() => process.exit(0)).catch((e) => {
  console.log(JSON.stringify({ code: null, message: 'ws error: ' + String(e).slice(0, 120) }))
  process.exit(0)
})
setTimeout(() => { console.log(JSON.stringify({ code: null, message: 'cdp timeout' })); process.exit(0) }, 150000)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
