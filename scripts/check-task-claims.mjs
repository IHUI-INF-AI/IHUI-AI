#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-task-claims.mjs — 扫描 PROJECT_PLAN.md 任务认领状态
 *
 * 三态分类(AGENTS.md §1 任务认领机制配套):
 *   - 无人认领: `- [ ]` 开头(不含"进行中")
 *   - 进行中:   `- [ ]（进行中）` 开头(全角括号)
 *   - 已完成:   `- [x]` 开头
 *
 * 用法:
 *   node scripts/check-task-claims.mjs             # 人类可读汇总
 *   node scripts/check-task-claims.mjs --json      # JSON 输出
 *   node scripts/check-task-claims.mjs --unclaimed  # 只列无人认领
 *   node scripts/check-task-claims.mjs --in-progress # 只列进行中
 *
 * 2026-09-23 立, AGENTS.md §1 任务认领机制配套
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 相似度尺子**复用** lib 里的唯一实现(纯函数、零副作用)。
// 不 import `merge-live-doc.mjs`:它顶层就是 CLI 主流程且没有 §22d 的 isDirectRun 守卫,
// 一被 import 就跑参数校验并 `process.exit(2)` —— 本票第一版就这么把扫描器弄死了(实测)。
import {
  SIM_THRESHOLD,
  CONTAIN_MIN,
  jaccard,
  squash,
  tokenize,
} from './lib/live-doc-similarity.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const PLAN_PATH = resolve(ROOT, 'PROJECT_PLAN.md')

/**
 * 扫描 PROJECT_PLAN.md 内容,按三态分类任务行。
 *
 * 每行同时留 `text`(展示用的 120 字截断)与 `full`(**整行**)。相似度一律用 `full`:
 * 只比前 120 字会把"同名不同尾"的两件事判成孪生(台账里 D64/D90 这类条目在 120 字之后才分叉),
 * 而本工具的孪生标记会把那条从"可认领"里**摘掉** —— 误判的代价是藏掉一件真活。
 * 要复现这个陷阱:把 `bodyOf` 里的 `row.full || row.text` 改成 `row.text`,孪生数当场涨一批
 * (本票第一版就是这样,靠"逐对眼检"才发现多出来的是不同任务)。
 * @param {string} content - PROJECT_PLAN.md 文件内容
 * @returns {{ unclaimed: Array<{line:number,text:string,full:string}>, inProgress: Array<{}>, completed: Array<{}> }}
 */
function scanTasks(content) {
  const lines = content.split('\n')
  const unclaimed = []
  const inProgress = []
  const completed = []

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart()
    // 每条规则各推一类:顺序即优先级(进行中必须先于"无人认领"判,否则会被后一条通吃)。
    const kinds = [
      [/^- \[x\]\s*/, completed],
      [/^- \[ \]（进行中）\s*/, inProgress],
      [/^- \[ \]\s*/, unclaimed],
    ]
    for (const [re, arr] of kinds) {
      if (!re.test(trimmed)) continue
      arr.push({ line: i + 1, text: trimmed.replace(re, '').slice(0, 120), full: trimmed })
      break
    }
  }

  return { unclaimed, inProgress, completed }
}

/**
 * 剥掉行首的认领标记与"已完成"注解,得到可比的**正文骨架**。
 * 必须先剥:翻勾的仓库写法是「改前缀 + 追加证据」(`- [ ] X` → `- [x] ✅(日期) X,取证…`),
 * 不剥前缀时两条同文的行开头就分叉,相似度被凭空拉低 ⇒ 孪生漏判。
 */
function bodyOf(row) {
  return (row.full || row.text)
    .replace(/^- \[[ xX]\]\s*/, '')
    .replace(/^（进行中）\s*/, '')
    .replace(/^✅\s*(（[^）]*）|\([^)]*\))?\s*/, '')
    .trim()
}

/**
 * 揪出"内容已经有一条 `[x]` 近亲"的未勾行。
 *
 * 为什么必须有(2026-09-25 实测):三态分类只看行首,而 §1 的翻勾写法会在同文件留下
 * **改写前的旧副本**(并集合并也会),于是 `- [ ]` 与 `- [x] ✅…同文…` 并存 ——
 * 派活的人(以及照清单行事的 agent)把已闭环的项当成"无人认领"接着做。本会话就被
 * 「另有 7 个脚本的 --self-test 仍走 os.tmpdir()」那一对带偏过一次。
 *
 * 尺子一律复用 `scripts/lib/live-doc-similarity.mjs` 的导出(字符二元组 Jaccard + `SIM_THRESHOLD`
 * + 容器下界 `CONTAIN_MIN`),**不在这里再抄一份** —— 两处算同一个相似度,迟早分叉成
 * "一边判孪生、一边判真丢失"。
 * 第二条通道是**包含**:未勾行骨架被 `[x]` 行逐字包住(对方只是追加了取证),
 * 这种形态 Jaccard 会随追加长度单调掉到阈值以下,只靠阈值就会漏。
 * 下界 CONTAIN_MIN 个非空白字符:再短的裸标记行在满屏清单里必然互含,会把无关项判成孪生。
 */
