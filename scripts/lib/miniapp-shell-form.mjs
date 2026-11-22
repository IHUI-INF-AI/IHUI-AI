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

import ts from 'typescript'
import { Undetermined } from './face-reader.mjs'
import { readFaceBatch, readFaceOne } from './gate-face.mjs'
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

// ─────────────────────────────────────────────────────────────────────────────
// 结构判据(2026-11-06 批次②):业务 JSX / 重复 UI 段 / 单端消费 prop。
// 宿主骨架豁免是**显式白名单**,禁止通配任意 View/Fragment:
//   - ThemeRoot(只豁免节点自身,子树照常);
//   - NavBar | NavChrome | className 命中 header/nav/tabbar 词元(整棵子树);
//   - 根容器(return 树最外层且 className/style 命中高度/背景基准,只豁免节点自身)。
const HOST_NAV_TAGS = new Set(['NavBar', 'NavChrome'])
const HOST_NAV_CLASS_RE = /(^|[^a-z0-9])(header|nav|tabbar)([^a-z0-9]|$)/i
const ROOT_BASIS_RE = /(?:min-h-screen|h-screen|min-h-full|h-full|height|bg-background|bg-default)/i
const FINGERPRINT_CACHE = new Map()

function parsePageTsx(text) {
  return ts.createSourceFile('page.tsx', String(text || ''), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

function attrsOf(node) {
  return ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes
}

function jsxTag(node) {
  const h = ts.isJsxElement(node) ? node.openingElement : node
  const t = h?.tagName
  if (!t) return ''
  return ts.isIdentifier(t) ? t.text : t.getText()
}

function attrText(node, name) {
  for (const a of attrsOf(node).properties) {
    if (!ts.isJsxAttribute(a) || a.name.getText() !== name) continue
    return a.initializer ? a.initializer.getText() : ''
  }
  return ''
}

function containsJsx(node) {
  if (!node) return false
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) return true
  let hit = false
  ts.forEachChild(node, (c) => {
    if (!hit && containsJsx(c)) hit = true
  })
  return hit
}

function identifierHasJsx(sf, name) {
  let hit = false
  const walk = (n) => {
    if (hit || !n) return
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.name.text === name &&
      containsJsx(n.initializer)
    ) {
      hit = true
      return
    }
    if (ts.isFunctionDeclaration(n) && n.name?.text === name && containsJsx(n.body)) {
      hit = true
      return
    }
    ts.forEachChild(n, walk)
  }
  walk(sf)
  return hit
}

function findExportedComponent(sf) {
  const decls = new Map()
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) decls.set(st.name.text, st)
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) decls.set(d.name.text, d)
      }
    }
  }
  for (const st of sf.statements) {
    if (!ts.isExportAssignment(st)) continue
    const ex = st.expression
    if (ts.isIdentifier(ex)) return decls.get(ex.text) ?? null
    return ex
  }
  for (const st of sf.statements) {
    if (!st.modifiers) continue
    const has = (k) => st.modifiers.some((m) => m.kind === k)
    if (has(ts.SyntaxKind.ExportKeyword) && has(ts.SyntaxKind.DefaultKeyword)) return st
  }
  return null
}

/** `return (<View/>)` 的表达式在 TS AST 里是 ParenthesizedExpression;不剥皮会丢掉"这是根"的标记,
 *  根容器高度/背景基准豁免随之失效(实测会把根 View 计成业务节点)。这里只剥括号,不改任何判据。 */
function unwrapParens(n) {
  let cur = n
  while (cur && ts.isParenthesizedExpression(cur)) cur = cur.expression
  return cur
}

function returnRoots(comp) {
  const out = []
  if (!comp) return out
  const body = ts.isVariableDeclaration(comp) ? comp.initializer : comp.body
  if (!body) return out
  if (!ts.isBlock(body)) {
    out.push(unwrapParens(body))
    return out
  }
  const walk = (n) => {
    if (ts.isFunctionLike(n)) return // 组件体内的嵌套函数(render prop/回调)不并入 return 树
    if (ts.isReturnStatement(n) && n.expression) out.push(unwrapParens(n.expression))
    ts.forEachChild(n, walk)
  }
  walk(body)
  return out
}

