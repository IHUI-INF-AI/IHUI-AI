#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 对象空间合流 + 活文档重数封顶(常驻工具,**不在提交链**;2026-11-01 立,goal-b47)。
 *
 * 为什么要有它:同日实测到两条正牌出口同时拒推进 HEAD —— `git-sync-converge` 判"已声明摘除的行被复活",
 * `union-converge` 判 F6「整块登记重复」。两者都没误报:git 自己的三方合并**确实吞掉了两行只在本侧存在的
 * 台账登记行**(实测 `- [x] P89 〔千段租约〕`)。这道现场的缺口不是"闸太严",而是没人按
 * "每行重数 = max(本侧, 对侧)"这一条尺子把归并结果封顶后再落。
 *
 * 三条不可谈的边界:
 * 1. **零触碰工作树**:全程 object-space(临时 `GIT_INDEX_FILE` + `commit-tree` + CAS `update-ref`)。
 *    共享工作区常年有他席在飞改动,checkout 式合并会直接把别人的现场砸掉。
 * 2. **断言不过就不落**:四条零丢失判据(每行重数配平 ∧ 零冲突标记 ∧ 本侧独有行零丢失 ∧ 对侧独有行零丢失)
 *    任一不过 ⇒ exit 1,不 `update-ref`、不推、不写任何引用。
 * 3. **落地前先保现场**:`backup/pre-objectspace-merge-<时刻>` 指向推进前的 HEAD(§22)。
 *
 * 它**不改判据、不绕闸**:闸拦下的是"归并会丢东西",本器做的是把丢的东西按同一条尺补回来再落。
 *
 * 用法:
 *   node scripts/object-space-merge-cap.mjs                    # 只报告(零副作用)
 *   node scripts/object-space-merge-cap.mjs --apply            # 断言全过才落地
 *   node scripts/object-space-merge-cap.mjs --theirs <ref>     # 指定归并目标(默认 origin/main)
 *   node scripts/object-space-merge-cap.mjs --self-test        # 纯函数回归(不碰任何仓)
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const LEDGER_ROW_RE = /^- \[[ x]\] /

/**
 * 封顶:每行保留份数 = max(本侧份数, 对侧份数);两侧都没有而合并结果自带的整行(两面各自改写后
 * git 产成的复合行)**保留一份**,不当"多出来的"删掉。
 * 纯函数,不碰磁盘与 git ⇒ 可被镜像用例直接钉住(§22c:判据只许住在这里)。
 */
export function capMergedLines({ merged, ours, theirs, anchorLedgerRows = true }) {
  const count = (lines) => {
    const m = new Map()
    for (const l of lines) m.set(l, (m.get(l) || 0) + 1)
    return m
  }
  const co = count(ours)
  const ct = count(theirs)
  const want = new Map()
  for (const l of new Set([...co.keys(), ...ct.keys()])) want.set(l, Math.max(co.get(l) || 0, ct.get(l) || 0))

  const kept = []
  const seen = new Map()
  const dropped = []
  for (const l of merged) {
    const lim = want.get(l)
    if (lim === undefined) {
      const c = (seen.get(l) || 0) + 1
      if (c === 1) {
        seen.set(l, 1)
        kept.push(l)
        want.set(l, 1)
      } else {
        dropped.push(l)
      }
      continue
    }
    const c = (seen.get(l) || 0) + 1
    if (c > lim) {
      dropped.push(l)
      continue
    }
    seen.set(l, c)
    kept.push(l)
  }

  // git 的三方合并会把"只在本侧、而对侧把整段改写掉"的登记行直接丢掉 ⇒ 补回台账块尾部。
  // 不补到 EOF:兜底清扫轮会削尾吞票(在册 hazard)。
  const kr = count(kept)
  const insertAt = anchorLedgerRows
    ? kept.reduce((last, l, i) => (LEDGER_ROW_RE.test(l) ? i : last), -1)
    : -1
  const restored = []
  if (insertAt >= 0) {
    const missing = []
    for (const [l, n] of want) {
      const deficit = n - (kr.get(l) || 0)
      for (let i = 0; i < deficit; i++) missing.push(l)
    }
    if (missing.length) {
      kept.splice(insertAt + 1, 0, ...missing)
      for (const l of missing) {
        kr.set(l, (kr.get(l) || 0) + 1)
        restored.push(l)
      }
    }
  }

  const problems = []
  for (const [l, n] of want) {
    if ((kr.get(l) || 0) !== n) problems.push(`重数不配:want=${n} got=${kr.get(l) || 0} :: ${l.slice(0, 70)}`)
  }
  const markers = kept.filter((l) => /^(<{7}|={7}|>{7})/.test(l))
  if (markers.length) problems.push(`冲突标记 ${markers.length} 处`)
  const oursOnly = ours.filter((l) => (ct.get(l) || 0) === 0)
  const lostOurs = oursOnly.filter((l) => (kr.get(l) || 0) < (co.get(l) || 0))
  if (lostOurs.length) problems.push(`本侧独有行丢失 ${lostOurs.length} 条,首例:${String(lostOurs[0]).slice(0, 70)}`)
  const theirsOnly = theirs.filter((l) => (co.get(l) || 0) === 0)
  const lostTheirs = theirsOnly.filter((l) => (kr.get(l) || 0) < (ct.get(l) || 0))
  if (lostTheirs.length) problems.push(`对侧独有行丢失 ${lostTheirs.length} 条,首例:${String(lostTheirs[0]).slice(0, 70)}`)

  return {
    kept,
    dropped,
    restored,
    problems,
    want,
    /** 某行在结果里的份数(自检与调用方共用,不在别处重算)。 */
    countOf: (l) => kr.get(l) || 0,
    problemFree: () => problems.length === 0,
  }
}

