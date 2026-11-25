#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * prune-tmp-scratch.mjs — `.ihui-agent/tmp` 长期累积清扫器（只移不删）。
 *
 * 立因（2026-11-25）：check-tmp-bloat.mjs 只报数不处置。实测 tmp 到 7.3GB 时，其中几百个
 * 一次性探查/截图/测试目录（mp-auto / shot-* / *.pre-merge.bak / index-snapshot-* …）
 * 从 8 月一路堆到 11 月，没有任何一格说「这片该到期了」—— 体积哨兵能喊，但喊完没人动。
 *
 * 两档判据（只看顶层，不递归判定）：
 *   A 超龄档   条目自身 mtime > --age-days（默认 14）⇒ 迁出
 *   B 命名族档 名字命中 SCRATCH_FAMILY_RE 且 mtime > --family-days（默认 3）⇒ 迁出
 *     族成员只收「名字本身就是一次性记号」的形态，绝不用模糊前缀猜。
 *
 * 永不迁（硬护栏，任一命中即跳过并点名原因）：
 *   ① 命中 tmp-bloat-keep 台账（精确 rel 或 `/` 结尾前缀）—— 判据复用 check-tmp-bloat 的
 *      parseKeepLedger，不另写一份（§0.6 单一真相源）；
 *   ② mtime 在阈值内；③ 顶层条目是符号链接（不跟链，避免迁走链接后目标变孤儿）。
 *
 * 落地：迁到 --archive-dir（默认 <仓库根>/../ihui-scratch-archive/<YYYYMMDD>-<档>/）。
 * 同盘 Move 是 rename（秒级其次），跨盘由 Move 内部 copy+del。每批写 MANIFEST.txt
 * （name|type|mb|mtime|why）—— 迁出物可凭清单原样搬回，不销毁任何内容。
 *
 * 纪律（0.3 / 0.10）：
 *   - tmp 或归档目录读不到 ⇒ state=undetermined、exit 2、一项不动；
 *   - dry-run 是默认，只有 --apply 才真迁；
 *   - 单项迁移失败逐条点名并计入 failed（绝不把失败算进 moved）；
 *   - 单批上限 --batch（默认 400），超出的留到下一轮，不在一次里搬空整片。
 *
 * 用法：
 *   node scripts/prune-tmp-scratch.mjs                    # dry-run，只报
 *   node scripts/prune-tmp-scratch.mjs --apply            # 落盘（迁移到仓外归档）
 *   node scripts/prune-tmp-scratch.mjs --age-days 30 --family-days 7
 *   node scripts/prune-tmp-scratch.mjs --self-test        # 判据自检（不碰磁盘）
 *
 * 退出码：0 clean/pruned / 1 planned(dry-run 有候选) / 2 未判定
 *
 * 结论行（机读唯一口径）：
 *   SCRATCH-PRUNE state=<clean|planned|pruned|undetermined> ageDays=<n> familyDays=<n>
 *   candidates=<n> moved=<n> mb=<x> failed=<n> archive=<path>
 */
import { existsSync, mkdirSync, readdirSync, renameSync, statSync, writeFileSync, copyFileSync, unlinkSync, rmdirSync, readFileSync } from 'node:fs'
import { join, resolve, basename } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseKeepLedger } from './check-tmp-bloat.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(HERE, '..')
const TMP_DIR = join(ROOT, '.ihui-agent', 'tmp')
const DEFAULT_ARCHIVE_ROOT = join(ROOT, '..', 'ihui-scratch-archive')
const KEEP_LEDGER = join(ROOT, 'scripts', 'data', 'tmp-bloat-keep.json')

const argOf = (name, dflt) => {
  const i = process.argv.indexOf(name)
  if (i <= 0) return dflt
  const raw = Number(process.argv[i + 1])
  return Number.isFinite(raw) && raw > 0 ? raw : dflt
}
const APPLY = process.argv.includes('--apply')
const SELF_TEST = process.argv.includes('--self-test')
const AGE_DAYS = argOf('--age-days', 14)
const FAMILY_DAYS = argOf('--family-days', 3)
const BATCH = argOf('--batch', 400)

