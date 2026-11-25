#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-bloat-guards-alive.mjs — 防膨胀器物"还在不在"的存活守门（2026-11-25 立）。
 *
 * 立因（实测，不是假想）：四层防膨胀机制造好后，被一枚 commit message 只写
 * `docs(wechat-bridge): …` 的提交 `5b96a6e3` 相对其父把
 *   scripts/git-guardian.mjs      删 91 行（正是 pruneTmpScratch 派发腿）
 *   scripts/prune-tmp-scratch.mjs 删 20 增 2（ARCHIVE_ROOT 锚点归一被退回旧值）
 * 整份退回，且**逃过了 pre-push 的旧底稿整份回退哨兵**——因为退回后的内容不是任何
 * 单一祖先的完整 blob（旧版 + 别处改动混合），哨兵按 blob 等值判，认不出来。
 * 后果：判据与处置都"造好又被退回"，体积照旧反弹，而没有任何一格会喊。
 *
 * 本门的判据不是 diff，而是**终态符号存在性**：在被审面上逐个断言"这条机制的关键符号
 * 还在"。它不判"改了多少行"（那会被格式/重构打红），只判"还能不能工作"。
 *
 * 判面（默认 origin/main，不是 HEAD）：
 *   主仓 HEAD 常与远端分叉，且部署环构建的是"ff 之后那一面"；机制只活在远端与工作树。
 *   以 HEAD 为面会在主仓恒红（实测 HEAD 面 17 条里 12 条 FILE-MISSING）⇒ 恒红门，
 *   只能逼人跳过（§12e 恒红门禁令）。故默认 origin/main，可 --against-rev <sha> 覆写。
 *
 * 三态（§0.3）：
 *   ok           所有登记符号都在，且没有未登记的新 prune-*.mjs
 *   missing      有符号/文件缺失（逐条点名）⇒ 机制被退回或删了
 *   undetermined 判面取不到（远端不可达 / rev 不存在）⇒ 不记绿也不冒红
 *
 * 第四维 unaccounted：`scripts/prune-*.mjs` 在判面上存在但没进 GUARDS 清单 ⇒ 报数。
 *   方向是"多要一次登记"，不是"静默少保护一个器物"（§0.10）。
 *
 * 用法：
 *   node scripts/check-bloat-guards-alive.mjs                 # 默认判 origin/main
 *   node scripts/check-bloat-guards-alive.mjs --against-rev <sha>
 *   node scripts/check-bloat-guards-alive.mjs --self-test
 *
 * 退出码：0 ok / 1 missing / 2 undetermined
 * 结论行：BLOAT-GUARDS state=<ok|missing|undetermined> face=<sha11> checked=<n>
 *        missing=<n> unaccounted=<n>
 *
 * 刻意不进提交链：它判的是"线上那一面"的存量状态，不是本次改动（§12e）。
 */
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(HERE, '..')

const argOf = (name) => {
  const i = process.argv.indexOf(name)
  return i > 0 && process.argv[i + 1] ? String(process.argv[i + 1]).trim() : null
}
const SELF_TEST = process.argv.includes('--self-test')
const AGAINST = argOf('--against-rev')

/**
 * 登记清单：每条 = 一个"机制还活着"的最小证据。
 * 只登记**能单独决定该机制是否失效**的符号，不登记随手可改的实现细节
 * （否则每次重构都红，红多了就被跳过）。
 */
