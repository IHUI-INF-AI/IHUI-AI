// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 壳承载页的**依赖闭包射程**判据(单一真相源)。
 *
 * 立因(2026-10-26 现读):小程序端承载 RN 壳时,端内只写一层 ThemeRoot,壳自己的 import 全部
 * 由 webpack 按别名表去解析。别名表只覆盖 10 枚,而 packages/app + apps/mobile-rn 的源里
 * 实际出现的 RN 侧裸包有 20 枚(expo-asset/expo-audio/expo-document-picker/react-native-svg/…)。
 * 一旦某枚未别名包进入图,weapp 构建当场 ModuleParseError(expo-modules-core 的 package.json
 * 里 "main": "src/index.ts" —— Expo SDK 57 发的是未编译 TS,webpack 侧没有 loader 处理)。
 * 也就是说:**落一页之前,这一页会拖进哪些裸包,必须事先算得出**,而不是等构建炸。
 *
 * 本文件只做纯图遍历(零 IO、零判定),取文件内容由调用方注入,便于门与器物共用(§0.6)。
 */
import ts from 'typescript'

const TS_EXTS = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json']
/** 相对导入带目录形态时按 index.* 补全(Taro/Metro 都这么解)。 */
const INDEX_FILES = TS_EXTS.map((e) => `index${e}`)

/** 一个文件里所有"说明符 + 是否值导入"的取用点(import/export from,含裸 side-effect import)。 */
export function specifiersOf(text, lang = ts.ScriptKind.TSX) {
  const out = []
  let src
  try {
    src = ts.createSourceFile('x', text, ts.ScriptTarget.Latest, true, lang)
  } catch {
    return out
  }
  const push = (node) => {
    if (!node.moduleSpecifier || typeof node.moduleSpecifier.text !== 'string') return
    const spec = node.moduleSpecifier.text
    // `import type … from 'x'` 与 `export type … from 'x'` 在编译期被擦除 ⇒ 不进图
    const isTypeOnly = Boolean(node.importClause?.isTypeOnly) || Boolean(node.exportClause?.isTypeOnly)
    if (isTypeOnly) return
    const names = []
    const cl = node.importClause
    if (cl?.name) names.push(cl.name.text)
    if (cl?.namedBindings?.elements) for (const e of cl.namedBindings.elements) names.push((e.propertyName ?? e.name).text)
    // 星号导出(`export * from './auth'`)没有 exportClause ⇒ 直接把它喂给 isNamedExports 会炸
    // (`Cannot read properties of undefined (reading 'kind')`,2026-10-28 实测打崩磁盘面整条链:
    //  `pnpm gen:i18n` 与 `build:weapp` 都走磁盘面)。先判在位再问形态。
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const e of node.exportClause.elements) names.push(e.propertyName?.text ?? e.name.text)
    }
    out.push({ spec, names, kind: ts.isExportDeclaration(node) ? 'export' : 'import' })
  }
  const walk = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isExternalModuleReference?.(node)) push(node)
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0]) {
      const a = node.arguments[0]
      if (ts.isStringLiteral(a)) out.push({ spec: a.text, names: [], kind: 'dynamic' })
    }
    node.forEachChild(walk)
  }
  src.statements.forEach(walk)
  return out
}

const isRel = (s) => s.startsWith('.') || s.startsWith('/')

/**
 * 图遍历:roots = [{file, text}]。
 * resolveRel(fromFile, spec) ⇒ 归一化后的仓库相对路径或 null(解不到 = unresolved,必须点名不得静默);
 * bareOf(spec) ⇒ 判定是否裸包(默认:非相对且非端内别名)。
 * 返回 {files, externals:Map<包名,{from:Set, names:Set}>, unresolved}。
 */
