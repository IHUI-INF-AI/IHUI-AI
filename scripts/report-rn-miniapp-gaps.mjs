// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出账本 */
// RN→小程序 镜像缺口派单账本(只读,不进提交链)
//
// 回答一个问题:"RN 共享屏里,还有哪些在小程序端没有镜像页?"——并把每个缺口配上
// 名字最接近的 RN 端内屏/小程序既有页作为线索(仅建议,不判定)。
//
// 判定权与"已镜像"的判据全部复用 check-cross-end-screen-coverage 的 __test__(§0.6 单一真相源,
// 本文件零复算):mirored = 该门认定的"共享屏被小程序显式镜像"集合,gaps = 其余。
//
// 取材面:默认 HEAD blob;--worktree 仅人工逃生舱。取不到面 ⇒ exit 2「未判定」。
//
// 用法:
//   node scripts/report-rn-miniapp-gaps.mjs                 # 打印账本(不写盘)
//   node scripts/report-rn-miniapp-gaps.mjs --write <file>  # 写入 markdown
//   node scripts/report-rn-miniapp-gaps.mjs --json
import { dirname, resolve } from 'node:path'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'
// 判定台账(单源 lib):读"这一格验过没有",把已判定与未判定分开(§0.6)。
import { indexVerdicts, readVerdicts } from './lib/cross-end-verdicts.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const face = argv.includes('--worktree') ? 'worktree' : 'head'
const jsonMode = argv.includes('--json')
const writeArg = argv.indexOf('--write')
const writePath = writeArg >= 0 ? argv[writeArg + 1] : null

const STOP = new Set(['app', 'index', 'page', 'screen', 'main', 'web', 'pkg', 'pages'])
const tokensOf = (s) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_/-]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t && !STOP.has(t))

const shared = cov.collectShared(face)
const rn = cov.collectRn(face)
const mp = cov.collectMiniapp(face)
if (shared.length === 0 || mp.length === 0) {
  console.error(`❌ 未判定:取不到被审面(共享屏 ${shared.length} / 小程序页 ${mp.length})`)
  process.exit(2)
}

// 已镜像集合 —— **直接用门 128 的同一把尺子**(cov.mirroredSpecs),本文件零复算(§0.6)。
// 为什么删掉本文件原先自己抄的那份 MARK_RE:两处正则必然漂移(标记行形态一变,这里就静默失明,
// 而门 128 仍绿 ⇒ 缺口账本与守门尺对不上账)。单源化之后,标记形态的改动只需改门 128 一处。
const mirrored = new Set()
for (const p of mp) {
  for (const spec of cov.mirroredSpecs(p)) mirrored.add(spec)
}

// 判定台账:把"验过但没落地代码"的两档(missing / not-applicable)从"未判定"里剥出来。
// 不剥的后果是:缺口账本把已判定为"缺页"的屏继续列成待办,下轮又重判一遍 ——
// 人力被反复消耗在已结论的格子上,而真正没验过的格子被淹没(§0.3「没判不写成判过」的反面)。
const verdictRows = readVerdicts(face, ROOT)
const verdicts = indexVerdicts(verdictRows.rows)

const gaps = shared.filter((s) => !mirrored.has(s.spec))
const rows = gaps.map((s) => {
  const st = tokensOf(s.name)
  const rnCands = rn
    .map((r) => {
      const rt = tokensOf(r.name)
      const hit = st.filter((t) => rt.includes(t))
      return { name: r.name, hit: hit.length, exact: hit.length === st.length && st.length > 0 }
    })
    .filter((c) => c.hit > 0)
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.hit - a.hit)
    .slice(0, 2)
  const mpCands = mp
    .filter((p) => p.file)
    .map((p) => {
      const pt = tokensOf(p.route)
      const hit = st.filter((t) => pt.includes(t))
      return { route: p.route, hit: hit.length }
    })
    .filter((c) => c.hit > 0)
    .sort((a, b) => b.hit - a.hit)
    .slice(0, 2)
  const v = verdicts.get(s.spec)
  return {
    shared: s.spec,
    domain: s.domain,
    name: s.name,
    rn: rnCands,
    mp: mpCands,
    verdict: v ? v.verdict : null,
    evidence: v ? v.evidence || '' : '',
  }
})

const stats = {
  face,
  sharedTotal: shared.length,
  mirrored: mirrored.size,
  gaps: gaps.length,
  // 已判定与未判定分列 —— 这两个数必须分开,合在一起就分不清
  // "没人看过"和"看过且结论是不该有"。前者要派单,后者不必再派。
  verdicted: rows.filter((r) => r.verdict).length,
  undetermined: rows.filter((r) => !r.verdict).length,
  verdictLedgerRows: verdictRows.rows.length,
  verdictLedgerBad: verdictRows.bad.length,
  // 台账三档分布(全表,不止缺口集):
  //   missing = 判过、该造页、尚未造;not-applicable = 判过、不该由小程序承载;
  //   generated = **已造页**(声明链+路由+五语词包已落),但数据钩子/交互待补。
  // generated 这一档单列的原因:它的屏**已被计入覆盖率**,但功能还没跟上 ——
  // 不单列就等于让覆盖率读数替功能缺口背书(§0.3「造好没装车 = 没有」)。
  ledgerMissing: verdictRows.rows.filter((r) => r.verdict === 'missing').length,
  ledgerGenerated: verdictRows.rows.filter((r) => r.verdict === 'generated').length,
  ledgerNotApplicable: verdictRows.rows.filter((r) => r.verdict === 'not-applicable').length,
}

