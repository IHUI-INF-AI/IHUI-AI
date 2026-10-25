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
 *   解析不了的文件 ⇒ 记「未判定」点名,不折成绿(§0.3),也不折成"没问题";
 *   .json 目标不判(它的出口面不是 TS 语法),但计数照报,免得"跳过"被读成"验过"。
 * 【档位】D1/D2 都收在本枚改动集 ⇒ 结构性不可能因存量恒红(§12e),blocking 无需棘轮基线;
 *   整面命中只作**存量报数**打印(现读存量由那笔批量回退造成,归属待人工裁,不由本门代裁)。
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

import { catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

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
        if (v != null) got.set(r, v)
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

/** 判定核心:纯输入输出,便于夹具取证(§22c:判据只此一份实现)。 */
export function judge(contents, opts = {}) {
  const { starDepth = STAR_DEPTH } = opts
  const expCache = new Map()
  const findings = { missingModule: [], missingExport: [], missingDefault: [], unparsed: [], skippedJson: [] }
  const targetExports = (rel) => {
    const text = contents.get(rel)
    if (text == null) return null
    const rec = exportsOf(rel, text, expCache)
    if (rec.fail) return rec
    if (rec.starFrom.length === 0) return rec
    const merged = new Set(rec.names)
    const hasDefault = rec.hasDefault
    const walk = (p, depth) => {
      if (depth > starDepth) return
      const sub = contents.get(p)
      if (sub == null) return
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
    if (text == null) continue
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
  for (const [rel, nowText] of baseText.entries()) {
    const wasText = baseText.get(rel)
    const curText = contents.get(rel)
    if (wasText == null) continue // 本枚新建:没有"上一面",谈不上削掉出口
    const now = curText == null ? { names: new Set(), hasDefault: false, fail: null } : exportsOf(rel, curText, new Map())
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
  const missingScope = files.filter((f) => contents.get(f) == null)
  if (missingScope.length > 0) {
    console.log(`❌ 未判定:${missingScope.length} 枚射程内正文取不到(首 3:${missingScope.slice(0, 3).join(', ')})`)
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
      if (text == null) continue
      const { list } = importsOf(rel, text)
      for (const imp of list) {
        const t = resolveSpec(rel, imp.spec)
        if (t && !contents.has(t)) next.add(t)
      }
    }
    frontier = [...next]
    if (frontier.length === 0) break
    const got = reader.readMany(frontier)
    for (const [k, v] of got) if (v != null) contents.set(k, v)
  }
  const r = judge(contents)
  const importIndex = new Map()
  for (const [p, text] of contents) {
    const { fail, list } = importsOf(p, text)
    if (!fail) importIndex.set(p, list)
  }
  const amp = amputations(contents, baseText, importIndex)
  const changedSet = new Set(changed)
  const d1 = {
    missingModule: r.findings.missingModule.filter((f) => changedSet.has(f.path)),
    missingExport: r.findings.missingExport.filter((f) => changedSet.has(f.path)),
    missingDefault: r.findings.missingDefault.filter((f) => changedSet.has(f.path)),
  }
  const blocking = d1.missingModule.length + d1.missingExport.length + d1.missingDefault.length + amp.length
  for (const f of d1.missingExport) console.log(`D1 缺出口 ${f.path}:${f.at} 取 {${f.name}} ← ${f.spec}(目标 ${f.target} 现在没有这个出口)`)
  for (const f of d1.missingModule) console.log(`D1 悬空模块 ${f.path}:${f.at} ← ${f.spec}(解析为 ${f.resolved},被审面上没有)`)
  for (const f of d1.missingDefault) console.log(`D1 缺默认出口 ${f.path}:${f.at} 默认导入 ${f.name} ← ${f.spec}`)
  for (const f of amp) console.log(`D2 出口被削 ${f.producer} 不再导出 {${f.name}},而 ${f.consumer}:${f.at} 仍在按名取用 ⇒ 那一刻起它 import 即崩`)
  for (const f of r.findings.unparsed) console.log(`? 未判定(解析不了)${f.path}:${f.why}`)
  const stock = r.total
  const stockOutside = stock - (d1.missingExport.length + d1.missingModule.length + d1.missingDefault.length)
  const head =
    blocking > 0
      ? `❌ 本枚带进 ${blocking} 条(D1 ${d1.missingExport.length + d1.missingModule.length + d1.missingDefault.length} / D2 ${amp.length}),射程 ${contents.size} 枚,另有存量 ${stockOutside} 条不在本枚射程`
      : r.findings.unparsed.length > 0
        ? `⚠️ 未判定:${r.findings.unparsed.length} 枚解析不了 ⇒ 不记绿(射程 ${contents.size} 枚,存量 ${stock} 条)`
        : `✅ 本枚零缺口:改动 ${changed.length} 枚 .mjs,D1/D2 零命中(全数档存量 ${stock} 条)`
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
  const all = cases.length + ampCases.length
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

export const __test__ = { judge, exportsOf, importsOf, resolveSpec }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