export function walkClosure({ roots, readFile = null, readBatch = null, toRel, isBare = (s) => !isRel(s) && !s.startsWith('@/'), barrelOf = null }) {
  const files = new Set()
  const externals = new Map()
  const unresolved = []
  const seen = new Set()
  // 两种取面方式同一份遍历:
  //   readFile —— 磁盘面(逐份读);readBatch —— git 面(整层一次 cat-file,122 个文件按 6~8 层批量取满,
  //   逐份 spawn 会让这道门在 pre-commit 慢到没人跑,而门一慢就等于没装车)。
  const batch = readBatch ?? ((rels) => new Map(rels.map((r) => [r, readFile ? readFile(r) : null])))
  let layer = []
  for (const r of roots) {
    if (seen.has(r.file)) continue
    seen.add(r.file)
    layer.push(r)
  }
  while (layer.length > 0) {
    const wanted = new Set()
    const edges = []
    for (const { file, text } of layer) {
      files.add(file)
      if (text === null || text === undefined) {
        unresolved.push({ from: file, spec: '(正文取不到)', note: 'readBatch/readFile 返回空 ⇒ 该支路没走' })
        continue
      }
      const lang = file.endsWith('.ts') && !file.endsWith('.d.ts') ? ts.ScriptKind.TS : ts.ScriptKind.TSX
      for (const { spec, names } of specifiersOf(text, lang)) {
        if (isBare(spec)) {
          const key = pkgNameOf(spec)
          const cur = externals.get(key) ?? { from: new Set(), names: new Set(), specs: new Set() }
          cur.from.add(file)
          for (const n of names) cur.names.add(n)
          cur.specs.add(spec)
          externals.set(key, cur)
          continue
        }
        const expanded = barrelOf?.(file, spec, names) ?? null
        if (expanded) {
          for (const r of expanded) if (!seen.has(r)) wanted.add(r)
          continue
        }
        let rel
        try {
          rel = toRel(file, spec)
        } catch {
          rel = null
        }
        if (rel === null || rel === undefined) {
          unresolved.push({ from: file, spec, note: '射程内的说明符但落点算不出(别名映射缺条目)' })
          continue
        }
        if (!seen.has(rel)) wanted.add(rel)
        edges.push({ from: file, spec, rel })
      }
    }
    const rels = [...wanted]
    if (rels.length === 0) break
    let got
    try {
      got = batch(rels)
    } catch (error) {
      unresolved.push({ from: '(本层)', spec: `readBatch 失败:${String(error?.message ?? error).slice(0, 80)}`, note: '整层未取到 ⇒ 不猜,点名' })
      break
    }
    const next = []
    for (const rel of rels) {
      if (seen.has(rel)) continue
      const t = got.get(rel) ?? null
      if (t === null || t === undefined) {
        const edge = edges.find((e) => e.rel === rel)
        if (edge) unresolved.push({ from: edge.from, spec: edge.spec, note: `解析到 ${rel} 但面上取不到正文` })
        continue
      }
      seen.add(rel)
      next.push({ file: rel, text: t })
    }
    layer = next
  }
  return { files, externals, unresolved, TS_EXTS, INDEX_FILES }
}

/** 'expo-asset' / 'expo-asset/xxx' / '@scope/pkg/deep' ⇒ '@scope/pkg' 或 'pkg'。 */
export function pkgNameOf(spec) {
  const seg = spec.split('/')
  return spec.startsWith('@') ? `${seg[0]}/${seg[1]}` : seg[0]
}

/** 只有这些名字在"入口即未编译 TS / 依赖原生模块"一族里 —— 它们在 weapp 侧必须有别名承载(缺一个就炸构建)。 */
export const RN_NATIVE_RE = /^(react-native(-[-\w]+)?|expo[-\w]*|@react-native[\w-]*\/[\w-]+|@expo\/[\w-]+|nativewind)$/

/** 别名表键:按 AST 取 `alias: { … }` 对象字面量的属性名(两处块都要,顶层与平台段是整体替换关系)。 */
export function aliasKeysOf(text, lang = ts.ScriptKind.TS) {
  const keys = []
  const src = ts.createSourceFile('cfg', text, ts.ScriptTarget.Latest, true, lang)
  const walk = (node) => {
    if (ts.isPropertyAssignment(node) && node.name.getText() === 'alias' && ts.isObjectLiteralExpression(node.initializer)) {
      for (const p of node.initializer.properties) keys.push((p.name?.getText() ?? '').replace(/^['"]|['"]$/g, ''))
    }
    node.forEachChild(walk)
  }
  src.statements.forEach(walk)
  return keys
}

const covered = (keys, pkg) => keys.some((k) => k.replace(/\$$/, '') === pkg)

/** 闭包 externals ∩ RN 原生族 − 别名表 = 未覆盖清单(每条带取用者,直接给人当工单)。 */
export function uncoveredNativePackages(externals, aliasKeys) {
  const out = []
  for (const [pkg, info] of externals) {
    if (!RN_NATIVE_RE.test(pkg)) continue
    if (covered(aliasKeys, pkg)) continue
    out.push({ pkg, importers: [...info.from], names: [...info.names] })
  }
  return out.sort((a, b) => a.pkg.localeCompare(b.pkg))
}

export const __test__ = {
  specifiersOf,
  walkClosure,
  pkgNameOf,
  aliasKeysOf,
  uncoveredNativePackages,
  RN_NATIVE_RE,
  isBareDefault: (s) => !isRel(s) && !s.startsWith('@/'),
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
