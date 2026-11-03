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
 * 两个读数:
 *   alias          `onRetry=` 表达式恰好是上述别名(含 `onRetry ?? onRefresh`)
 *                  ⇒ 扫 packages/app/src/features/** 与 apps/mobile-rn/src/screens/**
 *   missingRetry   RN 壳值导入了「正文含 <ErrorState> 的共享屏」,但壳里一个 `onRetry=`
 *                  都没有 ⇒ 该屏在壳侧没有重试入口
 *
 * 分母与 RN 壳清单不重算(§0.6):共享屏取 `check-cross-end-screen-coverage.mjs` 的
 * `collectShared`,RN 屏取同文件的 `collectRn`;壳侧值导入解析取
 * `check-rn-host-shell-coverage.mjs` 的 `rnAppValueImports`。
 *
 * 用法:node scripts/check-retry-aliases.mjs [--json] [--gate] [--staged|--worktree]
 * 退出码:0 无别名且壳侧无缺重试 · 1 有 alias/missingRetry · 2 取不到输入(未判定,§0.3)
 */

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'
import { __test__ as shell } from './check-rn-host-shell-coverage.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..')

const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const gateMode = argv.includes('--gate')
const stagedMode = argv.includes('--staged')
const worktreeMode = argv.includes('--worktree')
const FACE = stagedMode ? 'staged' : worktreeMode ? 'worktree' : 'head'

/** 别名表达式(逐字判定,不做「含关键字」的宽匹配,避免误伤条件表达式) */
const ALIAS_EXPRS = new Set(['onBack', 'onRefresh', 'onLoadMore', 'undefined', 'null', 'onRetry ?? onRefresh'])

/**
 * 抽出 `onRetry={...}` 的平衡花括号表达式。
 * 不能用 `[^}]*`:壳侧常见 `() => { void load() }`,第一个 `}` 只是内层块。
 */
export function onRetryExprs(text) {
  const out = []
  if (typeof text !== 'string') return out
  const re = /onRetry=\{/g
  while (re.exec(text)) {
    let i = re.lastIndex
    let depth = 1
    while (i < text.length && depth > 0) {
      const c = text[i]
      if (c === '{') depth += 1
      else if (c === '}') depth -= 1
      i += 1
    }
    if (depth !== 0) break
    out.push(text.slice(re.lastIndex, i - 1).trim())
  }
  return out
}

/** 该 onRetry 表达式是否是别名(返回上一页 / 列表刷新 / 加载更多 / 空值) */
export function isAliasExpr(expr) {
  if (typeof expr !== 'string') return false
  const compact = expr.replace(/\s+/g, ' ').trim()
  if (ALIAS_EXPRS.has(compact)) return true
  // `onRetry ?? onRefresh` 的括号变体:主值仍是列表刷新,不是真重载
  if (/^onRetry\s*\?\?\s*onRefresh$/.test(compact)) return true
  return false
}

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

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  let report
  try {
    const { sharedScreens, rnShells } = loadFace(FACE)
    report = judgeRetryAliases({ sharedScreens, rnShells })
  } catch (err) {
    console.error(`[check-retry-aliases] 未判定(§0.3): 取不到 ${FACE} 面输入: ${err?.message || err}`)
    process.exit(2)
  }

  if (jsonMode) {
    console.log(JSON.stringify({ face: FACE, ...report }, null, 2))
  } else {
    console.log(`[check-retry-aliases] face=${FACE} alias=${report.alias} (shared=${report.sharedAlias}, shell=${report.shellAlias}) missingRetry=${report.missingRetry} (shared=${report.sharedMissing.length}, shell=${report.shellMissing.length})`)
    for (const h of report.aliasHits) console.log(`  alias  ${h.layer}  ${h.file}  onRetry={${h.expr}}`)
    for (const h of report.sharedMissing) console.log(`  missing shared ${h.file}  该屏 ErrorState 无 onRetry`)
    for (const h of report.shellMissing) {
      console.log(`  missing shell  ${h.file}  未给 ${h.imported.join(',')} 传真 onRetry`)
    }
    if (gateMode) console.log(report.alias === 0 && report.missingRetry === 0 ? 'GATE PASS' : 'GATE FAIL')
  }

  process.exit(report.alias === 0 && report.missingRetry === 0 ? 0 : 1)
}

export const __test__ = {
  onRetryExprs,
  isAliasExpr,
  exportedNames,
  judgeRetryAliases,
  loadFace,
  FACE,
  ROOT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