function run(argv, opts = {}) {
  return execFileSync('git', argv, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    stdio: ['pipe', 'pipe', 'pipe'],
    ...opts,
  })
}

function selfTest() {
  const cases = []
  const t = (name, fn) => cases.push([name, fn])
  t('重复块封顶到 max,不翻倍', () => {
    const ours = ['a', '- [ ] P1 本侧行', 'b']
    const theirs = ['a', '- [ ] P1 本侧行', 'c']
    const merged = ['a', '- [ ] P1 本侧行', '- [ ] P1 本侧行', 'b', 'c']
    const r = capMergedLines({ merged, ours, theirs })
    return r.problemFree() && r.countOf('- [ ] P1 本侧行') === 1 && r.kept.includes('b') && r.kept.includes('c')
  })
  t('git 合并吞掉的本侧登记行被补回台账块之后', () => {
    const ours = ['- [x] P9 租约行', 'x']
    const theirs = ['- [ ] P8 别的行', 'x']
    const merged = ['x', '- [ ] P8 别的行']
    const r = capMergedLines({ merged, ours, theirs })
    const idx = r.kept.indexOf('- [x] P9 租约行')
    return r.problemFree() && idx > r.kept.indexOf('- [ ] P8 别的行') && idx >= 0
  })
  t('两侧都没有的复合行保留一份(删它就是无声抹掉别人的注记)', () => {
    const r = capMergedLines({ merged: ['c1', 'c1', 'a'], ours: ['a'], theirs: ['a'] })
    return r.kept.filter((l) => l === 'c1').length === 1 && r.problemFree()
  })
  t('不补到 EOF:落点是最后一条登记行之后', () => {
    const r = capMergedLines({ merged: ['- [ ] T 对侧行', 'tail'], ours: ['- [x] T2 本侧行'], theirs: ['- [ ] T 对侧行', 'tail'] })
    return r.kept[r.kept.length - 1] === 'tail' && r.kept.indexOf('- [x] T2 本侧行') < r.kept.indexOf('tail')
  })
  t('anchorLedgerRows=false ⇒ 不补(交人工那一档)', () => {
    const r = capMergedLines({ merged: ['x'], ours: ['- [ ] 缺席行'], theirs: ['x'], anchorLedgerRows: false })
    return r.problems.length > 0 && !r.problemFree()
  })
  let pass = 0
  for (const [name, fn] of cases) {
    let ok = false
    try {
      ok = fn() === true
    } catch (e) {
      ok = false
      console.log(`   异常:${e?.message ?? e}`)
    }
    console.log(`${ok ? '✅' : '❌'} ${name}`)
    if (ok) pass++
  }
  console.log(`自检 ${pass}/${cases.length}(例数现读)`)
  return pass === cases.length ? 0 : 1
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const APPLY = argv.includes('--apply')
  const theirsRefIdx = argv.indexOf('--theirs')
  const theirsRef = theirsRefIdx >= 0 ? argv[theirsRefIdx + 1] : 'origin/main'
  const DOC = 'PROJECT_PLAN.md'

  const OURS = run(['rev-parse', 'HEAD']).trim()
  const THEIRS = run(['rev-parse', theirsRef]).trim()
  const BASE = run(['merge-base', OURS, THEIRS]).trim()
  console.log(`OURS=${OURS.slice(0, 11)} THEIRS=${THEIRS.slice(0, 11)} BASE=${BASE.slice(0, 11)}`)
  if (OURS === THEIRS) {
    console.log('无需合流(两面同枚)')
    return 0
  }

  const treeOut = run(['merge-tree', '--write-tree', '--no-messages', OURS, THEIRS]).trim()
  const TREE = treeOut.split('\n')[0]
  if (!/^[0-9a-f]{40}$/.test(TREE)) {
    console.log(`❌ merge-tree 没给出树对象(得到 ${treeOut.slice(0, 160)})⇒ 未判定,不落`)
    return 2
  }
  const faceOf = (rev) => run(['cat-file', 'blob', run(['rev-parse', `${rev}:${DOC}`]).trim()]).split('\n')
  const mergedSha = run(['ls-tree', TREE, DOC]).trim().split(/\s+/)[2]
  if (!mergedSha) {
    console.log(`❌ 合并树里没有 ${DOC} ⇒ 未判定,不落`)
    return 2
  }
  const merged = run(['cat-file', 'blob', mergedSha]).split('\n')
  const oursLines = faceOf(OURS)
  const theirsLines = faceOf(THEIRS)
  const r = capMergedLines({ merged, ours: oursLines, theirs: theirsLines })

  const rowOf = (ls) => ls.filter((l) => /^- \[[ x]\] P8\d/.test(l)).length
  console.log(
    `封顶结果:merged=${merged.length} kept=${r.kept.length} 少带=${r.dropped.length} 补回=${r.restored.length}` +
      ` 登记行 本侧=${rowOf(oursLines)} 对侧=${rowOf(theirsLines)} 结果=${rowOf(r.kept)}`,
  )
  for (const l of r.dropped.slice(0, 5)) console.log(`   少带 → ${l.slice(0, 76)}`)
  for (const l of r.restored.slice(0, 5)) console.log(`   补回 ← ${l.slice(0, 76)}`)
  if (r.problems.length) {
    console.log(`❌ 断言不过 ${r.problems.length} 处 ⇒ 不落、不 update-ref、不推:`)
    for (const p of r.problems.slice(0, 10)) console.log('   · ' + p)
    return 1
  }
  console.log('✅ 四条零丢失断言全过(每行重数配平 ∧ 零冲突标记 ∧ 本侧独有行零丢失 ∧ 对侧独有行零丢失)')
  if (!APPLY) {
    console.log('CHECK ONLY(给 --apply 才落地)')
    return 0
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + String(Date.now() % 1000)
  const backupTag = `backup/pre-objectspace-merge-${stamp}`
  run(['tag', backupTag, OURS])
  console.log(`✅ 现场已保:${backupTag} → ${OURS.slice(0, 11)}`)

  const newBlob = run(['hash-object', '-w', '--stdin'], { input: r.kept.join('\n') }).trim()
  const dir = mkdtempSync(join(tmpdir(), 'ihui-merge-cap-'))
  const idx = join(dir, 'index')
  try {
    run(['read-tree', TREE], { env: { ...process.env, GIT_INDEX_FILE: idx } })
    run(['update-index', '--add', '--cacheinfo', `100644,${newBlob},${DOC}`], { env: { ...process.env, GIT_INDEX_FILE: idx } })
    const newTree = run(['write-tree'], { env: { ...process.env, GIT_INDEX_FILE: idx } }).trim()
    console.log(`新树 ${newTree.slice(0, 11)}(原 ${TREE.slice(0, 11)})`)
    const msg =
      `Merge ${theirsRef} (object-space, worktree-preserving) with 活文档重数封顶 ${stamp} —— ` +
      `每行重数 = max(本侧, 对侧);落地前四条零丢失断言全过(重数配平 ∧ 零冲突标记 ∧ 本侧独有行零丢失 ∧ 对侧独有行零丢失),` +
      `补回被 git 三方合并吞掉的登记行 ${r.restored.length} 条。全程 object-space,零触碰工作树。现场备份 tag ${backupTag}`
    const commit = run(['commit-tree', newTree, '-p', OURS, '-p', THEIRS, '-m', msg]).trim()
    run(['update-ref', 'refs/heads/main', commit, OURS])
    console.log(`✅ 已推进 main → ${commit.slice(0, 11)}(CAS 前像=${OURS.slice(0, 11)})`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  console.log(`回读 HEAD=${run(['rev-parse', 'HEAD']).trim().slice(0, 11)}(工作树未动)`)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href
if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(2)
  }
}

export const __test__ = {
  capMergedLines,
  LEDGER_ROW_RE,
  decorate: (r) => r,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
