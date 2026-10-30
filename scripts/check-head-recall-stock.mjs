// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门(编号见 runner 现值):PROJECT_PLAN.md「HEAD 面回捞件」差值棘轮。
 *
 * 拦什么:被审面上「未勾登记行 ∧ 摘除台账已声明为删除」的**枚数变多**。
 * 立因(硬证据枚 `7864cde002`,2026-10-30 17:12「chore(sync): 收敛 origin/main 到本地 main,手工解决…」):
 * 一次普通 `git merge` 的父1(本侧)= 40 枚未勾、父2(origin/main)= 338 枚、结果 = 342 枚 —— 本侧已对
 * 约 280 枚登记行行使过处置权,对侧带着旧台账把行整份带回 HEAD。此后 342→325→321 反复跳:每席手动
 * 再结清一批,下一枚合并又带回来。机主管这叫「计划任务文档跳跃」。
 *
 * 为什么必须新立一道而不是复用:
 *  - `scrub-declared-removals.mjs`(维一/维三)以「HEAD 面无此行」为前提 ⇒ 污染就在 HEAD 面上时恒 0 扣;
 *  - `union-converge.mjs` 的 `declaredDropCaps` 只管「本侧 0 份」⇒ 行来自对侧时不认;
 *  - `check-live-doc-merge-recall.mjs` 已接 `.husky/post-merge`,但只警告不阻塞、默认只扫最近 10 枚 merge。
 *  本门的判据 import `lib/head-recall.mjs`(它再 import `declaredRows()` 的「声明为删除」证据面与
 *  `titleFpOf`),一行尺子都不在这里重算(§0.6/§22c);清扫归 `scripts/strip-head-recall-rows.mjs`。
 *
 * 三面纪律(AGENTS §0.4 / 守门 118):全量档判 HEAD blob,`--staged` 判索引 blob,`--worktree` 仅人工
 * 逃生舱;两面旗同给 ⇒ exit 2;取不到 ⇒ 未判定,不记绿也不冒红(§0.3)。
 *
 * 定档(§12e 恒红门禁令):S1 **差值棘轮**(仅 `--staged`,blocking)= 索引面枚数 > HEAD 面枚数才红 ——
 * 存量那 280 枚不担责(与本次提交无关的红只会逼人 `--no-verify` 并连带废掉全部守门);S2 全量档只报数。
 * 存量清偿由清扫器负责,清完后锚点自然落到 0,此后任何一枚带回新行的提交当场红 —— 这就是"不允许再发生"。
 *
 * 用法:
 *   node scripts/check-head-recall-stock.mjs                # 全量档:HEAD blob,只报数
 *   node scripts/check-head-recall-stock.mjs --staged        # pre-commit:索引 blob,变多才红
 *   node scripts/check-head-recall-stock.mjs --self-test
 *
 * 头注刻意不写"已接 pre-commit / CI"字样(守门 89 R1/R2 判"声称已接而零命中")。
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, selectFace } from './lib/face-reader.mjs'
import { recallRowsOf } from './lib/head-recall.mjs'
import { declaredRows } from './scrub-declared-removals.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const FILE = 'PROJECT_PLAN.md'
const C = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  reset: '\x1b[0m',
}

/** 纯判据:两面文本 + 台账 ⇒ 枚数差与新增清单(本函数零 IO,自检直接调它)。
 *  差集按**多重集**算,不按集合:同一枚回捞件被逐字插第二份时,集合差是 0 而枚数确实涨了 ——
 *  报"新增 0 枚"等于判红却不点名,正是本仓反复登记的"取不到输入却写成判过"那一型(§0.3)。 */
export function diffStock({ faceText, baseText, declared }) {
  if (!faceText || !baseText) return { undetermined: true, why: '被审面或基线面为空' }
  const face = recallRowsOf(faceText, declared)
  const base = recallRowsOf(baseText, declared)
  if (face.undetermined) return { undetermined: true, why: `被审面:${face.why}` }
  if (base.undetermined) return { undetermined: true, why: `基线面:${base.why}` }
  const tally = (rows) => {
    const m = new Map()
    for (const r of rows) m.set(r.raw, (m.get(r.raw) || 0) + 1)
    return m
  }
  const baseCount = tally(base.rows)
  const added = []
  const faceSeen = new Map()
  for (const r of face.rows) {
    const n = (faceSeen.get(r.raw) || 0) + 1
    faceSeen.set(r.raw, n)
    if (n > (baseCount.get(r.raw) || 0)) added.push(r)
  }
  return {
    undetermined: false,
    faceCount: face.rows.length,
    baseCount: base.rows.length,
    faceHeld: face.held.length,
    added,
    grew: face.rows.length > base.rows.length,
  }
}

