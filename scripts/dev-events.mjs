#!/usr/bin/env node
/**
 * 建议 10: dev-up 事件查看器 (终端 tail -f, 极简版)
 *
 * 用法:
 *   node scripts/dev-events.mjs              # tail 模式 (实时)
 *   node scripts/dev-events.mjs --last 50    # 只看最近 50 条, 不跟随
 *   node scripts/dev-events.mjs --filter vite # 只看含 vite 的事件
 *
 * 端口约定: g:\1\scripts\dev-up.ps1 写 logs\dev-up-events.jsonl
 *         此脚本读 client/logs/dev-up-events.jsonl 或 ../logs/dev-up-events.jsonl
 *         (dev-up 写的是项目根的 logs/ 目录)
 */
import { readFileSync, statSync, watch, openSync, readSync, closeSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// dev-up 写到 <repo>/logs/dev-up-events.jsonl, 即 scripts/../logs/
const LOG = resolve(__dirname, '..', 'logs', 'dev-up-events.jsonl')

const args = process.argv.slice(2)
const lastN = (() => {
  const i = args.indexOf('--last')
  if (i >= 0 && args[i + 1]) return parseInt(args[i + 1], 10)
  return 0
})()
const filter = (() => {
  const i = args.indexOf('--filter')
  if (i >= 0 && args[i + 1]) return args[i + 1]
  return null
})()
const follow = !args.includes('--no-follow') && lastN === 0

const COLORS = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
}
const LEVEL_COLOR = { info: 'green', warn: 'yellow', error: 'red' }
const EVENT_COLOR = {
  start: 'cyan', stop: 'magenta', port_resolved: 'gray',
  port_cleaned: 'yellow', status_report: 'cyan',
  backend_start: 'green', backend_listening: 'green', backend_healthy: 'green',
  backend_degraded: 'yellow', backend_failed: 'red',
  vite_start: 'green', vite_healthy: 'green', vite_failed: 'red',
  redis_start: 'green', redis_healthy: 'green', redis_failed: 'red',
  pg_start: 'green', pg_healthy: 'green', pg_failed: 'red',
  exit: 'gray',
}

function fmt(obj) {
  const t = (obj.ts || '').slice(11, 19)
  const lvl = obj.level || 'info'
  const ev = obj.event || '?'
  const lvlColor = LEVEL_COLOR[lvl] || 'gray'
  const evColor = EVENT_COLOR[ev] || 'white'
  const data = JSON.stringify(obj.data || {})
  return `${COLORS.gray}${t}${COLORS.reset} ${COLORS[lvlColor]}${lvl.padEnd(5)}${COLORS.reset} ${COLORS[evColor]}${ev.padEnd(20)}${COLORS.reset} ${data}`
}

function printAll() {
  if (!existsSync(LOG)) {
    console.log(`[dev-events] log not found: ${LOG}`)
    console.log('[dev-events] (运行 scripts/dev-up.ps1 后才会有事件)')
    return 0
  }
  const text = readFileSync(LOG, 'utf8')
  const lines = text.split('\n').filter(Boolean)
  const subset = lastN > 0 ? lines.slice(-lastN) : lines
  let count = 0
  for (const line of subset) {
    try {
      const obj = JSON.parse(line)
      if (filter && !line.includes(filter)) continue
      console.log(fmt(obj))
      count++
    } catch {}
  }
  return count
}

if (!follow) {
  const n = printAll()
  process.exit(0)
}

// tail -f 模式: 持续读取追加
console.log(`[dev-events] tailing ${LOG} (Ctrl+C 退出)`)
let pos = existsSync(LOG) ? statSync(LOG).size : 0
printAll() // 先打印已有
let fd = null
function reopen() {
  if (fd) { try { closeSync(fd) } catch {} fd = null }
  fd = openSync(LOG, 'r')
}
if (existsSync(LOG)) reopen()

let buf = ''
function poll() {
  if (!existsSync(LOG)) return
  if (!fd) reopen()
  const size = statSync(LOG).size
  if (size < pos) { pos = 0; buf = ''; reopen() }  // rotation 重置
  if (size === pos) return
  const chunkSize = size - pos
  const buf2 = Buffer.alloc(chunkSize)
  readSync(fd, buf2, 0, chunkSize, pos)
  pos += chunkSize
  buf += buf2.toString('utf8')
  const lines = buf.split('\n')
  buf = lines.pop() || ''
  for (const line of lines) {
    if (!line.trim()) continue
    if (filter && !line.includes(filter)) continue
    try { console.log(fmt(JSON.parse(line))) } catch {}
  }
}
const t = setInterval(poll, 300)
process.on('SIGINT', () => { clearInterval(t); if (fd) closeSync(fd); console.log('\n[dev-events] exit'); process.exit(0) })
