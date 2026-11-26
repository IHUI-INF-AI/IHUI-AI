#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * board.mjs —— 多席之间的**文件式消息板**(2026-11-26 立)
 *
 * 立因:本仓现在是「共享工作树 + 每席各自读 AGENTS + 靠 PROJECT_PLAN 认领行 + commit message 对暗号」。
 * 这套在 8 席以内还能靠人盯,过了 10 席就出现两种已知事故:
 *   ① 同一张票被两席各做一遍(台账里同题重复派发、同题双改);
 *   ② 一席踩了坑(依赖没装、迁移没跑、某文件别席在飞),其余席要等它撞第二次才知道。
 * 原文的 Swarm 用 msgboard 频道 + 控制器每 3–5 分钟把通知送到 Agent 面前解决这件事;
 * 本器只做**最小可用的那一半**:append-only 的频道文件 + 游标未读,不建服务、不进 git、
 * 不引入轮询守护进程 —— 通知由派发方在组装 promptFile 时调用 `inbox` 注入(见 auto-evolve)。
 *
 * 三条纪律:
 *   ① 帖子硬上限 1200 字(原文同款),超了拒收而不是悄悄截断 —— 截断会让"谁说了什么"失真;
 *   ② 只 append,不改旧帖;频道与游标都在 `.ihui-agent/board/`(已被 .gitignore 整目录忽略);
 *   ③ 未读判定用 `(ts,id)` 元组,**不只看时间戳** —— 同一毫秒两条帖时只看 ts 会漏读。
 *
 * 用法:
 *   node scripts/board.mjs post --channel autonomy --from s-123 --text "RP-45 接线完成,谁在跑尺子?"
 *   node scripts/board.mjs list --channel autonomy --limit 20
 *   node scripts/board.mjs inbox --for s-456 [--advance] [--json]
 *   node scripts/board.mjs channels
 *   node scripts/board.mjs --self-test
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const BOARD_DIR = process.env.IHUI_BOARD_DIR
  ? path.resolve(process.env.IHUI_BOARD_DIR)
  : path.join(ROOT, '.ihui-agent', 'board')
export const MAX_CHARS = 1200
export const DEFAULT_CHANNELS = ['general', 'api-web', 'autonomy']
const CHANNEL_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/
const ACTOR_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/
const MENTION_RE = /@([A-Za-z0-9][A-Za-z0-9_-]{1,31})/g

export function assertChannel(channel) {
  if (!CHANNEL_RE.test(String(channel ?? ''))) throw new Error(`频道名非法(只收小写字母/数字/-/_,≤32):${channel}`)
  return channel
}

export function assertActor(actor) {
  if (!ACTOR_RE.test(String(actor ?? ''))) throw new Error(`发言者名非法(字母数字._:- ,≤64):${actor}`)
  return actor
}

/** 按码点数,不按 UTF-16 码元 —— 一个 emoji 不该算两个字。 */
export function textLength(text) {
  return [...String(text ?? '')].length
}

export function assertText(text) {
  const t = String(text ?? '').trim()
  if (!t) throw new Error('帖子正文为空')
  if (textLength(t) > MAX_CHARS) throw new Error(`帖子 ${textLength(t)} 字,超过上限 ${MAX_CHARS}`)
  return t
}

export function parseMentions(text) {
  const out = []
  for (const m of String(text ?? '').matchAll(MENTION_RE)) if (!out.includes(m[1])) out.push(m[1])
  return out
}

/**
 * 调度侧注入用的「近窗摘要」:不依赖游标(自治会话是短命的,没有稳定 actor id 可存游标),
 * 只取近 windowMs 内最后 limit 条 —— 目的是"把别席刚踩的坑送到它眼前",不是做已读回执。
 */
export function renderDigest(rows, { now = Date.now(), windowMs = 30 * 60 * 1000, limit = 5 } = {}) {
  const recent = (rows ?? [])
    .filter((r) => {
      const t = Date.parse(r?.ts ?? '')
      return Number.isFinite(t) && now - t <= windowMs && t <= now + 60 * 1000
    })
    .sort((a, b) => String(a.ts).localeCompare(String(b.ts)) || String(a.id).localeCompare(String(b.id)))
    .slice(-limit)
  if (recent.length === 0) return []
  return [
    `## 消息板近 ${Math.round(windowMs / 60000)} 分钟(调度侧主动注入,不用你轮询)`,
    ...recent.map((r) => `- ${r.ts} [${r.channel}] ${r.from}: ${String(r.text).slice(0, 300)}`),
    `> 这些是别席刚留下的上下文;与票面冲突时以票面和 AGENTS 为准,不要拿板上的话改判据。`,
    ``,
  ]
}

