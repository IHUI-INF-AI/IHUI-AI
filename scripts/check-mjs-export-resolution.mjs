#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-mjs-export-resolution.mjs —— 相对导入的具名出口真值对账(守门 253)
 *
 * 【立因(2026-10-25 实测)】`9fdbc207ba2e`(chore: 清理功能回退残留)把
 * `scripts/lib/gitdir.mjs` 里的 `brokenRefsFromSnapshot` 当残留删了 23 行,而消费面
 * `scripts/git-guardian.mjs` 与 `scripts/tests/git-guardian-refs-batch.test.mjs` 仍在
 * `import { brokenRefsFromSnapshot } from './lib/gitdir.mjs'`。后果不是"少一个函数",
 * 而是 **整个守护起不来**:`SyntaxError: The requested module does not provide an export
 * named ...` 在实例化阶段抛,`node scripts/git-guardian.mjs` 任何档都 exit 1 ——
 * 而这条链是所有巡检腿(计划台账清扫、超龄认领牌代摘、跨端镜像自愈、本票新装的跨端造页闭环)
 * 的唯一调度器。失效形态是安静的(计划任务派了、进程死了、日志没人看)。
 *
 * 【判据】射程 = 被审面上 scripts 目录树里的全部 .mjs(调度器与判据全住这儿;app/packages 有 tsc 管)。
 *   D1 消费方(只看本枚改动的文件):相对说明符解析不到面里的文件 / 具名取用的名字不在目标出口集
 *      (出口集含 `export … from` 传递与 `export { a as b }` 别名)/ 默认导入而目标无默认出口;
 *   D2 生产方(只看本枚改动或删除的文件):上一面导出的名字本面不再导出,而射程内仍有文件按名取用
 *      —— 这一维才是 9fdbc207ba2e 那一型(实现被削、消费方一字未动)的唯一着力点;
 *   D3 调用而不 import(只看本枚改动的文件):裸调用名正好是 scripts/lib 下某模块的导出名,而本文件
 *      既没 import 它也没有自己的同名声明 ⇒ 跑到那一行必 ReferenceError。9fdbc207ba2e 同一笔还把
 *      `check-api-routes.mjs` 回退成"自带旧副本 + 删掉 lib import",副本里调的 `findBraceBlockEnd`
 *      早已搬进 `lib/api-route-registration-expand.mjs` ⇒ 门 8 一跑就
 *      `ReferenceError: findBraceBlockEnd is not defined`(2026-10-26 实测),D1/D2 都在 import 面
 *      上判,结构上看不见"没有 import 却在按名调用";
 *   D4 模块对象属性取用(只看本枚改动的文件,2026-10-30 立):`import { __test__ as G }` + `G.x(...)`、
 *      `import * as Ns` + `Ns.x(...)`,而 x 不在目标的 `__test__` 键集 / 具名出口面 ⇒ 判红。
 *      立因:当日 15:41 合车把 `gen-miniapp-mirror.mjs` 的 4 枚具名出口与 `__test__` 同名键一起洗掉,
 *      消费方走的是属性取用 ⇒ D1(只看 import 说明符,`__test__` 一直在)/D2(只看具名出口)双盲,
 *      5 件器物在 HEAD 上 ESM 链接期即抛、跨端对账与三条自愈腿停摆 1.5 小时。
 *      保守向(§12e 不造假红):仅两种"整模块对象"绑定;目标含 `export *`、`__test__` 含展开、
 *      接收者被同文件重声明 ⇒ 记「D4 未判定」不判;只查一层属性。
 *   解析不了的文件 ⇒ 记「未判定」点名,不折成绿(§0.3),也不折成"没问题";
 *   .json 目标不判(它的出口面不是 TS 语法),但计数照报,免得"跳过"被读成"验过"。
 * 【档位】D1/D2/D3/D4 都收在本枚改动集 ⇒ 结构性不可能因存量恒红(§12e),blocking 无需棘轮基线;
 *   整面命中**逐条点名**打印(2026-10-30 补:此前只报匿名数字,当日那 3 条真死链在日志里
 *   只剩「全数档存量 3 条」,看的人无从知道点的是谁),`--stock` 另给全部条目。
 * 【面】§0.4 同面同轮:全量判 HEAD blob(基线 HEAD^)、--staged 判索引 blob(基线 HEAD)、
 *   --worktree 仅人工逃生舱。
 *
 * 用法:node scripts/check-mjs-export-resolution.mjs [--staged|--worktree] [--self-test] [--json]
 * 跳过:HUSKY_SKIP_MJS_EXPORT_RESOLUTION=1(应急,须带 HUSKY_SKIP_REASON)
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import ts from 'typescript'