/** 一次性记号族：只收名字本身就是「临时/备份/快照」的形态。 */
export const SCRATCH_FAMILY_RE = [
  /\.pre-merge\.bak$/i,
  /^fsck-[^\\/]*\.log$/i,
  /^bak-err\d*$/i,
  /^shot-[a-z]\d*$/i,
  /^chrome-shot(-[a-z0-9]+)?$/i,
  /^index-snapshot-\d+$/i,
]

export function isScratchFamily(name) {
  return SCRATCH_FAMILY_RE.some((re) => re.test(String(name || '')))
}

/**
 * 纯判据：把顶层条目分到「迁出 / 保留（带原因）/ 太新」三栏。零 IO，供自检 import。
 * entries: [{ name, mtimeMs, isSymlink, isDir, bytes }]
 */
export function planScratch(entries, { now = Date.now(), ageDays = 14, familyDays = 3, keepEntries = [] } = {}) {
  const ageMs = ageDays * 86400000
  const famMs = familyDays * 86400000
  const toMove = []
  const held = []
  const tooYoung = []
  for (const e of entries || []) {
    const ageMsOf = Math.max(0, now - Number(e.mtimeMs || 0))
    // 台账保护必须认两层：① 台账 rel 就是这条顶层条目；② 台账 rel 指向这条顶层目录**里面**
    // 的某件（形如 `recon/qoder-graph.json`）—— 后者若只按 name 比，整个 recon/ 会被迁走，
    // 连已登记的证据一起丢（自检第 4/5 例就是抓这个）。
    const keepHit = (keepEntries || []).find((k) => {
      const rel = String(k.rel || '')
      if (!rel) return false
      if (k.prefix) {
        const base = rel.replace(/\/+$/, '')
        return String(e.name) === base || String(e.name).startsWith(rel)
      }
      return String(e.name) === rel || rel.startsWith(`${e.name}/`)
    })
    if (keepHit) {
      held.push({ ...e, why: `keep 台账命中（${keepHit.rel}）` })
      continue
    }
    if (e.isSymlink) {
      held.push({ ...e, why: '符号链接，不跟链' })
      continue
    }
    const ageD = ageMsOf / 86400000
    if (ageMsOf > ageMs) {
      toMove.push({ ...e, ageDays: ageD, why: `超龄 ${ageD.toFixed(1)}d > ${ageDays}d` })
      continue
    }
    if (isScratchFamily(e.name) && ageMsOf > famMs) {
      toMove.push({ ...e, ageDays: ageD, why: `命名族 + mtime ${ageD.toFixed(1)}d > ${familyDays}d` })
      continue
    }
    tooYoung.push(e)
  }
  return { toMove, held, tooYoung }
}

function log(line) {
  process.stdout.write(`${line}\n`)
}

function readKeep() {
  try {
    return parseKeepLedger(readFileSync(KEEP_LEDGER, 'utf8')).entries
  } catch {
    return []
  }
}

function listTop(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    let st
    try {
      st = statSync(full, { bigint: false })
    } catch {
      continue
    }
    let bytes = st.size
    if (st.isDirectory()) {
      // 目录体积只用于报数（迁出决策按目录自身 mtime），递归统计失败即记 0，不影响判定
      try {
        bytes = dirBytes(full)
      } catch {
        bytes = 0
      }
    }
    out.push({ name, full, mtimeMs: st.mtimeMs, isSymlink: st.isSymbolicLink(), isDir: st.isDirectory(), bytes })
  }
  return out
}

function dirBytes(dir) {
  let sum = 0
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const child = join(dir, ent.name)
    if (ent.isSymbolicLink()) continue
    if (ent.isDirectory()) {
      try {
        sum += dirBytes(child)
      } catch {
        /* 读不到的子目录不计体积（方向是少报多留） */
      }
    } else if (ent.isFile()) {
      try {
        sum += statSync(child).size
      } catch {
        /* 同上 */
      }
    }
  }
  return sum
}

/** 同盘 rename；跨盘（EXDEV）退回 copy+del；目录跨盘由 copyFileSync 逐文件搬。 */
function moveEntry(src, dst) {
  try {
    renameSync(src, dst)
    return { method: 'rename' }
  } catch (e) {
    if (e?.code !== 'EXDEV') throw e
  }
  if (statSync(src).isDirectory()) {
    copyDirRec(src, dst)
    rmDirRec(src)
    return { method: 'copy+del' }
  }
  copyFileSync(src, dst)
  unlinkSync(src)
  return { method: 'copy+del' }
}

