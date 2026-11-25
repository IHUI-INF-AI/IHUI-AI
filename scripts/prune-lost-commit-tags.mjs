#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * prune-lost-commit-tags.mjs — lost-commit tag 体量闸（按量保留 + 清理前 bundle）
 *
 * 背景（2026-11-25）：check-commit-loss-guard.mjs 的 autoBackupDanglingCommits 对「窗内新出现
 * 且未备份」的悬空 commit 逐枚打 `lost-commit/auto-<sha7>`，无留存期、无上限。实测栈到
 * 26,043 枚（24,969 枚 lost-commit），把 .git size-pack 顶到 2.73 GiB；pre-push 的 pack 预算门
 * 对存量判 blocking ⇒ 所有分支推送永久红（违反 AGENTS §0.2）。同日已人工清空（26589→53 refs、
 * 2.73→1.73 GiB）。本器是防反弹的常驻闸，不是一次性清偿器。
 *
 * 三层判据，逐层保守：
 *   ① 目标 commit 已在基线（main / origin/main）可达 ⇒ tag 的「防 gc」语义为零 ⇒ 直接删，零损失。
 *   ② 不可达但总量 ≤ MAX_KEEP ⇒ 一枚不动（正常波动区间）。
 *   ③ 不可达且超量 ⇒ 按 creatordate 从老到新，保留最近 MAX_KEEP 枚 ∪ 最近 KEEP_DAYS 天；
 *      其余先 bundle 到 state 目录并逐卷 verify，全部成功才删。任一卷失败 ⇒ 整批不删。
 *
 * 用法：
 *   node scripts/prune-lost-commit-tags.mjs                    # dry-run，只报数
 *   node scripts/prune-lost-commit-tags.mjs --apply            # 落盘（bundle + 删）
 *   node scripts/prune-lost-commit-tags.mjs --max-keep 800 --keep-days 10
 *
 * 退出码：0 成功 / 1 bundle 失败已删 0 条 / 2 未判定
 */
/* eslint-disable no-console -- CLI 工具 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gitRaw } from './lib/face-reader.mjs'

const ROOT = resolve(process.cwd())
const APPLY = process.argv.includes('--apply')
const argOf = (name, dflt) => {
  const i = process.argv.indexOf(name)
  if (i <= 0) return dflt
  const raw = Number(process.argv[i + 1])
  return Number.isFinite(raw) && raw > 0 ? raw : dflt
}
const MAX_KEEP = argOf('--max-keep', 500)
const KEEP_DAYS = argOf('--keep-days', 7)
const BUNDLE_CHUNK = 200
const STATE_DIR = join(ROOT, '.ihui-agent', 'state', 'lost-commit-prune')

const die = (code, msg) => {
  console.error(`❌ ${msg}`)
  console.log(`SWEEP-RESULT state=${code === 2 ? 'undetermined' : 'refused'} stale=0 dropped=0 kept=0`)
  process.exit(code)
}

/** 成功返回 stdout 字符串；失败返回 null（不抛）。 */
const gitTry = (args, opts = {}) => {
  try {
    return String(gitRaw(args, ROOT, { timeout: opts.timeout ?? 900_000, maxBuffer: 512 * 1024 * 1024, input: opts.input }) ?? '')
  } catch {
    return null
  }
}
const gitOut = (args, opts) => {
  const out = gitTry(args, opts)
  if (out === null) die(2, `未判定：git ${args.slice(0, 2).join(' ')} 取不到（exit 2）`)
  return out
}

// ── 基线可达集 ──
const bases = []
for (const b of ['refs/heads/main', 'refs/remotes/origin/main']) {
  const sha = gitTry(['rev-parse', '--verify', `${b}^{commit}`])
  if (sha && sha.trim()) bases.push(sha.trim())
}
if (!bases.length) die(2, '未判定：main / origin/main 均解析不出，无法判可达性')

const reachable = new Set()
for (const b of bases) {
  const out = gitOut(['rev-list', '--objects', b])
  for (const line of out.split('\n')) {
    const sha = line.slice(0, 40)
    if (sha) reachable.add(sha)
  }
}

// ── tag 清单 ──
const refOut = gitOut(['for-each-ref', '--format=%(refname)%09%(objectname)%09%(creatordate:iso-strict)', 'refs/tags/lost-commit'])
const rows = refOut
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [ref, obj, date] = line.split('\t')
    return { ref, obj, date: date || '' }
  })