export const GUARDS = [
  { path: 'scripts/prune-repo-bloat.mjs', symbol: 'BUNDLE_RETAIN', why: 'bundle 保留份数档（出口器官）' },
  { path: 'scripts/prune-repo-bloat.mjs', symbol: 'pruneBundles', why: 'bundle 老化调用（出口防换地膨胀）' },
  { path: 'scripts/prune-repo-bloat.mjs', symbol: '--cruft', why: '旧历史打包必须走 --cruft（-a 会与它互斥）' },
  { path: 'scripts/prune-lost-commit-tags.mjs', symbol: 'BUNDLE_RETAIN', why: '备份族 bundle 保留份数档' },
  { path: 'scripts/prune-lost-commit-tags.mjs', symbol: 'pruneBundles', why: '备份族 bundle 老化调用' },
  { path: 'scripts/lib/bundle-retain.mjs', symbol: 'export function pruneBundles', why: '老化判据单源（两个器物共用）' },
  { path: 'scripts/check-tmp-bloat.mjs', symbol: 'TOTAL_ALARM_MB', why: 'tmp 总量维阈值（只判单枚时 7.3GB 全判 ok）' },
  { path: 'scripts/check-tmp-bloat.mjs', symbol: 'totalState', why: '结论行总量维（少了 guardian 读不到）' },
  { path: 'scripts/prune-tmp-scratch.mjs', symbol: 'export function planScratch', why: 'tmp 清扫判据本体' },
  { path: 'scripts/prune-tmp-scratch.mjs', symbol: 'ARCHIVE_ROOT', why: '归档锚点归一（否则同批分裂两处）' },
  { path: 'scripts/prune-tmp-scratch.mjs', symbol: 'SCRATCH_FAMILY_RE', why: '一次性记号族（"从 8 月堆到 11 月"那条通道）' },
  { path: 'scripts/isolated-git.mjs', symbol: 'STALE_AGE_MS', why: '一次性索引副本龄档' },
  { path: 'scripts/git-guardian.mjs', symbol: 'export function pruneTmpScratch', why: 'tmp 清扫派发腿（判据与处置之间那一层）' },
  { path: 'scripts/git-guardian.mjs', symbol: 'if (!CHECK_ONLY) pruneTmpScratch()', why: '派发腿真被主循环调用（造好没装车的形状）' },
  { path: 'scripts/git-guardian.mjs', symbol: 'export function pruneRepoBloat', why: '仓体积旧历史撤离派发腿' },
  { path: 'scripts/git-guardian.mjs', symbol: 'if (!CHECK_ONLY) auditTmpBloat()', why: 'tmp 体积哨兵派发腿' },
  { path: 'scripts/sync-lost-commit-tags.mjs', symbol: 'IHUI_TAG_PUSH_MAX_MB', why: '备份族推送体积闸（单枚超限隔离走冷归档）' },
  { path: 'scripts/prune-redundant-lost-tags.mjs', symbol: '--local-only', why: '备份族冗余清理腿（loose 与已打包重复件的唯一处置方）' },
  { path: 'scripts/prune-rotated-nssm-logs.mjs', symbol: 'export function planPrune', why: 'nssm 轮转日志清理判据本体（仓外日志面的唯一老化方）' },
]

/** 纯判据：给 {blobs: Map<path,string|null>, pruneFiles: string[]} 返回三态与点名。零 IO。 */
export function auditGuards({ blobs, pruneFiles = [] } = {}) {
  const missing = []
  for (const g of GUARDS) {
    const blob = blobs instanceof Map ? blobs.get(g.path) : blobs?.[g.path]
    if (blob === null || blob === undefined) {
      missing.push({ ...g, kind: 'FILE-MISSING' })
      continue
    }
    if (!String(blob).includes(g.symbol)) {
      missing.push({ ...g, kind: 'SYMBOL-MISSING' })
    }
  }
  const registered = new Set(GUARDS.map((g) => g.path))
  const unaccounted = (pruneFiles || []).filter((p) => /^scripts\/prune-[^/]+\.mjs$/.test(p) && !registered.has(p))
  const state = missing.length ? 'missing' : 'ok'
  return { state, missing, unaccounted }
}

function git(args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e) {
    if (allowFail) return null
    throw e
  }
}

function resolveFace() {
  if (AGAINST) {
    const full = git(['rev-parse', '--verify', `${AGAINST}^{commit}`], { allowFail: true })
    return full ? full.trim() : null
  }
  // 默认 origin/main：先尝试远端跟踪引用，取不到再 fetch 一次
  let rev = git(['rev-parse', '--verify', 'origin/main^{commit}'], { allowFail: true })
  if (!rev) {
    git(['fetch', 'origin', 'main'], { allowFail: true })
    rev = git(['rev-parse', '--verify', 'origin/main^{commit}'], { allowFail: true })
  }
  return rev ? rev.trim() : null
}