/** 声明屏在小程序页内的本地标识符(含 as 别名/默认导入)。 */
function sharedLocalNames(sf, specs) {
  const bases = (specs || [])
    .map((s) => String(s).split('/').pop().replace(/\.(tsx|ts|jsx|js)$/, ''))
    .filter(Boolean)
  const names = new Set(bases)
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause) continue
    const mod = st.moduleSpecifier?.text || ''
    const hit = bases.find((b) => mod.includes(b))
    if (!hit) continue
    if (st.importClause.name) names.add(st.importClause.name.text)
    const nb = st.importClause.namedBindings
    if (!nb) continue
    if (ts.isNamedImports(nb)) {
      for (const el of nb.elements) {
        if (el.propertyName?.text === hit) names.add(el.name.text)
      }
    }
    if (ts.isNamespaceImport(nb)) names.add(nb.name.text)
  }
  return names
}

/**
 * 页面结构分析(供分类与自测共用)。
 * @param {string} text 页面正文
 * @param {string[]} declaredSpecs 声明共享屏 spec
 * @returns {{count:number,segments:object[],injected:string[],invoked:boolean,sharedNames:string[]}}
 */
export function analyzePageForm(text, declaredSpecs = []) {
  const empty = { count: 0, segments: [], injected: [], invoked: false, sharedNames: [] }
  if (typeof text !== 'string') return empty
  let sf
  try {
    sf = parsePageTsx(text)
  } catch {
    return empty
  }
  const names = sharedLocalNames(sf, declaredSpecs)
  const info = { count: 0, segments: [], injected: [], invoked: false, sharedNames: [...names] }
  const visit = (node, isRoot) => {
    if (!node) return
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = jsxTag(node)
      if (HOST_NAV_TAGS.has(tag)) return // 宿主导航:整棵子树不计
      if (HOST_NAV_CLASS_RE.test(attrText(node, 'className'))) return
      const isShared = names.has(tag)
      if (isShared) info.invoked = true
      const rootBasis =
        isRoot &&
        (ROOT_BASIS_RE.test(attrText(node, 'className')) || /height/.test(attrText(node, 'style')))
      if (tag !== 'ThemeRoot' && !rootBasis) {
        info.count++
        info.segments.push(node)
      }
      if (isShared) {
        for (const a of attrsOf(node).properties) {
          if (!ts.isJsxAttribute(a)) continue
          const init = a.initializer
          if (!init || !ts.isJsxExpression(init) || !init.expression) continue
          const ex = init.expression
          if (containsJsx(ex) || (ts.isIdentifier(ex) && identifierHasJsx(sf, ex.text))) {
            info.injected.push(a.name.getText())
          }
        }
        const kids = node.children || []
        if (
          kids.some(
            (c) =>
              ts.isJsxElement(c) ||
              ts.isJsxSelfClosingElement(c) ||
              ts.isJsxFragment(c) ||
              (ts.isJsxText(c) && c.getText().trim()),
          )
        ) {
          info.injected.push('children')
        }
      }
      for (const c of node.children || []) visit(c, false)
      return
    }
    if (ts.isJsxFragment(node)) {
      info.count++
      info.segments.push(node)
      for (const c of node.children) visit(c, false)
      return
    }
    if (ts.isJsxText(node)) {
      if (node.getText().trim()) info.count++
      return
    }
    ts.forEachChild(node, (c) => visit(c, false))
  }
  for (const r of returnRoots(findExportedComponent(sf))) visit(r, true)
  return info
}

/** 自底向上签名缓存:避免对每棵子树重复遍历(否则大屏 O(n²) 会拖死门)。 */
const SIG_CACHE = new WeakMap()

