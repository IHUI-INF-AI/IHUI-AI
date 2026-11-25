#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 拦截告知入链器(2026-11-24 立)。
 *
 * 为什么要有:对攻击者那句「已写入防篡改证据链」必须是真的。router 的拒绝路径
 * 只有毫秒级预算,不可能在拦截当场做哈希链(那是同步 IO + 读全链),所以它只落
 * 一条轻量 `block-notice.jsonl`;本器负责把未入链的那些搬进 `evidence-chain.jsonl`。
 *
 * 三条纪律:
 *   ① **链坏了就一条不追加**,exit 2 显式未判定 —— 在坏链上继续写等于替篡改打掩护;
 *   ② 幂等按 `ref` 去重(entry 顶层 ref 字段),重跑不会灌重复条;
 *   ③ 只搬"发生了什么"(status/reason/ip/pathLen/时刻),不搬载荷原文 —— 证据要能交出去,
 *      但不能因为取证把攻击串再存一份。
 *
 * 用法:
 *   node scripts/security/notice-intake.mjs [--json] [--limit=500]
 * 退出码:0 完成;2 未判定(链缺失损坏 / 告知日志读不到)。
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { appendEvidence, readChain, verifyChain } from './lib/evidence-chain.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CHAIN = join(ROOT, '.ihui-agent', 'state', 'evidence-chain.jsonl')
const NOTICE_LOG = process.env.IHUI_BLOCK_NOTICE_LOG || 'D:\\DevEnv\\logs\\block-notice.jsonl'

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const limitArg = args.find((a) => a.startsWith('--limit='))
const LIMIT = limitArg ? Math.max(1, Number(limitArg.split('=')[1]) || 500) : 500

function emit(payload, code = 0) {
  if (asJson || code !== 0) process.stdout.write(`${JSON.stringify(payload)}\n`)
  else {
    process.stdout.write(
      `notice-intake: scanned=${payload.scanned} appended=${payload.appended} skipped=${payload.skipped} ` +
        `failed=${payload.failed} chain=${payload.chainCount} → ${payload.state}\n`,
    )
  }
  process.exit(code)
}

if (!existsSync(NOTICE_LOG)) {
  emit({ state: 'undetermined', reason: `告知日志不存在:${NOTICE_LOG}`, scanned: 0, appended: 0, skipped: 0, failed: 0, chainCount: null }, 2)
}

const { entries, error } = readChain(CHAIN)
if (error) emit({ state: 'undetermined', reason: `证据链读取失败:${error}`, scanned: 0, appended: 0, skipped: 0, failed: 0, chainCount: null }, 2)

const verdict = verifyChain(entries)
if (!verdict.ok) {
  emit(
    { state: 'undetermined', reason: `证据链校验失败(${verdict.reason}) — 拒绝在坏链上追加`, scanned: 0, appended: 0, skipped: 0, failed: 0, chainCount: verdict.count },
    2,
  )
}

const seen = new Set(entries.map((e) => e?.ref).filter(Boolean))
const lines = readFileSync(NOTICE_LOG, 'utf8').split(/\r?\n/).filter(Boolean)

let scanned = 0
let appended = 0
let skipped = 0
let failed = 0

for (const line of lines) {
  if (appended >= LIMIT) break
  scanned += 1
  let row
  try {
    row = JSON.parse(line)
  } catch {
    skipped += 1
    continue
  }
  const ref = row?.ref
  if (!ref || seen.has(ref)) {
    skipped += 1
    continue
  }
  const payload = {
    kind: 'block-notice',
    status: row.status ?? null,
    reason: row.reason ?? null,
    ip: row.ip ?? null,
    // 工具名进链:文案说"这一点已记进证据",链里就必须真有这一格
    tool: row.tool ?? null,
    attempt: row.attempt ?? null,
    // 降级标志也进链:只有进了链,"高压时我们确实只回了 218 字节"才可事后核验
    minimal: row.minimal ?? false,
    pathLen: row.pathLen ?? null,
  }
  const r = appendEvidence(CHAIN, payload, { ts: row.ts ?? new Date().toISOString(), ref })
  if (r.ok) {
    appended += 1
    seen.add(ref)
  } else {
    failed += 1
  }
}

emit({
  state: failed ? 'partial' : 'ok',
  scanned,
  appended,
  skipped,
  failed,
  chainCount: entries.length + appended,
  chainHead: verifyChain(readChain(CHAIN).entries).head ?? null,
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