function selfTest() {
  // 同一 path 可能登记多条断言 ⇒ 假 blob 必须按 path 聚合所有 symbol，否则 Map 去重会让
  // 除最后一条外的断言全部落空（自检第一版就是这么全红的）。
  const good = new Map()
  for (const g of GUARDS) good.set(g.path, `${good.get(g.path) ?? ''}// fake blob containing ${g.symbol}\n`)
  const cases = [
    { name: '全在 ⇒ ok', blobs: good, prune: ['scripts/prune-repo-bloat.mjs', 'scripts/prune-lost-commit-tags.mjs', 'scripts/prune-tmp-scratch.mjs', 'scripts/prune-redundant-lost-tags.mjs', 'scripts/prune-rotated-nssm-logs.mjs'], want: 'ok', missing: 0, unacc: 0 },
    {
      name: '缺文件 ⇒ missing（该 path 3 条断言一起点）',
      blobs: new Map([...good].filter(([k]) => k !== 'scripts/prune-tmp-scratch.mjs')),
      prune: [],
      want: 'missing',
      missing: 3,
      unacc: 0,
    },
    {
      name: '文件在但符号没了 ⇒ missing（退回旧版的形状，该 path 4 条断言）',
      blobs: new Map([...good].map(([k, v]) => [k, k === 'scripts/git-guardian.mjs' ? '// old version without the new leg\n' : v])),
      prune: [],
      want: 'missing',
      missing: 4,
      unacc: 0,
    },
    {
      name: '新增未登记的 prune-*.mjs ⇒ unaccounted 报数（状态仍 ok）',
      blobs: good,
      prune: ['scripts/prune-repo-bloat.mjs', 'scripts/prune-lost-commit-tags.mjs', 'scripts/prune-tmp-scratch.mjs', 'scripts/prune-new-thing.mjs'],
      want: 'ok',
      missing: 0,
      unacc: 1,
    },
  ]
  let failed = 0
  for (const c of cases) {
    const r = auditGuards({ blobs: c.blobs, pruneFiles: c.prune })
    const ok = r.state === c.want && r.missing.length === c.missing && r.unaccounted.length === c.unacc
    process.stdout.write(`${ok ? '✅' : '❌'} self-test:${c.name}${ok ? '' : ` (state=${r.state}/${c.want} missing=${r.missing.length}/${c.missing} unacc=${r.unaccounted.length}/${c.unacc})`}\n`)
    if (!ok) failed += 1
  }
  process.stdout.write(failed === 0 ? 'SELF-TEST state=pass\n' : `SELF-TEST state=fail failed=${failed}\n`)
  return failed === 0 ? 0 : 1
}

function main() {
  if (SELF_TEST) {
    process.exitCode = selfTest()
    return
  }
  const face = resolveFace()
  if (!face) {
    process.stdout.write('BLOAT-GUARDS state=undetermined face=- checked=0 missing=0 unaccounted=0\n')
    process.stdout.write('  原因: 判面取不到（远端不可达或 rev 不存在）⇒ 不记绿也不冒红\n')
    process.exitCode = 2
    return
  }
  const short = face.slice(0, 11)
  const blobs = new Map()
  for (const g of GUARDS) {
    const out = git(['show', `${face}:${g.path}`], { allowFail: true })
    blobs.set(g.path, out === null ? null : out)
  }
  let pruneFiles = []
  try {
    const ls = git(['ls-tree', '-r', '--name-only', face, 'scripts/'])
    pruneFiles = String(ls || '').split(/\r?\n/).filter(Boolean).filter((p) => /^scripts\/prune-[^/]+\.mjs$/.test(p))
  } catch {
    pruneFiles = []
  }
  const res = auditGuards({ blobs, pruneFiles })
  process.stdout.write(`BLOAT-GUARDS state=${res.state} face=${short} checked=${GUARDS.length} missing=${res.missing.length} unaccounted=${res.unaccounted.length}\n`)
  for (const m of res.missing) process.stdout.write(`  ❗ ${m.kind}: ${m.path} ← ${m.symbol}（${m.why}）\n`)
  for (const u of res.unaccounted) process.stdout.write(`  ⚠️ 未登记器物: ${u} ⇒ 请补进本文件 GUARDS（否则它失效时无人喊）\n`)
  if (res.state === 'missing') {
    process.stdout.write('  出路: 若属有意移除 ⇒ 同步摘掉本文件对应条目并写明理由; 若属整份退回 ⇒ 按远端面回植(§0.10 失效方向=多要一次定向说明)\n')
  }
  process.exitCode = res.state === 'ok' ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()

export const __test__ = { auditGuards, GUARDS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