/** 待补数据钩子的工作单:已造页但功能未跟上的屏(不在缺口集里,单列成一张单) */
const pendingHooks = verdictRows.rows.filter((r) => r.verdict === 'generated')

if (jsonMode) {
  console.log(JSON.stringify({ stats, rows, pendingHooks }, null, 1))
  process.exit(0)
}

const lines = []
lines.push('# RN → 小程序 镜像缺口账本(自动生成)')
lines.push('')
lines.push(`> 判据:与 [check-cross-end-screen-coverage.mjs](../scripts/check-cross-end-screen-coverage.mjs) 同一实现(共享屏被小程序页显式镜像的集合);`)
lines.push(`> 生成命令:\`node scripts/report-rn-miniapp-gaps.mjs --write docs/engineering/rn-miniapp-parity-matrix.md\`。`)
lines.push('> 候选列只是名字 token 线索(不判定),落地时须按该屏实际字段/接口核实。')
lines.push('')
lines.push(`- 判定面: **${face === 'head' ? 'HEAD blob' : '工作树(人工)'}**`)
lines.push(`- 共享屏(真相源): **${stats.sharedTotal}**`)
lines.push(`- 已被小程序显式镜像: **${stats.mirrored}**`)
lines.push(`- 缺口合计: **${stats.gaps}**(其中已判定 ${stats.verdicted} / 未判定 ${stats.undetermined})`)
lines.push(
  `- 判定台账: **${stats.verdictLedgerRows}** 行` +
    (stats.verdictLedgerBad ? `(坏行 ${stats.verdictLedgerBad} 行,已单列不静默丢)` : '') +
    ` — 路径与口径单源 \`scripts/lib/cross-end-verdicts.mjs\``,
)
lines.push(
  `- 台账三档: **缺页待造 ${stats.ledgerMissing}** / **已造页待补数据钩子 ${stats.ledgerGenerated}** / **不承载 ${stats.ledgerNotApplicable}**`,
)
if (stats.ledgerGenerated > 0) {
  lines.push(
    `> ⚠ 已造页 ${stats.ledgerGenerated} 条**已计入上面的覆盖率**,但数据钩子/交互尚未按共享屏补齐 ⇒ ` +
      `覆盖率不等于功能对齐(§0.3「造好没装车 = 没有」);待补清单见文末「已造页·待补数据钩子」单。`,
  )
}
lines.push('')
lines.push('## 缺口清单')
lines.push('')
lines.push('| # | 共享屏(域) | RN 候选屏 | 小程序既有页线索 | 状态 | 判定依据 |')
lines.push('|---|---|---|---|---|---|')
rows.forEach((r, i) => {
  const rnTxt = r.rn.length ? r.rn.map((c) => `${c.exact ? '★' : ''}${c.name}`).join(' / ') : '—'
  const mpTxt = r.mp.length ? r.mp.map((c) => c.route).join(' / ') : '—'
  // 状态四态:未判定(没人验过)/ 缺页(验过,确实没有,待造页)/ 不承载(验过,不该由小程序承载)
  //          / 已造页(已落声明链,功能钩子待补 —— 已计入覆盖率,故不在本表)
  const state =
    r.verdict === 'missing'
      ? '🧱 缺页(已判定)'
      : r.verdict === 'not-applicable'
        ? '🚫 不承载(已判定)'
        : r.verdict === 'generated'
          ? '🏗 已造页(功能待补)'
          : '🔲 未判定'
  lines.push(`| ${i + 1} | \`${r.domain}/${r.name}\` | ${rnTxt} | ${mpTxt} | ${state} | ${r.evidence || '—'} |`)
})
lines.push('')
lines.push(`> 合计 ${rows.length} 条;标 ★ 的是名字完全匹配(仍需核实功能对应)。`)
lines.push(
  `> 状态列口径:**🔲 未判定** = 没人验过,需派单取证;**🧱 缺页** = 已验过且小程序端确实没有对应页(应造页);**🚫 不承载** = 已验过且该屏本就不该由小程序承载(不造页);**🏗 已造页** = 页已按声明链造出,数据钩子待补。`,
)
if (pendingHooks.length > 0) {
  lines.push('')
  lines.push('## 已造页 · 待补数据钩子(已计入覆盖率,功能尚未跟上)')
  lines.push('')
  lines.push('| # | 共享屏 | 判定依据 |')
  lines.push('|---|---|---|')
  pendingHooks.forEach((r, i) => {
    lines.push(`| ${i + 1} | \`${r.shared}\` | ${r.evidence || '—'} |`)
  })
  lines.push('')
  lines.push(`> 共 ${pendingHooks.length} 条;每条都要按对应共享屏补齐取数/交互/跳转,才算功能真对齐。`)
}
const md = lines.join('\n') + '\n'
if (writePath) {
  writeFileSync(resolve(ROOT, writePath), md)
  console.log(`written ${writePath} (${rows.length} gaps)`)
} else {
  console.log(md)
}

export const __test__ = { tokensOf, STOP }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
