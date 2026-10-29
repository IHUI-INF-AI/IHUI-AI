#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 逐字回潮对账(2026-10-29 立;只读尺子,**刻意不进提交链** §12e)
 *
 * 拦的是这一型:**一枚单父提交把"其父可达范围内被非合并提交显式删掉的路径"重新放回结果树,而且此刻
 * 还活在面上。** 立因是当天现读的一起已入库事实,不是假想:
 *  - `1fe3a2b42d`(对象空间嫁接,父 = 当时的 origin/main)把 9 枚路径带回主线,其中
 *    `.github/workflows/mirror-to-cn.yml` 的 blob `21c73f85` 与 `2f9def0ddd` 删除前的那份
 *    **逐字节相同**;该机主弃用令在 `d10db9132d`(10-23)与 `2f9def0ddd`(10-26)已执行两次,
 *    这是第三次回潮(前一次通道是 `20bb9349d9` 收编滞后工作树)。
 *  - 当天全链**没有任何一道门为此响过**,原因是三处射程各自缺一格:
 *    ① 守门 168 的 `auditMerge()` 对 `parents.length < 2` 当场返回"取不到两个父(grafted/shallow?)
 *      ⇒ 未判定"——单父嫁接正落在它自己的未判定档里,而它的 DR1/DR2 两条取证都以"两个父"为前提;
 *    ② 旁路落地走 commit-tree ⇒ **结构上不跑任何钩子**(本仓 §5c/§12 反复登记这一族),
 *      提交链上的门对该枚从未执行;
 *    ③ 守门 238 判的是"镜像 purge 的**文档面**",射程 10 个文档,不含 `.github/workflows/` 本体。
 *    复核实测:`node scripts/check-merge-deletion-resurrection.mjs` 在同一面上 RC=0。
 *
 * 所以本器只补那一格**承载面**:按「新增路径 ⊕ 删除出处」判,不问它有几父、不问它走没走钩子。
 * 判据一律 import,不在本文件复算(§0.6/§22c):
 *  - `deleteCommitOf`(168)——"是哪个非合并提交删掉了它"的唯一实现;
 *  - `membership`(168)——树成员性经 `catBatchOids` 批量问,严格三态(undefined/null 都算问不到);
 *  - `hasIntentionalMarker` / `parseAllowlist` / `entryDefect` / `ALLOWLIST_FILE`(lib/deletion-intent)
 *    ——豁免的两条例出口与形状判定,与 168 同一把尺子,本器不另开第三条例出口。
 *
 * 「本侧」取被审 ref 自身的可达范围(单父提交没有 ours/theirs 之分,而那正是它逃过 168 的原因)。
 * 因此本器不判"哪一侧的删除",只判"这条路径被裁决过没有"——豁免通道与 168 完全同形:
 * 删除提交带裁决短语,或路径在豁免台账里且字段齐、未过期。
 *
 * 为什么要 live 过滤(只判"此刻还在面上"):不折这一维,历史事故就永久挂红。本枚带回的 9 条已在
 * `1250480412b` 显式摘掉——按"曾经回潮"判,这道门从那天起对每一枚无关提交都红,唯一结局是逼人
 * `--no-verify` 并连带废掉全部守门(§12e/§12f)。失效方向恒为"少报",不是"多拦"。
 *
 * 三态与退出码(§0.3:「没判」绝不写成「判过」):
 *   0 = 判过且零命中(计数照常报出);
 *   1 = 命中 ≥1 条活回潮;
 *   2 = 未判定 —— ref 问不到 / 树成员性问不到 / 单条删除出处查询失败 / 候选超出取证上限的余额 / 台账坏。
 * 未认识的旗标一律**用法错 exit 2**(本仓登记过"对自称只读的档发未知旗会真跑主流程"那一型)。
 *
 * 用法:
 *   node scripts/check-verbatim-resurrection.mjs                        # 审 HEAD,窗口 200
 *   node scripts/check-verbatim-resurrection.mjs --ref origin/main --window 400
 *   node scripts/check-verbatim-resurrection.mjs --json                 # 机读(形状由镜像测试钉住)
 *   node scripts/check-verbatim-resurrection.mjs --self-test            # 判据自检(正反例成对)
 *   node scripts/check-verbatim-resurrection.mjs --root <dir>           # 测试/换仓通道(夹具唯一进入口)
 * 修复出口(每条命中就地打印,不用另查):走本仓唯一删除档 `object-space-land.mjs` 的
 *   LAND_REMOVE_PATHS,或在 deletion-survival-allowlist.json 逐条登记 path+reason+reviewBy。
 *
 * 调度器:本器不在提交链注册表里;唯一常驻班次 = `scripts/git-guardian.mjs` 的巡检腿
 * `auditVerbatimResurrection()`(节流现值见该函数;命中经 `notifyGuardRed()` 走 §5e 邮件单通道,
 * 未判定只写日志不喊人)。头注刻意不写"已接 pre-commit / CI / 第 N 项"——那种声称会被守门 89 判红。
 */

