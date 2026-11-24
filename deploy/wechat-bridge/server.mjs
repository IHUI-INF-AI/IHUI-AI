// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联外部桥（参考实现）。
 *
 * 对上游：驱动可接 wcfhttp / 自建 HTTP；对下游：暴露统一契约给 IHUI WeChat Hub：
 *   GET  /status
 *   GET  /messages?since=&limit=
 *   POST /send
 *   POST /action
 *   POST /typing
 *   POST /ingest    （上游把入站消息推到这里）
 *
 * 无第三方依赖，Node 20+ 直接运行。
 */

import { createServer } from 'node:http'
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.BRIDGE_PORT ?? 8848)
const HOST = process.env.BRIDGE_HOST ?? '127.0.0.1'
const SECRET = process.env.BRIDGE_SECRET ?? ''
const DRIVER_NAME = process.env.BRIDGE_DRIVER ?? 'mock'
const QUEUE_FILE = process.env.BRIDGE_QUEUE_FILE ?? join(ROOT, '.bridge-queue.jsonl')
const MAX_QUEUE = Number(process.env.BRIDGE_MAX_QUEUE ?? 5000)

let driver = null
let seq = 0
let queue = []
const seenIds = new Set()

async function loadDriver() {
  if (DRIVER_NAME === 'wcfhttp') {
    const mod = await import('./drivers/wcfhttp.mjs')
    return mod.createDriver()
  }
  if (DRIVER_NAME === 'ocr') {
    const mod = await import('./drivers/ocr-readonly.mjs')
    return mod.createDriver()
  }
  if (DRIVER_NAME !== 'mock') throw new Error(`未知 BRIDGE_DRIVER：${DRIVER_NAME}`)
  const mod = await import('./drivers/mock.mjs')
  return mod.createDriver()
}

async function loadQueue() {
  if (!existsSync(QUEUE_FILE)) return
  const raw = await readFile(QUEUE_FILE, 'utf8')
  const lines = raw.split('\n').filter(Boolean)
  const parsed = lines.map((line) => {
    try {
      return JSON.parse(line)
    } catch {
      return null
    }
  })
  queue = parsed.filter((item) => item && typeof item.seq === 'number').slice(-MAX_QUEUE)
  for (const item of queue) {
    if (item.id) seenIds.add(String(item.id))
  }
  const last = queue.at(-1)
  seq = last ? last.seq : 0
}

async function persist(message) {
  await mkdir(dirname(QUEUE_FILE), { recursive: true })
  await appendFile(QUEUE_FILE, `${JSON.stringify(message)}\n`, 'utf8')
  queue.push(message)
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE)
}

/** 入站统一去重：同一 id 重复投递不推进 seq，避免 OCR 轮询/重试落重复消息。 */
async function appendInbound(raw) {
  const message = normalizeInbound(raw)
  if (message.id && seenIds.has(message.id)) return false
  seq += 1
  const stored = { ...message, seq }
  await persist(stored)
  if (stored.id) seenIds.add(String(stored.id))
  return true
}

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw.trim()) return {}
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('请求体不是合法 JSON')
  }
}

function authorized(req, body) {
  if (!SECRET) return true
  const header = req.headers.authorization
  if (typeof header === 'string' && header === `Bearer ${SECRET}`) return true
  if (
    typeof req.headers['x-bridge-secret'] === 'string' &&
    req.headers['x-bridge-secret'] === SECRET
  ) {
    return true
  }
  return body?.token === SECRET || body?.secret === SECRET
}

function normalizeInbound(input) {
  const item = typeof input === 'object' && input !== null ? input : {}
  const content = typeof item.content === 'string' ? item.content : ''
  return {
    ...item,
    id: String(item.id ?? item.msgId ?? item.messageId ?? `bridge-${Date.now()}-${seq + 1}`),
    timestamp:
      typeof item.timestamp === 'number' || typeof item.timestamp === 'string'
        ? item.timestamp
        : Date.now(),
    content,
  }
}

