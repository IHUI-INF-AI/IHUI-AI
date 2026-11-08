// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gate-attempt-ledger.mjs — "重试变绿"判定(2026-11-08 立)。
 *
 * 为什么要有这一层:上一轮的两笔失败修复 + 本轮的门体自检,都可能被同一种操作绕开 ——
 * **同一道门、同一份被判内容,先红两次,第三次转绿,于是把这枚当成通过**。
 * 这不是修好了,是训练"红了就重试"。本层把这种序列**从绿里分出去**,判成 UNDETERMINED
 * (§0.3:不记绿、不冒红、exit 2),并附两次读数差异,逼出真 bug。
 *
 * 口径:
 *   - worldKey = HEAD sha + 索引 stage 指纹 + 受追踪文件的脏面指纹。**同一 key** 才叫"同一份被判内容";
 *     修了东西但没进索引 ⇒ key 不变,不构成"换了结论",仍按重试算(提交链本就要求显式暂存)。
 *   - 只记 blocking 门的 pass / red;未判定与跳过不入账(它们本来就不记绿)。
 *   - 账本 `.ihui-agent/state/gate-attempt-ledger.jsonl`(被 .gitignore 整体忽略),按 key+门取尾部序列。
 *   - 阈值:2 次红后转绿即未判定;红 1 次后转绿属正常"改一次就过",不拦。
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { resolveGitBin } from './gitdir.mjs'

export const RETRY_RED_THRESHOLD = 2
export const LEDGER_REL = '.ihui-agent/state/gate-attempt-ledger.jsonl'
export const RETRY_WINDOW_MS = 6 * 60 * 60 * 1000
const MAX_LEDGER_BYTES = 2 * 1024 * 1024

function git(root, args) {
  return execFileSync(resolveGitBin() || 'git', ['-C', root, ...args], {
    encoding: 'utf8',
    timeout: 15_000,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

function sha1(text) {
  return createHash('sha1').update(text, 'utf8').digest('hex')
}

/**
 * 被判内容指纹。取不到 git 读数 ⇒ 返回 key=null(调用方据此放弃"重试变绿"判定,
 * 但不改变该门自身结论 —— 本层只加一格未判定,不替门作答)。
 * 30 秒进程内缓存:一批 300+ 道门逐门算 3 次 git 是 fork 风暴,而索引在批内基本不动。
 */
const worldKeyCache = new Map()
export function computeWorldKey(root, { now = Date.now(), ttlMs = 30_000 } = {}) {
  const hit = worldKeyCache.get(root)
  if (hit && now - hit.at < ttlMs) return hit.value
  let value
  try {
    const head = git(root, ['rev-parse', 'HEAD']).trim()
    const index = sha1(git(root, ['ls-files', '-s']))
    const dirty = sha1(git(root, ['status', '--porcelain', '-uno']))
    value = { head, index, dirty, key: `${head}:${index}:${dirty}` }
  } catch {
    value = null
  }
  worldKeyCache.set(root, { at: now, value })
  return value
}

export function ledgerPath(root) {
  return join(root, LEDGER_REL)
}

export function readLedger(root) {
  const abs = ledgerPath(root)
  if (!existsSync(abs)) return []
  const out = []
  for (const line of readFileSync(abs, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      out.push(JSON.parse(trimmed))
    } catch {
      // 半行/坏行不参与判定:账本是观测面,坏行不能变成"绿"或"红"的理由。
    }
  }
  return out
}

function pruneIfNeeded(root, entries, now = Date.now()) {
  const abs = ledgerPath(root)
  const cutoff = now - RETRY_WINDOW_MS
  const kept = entries.filter((e) => Number(e?.at) >= cutoff)
  const big = existsSync(abs) && statSync(abs).size > MAX_LEDGER_BYTES
  if (big || kept.length !== entries.length) {
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, kept.map((e) => JSON.stringify(e)).join('\n') + (kept.length ? '\n' : ''), 'utf8')
  }
}

export function appendAttempt(root, entry) {
  const abs = ledgerPath(root)
  mkdirSync(dirname(abs), { recursive: true })
  appendFileSync(abs, `${JSON.stringify(entry)}\n`, 'utf8')
}

/**
 * 记一次尝试。返回 { undetermined, reds } —— 当且仅当"同 key 同门尾部已红 ≥2 次,
 * 现在转绿"时 undetermined=true,reds 是那两次读数(供打印差异)。
 */
export function recordAndClassify({ root, gateId, script, kind, summary, now = Date.now(), ttlMs = 30_000 }) {
  const world = computeWorldKey(root, { now, ttlMs })
  if (!world) return { undetermined: false, reds: [], world: null }
  const entries = readLedger(root)
  const prior = entries
    .filter((e) => e?.key === world.key && String(e?.gateId) === String(gateId))
    .sort((a, b) => Number(a.at) - Number(b.at))
  appendAttempt(root, {
    at: now,
    key: world.key,
    gateId: String(gateId),
    script,
    kind,
    summary: String(summary ?? '').slice(0, 240),
  })
  pruneIfNeeded(root, [...entries, { at: now }], now)
  if (kind !== 'pass') return { undetermined: false, reds: [], world }
  let trailing = 0
  for (let i = prior.length - 1; i >= 0; i -= 1) {
    if (prior[i].kind === 'pass') break
    if (prior[i].kind === 'red') trailing += 1
  }
  if (trailing < RETRY_RED_THRESHOLD) return { undetermined: false, reds: [], world }
  return {
    undetermined: true,
    world,
    reds: prior.filter((e) => e.kind === 'red').slice(-RETRY_RED_THRESHOLD),
  }
}

export function formatRetryReport({ gateId, label, reds }) {
  const lines = [
    `[UNDETERMINED] 未判定:同一判面指纹下该门先红 ${reds.length} 次后转绿 —— 读数不稳,不记绿`,
    `  门: [${gateId}] ${label ?? ''}`.trimEnd(),
    `  被判内容指纹: ${String(reds[0]?.key ?? '').slice(0, 24)}…`,
  ]
  reds.forEach((r, i) => {
    lines.push(
      `  第 ${i + 1} 次红 @ ${new Date(Number(r.at)).toISOString()}: ${String(r.summary ?? '').trim() || '(无输出摘要)'}`,
    )
  })
  lines.push('  人话: 同一份被判内容给出过矛盾的结论 ⇒ 第三次的"绿"不是结论,是先查这条门为什么会抖。')
  return lines.join('\n')
}
