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
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isMomentMessage, mergeMoments, nextMomentCursor, parseMomentMessage } from './moments.mjs'
import { appendMomentArchive, readMomentArchive } from './moments-archive.mjs'
import { loadMemberMap, mergeMemberMap, saveMemberMap } from './members-map.mjs'

const ROOT = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.BRIDGE_PORT ?? 8848)
const HOST = process.env.BRIDGE_HOST ?? '127.0.0.1'
const SECRET = process.env.BRIDGE_SECRET ?? ''
const DRIVER_NAME = process.env.BRIDGE_DRIVER ?? 'mock'
/** 朋友圈单独驱动：默认跟随 BRIDGE_DRIVER；显式设 db 时只替换朋友圈路线，聊天仍走原驱动。 */
const MOMENT_DRIVER_NAME = process.env.BRIDGE_MOMENT_DRIVER?.trim() || DRIVER_NAME
const QUEUE_FILE = process.env.BRIDGE_QUEUE_FILE ?? join(ROOT, '.bridge-queue.jsonl')
const MAX_QUEUE = Number(process.env.BRIDGE_MAX_QUEUE ?? 5000)
const MOMENTS_FILE = process.env.BRIDGE_MOMENTS_FILE ?? join(ROOT, '.bridge-moments.jsonl')
const MAX_MOMENTS = Number(process.env.BRIDGE_MAX_MOMENTS ?? 500)
const MOMENT_ARCHIVE_FILE = (() => {
  const raw = String(
    process.env.BRIDGE_MOMENT_ARCHIVE ?? join(ROOT, '.bridge-ocr', 'moments-archive.jsonl'),
  ).trim()
  if (!raw || raw === '0' || raw.toLowerCase() === 'off') return ''
  return resolve(ROOT, raw)
})()
const MOMENT_WAIT_MS = Math.min(
  Math.max(Number(process.env.BRIDGE_MOMENT_WAIT_MS ?? 3500), 500),
  15_000,
)
/** 直接 `node server.mjs` 启动；被测试/其它模块 import 时不绑定端口、不加载驱动。 */
const IS_MAIN = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false

let driver = null
let momentDriver = null
let seq = 0
let queue = []
const seenIds = new Set()
let momentSeq = 0
let momentQueue = []
const seenMomentIds = new Set()
let memberMap = { members: [] }

async function loadDriver() {
  if (DRIVER_NAME === 'wcfhttp') {
    const mod = await import('./drivers/wcfhttp.mjs')
    return mod.createDriver()
  }
  if (DRIVER_NAME === 'ocr') {
    const mod = await import('./drivers/ocr-readonly.mjs')
    return mod.createDriver()
  }
  if (DRIVER_NAME === 'uia') {
    const mod = await import('./drivers/uia-readonly.mjs')
    return mod.createDriver()
  }
  if (DRIVER_NAME === 'db') {
    const mod = await import('./drivers/db-sidecar.mjs')
    return mod.createDriver()
  }
  if (DRIVER_NAME !== 'mock') throw new Error(`未知 BRIDGE_DRIVER：${DRIVER_NAME}`)
  const mod = await import('./drivers/mock.mjs')
  return mod.createDriver()
}

/** 朋友圈驱动与聊天驱动解耦：db sidecar 只接管 moment.fetch，默认仍走原驱动。 */
async function loadMomentDriver() {
  if (MOMENT_DRIVER_NAME === DRIVER_NAME) {
    if (!driver) driver = await loadDriver()
    return driver
  }
  if (MOMENT_DRIVER_NAME === 'db') {
    const mod = await import('./drivers/db-sidecar.mjs')
    return mod.createDriver()
  }
  if (MOMENT_DRIVER_NAME === 'uia') {
    const mod = await import('./drivers/uia-readonly.mjs')
    return mod.createDriver()
  }
  if (MOMENT_DRIVER_NAME === 'ocr') {
    const mod = await import('./drivers/ocr-readonly.mjs')
    return mod.createDriver()
  }
  if (MOMENT_DRIVER_NAME === 'wcfhttp') {
    const mod = await import('./drivers/wcfhttp.mjs')
    return mod.createDriver()
  }
  throw new Error(`未知 BRIDGE_MOMENT_DRIVER：${MOMENT_DRIVER_NAME}`)
}

