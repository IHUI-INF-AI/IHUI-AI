#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * prune-repo-bloat.mjs — git 对象库体积护栏（超阈值 ⇒ 定位旧历史孤 ref ⇒ bundle 后清 ⇒ 重打包）
 *
 * 背景（2026-11-25 实测）：仓库重做（11-22 历史压平）后 .git size-pack 仍 1.73 GiB，
 * 而真正可达内容只有 201 MiB。膨胀源全部是「指向重建前旧历史的 ref 把旧对象钉成可达」：
 *   ① refs/remotes/origin/dependabot/* 4 条，各 1.60 GB（重建后没人 prune）
 *   ② refs/tags/desktop-v* 45 枚，各回溯 1,556 MB（45/45 都 merge-base --is-ancestor 失败）
 *   ③ refs/tags/{archive,checkpoint,ihui-backup,wip}/* 6 条，各 1.2~1.4 GB
 * 另有 2 个 pack 带 .keep（`fetch-pack 25040/47660 on 服务器` 的 fetch 中断残留），
 * `git repack` 会永久跳过被 .keep 标记的 pack ⇒ 旧包一直赖着不走。
 *
 * 判据（四层，照 AGENTS §0.3 三态，绝不把「没判」写成「判过」）：
 *   ① size-pack ≤ ALERT_MB（默认 400）⇒ state=clean，只报数，不动手。
 *   ② 超阈值 ⇒ 对每个非主线可达的 ref 判「旧历史 vs 并行活跃线」：
 *      cutoff = 基线(main∪origin/main)最老提交的提交时刻（重建点）
 *      - tip 早于 cutoff ⇒ 旧历史残留（可清）
 *      - tip 不早于 cutoff ⇒ 并行活跃线（**一律不删**，只报数）
 *      这一维必须有：只按 merge-base 判会把 feat/*、ios-nightly 这类重建后的并行线误判成孤 ref
 *      （2026-11-25 干跑实测：8 条并被判孤 ref，实际全是 11-22 之后的活跃线）。
 *   ③ 处置范围（最小面）：
 *      - refs/tags/* 旧历史 ⇒ 先逐卷 bundle + verify，全成功才删（任一卷失败整批不删）
 *      - refs/remotes/* 一律不自动删（远端仍在的下次 fetch 会回来），只报数并提示 `git fetch --prune`
 *      - objects/pack/*.keep 超龄（默认 2h）⇒ 删
 *   ④ 超阈值但无旧历史孤 ref ⇒ state=over-budget，只告警（主线真内容变大，绝不自动删）
 *
 * 用法：
 *   node scripts/prune-repo-bloat.mjs                    # dry-run，只报数
 *   node scripts/prune-repo-bloat.mjs --apply            # 落盘
 *   node scripts/prune-repo-bloat.mjs --apply --alert-mb 300 --keep-stale-hours 2
 *
 * 退出码：0 clean/pruned / 1 bundle 或删 ref 失败 / 2 未判定 / 3 over-budget（需人看）
 */
