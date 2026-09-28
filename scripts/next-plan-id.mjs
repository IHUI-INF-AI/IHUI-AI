// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 取号工具为 CLI,输出即其交付物 */
/**
 * 计划条目编号对账 —— 取下一个**未被占用**的 `O<数字>` 编号,并报告当前重号。
 *
 * 为什么存在(2026-09-24 实测事故):同一夜三次编号相撞。根因不是忘了查,而是**查的对象错了** ——
 * 登记前查的是工作区那份 `PROJECT_PLAN.md`,而共享工作区里它常被并发会话留在滞后基线上
 * (本次实测工作树比 HEAD 少 61 行),于是"已查过占用"查的是一本旧账,新加的号必然撞。
 * 因此权威口径固定为 `git show HEAD:PROJECT_PLAN.md`(可用 --source 切 origin/main),
 * 而不是磁盘副本。
 *
 * 第二条旧账(2026-09-28 补,本票):台账**不是**唯一写过号的地方。`scripts/archive-completed-tasks.mjs`
 * 把已完成条目整块搬到 `.ihui-agent/archive/PROJECT_PLAN_*.md`,台账里只留一行 HTML 注释占位 ——
 * 于是只看台账的 max 会随每次归档**回落**,发出去的号可能早已用过的号(立门当日现读 O 族:
 * 台账行 max=88、台账⊕归档件 max=90,而本器按条目标题给的是 O87 —— O87/O89/O90 三个号都在归档件里)。
 * 占用面因此换成 `scripts/lib/plan-id-face.mjs` 的 `collectIdFace()`(台账 ⊕ 归档件,同面同轮),
 * 与 `live-doc-edit.mjs` 共用那一份实现。**"什么算一个编号"仍只有一份** —— 判据住在
 * `scripts/lib/plan-task-index.mjs` 的 `usedIdsOfPrefix`,本器不抄第二份编号语法。
 *
 * 面判不出(台账取不到 / 归档件清单枚举失败 / 有归档件取不到)⇒ **拒绝发号**并 exit 1:
 * 按窄面发一个可能撞车的号,比停在这里不发货危害大(撞车正是本缺陷的症状,而它事后不可判)。
 *
 * 用法:
 *   node scripts/next-plan-id.mjs                # 打印下一个可用号 + 现有号分布
 *   node scripts/next-plan-id.mjs --next-only     # 只打印一个号(供脚本串用)
 *   node scripts/next-plan-id.mjs --source origin/main
 *   node scripts/next-plan-id.mjs --check        # 有重号即 exit 1(不打印建议号)
 *
 * 退出码:0 正常 / 1 --check 发现重号,或取不到权威版本、占用面判不出 / 2 脚本自身异常。
 * 对外契约不变:--check 的 stdout 与退出码逐字同改动前(重号仍按**台账面自身的条目标题**判 ——
 * 归档件里"台账一行 + 归档一份"是归档机制的正常形态,把它读成重号就是一台恒红误报);
 * --next-only 的 stdout 恒为一行号(所有面信息一律走 stderr)。
 */
import { resolve } from 'node:path'

import { usedIdsOfPrefix } from './lib/plan-task-index.mjs'
import { collectIdFace } from './lib/plan-id-face.mjs'

const ROOT = resolve(import.meta.dirname, '..')
const PLAN_PATH = 'PROJECT_PLAN.md'
/** 条目级编号:只认标题行(`## O123 …` / `### O123 …`),正文里引用的别的号不算占用 */
const HEADING = /^#{2,3}[ \t]+(O\d+)/gm
/** 只把 `O<number>` 的数字段取出来(族名与连字符两种书写都由 usedIdsOfPrefix 认) */
const FAMILY = 'O'

const argv = process.argv.slice(2)
const flags = new Set(argv.filter((a) => a.startsWith('--')))
const srcIdx = argv.indexOf('--source')
const SOURCE = srcIdx >= 0 && argv[srcIdx + 1] ? argv[srcIdx + 1] : 'HEAD'

if (flags.has('--help') || flags.has('-h')) {
  console.log(
    [
      '用法: node scripts/next-plan-id.mjs [--next-only] [--check] [--source <rev>]',
      '  默认从 `git show HEAD:PROJECT_PLAN.md` 取权威条目号(不看工作树副本 —— 理由见文件头)。',
      '  占用面 = 台账 ⊕ .ihui-agent/archive/PROJECT_PLAN*.md(归档器搬走的那一侧也算已占用)。',
    ].join('\n'),
  )
  process.exit(0)
}

for (const f of flags) {
  if (!['--next-only', '--check', '--source'].includes(f)) {
    console.error(`✗ 未知参数 ${f}(拒绝把它当编号继续跑;可用项见 --help)`)
    process.exit(2)
  }
}