async function ensureMomentDriver() {
  if (!momentDriver) momentDriver = await loadMomentDriver()
  return momentDriver
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

async function loadMoments() {
  if (!existsSync(MOMENTS_FILE)) return
  const raw = await readFile(MOMENTS_FILE, 'utf8')
  const parsed = raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
  momentQueue = parsed
    .filter((item) => item && typeof item.momentSeq === 'number')
    .slice(-MAX_MOMENTS)
  for (const item of momentQueue) {
    if (item.id) seenMomentIds.add(String(item.id))
  }
  const last = momentQueue.at(-1)
  momentSeq = last ? last.momentSeq : 0
}

async function appendMoment(raw) {
  const moment = parseMomentMessage(raw)
  if (!moment?.id) return false
  if (seenMomentIds.has(moment.id)) return false
  momentSeq += 1
  const stored = { ...moment, momentSeq }
  await mkdir(dirname(MOMENTS_FILE), { recursive: true })
  await appendFile(MOMENTS_FILE, `${JSON.stringify(stored)}\n`, 'utf8')
  momentQueue.push(stored)
  if (momentQueue.length > MAX_MOMENTS) momentQueue = momentQueue.slice(-MAX_MOMENTS)
  seenMomentIds.add(moment.id)
  return true
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** /pyq 只负责刷新，朋友圈数据从回调里来；等一小段时间收齐这一页再翻下一页。 */
async function waitForMoments(before) {
  const deadline = Date.now() + MOMENT_WAIT_MS
  while (Date.now() < deadline) {
    await sleep(250)
    if (momentSeq > before) {
      // 回调常是一批连续到达，多等 500ms 收齐，避免每页只拿到第一条。
      await sleep(500)
      return
    }
  }
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
  const contentType = String(req.headers['content-type'] ?? '').toLowerCase()
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw))
  }
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

/**
 * 字段可得性：只从本次合并后的真实动态派生事实，缺失即标不可得，绝不填空值补造。
 * likes/comments 当前没有任何驱动解析点赞/评论，函数只认真实标记，缺失恒为 false；
 * media 取任一动态的 mediaUrls 非空，authorIdentity 取任一 authorResolved === true。
 */
function deriveMomentFields(moments) {
  const list = Array.isArray(moments) ? moments : []
  const media = list.some(
    (moment) =>
      moment &&
      Array.isArray(moment.mediaUrls) &&
      moment.mediaUrls.some((url) => typeof url === 'string' && url.trim()),
  )
  const likes = list.some((moment) => moment?.likes === true)
  const comments = list.some((moment) => moment?.comments === true)
  const authorIdentity = list.some((moment) => moment?.authorResolved === true)
  const missing = []
  if (!media) missing.push('图片')
  if (!likes) missing.push('点赞')
  if (!comments) missing.push('评论')
  if (!authorIdentity) missing.push('作者身份')
  return {
    media,
    likes,
    comments,
    authorIdentity,
    reason: missing.length === 0 ? null : `当前驱动只返回正文：${missing.join('、')}均不可得`,
  }
}

/** UIA 失败判定：抛错已在上层包成 failed；ok=false / 0 条且 stopReason=error 都算失败。 */
function isUiaFailure(result) {
  if (!result || typeof result !== 'object') return true
  if (result.status === 'failed') return true
  const data = result.data && typeof result.data === 'object' ? result.data : {}
  const moments = Array.isArray(data.moments) ? data.moments : []
  if (moments.length === 0 && data.stopReason === 'error') return true
  return false
}

/** BRIDGE_UIA_FALLBACK=off 关闭回退；默认 UIA 失败后自动落到 OCR 驱动。 */
const UIA_FALLBACK_ENABLED = process.env.BRIDGE_UIA_FALLBACK !== 'off'
let ocrFallbackDriver = null
let ocrFallbackLoading = null

async function ensureOcrFallbackDriver() {
  if (ocrFallbackDriver) return ocrFallbackDriver
  if (!ocrFallbackLoading) {
    ocrFallbackLoading = import('./drivers/ocr-readonly.mjs').then((mod) => mod.createDriver())
  }
  ocrFallbackDriver = await ocrFallbackLoading
  return ocrFallbackDriver
}