/* eslint-disable no-console -- CLI 工具 */
import { mkdirSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'node:fs'
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
const ALERT_MB = argOf('--alert-mb', 400)
const KEEP_STALE_HOURS = argOf('--keep-stale-hours', 2)
const BUNDLE_CHUNK = 200
const STATE_DIR = join(ROOT, '.ihui-agent', 'state', 'repo-bloat-prune')

const die = (code, msg) => {
  console.error(`❌ ${msg}`)
  console.log(`SWEEP-RESULT state=${code === 2 ? 'undetermined' : 'refused'} sizeMb=0 orphans=0 dropped=0`)
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

// ── 0. gitdir 与 pack 体积（文件求和，不信 count-objects 的字符串）──
const gitDirOut = gitTry(['rev-parse', '--absolute-git-dir'])
if (!gitDirOut || !gitDirOut.trim()) die(2, '未判定：取不到 gitdir')
const GIT_DIR = gitDirOut.trim().replace(/\\/g, '/')
const PACK_DIR = join(GIT_DIR, 'objects', 'pack')

const packBytes = () => {
  let sum = 0
  try {
    for (const f of readdirSync(PACK_DIR)) if (f.endsWith('.pack')) sum += statSync(join(PACK_DIR, f)).size
  } catch {
    return -1
  }
  return sum
}
const before = packBytes()
if (before < 0) die(2, '未判定：objects/pack 读不到')
const beforeMb = before / (1024 * 1024)
console.log(`📦 当前 size-pack = ${beforeMb.toFixed(1)} MB（阈值 ${ALERT_MB} MB）`)

if (beforeMb <= ALERT_MB) {
  console.log('✅ 体积在预算内，不动手')
  console.log(`SWEEP-RESULT state=clean sizeMb=${beforeMb.toFixed(1)} orphans=0 dropped=0`)
  process.exit(0)
}

// ── 1. 基线与「重建点」cutoff ──
const bases = []
for (const b of ['refs/heads/main', 'refs/remotes/origin/main']) {
  const sha = gitTry(['rev-parse', '--verify', `${b}^{commit}`])
  if (sha && sha.trim()) bases.push(sha.trim())
}
if (!bases.length) die(2, '未判定：main / origin/main 均解析不出，无法判可达性')

let cutoffMs = Infinity
for (const b of bases) {
  const oldest = gitTry(['log', '--reverse', '--format=%ct', b])
  if (oldest === null) die(2, `未判定：取不到 ${b} 的最老提交时刻`)
  const first = oldest.split('\n').filter(Boolean)[0]
  const t = Number(first) * 1000
  if (Number.isFinite(t) && t < cutoffMs) cutoffMs = t
}
if (!Number.isFinite(cutoffMs)) die(2, '未判定：基线最老提交时刻算不出')
console.log(`🕰  重建点 cutoff = ${new Date(cutoffMs).toISOString()}（早于此的 ref tip 判旧历史）`)

// ── 2. 逐 ref 分类：旧历史 / 并行活跃线 ──
const refOut = gitOut(['for-each-ref', '--format=%(refname)%09%(symref)%09%(committerdate:raw)', 'refs/remotes', 'refs/tags'])
const refs = refOut
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const parts = line.split('\t')
    return { ref: parts[0], symref: parts[1] || '', tsRaw: parts[2] || '' }
  })
  .filter((r) => !r.symref && r.ref !== 'refs/remotes/origin/main')

const legacy = []
const parallel = []
for (const r of refs) {
  // 祖先判定：merge-base 成功 ⇒ 是主线祖先 ⇒ 完全跳过
  const anc = gitTry(['merge-base', '--is-ancestor', r.ref, ...bases])
  if (anc !== null) continue
  const tipMs = Number((r.tsRaw || '').split(' ')[0]) * 1000
  const size = Number((gitTry(['rev-list', '--objects', r.ref, '--disk-usage']) || '0').trim()) || 0
  const row = { ref: r.ref, bytes: size, tipMs }
  if (Number.isFinite(tipMs) && tipMs < cutoffMs) legacy.push(row)
  else parallel.push(row)
}

console.log(`🔍 非主线可达的 ref = ${legacy.length + parallel.length} 条（旧历史 ${legacy.length} / 并行活跃线 ${parallel.length}）`)
for (const o of legacy.sort((a, b) => b.bytes - a.bytes).slice(0, 15)) {
  console.log(`   🗑 旧历史 ${(o.bytes / (1024 * 1024)).toFixed(1).padStart(9)} MB  ${o.ref}`)
}
for (const o of parallel.sort((a, b) => b.bytes - a.bytes).slice(0, 10)) {
  console.log(`   ⏸ 并行线 ${(o.bytes / (1024 * 1024)).toFixed(1).padStart(9)} MB  ${o.ref}（保留）`)
}

const legacyTags = legacy.filter((o) => o.ref.startsWith('refs/tags/')).sort((a, b) => b.bytes - a.bytes)
const legacyRemotes = legacy.filter((o) => o.ref.startsWith('refs/remotes/')).sort((a, b) => b.bytes - a.bytes)
if (legacyRemotes.length) {
  console.log(`ℹ️  ${legacyRemotes.length} 条旧历史远端跟踪副本不自动删（只提示）：远端已删的用 \`git fetch origin --prune\` 清`)
}

// ── 3. .keep 超龄扫描 ──
const staleKeeps = []
const cutoffKeep = Date.now() - KEEP_STALE_HOURS * 3600_000
try {
  for (const f of readdirSync(PACK_DIR)) {
    if (!f.endsWith('.keep')) continue
    const st = statSync(join(PACK_DIR, f))
    if (st.mtimeMs < cutoffKeep) staleKeeps.push({ file: join(PACK_DIR, f), name: f, ageH: (Date.now() - st.mtimeMs) / 3600_000 })
  }
} catch {
  /* 读不到就让后续 repack 自然失败 */
}
console.log(`🔒 超龄 .keep = ${staleKeeps.length} 个（阈值 ${KEEP_STALE_HOURS}h）`)
for (const k of staleKeeps) console.log(`   ${k.ageH.toFixed(1)}h  ${k.name}`)

