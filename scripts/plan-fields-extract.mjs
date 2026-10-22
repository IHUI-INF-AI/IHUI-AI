// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 侧车抽取器(规格 §4 第 1 步,2026-10-22 立):把台账散文里的"归谁 / 在等什么"搬进
 * `scripts/data/plan-fields.jsonl`,**一个行文本都不改**。
 *
 * 为什么"只搬说辞、不改行"是这一步的唯一形态:台账行是活文档,近 10 把尺子按**整行逐字节**
 * 比份数(union-converge / merge-live-doc / 门 71 / 门 13d / 三维守恒器物…)。改一个字就会
 * 被别的席位的工作树副本按未改还原,或把判定面悄悄挪位。所以 P1 第一段只做"加法":
 * 侧车先长出来,派单读数必须一枚都不动 —— 这条由 `batchBucketDrift` 当场拦住,不靠人自觉。
 *
 * 三条硬规矩(失效方向一律是"少搬",绝不是"多放"):
 *  1. 抽不出可搬的值 ⇒ 不造记录,该行继续由散文判(派单面会报名"仍靠散文判定 N 枚")。
 *     绝不给"可做"的行造 `waiting:none` 记录:那等于把兜底值伪装成有交代(§0.3)。
 *  2. 抽取前后每行的桶必须**零变化**。桶是判定输入;换个地方说不等于可以说错。
 *     任一漂移 ⇒ 整批 `state=refused` 不落,并逐条点名两侧读数。
 *  3. 词表只 import 不复制(`ownedElsewhereRe`)。造第二把尺子的下场本仓记过最多次:两把尺
 *     各自读出不同命中集,搬动那一步静默改掉派单判定,而守恒断言比的是桶、看不见词表漂。
 *
 * 取材面纪律(§0.4):台账与侧车**同面同轮** —— 一律经 `plan-tasks` 的 `auditFace` /
 * `readFieldsFace`,全量档读 HEAD blob、`--staged` 读索引 blob、`--worktree` 只作人工逃生舱。
 *
 * 用法:`node scripts/plan-fields-extract.mjs --check | --dry-run | --apply [--staged|--worktree]`
 * 结论行:`EXTRACT-RESULT state=ready|changed|refused|undetermined changed=N bucketsDrift=M`
 * 退出码:0 = 无待搬 / 1 = 有待搬且本档只报数 / 2 = 未判定或被拒。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { auditFace, readFieldsFace } from './plan-tasks.mjs'
import { FIELDS_REL, normalizeRecord } from './lib/plan-fields.mjs'
import {
  compositeKeyOf,
  dispositionFace,
  dispositionOf,
  dispositionOfV2,
  ownedElsewhereRe,
} from './lib/plan-task-index.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
/** 只取 `归属:` 后面的**值**;词表(整族判据)在 `plan-task-index`,这里不复制。 */
const OWNER_VALUE_RE = /归属[:：]\s*([^,，。;；)）\n]{1,80})/
const MAX_OWNER = 48
const UPDATED_BY = 'plan-fields-extract'

/**
 * 一行 → 一条忠实记录,或 `null`(搬不动)。
 *
 * `waiting` 一律由**散文桶**推得,而不是再判一遍词 —— 这一步的产物必须与它替代的说法同判,
 * 否则"搬"就变成了"改判"。owner 只取 `归属:` 后面的值,且取自遮掉反引号后的面:命中若只存在于
 * 反引号里,那是**转述别人的理由**(G-1058610 病②那一型),不是本行的归属表态。
 */
export function extractFromLine(line, nowIso = new Date().toISOString()) {
  const key = compositeKeyOf(line)
  if (!key) return null
  const bucket = dispositionOf(line)
  if (bucket === 'actionable') return null
  const rec = { key, waiting: 'none', updatedAt: nowIso, updatedBy: UPDATED_BY }
  if (bucket === 'owned-elsewhere') {
    const face = dispositionFace(line)
    if (!ownedElsewhereRe().test(face)) return null
    const m = OWNER_VALUE_RE.exec(face)
    if (!m) return null
    const owner = String(m[1]).trim().slice(0, MAX_OWNER)
    if (owner === '') return null
    rec.owner = owner
  } else if (bucket === 'waiting-human') {
    rec.waiting = 'human'
  } else {
    rec.waiting = 'env'
  }
  return rec
}

/**
 * 逐行比对「散文判的桶」与「侧车判的桶」,返回漂移点名清单。
 * 空侧车 ⇒ 空清单(v2 回落散文),所以这一档同时也是"侧车还没建"的守恒基线。
 */