/** UIA 失败后回退 OCR；OCR 同样失败时返回 null，保留原始失败结果，绝不假装 UIA 成功。 */
async function fallbackToOcr(body, maxPages, cursor, reason) {
  const ocr = await ensureOcrFallbackDriver()
  let result
  try {
    result = await ocr.action('moment.fetch', { ...body, id: cursor, maxPages })
  } catch (e) {
    result = {
      status: 'failed',
      reason: e instanceof Error ? e.message : 'OCR 回退失败',
      data: { stopReason: 'error' },
    }
  }
  if (result?.status === 'failed') return null
  const data = result?.data && typeof result.data === 'object' ? result.data : {}
  if (Array.isArray(data.moments) && data.moments.length === 0 && data.stopReason === 'error') {
    return null
  }
  return { result, fallback: { from: 'uia', to: 'ocr', reason } }
}

async function runMomentFetch(body) {
  const momentSource = await ensureMomentDriver()
  if (!momentSource?.action) return { status: 'unsupported', reason: '驱动不支持动作' }
  const maxPages = Math.min(Math.max(Number(body.maxPages ?? 3) || 3, 1), 30)
  let cursor = Number(body.id ?? 0) || 0
  let all = []
  let pages = 0
  let source = MOMENT_DRIVER_NAME
  let extraReason = ''
  let stopReason = ''
  let limitReached = false
  let occludedBy = null
  let fallback = null
  for (let page = 0; page < maxPages; page += 1) {
    const before = momentSeq
    let result
    try {
      result = await momentSource.action('moment.fetch', {
        ...body,
        id: cursor,
        maxPages,
      })
    } catch (e) {
      result = {
        status: 'failed',
        reason: e instanceof Error ? e.message : '动作抛错',
        data: { stopReason: 'error' },
      }
    }
    if (MOMENT_DRIVER_NAME === 'uia' && UIA_FALLBACK_ENABLED && isUiaFailure(result)) {
      const reason = result?.reason || 'UIA 驱动未返回可用朋友圈数据'
      const fb = await fallbackToOcr(body, maxPages, cursor, reason)
      if (fb) {
        fallback = fb.fallback
        result = fb.result
      }
    }
    if (result?.status === 'unsupported') {
      return {
        ...result,
        stopReason: 'unsupported',
        data: { ...(result.data ?? {}), stopReason: 'unsupported' },
      }
    }
    if (result?.status === 'failed') {
      return {
        ...result,
        stopReason: 'error',
        data: { ...(result.data ?? {}), stopReason: 'error' },
      }
    }
    const data = result?.data && typeof result.data === 'object' ? result.data : {}
    if (typeof data.source === 'string' && data.source) source = data.source
    if (typeof data.reason === 'string' && data.reason) extraReason = data.reason
    if (Array.isArray(data.moments)) all = mergeMoments(all, data.moments)
    pages += 1
    if (typeof data.pages === 'number' && Number.isFinite(data.pages)) {
      pages = Math.max(pages, data.pages)
    }
    // OCR 驱动单次调用已完成多页遍历，直接沿用它给出的停止语义；
    // wcfhttp 循环路径没有驱动级 stopReason，循环结束后按页数/回调结果自己判定。
    if (typeof data.stopReason === 'string' && data.stopReason) stopReason = data.stopReason
    if (data.limitReached === true) limitReached = true
    if (typeof data.occludedBy === 'string' && data.occludedBy) occludedBy = data.occludedBy
    // OCR 驱动自己完成了多页遍历；wcfhttp 则只负责 /pyq 刷新，等回调并翻下一页。
    if (data.paging === 'driver' || data.requiresCallback !== true) break
    await waitForMoments(before)
    const fresh = momentQueue.filter((item) => item.momentSeq > before)
    if (fresh.length === 0) break
    all = mergeMoments(all, fresh)
    const next = nextMomentCursor(fresh)
    if (!next || next === cursor) break
    cursor = next
  }
  if (!stopReason) {
    if (pages >= maxPages) {
      stopReason = 'page-limit'
      limitReached = true
    } else {
      stopReason = 'no-more-data'
    }
  }
  const archive = { added: 0, updated: 0, total: 0 }
  let archiveError = ''
  if (MOMENT_ARCHIVE_FILE) {
    try {
      Object.assign(archive, await appendMomentArchive(all, MOMENT_ARCHIVE_FILE))
    } catch (e) {
      archiveError = e instanceof Error ? e.message : '朋友圈归档写入失败'
      console.error('[wechat-bridge] 朋友圈归档失败:', archiveError)
    }
  }
  return {
    status: 'accepted',
    data: {
      moments: all,
      fetched: all.length,
      pages,
      source,
      partial: pages >= maxPages,
      stopReason,
      limitReached,
      occludedBy,
      fields: deriveMomentFields(all),
      fallback: fallback ?? undefined,
      archive,
      archiveError: archiveError || undefined,
      reason:
        all.length > 0
          ? extraReason || undefined
          : extraReason ||
            '刷新已触发，但回调没有返回朋友圈消息；确认 wcfhttp 启动时已开启朋友圈接收，并把回调指向本桥',
    },
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
      endpoints: [
        '/status',
        '/messages',
        '/moments',
        '/moments/archive',
        '/members/map',
        '/send',
        '/action',
        '/typing',
        '/ingest',
      ],
    })
  }

  if (req.method === 'GET' && path === '/status') {
    if (!authorized(req, queryAuth)) return json(res, 401, { ok: false, error: 'unauthorized' })
    const info = driver.status ? await driver.status() : { online: true }
    return json(res, 200, {
      ok: true,
      ...info,
      driver: DRIVER_NAME,
      queued: queue.length,
      seq,
      moments: momentQueue.length,
      momentSeq,
    })
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

  if (req.method === 'GET' && path === '/moments') {
    if (!authorized(req, queryAuth)) return json(res, 401, { ok: false, error: 'unauthorized' })
    const since = Number(url.searchParams.get('since') ?? 0)
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 100), 1), 500)
    const items = momentQueue
      .filter((item) => item.momentSeq > (Number.isFinite(since) ? since : 0))
      .slice(0, limit)
    const next = items.at(-1)?.momentSeq
    return json(res, 200, {
      ok: true,
      moments: items,
      nextCursor: next ? String(next) : (url.searchParams.get('since') ?? '0'),
      momentSeq,
    })
  }

  if (req.method === 'GET' && path === '/members/map') {
    if (!authorized(req, queryAuth)) return json(res, 401, { ok: false, error: 'unauthorized' })
    return json(res, 200, { ok: true, members: memberMap.members })
  }

  if (req.method === 'GET' && path === '/moments/archive') {
    if (!authorized(req, queryAuth)) return json(res, 401, { ok: false, error: 'unauthorized' })
    if (!MOMENT_ARCHIVE_FILE)
      return json(res, 200, { ok: true, total: 0, moments: [], disabled: true })
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 500), 1), 1000)
    try {
      const archive = await readMomentArchive(MOMENT_ARCHIVE_FILE, limit)
      return json(res, 200, { ok: true, ...archive })
    } catch (e) {
      return json(res, 500, {
        ok: false,
        error: e instanceof Error ? e.message : '朋友圈归档读取失败',
      })
    }
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
      let ingested = 0
      let moments = 0
      for (const raw of list) {
        if (isMomentMessage(raw)) {
          if (await appendMoment(raw)) moments += 1
        } else if (await appendInbound(raw)) {
          ingested += 1
        }
      }
      return json(res, 200, { ok: true, ingested, moments, seq, momentSeq })
    }

    if (path === '/members/map') {
      const incoming = Array.isArray(body.members)
        ? body
        : { members: Array.isArray(body) ? body : [] }
      memberMap = mergeMemberMap(memberMap, incoming)
      memberMap = await saveMemberMap(memberMap)
      return json(res, 200, { ok: true, members: memberMap.members })
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
        const action = String(body.action ?? '')
        const result =
          action === 'moment.fetch' ? await runMomentFetch(body) : await driver.action(action, body)
        if (result?.status === 'unsupported') {
          return json(res, 200, {
            ok: false,
            status: 'unsupported',
            error: result.reason ?? '不支持',
            reason: result.reason ?? '不支持',
          })
        }
        if (result?.status === 'failed') {
          return json(res, 200, {
            ok: false,
            status: 'failed',
            error: result.reason ?? '动作失败',
            reason: result.reason ?? '动作失败',
            data: result.data ?? {},
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

if (IS_MAIN) {
  driver = await loadDriver()
  await loadQueue()
  await loadMoments()
  memberMap = await loadMemberMap()
}

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

let server = null

if (IS_MAIN) {
  server = createServer((req, res) => {
    handle(req, res).catch((e) => {
      json(res, 500, { ok: false, error: e instanceof Error ? e.message : 'internal error' })
    })
  })

  server.listen(PORT, HOST, () => {
    console.log(
      `[wechat-bridge] listening on http://${HOST}:${PORT} driver=${DRIVER_NAME} moment=${MOMENT_DRIVER_NAME}`,
    )
    startDriverPoll()
  })
}

function shutdown() {
  if (!server) return
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 3000).unref()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

export const __test__ = { deriveMomentFields, isUiaFailure }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
