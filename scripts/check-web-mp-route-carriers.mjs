#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出对账报告 */
/**
 * check-web-mp-route-carriers.mjs — web ↔ 小程序「直接路由尺」(共享屏承载列)
 *
 * GATE_ID: 301
 * (门号 301:2026-11-05 按规则分配;编号表登记见 docs/GATEKEEPERS.md 与 guardian-runner)
 *
 * 立因(2026-11-05):`check-cross-end-screen-coverage.mjs` 只从「共享屏」出发,于是
 * 「web 有而小程序无」没有直接度量 —— 只能经共享屏镜像标记链间接推断。本尺补齐一条直连:
 *
 *   web-rn-screen-map.jsonl ──(rn = 共享屏 spec)──▶ 共享屏
 *        共享屏 ──(cross-end-screen-registry.miniapp)──▶ 小程序路由
 *        小程序路由 ──(app.config.ts 在册路由 + 页面正文镜像声明)──▶ 承载/不承载
 *
 * 每个共享屏落一列「小程序承载路由」,读三类缺口 + 一类合法差异:
 *   mp 缺承载                 有 web 承载证据、但 registry 无路由(或路由页不承载该屏)
 *   承载路由在配置里不存在    registry 登记了路由,但 app.config.ts 没这条 / 页面文件缺失
 *   未判定(映射缺失)          registry 无条目、verdict 台账也无裁决 ⇒ 不给 0,逐条点名
 *   合法差异(单独立账)        verdict 台账判过 not-applicable(附证据),不混进缺口
 *
 * 判重:同一 shared 登记 ≥2 条路由 = multi-route-alias(合法别名,单独立账);
 *       同一路由被 ≥2 个 shared 登记 = route-shared(真冲突,判红)。
 *
 * 纪律:
 *   - 不改 `check-cross-end-screen-coverage.mjs` 的分母口径(四套路由分母是另一治理项);
 *     共享屏/小程序路由/镜像声明全部复用它的 `__test__`(§0.6 单一真相源)。
 *   - 只做棘轮 + 台账,不要求一次性补齐;存量落账,新增缺口判红。
 *   - 台账:scripts/data/web-mp-route-carrier-ledger.jsonl(全量承载列,272 行口径)
 *          scripts/data/web-mp-route-carrier-legal.jsonl(合法差异单独立账)
 *
 * 用法:node scripts/check-web-mp-route-carriers.mjs [--json] [--gate] [--staged|--worktree]
 *       node scripts/check-web-mp-route-carriers.mjs --self-test
 *       node scripts/check-web-mp-route-carriers.mjs --write-ledger
 * 退出码:0 无新增缺口 · 1 有新增缺口/新未判定/新合法差异无账 · 2 取不到输入(未判定,§0.3)
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'
import { mergeVerdictRows, parseVerdictRows, serializeVerdicts, verdictKey, readVerdicts } from './lib/cross-end-verdicts.mjs'
import { Undetermined } from './lib/face-reader.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..')

const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const gateMode = argv.includes('--gate')
const selfTest = argv.includes('--self-test')
const writeLedger = argv.includes('--write-ledger')
const stagedMode = argv.includes('--staged')
const worktreeMode = argv.includes('--worktree')
const FACE = stagedMode ? 'staged' : worktreeMode ? 'worktree' : 'head'

const WEB_MAP = 'scripts/data/web-rn-screen-map.jsonl'
const REGISTRY = 'scripts/data/cross-end-screen-registry.json'
const LEDGER = 'scripts/data/web-mp-route-carrier-ledger.jsonl'
const LEGAL_LEDGER = 'scripts/data/web-mp-route-carrier-legal.jsonl'

/** 缺口三桶 + 合法差异 + 承载 */
export const VERDICTS = Object.freeze({
  carried: 'carried',
  missingCarrier: 'mp-missing-carrier',
  routeNotInConfig: 'route-not-in-config',
  undetermined: 'undetermined',
  legalAbsence: 'legal-absence',
})

const VERDICT_LABEL = {
  [VERDICTS.carried]: '承载',
  [VERDICTS.missingCarrier]: 'mp 缺承载',
  [VERDICTS.routeNotInConfig]: '承载路由在配置里不存在',
  [VERDICTS.undetermined]: '未判定(映射缺失)',
  [VERDICTS.legalAbsence]: '合法差异(平台不承载)',
}

/** 台账行键:shared + 判定(路由变化不换档就不算新增) */
function rowKey(shared, verdict) {
  return `${String(shared).replace(/\\/g, '/')}\u0000${verdict}`
}

/** web-rn-screen-map.jsonl:JSONL,坏行不静默丢 */
export function parseWebMap(text) {
  const rows = []
  const bad = []
  for (const line of String(text || '').split('\n')) {
    const s = line.trim()
    if (!s) continue
    try {
      rows.push(JSON.parse(s))
    } catch {
      bad.push({ raw: s.slice(0, 120), why: '非 JSON' })
    }
  }
  return { rows, bad }
}

