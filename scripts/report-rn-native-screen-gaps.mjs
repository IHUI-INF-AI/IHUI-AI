#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- CLI 工具,需 console 输出账本 */
/**
 * report-rn-native-screen-gaps.mjs — RN 原生屏→小程序 承载差集报告器(只读,不进提交链)
 *
 * 立因(2026-11-13 实测):本仓既有的跨端对齐器物全部只覆盖**共享屏**
 *   (packages/app/src/features/<d>/<Name>Screen.tsx):
 *   · check-cross-end-screen-coverage.mjs:11 自述只判 `packages/app/src/features` 下的共享屏;
 *   · report-rn-miniapp-gaps.mjs:8 自述回答「RN 共享屏里哪些没镜像」;
 *   · 裁决台账 lib/cross-end-verdicts.mjs 的整屏判决键 `verdictKey` = `row.shared`(共享屏路径),
 *     RN 原生屏不在共享层 ⇒ **结构上进不了台账**。
 *   ⇒ apps/mobile-rn/src/screens/*.tsx 里那批「不在共享层的原生屏」(HEAD 面 84 枚)是否该被
 *     小程序承载,从来没有任何器物量化过 —— 这是三端对齐的一个结构性盲区。本报告器补这一格。
 *
 * 回答一个问题:「RN 注册的原生屏里,哪些在小程序端找不到承载?」并把每条配上三类状态:
 *   · covered      —— 小程序注册页路径有语义对应(非字符串硬比,按 token 匹配)
 *   · not-applicable —— 裁决台账已判「该屏小程序本就不承载」(复用既有 verdict,不新判)
 *   · unjudged     —— 既无承载痕迹也无裁决 ⇒ 真缺口候选,需产品/开发拍板(本器只点名,不判定)
 *
 * §0.6 单一真相源:屏清单/小程序页清单/裁决台账全部复用 check-cross-end-screen-coverage 的
 * `__test__` 与 lib/cross-end-verdicts 的 readVerdicts,本文件零复算、不另写第二套面读取器。
 * token 匹配是**线索启发**(报差集用),不是承载判据 —— 真正的"该不该承载"归裁决台账与产品。
 *
 * 取材面:默认 HEAD blob(与门 237 同源);--worktree 仅人工逃生舱。取不到 ⇒ exit 2 未判定。
 *
 * Usage:
 *   node scripts/report-rn-native-screen-gaps.mjs            # 打印账本
 *   node scripts/report-rn-native-screen-gaps.mjs --json     # 机器可读
 *   node scripts/report-rn-native-screen-gaps.mjs --worktree # 工作树面(人工逃生舱)
 */
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'
import { readVerdicts } from './lib/cross-end-verdicts.mjs'

const argv = process.argv.slice(2)
const face = argv.includes('--worktree') ? 'worktree' : 'head'
const jsonMode = argv.includes('--json')

/** 结构词/容器词,不表达业务身份(与 report-rn-miniapp-gaps 同一停用词口径)。 */
const STOP = new Set(['app', 'index', 'page', 'screen', 'main', 'web', 'pkg', 'pages', 'hub', 'new', 'edit', 'detail', 'list', 'create', 'manager', 'manage'])

