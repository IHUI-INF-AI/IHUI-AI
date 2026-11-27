#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-cross-end-route-contract.mjs — 全量 Web ↔ RN ↔ 小程序路由契约生成器
 *
 * 目的：把 932 个 Web 功能路由逐条归到唯一承载体，不把「Web 页面数 vs 小程序页数」
 * 直接当缺口。分类口径：
 *   mini-native       Web 路由 → RN 屏 → 共享屏 → 小程序承载页（共享屏壳）
 *   mini-native-own   Web 路由 → RN 屏，小程序用独立手写页/not-applicable 自有页承载，不是共享屏壳
 *   rn-only           Web 路由 → RN 屏，但 RN 屏未登记共享屏/小程序镜像（平台差）
 *   rn-pending        Web 路由已判 pending（真机验收未完成），不冒充 aligned
 *   mini-webview      Web 路由由小程序 WebView 门户承载（平台差，非原生屏）
 *   web-only          Web 独立页（admin/SEO/docs/平台中转等），App/小程序不原生承载
 *   unclassified      无人判过，必须为 0
 *   carrier-gap       RN/共享屏已登记，但承载台账无该共享屏
 *   mini-route-missing 承载台账/登记表指向的小程序路由不在 app.config.ts 生成清单
 *
 * 单一真相源：不重算 Web 路由/RN 映射/小程序页，直接复用
 *   scripts/check-web-rn-screen-parity.mjs 的 collectWebRoutes/loadMap/evaluateMap
 *   scripts/check-cross-end-screen-coverage.mjs 的 collectMiniapp
 *   scripts/data/cross-end-screen-registry.json
 *   scripts/data/web-mp-route-carrier-ledger.jsonl
 *
 * 用法：
 *   node scripts/check-cross-end-route-contract.mjs [--write] [--check] [--json] [--staged|--head]
 * 默认面为 worktree（与当前本地台账一致）；--write 生成
 *   scripts/data/cross-end-route-contract.jsonl
 *   scripts/data/cross-end-route-contract-summary.json
 * 退出码：0 契约闭合；1 契约漂移/存在真缺口；2 输入取不到（未判定）。
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { __test__ as parity } from './check-web-rn-screen-parity.mjs'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..')
const REGISTRY_REL = 'scripts/data/cross-end-screen-registry.json'
const CARRIER_LEDGER_REL = 'scripts/data/web-mp-route-carrier-ledger.jsonl'
const CONTRACT_REL = 'scripts/data/cross-end-route-contract.jsonl'
const SUMMARY_REL = 'scripts/data/cross-end-route-contract-summary.json'
const RN_ONLY_REVIEW_REL = 'scripts/data/cross-end-route-contract-rn-only-review.json'
const MIRROR_VERDICTS_REL = 'scripts/data/miniapp-mirror-verdicts.jsonl'
const MINI_OWN_MANUAL_REL = 'scripts/data/cross-end-mini-own-manual.json'
const MINI_WEBVIEW = 'pages/webview/index'
const MINI_COMMUNITY = 'pages/community/index'

const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const writeMode = argv.includes('--write')
const checkMode = argv.includes('--check')
const face = argv.includes('--staged') ? 'staged' : argv.includes('--head') ? 'head' : 'worktree'

function fail(message) {
  console.error(`[route-contract] 未判定：${message}`)
  process.exit(2)
}

function readFace(rel) {
  try {
    const text = cov.faceRead(face, rel)
    if (typeof text !== 'string') throw new Error(`${rel} 在 ${face} 面读不到`)
    return text
  } catch (e) {
    fail(`${rel} 取不到：${e?.message ?? e}`)
  }
}

function parseJsonl(text, rel) {
  const rows = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line)
      } catch {
        fail(`${rel} 第 ${index + 1} 行不是合法 JSON`)
      }
    })
  if (rows.length === 0) fail(`${rel} 解析为 0 行`)
  return rows
}

function baseRoute(route) {
  return route === '(root)' ? '/' : `/${route}`
}

function routeOfWebPath(path) {
  return path === '/' ? '(root)' : path.replace(/^\/+/, '')
}

