#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出对账报告 */
/**
 * check-retry-aliases.mjs — ErrorState 的 onRetry 必须是「真重载」只读判据
 *
 * 立因(2026-11-03):共享屏与 RN 壳把 `onRetry={onBack}`(返回上一页)、
 * `onRetry={onRefresh}`(列表下拉刷新)、`onRetry={onLoadMore}`、`onRetry={undefined}`
 * 当成重试按钮的接线,点「重试」实际是退出/翻页/什么都不做。判据缺失时,
 * 「ErrorState 上有 onRetry」会被读成「失败可重试」。
 *
 * 四个读数:
 *   alias          `onRetry=` 表达式恰好是上述别名(含 `onRetry ?? onRefresh`)
 *                  ⇒ 扫 packages/app/src/features/** 与 apps/mobile-rn/src/screens/**
 *   missingRetry   RN 壳值导入了「正文含 <ErrorState> 的共享屏」,但壳里一个 `onRetry=`
 *                  都没有 ⇒ 该屏在壳侧没有重试入口
 *   fakeReload     同一提取器扩面到 apps/web/** 与 apps/miniapp-taro/src/**:按语义把
 *                  `onRetry=` 分成 真重载 / 假重载(退出·翻页·清空·空值·空回调) / 未判定
 *                  存量逐枚落账在 scripts/data/retry-reload-baseline.jsonl,新增假重载判红(棘轮)
 *   undetermined   回调透传(`onRetry={onRetry}` 等)与混合体留在未判定桶;不折成真重载、不折成 0
 *
 * 分母与 RN 壳清单不重算(§0.6):共享屏取 `check-cross-end-screen-coverage.mjs` 的
 * `collectShared`,RN 屏取同文件的 `collectRn`;壳侧值导入解析取
 * `check-rn-host-shell-coverage.mjs` 的 `rnAppValueImports`。
 * 提取器/分类器只此一份,在 `scripts/lib/retry-reload.mjs`(三端同一实现)。
 *
 * 用法:node scripts/check-retry-aliases.mjs [--json] [--gate] [--staged|--worktree]
 *       node scripts/check-retry-aliases.mjs --self-test        分类器正反例自检
 *       node scripts/check-retry-aliases.mjs --write-baseline    重出存量台账(维护动作)
 * 退出码:0 无别名/无缺重试/无新增假重载 · 1 任一红 · 2 取不到输入(未判定,§0.3)
 * GATE_ID: 296 —— 既有门扩面(web + 小程序),未新占门号
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'
import { __test__ as shell } from './check-rn-host-shell-coverage.mjs'
import { gitRaw, Undetermined } from './lib/face-reader.mjs'
import {
  classifyRetryExpr,
  isAliasExpr,
  judgeFakeRatchet,
  judgeRetryText,
  onRetryExprs,
  parseBaseline,
  serializeBaseline,
  siteKey,
  summarize,
} from './lib/retry-reload.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..')

const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const gateMode = argv.includes('--gate')
const selfTest = argv.includes('--self-test')
const writeBaseline = argv.includes('--write-baseline')
const stagedMode = argv.includes('--staged')
const worktreeMode = argv.includes('--worktree')
const FACE = stagedMode ? 'staged' : worktreeMode ? 'worktree' : 'head'

/** 三端扫描射程(同一份提取器/分类器,不复制第二套实现) */
const RETRY_SURFACES = [
  { end: 'shared', dir: 'packages/app/src/features', ext: /\.(tsx|ts)$/ },
  { end: 'shell', dir: 'apps/mobile-rn/src/screens', ext: /\.(tsx|ts)$/ },
  { end: 'web', dir: 'apps/web', ext: /\.(tsx|ts|jsx|js)$/ },
  { end: 'miniapp', dir: 'apps/miniapp-taro/src', ext: /\.(tsx|ts|jsx|js)$/ },
]