/** PascalCase 屏名 → 业务 token 集(剥 Screen 后缀、拆驼峰、去停用词)。 */
export function tokensOf(name) {
  return name
    .replace(/Screen$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .map((s) => s.toLowerCase())
    .filter((s) => s.length > 2 && !STOP.has(s))
}

function run() {
  const rn = cov.collectRn(face)
  const mp = cov.collectMiniapp(face)
  const shared = cov.collectShared(face)
  const sharedNames = new Set(shared.map((s) => s.name))

  // 裁决台账:整屏判决以 shared 为键。RN 原生屏不在共享层 ⇒ 一般无对应行,
  // 但仍按屏名反查一次(若同名共享屏已被判 not-applicable,作为线索带出,不替它下结论)。
  let verdictRows = []
  try {
    // readVerdicts 返回 {text, rows, bad};读不到台账 = 空集,不阻塞差集报告
    verdictRows = readVerdicts(face).rows ?? []
  } catch {
    verdictRows = []
  }
  const naSharedNames = new Set(
    verdictRows.filter((r) => r.verdict === 'not-applicable').map((r) => String(r.shared ?? '')),
  )

  // 小程序页:路径 + 可读正文(用于"承载痕迹"线索)
  const mpPathTexts = mp.map((p) => ({
    route: p.route,
    hay: `${p.route} ${p.text ?? ''}`.toLowerCase(),
  }))

  const rows = []
  for (const s of rn) {
    const base = s.name.replace(/\.tsx$/, '')
    // 共享层有同名 ⇒ 属既有覆盖门的射程,本器不重复报(避免与门 237/gap 报告器双计)
    if (sharedNames.has(base)) continue

    const toks = tokensOf(base)
    // 语义对应线索:小程序注册页路径是否含任一业务 token
    const coveredBy = mpPathTexts
      .filter((p) => toks.some((t) => p.route.toLowerCase().includes(t)))
      .map((p) => p.route)
    const isNA = [...naSharedNames].some((sp) => sp.endsWith(`/${base}.tsx`))

    let state
    if (isNA) state = 'not-applicable'
    else if (coveredBy.length > 0) state = 'covered'
    else state = 'unjudged'

    rows.push({ rn: base, file: s.file, state, coveredBy, tokens: toks })
  }

  const stats = {
    face,
    rnScreensTotal: rn.length,
    sharedLayerScreens: sharedNames.size,
    rnNativeOnly: rows.length,
    covered: rows.filter((r) => r.state === 'covered').length,
    notApplicable: rows.filter((r) => r.state === 'not-applicable').length,
    unjudged: rows.filter((r) => r.state === 'unjudged').length,
  }

  if (jsonMode) {
    console.log(JSON.stringify({ stats, rows }, null, 0))
    return 0
  }

  console.log('🔗 RN 原生屏 → 小程序 承载差集报告器(只读;既有一切对齐器物只覆盖共享屏,本报告补 RN 原生屏这一格)')
  console.log('────────────────────────────────────────────────────────')
  console.log(`判定面        : ${stats.face}`)
  console.log(`RN 屏总数     : ${stats.rnScreensTotal}`)
  console.log(`  共享层同名  : ${stats.sharedLayerScreens}(属门 237 / gap 报告器射程,本器不重复报)`)
  console.log(`  RN 原生独有 : ${stats.rnNativeOnly}(本器射程)`)
  console.log(`    covered         : ${stats.covered}(小程序注册页有语义对应)`)
  console.log(`    not-applicable  : ${stats.notApplicable}(裁决台账已判本就不承载)`)
  console.log(`    unjudged        : ${stats.unjudged}(既无承载痕迹也无裁决 ⇒ 真缺口候选,需拍板)`)

  const unjudged = rows.filter((r) => r.state === 'unjudged').sort((a, b) => a.rn.localeCompare(b.rn))
  if (unjudged.length) {
    console.log('\n—— unjudged(RN 已实现 / 小程序未见承载痕迹 / 台账无裁决)——')
    for (const r of unjudged) {
      console.log(`  · ${r.rn}  [tokens: ${r.tokens.join(',') || '—'}]`)
    }
  }
  console.log('\n> 本报告只点名差集,不判定「该不该承载」;裁决归 scripts/data/miniapp-mirror-verdicts.jsonl 与产品。')
  console.log('> 线索是 token 启发匹配,不是承载判据 —— covered 也可能是同词不同功能,逐条复核请打开两端文件。')
  return 0
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  try {
    process.exit(run())
  } catch (e) {
    console.error(`❌ 未判定: ${e?.message ?? e}(取不到输入不记绿也不冒红,§0.3)`)
    process.exit(2)
  }
}

export const __test__ = { tokensOf, STOP }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