function classTokensOf(node) {
  const out = []
  for (const a of attrsOf(node).properties) {
    if (!ts.isJsxAttribute(a) || a.name.getText() !== 'className') continue
    const t = a.initializer?.getText?.() || ''
    for (const tok of t.replace(/[{}"']/g, ' ').split(/\s+/)) if (tok) out.push(tok)
  }
  return out.sort()
}

function nodeSignature(n) {
  if (SIG_CACHE.has(n)) return SIG_CACHE.get(n)
  let res
  if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
    const kids = (n.children || []).map(nodeSignature)
    const directTexts = (n.children || [])
      .filter((c) => ts.isJsxText(c) && c.getText().trim())
      .map((c) => c.getText().trim())
      .sort()
    res = {
      elements: 1 + kids.reduce((a, k) => a + k.elements, 0),
      hasText: directTexts.length > 0 || kids.some((k) => k.hasText),
      sig: `${jsxTag(n)}{${classTokensOf(n).join(' ')}}(${directTexts.join('|')})[${kids.map((k) => k.sig).join(',')}]`,
    }
  } else if (ts.isJsxFragment(n)) {
    const kids = (n.children || []).map(nodeSignature)
    const directTexts = (n.children || [])
      .filter((c) => ts.isJsxText(c) && c.getText().trim())
      .map((c) => c.getText().trim())
      .sort()
    res = {
      elements: 1 + kids.reduce((a, k) => a + k.elements, 0),
      hasText: directTexts.length > 0 || kids.some((k) => k.hasText),
      sig: `#{${directTexts.join('|')}}[${kids.map((k) => k.sig).join(',')}]`,
    }
  } else {
    const kids = []
    ts.forEachChild(n, (c) => kids.push(nodeSignature(c)))
    res = {
      elements: kids.reduce((a, k) => a + k.elements, 0),
      hasText: kids.some((k) => k.hasText),
      sig: kids.map((k) => k.sig).join(','),
    }
  }
  SIG_CACHE.set(n, res)
  return res
}

/** JSX 子树同构指纹:tag 序 + className 词集 + 非空文本集。 */
function jsxFingerprint(node) {
  const s = nodeSignature(node)
  if (s.elements < 3 && !s.hasText) return null
  return s.sig
}

function sharedFingerprints(sharedText) {
  if (typeof sharedText !== 'string') return null
  const cached = FINGERPRINT_CACHE.get(sharedText)
  if (cached) return cached
  let sf
  try {
    sf = parsePageTsx(sharedText)
  } catch {
    return null
  }
  const set = new Set()
  const walk = (n) => {
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) {
      const fp = jsxFingerprint(n)
      if (fp) set.add(fp)
    }
    ts.forEachChild(n, walk)
  }
  walk(sf)
  FINGERPRINT_CACHE.set(sharedText, set)
  if (FINGERPRINT_CACHE.size > 400) FINGERPRINT_CACHE.delete(FINGERPRINT_CACHE.keys().next().value)
  return set
}

/**
 * 与共享屏零重复 UI 段。
 * @returns {boolean|null} true=有重复段;false=零重复;null=共享屏正文读不到(不可判绿)
 */
export function hasDuplicatedUi(info, sharedText) {
  if (!info || info.segments.length === 0) return false
  if (sharedText === undefined) return false // 单测合成夹具:未提供共享屏正文
  if (sharedText === null) return null
  const sharedFps = sharedFingerprints(sharedText)
  if (!sharedFps) return null
  for (const seg of info.segments) {
    const fp = jsxFingerprint(seg)
    if (fp && sharedFps.has(fp)) return true
  }
  return false
}

/**
 * 单端消费 prop 判定。
 * @returns {string[]|null} 命中的 prop 名;null=RN 对照缺失(不可判绿)
 */
export function singleEndProps(info, rnText) {
  if (!info || info.injected.length === 0) return []
  if (rnText === undefined) return [] // 单测合成夹具:未提供 RN 正文
  if (rnText === null) return null
  return info.injected.filter((name) => !new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=`).test(rnText))
}

/**
 * 单页分类(纯函数,供门/自测/台账生成共用)。
 * @param {{route:string,file:string|null,text:string|null,loc?:number,declaredSpecs?:string[],analysisSpecs?:string[],registry?:object|null,ambiguousNames?:string[],sharedText?:string|null,rnText?:string|null}} page
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
  const specsForAnalysis = page?.analysisSpecs?.length ? page.analysisSpecs : declared
  const info = analyzePageForm(text, specsForAnalysis)
  const shellEntry = hasShellImport(text) ? '@rn-shells' : equivalentEntry(text, declared)
  const localDelta = DATA_LAYER_RE.test(codeOnly(text))
  const evidence = {
    businessJsx: info.count,
    duplicateUi: null,
    injectedProps: [...info.injected],
    singleEndProps: null,
  }
  const asCopy = (note, duplicateUi = null) => ({
    route: page.route,
    file: page.file,
    loc: page.loc ?? text.split('\n').length,
    mapStatus,
    impl: 'copy',
    reasonClass: localDelta ? 'local-delta' : 'pure-copy',
    shellEntry: shellEntry || null,
    declaredSpecs: declared,
    ...evidence,
    duplicateUi,
    note,
  })
  const asUndetermined = (note) => ({
    route: page.route,
    file: page.file,
    loc: page.loc ?? text.split('\n').length,
    mapStatus,
    impl: 'undetermined',
    reasonClass: 'undetermined',
    shellEntry: shellEntry || null,
    declaredSpecs: declared,
    ...evidence,
    note,
  })
  // 未接共享屏入口(import 与"实际渲染声明屏"双证皆无)⇒ 旧口径的复制页判定。
  if (!shellEntry && !info.invoked) {
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
        ...evidence,
        note: `屏名歧义(${(page?.ambiguousNames || []).join(',')}),不认作声明`,
      }
    }
    return asCopy(localDelta ? '有自有数据层痕迹的复制页' : '纯布局复制页(无自有数据层痕迹)')
  }
  // 结构下限:计入宿主骨架豁免后仍 ≥3 ⇒ 复制。
  if (info.count > 2) {
    return asCopy(`业务 JSX ${info.count} > 2(宿主骨架豁免后仍超结构下限)`)
  }
  const dup = hasDuplicatedUi(info, page?.sharedText)
  if (dup === true) {
    return asCopy('与共享屏存在零重复判据下的重复 UI 段', true)
  }
  const oneEnd = singleEndProps(info, page?.rnText)
  if (Array.isArray(oneEnd) && oneEnd.length > 0) {
    const row = asCopy(`单端消费 prop(${oneEnd.join(',')}): 另一端未传同名 prop`, false)
    row.singleEndProps = [...oneEnd]
    return row
  }
  if (dup === null || oneEnd === null) {
    const why = [dup === null ? '共享屏正文读不到' : null, oneEnd === null ? 'RN 对照读不到' : null]
      .filter(Boolean)
      .join(' + ')
    return asUndetermined(`${why} ⇒ 零重复/单端 prop 不可判,不报绿`)
  }
  return {
    route: page.route,
    file: page.file,
    loc: page.loc ?? text.split('\n').length,
    mapStatus,
    impl: 'shell',
    reasonClass: null,
    shellEntry: shellEntry || 'structural',
    declaredSpecs: declared,
    businessJsx: info.count,
    duplicateUi: false,
    injectedProps: [...info.injected],
    singleEndProps: [],
    localDelta,
    note: shellEntry
      ? `结构与 import 双证(业务 JSX ${info.count},零重复 UI 段,无单端 prop)`
      : `结构薄壳(业务 JSX ${info.count},零重复 UI 段,无单端 prop;未命中 import 入口)`,
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
 * @param {object[]} ledgerRows 台账在册行(用于 `not-applicable` 显式裁定的落地与反证)
 * @returns {{ rows: object[], shared: object[], pageCount: number, registryCount: number, rejectedNotApplicable: string[] }}
 */
export function classifyMiniappPages(root, face, ledgerRows = []) {
  const shared = coverage.collectShared(face)
  if (shared.length === 0) throw new Undetermined(`${face} 面枚举到 0 枚共享屏 ⇒ 判死不记绿`)
  const pages = coverage.collectMiniapp(face)
  if (pages.length === 0) throw new Undetermined(`${face} 面枚举到 0 个小程序在册页 ⇒ 判死不记绿`)
  const registry = loadRegistry(root, face)
  const idx = coverage.buildSharedIndex(shared)
  const registryMap = new Map(registry.map((e) => [e.miniapp, e]))
  const registryByShared = new Map(registry.map((e) => [e.shared, e.rn]))
  const textCache = new Map()
  /* 取数批量化的「为什么」(2026-11-07,门 299 顶穿 300s 看门狗):
   * 旧实现对**每个新 rel** 各起一次 git 子进程(共享屏 253 + RN 对照 252 ⇒ 505 次 spawn,
   * Windows 单次 ~700ms ⇒ 353s),而判据本身在 worktree 面只要 3.9s —— 差异全在取数面。
   * 所以先把本轮要读的 rel 一次收齐:共享屏正文已由上方 collectShared 在同一面、同一进程里
   * 批量预取(直取那份缓存,零 spawn),剩下的 RN 对照交由一次 readFaceBatch 灌满。
   * 语义一寸未动:取不到仍是 null(不是空串、不是跳过),照旧由 classifyPage 落到 undetermined;
   * 批量取数故障仍抛 Undetermined ⇒ exit 2,不在这里折成绿。 */
  const prefetched = new Set(shared.map((s) => s.spec))
  const rnGuess = (spec) =>
    `apps/mobile-rn/src/screens/${String(spec).split('/').pop().replace(/\.(tsx|ts|jsx|js)$/, '')}.tsx`
  const rows = []
  const undeterminedMissing = []
  // 第一遍:只解析声明与收 rel(纯内存,不落任何结论)—— 结论统一留给下面那一遍。
  const prepared = []
  const wanted = new Set()
  for (const p of pages) {
    const hay = `${p.text || ''}\n${p.cssText || ''}`
    const d = coverage.mirrorDeclarations(hay, idx)
    const reg = registryMap.get(p.route) ?? null
    if (!p.file) {
      undeterminedMissing.push(p.route)
      continue
    }
    const declaredList = [...d.specs]
    const analysisSpecs = declaredList.length > 0 ? declaredList : reg?.shared ? [reg.shared] : []
    prepared.push({ p, d, reg, analysisSpecs })
    if (analysisSpecs.length === 0) continue
    wanted.add(analysisSpecs[0])
    // RN 对照:登记表直配就读登记路径;无配读「约定路径」候选 —— 在不在、同名与否仍由正文判。
    wanted.add(registryByShared.get(analysisSpecs[0]) ?? rnGuess(analysisSpecs[0]))
  }
  const pending = []
  for (const rel of wanted) {
    if (!rel) continue
    // 磁盘面没有预取(本来就是逐件直读磁盘),统一走批量口,与本文件改前的读取路径逐字节同源。
    if (face !== 'worktree' && prefetched.has(rel)) {
      textCache.set(rel, coverage.faceRead(face, rel))
      continue
    }
    pending.push(rel)
  }
  if (pending.length > 0) {
    // 一次批量取回(不吞异常:git 派生故障 ⇒ Undetermined 原样上抛 ⇒ 门 exit 2 未判定)
    for (const [rel, txt] of readFaceBatch(root, face, pending)) textCache.set(rel, txt)
  }
  const readText = (rel) => {
    if (!rel) return null
    if (!textCache.has(rel)) textCache.set(rel, readFaceOne(root, face, rel))
    return textCache.get(rel)
  }
  // 共享屏→RN 消费端:登记表直配;无登记时只认「约定路径存在且正文含该屏名」的实证兜底。
  const resolveRn = (spec) => {
    const rel = registryByShared.get(spec)
    if (rel) return rel
    const base = String(spec).split('/').pop().replace(/\.(tsx|ts|jsx|js)$/, '')
    const guess = rnGuess(spec)
    const txt = readText(guess)
    return txt && txt.includes(base) ? guess : null
  }
  for (const { p, d, reg, analysisSpecs } of prepared) {
    const sharedText = analysisSpecs.length > 0 ? readText(analysisSpecs[0]) : null
    const rnText = analysisSpecs.length > 0 ? readText(resolveRn(analysisSpecs[0])) : null
    rows.push(
      classifyPage({
        route: p.route,
        file: p.file,
        text: p.text,
        loc: p.text ? p.text.split('\n').length : 0,
        declaredSpecs: [...d.specs],
        analysisSpecs,
        registry: reg,
        ambiguousNames: [...d.ambiguous],
        sharedText,
        rnText,
      }),
    )
  }
  if (undeterminedMissing.length > 0) {
    throw new Undetermined(
      `映射/在册页 ${undeterminedMissing.length} 条指向的页面文件读不到(例:${undeterminedMissing.slice(0, 3).join(', ')})⇒ 形态不可判`,
    )
  }
  // `not-applicable` 只用于新判定且必须可反证:页面仍接共享屏入口/仍有重复 UI 段/仍有注入型 prop/当前不可判 ⇒ 拒绝。
  const byKey = new Map(rows.map((r) => [ledgerKey(r), r]))
  const rejectedNotApplicable = []
  for (const l of ledgerRows) {
    if (l?.mapStatus !== 'not-applicable') continue
    const r = byKey.get(ledgerKey(l))
    if (!r) continue
    const stillConnected = Boolean(r.shellEntry) || r.duplicateUi === true || (r.injectedProps || []).length > 0
    if (stillConnected || r.impl === 'undetermined') {
      r.notApplicableRejected = true
      rejectedNotApplicable.push(r.route)
      const why = [
        r.shellEntry ? '仍接共享屏入口' : null,
        r.duplicateUi === true ? '仍有重复 UI 段' : null,
        (r.injectedProps || []).length > 0 ? `仍有注入型 prop(${r.injectedProps.join(',')})` : null,
        r.impl === 'undetermined' ? '当前形态不可判' : null,
      ].filter(Boolean).join(' + ')
      r.note = `台账 not-applicable 被拒: ${why};${r.note}`
      continue
    }
    r.impl = 'not-applicable'
    r.reasonClass = null
    r.note = `台账显式 not-applicable(${l.note || '无说明'});当前页面无入口/无重复/无注入 prop`
  }
  return { rows, shared, pageCount: pages.length, registryCount: registry.length, rejectedNotApplicable }
}

/**
 * 台账条目“可摘”的真值判据(只许更严,不得放宽)。
 * 只有当前判定确实成立才返回 null:页面在册且现读为薄壳、业务 JSX ≤2、零重复 UI 段、
 * 无单端消费 prop、有共享屏入口证据、且页面无本地数据层痕迹(2026-11-06 加严:薄壳只是
 * 结构面收敛,仍有本地数据层的页面不得提示“可摘”)。任一不成立都返回原因 ⇒ 调用方不得给摘除建议。
 * @param {object|null} row 当前面分类结果(`classifyPage`/`classifyMiniappPages` 的产物)
 * @returns {string|null} null = 可摘;否则为不可摘的具体原因
 */
export function retirementShortfall(row) {
  if (!row) return '当前面无对应页'
  if (row.impl === 'copy') return '现读仍为复制页'
  if (row.impl === 'undetermined') return '当前形态不可判'
  if (row.impl !== 'shell') return `当前判为 ${row.impl}(不在薄壳射程)`
  if (row.mapStatus === 'none' || row.mapStatus === 'missing-file') return '当前未接共享屏映射'
  if (row.localDelta === true) return '页面仍有本地数据层痕迹(local-delta)'
  if (typeof row.businessJsx !== 'number' || row.businessJsx > 2) {
    return `业务 JSX ${row.businessJsx} 超阈值(>2)`
  }
  if (row.duplicateUi !== false) return '仍有重复 UI 段(或不可判)'
  if (!Array.isArray(row.singleEndProps) || row.singleEndProps.length > 0) {
    return `仍有单端消费 prop(${Array.isArray(row.singleEndProps) ? row.singleEndProps.join(',') : '未取证'})`
  }
  if (!row.shellEntry) return '无共享屏入口证据'
  return null
}

/**
 * 棘轮纯判定(不读盘,供自测复用)。
 * @param {object[]} rows 当前面分类结果
 * @param {object[]} ledger 存量台账行
 * @returns {{reds: object[], advisories: object[], stats: object}}
 */
export function evaluateRatchet(rows, ledger) {
  const currentCopies = rows.filter((r) => r.impl === 'copy')
  const currentByKey = new Map(rows.map((r) => [ledgerKey(r), r]))
  const ledgerKeys = new Set(ledger.map(ledgerKey))
  const reds = []
  for (const r of currentCopies) {
    if (!ledgerKeys.has(ledgerKey(r))) {
      reds.push({
        rule: 'S1',
        why: `新增复制页未登记: ${r.route} (${r.file}, ${r.loc} 行, ${r.mapStatus}/${r.reasonClass};${r.note})`,
      })
    }
  }
  // 显式 not-applicable 的反证:页面仍接入口/有重复段/有注入 prop 时不得靠填值变绿。
  for (const r of rows) {
    if (!r.notApplicableRejected) continue
    reds.push({
      rule: 'S0',
      why: `not-applicable 声明被反证: ${r.route} (${r.note})`,
    })
  }
  const advisories = []
  for (const l of ledger) {
    const r = currentByKey.get(ledgerKey(l))
    if (r?.impl === 'not-applicable') continue
    if (r?.impl === 'undetermined') {
      advisories.push({ rule: 'S2', why: `存量页当前未判定,不得摘除: ${l.route}(${r.note})` })
      continue
    }
    // 摘除建议只认“当前判定确实成立”:复制页/重复段/单端 prop/业务 JSX 超阈值/不在射程/
    // 当前面无对应页,一律不给“可摘”,降级为只报差量或明确的“不得摘除”。
    if (!r) {
      advisories.push({ rule: 'S2', why: `存量台账条目当前面无对应页(无法核对,不得摘除): ${l.route}` })
      continue
    }
    if (r.impl === 'copy') continue
    const shortfall = retirementShortfall(r)
    if (shortfall === null && l.reasonClass === 'local-delta') {
      advisories.push({
        rule: 'S2',
        why: `存量条目台账标记为本地改动(local-delta),即使结构已收敛也不得摘除: ${l.route}`,
      })
    } else if (shortfall === null) {
      advisories.push({
        rule: 'S2',
        why: `存量复制页已收敛(可从台账摘除:业务 JSX ${r.businessJsx} ≤ 2、零重复 UI 段、无单端 prop): ${l.route}`,
      })
    } else {
      advisories.push({
        rule: 'S2',
        why: `存量条目当前判为 ${r.impl},摘除证据不成立(${shortfall}),不得摘除: ${l.route}`,
      })
    }
  }
  const ledgerLoc = new Map(ledger.map((l) => [ledgerKey(l), l.loc]))
  for (const r of currentCopies) {
    const old = ledgerLoc.get(ledgerKey(r))
    if (typeof old === 'number' && old !== r.loc) {
      advisories.push({
        rule: 'S2',
        why: `复制页行数变化(台账 ${old} → 现读 ${r.loc};仍为复制页,不得摘除): ${r.route}`,
      })
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
      notApplicable: rows.filter((r) => r.impl === 'not-applicable').length,
      ledgerRows: ledger.length,
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