// ── 占用面:台账 + 归档件,同面同轮(见 lib/plan-id-face.mjs 头注三条设计前提) ──────────
const face = collectIdFace({ root: ROOT, source: SOURCE, doc: PLAN_PATH })
// 面信息一律走 stderr:--next-only / --check 的 stdout 是被脚本与人读的那一份,不能多行。
for (const n of face.notes) console.error(`ℹ ${n}`)
if (!face.ok) {
  for (const n of face.undetermined) console.error(`✗ 占用面判不出:${n}`)
  if (!face.undetermined.length) console.error('✗ 占用面判不出(未给出原因)')
  console.error(`✗ 取不到 ${SOURCE} 的完整占用面 → 无法判定占用。`)
  console.error('  宁可报错也不按窄面给号:归档件里已用过的号,台账看不见。')
  process.exit(1)
}
const text = face.ledgerText
const wideText = face.text

const seen = []
for (const m of text.matchAll(HEADING)) seen.push(m[1])
const count = new Map()
for (const id of seen) count.set(id, (count.get(id) || 0) + 1)
const nums = [...count.keys()].map((k) => Number(k.slice(1)))
const dups = [...count.entries()].filter(([, n]) => n > 1).sort((a, b) => a[0].localeCompare(b[0]))

if (flags.has('--check')) {
  if (dups.length) {
    console.log(`❌ ${SOURCE} 上条目编号重号 ${dups.length} 组:`)
    for (const [id, n] of dups) console.log(`   ${id} ×${n}`)
    process.exit(1)
  }
  console.log(`✅ ${SOURCE} 无条目编号重号(共 ${count.size} 个号,最大 O${Math.max(...nums)})`)
  process.exit(0)
}

// ── 发号用的 max:两种口径都量,取较大者;量的都是**宽面**(台账 ⊕ 归档件) ──────────────
//  ① 条目标题口径(本器既有口径,一字未放宽)—— 在宽面上重扫;
//  ② 登记行口径 —— 交给 usedIdsOfPrefix 那一份判据(台账里 `O` 族多数写在 `- [ ] O13 …` 这种
//     行首形态上,只看标题会漏;而归档器搬走的正是这些行)。
// 取两者较大 ⇒ 本器**只会给出比改动前更大或相等的号**,不存在"改完反而开始撞车"。
// 两个都判不出(该面一条 O 记录都没有)时保持既有算术:Math.max() 空集 = -Infinity。
const headingMaxWide = Math.max(...[...wideText.matchAll(HEADING)].map((m) => Number(m[1].slice(1))))
const rowUsedWide = usedIdsOfPrefix(wideText, FAMILY)
const maxLedger = Math.max(...nums)
const maxWide = Math.max(headingMaxWide, rowUsedWide === null ? Number.NEGATIVE_INFINITY : rowUsedWide.max)
const next = maxWide + 1
const used = new Set(nums)
const gaps = []
for (let k = 1; k < next; k += 1) if (!used.has(k)) gaps.push(`O${k}`)

// 两面(标题口径 + 登记行口径)与两文件(台账 + 归档件)都读不到任何 O 记录 ⇒ maxWide = -Infinity。
// 这是**改动前就有的**算术(Math.max(...[]) = -Infinity),本器刻意不改退出码与 stdout 契约,
// 但必须喊出来:"O-Infinity"被当成一个号登记进台账,比停在这里难查得多。
if (!Number.isFinite(maxWide))
  console.error(
    `⚠️ ${SOURCE} 的占用面(台账 ⊕ ${face.archiveFiles.length} 份归档件)里一条 O 记录都没有 ⇒ ` +
      `下面给的不是可用号,请人工确认这个族是否已被整族归档(是 ⇒ 先补面,不要按它登记)。`,
  )

if (flags.has('--next-only')) {
  console.log(`O${next}`)
  process.exit(0)
}

const fmt = (n) => (Number.isFinite(n) ? `O${n}` : '无(该面一条 O 记录都没有)')
console.log(
  `权威口径 = git show ${SOURCE}:${PLAN_PATH} ⊕ ${face.archiveFiles.length} 份归档件(台账条目标题 ${seen.length} 行 / 去重 ${count.size} 个号)`,
)
console.log(
  `已占用的最大号 = ${fmt(maxWide)}   下一个号 = O${next}`,
)
console.log(
  `  两面对账:仅台账 max=${fmt(maxLedger)} / 台账⊕归档件 max=${fmt(maxWide)} ⇒ 差 ${Number.isFinite(maxWide) && Number.isFinite(maxLedger) ? maxWide - maxLedger : '?'} 档(只看台账会少让这么多)`,
)
if (gaps.length) console.log(`(空洞 ${gaps.length} 个,不回收,只如实报:${gaps.slice(0, 12).join(', ')}${gaps.length > 12 ? ' …' : ''})`)
const addenda = dups.filter(([id]) => text.includes(`${id} 追加`))
const real = dups.filter(([id]) => !text.includes(`${id} 追加`))
if (addenda.length) {
  console.log(`ℹ️  其中 ${addenda.length} 组是同日"追加"续写(${addenda.map(([id]) => id).join(', ')}),属同一持有人在原条目下续写,不算相撞。`)
}
if (real.length) {
  console.log(`⚠️  该版本自身已有真重号 ${real.length} 组(登记时没查权威版本所致):`)
  for (const [id, n] of real) console.log(`   ${id} ×${n}`)
  console.log('  按本仓既有口径"后来者改号"处理;改别人已入库的号会牵动 README/commit 引用,须由人决定。')
}
console.log(`建议本次使用:${fmt(next)}`)
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
