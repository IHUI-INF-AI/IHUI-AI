#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 具名追认台账签发器（`scripts/data/immutable-guard-attestations.jsonl`）
 *
 * ## 签名算法（**与 scripts/lib/immutable-guard.mjs 的 attestPayload/signAttestation 逐字一致**）
 *
 *   payload  = JSON.stringify({ sha, paths, reason, reviewer, attestedAt })
 *   键序     固定为 sha → paths → reason → reviewer → attestedAt
 *            （JS 对象字符串化按插入序输出；换序 ⇒ JSON 文本变 ⇒ 签名全废）
 *   paths    去重后按字典序升序（`.sort()`，Node 默认 UTF-16 码元序）；路径原样，不做大小写/斜杠改写
 *   sig      = HMAC-SHA256(key, payload)，输出 64 位小写 hex（不带版本前缀）
 *   key      **独立追认钥**（2026-11-07 钥分离，与提交签名钥必须是两把），来源优先级：
 *            `IHUI_IMMUTABLE_GUARD_ACK_KEY` → `IHUI_IMMUTABLE_GUARD_ACK_KEY_FILE`
 *            → `git config ihui.immutableGuardAckKeyPath`。缺钥 ⇒ 拒签（fail-closed）。
 *
 * 注意：`reason` / `reviewer` / `attestedAt` **按落盘原值**参与签名，本工具不做 trim 归一；
 * 落盘前会把两端空白去掉并在校验阶段就拒绝空值，避免"签的和验的不是同一个字节"。
 *
 * ## 用法
 *
 *   node scripts/sign-immutable-attestations.mjs --in rows.json [--append]
 *   node scripts/sign-immutable-attestations.mjs --in rows.json --out ledger.jsonl
 *   cat rows.json | node scripts/sign-immutable-attestations.mjs
 *
 * `rows.json` 是对象数组，每项 `{ sha, paths, reason, reviewer, attestedAt }`，不含 `sig`。
 * 默认把结果 JSONL 打到 stdout；`--append` 追加到台账（拒绝与既有行同 sha 的重复追认）。
 *
 * ## 校验（任一条不过 ⇒ 整批拒绝，不产出半成品）
 *
 *   - `sha` 40 位全量小写 hex；`paths` 非空字符串数组（该枚**实际触发路径全集**，不多不少）；
 *   - `reason` ≥ 40 字（逐字符计，不算空白）；`reviewer` 非空；`attestedAt` = YYYY-MM-DD；
 *   - 同一批内 sha 不许重复；`--append` 时还不许与台账既有行重复。
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  ATTEST_LEDGER_REL,
  ATTEST_MIN_REASON_CHARS,
  ATTEST_SIG_RE,
  FULL_SHA_RE,
  signAttestation,
} from './lib/immutable-guard.mjs'
import { ROOT, resolveAckKey, resolveSigningKey } from './check-immutable-guard.mjs'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function fail(msg) {
  console.error(`[sign-attestations] ${msg}`)
  process.exit(1)
}

function parseArgv(argv) {
  const o = { in: null, out: null, append: false, root: ROOT }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--in') o.in = argv[++i]
    else if (a === '--out') o.out = argv[++i]
    else if (a === '--append') o.append = true
    else if (a === '--root') o.root = argv[++i]
    else if (a === '--help' || a === '-h') {
      console.log(
        [
          '用法: node scripts/sign-immutable-attestations.mjs --in <rows.json> [--append|--out <file>] [--root <仓根>]',
          `台账: ${ATTEST_LEDGER_REL}（一行一条；reason ≥${ATTEST_MIN_REASON_CHARS} 字；paths 必须与该枚实际触发路径逐元素相等）`,
        ].join('\n'),
      )
      process.exit(0)
    } else fail(`未知参数：${a}（--help 看用法）`)
  }
  return o
}