/** 存量基线台账(逐文件:行号 + 判定;棘轮只拦"新增假重载") */
const BASELINE = 'scripts/data/retry-reload-baseline.jsonl'

/** 测试/夹具文件不进产品口径(与既有 alias 扫描的 shared/shell 射程不同:这两端原本就没有伴生测试) */
const TEST_FILE_RE = /(?:__tests__|__mocks__|\/tests?\/|\.test\.|\.spec\.)/

/** 共享屏对外导出的组件名(同名文件可能出现在多个域,壳侧 import 认的是导出名) */
export function exportedNames(text) {
  const names = new Set()
  for (const re of [/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g, /export\s+const\s+([A-Za-z0-9_]+)\s*=/g]) {
    let m = null
    while ((m = re.exec(text))) names.add(m[1])
  }
  return [...names]
}

/**
 * 纯判据(测试直接喂夹具,不读盘)。
 * @param {object} p
 * @param {Array<{name:string, spec:string, text:string}>} p.sharedScreens
 * @param {Array<{file:string, name:string, text:string}>} p.rnShells
 */
export function judgeRetryAliases({ sharedScreens = [], rnShells = [] } = {}) {
  const aliasHits = []
  for (const s of sharedScreens) {
    for (const expr of onRetryExprs(s.text)) {
      if (isAliasExpr(expr)) aliasHits.push({ layer: 'shared', file: s.spec, screen: s.name, expr })
    }
  }
  for (const r of rnShells) {
    for (const expr of onRetryExprs(r.text)) {
      if (isAliasExpr(expr)) aliasHits.push({ layer: 'shell', file: r.file, screen: r.name, expr })
    }
  }

  // 含 <ErrorState> 的共享屏(同名屏可能有多个域,取并集即可:judge 只看名字)
  const retryableNames = new Set()
  const sharedMissing = []
  for (const s of sharedScreens) {
    if (!/<ErrorState\b/.test(s.text)) continue
    const alias = onRetryExprs(s.text).some(isAliasExpr)
    const canonical = /\bonRetry=\{\s*onRetry\s*\}/.test(s.text)
    if (alias || canonical) {
      for (const n of exportedNames(s.text)) retryableNames.add(n)
    }
    // 共享屏自己就渲染了 ErrorState 却一个 onRetry 都没挂:重试入口从根上就不存在
    if (!/\bonRetry=/.test(s.text)) sharedMissing.push({ file: s.spec, screen: s.name })
  }

  const shellMissing = []
  for (const r of rnShells) {
    const imports = shell.rnAppValueImports(r.text)
    // 只要求「共享屏已具备可重试语义」的壳接头:从根上没挂 onRetry 的屏另记 sharedMissing
    const consumed = [...imports.names].filter((n) => retryableNames.has(n))
    if (consumed.length === 0) continue
    const exprs = onRetryExprs(r.text)
    // 有接线(哪怕接错)就不算「缺」:接错由 alias 口径单独翻红,避免同一处双计
    const jsxWired = exprs.filter((e) => e.length > 0).length
    // 模型对象/具名 props 也是壳侧真实接线(TeamDetail/Favorites 等走 {...props} 形态),同样认
    const objectReal = (r.text.match(/onRetry[A-Za-z0-9_]*\s*:\s*(?!undefined\b|null\b)/g) || []).length
    const namedReal = (r.text.match(/onRetry[A-Za-z0-9_]*=\{\s*(?!onBack\b|onRefresh\b|onLoadMore\b|undefined\b|null\b)/g) || []).length
    const real = jsxWired + objectReal + namedReal
    // 一个壳可能渲染多枚可重试共享屏:真 onRetry 数量不得少于这些屏的数量
    if (real < consumed.length) {
      shellMissing.push({ file: r.file, screen: r.name, imported: consumed, realRetry: real })
    }
  }

  const sharedAlias = aliasHits.filter((h) => h.layer === 'shared').length
  const shellAlias = aliasHits.filter((h) => h.layer === 'shell').length
  return {
    alias: aliasHits.length,
    sharedAlias,
    shellAlias,
    missingRetry: sharedMissing.length + shellMissing.length,
    sharedMissing,
    shellMissing,
    aliasHits,
    missingRetryHits: [...sharedMissing, ...shellMissing],
  }
}

function loadFace(face) {
  const shared = cov.collectShared(face)
  const sharedScreens = shared.map((s) => ({ name: s.name, spec: s.spec, text: cov.faceRead(face, s.spec) }))
  const rnShells = cov.collectRn(face).map((r) => ({ file: r.file, name: r.name, text: r.text }))
  return { sharedScreens, rnShells }
}

/** worktree 面:按扩展名枚举磁盘文件(穷举,不猜) */
function walkDir(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walkDir(p, out)
    else out.push(p)
  }
  return out
}