import {
  catBatch,
  describeProbe,
  probeFaceSpec,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCOPE_DIR = 'scripts'
const BATCH = 350
const STAR_DEPTH = 8

const argv = process.argv.slice(2)
const SELF_TEST = argv.includes('--self-test')
const git = (args) =>
  execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

/** 面读取器:枚举走 ls-tree/ls-files,正文一律批量 catBatch(逐枚取会顶穿超时,门 251 实测)。 */
function makeReader(face) {
  const listFiles = () => {
    const args =
      face === 'head'
        ? ['ls-tree', '-r', '--name-only', 'HEAD', '--', SCOPE_DIR]
        : ['ls-files', '--', SCOPE_DIR]
    const out = execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1 << 28,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    return out.split('\n').filter((p) => p.endsWith('.mjs'))
  }
  const readMany = (rels) => {
    const got = new Map()
    const prefix = face === 'staged' ? ':' : 'HEAD:'
    for (const r of rels) {
      if (face === 'worktree') got.set(r, readWorktreeFile(ROOT, r))
      else got.set(r, null)
    }
    if (face === 'worktree') return got
    // catBatch 的返回按 **spec** 装箱(`HEAD:scripts/x.mjs`),不是按裸路径 ⇒ 取值必须带同一个前缀
    //(按裸路径取 ⇒ 全体 null,会被读成"正文取不到"而整轮判未判定)。
    for (let i = 0; i < rels.length; i += BATCH) {
      const chunk = rels.slice(i, i + BATCH)
      const batch = catBatch(ROOT, chunk.map((r) => `${prefix}${r}`))
      for (const r of chunk) {
        const v = batch.get(`${prefix}${r}`)
        if (v !== null && v !== undefined) got.set(r, v)
      }
    }
    return got
  }
  return { face, listFiles, readMany }
}

/** 取一个模块的出口形状:{ names:Set, hasDefault, hasStar:[targets], syntaxFail } */
function exportsOf(path, text, cache) {
  if (cache.has(path)) return cache.get(path)
  const rec = { names: new Set(), hasDefault: false, starFrom: [], fail: null }
  cache.set(path, rec)
  let sf
  try {
    sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.MJS)
  } catch (e) {
    rec.fail = String(e?.message ?? e).slice(0, 80)
    return rec
  }
  // createSourceFile 对语法残骸不抛异常,只把诊断挂在 parseDiagnostics 上;
  // 不查它就是把"解析不了"读成"这枚模块没有出口"⇒ 造出假 R2 红(§0.3 不得冒红也不得冒绿)。
  const diags = sf.parseDiagnostics ?? []
  if (diags.length > 0) {
    rec.fail = ts.flattenDiagnosticMessageText(diags[0].messageText, ' ').slice(0, 80)
    return rec
  }
  const relOf = (spec) => (spec.startsWith('.') ? resolveSpec(path, spec) : spec)
  const hasExport = (node) => (node.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  for (const stmt of sf.statements) {
    if (ts.isExportDeclaration(stmt)) {
      if (!stmt.moduleSpecifier) {
        for (const el of stmt.exportClause?.elements ?? []) {
          // 具名再导出的**出口名是别名右半**(`export { a as b }` 对外叫 b);取 propertyName 会
          // 把内部名当出口 ⇒ 消费方按真出口取用反被判成缺出口(假阳)。
          rec.names.add(el.name.getText(sf))
          if (el.name.getText(sf) === 'default') rec.names.add('default')
        }
      } else {
        const spec = stmt.moduleSpecifier.getText(sf).replace(/^['"]|['"]$/g, '')
        if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
          for (const el of stmt.exportClause.elements) rec.names.add(el.name.getText(sf))
        } else if (!stmt.exportClause) {
          rec.starFrom.push(relOf(spec))
        }
      }
      continue
    }
    if (ts.isExportAssignment(stmt)) {
      rec.hasDefault = true
      continue
    }
    if (!hasExport(stmt)) continue
    if (ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt)) {
      if (stmt.name) rec.names.add(stmt.name.getText(sf))
      else rec.hasDefault = /export\s+default/.test(stmt.getText(sf))
      continue
    }
    if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) rec.names.add(d.name.getText(sf))
      continue
    }
    if (ts.isTypeAliasDeclaration(stmt) || ts.isInterfaceDeclaration(stmt) || ts.isEnumDeclaration(stmt)) {
      rec.names.add(stmt.name.getText(sf))
      continue
    }
    if (ts.isExpressionStatement(stmt)) {
      const t = stmt.getText(sf)
      if (/^export\s+default\b/.test(t)) rec.hasDefault = true
    }
  }
  return rec
}

/** 相对说明符解析(只认带扩展名的写法;本仓无扩展名导入在 node 下必 ERR_MODULE_NOT_FOUND)。 */
function resolveSpec(fromPath, spec) {
  if (!spec.startsWith('.')) return null
  const base = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/')) : ''
  const joined = join(base, spec).replace(/\\/g, '/')
  const out = []
  for (const seg of joined.split('/')) {
    if (seg === '.' || seg === '') continue
    if (seg === '..') out.pop()
    else out.push(seg)
  }
  return out.join('/')
}

function importsOf(path, text) {
  const list = []
  let sf
  try {
    sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.MJS)
  } catch (e) {
    return { fail: String(e?.message ?? e).slice(0, 80), list }
  }
  const diags = sf.parseDiagnostics ?? []
  if (diags.length > 0) return { fail: ts.flattenDiagnosticMessageText(diags[0].messageText, ' ').slice(0, 80), list }
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue
    const spec = stmt.moduleSpecifier.text
    if (!spec.startsWith('.')) continue
    const rec = { spec, named: [], default: false, namespace: false, at: sf.getLineAndCharacterOfPosition(stmt.getStart(sf)).line + 1 }
    const ic = stmt.importClause
    if (ic) {
      if (ic.name) rec.default = ic.name.getText(sf)
      if (ic.namespaceSpecifier) rec.namespace = true
      for (const el of ic.namedBindings?.elements ?? []) rec.named.push(el.propertyName?.getText(sf) ?? el.name.getText(sf))
    }
    list.push(rec)
  }
  return { fail: null, list }
}

/** 取模块 `export const __test__ = {...}` 的键集(纯,零 IO)。
 * 返回 null = 判不了(没这个导出 / 不是对象字面量 / 含展开 ⇒ 键不全),调用侧按"未判定"处理,不猜。 */