if (!legacyTags.length && !staleKeeps.length) {
  console.log('⚠️  超预算但无旧历史 tag、无超龄 .keep ⇒ 主线真内容变大，只告警、不自动删（需人裁）')
  console.log(`SWEEP-RESULT state=over-budget sizeMb=${beforeMb.toFixed(1)} orphans=${legacy.length} dropped=0`)
  process.exit(3)
}

console.log(`🧹 计划处置：旧历史 tag ${legacyTags.length} 枚；解 .keep ${staleKeeps.length} 个`)

if (!APPLY) {
  console.log('（dry-run，未改动；加 --apply 落盘）')
  console.log(`SWEEP-RESULT state=preflight sizeMb=${beforeMb.toFixed(1)} orphans=${legacy.length} dropped=0`)
  process.exit(0)
}

// ── 4. 落盘：先 bundle 全部旧历史 tag（任一卷失败整批不删）──
let bundled = 0
if (legacyTags.length) {
  mkdirSync(STATE_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  for (let i = 0; i < legacyTags.length; i += BUNDLE_CHUNK) {
    const chunk = legacyTags.slice(i, i + BUNDLE_CHUNK).map((r) => r.ref)
    const file = join(STATE_DIR, `${stamp}-legacy-tags-${String(i / BUNDLE_CHUNK + 1).padStart(3, '0')}.bundle`)
    const args = ['bundle', 'create', file, ...chunk]
    for (const b of ['refs/heads/main', 'refs/remotes/origin/main']) args.push('--not', b)
    if (gitTry(args, { timeout: 1_800_000 }) === null) die(1, `bundle 失败（${chunk.length} 枚）⇒ 整批不删`)
    if (gitTry(['bundle', 'verify', file]) === null) die(1, `bundle 复核失败（${file}）⇒ 整批不删`)
    bundled += chunk.length
    console.log(`   ✓ bundle ${chunk.length} 枚 → ${file}`)
  }
}

if (legacyTags.length) {
  const stdin = legacyTags.map((r) => `delete ${r.ref}`).join('\n') + '\n'
  if (gitTry(['update-ref', '--stdin'], { input: stdin }) === null) die(1, '删 ref 失败（update-ref --stdin 报错）')
  console.log(`   ✓ 已删 ${legacyTags.length} 枚旧历史 tag`)
}

for (const k of staleKeeps) {
  try {
    unlinkSync(k.file)
    console.log(`   ✓ 已解 .keep ${k.name}`)
  } catch {
    /* 解不掉就让 repack 报错 */
  }
}

// ── 5. 重打包丢不可达（`-a` 与 `--cruft` 互斥，必须只给 --cruft）──
if (gitTry(['reflog', 'expire', '--expire=now', '--all']) === null) die(2, 'reflog expire 失败')
if (gitTry(['repack', '-d', '--cruft', '--cruft-expiration=now'], { timeout: 1_800_000 }) === null) {
  die(1, 'repack 失败（对象未丢，ref 已删；可重跑本器）')
}
if (gitTry(['prune', '--expire=now']) === null) die(2, 'prune 失败')

const after = packBytes()
if (after < 0) die(2, '未判定：重打包后 pack 读不到')
const afterMb = after / (1024 * 1024)
const savedMb = beforeMb - afterMb

mkdirSync(STATE_DIR, { recursive: true })
const stamp2 = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
writeFileSync(
  join(STATE_DIR, `${stamp2}-report.json`),
  JSON.stringify(
    {
      at: new Date().toISOString(),
      beforeMb: Number(beforeMb.toFixed(2)),
      afterMb: Number(afterMb.toFixed(2)),
      savedMb: Number(savedMb.toFixed(2)),
      cutoff: new Date(cutoffMs).toISOString(),
      droppedLegacyTags: legacyTags.map((r) => r.ref),
      reportedLegacyRemotes: legacyRemotes.map((r) => r.ref),
      keptParallel: parallel.map((r) => r.ref),
      bundledTags: bundled,
      staleKeeps: staleKeeps.map((k) => k.name),
    },
    null,
    2,
  ) + '\n',
)

console.log(`✅ 回收 ${savedMb.toFixed(1)} MB：${beforeMb.toFixed(1)} → ${afterMb.toFixed(1)} MB`)
console.log(
  `SWEEP-RESULT state=pruned sizeMb=${afterMb.toFixed(1)} orphans=${legacy.length + parallel.length} dropped=${legacyTags.length} bundled=${bundled}`,
)
if (afterMb > ALERT_MB) {
  console.log(`⚠️  重打包后仍 ${afterMb.toFixed(1)} MB > ${ALERT_MB} MB ⇒ 主线真内容偏大，需人裁`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
