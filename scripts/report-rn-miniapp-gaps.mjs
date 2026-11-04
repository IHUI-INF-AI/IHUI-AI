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
//   node scripts/report-rn-miniapp-gaps.mjs --json           # 含 hooks 三桶(closed/blocked/pending)
//
// 2026-11-04:文末「已造页」单按台账 evidence 已显式写出的裁决分桶,不再把全部 generated
// 一律当成「每条都要补齐取数/交互/跳转」。规则与失效方向见 pendingHooks 上方注释。
import { dirname, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
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

/**
 * 停用词:结构词/容器词,不表达业务身份。
 * `hub` 是 2026-10-30 补的 —— 它在本仓指"入口集合页"这一形制(legal-docs-hub / edu-ai-hub /
 * pdf-tools-hub / domain-hub…),任何两个不相干屏都能靠它蹭上候选;实测新落地的
 * `pkg-user/pdf-tools-hub/index` 因此挤进了 `domain-hub/DomainHubScreen` 那一行的候选列
 * (两行原本也全是蹭 hub,并没有真实业务对应)。宁可让那一格空着写「—」,
 * 也不要一个看着像、其实无关的页名 —— 候选列是给下一席看的线索,假线索比没有更贵。
 */
const STOP = new Set(['app', 'index', 'page', 'screen', 'main', 'web', 'pkg', 'pages', 'hub'])
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

// 已镜像集合 —— **与门 237 同用那把宽尺**(cov.mirrorDeclarations,形1∪形2∪形3∪形4),本文件零复算(§0.6)。
// 为什么不是 mirroredSpecs:那是旧硬路径尺(只认形1)。门 2026-10-27「未判定桶收缩」把识别面放宽时,
// 只改了门体一处,账本仍按旧尺数 ⇒ 现读差 2 枚,守门绿而账本自述另一个数(哨兵的 doc-stale 就是这么响的)。
// 两处必须同尺,否则"缺口账本"与"守门读数"永远对不上,而人只信其中一个。
const mirrored = new Set()
const sharedIndex = cov.buildSharedIndex(shared)
for (const p of mp) {
  if (!p.file) continue
  const hay = `${p.text || ''}\n${p.cssText || ''}`
  for (const spec of cov.mirrorDeclarations(hay, sharedIndex).specs) mirrored.add(spec)
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

/** 已造页(verdict=generated)的全量工作单:不在缺口集里,单列成一张单 */
const pendingHooks = verdictRows.rows.filter((r) => r.verdict === 'generated')

/**
 * 2026-11-04 修「97 条假账」(只读报告器,不进提交链):
 * 台账 verdict 词表只有 missing / not-applicable / generated 三档(单源
 * scripts/lib/cross-end-verdicts.mjs 的 VERDICT_KINDS),但逐条 evidence 早已写下裁决结论 ——
 * 现读 97 条里含 `定档 aligned` 的 50 条、`复核后已修复` 的 31 条,另有 `[mobile-only]` /
 * `[blocked-structure]` / `[blocked-api]` 等明确标签。旧实现把**全部** generated 一律列成
 * 「每条都要补齐取数/交互/跳转」⇒ 报告器与自己的台账互相打架:人说功能已对齐,机器天天派单。
 *
 * 这里**不新增判据、不改台账词表、不替人裁决**:只把 evidence 里已显式写出的结论读出来分桶。
 * 任何一条没命中显式标记 ⇒ 一律留在 pending(失效方向是「多报一次」,绝不静默丢缺口)。
 * 分类规则与每桶条数都写进输出,下一席可逐条复核;证据过期应改台账 evidence,不是改这里。
 */
const CLOSED_RE = /定档 aligned[:：]|复核后已修复[:：]|不构成缺口|\[no-change-needed\]/
const BLOCKED_RE = /\[(?:blocked-structure|blocked-api|mobile-only)\]|端内已尽可修|需产品决策/
const hooksBucketOf = (r) => {
  const e = String(r.evidence || '')
  if (CLOSED_RE.test(e)) return 'closed'
  if (BLOCKED_RE.test(e)) return 'blocked'
  return 'pending'
}
const hooks = { closed: [], blocked: [], pending: [] }
for (const r of pendingHooks) hooks[hooksBucketOf(r)].push(r)

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
  // 已造页按台账 evidence 已写明的结论分桶(规则见上方注释);三桶之和恒等于 ledgerGenerated。
  hooksGenerated: pendingHooks.length,
  hooksClosed: hooks.closed.length,
  hooksBlocked: hooks.blocked.length,
  hooksPending: hooks.pending.length,
}

if (jsonMode) {
  console.log(JSON.stringify({ stats, rows, pendingHooks, hooks }, null, 1))
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
  `- 台账三档: **缺页待造 ${stats.ledgerMissing}** / **已造页 ${stats.ledgerGenerated}** / **不承载 ${stats.ledgerNotApplicable}**` +
    ` — 已造页按台账 evidence 分桶:**已闭环 ${stats.hooksClosed}** / **需裁决 ${stats.hooksBlocked}** / **真待补 ${stats.hooksPending}**`,
)
if (stats.ledgerGenerated > 0) {
  lines.push(
    `> ⚠ 已造页 ${stats.ledgerGenerated} 条**已计入上面的覆盖率**。按台账 evidence 的显式裁决:` +
      `已闭环 ${stats.hooksClosed} 条(aligned / 已修复 / 不构成缺口)、` +
      `**需产品/端侧裁决 ${stats.hooksBlocked} 条**、无显式标记的「真待补」${stats.hooksPending} 条(见文末分桶单)。`,
  )
  lines.push(
    `> 「真待补 ${stats.hooksPending}」只说明台账里没有未裁决条目,**不等于三端功能 100% 对齐**:` +
      `${stats.hooksBlocked} 条 blocked 是真实存在的结构/端点缺口,需产品决策后才动得;` +
      `覆盖率本身也不等于功能对齐(§0.3「造好没装车 = 没有」)。` +
      `旧版把全部 ${stats.ledgerGenerated} 条一律派单,是另一种失真,故本单只按台账已写明的结论分桶。`,
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
  lines.push('## 已造页 · 功能对齐分桶(已计入覆盖率)')
  lines.push('')
  lines.push(
    '> 分类依据:台账 `evidence` 里**已显式写出**的裁决前缀(`定档 aligned` / `复核后已修复` / `不构成缺口` / `[no-change-needed]` ⇒ 已闭环;' +
      '`[blocked-*]` / `[mobile-only]` / `端内已尽可修` ⇒ 需裁决)。**未命中任何标记一律留「真待补」**;' +
      '不新增判据、不改 `VERDICT_KINDS`,证据过期请改台账 evidence。',
  )
  const renderBucket = (title, list) => {
    if (!list.length) return
    lines.push('')
    lines.push(`### ${title}(${list.length})`)
    lines.push('')
    lines.push('| # | 共享屏 | 判定依据 |')
    lines.push('|---|---|---|')
    list.forEach((r, i) => {
      lines.push(`| ${i + 1} | \`${r.shared}\` | ${r.evidence || '—'} |`)
    })
  }
  renderBucket('🔴 真待补', hooks.pending)
  renderBucket('🟡 需人工/产品裁决', hooks.blocked)
  lines.push('')
  lines.push(
    `> 合计:已造页 ${pendingHooks.length} 条 = 已闭环 ${hooks.closed.length} + 需裁决 ${hooks.blocked.length} + 真待补 ${hooks.pending.length}。` +
      `只有「真待补」需要按对应共享屏补齐取数/交互/跳转;「已闭环」是台账自己写明的结论,不是本器新判的。`,
  )
}
const md = lines.join('\n') + '\n'
if (writePath) {
  const abs = resolve(ROOT, writePath)
  writeFileSync(abs, md, 'utf8')
  // AGENTS §5c:产出被跟踪文件后由**生成器自己**紧随注入水印。缺这一腿时「重新生成一次」就是把
  // 已有的溯源载荷整片洗掉(实测 2026-10-29:这份账本经一次 --write 后进了未覆盖清单),而覆盖率
  // 门禁又是自愈式的 —— 它会在别的档口替生成器把载荷补回工作区,于是提交链上永远不响,失效形态
  // 是安静(同型的话写在 benchmark-frame-end-matrix.mjs:313 头注里)。
  // 本器正是漂移尺 doc-stale 那一维给出的**唯一出路**,会被人和器物反复跑 ⇒ 根因必须长在这器上。
  execFileSync(process.execPath, [resolve(ROOT, 'scripts', 'watermark.mjs'), 'inject', abs], {
    cwd: ROOT,
    stdio: 'ignore', // §12g:不吃的子进程也必须显式给 stdio,否则本机稳定报 EBUSY
    windowsHide: true,
    timeout: 120000,
  })
  console.log(`written ${writePath} (${rows.length} gaps)`)
} else {
  console.log(md)
}

export const __test__ = { tokensOf, STOP }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