/** 口径:web 是否承载该共享屏(status=excluded 不算承载) */
function webCarriersOf(webMap, spec) {
  return webMap
    .filter((r) => r && r.rn === spec && r.status !== 'excluded')
    .map((r) => ({ web: r.web ?? '', status: r.status ?? '' }))
}

/**
 * 纯判定核心(可被夹具直接喂入,不读盘)。
 * @param {object} input
 * @param {object[]} input.shared       collectShared 结果
 * @param {object[]} input.registryRows registry 的 entries
 * @param {object[]} input.verdictRows  verdict 台账(not-applicable 才算合法差异)
 * @param {object[]} input.mpPages      collectMiniapp 结果(route/file/text)
 * @param {object[]} input.webMap       web-rn-screen-map 行
 * @returns {{rows:object[], legalRows:object[], readouts:object}}
 */
export function judgeCarriers({ shared, registryRows, verdictRows, mpPages, webMap, at = '2026-11-05' }) {
  const idx = cov.buildSharedIndex(shared)
  const routeIndex = new Map(mpPages.map((p) => [p.route, p]))
  const legalBySpec = new Map()
  const mismatchBySpec = new Map()
  for (const v of verdictRows || []) {
    if (!v) continue
    if (v.verdict === 'not-applicable') legalBySpec.set(v.shared, v)
    // 「声明错配」按 (shared, route) 收:它只撤销那一条声明,不是整屏判决(不折合法差异)。
    if (v.verdict === 'declared-object-mismatch' && typeof v.route === 'string' && v.route && v.route !== '-') {
      if (!mismatchBySpec.has(v.shared)) mismatchBySpec.set(v.shared, new Set())
      mismatchBySpec.get(v.shared).add(v.route)
    }
  }

  // registry 按 shared 归并(同屏多条路由不丢:VipScreen 两条入口别名是既有事实)
  const regBySpec = new Map()
  for (const e of registryRows || []) {
    if (!e || typeof e.shared !== 'string') continue
    if (!regBySpec.has(e.shared)) regBySpec.set(e.shared, [])
    if (e.miniapp) regBySpec.get(e.shared).push(e.miniapp)
  }

  // 判重B:同一路由被 ≥2 个 shared 登记 ⇒ 真冲突
  const routeOwners = new Map()
  for (const [spec, routes] of regBySpec) {
    for (const r of new Set(routes)) {
      if (!routeOwners.has(r)) routeOwners.set(r, [])
      routeOwners.get(r).push(spec)
    }
  }

  const rows = []
  const legalRows = []
  for (const s of shared) {
    const spec = s.spec
    // registry 路由全集先取齐,再按 (shared, route) 剔除被判「声明错配」的那几条:
    // 剔除只作用于这一条声明,绝不让整屏降级为 legal-absence(同屏其他合法承载照旧参与判定)。
    const regRoutesAll = [...new Set(regBySpec.get(spec) || [])].sort()
    const mismatchSet = mismatchBySpec.get(spec) || new Set()
    const mismatchRoutes = regRoutesAll.filter((r) => mismatchSet.has(r))
    const mismatchUnmatched = [...mismatchSet].filter((r) => !regRoutesAll.includes(r))
    const regRoutes = regRoutesAll.filter((r) => !mismatchSet.has(r))
    const allExcludedByMismatch = regRoutesAll.length > 0 && regRoutes.length === 0
    const webRows = webCarriersOf(webMap, spec)
    const pageEvidence = regRoutes.map((route) => {
      const page = routeIndex.get(route)
      if (!page) return { route, status: 'no-config-entry', file: null, mirrored: false }
      if (!page.file) return { route, status: 'no-page-file', file: null, mirrored: false }
      const declaration = cov.mirrorDeclarations(`${page.text || ''}\n${page.cssText || ''}`, idx)
      return { route, status: 'ok', file: page.file, mirrored: declaration.specs.has(spec) }
    })

    const validRoutes = pageEvidence.filter((e) => e.status === 'ok' && e.mirrored)
    const conflictRoutes = regRoutes.filter((r) => (routeOwners.get(r) || []).length > 1)

    let verdict
    let reason
    const legal = legalBySpec.get(spec)
    if (allExcludedByMismatch) {
      // 全部登记路由都被「声明错配」撤销 ⇒ 该屏没有任何可判声明;这既不是绿、也不是合法差异。
      verdict = VERDICTS.undetermined
      reason = `全部登记路由已判 declared-object-mismatch(${mismatchRoutes.join(',')}) ⇒ 该屏无剩余可判声明(不判承载/不判合法差异)`
    } else if (legal) {
      verdict = VERDICTS.legalAbsence
      reason = `verdict 台账判过 not-applicable: ${legal.evidence || '(无证据)'}`
    } else if (regRoutes.length === 0) {
      if (webRows.length > 0) {
        verdict = VERDICTS.missingCarrier
        reason = `web 承载(${webRows.map((w) => w.web || w.status).join(',')})但 registry 无小程序路由`
      } else {
        verdict = VERDICTS.undetermined
        reason = 'registry 无条目且 web-rn 映射无该屏 ⇒ 映射本身缺失(未判定,不折 0)'
      }
    } else if (pageEvidence.some((e) => e.status !== 'ok')) {
      verdict = VERDICTS.routeNotInConfig
      const bads = pageEvidence.filter((e) => e.status !== 'ok')
      reason = `登记路由在配置里不存在: ${bads.map((e) => `${e.route}(${e.status})`).join(',')}`
    } else if (validRoutes.length === 0) {
      verdict = VERDICTS.missingCarrier
      reason = `登记路由 ${regRoutes.join(',')} 在册但页面未声明承载该屏`
    } else {
      verdict = VERDICTS.carried
      reason = `承载路由: ${validRoutes.map((e) => e.route).join(',')}`
    }

    const duplicate =
      conflictRoutes.length > 0 ? 'route-shared' : regRoutes.length > 1 ? 'multi-route-alias' : 'none'

    const row = {
      shared: spec,
      domain: s.domain || '',
      webCarried: webRows.length > 0,
      webRows,
      mpRoutes: regRoutesAll,
      mismatchRoutes,
      mismatchUnmatched,
      routeEvidence: pageEvidence,
      verdict,
      duplicate,
      conflictRoutes,
      owner: 'scripts/check-web-mp-route-carriers.mjs',
      reason,
      at,
    }
    rows.push(row)
    if (verdict === VERDICTS.legalAbsence || duplicate === 'multi-route-alias') {
      legalRows.push({
        shared: spec,
        legalKind: verdict === VERDICTS.legalAbsence ? 'platform-does-not-carry' : 'multi-route-alias',
        mpRoutes: regRoutes,
        owner: 'scripts/check-web-mp-route-carriers.mjs',
        reason:
          verdict === VERDICTS.legalAbsence
            ? reason
            : `同一共享屏登记多条入口路由(${regRoutes.join(',')}),均为合法入口别名`,
        at,
      })
    }
  }

  const readouts = {
    shared: rows.length,
    carried: rows.filter((r) => r.verdict === VERDICTS.carried).length,
    missingCarrier: rows.filter((r) => r.verdict === VERDICTS.missingCarrier),
    routeNotInConfig: rows.filter((r) => r.verdict === VERDICTS.routeNotInConfig),
    undetermined: rows.filter((r) => r.verdict === VERDICTS.undetermined),
    legalAbsence: rows.filter((r) => r.verdict === VERDICTS.legalAbsence),
    duplicateAlias: rows.filter((r) => r.duplicate === 'multi-route-alias'),
    duplicateConflict: rows.filter((r) => r.duplicate === 'route-shared'),
    // 被「声明错配」剔除的登记路由总条数(逐条可见:行内 mismatchRoutes)。
    mismatchIgnored: rows.reduce((n, r) => n + (r.mismatchRoutes?.length || 0), 0),
    // 声明了 mismatch 但路由不在该屏 registry 里的条数(拼错路由不得静默无声 —— 不算剔除,只点名)。
    mismatchUnmatched: rows.reduce((n, r) => n + ((r.mismatchUnmatched || []).length), 0),
  }
  return { rows, legalRows, readouts }
}