/** 逐项校验并归一；返回 { rows, problems }。problems 非空 ⇒ 调用方整批拒绝。 */
export function validateRows(input) {
  const rows = []
  const problems = []
  if (!Array.isArray(input)) return { rows, problems: ['输入必须是对象数组'] }
  input.forEach((raw, i) => {
    const at = `第 ${i + 1} 条`
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      problems.push(`${at}：不是对象`)
      return
    }
    const sha = String(raw.sha ?? '').trim().toLowerCase()
    if (!FULL_SHA_RE.test(sha)) {
      problems.push(`${at}：sha 必须 40 位全量小写 hex（收到 ${JSON.stringify(raw.sha)}）`)
      return
    }
    const paths = Array.isArray(raw.paths)
      ? [...new Set(raw.paths.map((p) => String(p ?? '').trim()))].sort()
      : null
    if (!paths || paths.length === 0 || paths.some((p) => !p)) {
      problems.push(`${at}（${sha.slice(0, 10)}）：paths 必须是非空的路径字符串数组`)
      return
    }
    const reason = String(raw.reason ?? '').trim()
    if ([...reason].length < ATTEST_MIN_REASON_CHARS) {
      problems.push(
        `${at}（${sha.slice(0, 10)}）：reason 不足 ${ATTEST_MIN_REASON_CHARS} 字（当前 ${[...reason].length} 字）`,
      )
      return
    }
    const reviewer = String(raw.reviewer ?? '').trim()
    if (!reviewer) {
      problems.push(`${at}（${sha.slice(0, 10)}）：reviewer 必填`)
      return
    }
    const attestedAt = String(raw.attestedAt ?? '').trim()
    if (!DATE_RE.test(attestedAt)) {
      problems.push(`${at}（${sha.slice(0, 10)}）：attestedAt 必须是 YYYY-MM-DD`)
      return
    }
    rows.push({ sha, paths, reason, reviewer, attestedAt })
  })
  const seen = new Set()
  for (const r of rows) {
    if (seen.has(r.sha)) problems.push(`同一批内 sha 重复：${r.sha}（不许重复追认）`)
    seen.add(r.sha)
  }
  return { rows, problems }
}

function main() {
  const opts = parseArgv(process.argv.slice(2))
  const rawText = opts.in
    ? readFileSync(path.resolve(opts.root, opts.in), 'utf8')
    : readFileSync(0, 'utf8')
  let parsed
  try {
    parsed = JSON.parse(rawText)
  } catch (e) {
    fail(`--in 不是合法 JSON：${e.message}`)
  }
  const { rows, problems } = validateRows(parsed)
  if (problems.length) fail(`校验不过（整批拒绝）：\n  - ${problems.join('\n  - ')}`)
  if (!rows.length) fail('没有可签的行（不产出空台账）')

  const ledgerPath = path.join(opts.root, ATTEST_LEDGER_REL)
  if (opts.append) {
    const existing = new Set()
    if (existsSync(ledgerPath)) {
      for (const line of readFileSync(ledgerPath, 'utf8').split(/\r?\n/)) {
        if (!line.trim()) continue
        try {
          const o = JSON.parse(line)
          if (o && o.sha) existing.add(String(o.sha).toLowerCase())
        } catch {
          fail(`台账既有行不是合法 JSON，拒绝在其后追加：${line.slice(0, 80)}`)
        }
      }
    }
    const dup = rows.filter((r) => existing.has(r.sha))
    if (dup.length) fail(`台账里已有同 sha 记录，拒绝重复追认：${dup.map((r) => r.sha).join(', ')}`)
  }

  const keyRes = resolveAckKey(opts.root)
  if (!keyRes.key) fail(`取不到独立追认密钥（拒签，fail-closed）：${keyRes.why}`)
  const submitRes = resolveSigningKey(opts.root)
  if (submitRes.key && submitRes.key === keyRes.key)
    fail('独立追认密钥与提交签名密钥是同一把 ⇒ 追认退化为作者自认，拒签（钥未分离）')

  const outLines = rows.map((r) => {
    let sig
    try {
      sig = signAttestation({ ...r, key: keyRes.key })
    } catch (e) {
      fail(`签发失败（${r.sha.slice(0, 10)}）：${e.message}`)
    }
    if (!ATTEST_SIG_RE.test(sig)) fail(`签发结果形状坏：${sig}`)
    return JSON.stringify({ ...r, sig })
  })
  const body = `${outLines.join('\n')}\n`

  if (opts.append) {
    appendFileSync(ledgerPath, body, 'utf8')
    console.log(
      `[sign-attestations] 追加 ${rows.length} 条 → ${ATTEST_LEDGER_REL}（密钥来源：${keyRes.source}）`,
    )
  } else if (opts.out) {
    writeFileSync(path.resolve(opts.root, opts.out), body, 'utf8')
    console.log(`[sign-attestations] 写出 ${rows.length} 条 → ${opts.out}（密钥来源：${keyRes.source}）`)
  } else {
    process.stdout.write(body)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