async function handle(req, res) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const queryAuth = { secret: url.searchParams.get('secret') ?? undefined }

  if (req.method === 'GET' && path === '/') {
    return json(res, 200, {
      ok: true,
      service: 'ihui-wechat-bridge',
      driver: DRIVER_NAME,
      endpoints: ['/status', '/messages', '/send', '/action', '/typing', '/ingest'],
    })
  }

  if (req.method === 'GET' && path === '/status') {
    if (!authorized(req, queryAuth)) return json(res, 401, { ok: false, error: 'unauthorized' })
    const info = driver.status ? await driver.status() : { online: true }
    return json(res, 200, { ok: true, ...info, driver: DRIVER_NAME, queued: queue.length, seq })
  }

  if (req.method === 'GET' && path === '/messages') {
    if (!authorized(req, queryAuth)) return json(res, 401, { ok: false, error: 'unauthorized' })
    const since = Number(url.searchParams.get('since') ?? 0)
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 100), 1), 500)
    const items = queue
      .filter((item) => item.seq > (Number.isFinite(since) ? since : 0))
      .slice(0, limit)
    const next = items.at(-1)?.seq
    return json(res, 200, {
      ok: true,
      messages: items,
      nextCursor: next ? String(next) : (url.searchParams.get('since') ?? '0'),
      seq,
    })
  }

  if (req.method === 'POST') {
    let body
    try {
      body = await readBody(req)
    } catch (e) {
      return json(res, 400, { ok: false, error: e instanceof Error ? e.message : 'bad body' })
    }
    if (
      body &&
      typeof body === 'object' &&
      !Array.isArray(body) &&
      !body.secret &&
      queryAuth.secret
    ) {
      body.secret = queryAuth.secret
    }
    if (!authorized(req, body)) return json(res, 401, { ok: false, error: 'unauthorized' })

    if (path === '/ingest') {
      const list = Array.isArray(body.messages)
        ? body.messages
        : Array.isArray(body)
          ? body
          : [body]
      for (const raw of list) {
        await appendInbound(raw)
      }
      return json(res, 200, { ok: true, ingested: list.length, seq })
    }

    if (path === '/send') {
      if (!driver.send) return json(res, 501, { ok: false, error: '驱动不支持发送' })
      try {
        const result = await driver.send(body)
        return json(res, 200, { ok: true, messageId: result.messageId })
      } catch (e) {
        return json(res, 502, { ok: false, error: e instanceof Error ? e.message : '发送失败' })
      }
    }

    if (path === '/action') {
      if (!driver.action)
        return json(res, 200, { ok: false, status: 'unsupported', error: '驱动不支持动作' })
      try {
        const result = await driver.action(String(body.action ?? ''), body)
        if (result?.status === 'unsupported') {
          return json(res, 200, {
            ok: false,
            status: 'unsupported',
            error: result.reason ?? '不支持',
          })
        }
        return json(res, 200, { ok: true, data: result?.data ?? {} })
      } catch (e) {
        return json(res, 502, { ok: false, error: e instanceof Error ? e.message : '动作失败' })
      }
    }

    if (path === '/typing') {
      if (driver.typing) await driver.typing(body.target, body.on === true)
      return json(res, 200, { ok: true })
    }
  }

  return json(res, 404, { ok: false, error: 'not found' })
}

driver = await loadDriver()
await loadQueue()

/** 可选轮询：OCR 等拉取型驱动主动产出入站消息，复用 /ingest 的去重与队列。 */
function startDriverPoll() {
  if (typeof driver?.poll !== 'function') return
  const intervalMs = Math.max(1000, Number(process.env.BRIDGE_DRIVER_POLL_MS ?? 5000))
  let busy = false
  const tick = async () => {
    if (busy) return
    busy = true
    try {
      const items = await driver.poll()
      let ingested = 0
      for (const item of items ?? []) {
        if (await appendInbound(item)) ingested += 1
      }
      if (ingested > 0) {
        console.log(`[wechat-bridge] ${DRIVER_NAME} 轮询入站 ${ingested} 条，seq=${seq}`)
      }
    } catch (e) {
      console.error(`[wechat-bridge] ${DRIVER_NAME} 轮询失败:`, e instanceof Error ? e.message : e)
    } finally {
      busy = false
    }
  }
  void tick()
  setInterval(tick, intervalMs).unref()
}

const server = createServer((req, res) => {
  handle(req, res).catch((e) => {
    json(res, 500, { ok: false, error: e instanceof Error ? e.message : 'internal error' })
  })
})

server.listen(PORT, HOST, () => {
  console.log(`[wechat-bridge] listening on http://${HOST}:${PORT} driver=${DRIVER_NAME}`)
  startDriverPoll()
})

function shutdown() {
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 3000).unref()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