import * as fsMod from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { ALLOWLIST_FILE, entryDefect, hasIntentionalMarker, parseAllowlist } from './lib/deletion-intent.mjs'
import { gitRaw } from './lib/face-reader.mjs'
import { deleteCommitOf, membership } from './check-merge-deletion-resurrection.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

/** 一次被审面最多查多少条"删除出处"——超出即未判定并点名余额(照守门 168 的取证上限规矩)。 */
export const LOOKUP_CAP = Number(process.env.IHUI_VERBATIM_LOOKUP_CAP || 400)

function git(args, root) {
  return gitRaw(args, root)
}

/** 被审 ref 的提交清单。取不到或为空 ⇒ null(绝不回落成"没有")。 */
export function commitsIn(ref, window, root) {
  try {
    return String(git(['rev-list', `--max-count=${window}`, ref], root))
      .split(/\r?\n/)
      .filter(Boolean)
  } catch {
    return null
  }
}

/**
 * 本枚相对其**唯一父**新增的路径。
 * 非单父(合并/根提交)⇒ skipped:合并归守门 168 的 DR1/DR2,根提交没有"被带回"可言。
 */
export function addedPathsOf(sha, root) {
  let line
  try {
    line = String(git(['rev-list', '--parents', '-n', '1', sha], root)).trim()
  } catch {
    return { skipped: true, paths: [], why: '本枚的父清单取不到' }
  }
  const parents = line.split(/\s+/).slice(1)
  if (parents.length !== 1) return { skipped: true, paths: [], why: `父数=${parents.length}` }
  try {
    const out = git(['diff-tree', '--no-commit-id', '--name-only', '-r', '--diff-filter=A', sha], root)
    return { skipped: false, parent: parents[0], paths: String(out).split(/\r?\n/).filter(Boolean) }
  } catch {
    return { skipped: true, paths: [], why: '新增清单取不到' }
  }
}

/** blob(P@rev);取不到 ⇒ null。只用于"逐字"这一维的标注,不参与判红。 */
export function blobOf(rev, path, root) {
  try {
    const out = String(git(['rev-parse', `${rev}:${path}`], root)).trim()
    return /^[0-9a-f]{40}$/.test(out) ? out : null
  } catch {
    return null
  }
}

/**
 * 判据本体。出参(镜像测试钉住这些键):
 * { ref, window, unjudged?, reason?, commits, commitsSkippedNotSingleParent, addRows,
 *   candidates, looked, undetermined[], hits[], exempt[], allowEntries }
 */
