// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'

function digest(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function measuredDrop(value) {
  return Number.isInteger(value) && value >= 0
}

/**
 * 给一份 jsonl 正文计划封存。不读盘。
 * 老化裁掉的条数必须是已经量到的非负整数；没给就拒绝，不用 0 代替。
 * 末行没有换行，或某一行不是 JSON 对象，整份拒绝，不把残行算进条数。
 */
export function planLedgerSeal(text, opts = {}) {
  const segment = typeof opts.segment === 'string' ? opts.segment.trim() : ''
  if (!segment) return { ok: false, reason: 'segment-absent', seal: null }
  if (typeof text !== 'string') return { ok: false, reason: 'text-unreadable', seal: null }
  if (!measuredDrop(opts.dropped)) return { ok: false, reason: 'dropped-unmeasured', seal: null }
  if (typeof opts.timestamp !== 'string' || opts.timestamp.trim() === '') {
    return { ok: false, reason: 'timestamp-absent', seal: null }
  }
  if (text.length > 0 && !text.endsWith('\n')) {
    return { ok: false, reason: 'truncated-tail', seal: null }
  }
  const entries = []
  for (const line of text.split('\n')) {
    if (line === '') continue
    let obj
    try {
      obj = JSON.parse(line)
    } catch {
      return { ok: false, reason: 'line-unreadable', seal: null }
    }
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      return { ok: false, reason: 'line-not-object', seal: null }
    }
    entries.push(line)
  }
  const hashes = entries.map((line) => digest(line))
  return {
    ok: true,
    reason: 'sealed',
    seal: {
      segment,
      entryCount: entries.length,
      firstHash: hashes[0] ?? null,
      lastHash: hashes.at(-1) ?? null,
      fileSha256: digest(text),
      dropped: opts.dropped,
      timestamp: opts.timestamp,
    },
  }
}

/** 封存对不上时点名哪一列。缺封存、没报裁掉条数、正文读不出，都是未判定。 */
export function verifyLedgerSeal(text, seal) {
  if (seal === null || typeof seal !== 'object' || Array.isArray(seal)) {
    return { verdict: 'unjudged', reason: 'seal-absent' }
  }
  if (!measuredDrop(seal.dropped)) return { verdict: 'unjudged', reason: 'dropped-unmeasured' }
  const planned = planLedgerSeal(text, {
    segment: seal.segment,
    dropped: seal.dropped,
    timestamp: typeof seal.timestamp === 'string' ? seal.timestamp : '',
  })
  if (!planned.ok) return { verdict: 'unjudged', reason: planned.reason }
  for (const field of ['segment', 'entryCount', 'firstHash', 'lastHash', 'fileSha256', 'dropped']) {
    if (planned.seal[field] !== seal[field]) return { verdict: 'breach', reason: `${field}-mismatch` }
  }
  return { verdict: 'ok', reason: 'matched' }
}

export function sealPathForLedger(ledgerFile) {
  const file = String(ledgerFile)
  return file.endsWith('.jsonl') ? `${file.slice(0, -'.jsonl'.length)}.seal.json` : `${file}.seal.json`
}

/** 按盘上正文重写封存。封不成就摘掉旧封存，避免旧封存继续为已经变过的正文背书。 */
export function writeLedgerSeal(ledgerFile, opts) {
  let text
  try {
    text = readFileSync(ledgerFile, 'utf8')
  } catch {
    return { ok: false, reason: 'text-unreadable', seal: null }
  }
  const planned = planLedgerSeal(text, opts)
  const dest = sealPathForLedger(ledgerFile)
  if (!planned.ok) {
    if (existsSync(dest)) unlinkSync(dest)
    return planned
  }
  writeFileSync(dest, `${JSON.stringify(planned.seal)}\n`, 'utf8')
  return planned
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