function channelPath(channel) {
  assertChannel(channel)
  return path.join(BOARD_DIR, `${channel}.jsonl`)
}

function ensureDirs() {
  mkdirSync(BOARD_DIR, { recursive: true })
  mkdirSync(path.join(BOARD_DIR, '.cursors'), { recursive: true })
  for (const ch of DEFAULT_CHANNELS) {
    const p = path.join(BOARD_DIR, `${ch}.jsonl`)
    if (!existsSync(p)) writeFileSync(p, '', 'utf8')
  }
}

/** 跨进程追加锁:目录创建是原子的;持锁超过 15s 视为 stale(上一次进程崩了),清掉重来。 */
export function withLock(fn) {
  ensureDirs()
  const lock = path.join(BOARD_DIR, '.lock')
  const deadline = Date.now() + 3000
  let acquired = false
  while (!acquired) {
    try {
      mkdirSync(lock)
      acquired = true
    } catch {
      try {
        if (Date.now() - statSync(lock).mtimeMs > 15000) {
          rmSync(lock, { recursive: true, force: true })
          continue
        }
      } catch {
        // 锁刚好被别人释放:直接重试
      }
      if (Date.now() > deadline) throw new Error('消息板忙(3s 内拿不到锁)')
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25)
    }
  }
  try {
    return fn()
  } finally {
    rmSync(lock, { recursive: true, force: true })
  }
}

export function post({ channel, from, text, now = new Date() }) {
  const ch = assertChannel(channel)
  const actor = assertActor(from)
  const body = assertText(text)
  return withLock(() => {
    const row = {
      id: randomUUID(),
      ts: now.toISOString(),
      channel: ch,
      from: actor,
      text: body,
      mentions: parseMentions(body),
    }
    appendFileSync(channelPath(ch), JSON.stringify(row) + '\n', 'utf8')
    return row
  })
}

export function readChannel(channel, { limit = 0 } = {}) {
  const p = channelPath(channel)
  if (!existsSync(p)) return []
  const rows = []
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const s = line.trim()
    if (!s) continue
    try {
      const row = JSON.parse(s)
      if (row && typeof row === 'object' && row.id && row.ts) rows.push(row)
    } catch {
      // 坏行不猜:跳过但保留其余帖;板子是通知面,不是判据面。
    }
  }
  rows.sort((a, b) => String(a.ts).localeCompare(String(b.ts)) || String(a.id).localeCompare(String(b.id)))
  return limit > 0 ? rows.slice(-limit) : rows
}

export function listChannels() {
  ensureDirs()
  return readdirSync(BOARD_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.jsonl'))
    .map((e) => e.name.slice(0, -'.jsonl'.length))
    .sort()
}

function cursorPath(actor) {
  assertActor(actor)
  return path.join(BOARD_DIR, '.cursors', `${actor}.json`)
}

export function readCursor(actor) {
  const p = cursorPath(actor)
  if (!existsSync(p)) return { lastTs: '', lastId: '' }
  try {
    const obj = JSON.parse(readFileSync(p, 'utf8'))
    return { lastTs: String(obj.lastTs ?? ''), lastId: String(obj.lastId ?? '') }
  } catch {
    return { lastTs: '', lastId: '' }
  }
}

function gt(row, cursor) {
  const ts = String(row.ts)
  if (ts !== cursor.lastTs) return ts > cursor.lastTs
  return String(row.id) > cursor.lastId
}

export function inbox({ for: actor, advance = false, channels = listChannels(), limitPerChannel = 0 }) {
  const cursor = readCursor(actor)
  const messages = []
  for (const ch of channels) {
    for (const row of readChannel(ch, { limit: limitPerChannel })) {
      if (row.from === actor) continue
      if (gt(row, cursor)) messages.push(row)
    }
  }
  messages.sort((a, b) => String(a.ts).localeCompare(String(b.ts)) || String(a.id).localeCompare(String(b.id)))
  if (advance && messages.length > 0) {
    const last = messages[messages.length - 1]
    writeFileSync(cursorPath(actor), JSON.stringify({ lastTs: last.ts, lastId: last.id, updatedAt: new Date().toISOString() }), 'utf8')
  }
  return messages
}

function parseArgs(argv) {
  const opts = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        opts[key] = next
        i++
      } else opts[key] = true
    } else opts._.push(a)
  }
  return opts
}

