// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * miniapp-shell-form.mjs — 小程序「薄壳 vs 复制」实现形态分类器(唯一实现)。
 *
 * 判据(题面):页面文件若在其对应的共享屏映射里被声明为「镜像/委托」,
 * 则必须**实际 import 共享壳入口**;否则计为「复制页」并点名。
 *
 * 映射声明有两个来源(取并集):
 *   ① 登记表 `scripts/data/cross-end-screen-registry.json` 里 miniapp 路由与共享屏成对的条目;
 *   ② 页面自身(含同目录伴生 .css)的镜像声明 —— 直接复用
 *      `scripts/check-cross-end-screen-coverage.mjs` 的四形识别器(单一出口,不另抄正则)。
 *
 * 委托入口(实现形态):
 *   - 形 `@rn-shells/*`            : 生成器产出的标准薄壳;
 *   - 形 `@ihui/rn-app/features/*` : 端内直接渲染共享屏本体(等价入口,登记在 README 口径里);
 *   - 形 `import { XScreen } from '@ihui/rn-app'`: 从共享层 barrel 取同名屏(要求符号对得上声明 spec)。
 *   只认**import 语句**,不认注释/字符串里提到入口(否则「提到」又一次被当成「用了」)。
 *
 * 原因分类(机械可判,近似口径,便于分批收敛):
 *   - `local-delta`  : 复制页自带数据层痕迹(@ihui/api-client / fetch / Taro.request / /api/ 字面量)
 *                      ⇒ 已与共享屏行为分叉,收编成本高;
 *   - `pure-copy`    : 无自有数据层痕迹 ⇒ 多数是布局搬运,收编成本低;
 *   - `undetermined` : 页面/映射读不到,或声明解到重名歧义 ⇒ 不判绿也不判红,单列点名。
 */

import { Undetermined } from './face-reader.mjs'
import { readFaceOne } from './gate-face.mjs'
import { __test__ as coverage } from '../check-cross-end-screen-coverage.mjs'
import { isRetiredRecord } from './ledger-retirement.mjs'

export const REGISTRY = 'scripts/data/cross-end-screen-registry.json'
export const LEDGER = 'scripts/data/miniapp-shell-copy-ledger.jsonl'