function main() {
  const webRoutes = parity.collectWebRoutes(face)
  if (webRoutes.length === 0) fail(`Web 路由在 ${face} 面枚举为 0`)
  const rnScreens = parity.collectRnScreens(face)
  if (rnScreens.length === 0) fail(`RN 屏在 ${face} 面枚举为 0`)
  const miniPages = cov.collectMiniapp(face)
  if (miniPages.length === 0) fail(`小程序页面在 ${face} 面枚举为 0`)

  const evaluated = parity.evaluateMap(webRoutes, parity.loadMap(face), rnScreens, face)
  if (!evaluated || !Array.isArray(evaluated.aligned)) fail('Web↔RN 映射结果取不到')
  if (!(evaluated.portalCarried instanceof Set)) fail('WebView 门户集未判定')
  if (evaluated.unmapped.length > 0) {
    fail(`Web↔RN 映射未闭合（unmapped=${evaluated.unmapped.length}），先修上游门`)
  }

  const registry = JSON.parse(readFace(REGISTRY_REL))
  const registryEntries = Array.isArray(registry?.entries) ? registry.entries : null
  if (!registryEntries || registryEntries.length === 0) fail(`${REGISTRY_REL} 无 entries`)
  const carrierRows = parseJsonl(readFace(CARRIER_LEDGER_REL), CARRIER_LEDGER_REL)

  const miniSet = new Set(miniPages.map((page) => page.route.replace(/^\/+/, '')))
  // 小程序页直接 import @rn-shells/<Screen> 也是真实承载；不能因为没有登记共享屏就判成缺页。
  const miniShellPages = new Map()
  for (const page of miniPages) {
    const shellNames = [...page.text.matchAll(/@rn-shells\/([A-Za-z0-9_]+)/g)].map((m) => m[1])
    for (const name of shellNames) {
      if (!miniShellPages.has(name)) miniShellPages.set(name, [])
      const routes = miniShellPages.get(name)
      if (!routes.includes(page.route)) routes.push(page.route)
    }
  }
  // 小程序手写同功能页也可能真实承载：页头显式声明「对齐目标(RN 共享屏): apps/mobile-rn/src/screens/X.tsx」。
  // 这类页不 import 共享屏，但也不是缺页；单独归 mini-native-own，不冒充共享屏壳。
  const miniOwnPages = new Map()
  for (const page of miniPages) {
    const match = page.text.match(
      /对齐目标\(RN 共享屏\)\s*[:：]\s*apps\/mobile-rn\/src\/screens\/([A-Za-z0-9_]+)\.tsx/,
    )
    if (!match) continue
    const name = match[1]
    if (!miniOwnPages.has(name)) miniOwnPages.set(name, [])
    const routes = miniOwnPages.get(name)
    if (!routes.includes(page.route)) routes.push(page.route)
  }
  const manualOwnByWeb = new Map()
  if (existsSync(join(ROOT, MINI_OWN_MANUAL_REL))) {
    for (const entry of JSON.parse(readFileSync(join(ROOT, MINI_OWN_MANUAL_REL), 'utf8'))) {
      if (!miniSet.has(entry.mini)) {
        fail(`${MINI_OWN_MANUAL_REL} 的 mini 路由不存在：${entry.web} → ${entry.mini}`)
      }
      manualOwnByWeb.set(entry.web, entry)
    }
  }
  const byRn = new Map()
  const byShared = new Map()
  for (const entry of registryEntries) {
    if (entry.rn) byRn.set(entry.rn, entry)
    if (entry.shared) byShared.set(entry.shared, entry)
  }
  const carrierByShared = new Map()
  for (const row of carrierRows) {
    if (!row.shared) continue
    if (carrierByShared.has(row.shared)) {
      // 承载台账按 shared 唯一；重复只可能是坏账，交给上层按 gap 处理
      carrierByShared.set(row.shared, null)
    } else {
      carrierByShared.set(row.shared, row)
    }
  }

  const alignedByWeb = new Map(evaluated.aligned.map((row) => [row.web, row]))
  const pendingByWeb = new Map(evaluated.pendingRows.map((row) => [row.web, row]))
  const excludedByWeb = new Map(evaluated.excluded.map((row) => [row.web, row]))
  const portalSet = evaluated.portalCarried
  const prefixSet = evaluated.prefixExcludedRoutes

  const rows = []
  const gaps = {
    unclassified: [],
    carrierGap: [],
    miniRouteMissing: [],
    portalPageMissing: [],
  }
  const categories = {}

  function add(row) {
    rows.push(row)
    categories[row.category] = (categories[row.category] ?? 0) + 1
    if (row.category === 'unclassified') gaps.unclassified.push(row.web)
    if (row.category === 'carrier-gap') gaps.carrierGap.push(row.web)
    if (row.category === 'mini-route-missing') gaps.miniRouteMissing.push(row.web)
    if (row.category === 'portal-no-mini-page') gaps.portalPageMissing.push(row.web)
  }

  for (const webRoute of webRoutes) {
    const web = webRoute.route
    const webPath = baseRoute(web)
    const aligned = alignedByWeb.get(web)
    const pending = pendingByWeb.get(web)
    const excluded = excludedByWeb.get(web)

    if (aligned) {
      const entry = byRn.get(aligned.rn) ?? byShared.get(aligned.rn)
      if (!entry) {
        const screenName = aligned.rn.split('/').pop()?.replace(/\.tsx$/, '') ?? ''
        const manualOwn = manualOwnByWeb.get(web)
        if (manualOwn) {
          if (manualOwn.rn !== aligned.rn) {
            fail(`${MINI_OWN_MANUAL_REL} 的 RN 屏与映射不一致：${web} → ${manualOwn.rn} ≠ ${aligned.rn}`)
          }
          add({
            web,
            webPath,
            category: 'mini-native-own',
            rn: aligned.rn,
            shared: null,
            mini: [manualOwn.mini],
            reason: `人工复核的小程序手写同功能页：${manualOwn.evidence}`,
          })
          continue
        }
        const directPages =
          miniShellPages.get(screenName) ??
          miniShellPages.get(screenName.replace(/Screen$/, '')) ??
          []
        if (directPages.length > 0) {
          add({
            web,
            webPath,
            category: 'mini-native-direct',
            rn: aligned.rn,
            shared: null,
            mini: directPages,
            reason: '小程序页直接 import @rn-shells/<Screen>；未登记共享屏，但承载真实存在',
          })
          continue
        }
        const ownPages =
          miniOwnPages.get(screenName) ??
          miniOwnPages.get(screenName.replace(/Screen$/, '')) ??
          []
        if (ownPages.length > 0) {
          add({
            web,
            webPath,
            category: 'mini-native-own',
            rn: aligned.rn,
            shared: null,
            mini: ownPages,
            reason: '小程序手写同功能页在页头声明对齐该 RN 屏；未 import 共享屏，但承载真实存在',
          })
          continue
        }
        add({
          web,
          webPath,
          category: 'rn-only',
          rn: aligned.rn,
          shared: null,
          mini: [],
          reason: 'Web↔RN 已对齐，但 RN 屏未登记共享屏/小程序镜像；按平台差异候选处理',
        })
        continue
      }
      const carrier = carrierByShared.get(entry.shared)
      if (!carrier) {
        add({
          web,
          webPath,
          category: 'carrier-gap',
          rn: aligned.rn,
          shared: entry.shared,
          mini: [entry.miniapp].filter(Boolean),
          reason: '共享屏已登记，但 web-mp-route-carrier-ledger 无承载行',
        })
        continue
      }
      const miniRoutes = [...new Set([...(carrier.mpRoutes ?? []), entry.miniapp].filter(Boolean))]
      const missing = miniRoutes.filter((route) => !miniSet.has(route.replace(/^\/+/, '')))
      if (missing.length > 0) {
        add({
          web,
          webPath,
          category: 'mini-route-missing',
          rn: aligned.rn,
          shared: entry.shared,
          mini: miniRoutes,
          reason: `承载路由不在 app.config.ts 生成清单：${missing.join(', ')}`,
        })
        continue
      }
      if (carrier.verdict === 'carried') {
        add({
          web,
          webPath,
          category: 'mini-native',
          rn: aligned.rn,
          shared: entry.shared,
          mini: miniRoutes,
          reason: '共享屏壳承载',
        })
      } else if (carrier.verdict === 'legal-absence') {
        add({
          web,
          webPath,
          category: 'mini-native-own',
          rn: aligned.rn,
          shared: entry.shared,
          mini: miniRoutes,
          reason: '共享屏对小程序 not-applicable，小程序自有页承载',
        })
      } else {
        add({
          web,
          webPath,
          category: 'carrier-gap',
          rn: aligned.rn,
          shared: entry.shared,
          mini: miniRoutes,
          reason: `承载台账 verdict=${carrier.verdict}`,
        })
      }
      continue
    }

    if (pending) {
      const mini = miniSet.has(MINI_COMMUNITY) ? [MINI_COMMUNITY] : []
      add({
        web,
        webPath,
        category: 'rn-pending',
        rn: pending.rn,
        shared: null,
        mini,
        reason: 'RN 薄壳已建但真机/模拟器验收未完成；小程序有手写页时不冒充 aligned',
      })
      continue
    }

    if (portalSet.has(web)) {
      if (!miniSet.has(MINI_WEBVIEW)) {
        add({
          web,
          webPath,
          category: 'portal-no-mini-page',
          rn: null,
          shared: null,
          mini: [],
          reason: `门户表命中但小程序 ${MINI_WEBVIEW} 不在册`,
        })
      } else {
        add({
          web,
          webPath,
          category: 'mini-webview',
          rn: null,
          shared: null,
          mini: [MINI_WEBVIEW],
          reason: 'WebView 门户承载（平台差，不造原生屏）',
        })
      }
      continue
    }

    if (excluded) {
      add({
        web,
        webPath,
        category: 'web-only',
        rn: null,
        shared: null,
        mini: [],
        reason: `Web 独立页（excluded）：${excluded.reason ?? '登记表判过'}`,
      })
      continue
    }

    if (prefixSet.has(web)) {
      add({
        web,
        webPath,
        category: 'web-only',
        rn: null,
        shared: null,
        mini: [],
        reason: 'Web 独立页（段级豁免前缀命中）',
      })
      continue
    }

    add({
      web,
      webPath,
      category: 'unclassified',
      rn: null,
      shared: null,
      mini: [],
      reason: '没有任何承载/门户/豁免判定',
    })
  }

  if (rows.length !== webRoutes.length) {
    fail(`契约行数 ${rows.length} ≠ Web 路由数 ${webRoutes.length}`)
  }

  const totalGaps =
    gaps.unclassified.length +
    gaps.carrierGap.length +
    gaps.miniRouteMissing.length +
    gaps.portalPageMissing.length
  const contractText = `${rows
    .sort((a, b) => a.web.localeCompare(b.web))
    .map((row) => JSON.stringify(row))
    .join('\n')}\n`
  const contractHash = createHash('sha256').update(contractText).digest('hex')

  const rnOnlyRows = rows.filter((row) => row.category === 'rn-only')
  const rnOnlyGroups = new Map()
  for (const row of rnOnlyRows) {
    if (!rnOnlyGroups.has(row.rn)) rnOnlyGroups.set(row.rn, [])
    rnOnlyGroups.get(row.rn).push(row.web)
  }
  const verdictByBase = new Map()
  if (existsSync(join(ROOT, MIRROR_VERDICTS_REL))) {
    for (const line of readFileSync(join(ROOT, MIRROR_VERDICTS_REL), 'utf8').split('\n')) {
      if (!line.trim()) continue
      const verdict = JSON.parse(line)
      const base = basename(verdict.shared ?? '', '.tsx')
      if (!base) continue
      if (!verdictByBase.has(base)) verdictByBase.set(base, [])
      verdictByBase.get(base).push({
        verdict: verdict.verdict,
        route: verdict.route,
        at: verdict.at,
      })
    }
  }
  const rnOnlyScreens = [...rnOnlyGroups.entries()]
    .map(([rn, webs]) => {
      const priorVerdicts = verdictByBase.get(basename(rn, '.tsx')) ?? []
      return {
        rn,
        routes: [...new Set(webs)].sort(),
        priorVerdicts,
        disposition: priorVerdicts.some((verdict) => verdict.verdict === 'not-applicable')
          ? 'decided-not-applicable'
          : 'needs-review',
      }
    })
    .sort((a, b) => a.rn.localeCompare(b.rn))
  const rnOnlyDecided = rnOnlyScreens.filter((screen) => screen.disposition === 'decided-not-applicable').length
  const rnOnlyNeedsReview = rnOnlyScreens.length - rnOnlyDecided
  const rnOnlyReview = {
    note: 'rn-only 逐屏复核清单；这些 Web 路由在 RN 有屏，但既无共享屏登记，也无小程序直接 shell 承载。已有 not-applicable 裁决的屏不重复派单，其余才需产品/端侧裁决补页或接受平台差。',
    totalRoutes: rnOnlyRows.length,
    totalScreens: rnOnlyScreens.length,
    decidedNotApplicable: rnOnlyDecided,
    needsReview: rnOnlyNeedsReview,
    screens: rnOnlyScreens,
  }

  const summary = {
    face,
    webRoutes: webRoutes.length,
    rnScreens: rnScreens.length,
    miniPages: miniPages.length,
    registryEntries: registryEntries.length,
    carrierLedgerRows: carrierRows.length,
    categories,
    gaps: {
      unclassified: gaps.unclassified.length,
      carrierGap: gaps.carrierGap.length,
      miniRouteMissing: gaps.miniRouteMissing.length,
      portalPageMissing: gaps.portalPageMissing.length,
      total: totalGaps,
    },
    gapItems: gaps,
    review: {
      rnOnly: categories['rn-only'] ?? 0,
      rnOnlyScreens: rnOnlyScreens.length,
      rnOnlyDecided: rnOnlyDecided,
      rnOnlyNeedsReview: rnOnlyNeedsReview,
      rnOnlyReview: RN_ONLY_REVIEW_REL,
      rnPending: categories['rn-pending'] ?? 0,
      miniNativeOwn: categories['mini-native-own'] ?? 0,
      miniNativeDirect: categories['mini-native-direct'] ?? 0,
      note: `rn-only 是 RN 有屏但既无共享屏登记、也无小程序直接 shell 承载的按平台差候选；其中已有 not-applicable 裁决的 ${rnOnlyDecided} 屏不重复派单，其余 ${rnOnlyNeedsReview} 屏待产品/端侧复核；rn-pending 是待真机验收；mini-native-direct 是小程序直接 import RN shell 的真实承载；mini-native-own 是页头显式声明对齐 RN 屏的小程序手写页。四者都不冒充共享屏全量承载`,
    },
    contractHash,
    contractRows: rows.length,
    sources: [
      REGISTRY_REL,
      CARRIER_LEDGER_REL,
      'scripts/data/web-rn-screen-map.jsonl',
      MIRROR_VERDICTS_REL,
      MINI_OWN_MANUAL_REL,
      'apps/miniapp-taro/src/app.config.ts',
    ],
  }

  if (writeMode) {
    writeFileSync(join(ROOT, CONTRACT_REL), contractText, 'utf8')
    writeFileSync(join(ROOT, SUMMARY_REL), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
    writeFileSync(join(ROOT, RN_ONLY_REVIEW_REL), `${JSON.stringify(rnOnlyReview, null, 2)}\n`, 'utf8')
  }

  if (checkMode) {
    if (
      !existsSync(join(ROOT, CONTRACT_REL)) ||
      !existsSync(join(ROOT, SUMMARY_REL)) ||
      !existsSync(join(ROOT, RN_ONLY_REVIEW_REL))
    ) {
      console.error('[route-contract] 契约或 rn-only 复核文件不存在，先跑 --write')
      return 1
    }
    const expected = readFileSync(join(ROOT, CONTRACT_REL), 'utf8')
    const expectedSummary = JSON.parse(readFileSync(join(ROOT, SUMMARY_REL), 'utf8'))
    const expectedReview = JSON.parse(readFileSync(join(ROOT, RN_ONLY_REVIEW_REL), 'utf8'))
    const mismatch =
      expected !== contractText ||
      expectedSummary.contractHash !== contractHash ||
      expectedSummary.webRoutes !== summary.webRoutes ||
      expectedSummary.categories['mini-native'] !== summary.categories['mini-native'] ||
      expectedSummary.gaps.total !== summary.gaps.total ||
      JSON.stringify(expectedReview) !== JSON.stringify(rnOnlyReview)
    if (mismatch) {
      console.error('[route-contract] 契约漂移；请 review 后跑 --write 重落')
      return 1
    }
  }

  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  } else {
    console.log(`[route-contract] 面=${face}`)
    console.log(
      `  Web 路由 ${summary.webRoutes} = ${Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${v}`)
        .join(' + ')}`,
    )
    console.log(
      `  承载台账 ${summary.carrierLedgerRows} 行 / 共享屏登记 ${summary.registryEntries} 条 / 小程序页 ${summary.miniPages}`,
    )
    console.log(
      `  真缺口 ${totalGaps}（未分类 ${gaps.unclassified.length} / 承载缺账 ${gaps.carrierGap.length} / 小程序路由不存在的 ${gaps.miniRouteMissing.length} / 门户页缺失 ${gaps.portalPageMissing.length}）`,
    )
    if (totalGaps > 0) {
      for (const [kind, items] of Object.entries(gaps)) {
        if (items.length) console.log(`  · ${kind}: ${items.slice(0, 20).join(', ')}${items.length > 20 ? ' …' : ''}`)
      }
    }
    console.log(totalGaps === 0 ? '[route-contract] PASS' : '[route-contract] FAIL')
  }

  return totalGaps === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    if (String(e?.message || e).includes('未判定')) process.exit(2)
    throw e
  }
}

export const __test__ = {
  baseRoute,
  routeOfWebPath,
  CONTRACT_REL,
  SUMMARY_REL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