export function batchBucketDrift(lines, map) {
  const fields = { map, undetermined: false }
  const out = []
  for (const line of lines) {
    const before = dispositionOf(line)
    const after = dispositionOfV2({ line, fields })
    if (after.bucket !== before) {
      out.push(
        `${compositeKeyOf(line) ?? '(无主键)'} 散文=${before} ⇄ 侧车=${after.bucket}(来源=${after.source})`,
      )
    }
  }
  return out
}

const recordsFile = (root) => path.join(root, FIELDS_REL)

function existingLines(root) {
  const abs = recordsFile(root)
  if (!existsSync(abs)) return []
  return readFileSync(abs, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
}

/**
 * 追加记录(侧车**只增不删**):同一条逐字已在位 ⇒ 跳过(幂等,重跑不造重复行 —— 重复行会被
 * `loadFields` 读成 orphans,把"谁改的"查不出来);同键不同值 ⇒ 追加,最新者胜由 `loadFields`
 * 判,本器绝不就地改历史行。写盘走"临时件 + rename",被拒的批次一个字节都不留在目标文件上。
 */
export function writeRecords(root, recs) {
  const abs = recordsFile(root)
  const before = existingLines(root)
  const have = new Set(before)
  const toAppend = []
  let dupSkipped = 0
  let rejected = 0
  for (const raw of recs) {
    const n = normalizeRecord(raw)
    if (!n.ok) {
      rejected++
      continue
    }
    const line = JSON.stringify(n.rec)
    if (have.has(line)) {
      dupSkipped++
      continue
    }
    have.add(line)
    toAppend.push(line)
  }
  if (toAppend.length === 0) return { appended: 0, dupSkipped, rejected, path: abs }
  mkdirSync(path.dirname(abs), { recursive: true })
  const tmp = `${abs}.tmp-${process.pid}`
  writeFileSync(tmp, [...before, ...toAppend].join('\n') + '\n', 'utf8')
  try {
    renameSync(tmp, abs)
  } catch (e) {
    throw new Error(
      `侧车写盘失败(${String(e?.code ?? e)}),目标文件保持原样:${abs} —— 临时件留在 ${path.basename(tmp)}`,
    )
  }
  return { appended: toAppend.length, dupSkipped, rejected, path: abs }
}

/** 回读记录条数(物理行数,不是去重后的键数 —— 同键多份正是要能看见的形态)。 */
export function readBackCount(root) {
  return existingLines(root).length
}

/** 一次算完:面 → 候选 → 合并侧车 → 漂移。check / dry-run / apply 三处共用同一份,不许两套口径。 */
export function plan({ root = ROOT, face = 'head' } = {}) {
  const a = auditFace(root, face)
  const lines = a.claimableRows.map((r) => r.raw)
  const side = readFieldsFace(root, face)
  if (side.undetermined)
    return { undetermined: true, why: side.why, lines, candidates: [], drift: [] }
  const candidates = []
  for (const line of lines) {
    const rec = extractFromLine(line)
    if (rec) candidates.push(rec)
  }
  const merged = new Map(side.map)
  for (const rec of candidates) merged.set(rec.key, rec)
  return {
    undetermined: false,
    lines,
    candidates,
    drift: batchBucketDrift(lines, merged),
    existingCount: readBackCount(root),
  }
}

function printVerdict(p, { listLimit = 0 }) {
  if (p.undetermined) {
    console.log(`⚠️ 未判定 —— 侧车面取不到:${p.why}`)
    console.log('EXTRACT-RESULT state=undetermined changed=0 bucketsDrift=0')
    return 2
  }
  console.log(
    `派单面 ${p.lines.length} 行 ⇒ 可搬进侧车 ${p.candidates.length} 行 / 搬不动(继续靠散文)` +
      `${p.lines.length - p.candidates.length} 行;侧车现有 ${p.existingCount} 条记录`,
  )
  if (listLimit > 0)
    for (const r of p.candidates.slice(0, listLimit))
      console.log(`   候选 ${r.key}  waiting=${r.waiting}${r.owner ? ` owner=${r.owner}` : ''}`)
  if (listLimit > 0 && p.candidates.length > listLimit)
    console.log(`   …另 ${p.candidates.length - listLimit} 条候选未逐条打印`)
  if (p.drift.length > 0) {
    console.log(
      `❌ 整批不落 —— 抽取后 ${p.drift.length} 行的归属桶发生变化(桶是判定输入,换个地方说不等于可以说错):`,
    )
    for (const d of p.drift.slice(0, 20)) console.log(`   · ${d}`)
    if (p.drift.length > 20) console.log(`   …另 ${p.drift.length - 20} 条同型,未逐条打印`)
    console.log(`EXTRACT-RESULT state=refused changed=0 bucketsDrift=${p.drift.length}`)
    return 2
  }
  console.log('守恒:抽取前后每一行的归属桶零变化(逐行比 dispositionOf ↔ dispositionOfV2)')
  const state = p.candidates.length > 0 ? 'changed' : 'ready'
  console.log(`EXTRACT-RESULT state=${state} changed=${p.candidates.length} bucketsDrift=0`)
  return p.candidates.length > 0 ? 1 : 0
}

function selfTest() {
  const checks = []
  const ok = (name, cond) => checks.push([name, !!cond])
  const owned = '- [ ] G-1 甲 —— 归属:门 130 持有人,细节'
  const r = extractFromLine(owned)
  ok('S1 归属行抽出 owner', r && r.owner === '门 130 持有人')
  ok('S2 owner 优先于 waiting(与词表同序,搬动不改判)', r && r.waiting === 'none')
  ok('S3 可做的行不造记录', extractFromLine('- [ ] G-2 乙 可做') === null)
  ok('S4 命中词族但无可搬归属值 ⇒ 宁缺', extractFromLine('- [ ] G-3 丙 不代做') === null)
  ok(
    'S5 忠实记录零漂移',
    batchBucketDrift([owned, '- [ ] G-2 乙 可做'], new Map([[r.key, r]])).length === 0,
  )
  const bad = { key: r.key, waiting: 'none', updatedAt: '2026-10-22T00:00:00.000Z' }
  const d = batchBucketDrift([owned], new Map([[bad.key, bad]]))
  ok(
    'S6 造错的记录被点名(两侧读数都摆出来)',
    d.length === 1 && /owned-elsewhere/.test(d[0]) && /actionable/.test(d[0]),
  )
  ok('S7 空侧车不可能有漂移', batchBucketDrift([owned], new Map()).length === 0)
  let fails = 0
  for (const [name, pass] of checks) {
    if (!pass) fails++
    console.log(`${pass ? '✅' : '❌'} ${name}`)
  }
  console.log(`\n自检:${checks.length - fails} 通过 / ${fails} 失败`)
  return fails === 0 ? 0 : 1
}

function main() {
  const argv = process.argv.slice(2)
  const has = (f) => argv.includes(f)
  if (has('--self-test')) return selfTest()
  const modes = ['--check', '--dry-run', '--apply'].filter(has)
  if (modes.length !== 1) {
    console.log(
      '❌ 用法 —— 必须且只能给一个模式:--check(只读)/ --dry-run(只读并逐条点名)/ --apply(写盘)',
    )
    console.log(
      '   不给"默认模式"是刻意的:一件会被误当只读跑的器物如果默认写盘,一次笔误就把侧车刷成垃圾堆。',
    )
    return 2
  }
  if (has('--staged') && has('--worktree')) {
    console.log('❌ 用法错 —— --staged 与 --worktree 不得同用(两个判定面互斥,§0.4)')
    return 2
  }
  const face = has('--staged') ? 'staged' : has('--worktree') ? 'worktree' : 'head'
  let p
  try {
    p = plan({ root: ROOT, face })
  } catch (e) {
    console.log(`⚠️ 未判定 —— 取材失败:${String(e?.message ?? e).split('\n')[0]}`)
    console.log('EXTRACT-RESULT state=undetermined changed=0 bucketsDrift=0')
    return 2
  }
  const code = printVerdict(p, { listLimit: modes[0] === '--check' ? 0 : 40 })
  if (modes[0] !== '--apply') {
    if (modes[0] === '--dry-run') console.log('   (dry-run:零写盘 —— 侧车文件一个字节都不动)')
    return code
  }
  if (code !== 1) {
    if (code === 0) console.log('   本轮零条可搬:侧车无需写入。')
    return code
  }
  const written = writeRecords(ROOT, p.candidates)
  console.log(
    `已追加 ${written.appended} 条记录(逐字已在位而跳过 ${written.dupSkipped} 条 / 记录不合法被拒 ${written.rejected} 条)→ ${path.relative(ROOT, written.path)}`,
  )
  console.log(`回读条数:${readBackCount(ROOT)}`)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = { extractFromLine, batchBucketDrift, writeRecords, readBackCount, plan }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