/** 委托入口识别(只认 import/require 语句) */
const SHELL_IMPORT_RE = /(?:from\s*['"]@rn-shells(?:[/'"]|$))|(?:import\s*\(\s*['"]@rn-shells)/
const EQUIV_FEATURE_IMPORT_RE = /from\s*['"]@ihui\/rn-app\/features\/([^'"]+)['"]/g
const EQUIV_BARREL_IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*['"]@ihui\/rn-app['"]/g

/** 数据层痕迹(去掉注释后判,防「注释里写了 /api/」被算成行为分叉) */
const DATA_LAYER_RE =
  /(?:@ihui\/api-client|fetchApi\s*\(|\bfetch\s*\(|\bTaro\.request\s*\(|\bwx\.request\s*\(|\baxios\b|\/api\/)/

function codeOnly(text) {
  return String(text || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

export function hasShellImport(text) {
  return SHELL_IMPORT_RE.test(String(text || ''))
}

/**
 * 等价入口匹配。declaredSpecs 为空(仅登记表声明)时,按 @ihui/rn-app/features 路径也认。
 * @returns {string|null} 命中的入口原文
 */
export function equivalentEntry(text, declaredSpecs) {
  const src = String(text || '')
  const specs = new Set(declaredSpecs || [])
  for (const m of src.matchAll(EQUIV_FEATURE_IMPORT_RE)) {
    const tail = m[1].replace(/\.(tsx|ts|jsx|js)$/, '')
    const spec = `packages/app/src/features/${tail}.tsx`
    if (specs.size === 0 || specs.has(spec)) return `@ihui/rn-app/features/${tail}`
  }
  for (const m of src.matchAll(EQUIV_BARREL_IMPORT_RE)) {
    const names = m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim())
    for (const name of names) {
      if (!/^[A-Z][A-Za-z0-9_]*Screen$/.test(name)) continue
      const hit = [...specs].find((sp) => sp.split('/').pop() === `${name}.tsx`)
      if (hit) return `import {${name}} from '@ihui/rn-app'`
    }
  }
  return null
}

/**
 * 单页分类(纯函数,供门/自测/台账生成共用)。
 * @param {{route:string,file:string|null,text:string|null,loc?:number,declaredSpecs?:string[],registry?:object|null,ambiguousNames?:string[]}} page
 */
export function classifyPage(page) {
  const text = page?.text ?? null
  if (!page?.file) {
    return {
      route: page?.route ?? '?',
      file: null,
      loc: 0,
      mapStatus: 'missing-file',
      impl: 'undetermined',
      reasonClass: 'undetermined',
      shellEntry: null,
      declaredSpecs: page?.declaredSpecs ?? [],
      note: '映射指向的页面文件在该面读不到',
    }
  }
  if (text === null) {
    return {
      route: page.route,
      file: page.file,
      loc: 0,
      mapStatus: 'unreadable',
      impl: 'undetermined',
      reasonClass: 'undetermined',
      shellEntry: null,
      declaredSpecs: page?.declaredSpecs ?? [],
      note: '页面正文在该面读不到(不回落另一个面)',
    }
  }
  const declared = page?.declaredSpecs ?? []
  const byRegistry = Boolean(page?.registry)
  const byDeclaration = declared.length > 0
  const mapStatus = byRegistry && byDeclaration ? 'registry+declaration' : byRegistry ? 'registry' : byDeclaration ? 'declaration' : 'none'
  if (mapStatus === 'none') {
    return {
      route: page.route,
      file: page.file,
      loc: page.loc ?? text.split('\n').length,
      mapStatus,
      impl: hasShellImport(text) ? 'shell' : 'plain',
      reasonClass: null,
      shellEntry: hasShellImport(text) ? '@rn-shells' : null,
      declaredSpecs: [],
      note: '未被映射声明为镜像/委托 ⇒ 不在本判据射程',
    }
  }
  const shellEntry = hasShellImport(text) ? '@rn-shells' : equivalentEntry(text, declared)
  if (shellEntry) {
    return {
      route: page.route,
      file: page.file,
      loc: page.loc ?? text.split('\n').length,
      mapStatus,
      impl: 'shell',
      reasonClass: null,
      shellEntry,
      declaredSpecs: declared,
      note: '已声明且实际 import 委托入口',
    }
  }
  if (!byDeclaration && (page?.ambiguousNames || []).length > 0) {
    return {
      route: page.route,
      file: page.file,
      loc: page.loc ?? text.split('\n').length,
      mapStatus: 'ambiguous',
      impl: 'undetermined',
      reasonClass: 'undetermined',
      shellEntry: null,
      declaredSpecs: declared,
      note: `屏名歧义(${(page?.ambiguousNames || []).join(',')}),不认作声明`,
    }
  }
  const localDelta = DATA_LAYER_RE.test(codeOnly(text))
  return {
    route: page.route,
    file: page.file,
    loc: page.loc ?? text.split('\n').length,
    mapStatus,
    impl: 'copy',
    reasonClass: localDelta ? 'local-delta' : 'pure-copy',
    shellEntry: null,
    declaredSpecs: declared,
    note: localDelta ? '有自有数据层痕迹的复制页' : '纯布局复制页(无自有数据层痕迹)',
  }
}

/** 读登记表(按面);读不到/不是 JSON ⇒ 未判定。 */
export function loadRegistry(root, face, registryPath = REGISTRY) {
  const txt = readFaceOne(root, face, registryPath)
  if (txt === null) throw new Undetermined(`登记表 ${registryPath} 在 ${face} 面读不到 ⇒ 映射不可用`)
  let j
  try {
    j = JSON.parse(txt)
  } catch (e) {
    throw new Undetermined(`登记表 ${registryPath} 在 ${face} 面不是合法 JSON: ${e?.message ?? e}`)
  }
  if (!Array.isArray(j?.entries)) throw new Undetermined(`登记表 ${registryPath} 缺 entries 数组`)
  if (j.entries.length === 0) throw new Undetermined(`登记表 ${registryPath} 枚举到 0 条 ⇒ 映射不可用`)
  return j.entries
}

/** 台账永远读工作树(判据输入,不是被判对象;CI 干净检出上与 HEAD 等价)。
 *  G-814414 补格(2026-11-05):带「授权退休」标记的行不计入在册条数(它们是被摘条目的
 *  可核验载体,不是仍欠收敛的存量),所以 `93 → 90` 与门 299 的「复制 90」账实相符。 */
export function loadLedgerRows(root, ledgerPath = LEDGER) {
  const txt = readFaceOne(root, 'worktree', ledgerPath)
  if (txt === null) return []
  return txt
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((r) => !isRetiredRecord(r))
}

export function ledgerKey(row) {
  return `${row?.route ?? '?'}\u0000${row?.file ?? '?'}`
}

/**
 * 枚举 + 分类当前面上的全部在册页。
 * @returns {{ rows: object[], shared: object[], pageCount: number, registryCount: number }}
 */
export function classifyMiniappPages(root, face) {
  const shared = coverage.collectShared(face)
  if (shared.length === 0) throw new Undetermined(`${face} 面枚举到 0 枚共享屏 ⇒ 判死不记绿`)
  const pages = coverage.collectMiniapp(face)
  if (pages.length === 0) throw new Undetermined(`${face} 面枚举到 0 个小程序在册页 ⇒ 判死不记绿`)
  const registry = loadRegistry(root, face)
  const idx = coverage.buildSharedIndex(shared)
  const registryMap = new Map(registry.map((e) => [e.miniapp, e]))
  const rows = []
  const undeterminedMissing = []
  for (const p of pages) {
    const hay = `${p.text || ''}\n${p.cssText || ''}`
    const d = coverage.mirrorDeclarations(hay, idx)
    const reg = registryMap.get(p.route) ?? null
    if (!p.file) {
      undeterminedMissing.push(p.route)
      continue
    }
    rows.push(
      classifyPage({
        route: p.route,
        file: p.file,
        text: p.text,
        loc: p.text ? p.text.split('\n').length : 0,
        declaredSpecs: [...d.specs],
        registry: reg,
        ambiguousNames: [...d.ambiguous],
      }),
    )
  }
  if (undeterminedMissing.length > 0) {
    throw new Undetermined(
      `映射/在册页 ${undeterminedMissing.length} 条指向的页面文件读不到(例:${undeterminedMissing.slice(0, 3).join(', ')})⇒ 形态不可判`,
    )
  }
  return { rows, shared, pageCount: pages.length, registryCount: registry.length }
}

/**
 * 棘轮纯判定(不读盘,供自测复用)。
 * @param {object[]} rows 当前面分类结果
 * @param {object[]} ledger 存量台账行
 * @returns {{reds: object[], advisories: object[], stats: object}}
 */
export function evaluateRatchet(rows, ledger) {
  const currentCopies = rows.filter((r) => r.impl === 'copy')
  const currentKeys = new Set(currentCopies.map(ledgerKey))
  const ledgerKeys = new Set(ledger.map(ledgerKey))
  const reds = []
  for (const r of currentCopies) {
    if (!ledgerKeys.has(ledgerKey(r))) {
      reds.push({
        rule: 'S1',
        why: `新增复制页未登记: ${r.route} (${r.file}, ${r.loc} 行, ${r.mapStatus}/${r.reasonClass})`,
      })
    }
  }
  const advisories = []
  for (const l of ledger) {
    if (!currentKeys.has(ledgerKey(l))) {
      advisories.push({ rule: 'S2', why: `存量复制页已收敛(可从台账摘除): ${l.route}` })
    }
  }
  const ledgerLoc = new Map(ledger.map((l) => [ledgerKey(l), l.loc]))
  for (const r of currentCopies) {
    const old = ledgerLoc.get(ledgerKey(r))
    if (typeof old === 'number' && old !== r.loc) {
      advisories.push({ rule: 'S2', why: `复制页行数变化(台账 ${old} → 现读 ${r.loc}): ${r.route}` })
    }
  }
  const totalLoc = rows.reduce((a, r) => a + (r.loc || 0), 0)
  const copyLoc = currentCopies.reduce((a, r) => a + (r.loc || 0), 0)
  return {
    reds,
    advisories,
    stats: {
      pages: rows.length,
      declared: rows.filter((r) => r.mapStatus !== 'none' && r.mapStatus !== 'missing-file').length,
      shell: rows.filter((r) => r.impl === 'shell' && r.mapStatus !== 'none').length,
      copy: currentCopies.length,
      copyLoc,
      totalLoc,
      copyRatio: totalLoc ? +(copyLoc / totalLoc).toFixed(4) : 0,
      pureCopy: currentCopies.filter((r) => r.reasonClass === 'pure-copy').length,
      localDelta: currentCopies.filter((r) => r.reasonClass === 'local-delta').length,
      undetermined: rows.filter((r) => r.impl === 'undetermined').length,
      ledgerRows: ledger.length,
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