function copyDirRec(src, dst) {
  mkdirSync(dst, { recursive: true })
  for (const ent of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, ent.name)
    const d = join(dst, ent.name)
    if (ent.isSymbolicLink()) continue
    if (ent.isDirectory()) copyDirRec(s, d)
    else if (ent.isFile()) copyFileSync(s, d)
  }
}

function rmDirRec(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name)
    if (ent.isDirectory() && !ent.isSymbolicLink()) rmDirRec(p)
    else unlinkSync(p)
  }
  rmdirSync(dir)
}

function selfTest() {
  const MB = 1024 * 1024
  const now = Date.parse('2026-11-25T00:00:00Z')
  const D = (n) => now - n * 86400000
  const cases = [
    {
      name: '超龄 20 天 ⇒ 迁',
      entries: [{ name: 'old-thing', mtimeMs: D(20), isDir: true, bytes: 10 * MB }],
      opt: { now, ageDays: 14, familyDays: 3 },
      want: { move: 1, held: 0 },
    },
    {
      name: '命名族 + 4 天 ⇒ 迁（超龄档未到）',
      entries: [{ name: 'README.md.2026-11-07.pre-merge.bak', mtimeMs: D(4), bytes: MB }],
      opt: { now, ageDays: 14, familyDays: 3 },
      want: { move: 1, held: 0 },
    },
    {
      name: '命名族但只 1 天 ⇒ 不迁（族档也没到）',
      entries: [{ name: 'shot-a1', mtimeMs: D(1), isDir: true, bytes: MB }],
      opt: { now, ageDays: 14, familyDays: 3 },
      want: { move: 0, held: 0 },
    },
    {
      name: '台账命中 ⇒ 永迁不动（即使超龄 40 天）',
      entries: [{ name: 'recon', mtimeMs: D(40), isDir: true, bytes: 160 * MB }],
      opt: { now, ageDays: 14, familyDays: 3, keepEntries: [{ rel: 'recon/qoder-graph.json', prefix: false, reason: 'x', reviewBy: '2099-01-01' }] },
      want: { move: 0, held: 1 },
    },
    {
      name: '台账前缀命中整个目录族 ⇒ 不迁',
      entries: [{ name: 'ios-ipa-relay', mtimeMs: D(30), isDir: true, bytes: 30 * MB }],
      opt: { now, ageDays: 14, familyDays: 3, keepEntries: [{ rel: 'ios-ipa-relay/', prefix: true, reason: 'x', reviewBy: '2099-01-01' }] },
      want: { move: 0, held: 1 },
    },
    {
      name: '符号链接 ⇒ 不迁（不跟链）',
      entries: [{ name: 'link', mtimeMs: D(30), isSymlink: true, bytes: 0 }],
      opt: { now, ageDays: 14, familyDays: 3 },
      want: { move: 0, held: 1 },
    },
    {
      name: '普通目录 2 天且非族 ⇒ 不动',
      entries: [{ name: 'mp-auto', mtimeMs: D(2), isDir: true, bytes: 16 * MB }],
      opt: { now, ageDays: 14, familyDays: 3 },
      want: { move: 0, held: 0 },
    },
  ]
  let failed = 0
  for (const c of cases) {
    const r = planScratch(c.entries, c.opt)
    const ok = r.toMove.length === c.want.move && r.held.length === c.want.held
    log(`${ok ? '✅' : '❌'} self-test:${c.name}${ok ? '' : ` (move=${r.toMove.length} want=${c.want.move}, held=${r.held.length} want=${c.want.held})`}`)
    if (!ok) failed += 1
  }
  log(failed === 0 ? 'SELF-TEST state=pass' : `SELF-TEST state=fail failed=${failed}`)
  return failed === 0 ? 0 : 1
}

