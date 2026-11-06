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

import { posix } from 'node:path'
import ts from 'typescript'
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

// ─────────────────────────────────────────────────────────────────────────────
// 屏级契约(2026-11-07):单端 prop / 死契约 / 影子契约 / 未解析。
//
// WHY 独立成档:2026-11-06 形态门在 `业务 JSX > 2` 处提前 return,导致「重复 UI 段 / 单端 prop」
// 两类证据在结构下限以上的页面**根本没算过** —— 页面被判成复制页就结束,契约面漏判。
// 本档要求契约核对**无论形态结论如何都跑满全量**,四档各自出证据:
//
//   - 单端 prop  : 共享屏在 A 端被传了 prop X、B 端没传同名 prop(入口契约不对等);
//   - 死契约     : 共享屏 props 类型里声明了 X,但两端都没传、屏内正文也没消费(只声明不消费);
//   - 影子契约   : 声明与消费语义不一致 —— 声明是 X 类值(函数/布尔/字符串/数字/数组/对象),
//                  消费端却传入另一类值;或消费端传了契约里**不存在**的 prop(消费的影子)。
//   - 未解析     : 静态无法判定(共享屏正文/RN 对照读不到、props 类型解不开、属性展开、页面未渲染)。
//
// 判定纪律:
//   ① 只有在页/屏两侧都拿到 AST 证据时才判单端/死/影子;拿不到 ⇒ 只进「未解析」,绝不折绿;
//   ② props 类型解析失败/开放索引签名/未知 heritage ⇒ 整个屏记「未解析」,不猜;
//   ③ `未解析` 也是回归制的判定档:新增未解析 = 新增盲区 ⇒ 红(不允许用“无法判定”换绿)。
//   ④ 存量一律进基线(scripts/data/miniapp-shell-contract-baseline.json),只对新增做红。

const CONTRACT_BUCKETS = ['single-end', 'dead', 'shadow', 'unresolved']
export const CONTRACT_BASELINE = 'scripts/data/miniapp-shell-contract-baseline.json'
const CONTRACT_AST_CACHE = new Map()
const CONTRACT_RULE = { 'single-end': 'C1', dead: 'C2', shadow: 'C3', unresolved: 'C4' }

function contractAst(text) {
  if (typeof text !== 'string') return null
  if (CONTRACT_AST_CACHE.has(text)) return CONTRACT_AST_CACHE.get(text)
  let sf = null
  try {
    sf = ts.createSourceFile('contract.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  } catch {
    sf = null
  }
  CONTRACT_AST_CACHE.set(text, sf)
  if (CONTRACT_AST_CACHE.size > 800) CONTRACT_AST_CACHE.delete(CONTRACT_AST_CACHE.keys().next().value)
  return sf
}

function normalizeRel(p) {
  const out = []
  for (const seg of String(p || '').split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') out.pop()
    else out.push(seg)
  }
  return out.join('/')
}

const CONTRACT_MODULE_ALIASES = [
  ['@ihui/types', 'packages/types/src'],
  ['@ihui/shared', 'packages/shared/src'],
  ['@ihui/rn-app', 'packages/app/src'],
  ['@ihui/api-client', 'packages/api-client/src'],
]

/** 模块说明符 → 仓内相对路径(只解析本仓相对路径与已知 workspace 别名;解不到返回 null)。 */
function resolveContractModule(fromFile, spec) {
  if (!spec) return { base: null, tails: [] }
  // TS 的 NodeNext 写法用 `.js` 指向 `.ts` 源文件(仓内 types 包全量如此),必须先剥再试。
  const clean = spec.replace(/\.(js|jsx)$/, '')
  const tailsOf = (base) => [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]
  if (clean.startsWith('.')) {
    const dir = String(fromFile || '').split('/').slice(0, -1).join('/')
    const base = normalizeRel(`${dir}/${clean}`)
    return { base: base || null, tails: base ? tailsOf(base) : [] }
  }
  for (const [prefix, target] of CONTRACT_MODULE_ALIASES) {
    if (clean !== prefix && !clean.startsWith(`${prefix}/`)) continue
    if (clean === prefix) return { base: target, tails: [`${target}/index.ts`, `${target}/index.tsx`] }
    const tail = clean.slice(prefix.length + 1)
    const base = normalizeRel(`${target}/${tail}`)
    return { base, tails: tailsOf(base) }
  }
  return { base: null, tails: [] }
}

function readContractModule(ctx, fromFile, spec) {
  const r = resolveContractModule(fromFile, spec)
  if (!r.base) return { file: null, text: null }
  for (const cand of r.tails) {
    const txt = ctx.readFile(cand)
    if (txt !== null) return { file: cand, text: txt }
  }
  return { file: null, text: null }
}

function hasExportModifier(st) {
  return Boolean(st?.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
}

/**
 * 在「文件 + 名字」维度定位类型声明(interface / type alias),跟随 import / re-export / export *。
 * 解不到 ⇒ null(调用方记未解析,不许猜)。
 */
function findContractTypeDecl(ctx, sf, file, name, seen = new Set(), depth = 0) {
  if (!name || depth > 6) return null
  const key = `${file || '<inline>'}\u0000${name}`
  if (seen.has(key)) return null
  seen.add(key)
  if (sf) {
    for (const st of sf.statements) {
      if ((ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st)) && st.name?.text === name) {
        return { node: st, sf, file }
      }
    }
  }
  if (!sf || !file) return null
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) && st.importClause) {
      const nb = st.importClause.namedBindings
      let imported = null
      if (nb && ts.isNamedImports(nb)) {
        for (const el of nb.elements) {
          if (el.name.text === name) imported = el.propertyName?.text ?? name
        }
      }
      if (!imported) continue
      const next = readContractModule(ctx, file, st.moduleSpecifier?.text)
      if (!next.file) continue
      const r = findContractTypeDecl(ctx, contractAst(next.text), next.file, imported, seen, depth + 1)
      if (r) return r
    }
    if (ts.isExportDeclaration(st)) {
      const spec = st.moduleSpecifier?.text
      if (st.exportClause && ts.isNamedExports(st.exportClause)) {
        for (const el of st.exportClause.elements) {
          if (el.name.text !== name) continue
          const next = readContractModule(ctx, file, spec)
          if (!next.file) continue
          const r = findContractTypeDecl(ctx, contractAst(next.text), next.file, el.propertyName?.text ?? name, seen, depth + 1)
          if (r) return r
        }
      } else if (!st.exportClause && spec) {
        const next = readContractModule(ctx, file, spec)
        if (!next.file) continue
        const r = findContractTypeDecl(ctx, contractAst(next.text), next.file, name, seen, depth + 1)
        if (r) return r
      }
    }
  }
  return null
}

