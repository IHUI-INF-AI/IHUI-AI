#!/usr/bin/env node
/**
 * 建议 17: dev-up 事件 Web UI (SSE + 单文件 HTML)
 *
 * 用法:
 *   node scripts/dev-events-server.mjs
 *   # 浏览器打开 http://127.0.0.1:14317/
 *   # 实时看到 logs/dev-up-events.jsonl 的事件流
 *
 * 端口: 14317 (避免与 8000/8888/4173 冲突)
 * 数据源: ../../logs/dev-up-events.jsonl (相对 scripts/ 目录)
 *
 * 不依赖任何 npm 包 (http + fs), 0 依赖启动
 */
import { createServer } from 'node:http'
import { readFileSync, statSync, openSync, readSync, closeSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOG = resolve(__dirname, '..', 'logs', 'dev-up-events.jsonl')
const PORT = 14317

const HTML = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>dev-up 事件流</title>
<style>
  body { font-family: ui-monospace, Consolas, monospace; background: #0e0e10; color: #e0e0e0; margin: 0; padding: 16px; }
  h1 { color: #50fa7b; font-size: 16px; margin: 0 0 12px 0; }
  .filter { background: #1e1e22; padding: 8px; border-radius: 4px; margin-bottom: 8px; }
  .filter input { background: #0e0e10; color: #e0e0e0; border: 1px solid #444; padding: 4px 8px; width: 280px; font-family: inherit; }
  .filter button { background: #444; color: #e0e0e0; border: 0; padding: 4px 12px; cursor: pointer; margin-left: 4px; }
  .filter button:hover { background: #555; }
  .filter button.on { background: #50fa7b; color: #000; }
  #events { font-size: 12px; line-height: 1.5; }
  .row { padding: 2px 0; }
  .ts { color: #6272a4; }
  .info { color: #50fa7b; }
  .warn { color: #f1fa8c; }
  .error { color: #ff5555; }
  .ev { color: #8be9fd; }
  .data { color: #999; }
  .status { color: #6272a4; font-size: 11px; margin-top: 12px; }
  .status.connected { color: #50fa7b; }
  .status.disconnected { color: #ff5555; }
</style>
</head>
<body>
<h1>dev-up 事件流 (SSE)</h1>
<div class="filter">
  <input id="q" placeholder="filter (e.g. backend, vite)">
  <button data-lvl="info" class="on">INFO</button>
  <button data-lvl="warn" class="on">WARN</button>
  <button data-lvl="error" class="on">ERROR</button>
  <button data-act="clear">CLEAR</button>
</div>
<div id="events"></div>
<div class="status" id="status">disconnected</div>
<script>
  const $events = document.getElementById('events')
  const $status = document.getElementById('status')
  const $q = document.getElementById('q')
  const levels = new Set(['info', 'warn', 'error'])
  const fmt = (o) => {
    const t = (o.ts || '').slice(11, 19)
    const lvl = o.level || 'info'
    const ev = o.event || '?'
    const data = JSON.stringify(o.data || {})
    return '<div class="row">' +
      '<span class="ts">' + t + '</span> ' +
      '<span class="' + lvl + '">' + lvl.toUpperCase() + '</span> ' +
      '<span class="ev">' + ev + '</span> ' +
      '<span class="data">' + data + '</span>' +
      '</div>'
  }
  const filter = (o) => {
    if (!levels.has(o.level)) return false
    const q = $q.value.trim().toLowerCase()
    if (q && !(JSON.stringify(o).toLowerCase().includes(q))) return false
    return true
  }
  const add = (o) => { if (filter(o)) $events.insertAdjacentHTML('afterbegin', fmt(o)) }
  document.querySelectorAll('button[data-lvl]').forEach(b => {
    b.onclick = () => {
      const l = b.dataset.lvl
      if (levels.has(l)) { levels.delete(l); b.classList.remove('on') }
      else { levels.add(l); b.classList.add('on') }
    }
  })
  document.querySelector('button[data-act=clear]').onclick = () => { $events.innerHTML = '' }
  $q.oninput = () => {
    $events.innerHTML = ''
    // 重新拉最近 N 条
    fetch('/recent').then(r => r.json()).then(arr => arr.forEach(o => add(o)))
  }
  fetch('/recent').then(r => r.json()).then(arr => arr.reverse().forEach(o => add(o)))
  const es = new EventSource('/stream')
  es.onopen = () => { $status.textContent = 'connected'; $status.className = 'status connected' }
  es.onerror = () => { $status.textContent = 'disconnected'; $status.className = 'status disconnected' }
  es.onmessage = (e) => { try { add(JSON.parse(e.data)) } catch {} }
</script>
</body>
</html>
`

const recent = []
const MAX_RECENT = 200

function loadRecent() {
  if (!existsSync(LOG)) return
  const text = readFileSync(LOG, 'utf8')
  const lines = text.split('\n').filter(Boolean).slice(-MAX_RECENT)
  recent.length = 0
  for (const line of lines) {
    try { recent.push(JSON.parse(line)) } catch {}
  }
}
loadRecent()

let lastSize = existsSync(LOG) ? statSync(LOG).size : 0
setInterval(() => {
  if (!existsSync(LOG)) return
  const sz = statSync(LOG).size
  if (sz === lastSize) return
  if (sz < lastSize) { lastSize = 0; loadRecent(); return }
  // 增量读取
  const buf = Buffer.alloc(sz - lastSize)
  const fd = openSync(LOG, 'r')
  try { readSync(fd, buf, 0, buf.length, lastSize) } finally { closeSync(fd) }
  lastSize = sz
  const newLines = buf.toString('utf8').split('\n').filter(Boolean)
  for (const line of newLines) {
    try {
      const obj = JSON.parse(line)
      recent.push(obj)
      while (recent.length > MAX_RECENT) recent.shift()
      broadcast(obj)
    } catch {}
  }
}, 300)

const clients = new Set()
function broadcast(obj) {
  const data = `data: ${JSON.stringify(obj)}\n\n`
  for (const res of clients) {
    try { res.write(data) } catch {}
  }
}

const server = createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(HTML)
  } else if (req.url === '/recent') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(recent))
  } else if (req.url === '/stream') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'connection': 'keep-alive',
    })
    clients.add(res)
    req.on('close', () => clients.delete(res))
  } else {
    res.writeHead(404)
    res.end('Not Found')
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[dev-events-web] http://127.0.0.1:${PORT}/`)
  console.log(`[dev-events-web] tailing: ${LOG}`)
})