export function auditVerbatim({
  ref = 'HEAD',
  window = 200,
  root = ROOT,
  today = new Date().toISOString().slice(0, 10),
  lookupCap = LOOKUP_CAP,
} = {}) {
  const commits = commitsIn(ref, window, root)
  if (!commits || commits.length === 0) {
    return {
      ref,
      window,
      unjudged: true,
      reason: `${ref} 的提交清单取不到(或为空)⇒ 未判定`,
      commits: 0,
      commitsSkippedNotSingleParent: 0,
      addRows: 0,
      candidates: 0,
      looked: 0,
      undetermined: [`${ref} 提交清单取不到 ⇒ 未判定`],
      hits: [],
      exempt: [],
      allowEntries: 0,
    }
  }

  // 同一路径只看最新一枚把它加回来的提交(更早那枚是同一条债的旧现场,不重复计)
  const addByPath = new Map()
  let addRows = 0
  let skippedNonSingleParent = 0
  const unjudgeNotes = []
  for (const sha of commits) {
    const a = addedPathsOf(sha, root)
    if (a.skipped) {
      skippedNonSingleParent++
      if (a.why && !/^父数=/.test(a.why) && unjudgeNotes.length < 3) unjudgeNotes.push(`取数漂:${sha.slice(0, 8)} ${a.why}`)
      continue
    }
    for (const p of a.paths) {
      addRows++
      if (!addByPath.has(p)) addByPath.set(p, { sha, parent: a.parent })
    }
  }

  const undetermined = [...unjudgeNotes]

  // live 过滤:此刻不在面上的属历史现场(见头注"为什么要 live 过滤")
  const mem = membership(ref, [...addByPath.keys()], root)
  if (mem.failed) undetermined.push(`${ref} 的树成员性问不到(${addByPath.size} 条候选)⇒ 未判定`)
  if (mem.skipped > 0) undetermined.push(`${mem.skipped} 条路径含换行,无法作为 batch 规格 ⇒ 未判定`)
  const live = [...addByPath.entries()].filter(([p]) => mem.map.get(p) === true)

  // 豁免台账:与被审面同面同轮取,形状尺与 168 同一条实现
  let allowText = null
  try {
    allowText = String(git(['show', `${ref}:${ALLOWLIST_FILE}`], root))
  } catch {
    allowText = null // 该面没这个文件 = absent(按零条目判),不是"坏";与 parseAllowlist 三态对齐
  }
  const parsed = parseAllowlist(allowText)
  if (parsed.broken) undetermined.push(`豁免台账 ${ALLOWLIST_FILE} 在 ${ref} 面形状坏:${parsed.broken} ⇒ 未判定`)
  const allowEntries = parsed.entries
  const allowByPath = new Map(allowEntries.map((e) => [e.path, e]))

  const hits = []
  let looked = 0
  for (const [path, add] of live) {
    if (looked >= lookupCap) break
    looked++
    const del = deleteCommitOf(path, add.parent, root)
    if (del.failed) {
      undetermined.push(`${path} 的删除出处查询失败(git 未答)⇒ 未判定`)
      continue
    }
    if (!del.sha) continue // 找不到删除出处 = 本仓真新文件,不是回潮
    const verbatim = (() => {
      const a = blobOf(add.sha, path, root)
      const b = blobOf(`${del.sha}^`, path, root)
      return Boolean(a && b && a === b)
    })()
    const entry = allowByPath.get(path) ?? null
    if (entry) {
      const defect = entryDefect(entry, today)
      if (defect) hits.push({ path, addedBy: add.sha, deletedBy: del.sha, code: 'allowlist-defect', why: `台账条目有问题(${defect}),不得用它遮复活`, verbatim })
      else hits.push({ path, addedBy: add.sha, deletedBy: del.sha, exempt: true, why: `台账已裁该路径(复核日 ${entry.reviewBy})`, verbatim })
      continue
    }
    if (hasIntentionalMarker(del.body)) {
      hits.push({ path, addedBy: add.sha, deletedBy: del.sha, exempt: true, why: '删除提交带裁决短语 ⇒ 只报数', verbatim })
      continue
    }
    hits.push({
      path,
      addedBy: add.sha,
      deletedBy: del.sha,
      code: 'verbatim-resurrection',
      why: verbatim ? '逐字节等于被删掉的那份(纯回潮,不是重写)' : '祖先显式删除被这枚单父提交带回,且此刻仍在面上',
      verbatim,
    })
  }
  if (live.length > looked) undetermined.push(`候选 ${live.length} 条超出取证上限 ${lookupCap} ⇒ 其余 ${live.length - looked} 条未判定(不是"没有")`)

  return {
    ref,
    window,
    unjudged: false,
    commits: commits.length,
    commitsSkippedNotSingleParent: skippedNonSingleParent,
    addRows,
    candidates: live.length,
    looked,
    undetermined,
    hits: hits.filter((h) => !h.exempt),
    exempt: hits.filter((h) => h.exempt),
    allowEntries: allowEntries.length,
  }
}

/** 三态退出码:未判定优先于红(把"没看清"写成"没问题"是本仓最贵的错法)。 */
export function exitCodeOf(res) {
  if (res.unjudged) return 2
  if (res.undetermined.length > 0) return 2
  return res.hits.length > 0 ? 1 : 0
}