/**
 * 声明语义类别:只看**最外层类型节点**(旧实现用整段文本正则,`{ onSelect: () => void }`
 * 这种对象类型里有回调会被误判成 function,把消费端传对象误报成影子契约)。
 */
function declaredKindOfType(typeNode, depth = 0) {
  if (!typeNode || depth > 3) return 'unknown'
  let n = typeNode
  while (n && (ts.isParenthesizedTypeNode(n) || ts.isTypeOperatorNode(n) || ts.isOptionalTypeNode(n))) n = n.type
  if (!n) return 'unknown'
  if (ts.isFunctionTypeNode(n)) return 'function'
  if (ts.isConstructorTypeNode(n)) return 'function'
  if (n.kind === ts.SyntaxKind.BooleanKeyword) return 'boolean'
  if (n.kind === ts.SyntaxKind.StringKeyword) return 'string'
  if (n.kind === ts.SyntaxKind.NumberKeyword) return 'number'
  if (ts.isArrayTypeNode(n)) return 'array'
  if (ts.isTupleTypeNode(n)) return 'array'
  if (ts.isTypeLiteralNode(n)) return 'object'
  if (ts.isLiteralTypeNode(n)) {
    const lit = n.literal
    if (lit.kind === ts.SyntaxKind.TrueKeyword || lit.kind === ts.SyntaxKind.FalseKeyword) return 'boolean'
    if (ts.isStringLiteral(lit) || ts.isNoSubstitutionTemplateLiteral(lit)) return 'string'
    if (ts.isNumericLiteral(lit)) return 'number'
    if (lit.kind === ts.SyntaxKind.NullKeyword) return 'null'
    return 'unknown'
  }
  if (ts.isTypeReferenceNode(n)) {
    const name = n.typeName.getText().split('.').pop()
    if (name === 'TFunction' || name === 'Function') return 'function'
    if (name === 'Array' || name === 'ReadonlyArray') return 'array'
    if (name === 'Record' || name === 'Readonly') return 'object'
    return 'unknown'
  }
  if (ts.isUnionTypeNode(n)) {
    const kinds = [...new Set(n.types.map((t) => declaredKindOfType(t, depth + 1)))]
    const concrete = kinds.filter((k) => k !== 'unknown' && k !== 'null')
    return concrete.length === 1 ? concrete[0] : 'unknown'
  }
  if (ts.isIntersectionTypeNode(n)) {
    const kinds = [...new Set(n.types.map((t) => declaredKindOfType(t, depth + 1)))]
    const concrete = kinds.filter((k) => k !== 'unknown' && k !== 'null' && k !== 'object')
    return concrete.length === 1 ? concrete[0] : 'object'
  }
  return 'unknown'
}

function exprKindOf(node) {
  if (!node) return 'unknown'
  switch (node.kind) {
    case ts.SyntaxKind.ArrowFunction:
    case ts.SyntaxKind.FunctionExpression:
      return 'function'
    case ts.SyntaxKind.TrueKeyword:
    case ts.SyntaxKind.FalseKeyword:
      return 'boolean'
    case ts.SyntaxKind.StringLiteral:
    case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
      return 'string'
    case ts.SyntaxKind.NumericLiteral:
      return 'number'
    case ts.SyntaxKind.ObjectLiteralExpression:
      return 'object'
    case ts.SyntaxKind.ArrayLiteralExpression:
      return 'array'
    case ts.SyntaxKind.NullKeyword:
      return 'null'
    case ts.SyntaxKind.JsxElement:
    case ts.SyntaxKind.JsxSelfClosingElement:
    case ts.SyntaxKind.JsxFragment:
      return 'jsx'
    default:
      break
  }
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return 'number'
  }
  if (ts.isParenthesizedExpression(node)) return exprKindOf(node.expression)
  return 'unknown'
}

function attrKindOf(a) {
  const init = a?.initializer
  if (!init) return 'boolean'
  if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) return 'string'
  if (ts.isJsxExpression(init)) return exprKindOf(init.expression)
  return 'unknown'
}

function propNameOfMember(m) {
  if (!m?.name) return null
  if (ts.isIdentifier(m.name) || ts.isStringLiteral(m.name) || ts.isNumericLiteral(m.name)) return m.name.text
  return null
}

function membersOfInterface(ctx, node, sf, file, seen, depth) {
  const members = []
  const known = new Set()
  let openContract = false
  let state = 'ok'
  let reason = null
  for (const m of node.members) {
    if (ts.isIndexSignatureDeclaration(m)) {
      openContract = true
      continue
    }
    if (ts.isPropertySignature(m)) {
      const name = propNameOfMember(m)
      if (!name) continue
      if (!known.has(name)) {
        known.add(name)
        members.push({ name, optional: Boolean(m.questionToken), kind: declaredKindOfType(m.type) })
      }
      continue
    }
    if (ts.isMethodSignature(m)) {
      const name = propNameOfMember(m)
      if (name && !known.has(name)) {
        known.add(name)
        members.push({ name, optional: Boolean(m.questionToken), kind: 'function' })
      }
    }
  }
  for (const h of node.heritageClauses ?? []) {
    for (const t of h.types ?? []) {
      const name = String(t.expression?.getText?.() ?? '').split('.').pop()
      if (!name) {
        openContract = true
        continue
      }
      const decl = findContractTypeDecl(ctx, sf, file, name, seen, depth + 1)
      if (!decl) {
        openContract = true
        continue
      }
      const sub = membersOfDecl(ctx, decl.node, decl.sf, decl.file, seen, depth + 1)
      if (sub.state !== 'ok') {
        state = sub.state
        reason = sub.reason
        openContract = true
        continue
      }
      openContract = openContract || sub.openContract
      for (const p of sub.members) {
        if (known.has(p.name)) continue
        known.add(p.name)
        members.push(p)
      }
    }
  }
  return { state, reason, members, openContract }
}