async function main() {
  if (SELF_TEST) {
    process.exitCode = selfTest()
    return
  }
  if (!existsSync(TMP_DIR)) {
    log(`SCRATCH-PRUNE state=undetermined ageDays=${AGE_DAYS} familyDays=${FAMILY_DAYS} candidates=0 moved=0 mb=0.00 failed=0 archive=-`)
    log(`  原因: ${TMP_DIR} 不存在 —— 不记绿也不冒红`)
    process.exitCode = 2
    return
  }
  let entries
  try {
    entries = listTop(TMP_DIR)
  } catch (e) {
    log(`SCRATCH-PRUNE state=undetermined ageDays=${AGE_DAYS} familyDays=${FAMILY_DAYS} candidates=0 moved=0 mb=0.00 failed=0 archive=-`)
    log(`  原因: 顶层枚举失败（${e?.code ?? e?.message}）`)
    process.exitCode = 2
    return
  }
  const keepEntries = readKeep()
  const plan = planScratch(entries, { ageDays: AGE_DAYS, familyDays: FAMILY_DAYS, keepEntries })
  const cand = plan.toMove.slice().sort((a, b) => b.bytes - a.bytes)
  const batch = cand.slice(0, BATCH)
  const candMb = cand.reduce((s, x) => s + (Number(x.bytes) || 0), 0) / (1024 * 1024)

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const archiveDir = join(DEFAULT_ARCHIVE_ROOT, `${stamp}-scratch`)

  if (!APPLY) {
    log(`SCRATCH-PRUNE state=${batch.length ? 'planned' : 'clean'} ageDays=${AGE_DAYS} familyDays=${FAMILY_DAYS} candidates=${batch.length} moved=0 mb=${candMb.toFixed(2)} failed=0 archive=${archiveDir}`)
    for (const x of batch.slice(0, 12)) log(`   ⇒ ${x.name}  ${(x.bytes / 1048576).toFixed(1)}MB  ${x.why}`)
    if (batch.length > 12) log(`   … 另有 ${batch.length - 12} 项`)
    for (const h of plan.held.slice(0, 6)) log(`   🔒 保留 ${h.name}: ${h.why}`)
    log(`（dry-run，未改动；加 --apply 落盘）`)
    process.exitCode = batch.length ? 1 : 0
    return
  }

  if (!batch.length) {
    log(`SCRATCH-PRUNE state=clean ageDays=${AGE_DAYS} familyDays=${FAMILY_DAYS} candidates=0 moved=0 mb=0.00 failed=0 archive=${archiveDir}`)
    process.exitCode = 0
    return
  }

  try {
    mkdirSync(archiveDir, { recursive: true })
  } catch (e) {
    log(`SCRATCH-PRUNE state=undetermined ageDays=${AGE_DAYS} familyDays=${FAMILY_DAYS} candidates=${batch.length} moved=0 mb=0.00 failed=0 archive=${archiveDir}`)
    log(`  原因: 归档目录建不出来（${e?.code ?? e?.message}）⇒ 一项不动`)
    process.exitCode = 2
    return
  }

  const manifest = []
  const failedRows = []
  let moved = 0
  let movedBytes = 0
  for (const x of batch) {
    try {
      const r = moveEntry(x.full, join(archiveDir, basename(x.full)))
      moved += 1
      movedBytes += Number(x.bytes) || 0
      manifest.push(`${x.name}|${x.isDir ? 'dir' : 'file'}|${(x.bytes / 1048576).toFixed(2)}|${new Date(x.mtimeMs).toISOString()}|${x.why}|${r.method}`)
    } catch (e) {
      failedRows.push(`${x.name}|${e?.code ?? e?.message}`)
    }
  }
  if (manifest.length) {
    writeFileSync(join(archiveDir, 'MANIFEST.txt'), manifest.join('\n') + '\n', 'utf8')
  }
  if (failedRows.length) {
    writeFileSync(join(archiveDir, 'FAILED.txt'), failedRows.join('\n') + '\n', 'utf8')
  }
  log(`SCRATCH-PRUNE state=${failedRows.length ? 'undetermined' : 'pruned'} ageDays=${AGE_DAYS} familyDays=${FAMILY_DAYS} candidates=${batch.length} moved=${moved} mb=${(movedBytes / 1048576).toFixed(2)} failed=${failedRows.length} archive=${archiveDir}`)
  for (const f of failedRows) log(`  ❗ 迁移失败: ${f}`)
  process.exitCode = failedRows.length ? 2 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(2)
  })
}

export const __test__ = { planScratch, isScratchFamily, SCRATCH_FAMILY_RE, TMP_DIR }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