/**
 * 该面上含 `onRetry` 字样的候选文件(先按关键字收窄)。
 * 不能全量枚举 5000+ web 文件再逐份读:那等于每轮上千次 git 子进程(§0.4 性能教训)。
 * 取不到 git 派生结果 ⇒ Undetermined(§0.3),绝不折成空集冒绿。
 */
function collectRetryCandidateFiles(face, surface) {
  const { dir: dirPrefix, ext } = surface
  if (face === 'worktree') {
    const base = join(ROOT, dirPrefix)
    return walkDir(base)
      .map((p) => relative(ROOT, p).replace(/\\/g, '/'))
      .filter((rel) => ext.test(rel) && !TEST_FILE_RE.test(rel))
      .filter((rel) => {
        try {
          return /\bonRetry\b/.test(readFileSync(join(ROOT, rel), 'utf8'))
        } catch {
          return false
        }
      })
      .sort()
  }
  const args =
    face === 'staged'
      ? ['grep', '-l', 'onRetry', '--cached', '--', dirPrefix]
      : ['grep', '-l', 'onRetry', face === 'head' ? 'HEAD' : face, '--', dirPrefix]
  let out
  try {
    out = gitRaw(args, ROOT, { maxBuffer: 64 * 1024 * 1024 })
  } catch (e) {
    throw new Undetermined(`取不到 ${face} 面 ${dirPrefix} 的 onRetry 候选清单: ${e?.message ?? e}`)
  }
  return out
    .split('\n')
    .map((s) => s.trim().replace(/\\/g, '/').replace(/^HEAD:/, ''))
    .filter(Boolean)
    .filter((rel) => ext.test(rel) && !TEST_FILE_RE.test(rel))
    .sort()
}

/**
 * 三端 onRetry 站点(同一份提取器 + 同一份分类器)。
 * shared/shell 的分母仍取既有 collectShared/collectRn(§0.6 不重算分母);
 * web/miniapp 按关键字收窄后逐份判定。
 */
function loadRetrySites(face) {
  const sites = []
  const push = (end, file, text) => {
    if (typeof text !== 'string')
      throw new Undetermined(`取不到 ${face} 面 ${file} 正文 ⇒ onRetry 判定面无输入`)
    for (const s of judgeRetryText(text)) sites.push({ end, file, ...s })
  }
  for (const s of cov.collectShared(face)) push('shared', s.spec, cov.faceRead(face, s.spec))
  for (const r of cov.collectRn(face)) push('shell', r.file, r.text)
  for (const surface of RETRY_SURFACES.filter((x) => x.end === 'web' || x.end === 'miniapp')) {
    for (const file of collectRetryCandidateFiles(face, surface)) {
      push(surface.end, file, cov.faceRead(face, file))
    }
  }
  return sites
}

/** 读基线台账;取不到 / 坏行 ⇒ Undetermined(棘轮无输入不得冒绿) */
function loadBaseline(face) {
  const text = cov.faceRead(face, BASELINE)
  if (text === null) throw new Undetermined(`台账 ${BASELINE} 在 ${face} 面取不到 ⇒ 棘轮无输入`)
  const { rows, bad } = parseBaseline(text)
  if (bad.length > 0)
    throw new Undetermined(`台账 ${BASELINE} 有 ${bad.length} 行读不出(首行: ${bad[0].why} ${bad[0].raw})`)
  return rows
}