function mergeMembersOfTypes(ctx, parts, sf, file, seen, depth) {
  const merged = { state: 'ok', reason: null, members: [], openContract: false }
  const known = new Set()
  for (const part of parts) {
    const r = resolvePropsTypeNode(ctx, part, sf, file, seen, depth + 1)
    if (r.state !== 'ok') return { ...r, members: merged.members }
    merged.openContract = merged.openContract || r.openContract
    for (const p of r.members) {
      if (known.has(p.name)) continue
      known.add(p.name)
      merged.members.push(p)
    }
  }
  return merged
}

function membersOfDecl(ctx, node, sf, file, seen, depth) {
  if (depth > 5) return { state: 'unresolved', reason: 'props-depth', members: [], openContract: true }
  if (ts.isInterfaceDeclaration(node)) return membersOfInterface(ctx, node, sf, file, seen, depth)
  if (ts.isTypeAliasDeclaration(node)) {
    const t = node.type
    if (ts.isTypeLiteralNode(t)) return membersOfInterface(ctx, t, sf, file, seen, depth)
    if (ts.isIntersectionTypeNode(t)) return mergeMembersOfTypes(ctx, t.types, sf, file, seen, depth)
    if (ts.isTypeReferenceNode(t)) return resolvePropsTypeNode(ctx, t, sf, file, seen, depth + 1)
    return { state: 'unresolved', reason: 'props-shape-unsupported', members: [], openContract: true }
  }
  return { state: 'unresolved', reason: 'props-shape-unsupported', members: [], openContract: true }
}

function resolvePropsTypeNode(ctx, node, sf, file, seen, depth) {
  let cur = node
  while (cur && (ts.isParenthesizedTypeNode(cur) || ts.isTypeOperatorNode(cur))) cur = cur.type
  if (!cur) return { state: 'unresolved', reason: 'props-shape-unsupported', members: [], openContract: true }
  if (ts.isTypeLiteralNode(cur)) return membersOfInterface(ctx, cur, sf, file, seen, depth)
  if (ts.isIntersectionTypeNode(cur)) return mergeMembersOfTypes(ctx, cur.types, sf, file, seen, depth)
  if (ts.isTypeReferenceNode(cur)) {
    const raw = cur.typeName.getText()
    const name = raw.split('.').pop()
    const fcLike = new Set(['FC', 'FunctionComponent', 'ComponentType', 'PropsWithChildren'])
    if (fcLike.has(name) && cur.typeArguments?.length) {
      const r = resolvePropsTypeNode(ctx, cur.typeArguments[0], sf, file, seen, depth)
      if (name === 'PropsWithChildren' && r.state === 'ok' && !r.members.some((p) => p.name === 'children')) {
        r.members = [...r.members, { name: 'children', optional: true, kind: 'unknown' }]
      }
      return r
    }
    const decl = findContractTypeDecl(ctx, sf, file, name, seen, depth)
    if (!decl) return { state: 'unresolved', reason: 'props-type-unresolved', members: [], openContract: true }
    return membersOfDecl(ctx, decl.node, decl.sf, decl.file, seen, depth + 1)
  }
  if (ts.isUnionTypeNode(cur)) return { state: 'unresolved', reason: 'props-union', members: [], openContract: true }
  return { state: 'unresolved', reason: 'props-shape-unsupported', members: [], openContract: true }
}

function findContractComponent(sf, baseName) {
  const direct = findExportedComponent(sf)
  if (direct) return direct
  const cands = []
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name && hasExportModifier(st) && /Screen$/.test(st.name.text)) {
      cands.push({ name: st.name.text, node: st })
    }
    if (ts.isVariableStatement(st) && hasExportModifier(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && /Screen$/.test(d.name.text)) cands.push({ name: d.name.text, node: d })
      }
    }
  }
  if (cands.length === 0) return null
  const exact = cands.find((c) => c.name === baseName)
  if (exact) return exact.node
  if (cands.length === 1) return cands[0].node
  return null
}

function paramsOfComponent(comp) {
  if (!comp) return []
  if (ts.isFunctionDeclaration(comp) || ts.isFunctionExpression(comp) || ts.isArrowFunction(comp)) {
    return comp.parameters ?? []
  }
  if (ts.isVariableDeclaration(comp)) {
    const init = comp.initializer
    if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) return init.parameters ?? []
    return []
  }
  return []
}

function propsTypeOfComponent(comp) {
  if (!comp) return { reason: 'component-not-found' }
  if (ts.isVariableDeclaration(comp)) {
    const anno = comp.type
    if (anno && ts.isTypeReferenceNode(anno)) {
      const name = anno.typeName.getText().split('.').pop()
      if (['FC', 'FunctionComponent', 'ComponentType'].includes(name) && anno.typeArguments?.length) {
        return { node: anno.typeArguments[0] }
      }
    }
  }
  const params = paramsOfComponent(comp)
  if (params.length === 0) return { zero: true }
  const p = params[0]
  if (!p?.type) return { reason: 'props-untyped' }
  return { node: p.type }
}

function collectContractRefs(comp) {
  const refs = new Set()
  const spreads = new Set()
  const skip = new Set(paramsOfComponent(comp))
  let destructuredRest = false
  for (const p of skip) {
    if (p?.name && ts.isObjectBindingPattern(p.name)) {
      if (p.name.elements.some((el) => el.dotDotDotToken)) destructuredRest = true
    }
  }
  const walk = (n) => {
    if (!n || skip.has(n)) return
    if (ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n) || ts.isImportDeclaration(n)) return
    if (typeof ts.isTypeNode === 'function' && ts.isTypeNode(n)) return
    if (ts.isIdentifier(n)) refs.add(n.text)
    if ((ts.isSpreadAssignment(n) || ts.isSpreadElement(n)) && ts.isIdentifier(n.expression)) {
      spreads.add(n.expression.text)
    }
    ts.forEachChild(n, walk)
  }
  walk(comp)
  return { refs, spreads, destructuredRest }
}