export function formatReport(res) {
  const L = []
  L.push(
    `[verbatim-resurrection] 被审面=${res.ref} 窗口=${res.window} 提交=${res.commits}(非单父跳过 ${res.commitsSkippedNotSingleParent ?? 0}) 新增行=${res.addRows} 在面候选=${res.candidates} 已查=${res.looked ?? 0} 台账条目=${res.allowEntries}`,
  )
  if (res.unjudged) {
    L.push(`❔ 未判定:${res.reason}`)
    return L.join('\n')
  }
  for (const h of res.hits) L.push(`  ❌ ${h.path}\n       加回于 ${h.addedBy.slice(0, 11)} ← 删除于 ${h.deletedBy.slice(0, 11)}  ${h.why}`)
  for (const h of res.exempt) L.push(`  ⚪ 已裁决只报数:${h.path} —— ${h.why}`)
  for (const u of res.undetermined) L.push(`  ❔ 未判定:${u}`)
  if (res.hits.length === 0 && res.undetermined.length === 0) L.push('✅ 零活回潮(窗口内每条"祖先显式删除又被带回"的路径都已核对)')
  if (res.hits.length > 0) {
    const paths = res.hits.map((h) => h.path).join(';')
    L.push('')
    L.push('  修法二选一(都不需要跳门):')
    L.push('   ① 就地再摘一次(推荐,走本仓唯一删除档,不碰共享工作树):')
    L.push(`      LAND_REMOVE_PATHS="${paths}" LAND_MSG="chore(retire): 摘净回潮件 <附逐枚凭据>" node scripts/object-space-land.mjs`)
    L.push('   ② 确有保留理由 → 在 scripts/data/deletion-survival-allowlist.json 逐条登记 path+reason+reviewBy(必须逐条读过两侧内容)')
  }
  return L.join('\n')
}

/**
 * 判据自检:正反例成对。只报"命中 0"而不证明"该命中的形态能命中"= 坏尺子(本仓多次记过)。
 * 夹具一律经 --root 进入、落点在 scratch-dir(§15b/§15c:工作树内禁止嵌套 git 仓)。
 */