/** 全量台账序列化(键序固定,diff 只随内容变) */
export function serializeRows(rows) {
  return rows
    .map((r) =>
      JSON.stringify({
        shared: r.shared,
        domain: r.domain,
        webCarried: r.webCarried,
        webRows: r.webRows,
        mpRoutes: r.mpRoutes,
        mismatchRoutes: r.mismatchRoutes || [],
        mismatchUnmatched: r.mismatchUnmatched || [],
        routeEvidence: r.routeEvidence,
        verdict: r.verdict,
        duplicate: r.duplicate,
        conflictRoutes: r.conflictRoutes,
        owner: r.owner,
        reason: r.reason,
        at: r.at,
      }),
    )
    .join('\n')
}

export function serializeLegalRows(rows) {
  return rows
    .map((r) =>
      JSON.stringify({
        shared: r.shared,
        legalKind: r.legalKind,
        mpRoutes: r.mpRoutes,
        owner: r.owner,
        reason: r.reason,
        at: r.at,
      }),
    )
    .join('\n')
}

/** 解析台账;坏行拒收(§0.3) */
export function parseLedger(text) {
  const rows = []
  const bad = []
  for (const line of String(text || '').split('\n')) {
    const s = line.trim()
    if (!s) continue
    try {
      const o = JSON.parse(s)
      if (!o || typeof o.shared !== 'string' || typeof o.verdict !== 'string')
        bad.push({ raw: s.slice(0, 120), why: '缺 shared/verdict' })
      else rows.push(o)
    } catch {
      bad.push({ raw: s.slice(0, 120), why: '非 JSON' })
    }
  }
  return { rows, bad }
}