/**
 * 解析共享屏 props 契约。
 * @returns {{state:'ok'|'unresolved',reason:string|null,props:object[],openContract:boolean,used:Set<string>|null}}
 */
function extractScreenContract(ctx, sharedText, specRel, baseName) {
  if (typeof sharedText !== 'string') return { state: 'unresolved', reason: 'shared-unreadable', props: [], openContract: true, used: null }
  const sf = contractAst(sharedText)
  if (!sf) return { state: 'unresolved', reason: 'shared-unreadable', props: [], openContract: true, used: null }
  const comp = findContractComponent(sf, baseName)
  if (!comp) return { state: 'unresolved', reason: 'component-not-found', props: [], openContract: true, used: null }
  const info = propsTypeOfComponent(comp)
  if (info.zero) return { state: 'ok', reason: null, props: [], openContract: false, used: new Set() }
  if (!info.node) return { state: 'unresolved', reason: info.reason || 'props-untyped', props: [], openContract: true, used: null }
  const r = resolvePropsTypeNode(ctx, info.node, sf, specRel, new Set(), 0)
  if (r.state !== 'ok') return { ...r, props: [], used: null }
  const refs = collectContractRefs(comp)
  const allUsed = refs.destructuredRest || [...refs.spreads].length > 0
  return {
    state: 'ok',
    reason: null,
    props: r.members,
    openContract: Boolean(r.openContract),
    used: refs.refs,
    allUsed,
  }
}

/**
 * 契约面的消费端局部名:在 sharedLocalNames 基础上补齐 barrel 别名
 * (`import { PlazaScreen as SharedPlazaScreen } from '@ihui/rn-app'` —— 模块路径不含屏名,
 * 旧实现只认路径命中,会把 RN 侧消费点整个漏掉,导致 rn-no-element 假未解析)。
 * 仅对已知壳 barrel 放行别名,避免把同名无关组件当成共享屏。
 */
function contractLocalNames(sf, specs) {
  const names = sharedLocalNames(sf, specs)
  const bases = (specs || []).map((s) => String(s).split('/').pop().replace(/\.(tsx|ts|jsx|js)$/, '')).filter(Boolean)
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause) continue
    const mod = st.moduleSpecifier?.text || ''
    if (!/^@ihui\/rn-app(\/|$)/.test(mod) && !mod.startsWith('@rn-shells')) continue
    const nb = st.importClause.namedBindings
    if (!nb || !ts.isNamedImports(nb)) continue
    for (const el of nb.elements) {
      if (el.propertyName && bases.includes(el.propertyName.text)) names.add(el.name.text)
    }
  }
  return names
}

/** 页面/RN 对共享屏的实参面:属性名 → 传值语义类别集合;是否出现 `{...spread}`。 */
function extractConsumerUsage(text, specs) {
  if (typeof text !== 'string') return { state: 'missing', attrs: new Map(), spread: false }
  const sf = contractAst(text)
  if (!sf) return { state: 'unreadable', attrs: new Map(), spread: false }
  const names = contractLocalNames(sf, specs)
  const attrs = new Map()
  let found = false
  let spread = false
  const walk = (n) => {
    if (!n) return
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
      if (names.has(jsxTag(n))) {
        found = true
        for (const a of attrsOf(n).properties) {
          if (ts.isJsxAttribute(a)) {
            const name = a.name.getText()
            if (!attrs.has(name)) attrs.set(name, new Set())
            attrs.get(name).add(attrKindOf(a))
          } else {
            spread = true
          }
        }
      }
      for (const c of n.children ?? []) walk(c)
      return
    }
    ts.forEachChild(n, walk)
  }
  walk(sf)
  return { state: found ? 'ok' : 'not-found', attrs, spread }
}

function collectJsxNodes(node, acc) {
  if (!node) return acc
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) acc.push(node)
  ts.forEachChild(node, (c) => {
    collectJsxNodes(c, acc)
  })
  return acc
}

function lineOfNode(sf, node) {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
}