function findClosedTwins(rows, completed) {
  const doneBodies = completed.map((c) => ({
    line: c.line,
    body: bodyOf(c),
    sq: squash(bodyOf(c)),
  }))
  const twins = []
  for (const r of rows) {
    const body = bodyOf(r)
    if (squash(body).length < CONTAIN_MIN) continue
    const tb = tokenize(body)
    let best = null
    for (const d of doneBodies) {
      const score = jaccard(tb, tokenize(d.body))
      const contained = d.sq.includes(squash(body))
      if (score < SIM_THRESHOLD && !contained) continue
      const eff = Math.max(score, contained ? 1 : 0)
      if (!best || eff > best.score) {
        best = {
          line: d.line,
          score,
          via: score >= SIM_THRESHOLD ? (contained ? 'both' : 'jaccard') : 'contain',
        }
      }
    }
    if (best)
      twins.push({
        line: r.line,
        text: r.text.slice(0, 120),
        twinLine: best.line,
        score: best.score,
        via: best.via,
      })
  }
  return twins
}

/**
 * 同一件事被写了好几遍的**未勾**行(与上面的"已闭环孪生"是两种形态):三条一模一样的
 * `- [ ]（进行中）` 会被数成三件活。这里只按**正文骨架逐字相同**归组,不做模糊匹配 ——
 * 误判成本是把两件活并成一件,所以宁可只认逐字相同。
 */
function findDuplicateGroups(rows) {
  const byKey = new Map()
  for (const r of rows) {
    const key = squash(bodyOf(r))
    if (key.length < CONTAIN_MIN) continue
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(r.line)
  }
  return [...byKey.entries()].filter(([, ls]) => ls.length > 1).map(([, ls]) => ls)
}

function main() {
  const args = process.argv.slice(2)
  const content = readFileSync(PLAN_PATH, 'utf-8')
  const { unclaimed, inProgress, completed } = scanTasks(content)
  const twins = findClosedTwins([...unclaimed, ...inProgress], completed)
  const twinLines = new Set(twins.map((t) => t.line))
  const claimable = unclaimed.filter((t) => !twinLines.has(t.line))
  const dupGroups = findDuplicateGroups([...unclaimed, ...inProgress])
  const dupExtra = dupGroups.reduce((n, g) => n + g.length - 1, 0)

  if (args.includes('--twins')) {
    console.log(`已闭环 [x] 行的未勾孪生旧行 (${twins.length} 条) —— 接了就是白干:`)
    for (const t of twins) {
      console.log(
        `  L${t.line} ↔ 已勾 L${t.twinLine}  (${t.via}${t.via === 'jaccard' || t.via === 'both' ? ` ${t.score.toFixed(2)}` : ''}) ${t.text}`,
      )
    }
    console.log(
      `\n逐字重复的未勾行组 (${dupGroups.length} 组,多出 ${dupExtra} 条) —— 会把一件事数成多件:`,
    )
    for (const g of dupGroups) console.log(`  ${g.map((l) => `L${l}`).join(' = ')}`)
    return
  }

  if (args.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          unclaimed,
          inProgress,
          completed,
          closedTwins: twins,
          duplicateGroups: dupGroups,
          totals: {
            unclaimed: unclaimed.length,
            inProgress: inProgress.length,
            completed: completed.length,
            closedTwins: twins.length,
            duplicateExtra: dupExtra,
            claimable: claimable.length,
          },
        },
        null,
        2,
      ),
    )
    return
  }

  if (args.includes('--unclaimed')) {
    console.log(
      `无人认领任务 (${claimable.length};另有 ${unclaimed.length - claimable.length} 条是已闭环行的孪生旧行,见 --twins):`,
    )
    for (const t of claimable) console.log(`  L${t.line}: ${t.text}`)
    return
  }

  if (args.includes('--in-progress')) {
    console.log(`进行中任务 (${inProgress.length}):`)
    for (const t of inProgress) console.log(`  L${t.line}: ${t.text}`)
    return
  }

  // 默认: 汇总
  console.log('='.repeat(60))
  console.log('  PROJECT_PLAN.md 任务认领状态')
  console.log('='.repeat(60))
  console.log()
  console.log(
    `  无人认领:  ${unclaimed.length}(其中 ${unclaimed.length - claimable.length} 条是已闭环 [x] 行的孪生旧行 ⇒ **可认领 ${claimable.length}**;逐字重复组 ${dupGroups.length})`,
  )
  console.log(`  进行中:    ${inProgress.length}`)
  console.log(`  已完成:    ${completed.length}`)
  console.log(`  合计:      ${unclaimed.length + inProgress.length + completed.length}`)
  if (twins.length || dupGroups.length) {
    console.log('  ⚠️ 按行首分类会把"翻勾后留下的旧副本"当成一件活 —— 派单前先跑 --twins 看一眼,')
    console.log(
      '     否则已闭环的项会被重复认领(2026-09-25 实测:未认领 115 条里 22 条有已勾近亲)。',
    )
  }
  console.log()

  if (inProgress.length > 0) {
    console.log('─ 进行中 ─')
    for (const t of inProgress) console.log(`  L${t.line}: ${t.text}`)
    console.log()
  }

  if (unclaimed.length > 0 && unclaimed.length <= 30) {
    console.log('─ 无人认领 ─')
    for (const t of unclaimed) console.log(`  L${t.line}: ${t.text}`)
    console.log()
  } else if (unclaimed.length > 30) {
    console.log(`─ 无人认领 (${unclaimed.length} 项,前 15) ─`)
    for (const t of unclaimed.slice(0, 15)) console.log(`  L${t.line}: ${t.text}`)
    console.log(`  ... 还有 ${unclaimed.length - 15} 项`)
    console.log()
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
}

export const __test__ = { scanTasks, findClosedTwins, findDuplicateGroups, bodyOf }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