/** 自检:分类器与棘轮的正反例(不读盘,纯夹具) */
function selfTestFn() {
  const cases = []
  const cls = (expr) => classifyRetryExpr(expr)
  const real = [
    'load',
    'reload',
    'refetch',
    '() => { void load() }',
    '() => refetchList()',
    '() => keysQuery.refetch()',
    'feed.refresh',
    'unifiedSuggestions.retry',
    '() => { void loadData() }',
    '() => handleRetry()',
  ]
  for (const e of real) {
    const r = cls(e)
    cases.push({ name: `正例 真重载 ${e}`, pass: r.verdict === '真重载', got: r.verdict })
  }
  const fake = [
    ['onBack', 'exit'],
    ['onRefresh', 'clear'],
    ['onLoadMore', 'paging'],
    ['undefined', 'null'],
    ['null', 'null'],
    ['() => {}', 'noop'],
    ['() => { Taro.navigateBack() }', 'exit'],
    ['() => { setVisible(false) }', 'exit'],
    ['() => { setKeyword("") }', 'clear'],
    ['() => { setFilters({}) }', 'clear'],
    ['() => loadMore()', 'paging'],
  ]
  for (const [e, cat] of fake) {
    const r = cls(e)
    cases.push({ name: `反例 假重载 ${e}`, pass: r.verdict === '假重载' && r.category === cat, got: `${r.verdict}/${r.category}` })
  }
  const passthrough = ['onRetry', 'onPolishRetry', 'onRetryReference']
  for (const e of passthrough) {
    const r = cls(e)
    cases.push({ name: `未判定 透传 ${e}`, pass: r.verdict === '未判定', got: r.verdict })
  }
  // 棘轮:台账已记的同键假重载 ⇒ 不红;台账没记 ⇒ 新假重载必须红
  const fakeSite = { end: 'web', file: 'apps/web/a.tsx', line: 1, expr: 'onBack', verdict: '假重载', category: 'exit', reason: '' }
  const recorded = judgeFakeRatchet([fakeSite], [
    { end: 'web', file: 'apps/web/a.tsx', expr: 'onBack', verdict: '假重载', category: 'exit' },
  ])
  cases.push({ name: '棘轮 存量假重载有账 ⇒ 不新增', pass: recorded.newFake.length === 0, got: recorded.newFake.length })
  const unrecorded = judgeFakeRatchet([fakeSite], [])
  cases.push({ name: '棘轮 新假重载无账 ⇒ 判红', pass: unrecorded.newFake.length === 1, got: unrecorded.newFake.length })
  // 同一键两枚,台账只允许一枚 ⇒ 第二枚必须红
  const twice = judgeFakeRatchet(
    [fakeSite, { ...fakeSite, line: 9 }],
    [{ end: 'web', file: 'apps/web/a.tsx', expr: 'onBack', verdict: '假重载', category: 'exit' }],
  )
  cases.push({ name: '棘轮 同键超额新增 ⇒ 判红', pass: twice.newFake.length === 1, got: twice.newFake.length })

  let bad = 0
  for (const c of cases) {
    if (!c.pass) bad++
    console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.got !== undefined ? ` — ${JSON.stringify(c.got)}` : ''}`)
  }
  console.log(`\n自检 ${cases.length} 例,失败 ${bad}`)
  return bad === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  if (selfTest) process.exit(selfTestFn())

  let report
  let sites
  let baseline
  try {
    const { sharedScreens, rnShells } = loadFace(FACE)
    report = judgeRetryAliases({ sharedScreens, rnShells })
    sites = loadRetrySites(FACE)
    // 重出台账时不需要读旧台账(首次建账时它还不存在)
    baseline = writeBaseline ? [] : loadBaseline(FACE)
  } catch (err) {
    console.error(
      `[check-retry-aliases] 未判定(§0.3): 取不到 ${FACE} 面输入: ${err?.message || err}(不记绿也不冒红)`,
    )
    process.exit(2)
  }

  if (writeBaseline) {
    const rows = sites
      .slice()
      .sort((a, b) =>
        `${a.end}|${a.file}|${a.line}`.localeCompare(`${b.end}|${b.file}|${b.line}`),
      )
      .map((s) => ({ ...s, at: '2026-11-05', owner: 'scripts/check-retry-aliases.mjs' }))
    writeFileSync(join(ROOT, BASELINE), serializeBaseline(rows) + '\n', 'utf8')
    console.log(`[check-retry-aliases] 已写台账 ${BASELINE}: ${rows.length} 行`)
    process.exit(0)
  }

  const ratchet = judgeFakeRatchet(sites, baseline)
  const sums = summarize(sites)
  const redCount = report.alias + report.missingRetry + ratchet.newFake.length
  const undeterminedSites = sites.filter((s) => s.verdict === '未判定')

  if (jsonMode) {
    console.log(
      JSON.stringify(
        {
          face: FACE,
          gateId: '296',
          aliasReport: report,
          surfaces: sums,
          baselineRows: baseline.length,
          newFake: ratchet.newFake,
          improvedFake: ratchet.improved,
          fakeSites: sites.filter((s) => s.verdict === '假重载'),
          undeterminedSites,
          red: redCount,
        },
        null,
        2,
      ),
    )
  } else {
    console.log(
      `[check-retry-aliases] face=${FACE} alias=${report.alias} (shared=${report.sharedAlias}, shell=${report.shellAlias}) missingRetry=${report.missingRetry} (shared=${report.sharedMissing.length}, shell=${report.shellMissing.length})`,
    )
    for (const s of sums) {
      console.log(
        `  ${s.end.padEnd(8)} 文件 ${s.files} / 站点 ${s.total}: 真重载 ${s.real} · 假重载 ${s.fake} · 未判定 ${s.undetermined}`,
      )
    }
    for (const h of report.aliasHits) console.log(`  alias  ${h.layer}  ${h.file}  onRetry={${h.expr}}`)
    for (const h of report.sharedMissing) console.log(`  missing shared ${h.file}  该屏 ErrorState 无 onRetry`)
    for (const h of report.shellMissing) {
      console.log(`  missing shell  ${h.file}  未给 ${h.imported.join(',')} 传真 onRetry`)
    }
    for (const s of sites.filter((x) => x.verdict === '假重载')) {
      console.log(`  假重载  ${s.end}  ${s.file}:${s.line}  ${s.category}  onRetry={${s.expr}}`)
    }
    for (const s of ratchet.newFake) {
      console.log(`  ❌ 新增假重载  ${s.end}  ${s.file}:${s.line}  ${s.category}  onRetry={${s.expr}}`)
    }
    for (const s of undeterminedSites) {
      console.log(`  未判定  ${s.end}  ${s.file}:${s.line}  ${s.category}  ${s.reason}`)
    }
    console.log(`  台账 ${BASELINE}: ${baseline.length} 行;新增假重载 ${ratchet.newFake.length};已还账 ${ratchet.improved.length}`)
    if (gateMode) console.log(redCount === 0 ? 'GATE PASS' : 'GATE FAIL')
  }

  process.exit(redCount === 0 ? 0 : 1)
}

export const __test__ = {
  onRetryExprs,
  isAliasExpr,
  exportedNames,
  judgeRetryAliases,
  loadFace,
  loadRetrySites,
  collectRetryCandidateFiles,
  loadBaseline,
  classifyRetryExpr,
  judgeRetryText,
  judgeFakeRatchet,
  summarize,
  siteKey,
  BASELINE,
  RETRY_SURFACES,
  FACE,
  ROOT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