export function testKeysOf(path, text) {
  let sf
  try {
    sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.MJS)
  } catch {
    return null
  }
  if ((sf.parseDiagnostics ?? []).length > 0) return null
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue
    for (const d of stmt.declarationList.declarations) {
      if (!d.name || d.name.getText(sf) !== '__test__') continue
      if (!d.initializer || !ts.isObjectLiteralExpression(d.initializer)) return null
      const keys = new Set()
      for (const p of d.initializer.properties) {
        // 含展开 ⇒ 键集不完整,判了就是假红(2026-10-30 保守向)
        if (ts.isSpreadAssignment(p)) return null
        const n = p.name
        if (n && (ts.isIdentifier(n) || ts.isStringLiteral(n)))
          keys.add(n.getText(sf).replace(/^['"]|['"]$/g, ''))
      }
      return keys
    }
  }
  return null
}

/** D4(2026-10-30 立):**模块对象上的属性取用**必须真存在于出口面。
 *
 * 立因(当日实测):15:41 那笔 258 文件合车把 `scripts/gen-miniapp-mirror.mjs` 的 4 枚具名出口 + `__test__`
 * 里 4 个同名键一起洗掉,而消费方走的是 `import { __test__ as G }` + `G.buildShellPage(...)` 与
 * `import * as gen` + `gen.buildShellPage(...)` —— D1 只看 import 说明符(`__test__` 本身一直在出口面),
 * D2 只看**具名**出口被削 ⇒ 这一型在三维里全盲(实测 5 件器物在 HEAD 上 ESM 链接期即抛)。
 *
 * 判据面刻意保守(§12e 不许造假红):
 *   · 只判两种"整模块对象"绑定:namespace 导入(`import * as Ns`)、`__test__` 别名;
 *   · 目标模块含 `export *`(具名面不全)或 `__test__` 含展开 ⇒ 该绑定记 skipped,不判;
 *   · 同文件里以参数/变量/函数/类名重声明过该标识符 ⇒ 跳过(无法证明访问的就是模块对象);
 *   · 只查一层属性(`Ns.a`);`Ns.a.b` 的第二层是值属性,本门结构上不知道,不判。
 */
export function propertyAccessFindings(contents, opts = {}) {
  const { onlyPaths = null } = opts
  const findings = []
  const skipped = []
  const expCache = new Map()
  for (const [path, text] of contents) {
    if (onlyPaths && !onlyPaths.has(path)) continue
    if (text === null || text === undefined) continue
    let sf
    try {
      sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.MJS)
    } catch (e) {
      skipped.push({ path, why: `parse-throw:${String(e?.message ?? e).slice(0, 60)}` })
      continue
    }
    if ((sf.parseDiagnostics ?? []).length > 0) {
      skipped.push({ path, why: 'parse-diag' })
      continue
    }
    const bindings = new Map()
    for (const stmt of sf.statements) {
      if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue
      const spec = stmt.moduleSpecifier.text
      if (!spec.startsWith('.')) continue
      const target = resolveSpec(path, spec)
      if (!target) continue
      const ic = stmt.importClause
      if (!ic) continue
      // 命名空间导入在 AST 里是 ImportClause.namedBindings(NamespaceImport),不是 namespaceSpecifier
      // —— 后者在本仓 TS 版本上恒 undefined(2026-10-30 实测:按它判 ⇒ 这一维零候选,假绿)。
      if (ic.namedBindings && ts.isNamespaceImport(ic.namedBindings))
        bindings.set(ic.namedBindings.name.getText(sf), { target, kind: 'star' })
      for (const el of ic.namedBindings && ts.isNamedImports(ic.namedBindings) ? ic.namedBindings.elements : []) {
        if ((el.propertyName?.getText(sf) ?? el.name.getText(sf)) === '__test__')
          bindings.set(el.name.getText(sf), { target, kind: 'tester', at: sf.getLineAndCharacterOfPosition(stmt.getStart(sf)).line + 1 })
      }
    }
    if (bindings.size === 0) continue
    const shadowed = new Set()
    const collect = (node) => {
      if (
        ts.isVariableDeclaration(node) ||
        ts.isParameter(node) ||
        ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node)
      ) {
        const n = node.name
        if (n && ts.isIdentifier(n)) shadowed.add(n.getText(sf))
      }
      ts.forEachChild(node, collect)
    }
    ts.forEachChild(sf, collect)
    const faces = new Map()
    const faceOf = (b) => {
      const key = `${b.kind}:${b.target}`
      if (faces.has(key)) return faces.get(key)
      const t = contents.get(b.target)
      if (t === null || t === undefined) {
        faces.set(key, { skip: '目标面取不到' })
        return faces.get(key)
      }
      let face
      if (b.kind === 'star') {
        const rec = exportsOf(b.target, t, expCache)
        face = rec.fail
          ? { skip: `目标解析不了:${rec.fail}` }
          : rec.starFrom.length > 0
            ? { skip: '目标含 export *(具名面不全)' }
            : { names: rec.names }
      } else {
        const keys = testKeysOf(b.target, t)
        face = keys ? { names: keys } : { skip: '__test__ 键集判不了(缺/非对象字面量/含展开)' }
      }
      faces.set(key, face)
      return face
    }
    const visit = (node) => {
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
        const local = node.expression.getText(sf)
        const b = bindings.get(local)
        if (b && !shadowed.has(local)) {
          const face = faceOf(b)
          const prop = node.name.getText(sf)
          if (face.skip) {
            skipped.push({ path, at: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, name: prop, target: b.target, why: face.skip })
          } else if (!face.names.has(prop)) {
            findings.push({
              path,
              at: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
              local,
              name: prop,
              target: b.target,
              kind: b.kind,
            })
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    ts.forEachChild(sf, visit)
  }
  return { findings, skipped }
}

/** 判定核心:纯输入输出,便于夹具取证(§22c:判据只此一份实现)。 */
export function judge(contents, opts = {}) {
  const { starDepth = STAR_DEPTH } = opts
  const expCache = new Map()
  const findings = { missingModule: [], missingExport: [], missingDefault: [], unparsed: [], skippedJson: [] }
  const targetExports = (rel) => {
    const text = contents.get(rel)
    if (text === null || text === undefined) return null
    const rec = exportsOf(rel, text, expCache)
    if (rec.fail) return rec
    if (rec.starFrom.length === 0) return rec
    const merged = new Set(rec.names)
    const hasDefault = rec.hasDefault
    const walk = (p, depth) => {
      if (depth > starDepth) return
      const sub = contents.get(p)
      if (sub === null || sub === undefined) return
      const e = exportsOf(p, sub, expCache)
      for (const n of e.names) {
        if (merged.has(n)) continue
        merged.add(n)
      }
      for (const s of e.starFrom) if (s !== p) walk(s, depth + 1)
    }
    for (const s of rec.starFrom) walk(s, 1)
    return { names: merged, hasDefault, starFrom: [], fail: null }
  }
  for (const [path, text] of contents) {
    if (text === null || text === undefined) continue
    const { fail, list } = importsOf(path, text)
    if (fail) {
      findings.unparsed.push({ path, why: fail })
      continue
    }
    for (const imp of list) {
      const rel = resolveSpec(path, imp.spec)
      if (!rel) continue
      if (rel.endsWith('.json')) {
        // JSON 模块的出口面不是 TS 语法(ESM 下隐式 default + 顶层键具名),
        // 本门不判它 —— 但记一笔,免得"跳过"被读成"验过"。
        findings.skippedJson.push({ path, spec: imp.spec })
        continue
      }
      if (!contents.has(rel)) {
        findings.missingModule.push({ path, at: imp.at, spec: imp.spec, resolved: rel })
        continue
      }
      const ex = targetExports(rel)
      if (!ex || ex.fail) {
        findings.unparsed.push({ path: rel, why: '目标解析不了,该条具名取用无法判定' })
        continue
      }
      if (imp.default && !ex.hasDefault && !ex.names.has('default')) {
        findings.missingDefault.push({ path, at: imp.at, spec: imp.spec, name: imp.default })
      }
      if (imp.namespace) continue
      for (const n of imp.named) {
        if (!ex.names.has(n)) findings.missingExport.push({ path, at: imp.at, spec: imp.spec, name: n, target: rel })
      }
    }
  }
  const total =
    findings.missingModule.length + findings.missingExport.length + findings.missingDefault.length
  return { findings, total, state: findings.unparsed.length > 0 && total === 0 ? 'undetermined' : total > 0 ? 'red' : findings.unparsed.length > 0 ? 'undetermined' : 'green' }
}

/**
 * D2 生产者封堵:本次改动把某个具名出口削掉了,而射程内仍有文件按名取用 ⇒ 当场拦。
 *
 * 为什么必须有这一维:9fdbc207ba2e 削的是 `lib/gitdir.mjs` 的实现,而消费方 `git-guardian.mjs`
 * 一个字没动 ⇒ 只判"改动文件的导入"(D1)结构上打不到这一型(§门要判自己造不出的那个方向)。
 * 判据窄在本枚的改动集 ⇒ 它天然不可能因存量而恒红(§12e)。
 */
function amputations(contents, baseText, importIndex) {
  const out = []
  for (const rel of baseText.keys()) {
    const wasText = baseText.get(rel)
    const curText = contents.get(rel)
    if (wasText === null || wasText === undefined) continue // 本枚新建:没有"上一面",谈不上削掉出口
    const now = curText === null || curText === undefined ? { names: new Set(), hasDefault: false, fail: null } : exportsOf(rel, curText, new Map())
    const was = exportsOf(rel, wasText, new Map())
    if (now.fail || was.fail) continue
    const lost = [...was.names].filter((n) => !now.names.has(n))
    if (was.hasDefault && !now.hasDefault) lost.push('default')
    for (const name of lost) {
      for (const [consumer, list] of importIndex) {
        if (consumer === rel) continue
        for (const imp of list) {
          if (resolveSpec(consumer, imp.spec) !== rel && imp.spec !== rel) continue
          const takes = name === 'default' ? Boolean(imp.default) || imp.namespace : imp.named.includes(name)
          if (takes) out.push({ producer: rel, name, consumer, at: imp.at, spec: imp.spec })
        }
      }
    }
  }
  return out
}

/**
 * D3:调用而不 import(见头注)。判据面 = "lib 的导出名 × 裸调用位",保守到不猜动态取值与属性调用;
 * 本文件自己有同名声明就算有(与 lib 重名的那一型归镜像测试的接线锁,不在这一维判)。
 */
const D3_GLOBALS = new Set([
  'AbortController', 'AbortSignal', 'AggregateError', 'Array', 'ArrayBuffer', 'Atomics', 'BigInt',
  'BigInt64Array', 'BigUint64Array', 'Blob', 'Boolean', 'BroadcastChannel', 'Buffer', 'Bun',
  'DataView', 'Date', 'Deno', 'Error', 'EvalError', 'Event', 'EventTarget', 'File', 'FinalizationRegistry',
  'Float32Array', 'Float64Array', 'FormData', 'Function', 'Headers', 'Infinity', 'Int16Array', 'Int32Array',
  'Int8Array', 'Intl', 'Iterator', 'JSON', 'Map', 'Math', 'MessageChannel', 'MessagePort', 'NaN', 'Number',
  'Object', 'Promise', 'Proxy', 'RangeError', 'ReferenceError', 'Reflect', 'RegExp', 'Request', 'Response',
  'Set', 'SharedArrayBuffer', 'String', 'SuppressedError', 'Symbol', 'SyntaxError', 'TextDecoder',
  'TextEncoder', 'TypeError', 'URIError', 'URL', 'URLSearchParams', 'Uint16Array', 'Uint32Array',
  'Uint8Array', 'Uint8ClampedArray', 'WeakMap', 'WeakRef', 'WeakSet', 'WebAssembly', 'WebSocket', 'Worker',
  '__dirname', '__filename', 'afterAll', 'afterEach', 'atob', 'beforeAll', 'beforeEach', 'btoa', 'clearImmediate',
  'clearInterval', 'clearTimeout', 'console', 'crypto', 'decodeURI', 'decodeURIComponent', 'describe', 'document',
  'encodeURI', 'encodeURIComponent', 'eval', 'expect', 'exports', 'fetch', 'global', 'globalThis', 'isFinite',
  'isNaN', 'it', 'localStorage', 'module', 'navigator', 'parseFloat', 'parseInt', 'performance', 'process',
  'queueMicrotask', 'require', 'sessionStorage', 'setImmediate', 'setInterval', 'setTimeout', 'structuredClone',
  'test', 'undefined', 'vi', 'window',
])

/** lib 导出名 → 导出方文件清单(解析不了的 lib 不进索引,不让"读不懂"变成"没导出")。 */
function libExportIndex(contents) {
  const index = new Map()
  for (const [rel, text] of contents) {
    if (!rel.startsWith(`${SCOPE_DIR}/lib/`) || text === null || text === undefined) continue
    const ex = exportsOf(rel, text, new Map())
    if (ex.fail) continue
    for (const name of ex.names) {
      if (!index.has(name)) index.set(name, [])
      if (!index.get(name).includes(rel)) index.get(name).push(rel)
    }
  }
  return index
}

function undeclaredLibCalls(contents, libIndex) {
  const out = []
  for (const [rel, text] of contents) {
    if (text === null || text === undefined || !rel.endsWith('.mjs')) continue
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.MJS)
    if ((sf.parseDiagnostics ?? []).length > 0) continue
    const declared = new Set()
    const called = new Map()
    const addBinding = (name) => {
      if (ts.isIdentifier(name)) declared.add(name.text)
      else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
        for (const el of name.elements) if (ts.isBindingElement(el)) addBinding(el.name)
      }
    }
    const visit = (node) => {
      if (ts.isImportDeclaration(node) && node.importClause) {
        const ic = node.importClause
        if (ic.name) declared.add(ic.name.getText(sf))
        const nb = ic.namedBindings
        if (nb) {
          if (ts.isNamespaceImport(nb)) declared.add(nb.name.getText(sf))
          else for (const el of nb.elements) declared.add(el.name.getText(sf))
        }
      } else if (
        ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isArrowFunction(node)
      ) {
        if (node.name && ts.isIdentifier(node.name)) declared.add(node.name.getText(sf))
        for (const p of node.parameters) addBinding(p.name)
      } else if (ts.isVariableDeclaration(node)) {
        addBinding(node.name)
      } else if (ts.isClassDeclaration(node) && node.name) {
        declared.add(node.name.getText(sf))
      } else if (ts.isCatchClause(node) && node.variableDeclaration) {
        addBinding(node.variableDeclaration.name)
      } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const name = node.expression.getText(sf)
        if (!called.has(name)) {
          called.set(name, sf.getLineAndCharacterOfPosition(node.expression.getStart(sf)).line + 1)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
    for (const [name, at] of called) {
      if (declared.has(name) || D3_GLOBALS.has(name)) continue
      const exporters = libIndex.get(name)
      if (!exporters) continue
      out.push({ path: rel, at, name, exporters })
    }
  }
  return out
}

function runFace() {
  const face = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' }).face
  const reader = makeReader(face)
  const base = face === 'staged' ? 'HEAD' : 'HEAD^'
  const changed = (() => {
    try {
      const args =
        face === 'staged'
          ? ['diff', '--cached', '--name-only', base, '--', SCOPE_DIR]
          : ['diff', '--name-only', base, 'HEAD', '--', SCOPE_DIR]
      return execFileSync('git', args, {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 1 << 28,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
        .split('\n')
        .filter((p) => p.endsWith('.mjs'))
    } catch (e) {
      console.log(`❌ 未判定:改动集取不到(${String(e?.message ?? e).slice(0, 110)})——不记绿也不冒红`)
      return null
    }
  })()
  if (changed === null) return 2
  let files
  try {
    files = reader.listFiles()
  } catch (e) {
    console.log(`❌ 未判定:枚举取不到(${String(e?.message ?? e).slice(0, 120)})——不记绿也不冒红`)
    return 2
  }
  if (files.length === 0) {
    console.log('❌ 未判定:射程枚举到 0 枚 .mjs ⇒ 尺子失效,不等于"全对"(§0.3)')
    return 2
  }
  const contents = reader.readMany(files)
  const missingScope = files.filter((f) => contents.get(f) === null || contents.get(f) === undefined)
  if (missingScope.length > 0) {
    // RP-47 可观测腿(2026-10-30):未判定文案必须带**实际命令 + rc + stderr 首行**,
    // 否则"取不到"在三种故障下逐字同句(索引缺路径 / 索引被并发锁 / exec 崩),没人能定位。
    const spec = `${face === 'staged' ? ':' : 'HEAD:'}${missingScope[0]}`
    console.log(
      `❌ 未判定:${missingScope.length} 枚射程内正文取不到(首 3:${missingScope.slice(0, 3).join(', ')})` +
        `;取证:${describeProbe(probeFaceSpec(ROOT, spec))}`,
    )
    return 2
  }
  // 基线面(--staged 档取 HEAD,全量档取 HEAD^):只为 D2 的"上一面出口集"取数。
  const baseText = new Map()
  for (const rel of changed) {
    try {
      baseText.set(rel, git(['show', `${base}:${rel}`]))
    } catch {
      baseText.set(rel, null)
    }
  }
  // 闭包扩张:射程是 scripts/,但 scripts 里的测试会伸手进 packages/*/scripts —— 那些目标
  // 不在枚举里 ⇒ 直接判成"悬空模块"是假阳。按相对说明符把目标读进来,真取不到才叫悬空。
  let round = 0
  let frontier = files
  while (frontier.length > 0 && round < 5) {
    round += 1
    const next = new Set()
    for (const rel of frontier) {
      const text = contents.get(rel)
      if (text === null || text === undefined) continue
      const { list } = importsOf(rel, text)
      for (const imp of list) {
        const t = resolveSpec(rel, imp.spec)
        if (t && !contents.has(t)) next.add(t)
      }
    }
    frontier = [...next]
    if (frontier.length === 0) break
    const got = reader.readMany(frontier)
    for (const [k, v] of got) if (v !== null && v !== undefined) contents.set(k, v)
  }
  const r = judge(contents)
  const importIndex = new Map()
  for (const [p, text] of contents) {
    const { fail, list } = importsOf(p, text)
    if (!fail) importIndex.set(p, list)
  }
  const amp = amputations(contents, baseText, importIndex)
  const changedSet = new Set(changed)
  const d3All = undeclaredLibCalls(contents, libExportIndex(contents))
  const d3 = d3All.filter((f) => changedSet.has(f.path))
  const d3Stock = d3All.length - d3.length
  // D4:本枚改动文件里的"模块对象属性取用"(见 propertyAccessFindings 头注)。存量按旗标现算,默认不扫。
  const d4 = propertyAccessFindings(contents, { onlyPaths: changedSet })
  const d4Stock = argv.includes('--stock') ? propertyAccessFindings(contents, {}) : null
  const stockD1 = [
    ...r.findings.missingExport,
    ...r.findings.missingModule,
    ...r.findings.missingDefault,
  ].filter((f) => !changedSet.has(f.path))
  const d1 = {
    missingModule: r.findings.missingModule.filter((f) => changedSet.has(f.path)),
    missingExport: r.findings.missingExport.filter((f) => changedSet.has(f.path)),
    missingDefault: r.findings.missingDefault.filter((f) => changedSet.has(f.path)),
  }
  const blocking =
    d1.missingModule.length +
    d1.missingExport.length +
    d1.missingDefault.length +
    amp.length +
    d3.length +
    d4.findings.length
  for (const f of d1.missingExport) console.log(`D1 缺出口 ${f.path}:${f.at} 取 {${f.name}} ← ${f.spec}(目标 ${f.target} 现在没有这个出口)`)
  for (const f of d1.missingModule) console.log(`D1 悬空模块 ${f.path}:${f.at} ← ${f.spec}(解析为 ${f.resolved},被审面上没有)`)
  for (const f of d1.missingDefault) console.log(`D1 缺默认出口 ${f.path}:${f.at} 默认导入 ${f.name} ← ${f.spec}`)
  for (const f of amp) console.log(`D2 出口被削 ${f.producer} 不再导出 {${f.name}},而 ${f.consumer}:${f.at} 仍在按名取用 ⇒ 那一刻起它 import 即崩`)
  for (const f of d3) console.log(`D3 用了却没 import ${f.path}:${f.at} 调用 ${f.name}( —— 该名由 ${f.exporters.join(',')} 导出,本文件既没 import 它也没有同名声明 ⇒ 跑到这一行必 ReferenceError`)
  for (const f of d4.findings)
    console.log(
      `D4 属性取用越过出口面 ${f.path}:${f.at} ${f.local}.${f.name} —— ${f.kind === 'tester' ? '目标 __test__ 的键集' : '目标模块的具名出口'}里没有 ${f.name}(目标 ${f.target})⇒ 跑到这一行必 undefined/TypeError`,
    )
  for (const f of d4.skipped) console.log(`? D4 未判定 ${f.path}${f.at ? `:${f.at}` : ''}${f.name ? ` ${f.name}` : ''} —— ${f.why}`)
  // 存量点名:全数档默认打印,便于守护日志直接看见"是谁";--stock 额外给出全部条目(逐条一行)
  if (stockD1.length > 0) {
    const names = stockD1.slice(0, 3).map((f) => `${f.path}:${f.at} {${f.name}}`)
    console.log(`ℹ️ 存量点名(D1,不在本枚改动集):${stockD1.length} 条;首 3 = ${names.join(' / ')}`)
    if (argv.includes('--stock')) for (const f of stockD1) console.log(`   · ${f.path}:${f.at} {${f.name}} ← ${f.spec ?? f.resolved ?? ''}`)
  }
  if (d4Stock) {
    console.log(`ℹ️ 存量点名(D4,全射程):${d4Stock.findings.length} 条,判不了 ${d4Stock.skipped.length} 条`)
    for (const f of d4Stock.findings) console.log(`   · D4 ${f.path}:${f.at} ${f.local}.${f.name}(目标 ${f.target})`)
    for (const f of d4Stock.skipped) console.log(`   ? D4 未判定 ${f.path}${f.at ? `:${f.at}` : ''}${f.name ? ` ${f.name}` : ''} —— ${f.why}`)
  }
  for (const f of r.findings.unparsed) console.log(`? 未判定(解析不了)${f.path}:${f.why}`)
  const stock = r.total
  const stockOutside = stock - (d1.missingExport.length + d1.missingModule.length + d1.missingDefault.length)
  const head =
    blocking > 0
      ? `❌ 本枚带进 ${blocking} 条(D1 ${d1.missingExport.length + d1.missingModule.length + d1.missingDefault.length} / D2 ${amp.length} / D3 ${d3.length} / D4 ${d4.findings.length}),射程 ${contents.size} 枚,另有存量 ${stockOutside} 条不在本枚射程`
      : r.findings.unparsed.length > 0
        ? `⚠️ 未判定:${r.findings.unparsed.length} 枚解析不了 ⇒ 不记绿(射程 ${contents.size} 枚,存量 ${stock} 条)`
        : `✅ 本枚零缺口:改动 ${changed.length} 枚 .mjs,D1/D2/D3/D4 零命中(全数档存量 ${stock} 条,存量已点名见上,D3 射程外存量 ${d3Stock} 条)`
  console.log(head)
  if (argv.includes('--json')) {
    console.log(
      JSON.stringify({
        summary: {
          face,
          scanned: contents.size,
          changed: changed.length,
          d1: d1.missingExport.length + d1.missingModule.length + d1.missingDefault.length,
          d2: amp.length,
          d3: d3.length,
          d4: d4.findings.length,
          d4Skipped: d4.skipped.length,
          d3Stock,
          stockD1Named: stockD1.length,
          unparsed: r.findings.unparsed.length,
          stock,
          blocking,
          state: blocking > 0 ? 'red' : r.findings.unparsed.length > 0 ? 'undetermined' : 'green',
        },
      }),
    )
  }
  if (blocking > 0) return 1
  return r.findings.unparsed.length > 0 ? 2 : 0
}

/** 自检:全部走内存假面,零仓库 IO、零副作用;含"摘掉即翻红"正控。 */
function selfTest() {
  const mk = (obj) => new Map(Object.entries(obj))
  const cases = [
    {
      name: '具名取用有出口 ⇒ 绿',
      want: 0,
      got: () =>
        judge(
          mk({
            'scripts/a.mjs': `import { f } from './lib/b.mjs'\nexport const g = () => f()\n`,
            'scripts/lib/b.mjs': `export function f() { return 1 }\n`,
          }),
        ).total,
    },
    {
      name: '出口被删 ⇒ R2 点名(正控:9fdbc207ba2e 那一型)',
      want: 1,
      got: () =>
        judge(
          mk({
            'scripts/a.mjs': `import { f } from './lib/b.mjs'\nexport const g = () => f()\n`,
            'scripts/lib/b.mjs': `export function other() { return 1 }\n`,
          }),
        ).total,
    },
    {
      name: 'export * 传递的出口 ⇒ 算有(不得假阳)',
      want: 0,
      got: () =>
        judge(
          mk({
            'scripts/a.mjs': `import { f } from './lib/b.mjs'\n`,
            'scripts/lib/b.mjs': `export * from './c.mjs'\n`,
            'scripts/lib/c.mjs': `export const f = 1\n`,
          }),
        ).total,
    },
    {
      name: '目标文件不在面上 ⇒ R1 悬空模块',
      want: 1,
      got: () =>
        judge(
          mk({
            'scripts/a.mjs': `import { f } from './lib/ghost.mjs'\n`,
          }),
        ).total,
    },
    {
      name: '默认导入而目标无 export default ⇒ R3',
      want: 1,
      got: () =>
        judge(
          mk({
            'scripts/a.mjs': `import D from './lib/b.mjs'\n`,
            'scripts/lib/b.mjs': `export function f() {}\n`,
          }),
        ).total,
    },
    {
      name: '目标解析不了 ⇒ 未判定,不折成绿',
      want: 'undetermined',
      got: () => {
        const r = judge(
          mk({
            'scripts/a.mjs': `import { f } from './lib/b.mjs'\n`,
            'scripts/lib/b.mjs': `export function 坏( {}\n`,
          }),
        )
        return r.total === 0 && r.findings.unparsed.length > 0 ? 'undetermined' : `total=${r.total}`
      },
    },
    {
      name: 'namespace 与裸 node: 导入不误判',
      want: 0,
      got: () =>
        judge(
          mk({
            'scripts/a.mjs': `import * as fs from 'node:fs'\nimport * as b from './lib/b.mjs'\n`,
            'scripts/lib/b.mjs': `export const f = 1\n`,
          }),
        ).total,
    },
    {
      name: '具名再导出带别名(export { a as b })⇒ 按 b 取用不得判缺',
      want: 0,
      got: () =>
        judge(
          mk({
            'scripts/a.mjs': `import { b } from './lib/b.mjs'\n`,
            'scripts/lib/b.mjs': `function a() {}\nexport { a as b }\n`,
          }),
        ).total,
    },
  ]
  let pass = 0
  for (const c of cases) {
    let got
    try {
      got = c.got()
    } catch (e) {
      got = `throw:${String(e?.message ?? e).slice(0, 60)}`
    }
    const ok = got === c.want
    console.log(`${ok ? '✓' : '✗'} ${c.name}(期望 ${JSON.stringify(c.want)},实得 ${JSON.stringify(got)})`)
    if (ok) pass += 1
  }
  // D2 单列:判据面是"本枚生产方改动",不是消费方文件
  const d2Contents = mk({
    'scripts/a.mjs': `import { f } from './lib/b.mjs'\n`,
    'scripts/lib/b.mjs': `export function gone() {}\n`,
  })
  const d2Index = new Map()
  for (const [p, t] of d2Contents) d2Index.set(p, importsOf(p, t).list)
  const ampCases = [
    {
      name: 'D2 正控:上一面导出 f、本面不再导出,而 a 仍按名取用 ⇒ 1 条',
      want: 1,
      got: () =>
        amputations(d2Contents, new Map([['scripts/lib/b.mjs', `export function f() {}\n`]]), d2Index).length,
    },
    {
      name: 'D2 反向对照:上一面本来也没有 f ⇒ 不算本枚削掉(存量归存量)',
      want: 0,
      got: () =>
        amputations(d2Contents, new Map([['scripts/lib/b.mjs', `export function other() {}\n`]]), d2Index).length,
    },
    {
      name: 'D2 新建面(基线取不到)⇒ 一条也不判(不把人没写过的东西算成本枚的锅)',
      want: 0,
      got: () => amputations(d2Contents, new Map([['scripts/lib/b.mjs', null]]), d2Index).length,
    },
  ]
  for (const c of ampCases) {
    let got
    try {
      got = c.got()
    } catch (e) {
      got = `throw:${String(e?.message ?? e).slice(0, 60)}`
    }
    const ok = got === c.want
    console.log(`${ok ? '✓' : '✗'} ${c.name}(期望 ${JSON.stringify(c.want)},实得 ${JSON.stringify(got)})`)
    if (ok) pass += 1
  }
  // D3 单列:判据面是"lib 的导出名 × 裸调用位",不是 import 说明符
  const d3Of = (obj) => {
    const m = mk(obj)
    return undeclaredLibCalls(m, libExportIndex(m)).length
  }
  const d3Cases = [
    {
      name: 'D3 正控:调 lib 导出的 findBraceBlockEnd 却没 import ⇒ 1 条(9fdbc207ba2e 那一型)',
      want: 1,
      got: () =>
        d3Of({
          'scripts/a.mjs': `const x = findBraceBlockEnd(lines, i)\nexport { x }\n`,
          'scripts/lib/b.mjs': `export function findBraceBlockEnd(lines, openLine) { return openLine }\n`,
        }),
    },
    {
      name: 'D3 摘掉即翻红对照:同一文件改成 import ⇒ 0 条',
      want: 0,
      got: () =>
        d3Of({
          'scripts/a.mjs': `import { findBraceBlockEnd } from './lib/b.mjs'\nexport const x = findBraceBlockEnd(1, 2)\n`,
          'scripts/lib/b.mjs': `export function findBraceBlockEnd(lines, openLine) { return openLine }\n`,
        }),
    },
    {
      name: 'D3 本文件自己有同名声明 ⇒ 不算漏 import(重名归镜像测试的接线锁)',
      want: 0,
      got: () =>
        d3Of({
          'scripts/a.mjs': `function findBraceBlockEnd(a, b) { return b }\nexport const x = findBraceBlockEnd(1, 2)\n`,
          'scripts/lib/b.mjs': `export function findBraceBlockEnd(lines, openLine) { return openLine }\n`,
        }),
    },
    {
      name: 'D3 不属于任何 lib 导出的未声明名 ⇒ 不判(那是别的维/别的门的面)',
      want: 0,
      got: () =>
        d3Of({
          'scripts/a.mjs': `export const x = someRandomGlobal(1)\n`,
          'scripts/lib/b.mjs': `export function findBraceBlockEnd(lines, openLine) { return openLine }\n`,
        }),
    },
  ]
  for (const c of d3Cases) {
    let got
    try {
      got = c.got()
    } catch (e) {
      got = `throw:${String(e?.message ?? e).slice(0, 60)}`
    }
    const ok = got === c.want
    console.log(`${ok ? '✓' : '✗'} ${c.name}(期望 ${JSON.stringify(c.want)},实得 ${JSON.stringify(got)})`)
    if (ok) pass += 1
  }
  const d4Of = (obj, onlyPaths = null) =>
    propertyAccessFindings(mk(obj), { onlyPaths: onlyPaths ? new Set(onlyPaths) : null }).findings.length
  const d4Cases = [
    {
      name: 'D4 正控:__test__ 别名取用了一个已被削掉的键 ⇒ 1 条(2026-10-30 当日那一型)',
      want: 1,
      got: () =>
        d4Of({
          'scripts/a.mjs': `import { __test__ as G } from './b.mjs'\nexport const y = G.buildShellPage({})\n`,
          'scripts/b.mjs': `export const __test__ = { buildPage: 1 }\n`,
        }),
    },
    {
      name: 'D4 反向对照:键还在 ⇒ 0 条(不是"用了 __test__ 就红")',
      want: 0,
      got: () =>
        d4Of({
          'scripts/a.mjs': `import { __test__ as G } from './b.mjs'\nexport const y = G.buildPage({})\n`,
          'scripts/b.mjs': `export const __test__ = { buildPage: 1 }\n`,
        }),
    },
    {
      name: 'D4 命名空间导入同理:Ns.foo 而目标没导出 foo ⇒ 1 条',
      want: 1,
      got: () =>
        d4Of({
          'scripts/a.mjs': `import * as Ns from './b.mjs'\nexport const y = Ns.nope()\n`,
          'scripts/b.mjs': `export const ok = 1\n`,
        }),
    },
    {
      name: 'D4 目标含 export * ⇒ 不判(具名面不全,判了就是假红)',
      want: 0,
      got: () =>
        d4Of({
          'scripts/a.mjs': `import * as Ns from './b.mjs'\nexport const y = Ns.maybeThere()\n`,
          'scripts/b.mjs': `export * from './c.mjs'\n`,
          'scripts/c.mjs': `export const maybeThere = 1\n`,
        }),
    },
    {
      name: 'D4 __test__ 含展开 ⇒ 不判(键集不完整)',
      want: 0,
      got: () =>
        d4Of({
          'scripts/a.mjs': `import { __test__ as G } from './b.mjs'\nexport const y = G.spreadKey()\n`,
          'scripts/b.mjs': `import { x } from './c.mjs'\nexport const __test__ = { ...x }\n`,
          'scripts/c.mjs': `export const x = { spreadKey: 1 }\n`,
        }),
    },
    {
      name: 'D4 接收者被同文件重声明 ⇒ 跳过(不能证明访问的是模块对象)',
      want: 0,
      got: () =>
        d4Of({
          'scripts/a.mjs': `import { __test__ as G } from './b.mjs'\nexport const f = (G) => G.whatever()\n`,
          'scripts/b.mjs': `export const __test__ = { buildPage: 1 }\n`,
        }),
    },
    {
      name: 'D4 只判改动集:onlyPaths 之外的文件不点名',
      want: 0,
      got: () =>
        d4Of(
          {
            'scripts/a.mjs': `import { __test__ as G } from './b.mjs'\nexport const y = G.gone()\n`,
            'scripts/b.mjs': `export const __test__ = { buildPage: 1 }\n`,
          },
          ['scripts/b.mjs'],
        ),
    },
  ]
  for (const c of d4Cases) {
    let got
    try {
      got = c.got()
    } catch (e) {
      got = `throw:${String(e?.message ?? e).slice(0, 60)}`
    }
    const ok = got === c.want
    console.log(`${ok ? '✓' : '✗'} ${c.name}(期望 ${JSON.stringify(c.want)},实得 ${JSON.stringify(got)})`)
    if (ok) pass += 1
  }
  const all = cases.length + ampCases.length + d3Cases.length + d4Cases.length
  console.log(pass === all ? `自检 ${pass}/${all} 通过` : `❌ 自检 ${pass}/${all}`)
  process.exit(pass === all ? 0 : 1)
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url
if (isDirectRun) {
  if (SELF_TEST) selfTest()
  else if (!existsSync(join(ROOT, 'scripts', 'lib', 'face-reader.mjs'))) {
    console.log('❌ 未判定:face-reader 不在位,取不到被审面纪律的唯一出口')
    process.exit(2)
  } else process.exit(runFace())
}

export const __test__ = { judge, exportsOf, importsOf, resolveSpec, testKeysOf, propertyAccessFindings }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