/** 合法差异台账解析(键 = shared + legalKind) */
export function parseLegalLedger(text) {
  const rows = []
  const bad = []
  for (const line of String(text || '').split('\n')) {
    const s = line.trim()
    if (!s) continue
    try {
      const o = JSON.parse(s)
      if (!o || typeof o.shared !== 'string' || typeof o.legalKind !== 'string')
        bad.push({ raw: s.slice(0, 120), why: '缺 shared/legalKind' })
      else rows.push(o)
    } catch {
      bad.push({ raw: s.slice(0, 120), why: '非 JSON' })
    }
  }
  return { rows, bad }
}

/**
 * 棘轮:本次缺口/未判定/合法差异不得多于台账存量。
 * @returns {{newRows:object[], newLegal:object[], improved:object[]}}
 */
export function judgeCarrierRatchet(readouts, baselineRows, baselineLegalRows) {
  const want = new Map()
  for (const r of baselineRows || []) want.set(rowKey(r.shared, r.verdict), (want.get(rowKey(r.shared, r.verdict)) || 0) + 1)
  const legalWant = new Set((baselineLegalRows || []).map((r) => String(r.shared).replace(/\\/g, '/')))

  const current = [
    ...readouts.missingCarrier,
    ...readouts.routeNotInConfig,
    ...readouts.undetermined,
    ...readouts.duplicateConflict.map((r) => ({ ...r, verdict: VERDICTS.missingCarrier, _conflict: true })),
  ]
  const newRows = current.filter((r) => {
    const k = rowKey(r.shared, r.verdict)
    if (!want.has(k)) return true
    const n = (want.get(`${k}\u0000n`) || 0) + 1
    want.set(`${k}\u0000n`, n)
    return n > (want.get(k) || 0)
  })
  const newLegal = (readouts.legalAbsence || []).filter(
    (r) => !legalWant.has(String(r.shared).replace(/\\/g, '/')),
  )
  const improved = [...want.entries()]
    .filter(([k]) => !k.endsWith('\u0000n'))
    .filter(([k, n]) => n - (want.get(`${k}\u0000n`) || 0) > 0)
    .map(([k, n]) => ({ key: k, removed: n - (want.get(`${k}\u0000n`) || 0) }))
  return { newRows, newLegal, improved }
}

/* ============================================================================
 * 自检:纯函数夹具(不读盘)
 * ============================================================================ */