export async function runSelfTest({ scratchDir }) {
  const { execFileSync } = await import('node:child_process')
  const rows = []
  const ok = (name, cond, extra = '') => rows.push({ name, pass: Boolean(cond), extra })
  // 裁决短语按运行时拼接:源码里写出那串字面量本身就会成为"文档里的可执行形态"(§0.8/门 238 同训)
  const MARKER = 'intentional-delete' + ':'
  const env = { ...process.env }
  const g = (root, args) =>
    execFileSync('git', ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', root, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    })
  const mk = () => {
    const root = scratchDir()
    g(root, ['init', '-q', '-b', 'main'])
    g(root, ['config', 'user.email', 't@example.invalid'])
    g(root, ['config', 'user.name', 'fixture'])
    return root
  }
  const addCommit = (root, msg, files) => {
    for (const [p, c] of Object.entries(files)) {
      const abs = join(root, p)
      fsMod.mkdirSync(dirname(abs), { recursive: true })
      fsMod.writeFileSync(abs, c, 'utf8')
      g(root, ['add', '--', p])
    }
    g(root, ['commit', '-q', '-m', msg])
  }
  const delCommit = (root, msg, paths) => {
    for (const p of paths) g(root, ['rm', '-q', '--', p])
    g(root, ['commit', '-q', '-m', msg])
  }

  // ① 正控:加 → 非合并摘 → 逐字带回 ⇒ 1 条命中且标 verbatim
  let r = mk()
  addCommit(r, 'chore: 建底座', { 'README.md': '# t\n' })
  addCommit(r, 'feat: 加一枚件', { 'tools/a.mjs': 'export const A = 1\n' })
  delCommit(r, 'chore: 按弃用令摘掉', ['tools/a.mjs'])
  addCommit(r, 'feat: 又把它带回来', { 'tools/a.mjs': 'export const A = 1\n' })
  let res = auditVerbatim({ ref: 'HEAD', window: 50, root: r })
  ok('① 正控 逐字回潮命中 1 条', res.hits.length === 1 && res.hits[0].path === 'tools/a.mjs' && res.hits[0].verbatim === true, JSON.stringify(res.hits.map((h) => h.path)))
  ok('① 正控 退出码 = 1', exitCodeOf(res) === 1, String(exitCodeOf(res)))

  // ② 反控:本仓真新文件(从无删除出处)⇒ 候选有数而命中 0(证明它不是一律判红)
  r = mk()
  addCommit(r, 'chore: 建底座', { 'README.md': '# t\n' })
  addCommit(r, 'feat: 新文件', { 'tools/new.mjs': 'export const N = 1\n' })
  res = auditVerbatim({ ref: 'HEAD', window: 50, root: r })
  ok('② 反控 真新文件不判(候选≥1 而命中=0)', res.candidates >= 1 && res.hits.length === 0, JSON.stringify({ c: res.candidates, h: res.hits.length }))

  // ③ 反控:摘净之后再没带回 ⇒ live 过滤 ⇒ 0(不拿历史事故挂恒红)
  r = mk()
  addCommit(r, 'chore: 建底座', { 'README.md': '# t\n' })
  addCommit(r, 'feat: 加', { 'tools/gone.mjs': 'x\n' })
  delCommit(r, 'chore: 摘', ['tools/gone.mjs'])
  res = auditVerbatim({ ref: 'HEAD', window: 50, root: r })
  ok('③ 反控 已摘净的面判 0', res.hits.length === 0 && exitCodeOf(res) === 0, JSON.stringify({ h: res.hits.length, rc: exitCodeOf(res) }))

  // ④ 反控:带回后又摘掉 ⇒ 同样判 0(live 两向都对)
  r = mk()
  addCommit(r, 'chore: 建底座', { 'README.md': '# t\n' })
  addCommit(r, 'feat: 加', { 'tools/t.mjs': 'v\n' })
  delCommit(r, 'chore: 摘', ['tools/t.mjs'])
  addCommit(r, 'feat: 带回', { 'tools/t.mjs': 'v\n' })
  delCommit(r, 'chore: 再摘净', ['tools/t.mjs'])
  res = auditVerbatim({ ref: 'HEAD', window: 50, root: r })
  ok('④ 反控 带回再摘净的面判 0', res.hits.length === 0, JSON.stringify(res.hits.map((h) => h.path)))

  // ⑤ 豁免:删除提交带裁决短语 ⇒ 进 exempt 不进 hits
  r = mk()
  addCommit(r, 'chore: 建底座', { 'README.md': '# t\n' })
  addCommit(r, 'feat: 加', { 'tools/w.mjs': 'y\n' })
  delCommit(r, `chore: 已裁决的摘除 ${MARKER} tools/w.mjs 日后可再取`, ['tools/w.mjs'])
  addCommit(r, 'feat: 带回', { 'tools/w.mjs': 'y\n' })
  res = auditVerbatim({ ref: 'HEAD', window: 50, root: r })
  ok('⑤ 带裁决短语 ⇒ 只报数不判红', res.hits.length === 0 && res.exempt.length === 1, JSON.stringify({ h: res.hits.length, e: res.exempt.length }))

  // ⑥ 反控:信息里只出现裸词(无裁决形态)不算裁决 —— 放宽即失效
  r = mk()
  addCommit(r, 'chore: 建底座', { 'README.md': '# t\n' })
  addCommit(r, 'feat: 加', { 'tools/w2.mjs': 'y\n' })
  delCommit(r, 'chore: 顺手写了裸词而没有裁决形态', ['tools/w2.mjs'])
  addCommit(r, 'feat: 带回', { 'tools/w2.mjs': 'y\n' })
  res = auditVerbatim({ ref: 'HEAD', window: 50, root: r })
  ok('⑥ 反控 无裁决形态仍判红', res.hits.length === 1, JSON.stringify(res.hits.map((h) => h.path)))

  // ⑦ 合并档不在本器射程(归守门 168):必须按"非单父"跳过并报数,不与 168 重复计同一笔债
  r = mk()
  addCommit(r, 'chore: 建底座', { 'README.md': '# t\n' })
  addCommit(r, 'feat: 加', { 'tools/m.mjs': 'm\n' })
  delCommit(r, 'chore: 摘', ['tools/m.mjs'])
  g(r, ['checkout', '-q', '-b', 'side', 'HEAD~1'])
  addCommit(r, 'side: 别的工作', { 'SIDE.md': 's\n' })
  g(r, ['checkout', '-q', 'main'])
  g(r, ['merge', '-q', '--no-ff', '-m', 'merge: 带回 side', 'side'])
  res = auditVerbatim({ ref: 'HEAD', window: 50, root: r })
  ok('⑦ 合并提交跳过并报数(不与 168 两处各计一次)', res.commitsSkippedNotSingleParent >= 1 && res.hits.length === 0, JSON.stringify({ sk: res.commitsSkippedNotSingleParent, h: res.hits.length }))

  // ⑧ 未判定:ref 取不到 ⇒ unjudged + exit 2,绝不折成"零命中"
  r = mk()
  addCommit(r, 'chore: 建底座', { 'README.md': '# t\n' })
  res = auditVerbatim({ ref: 'no-such-ref', window: 10, root: r })
  ok('⑧ 未判定 ref 取不到 ⇒ exit 2 且明写原因', res.unjudged === true && exitCodeOf(res) === 2, JSON.stringify({ u: res.unjudged, rc: exitCodeOf(res) }))

  // ⑨ 取证上限:余额必须记未判定,不得当成"没有"(cap 由构造面注入,不靠改 env 重启进程)
  r = mk()
  addCommit(r, 'feat: 底座与同名族', { 'README.md': '# t\n', 'tools/b0.mjs': '0\n', 'tools/b1.mjs': '1\n', 'tools/b2.mjs': '2\n' })
  delCommit(r, 'chore: 摘掉这一族', ['tools/b0.mjs', 'tools/b1.mjs', 'tools/b2.mjs'])
  addCommit(r, 'feat: 整族带回', { 'tools/b0.mjs': '0\n', 'tools/b1.mjs': '1\n', 'tools/b2.mjs': '2\n' })
  res = auditVerbatim({ ref: 'HEAD', window: 50, root: r, lookupCap: 1 })
  ok('⑨ 取证上限:只查 cap 条并点名余额为未判定', res.looked === 1 && res.candidates === 3 && res.undetermined.some((s) => s.includes('未判定')), JSON.stringify({ l: res.looked, c: res.candidates, u: res.undetermined }))
  const capFull = auditVerbatim({ ref: 'HEAD', window: 50, root: r, lookupCap: 10 })
  ok('⑨ 同面 cap 放开后命中 3 条(证明⑨扣住的是取证量而不是判据)', capFull.hits.length === 3, JSON.stringify({ h: capFull.hits.length }))

  // ⑩ 出参形状锁:镜像测试直接按这些键取数
  const shape = ['commits', 'addRows', 'candidates', 'looked', 'undetermined', 'hits', 'exempt', 'allowEntries'].filter((k) => !(k in capFull))
  ok('⑩ 出参形状锁(键齐备)', shape.length === 0, JSON.stringify({ missing: shape }))

  const bad = rows.filter((x) => !x.pass)
  for (const x of rows) console.log(`${x.pass ? '✅' : '❌'} ${x.name}${x.extra ? '  ' + x.extra : ''}`)
  console.log(`自检 ${rows.length - bad.length}/${rows.length} 通过;夹具只能经 --root 进入(ROOT 由脚本自身位置推导)`)
  return bad.length === 0
}

async function main() {
  const argv = process.argv.slice(2)
  const KNOWN = ['--json', '--self-test', '--ref', '--window', '--root']
  for (const a of argv) {
    if (a.startsWith('--') && !KNOWN.some((k) => a === k || a.startsWith(`${k}=`))) {
      console.error(`❌ 未认识的旗标 ${a}(本器只读,不做"未知旗静默忽略"的逃生舱)⇒ exit 2`)
      process.exit(2)
    }
  }
  for (const k of ['--ref', '--window', '--root']) {
    const i = argv.indexOf(k)
    if (i >= 0 && (i + 1 >= argv.length || String(argv[i + 1]).startsWith('--'))) {
      console.error(`❌ ${k} 给了旗标没给值 ⇒ exit 2(不把 undefined 当默认值用)`)
      process.exit(2)
    }
  }
  const kv = (k) => {
    const i = argv.indexOf(k)
    return i >= 0 ? argv[i + 1] : null
  }
  const windowRaw = kv('--window')
  if (windowRaw !== null && !/^\d+$/.test(String(windowRaw))) {
    console.error(`❌ --window 必须是正整数,实得 ${JSON.stringify(windowRaw)} ⇒ exit 2`)
    process.exit(2)
  }

  if (argv.includes('--self-test')) {
    const { mkScratch, rmScratch } = await import('./lib/scratch-dir.mjs')
    const made = []
    let pass = false
    try {
      pass = await runSelfTest({
        scratchDir: () => {
          const p = mkScratch('verbatim-resurrection')
          made.push(p)
          return p
        },
      })
    } finally {
      for (const p of made) {
        try {
          rmScratch(p)
        } catch {
          console.log(`⚠️ 夹具回收失败(路径与原因由 scratch-dir 自己点名):${p}`)
        }
      }
    }
    process.exit(pass ? 0 : 1)
  }

  const res = auditVerbatim({
    ref: kv('--ref') || 'HEAD',
    window: windowRaw === null ? 200 : Number(windowRaw),
    root: kv('--root') || ROOT,
  })
  console.log(argv.includes('--json') ? JSON.stringify(res, null, 2) : formatReport(res))
  process.exit(exitCodeOf(res))
}

export const __test__ = { auditVerbatim, exitCodeOf, addedPathsOf, commitsIn, formatReport, blobOf, runSelfTest, LOOKUP_CAP }

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