/** 页内取数痕迹(壳承载页不允许自带数据层)。 */
const CARRIER_DATA_RE =
  /(?:@ihui\/api-client|fetchApi\s*\(|\bfetch\s*\(|\bTaro\.request\s*\(|\bwx\.request\s*\(|\buni\.request\s*\(|\baxios\b|\/api\/|\buseRequest\b)/

/** 页内副作用/宿主调用痕迹(壳承载页只允许空白挂载,不允许自己再挂钩子)。
 *  `@tarojs/taro` 的运行时钩子另由 AST 识别(见 taroRuntimeImportsOf):纯壳页不引 Taro,
 *  3 个 ShareWrap 页正是靠 useDidShow/useShareAppMessage 等页内钩子保持原判。 */
const CARRIER_SIDE_EFFECT_TOKENS = ['useEffect', 'useState', 'useReducer', 'useRequest', 'Taro.', 'wx.', 'uni.']

/** 页面里 `@tarojs/taro` 的**运行时**导入(类型导入不算);有 ⇒ 端内挂钩子,不是纯载体。 */
function taroRuntimeImportsOf(sf) {
  const out = []
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause) continue
    if (st.moduleSpecifier?.text !== '@tarojs/taro') continue
    if (st.importClause.isTypeOnly) continue
    if (st.importClause.name) out.push('default')
    const nb = st.importClause.namedBindings
    if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) if (!el.isTypeOnly) out.push(el.name.text)
  }
  return out
}

/** 页面文件 + import 说明符 ⇒ 仓库相对候选路径(`@/` 与相对路径;第三方模块不解析)。 */
function resolveImportCandidates(pageFile, spec) {
  let base = null
  if (spec.startsWith('@/')) base = `apps/miniapp-taro/src/${spec.slice(2)}`
  else if (/^\.\.?(\/|$)/.test(spec)) base = posix.normalize(posix.join(posix.dirname(pageFile), spec))
  else return []
  if (/\.(tsx|ts|jsx|js)$/.test(base)) return [base]
  return [
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    `${base}/index.tsx`,
    `${base}/index.ts`,
    `${base}/index.jsx`,
    `${base}/index.js`,
  ]
}

/** 页内 JSX 节点 + 祖先链(用于证明「包装层只是壳的外罩」)。 */
function collectJsxChains(node, stack, acc) {
  if (!node) return acc
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
    acc.push({ node, parents: stack.slice() })
    if (ts.isJsxElement(node)) {
      const next = stack.concat([node])
      for (const c of node.children ?? []) collectJsxChains(c, next, acc)
    }
    return acc
  }
  ts.forEachChild(node, (c) => {
    collectJsxChains(c, stack, acc)
  })
  return acc
}

/**
 * 机械证明「透传包装层、不注参」(2026-11-07 扩模型,可证才扩)。
 *
 * 只认能被源码证据锁死的形态:包装组件只接 `children`(无其余 prop、无 ...rest)、
 * 不 `cloneElement`、不操作 `React.Children`、不自建 context、不 `createElement`,
 * 且 `children` 只作为 JSX Fragment 的直接子表达式原样透传(不包任何元素/属性)。
 * 任一条不成立 ⇒ 不予豁免,页面保持原判(仍作为独立消费端参与 C1)。
 */
function proveTransparentWrapper(ctx, pageFile, tag, moduleSpec) {
  const fail = (why, file = null) => ({ ok: false, why, file })
  if (!pageFile) return fail('wrapper-page-file-unknown')
  let file = null
  let text = null
  for (const cand of resolveImportCandidates(pageFile, moduleSpec)) {
    const t = ctx.readFile(cand)
    if (typeof t === 'string') {
      file = cand
      text = t
      break
    }
  }
  if (!file) return fail('wrapper-module-unresolved')
  const wsf = contractAst(text)
  if (!wsf) return fail('wrapper-unreadable', file)
  const comp = findExportedComponent(wsf)
  if (!comp) return fail('wrapper-component-unresolved', file)
  const params = paramsOfComponent(comp)
  if (params.length > 1) return fail('wrapper-props-unproven', file)
  if (params.length === 1) {
    const nm = params[0]?.name
    if (!nm || !ts.isObjectBindingPattern(nm)) return fail('wrapper-props-unproven', file)
    if (nm.elements.some((e) => e.dotDotDotToken)) return fail('wrapper-rest-props', file)
    const keys = nm.elements.map((e) => (e.propertyName ? e.propertyName.getText() : e.name?.getText()))
    const extra = keys.filter((k) => k !== 'children')
    if (extra.length > 0) return fail(`wrapper-extra-props:${extra.join(',')}`, file)
  }
  const code = codeOnly(text)
  if (/\bcloneElement\s*\(/.test(code)) return fail('wrapper-cloneElement', file)
  if (/\bChildren\s*[.[]/.test(code)) return fail('wrapper-children-manipulation', file)
  if (/\bcreateContext\s*\(/.test(code)) return fail('wrapper-context', file)
  if (/\bcreateElement\s*\(/.test(code)) return fail('wrapper-createElement', file)
  const usages = []
  const walk = (n, parent) => {
    if (!n) return
    if (
      ts.isJsxExpression(n) &&
      n.expression &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === 'children'
    ) {
      usages.push({ parent })
    }
    ts.forEachChild(n, (c) => walk(c, n))
  }
  walk(comp, null)
  if (usages.length === 0) return fail('wrapper-children-not-passed', file)
  if (usages.some((u) => !ts.isJsxFragment(u.parent))) return fail('wrapper-children-wrapped-in-element', file)
  return {
    ok: true,
    file,
    line: lineOfNode(wsf, comp),
    tag,
    module: moduleSpec,
    evidence: {
      params: 'children-only',
      cloneElement: false,
      childrenManipulation: false,
      context: false,
      createElement: false,
      childrenPassThrough: 'jsx-fragment',
      shellAttrsInjected: 0,
    },
  }
}

/**
 * 壳承载页取证(模型修正 2026-11-07,第二轮扩模型:透传包装层)。
 *
 * 零 attrs 壳承载页渲染的就是 RN 壳本体 —— 它本身就是 RN 屏的一部分,不是共享屏的
 * **独立消费端**。把它与 RN 壳并排比「谁传了 prop」属自比其子节点,是判据模型错误。
 *
 * 包装层扩展(可证才扩):页面若在壳外面包了一层 `AuthReadyGate` 之类,只有当包装层
 * **可机械证明为透传壳、不注参**(见 proveTransparentWrapper,且使用处自身 0 attrs),
 * 才与零 attrs 壳页同属承载页。不能证明 ⇒ 保持原判。
 *
 * 同时满足下列各条才判为承载页(任一不满足 ⇒ 保持原判,仍作为独立消费端参与 C1):
 *   ① 页面 import 的 `@rn-shells/<X>` 与声明共享屏同名(X = spec base);
 *   ② 默认导出组件的 return 树里只有 1 个 RN 壳元素,且该元素 0 个属性(无 {...spread});
 *   ③ 壳的祖先链上只允许宿主根(ThemeRoot / 根布局容器)与已证明的透传包装层;
 *      其余任何额外 JSX 都不允许;
 *   ④ 页内无取数痕迹,也无 useEffect/useState/Taro./wx./uni. 等副作用或宿主调用,
 *      且不 import `@tarojs/taro` 的运行时钩子。
 *
 * @returns {{carrier:boolean,reason:string|null,evidence:object|null}}
 */
export function detectShellCarrier(text, specs = [], opts = {}) {
  const no = (reason, evidence = null) => ({ carrier: false, reason, evidence })
  if (typeof text !== 'string' || !(specs || []).length) return no('no-spec')
  const sf = contractAst(text)
  if (!sf) return no('page-unreadable')
  const base = String(specs[0]).split('/').pop().replace(/\.(tsx|ts|jsx|js)$/, '')
  if (!base) return no('no-spec')
  const shellLocals = new Set()
  const importMap = new Map()
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause) continue
    const mod = st.moduleSpecifier?.text || ''
    if (st.importClause.name) importMap.set(st.importClause.name.text, mod)
    const nb = st.importClause.namedBindings
    if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) importMap.set(el.name.text, mod)
    if (mod !== `@rn-shells/${base}`) continue
    if (st.importClause.name) shellLocals.add(st.importClause.name.text)
    if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) shellLocals.add(el.name.text)
  }
  if (shellLocals.size === 0) return no('no-shell-entry')
  const comp = findExportedComponent(sf)
  if (!comp) return no('no-exported-component')
  const roots = returnRoots(comp)
  if (roots.length === 0) return no('no-return-jsx')
  const chains = []
  for (const rt of roots) collectJsxChains(rt, [], chains)
  const shellHits = chains.filter((x) => shellLocals.has(jsxTag(x.node)))
  if (shellHits.length !== 1) return no(`shell-elements-${shellHits.length}`)
  const shellNode = shellHits[0].node
  const shellAttrs = attrsOf(shellNode).properties
  if (shellAttrs.length !== 0) return no(`shell-attrs-${shellAttrs.length}`)
  const ctx = { readFile: typeof opts.readFile === 'function' ? opts.readFile : () => null }
  const rootSet = new Set(roots)
  const allowed = new Set([shellNode, ...shellHits[0].parents])
  const wrappers = []
  const rejected = []
  for (const parentNode of shellHits[0].parents) {
    const tag = jsxTag(parentNode)
    if (tag === 'ThemeRoot') continue
    if (rootSet.has(parentNode) && (ROOT_BASIS_RE.test(attrText(parentNode, 'className')) || /height/.test(attrText(parentNode, 'style')))) continue
    const parentAttrs = attrsOf(parentNode).properties
    if (parentAttrs.length > 0) {
      rejected.push({ tag, line: lineOfNode(sf, parentNode), why: `wrapper-attrs-${parentAttrs.length}` })
      continue
    }
    const moduleSpec = importMap.get(tag)
    if (!moduleSpec) {
      rejected.push({ tag, line: lineOfNode(sf, parentNode), why: 'wrapper-not-statically-imported' })
      continue
    }
    const proof = proveTransparentWrapper(ctx, opts.file, tag, moduleSpec)
    if (!proof.ok) {
      rejected.push({ tag, line: lineOfNode(sf, parentNode), why: proof.why, file: proof.file })
      continue
    }
    wrappers.push({
      tag,
      line: lineOfNode(sf, parentNode),
      module: moduleSpec,
      file: proof.file,
      componentLine: proof.line,
      attrCount: 0,
      proof: proof.evidence,
    })
  }
  const extra = chains.filter((x) => !allowed.has(x.node))
  if (extra.length > 0 || rejected.length > 0) {
    const evidence = [
      ...extra.map((x) => ({ tag: jsxTag(x.node), line: lineOfNode(sf, x.node) })),
      ...rejected,
    ]
    return no(`extra-jsx-${evidence.length}`, evidence)
  }
  const code = codeOnly(text)
  const pageEffects = []
  if (CARRIER_DATA_RE.test(code)) pageEffects.push('data-layer')
  for (const tok of CARRIER_SIDE_EFFECT_TOKENS) if (code.includes(tok)) pageEffects.push(tok)
  const taroHooks = taroRuntimeImportsOf(sf)
  if (taroHooks.length > 0) pageEffects.push('taro-hooks')
  if (pageEffects.length > 0) return no(`page-side-effect-${pageEffects.join(',')}`)
  return {
    carrier: true,
    reason: null,
    evidence: {
      shellEntry: `@rn-shells/${base}`,
      shellTag: jsxTag(shellNode),
      line: lineOfNode(sf, shellNode),
      attrCount: 0,
      extraJsx: 0,
      pageEffects: [],
      carrierVia: wrappers.length > 0 ? 'wrapper' : 'direct',
      wrappers,
    },
  }
}

/**
 * 屏级契约判定(纯函数,读文件走 ctx.readFile,保证与取材面同面)。
 * @param {{route:string,file:string|null,pageText:string|null,sharedText:string|null,rnText:string|null,specs:string[],readFile?:(rel:string)=>string|null}} p
 */
export function analyzeScreenContract(p) {
  const specs = p?.specs ?? []
  const empty = { inScope: false, state: 'unresolved', reason: 'no-declared-spec', buckets: { 'single-end': [], dead: [], shadow: [], unresolved: [] }, declared: 0, carrier: false, carrierEvidence: null, carrierReason: null, carrierVia: null, carrierExempt: 0 }
  if (specs.length === 0) return empty
  const ctx = { readFile: typeof p.readFile === 'function' ? p.readFile : () => null }
  const specRel = specs[0]
  const baseName = String(specRel).split('/').pop().replace(/\.(tsx|ts|jsx|js)$/, '')
  const unresolved = (code, why) => ({
    inScope: true,
    state: 'unresolved',
    reason: code,
    buckets: { 'single-end': [], dead: [], shadow: [], unresolved: [{ prop: code, why }] },
    declared: 0,
    carrier: false,
    carrierEvidence: null,
    carrierReason: null,
    carrierVia: null,
    carrierExempt: 0,
  })
  if (typeof p?.pageText !== 'string') return unresolved('page-unreadable', '页面正文在该面读不到')
  if (typeof p?.sharedText !== 'string') return unresolved('shared-unreadable', '共享屏正文在该面读不到')
  const screen = extractScreenContract(ctx, p.sharedText, specRel, baseName)
  if (screen.state !== 'ok') return unresolved(screen.reason || 'props-type-unresolved', `props 契约解不开(${screen.reason || 'unknown'})`)
  const page = extractConsumerUsage(p.pageText, specs)
  if (page.state === 'unreadable') return unresolved('page-unreadable', '页面正文解析失败')
  if (page.state === 'not-found') return unresolved('page-no-element', '页面未渲染被声明的共享屏')
  const carrier = detectShellCarrier(p.pageText, specs, { file: p.file, readFile: ctx.readFile })
  const rn = extractConsumerUsage(p.rnText, specs)
  if (rn.state === 'missing') return unresolved('rn-missing', 'RN 对照正文在该面读不到')
  if (rn.state === 'unreadable') return unresolved('rn-unreadable', 'RN 对照正文解析失败')
  if (rn.state === 'not-found') return unresolved('rn-no-element', 'RN 消费点未渲染被声明的共享屏')
  if (page.spread || rn.spread) return unresolved('spread', '实参含 {...spread},属性面不可静态枚举')

  const declared = new Map(screen.props.map((x) => [x.name, x]))
  const pageAttrs = page.attrs
  const rnAttrs = rn.attrs
  const buckets = { 'single-end': [], dead: [], shadow: [], unresolved: [] }
  const allNames = new Set([...pageAttrs.keys(), ...rnAttrs.keys()])
  let carrierExempt = 0
  for (const name of allNames) {
    const d = declared.get(name)
    if (!d) {
      if (screen.openContract) continue
      buckets.shadow.push({ prop: name, why: `消费端传了契约里不存在的 prop「${name}」` })
      continue
    }
    const kinds = [...pageAttrs.get(name) ?? [], ...rnAttrs.get(name) ?? []].filter((k) => k && k !== 'unknown')
    if (d.kind !== 'unknown' && kinds.length > 0 && kinds.some((k) => k !== d.kind)) {
      buckets.shadow.push({ prop: name, why: `声明为 ${d.kind},消费端传入 ${kinds.join('/')}` })
      continue
    }
    const inPage = pageAttrs.has(name)
    const inRn = rnAttrs.has(name)
    if (inPage !== inRn) {
      // 模型修正(2026-11-07):零 attrs 壳承载页不是独立消费端,它渲染的就是 RN 壳本体。
      // 这类「仅 RN 传」不记 C1,单独记壳承载页豁免(不进基线、不进 C5)。
      if (carrier.carrier && !inPage) {
        carrierExempt++
        continue
      }
      buckets['single-end'].push({ prop: name, why: inPage ? '仅小程序页传,RN 未传' : '仅 RN 传,小程序页未传' })
    }
  }
  const used = (name) => Boolean(screen.allUsed || screen.used?.has(name))
  for (const d of screen.props) {
    if (allNames.has(d.name)) continue
    if (used(d.name)) continue
    buckets.dead.push({ prop: d.name, why: '声明了但两端都没传、屏内正文也没消费' })
  }
  return {
    inScope: true,
    state: 'ok',
    reason: null,
    buckets,
    declared: screen.props.length,
    openContract: Boolean(screen.openContract),
    passed: { page: pageAttrs.size, rn: rnAttrs.size },
    carrier: Boolean(carrier.carrier),
    carrierEvidence: carrier.carrier ? carrier.evidence : null,
    carrierReason: carrier.carrier ? null : carrier.reason,
    carrierVia: carrier.carrier ? carrier.evidence?.carrierVia ?? 'direct' : null,
    carrierExempt,
  }
}

/** 把逐行契约证据拍平成基线条目(一条 = route + 档 + prop)。 */
export function contractItemsOf(rows) {
  const items = []
  for (const r of rows) {
    const c = r?.contract
    if (!c?.buckets) continue
    for (const bucket of CONTRACT_BUCKETS) {
      for (const hit of c?.buckets?.[bucket] ?? []) {
        items.push({ route: r.route, bucket, prop: hit.prop, why: hit.why })
      }
    }
  }
  return items
}

export function contractKey(item) {
  return `${item?.route ?? '?'}\u0000${item?.bucket ?? '?'}\u0000${item?.prop ?? '?'}`
}

/** 基线形状校验:四档枚举、字段齐全、key 唯一。返回问题清单(空 = 合法)。 */
export function validateContractBaseline(entries) {
  const bad = []
  if (!Array.isArray(entries)) return [{ why: '基线条目必须是数组' }]
  const seen = new Set()
  for (const e of entries) {
    if (!e || typeof e !== 'object') {
      bad.push({ why: '基线条目不是对象' })
      continue
    }
    const missing = ['route', 'bucket', 'prop', 'why'].filter((k) => typeof e[k] !== 'string' || !e[k])
    if (missing.length) bad.push({ why: `基线条目缺字段 ${missing.join(',')}`, entry: e })
    if (!CONTRACT_BUCKETS.includes(e.bucket)) bad.push({ why: `基线 bucket 非法: ${e.bucket}`, entry: e })
    const key = contractKey(e)
    if (seen.has(key)) bad.push({ why: `基线条目重复 key: ${key}`, entry: e })
    seen.add(key)
  }
  return bad
}

/**
 * 回归棘轮纯判定(不读盘)。
 * - 新增命中(当前有、基线无)⇒ 红(C1..C4);
 * - 基线有、当前无 ⇒ advisory(可收紧,不红);
 * - 基线非法 ⇒ 红(C0)。
 *
 * `opts.carrierRoutes`:当前面判定为「零 attrs 壳承载页」的路由集合。这些页不作为独立
 * 消费端,其 single-end 条目不进 C1;若旧基线里仍留着它们的 single-end 条目,也不进 C5,
 * 单独计入 `carrierStaleExempt`(模型修正,不是人为放行)。
 *
 * @param {object[]} items 当前面契约命中
 * @param {object[]} baseline 基线条目
 * @param {{carrierRoutes?: Set<string>}} [opts]
 */
export function evaluateContractRatchet(items, baseline, opts = {}) {
  const badBaseline = validateContractBaseline(baseline)
  const reds = badBaseline.map((b) => ({ rule: 'C0', why: b.why, row: b.entry ?? null }))
  const base = new Map((Array.isArray(baseline) ? baseline : []).filter((e) => e && typeof e === 'object' && e.route && e.bucket && e.prop).map((e) => [contractKey(e), e]))
  const current = new Map(items.map((i) => [contractKey(i), i]))
  for (const i of items) {
    if (base.has(contractKey(i))) continue
    reds.push({ rule: CONTRACT_RULE[i.bucket] ?? 'C4', why: `新增屏级契约问题(${i.bucket}): ${i.route} · ${i.prop} —— ${i.why}`, row: i })
  }
  const carrierRoutes = opts.carrierRoutes instanceof Set ? opts.carrierRoutes : new Set(opts.carrierRoutes || [])
  const advisories = []
  let carrierStaleExempt = 0
  for (const [key, e] of base) {
    if (current.has(key)) continue
    if (e.bucket === 'single-end' && carrierRoutes.has(e.route)) {
      carrierStaleExempt++
      continue
    }
    advisories.push({ rule: 'C5', why: `基线条目当前面无命中(可收紧): ${e.route} · ${e.bucket} · ${e.prop}` })
  }
  const byBucket = Object.fromEntries(CONTRACT_BUCKETS.map((b) => [b, items.filter((i) => i.bucket === b).length]))
  return {
    reds,
    advisories,
    stats: {
      items: items.length,
      baseline: base.size,
      newItems: reds.filter((r) => r.rule !== 'C0').length,
      stale: advisories.length,
      byBucket,
      carrierStaleExempt,
    },
  }
}

/** 基线只许新增:已有条目逐字保留(含 why),只追加当前面无对应条目的新命中。 */
export function mergeContractBaseline(existing, items, meta = {}) {
  const bad = validateContractBaseline(existing)
  if (bad.length) throw new Error(`基线条目非法,拒绝合并: ${bad[0].why}`)
  const kept = existing.map((e) => ({ ...e }))
  const keys = new Set(kept.map(contractKey))
  const added = []
  for (const i of items.slice().sort((a, b) => contractKey(a).localeCompare(contractKey(b)))) {
    if (keys.has(contractKey(i))) continue
    keys.add(contractKey(i))
    added.push({ route: i.route, bucket: i.bucket, prop: i.prop, why: i.why })
  }
  return {
    entries: [...kept, ...added],
    added: added.length,
    kept: kept.length,
    meta,
  }
}

/**
 * 单页分类(纯函数,供门/自测/台账生成共用)。
 * @param {{route:string,file:string|null,text:string|null,loc?:number,declaredSpecs?:string[],analysisSpecs?:string[],registry?:object|null,ambiguousNames?:string[],sharedText?:string|null,rnText?:string|null,readFile?:(rel:string)=>string|null}} page
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
      contract: null,
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
      contract: null,
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
      contract: null,
      note: '未被映射声明为镜像/委托 ⇒ 不在本判据射程',
    }
  }
  const specsForAnalysis = page?.analysisSpecs?.length ? page.analysisSpecs : declared
  const info = analyzePageForm(text, specsForAnalysis)
  const shellEntry = hasShellImport(text) ? '@rn-shells' : equivalentEntry(text, declared)
  const localDelta = DATA_LAYER_RE.test(codeOnly(text))
  // 屏级契约核对先跑,且不受形态结论影响:此前 `业务 JSX > 2` / 未接入口两处提前 return
  // 会在契约取证之前退出,导致“复制页”仅仅被点名、契约面从未被核对。现在先全量取证。
  const contract = analyzeScreenContract({
    route: page.route,
    file: page.file,
    pageText: text,
    sharedText: page?.sharedText,
    rnText: page?.rnText,
    specs: specsForAnalysis,
    readFile: page?.readFile,
  })
  const dup = hasDuplicatedUi(info, page?.sharedText)
  const oneEnd = singleEndProps(info, page?.rnText)
  const evidence = {
    businessJsx: info.count,
    duplicateUi: dup,
    injectedProps: [...info.injected],
    singleEndProps: oneEnd,
    contract,
  }
  const asCopy = (note) => ({
    route: page.route,
    file: page.file,
    loc: page.loc ?? text.split('\n').length,
    mapStatus,
    impl: 'copy',
    reasonClass: localDelta ? 'local-delta' : 'pure-copy',
    shellEntry: shellEntry || null,
    declaredSpecs: declared,
    ...evidence,
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
  // 结构下限:计入宿主骨架豁免后仍 ≥3 ⇒ 复制。注意:契约证据已在上方全量取证,
  // 这里提前 return 只决定形态结论,不再丢契约面。
  if (info.count > 2) {
    return asCopy(`业务 JSX ${info.count} > 2(宿主骨架豁免后仍超结构下限)`)
  }
  if (dup === true) {
    return asCopy('与共享屏存在零重复判据下的重复 UI 段')
  }
  if (Array.isArray(oneEnd) && oneEnd.length > 0) {
    return asCopy(`单端消费 prop(${oneEnd.join(',')}): 另一端未传同名 prop`)
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
    ...evidence,
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
    const guess = `apps/mobile-rn/src/screens/${base}.tsx`
    const txt = readText(guess)
    return txt && txt.includes(base) ? guess : null
  }
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
    const declaredList = [...d.specs]
    const analysisSpecs = declaredList.length > 0 ? declaredList : reg?.shared ? [reg.shared] : []
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
        readFile: readText,
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
 * 无单端消费 prop、有共享屏入口证据。任一不成立都返回原因 ⇒ 调用方不得给摘除建议。
 * @param {object|null} row 当前面分类结果(`classifyPage`/`classifyMiniappPages` 的产物)
 * @returns {string|null} null = 可摘;否则为不可摘的具体原因
 */
export function retirementShortfall(row) {
  if (!row) return '当前面无对应页'
  if (row.impl === 'copy') return '现读仍为复制页'
  if (row.impl === 'undetermined') return '当前形态不可判'
  if (row.impl !== 'shell') return `当前判为 ${row.impl}(不在薄壳射程)`
  if (row.mapStatus === 'none' || row.mapStatus === 'missing-file') return '当前未接共享屏映射'
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
    if (shortfall === null) {
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