if (!rows.length) {
  console.log('✅ lost-commit tag 0 枚，无需处置')
  console.log('SWEEP-RESULT state=clean stale=0 dropped=0 kept=0')
  process.exit(0)
}

const reach = []
const unreach = []
for (const r of rows) {
  const peeled = gitTry(['rev-parse', '--verify', `${r.ref}^{commit}`])
  if (!peeled || !peeled.trim()) continue
  const c = peeled.trim()
  ;(reachable.has(c) || reachable.has(r.obj) ? reach : unreach).push({ ...r, commit: c })
}

const ts = (d) => {
  const t = Date.parse(d)
  return Number.isFinite(t) ? t : 0
}
unreach.sort((a, b) => ts(b.date) - ts(a.date))
const keepByCount = new Set(unreach.slice(0, MAX_KEEP).map((r) => r.ref))
const cutoff = Date.now() - KEEP_DAYS * 86400_000
const keepByAge = new Set(unreach.filter((r) => ts(r.date) >= cutoff).map((r) => r.ref))
const keepUnreach = new Set([...keepByCount, ...keepByAge])

const dropReach = reach.map((r) => r.ref)
const dropUnreach = unreach.filter((r) => !keepUnreach.has(r.ref)).map((r) => r.ref)

console.log(`lost-commit 共 ${rows.length} 枚：可达 ${reach.length}（语义为零，零损失可删）`)
console.log(`不可达 ${unreach.length}（真备份）：保留 ${keepUnreach.size}（最近 ${MAX_KEEP} 枚 ∪ 最近 ${KEEP_DAYS} 天）`)
console.log(`本轮将处置：可达型 ${dropReach.length} + 超量型 ${dropUnreach.length} = ${dropReach.length + dropUnreach.length}`)

if (!APPLY) {
  console.log('（dry-run，未改动；加 --apply 落盘）')
  console.log(
    `SWEEP-RESULT state=preflight stale=${rows.length} dropped=${dropReach.length + dropUnreach.length} kept=${keepUnreach.size}`,
  )
  process.exit(0)
}
if (!dropReach.length && !dropUnreach.length) {
  console.log('✅ 无可处置条目')
  console.log(`SWEEP-RESULT state=clean stale=0 dropped=0 kept=${keepUnreach.size}`)
  process.exit(0)
}

mkdirSync(STATE_DIR, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

let bundled = 0
for (let i = 0; i < dropUnreach.length; i += BUNDLE_CHUNK) {
  const chunk = dropUnreach.slice(i, i + BUNDLE_CHUNK)
  const file = join(STATE_DIR, `${stamp}-unreachable-${String(i / BUNDLE_CHUNK + 1).padStart(3, '0')}.bundle`)
  const args = ['bundle', 'create', file, ...chunk]
  for (const b of ['refs/heads/main', 'refs/remotes/origin/main']) args.push('--not', b)
  if (gitTry(args, { timeout: 1_800_000 }) === null) die(1, `bundle 失败（${chunk.length} 枚）⇒ 整批不删`)
  if (gitTry(['bundle', 'verify', file]) === null) die(1, `bundle 复核失败（${file}）⇒ 整批不删`)
  bundled += chunk.length
}

const dropAll = [...dropReach, ...dropUnreach]
const stdin = dropAll.map((r) => `delete ${r}`).join('\n') + '\n'
if (gitTry(['update-ref', '--stdin'], { input: stdin }) === null) die(1, '删 ref 失败（update-ref --stdin 报错）')

const left = gitOut(['for-each-ref', '--format=%(refname)', 'refs/tags/lost-commit']).split('\n').filter(Boolean).length
writeFileSync(
  join(STATE_DIR, `${stamp}-report.json`),
  JSON.stringify(
    { at: new Date().toISOString(), deletedReachable: dropReach.length, deletedOverflow: dropUnreach.length, bundledUnreachable: bundled, left },
    null,
    2,
  ) + '\n',
)
console.log(`✅ 已删 ${dropAll.length} 枚（可达型 ${dropReach.length} / 超量型 ${dropUnreach.length}，后者 ${bundled} 枚已 bundle 到 ${STATE_DIR}）；剩余 ${left} 枚`)
console.log(
  `SWEEP-RESULT state=pruned stale=${rows.length} dropped=${dropAll.length} kept=${keepUnreach.size} bundled=${bundled}`,
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