function selfTest() {
  let fails = 0
  const ok = (cond, msg) => {
    if (cond) return
    fails++
    console.error(`✗ ${msg}`)
  }
  const R1 = '- [ ] G-901 已被摘除的回捞件'
  const R2 = '- [ ] G-902 真活'
  const declared = {
    filesSeen: 2,
    dropTitleFps: new Set(),
    dropTitleRows: new Map([['__fp__', [R1]]]),
    set: new Set([R1]),
  }
  const d0 = diffStock({ faceText: `# 计划\n${R2}\n`, baseText: `# 计划\n${R2}\n`, declared })
  ok(d0.undetermined === false && d0.faceCount === 0 && !d0.grew, '① 两面同净 ⇒ 绿')
  const d1 = diffStock({
    faceText: `# 计划\n${R1}\n${R2}\n`,
    baseText: `# 计划\n${R2}\n`,
    declared,
  })
  ok(d1.grew && d1.added.length === 1, `② 被审面带回一枚 ⇒ 判增长(实测 grew=${d1.grew})`)
  const d2 = diffStock({
    faceText: `# 计划\n${R2}\n`,
    baseText: `# 计划\n${R1}\n${R2}\n`,
    declared,
  })
  ok(!d2.grew && d2.faceCount === 0, '③ 摘除(枚数下降)永不红 —— 否则清扫器自己会被门挡死')
  const d3 = diffStock({
    faceText: `# 计划\n${R1}\n${R1}\n`,
    baseText: `# 计划\n${R1}\n`,
    declared,
  })
  ok(
    d3.grew && d3.faceCount === 2 && d3.added.length === 1,
    `④ 同文第二份副本也算增长**且点得出名**(实测 faceCount=${d3.faceCount} added=${d3.added.length})`,
  )
  const d4 = diffStock({ faceText: null, baseText: `# 计划\n${R2}\n`, declared })
  ok(d4.undetermined === true, '⑤ 面取不到 ⇒ 未判定,不记绿')
  const d5 = diffStock({
    faceText: `# 计划\n${R2}\n`,
    baseText: `# 计划\n${R2}\n`,
    declared: { filesSeen: 0 },
  })
  ok(d5.undetermined === true, '⑥ 台账取不到 ⇒ 未判定(§0.3)')
  console.log(fails === 0 ? '自检:全部通过(6 组)' : `自检:${fails} 失败`)
  return fails
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) process.exit(selfTest())

  const picked = selectFace({
    staged: args.includes('--staged'),
    worktree: args.includes('--worktree'),
  })
  if (picked.error) {
    console.error(`${C.red}两面旗同给(§0.4):${C.reset}${picked.error} ⇒ 未判定,不落结论`)
    process.exit(2)
  }
  const faceName =
    picked.face === 'staged'
      ? '索引 blob'
      : picked.face === 'worktree'
        ? '工作树(人工逃生舱)'
        : 'HEAD blob'
  const faceSpec =
    picked.face === 'staged' ? `:${FILE}` : picked.face === 'worktree' ? null : `HEAD:${FILE}`
  const baseSpec = picked.face === 'head' ? `HEAD^:${FILE}` : `HEAD:${FILE}`

  let faceText = null
  let baseText = null
  try {
    if (picked.face === 'worktree') {
      // 人工逃生舱档:唯一允许读盘的一档(§0.4),基线仍取 HEAD blob —— 不回落另一个面
      faceText = readFileSync(path.join(ROOT, FILE), 'utf8')
      const got = catBatch(ROOT, ['HEAD:' + FILE])
      baseText = got?.get('HEAD:' + FILE) ?? null
    } else {
      const got = catBatch(ROOT, [faceSpec, baseSpec])
      faceText = got?.get(faceSpec) ?? null
      baseText = got?.get(baseSpec) ?? null
    }
  } catch (e) {
    console.error(
      `${C.yellow}⏭ 未判定:${C.reset}取材层抛错(${faceSpec ?? '工作树'} / ${baseSpec}):${String(e?.message ?? e).split('\n')[0]}`,
    )
    process.exit(2)
  }
  if (!faceText || !baseText) {
    console.error(
      `${C.yellow}⏭ 未判定:${C.reset}取不到(${faceSpec ?? '工作树'} / ${baseSpec})⇒ 不记绿也不冒红(§0.3)`,
    )
    process.exit(2)
  }

  let declared
  try {
    declared = declaredRows(ROOT)
  } catch (e) {
    console.error(
      `${C.yellow}⏭ 未判定:${C.reset}摘除台账取不到:${String(e?.message ?? e).split('\n')[0]}`,
    )
    process.exit(2)
  }
  const v = diffStock({ faceText, baseText, declared })
  if (v.undetermined) {
    console.error(`${C.yellow}⏭ 未判定 —— ${v.why}${C.reset} ⇒ 不记绿也不冒红(§0.3)`)
    process.exit(2)
  }

  console.log(
    `${C.green}判定面=${faceName}${C.reset} 回捞件 ${v.faceCount} 枚(基线 ${v.baseCount} 枚,让路 ${v.faceHeld} 枚)`,
  )
  if (picked.face === 'head') {
    console.log(
      `ℹ️ 全量档只报数(§12e):存量由 scripts/strip-head-recall-rows.mjs 清偿;跨枚增长由 --staged 档拦。`,
    )
    process.exit(0)
  }
  if (!v.grew) {
    console.log('✅ 本次没有把「已声明删除的登记行」带回索引(枚数未增)')
    process.exit(0)
  }
  console.error(
    `${C.red}❌ 本次暂存把回捞件从 ${v.baseCount} 枚抬到 ${v.faceCount} 枚(新增 ${v.added.length} 枚)${C.reset}`,
  )
  for (const r of v.added.slice(0, 15))
    console.error(`   L${r.line} [${r.via}] ${r.raw.slice(0, 72)}`)
  if (v.added.length > 15) console.error(`   …另 ${v.added.length - 15} 枚未逐条打印`)
  console.error(
    `   出路:① 这行若确已被处置 ⇒ node scripts/strip-head-recall-rows.mjs --apply(兜底清扫器,自带留痕与推送腿);` +
      `\n   ② 若本次是普通 git merge 把旧台账侧带回 ⇒ 改走 node scripts/union-converge.mjs(行级并集认摘除台账);` +
      `\n   ③ 若这行确实要重开 ⇒ 换题面再登记(不许逐字插回),并带一句为什么。`,
  )
  console.error(
    `   应急跳过:HUSKY_SKIP_HEAD_RECALL_STOCK=1 git commit ...(须在该门「跳门留痕」里写原因)`,
  )
  process.exit(1)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = { diffStock, FILE }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