function selfTest() {
  const fails = []
  const check = (cond, msg) => {
    if (!cond) fails.push(msg)
  }
  const tmp = path.join(ROOT, '.ihui-agent', 'tmp', `board-selftest-${randomUUID().slice(0, 8)}`)
  process.env.IHUI_BOARD_DIR = tmp
  // 注意:BOARD_DIR 是模块加载时求值的常量;自测直接用内部函数时需重设模块常量不可行,
  // 因此这里走子进程路径不现实。改用直接 fd 级检查:只测纯函数 + 临时目录手工模拟。
  check(assertChannel('api-web') === 'api-web' && (() => { try { assertChannel('Bad Name'); return false } catch { return true } })(), '频道名校验')
  check(textLength('😀a') === 2, '字数应按码点计')
  check((() => { try { assertText('x'.repeat(MAX_CHARS + 1)); return false } catch { return true } })(), '超长帖应拒收')
  check(parseMentions('@s-1 看下 @s-2 和 @s-1').join(',') === 's-1,s-2', '提及去重保序')
  const a = { ts: '2026-11-26T01:00:00.000Z', id: 'a' }
  const b = { ts: '2026-11-26T01:00:00.000Z', id: 'b' }
  check(gt(b, { lastTs: a.ts, lastId: a.id }), '同毫秒应按 id 续读')
  check(!gt(a, { lastTs: a.ts, lastId: a.id }), '同一帖不应重复算未读')
  const digest = renderDigest(
    [
      { id: '1', ts: '2026-11-26T01:00:00.000Z', channel: 'general', from: 's-a', text: '旧帖' },
      { id: '2', ts: '2026-11-26T01:20:00.000Z', channel: 'autonomy', from: 's-b', text: '新帖' },
    ],
    { now: Date.parse('2026-11-26T01:30:00.000Z'), windowMs: 30 * 60 * 1000, limit: 1 },
  )
  check(digest.length === 4 && digest[1].includes('新帖') && !digest.join('').includes('旧帖'), '近窗摘要应只取窗口内最后 limit 条')
  rmSync(tmp, { recursive: true, force: true })
  if (fails.length > 0) {
    console.log('[SELF-TEST FAIL]')
    for (const f of fails) console.log('  ✗', f)
    return 2
  }
  console.log('[SELF-TEST PASS] 频道/字数/提及/游标元组 形状锁通过(不写正式板)。')
  return 0
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const cmd = argv[0]
  const opts = parseArgs(argv.slice(1))
  try {
    if (cmd === 'post') {
      const row = post({ channel: opts.channel ?? 'general', from: opts.from ?? process.env.IHUI_SESSION_ID ?? 'unknown', text: opts.text })
      console.log(JSON.stringify(row))
      return 0
    }
    if (cmd === 'list') {
      const rows = readChannel(opts.channel ?? 'general', { limit: Number(opts.limit ?? 20) })
      if (opts.json) console.log(JSON.stringify(rows, null, 2))
      else for (const r of rows) console.log(`${r.ts} [${r.channel}] ${r.from}: ${r.text}`)
      return 0
    }
    if (cmd === 'channels') {
      console.log(listChannels().join('\n'))
      return 0
    }
    if (cmd === 'inbox') {
      const rows = inbox({ for: opts.for ?? process.env.IHUI_SESSION_ID ?? 'unknown', advance: Boolean(opts.advance) })
      if (opts.json) console.log(JSON.stringify(rows, null, 2))
      else for (const r of rows) console.log(`${r.ts} [${r.channel}] ${r.from}: ${r.text}`)
      return 0
    }
    console.error('用法: board.mjs post|list|inbox|channels|--self-test')
    return 2
  } catch (e) {
    console.error(`[board] ${e.message}`)
    return 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