function selfTestFn() {
  const SHARED = cov.SHARED_DIR
  const shared = [
    { spec: `${SHARED}/demo/DemoScreen.tsx`, domain: 'demo', name: 'DemoScreen' },
    { spec: `${SHARED}/gone/GoneScreen.tsx`, domain: 'gone', name: 'GoneScreen' },
    { spec: `${SHARED}/und/UndScreen.tsx`, domain: 'und', name: 'UndScreen' },
    { spec: `${SHARED}/legal/LegalScreen.tsx`, domain: 'legal', name: 'LegalScreen' },
    { spec: `${SHARED}/vip/VipScreen.tsx`, domain: 'vip', name: 'VipScreen' },
  ]
  const mirrorText = (name) => `/* 对齐 RN Shared${name}(packages/app/src/features/x):dp × 2 = rpx */`
  const mpPages = [
    { route: 'pages/demo/demo', file: 'apps/miniapp-taro/src/pages/demo/demo.tsx', text: mirrorText('DemoScreen'), cssText: '' },
    { route: 'pages/gone/gone', file: 'apps/miniapp-taro/src/pages/gone/gone.tsx', text: 'export default {}', cssText: '' },
    { route: 'pkg-vip/a/index', file: 'apps/miniapp-taro/src/pkg-vip/a/index.tsx', text: mirrorText('VipScreen'), cssText: '' },
    { route: 'pkg-vip/b/index', file: 'apps/miniapp-taro/src/pkg-vip/b/index.tsx', text: mirrorText('VipScreen'), cssText: '' },
  ]
  const registryRows = [
    { shared: `${SHARED}/demo/DemoScreen.tsx`, miniapp: 'pages/demo/demo' },
    { shared: `${SHARED}/gone/GoneScreen.tsx`, miniapp: 'pages/ghost/ghost' },
    { shared: `${SHARED}/vip/VipScreen.tsx`, miniapp: 'pkg-vip/a/index' },
    { shared: `${SHARED}/vip/VipScreen.tsx`, miniapp: 'pkg-vip/b/index' },
  ]
  const verdictRows = [
    { shared: `${SHARED}/legal/LegalScreen.tsx`, verdict: 'not-applicable', evidence: 'apps/web/x.tsx:10 平台不承载' },
  ]
  const webMap = [
    { web: '/demo', rn: `${SHARED}/demo/DemoScreen.tsx`, status: 'aligned' },
    { web: '/gone', rn: `${SHARED}/gone/GoneScreen.tsx`, status: 'aligned' },
    { web: '/legal', rn: `${SHARED}/legal/LegalScreen.tsx`, status: 'aligned' },
  ]

  const cases = []
  const push = (name, pass, got) => cases.push({ name, pass, got })

  // 正例:路由在册 + 页面声明承载 ⇒ carried
  const base = judgeCarriers({ shared, registryRows, verdictRows, mpPages, webMap })
  const demo = base.rows.find((r) => r.shared === `${SHARED}/demo/DemoScreen.tsx`)
  push('正例 承载', demo?.verdict === VERDICTS.carried, demo?.verdict)

  // 反例①:登记路由在配置里不存在 ⇒ route-not-in-config
  const gone = base.rows.find((r) => r.shared === `${SHARED}/gone/GoneScreen.tsx`)
  push('反例 路由不存在', gone?.verdict === VERDICTS.routeNotInConfig, gone?.verdict)

  // 反例②:registry 无条目但 web 承载 ⇒ mp 缺承载(真缺口)
  const noReg = judgeCarriers({
    shared: [shared[0]],
    registryRows: [],
    verdictRows: [],
    mpPages: [],
    webMap: [webMap[0]],
  })
  push('反例 web 有而小程序无', noReg.rows[0]?.verdict === VERDICTS.missingCarrier, noReg.rows[0]?.verdict)

  // 未判定:registry 无条目 + web 映射也没有 ⇒ 不许折 0
  const und = base.rows.find((r) => r.shared === `${SHARED}/und/UndScreen.tsx`)
  push('未判定 映射缺失', und?.verdict === VERDICTS.undetermined, und?.verdict)

  // 合法差异:not-applicable 单独立账,不混进缺口
  const legal = base.rows.find((r) => r.shared === `${SHARED}/legal/LegalScreen.tsx`)
  push('合法差异 不混缺口', legal?.verdict === VERDICTS.legalAbsence, legal?.verdict)
  push(
    '合法差异 单独行',
    base.legalRows.some((r) => r.shared === legal.shared && r.legalKind === 'platform-does-not-carry'),
    base.legalRows.length,
  )

  // 判重:同屏两条路由 = 合法别名,单独立账
  push('判重 多路入口别名', base.readouts.duplicateAlias.length === 1, base.readouts.duplicateAlias.length)
  const dupReg = judgeCarriers({
    shared: [
      { spec: `${SHARED}/a/AScreen.tsx`, domain: 'a', name: 'AScreen' },
      { spec: `${SHARED}/b/BScreen.tsx`, domain: 'b', name: 'BScreen' },
    ],
    registryRows: [
      { shared: `${SHARED}/a/AScreen.tsx`, miniapp: 'pages/x/x' },
      { shared: `${SHARED}/b/BScreen.tsx`, miniapp: 'pages/x/x' },
    ],
    verdictRows: [],
    mpPages: [{ route: 'pages/x/x', file: 'apps/miniapp-taro/src/pages/x/x.tsx', text: '', cssText: '' }],
    webMap: [],
  })
  push('判重 一槽多账冲突', dupReg.readouts.duplicateConflict.length === 2, dupReg.readouts.duplicateConflict.length)

  // 棘轮:台账无账 ⇒ 红;台账有账 ⇒ 绿;合法差异无账 ⇒ 红
  const empty = judgeCarrierRatchet(base.readouts, [], [])
  push('棘轮 新缺口无账判红', empty.newRows.length >= 2, empty.newRows.length)
  const recorded = judgeCarrierRatchet(
    base.readouts,
    base.rows.map((r) => ({ shared: r.shared, verdict: r.verdict })),
    base.legalRows,
  )
  push('棘轮 全量台账在位 ⇒ 不红', recorded.newRows.length === 0 && recorded.newLegal.length === 0, `${recorded.newRows.length}/${recorded.newLegal.length}`)
  const noLegal = judgeCarrierRatchet(base.readouts, base.rows.map((r) => ({ shared: r.shared, verdict: r.verdict })), [])
  push('棘轮 新合法差异无账判红', noLegal.newLegal.length === 1, noLegal.newLegal.length)

  // ---- 「声明错配」(declared-object-mismatch):只撤销一条 (shared, route) 声明 ----
  const MISM = `${SHARED}/mism/MismScreen.tsx`
  const mismShared = [{ spec: MISM, domain: 'mism', name: 'MismScreen' }]
  const mismRegistry = [
    { shared: MISM, miniapp: 'pkg-mism/a/index' },
    { shared: MISM, miniapp: 'pkg-mism/b/index' },
  ]
  const mismEvidence = (route) => `apps/miniapp-taro/src/${route}.tsx:7 页面实为另一业务对象`
  const mismatchA = {
    shared: MISM,
    route: 'pkg-mism/a/index',
    verdict: 'declared-object-mismatch',
    evidence: mismEvidence('pkg-mism/a/index'),
  }
  const mismatchB = {
    shared: MISM,
    route: 'pkg-mism/b/index',
    verdict: 'declared-object-mismatch',
    evidence: mismEvidence('pkg-mism/b/index'),
  }
  const mismPagesOne = [
    { route: 'pkg-mism/a/index', file: 'apps/miniapp-taro/src/pkg-mism/a/index.tsx', text: mirrorText('MismScreen'), cssText: '' },
    { route: 'pkg-mism/b/index', file: 'apps/miniapp-taro/src/pkg-mism/b/index.tsx', text: 'export default {}', cssText: '' },
  ]
  const mismPagesBoth = [
    mismPagesOne[0],
    { ...mismPagesOne[1], text: mirrorText('MismScreen') },
  ]

  // 正例:两条登记路由,其中一条被声明错配剔除 ⇒ 剩一条有效 ⇒ 仍承载(不折整屏缺口)
  const oneMism = judgeCarriers({
    shared: mismShared,
    registryRows: mismRegistry,
    verdictRows: [mismatchB],
    mpPages: mismPagesOne,
    webMap: [],
  })
  push('正例 一条声明错配剔除后仍承载', oneMism.rows[0]?.verdict === VERDICTS.carried, oneMism.rows[0]?.verdict)
  push(
    '正例 mismatchRoutes 逐条记账',
    JSON.stringify(oneMism.rows[0]?.mismatchRoutes) === JSON.stringify(['pkg-mism/b/index']),
    oneMism.rows[0]?.mismatchRoutes,
  )
  push('读数 mismatchIgnored 计价', oneMism.readouts.mismatchIgnored === 1, oneMism.readouts.mismatchIgnored)

  // 校验:声明里的 route 不在该屏 registry ⇒ 不算剔除(不得静默生效),单独点名 mismatchUnmatched
  const typoRoute = judgeCarriers({
    shared: mismShared,
    registryRows: mismRegistry,
    verdictRows: [{ ...mismatchA, route: 'pkg-mism/typo/index' }],
    mpPages: mismPagesBoth,
    webMap: [],
  })
  push(
    '校验 拼错路由 ⇒ 剔除 0 / 点名 1',
    typoRoute.readouts.mismatchIgnored === 0 && typoRoute.readouts.mismatchUnmatched === 1,
    `${typoRoute.readouts.mismatchIgnored}/${typoRoute.readouts.mismatchUnmatched}`,
  )

  // 阴性对照:错配打在另一条路由上,本条路照旧承载(不得按 shared 整屏剔除)
  const otherRoute = judgeCarriers({
    shared: mismShared,
    registryRows: mismRegistry,
    verdictRows: [mismatchB],
    mpPages: mismPagesBoth,
    webMap: [],
  })
  push(
    '对照 错配不影响同屏另一条路',
    otherRoute.rows[0]?.verdict === VERDICTS.carried &&
      otherRoute.rows[0]?.routeEvidence.some((e) => e.route === 'pkg-mism/a/index' && e.mirrored),
    otherRoute.rows[0]?.verdict,
  )

  // 反例:全部登记路由都被剔除 ⇒ 未判定,绝不许判绿/判成 legal-absence
  const allMism = judgeCarriers({
    shared: mismShared,
    registryRows: mismRegistry,
    verdictRows: [mismatchA, mismatchB],
    mpPages: mismPagesBoth,
    webMap: [],
  })
  push(
    '反例 全部声明错配 ⇒ 未判定且非合法差异',
    allMism.rows[0]?.verdict === VERDICTS.undetermined &&
      allMism.readouts.legalAbsence.every((r) => r.shared !== MISM),
    allMism.rows[0]?.verdict,
  )
  push(
    '反例 全部声明错配 reason 点名',
    /全部登记路由已判 declared-object-mismatch/.test(allMism.rows[0]?.reason || ''),
    allMism.rows[0]?.reason,
  )

  // 校验:合法行被接受;缺 route / route='-' / 缺 evidence / evidence 无 文件:行 ⇒ 归 bad
  const okMism = parseVerdictRows(JSON.stringify(mismatchB))
  push('校验 合法 mismatch 行被接受', okMism.bad.length === 0 && okMism.rows.length === 1, okMism.bad.length)
  const noRoute = parseVerdictRows(JSON.stringify({ ...mismatchB, route: '' }))
  push('校验 缺 route 归 bad', noRoute.bad.length === 1 && /route/.test(noRoute.bad[0].why), noRoute.bad[0]?.why)
  const dashRoute = parseVerdictRows(JSON.stringify({ ...mismatchB, route: '-' }))
  push('校验 route="-" 归 bad', dashRoute.bad.length === 1 && /route/.test(dashRoute.bad[0].why), dashRoute.bad[0]?.why)
  const noEv = parseVerdictRows(JSON.stringify({ ...mismatchB, evidence: '' }))
  push('校验 缺 evidence 归 bad', noEv.bad.length === 1 && /evidence/.test(noEv.bad[0].why), noEv.bad[0]?.why)
  const noLoc = parseVerdictRows(JSON.stringify({ ...mismatchB, evidence: '页面实为另一业务对象' }))
  push(
    '校验 evidence 无 文件:行 归 bad',
    noLoc.bad.length === 1 && /文件:行/.test(noLoc.bad[0].why),
    noLoc.bad[0]?.why,
  )

  // 互斥:同屏 not-applicable 与 mismatch 不能共存 ⇒ 涉事行全部归 bad(不静默丢)
  const conflictRows = parseVerdictRows(
    [
      JSON.stringify({ shared: MISM, route: '-', verdict: 'not-applicable', evidence: 'apps/web/x.tsx:1 不承载' }),
      JSON.stringify(mismatchB),
    ].join('\n'),
  )
  push(
    '互斥 同屏 not-applicable + mismatch 判 bad',
    conflictRows.rows.length === 0 &&
      conflictRows.bad.length === 2 &&
      conflictRows.bad.every((b) => /同屏 not-applicable 与 declared-object-mismatch 语义冲突/.test(b.why)),
    `${conflictRows.rows.length}/${conflictRows.bad.length}`,
  )

  // 键:同 shared 不同 route 两条 mismatch 归并后都在(不得互相覆盖)
  const mergedMism = mergeVerdictRows([], [mismatchA, mismatchB])
  push(
    '键 同屏两条 mismatch 归并后不互吃',
    mergedMism.rows.length === 2 &&
      mergedMism.total === 2 &&
      mergedMism.rows.filter((r) => r.route === 'pkg-mism/a/index').length === 1 &&
      mergedMism.rows.filter((r) => r.route === 'pkg-mism/b/index').length === 1,
    mergedMism.total,
  )
  push(
    '键 verdictKey 按 (shared,route) 区分',
    verdictKey(mismatchA) !== verdictKey(mismatchB) && verdictKey(mismatchA) === verdictKey({ ...mismatchA }),
    verdictKey(mismatchA),
  )

  // 序列化:键序固定,且 mismatch 的 route 不回落 '-'
  const serMism = JSON.parse(serializeVerdicts([mismatchB]))
  push(
    '序列化 mismatch route 不回落 -',
    serMism.route === 'pkg-mism/b/index' &&
      Object.keys(serMism).join(',') === 'shared,route,verdict,evidence,at,source',
    Object.keys(serMism).join(','),
  )

  let bad = 0
  for (const c of cases) {
    if (!c.pass) bad++
    console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.got !== undefined ? ` — ${JSON.stringify(c.got)}` : ''}`)
  }
  console.log(`\n自检 ${cases.length} 例,失败 ${bad}`)
  return bad === 0 ? 0 : 1
}

/* ============================================================================
 * 直执行:取材 → 判定 → 棘轮 → 报告
 * ============================================================================ */

function loadInputs(face) {
  const shared = cov.collectShared(face)
  const mpPages = cov.collectMiniapp(face)
  const mapText = cov.faceRead(face, WEB_MAP)
  if (mapText === null) throw new Undetermined(`${WEB_MAP} 在 ${face} 面取不到 ⇒ 映射台账残缺`)
  const { rows: webMap, bad } = parseWebMap(mapText)
  if (bad.length) throw new Undetermined(`${WEB_MAP} 有 ${bad.length} 行读不出(首行:${bad[0].why})`)
  const regText = cov.faceRead(face, REGISTRY)
  if (regText === null) throw new Undetermined(`${REGISTRY} 在 ${face} 面取不到 ⇒ 共享屏登记残缺`)
  let registryRows
  try {
    registryRows = JSON.parse(regText).entries
  } catch (e) {
    throw new Undetermined(`${REGISTRY} JSON 解析失败: ${e?.message ?? e}`)
  }
  if (!Array.isArray(registryRows)) throw new Undetermined(`${REGISTRY}.entries 不是数组`)
  const verdicts = readVerdicts(face, ROOT)
  if (verdicts.bad.length)
    throw new Undetermined(`verdict 台账有 ${verdicts.bad.length} 行读不出(首行:${verdicts.bad[0].why})`)
  return { shared, mpPages, webMap, registryRows, verdictRows: verdicts.rows }
}

function loadRateText(face, rel, parse = parseLedger) {
  const text = cov.faceRead(face, rel)
  if (text === null) throw new Undetermined(`台账 ${rel} 在 ${face} 面取不到 ⇒ 棘轮无输入`)
  const { rows, bad } = parse(text)
  if (bad.length) throw new Undetermined(`台账 ${rel} 有 ${bad.length} 行读不出(首行:${bad[0].why})`)
  return rows
}

function main() {
  const input = loadInputs(FACE)
  const result = judgeCarriers(input)
  const baselineRows = writeLedger ? [] : loadRateText(FACE, LEDGER)
  const baselineLegal = writeLedger ? [] : loadRateText(FACE, LEGAL_LEDGER, parseLegalLedger)
  const ratchet = judgeCarrierRatchet(result.readouts, baselineRows, baselineLegal)
  const r = result.readouts

  if (writeLedger) {
    writeFileSync(join(ROOT, LEDGER), serializeRows(result.rows) + '\n', 'utf8')
    writeFileSync(join(ROOT, LEGAL_LEDGER), serializeLegalRows(result.legalRows) + '\n', 'utf8')
    console.log(
      `[check-web-mp-route-carriers] 已写台账 ${LEDGER}: ${result.rows.length} 行;${LEGAL_LEDGER}: ${result.legalRows.length} 行`,
    )
    return 0
  }

  const red = ratchet.newRows.length + ratchet.newLegal.length

  if (jsonMode) {
    console.log(
      JSON.stringify(
        {
          face: FACE,
          gateId: 'TBD-web-mp-route-carriers',
          readouts: {
            shared: r.shared,
            carried: r.carried,
            missingCarrier: r.missingCarrier,
            routeNotInConfig: r.routeNotInConfig,
            undetermined: r.undetermined,
            legalAbsence: r.legalAbsence,
            duplicateAlias: r.duplicateAlias,
            duplicateConflict: r.duplicateConflict,
            mismatchIgnored: r.mismatchIgnored,
            mismatchUnmatched: r.mismatchUnmatched,
          },
          newGaps: ratchet.newRows,
          newLegal: ratchet.newLegal,
          improved: ratchet.improved,
          red,
        },
        null,
        2,
      ),
    )
  } else {
    console.log(
      `[check-web-mp-route-carriers] face=${FACE} 共享屏=${r.shared} 承载=${r.carried} 台账=${baselineRows.length} 行 声明错配剔除=${r.mismatchIgnored}`,
    )
    const buckets = [
      ['mp 缺承载', r.missingCarrier],
      ['承载路由在配置里不存在', r.routeNotInConfig],
      ['未判定(映射缺失)', r.undetermined],
      ['合法差异(单独立账)', r.legalAbsence],
      ['判重-一槽多账冲突', r.duplicateConflict],
      ['判重-多路入口别名', r.duplicateAlias],
    ]
    for (const [label, list] of buckets) {
      console.log(`  ${label}: ${list.length}`)
      for (const row of list) {
        console.log(
          `    ${row.shared}${row.mpRoutes?.length ? `  路由=${row.mpRoutes.join(',')}` : ''}  ${row.reason || ''}`,
        )
      }
    }
    for (const row of ratchet.newRows) {
      console.log(`  ❌ 新增缺口/新未判定  ${row.shared}  ${VERDICT_LABEL[row.verdict] || row.verdict}`)
    }
    for (const row of ratchet.newLegal) {
      console.log(`  ❌ 新增合法差异无账  ${row.shared}  需补 ${LEGAL_LEDGER}`)
    }
    console.log(`  已还账 ${ratchet.improved.length} 项`)
    if (gateMode) console.log(red === 0 ? 'GATE PASS' : 'GATE FAIL')
  }
  return red === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  if (selfTest) process.exit(selfTestFn())
  try {
    process.exit(main())
  } catch (err) {
    if (err instanceof Undetermined || /取不到|未判定/.test(String(err?.message))) {
      console.error(`[check-web-mp-route-carriers] 未判定(§0.3): ${err?.message || err}(不记绿也不冒红)`)
      process.exit(2)
    }
    throw err
  }
}

export const __test__ = {
  VERDICTS,
  VERDICT_LABEL,
  parseWebMap,
  judgeCarriers,
  serializeRows,
  serializeLegalRows,
  parseLedger,
  parseLegalLedger,
  judgeCarrierRatchet,
  rowKey,
  FACE,
  ROOT,
  LEDGER,
  LEGAL_LEDGER,
  WEB_MAP,
  REGISTRY,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
