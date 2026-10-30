#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI-AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 守门 266:共享样式工厂键集 ↔ 跨文件具名取用 对账。
 *
 * 立因(g35-s11 一手实测,2026-10-30 23:44,基线 65ae5d6d23c→f50ac30bc26):
 * `pnpm turbo typecheck --filter=@ihui/mobile-rn` 现跑 RC=1,4 条红的形态是
 * 「别席改了共享样式源的键名,消费面没同批改」。而 `scripts/check-staged-typecheck.mjs` 的
 * `filterTscOutputForStagedFiles()` 里写的是 `pendingIsStaged = stagedAbs.has(fileAbs)`
 * —— **非暂存文件的 tsc 报错被整条丢弃**。于是「只暂存样式源、消费面留在未暂存区」这一刀切法
 * ⇒ 提交门读成绿,而 tsc 真红落进 HEAD。绿灯本身就是缺陷(本仓登记过的型),所以补的不是
 * "再看一遍暂存文件",而是**把两侧放在同一面上成对判**。
 *
 * 历史同型两枚(git show 现读可复):`876c4cb418`(把消费面翻成新键名 ⇒ HEAD 顶成类型红)与
 * `bd41560d83`("不修则 RN 包谁都推不动"翻回)。**两次都只动了消费面,样式源从未同批改**
 * ⇒ 两侧都不是"写错的那一侧",只有"不同批"才是错 —— 本门因此判**配对**,不判单边。
 *
 * ─── 现读口径(§0.1 数字一律现读;以下为 2026-10-30 立门当次 HEAD 面实测)────────
 *  · 什么算「共享样式源」:被跟踪的 `.ts`/`.tsx`,落在 SOURCE_ROOTS 内,且**其导出的**
 *    函数/常量箭头里含 `StyleSheet.create({…})` 字面量。当次 HEAD 面实测 **20 枚源文件 / 21 枚工厂**,
 *    其中 18 枚是 `*-styles.ts` 表,另 2 枚是同名导出的工厂文件
 *    (`packages/app/src/components/NotificationCard.tsx` 的 createCardStyles、
 *     `apps/mobile-rn/src/screens/EduParentUi.tsx` 的 createParentStyles)。
 *    射程只这两根的依据:`packages/app/package.json` 的 `exports` 只放行 `.` 与 `./pilot`,
 *    barrel 之外的深路径**跨端取不到** ⇒ miniapp/web 结构上不可能按名取用这些工厂,列进射程只会造噪声。
 *  · 同文件本地 StyleSheet 定义的取用**一律放过**(§12e 的生死线):HEAD 面 `tabTextActive` 命中 31 文件 / 66 行
 *    (s20 于 HEAD 116db998 复测 grep 现读)、绝大多数每处都有同文件本地 StyleSheet 定义 —— 判它们 = 当场恒红
 *    = 逼人 `--no-verify` = 废掉全部守门;实跑末行「放过的本地/未知绑定」即这条的读数。
 *    放过不止一条路:标识符只要沾上任一"本文件内造"的绑定(直接 `StyleSheet.create`、调用本文件声明的工厂、
 *    对象字面量/未知来源赋值),整个标识符退出判定(宁漏不误伤)。
 *  · 档位决定:HEAD 面现读(s20 复测 HEAD 116db998,末行同读数)**跨文件具名取用 1208 枚全部命中键集,
 *    违规 0 枚、未判定 0**(两侧自洽,s11 已证)⇒ 本门**从第一天起绝对零容忍**,不建基线件、不走差值棘轮。
 *    数字一律现读(§0.1):改门后重跑 `node scripts/check-style-key-consumption.mjs` 取末行,勿照抄本行。
 *    若将来 HEAD 面出现存量,升档前置仍是
 *    "存量归零",不是把判据锯短。
 *
 * ─── 判据四条 ────────────────────────────────────────────────────────────
 *  A 源侧:导出工厂的**顶层键集合** S(含 `…spread`、计算键 `[x]`、非字面量入参的工厂标 partial ⇒ 整枚不判,
 *    因为键集不完备时"缺键"结论不成立);
 *  B 消费侧:标识符 `<id>` 绑定到**来自别的文件**的导入工厂(赋值形态 `const id = F(tk)` /
 *    `useMemo(() => F(tk), …)`,以及形参 `styles: Styles` 而 `Styles` 由源文件以
 *    `type Styles = ReturnType<typeof F>` 导出)时,其 `<id>.<KEY>` / `<id>?.<KEY>` / `<id>['KEY']` /
 *    `const {KEY} = F(tk)` 必须满足 KEY ∈ S(多工厂绑同一标识符取并集,保守放过);
 *  C 放过:同文件本地 StyleSheet/本地工厂/未知来源绑定 → 该标识符整枚退出(见上);
 *  D 面:全量档判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅人工逃生舱;两面旗同给
 *    ⇒ exit 2;任一候选 blob 取不到 / 解析报错 / 源枚举到 0 / 一枚都没判成 ⇒ **未判定 exit 2**,
 *    既不记绿也不冒红,且不回落另一个面(§0.3 §0.4)。
 *
 * ─── 两档的"报什么" ──────────────────────────────────────────────────────
 *  · 全量档(HEAD):面内**全部**配对都判 ⇒ 绝对零容忍(CI 的 Guardian Full 跑的就是这一档)。
 *  · 索引档(--staged):内容仍两面同取(源与消费都读索引 blob),但**只报本次改动集带进来的配对**
 *    (源文件或消费文件至少一枚在 `git diff --cached` 里)。为什么这么切:本仓共享一枚索引,
 *    别席在飞的配对若也报红,就成了提交者结构上满足不了的恒红门(§12e);而 s11 那一刀 ——
 *    源被暂存、消费面留在工作树 —— 恰好在"源在改动集里"这一格里,照样咬住。
 *
 * CLI:
 *   node scripts/check-style-key-consumption.mjs                # HEAD 面(全量,零容忍)
 *   node scripts/check-style-key-consumption.mjs --staged       # 索引面(pre-commit)
 *   node scripts/check-style-key-consumption.mjs --worktree     # 人工排查,不作提交判据
 *   node scripts/check-style-key-consumption.mjs --json         # 机读(末行走 stderr,stdout 保持纯 JSON)
 *   node scripts/check-style-key-consumption.mjs --self-test    # 判据自检(含"本地定义放过"正反对照)
 * 跳过:HUSKY_SKIP_STYLE_KEY_CONSUMPTION=1(应急,须带 HUSKY_SKIP_REASON)
 */
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import ts from 'typescript'

import { catBatch, listFaceFiles, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const NAME = 'style-key-consumption'

/** 射程(现读依据见头注):只有这两根能造出"源在 A 文件、消费在 B 文件"的配对 */
export const SOURCE_ROOTS = Object.freeze(['packages/app/src', 'apps/mobile-rn/src'])

/** 注册条目本体:主席把这一枚整块追加进 scripts/guardian-runner.mjs 的 checks 数组即可。 */
export const REGISTRY_ENTRY = `  {
    // 编号 266:注册前已核 \`git show HEAD:scripts/guardian-runner.mjs | grep -c "id: '266'"\` 为 0;现值以本文件为准。
    id: '266',
    label:
      '🧵 共享样式工厂键集 ↔ 跨文件具名取用对账(blocking;治"只暂存样式源、消费面留在未暂存区"被提交门读成绿 —— 两侧同面成对判,同文件本地 StyleSheet 一律放过)',
    script: 'check-style-key-consumption.mjs',
    // args 刻意留空:--staged 由 runner 在 staged 模式统一追加(runner 头注的硬规矩),
    // 写死会让"不带 --staged 的全量审计"也只判索引面 ⇒ 全量档永远看不到 HEAD 的真形状。
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_STYLE_KEY_CONSUMPTION',
    stagedTriggers: ['packages/app/', 'apps/mobile-rn/'],
    onFailHint: [
      '  💡 红的意思是:某处 \`<id>.<KEY>\` 按名取的键,不在它绑定的跨文件样式工厂的键集里。',
      '     ① 看清单:node scripts/check-style-key-consumption.mjs --staged;',
      '     ② 修法只有一条 —— **源与消费同批改**(两侧任一单独翻键名都会让 HEAD 变类型红,历史两枚 876c4cb418/bd41560d83 就是这么来的);',
      '     ③ 判据本体:node scripts/check-style-key-consumption.mjs --self-test;',
      '     禁止为消红把工厂标 partial(加 spread)或把消费面改成本地 StyleSheet 定义 —— 那是把尺子锯短(§12e)。',
    ]
  },`

const BATCH = 400
const git = (args, root = ROOT) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

// ─── 取材面 ────────────────────────────────────────────────────────────────
/** 候选清单与正文同面同轮(§0.4):清单来自 listFaceFiles,正文一律批量 catBatch/磁盘。 */
export function listCandidates(face, root = ROOT) {
  const out = []
  for (const r of SOURCE_ROOTS) out.push(...listFaceFiles(root, face, { paths: [r] }))
  return [...new Set(out)].filter((p) => /\.tsx?$/.test(p))
}

export function readContents(face, rels, root = ROOT) {
  const got = new Map()
  if (face === 'worktree') {
    for (const r of rels) got.set(r, readWorktreeFile(root, r))
    return got
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  for (let i = 0; i < rels.length; i += BATCH) {
    const chunk = rels.slice(i, i + BATCH)
    const specs = chunk.map((r) => `${prefix}${r}`)
    const batch = catBatch(root, specs)
    for (const s of specs) got.set(s.slice(prefix.length), batch.get(s) ?? null)
  }
  return got
}

/** 本次改动集(索引档用来锚"这枚提交带进来了什么";全量档返回 null = 不筛)。 */
export function changedSet(face, root = ROOT) {
  if (face !== 'staged') return null
  const out = git(['diff', '--cached', '--name-only', '-z', '--', ...SOURCE_ROOTS], root)
  return new Set(String(out).split('\u0000').filter(Boolean))
}

// ─── 判据核心(纯函数,无 IO ⇒ 镜像测试直接 import)────────────────────────
function parseFile(rel, text) {
  const kind = rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, kind)
  const diags = sf.parseDiagnostics ?? []
  return { sf, fail: diags.length ? ts.flattenDiagnosticMessageText(diags[0].messageText, ' ') : null }
}

function objectLiteralKeys(node, sf) {
  const keys = new Set()
  let partial = false
  for (const p of node.properties) {
    const named = ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)
    if (named && !ts.isComputedPropertyName(p.name)) keys.add(p.name.getText(sf))
    else partial = true
  }
  return { keys, partial }
}

function isStyleSheetCreate(node, sf) {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.getText(sf) === 'create' &&
    node.expression.expression.getText(sf) === 'StyleSheet'
  )
}

/** 一枚声明体里所有 `StyleSheet.create({…})` 的顶层键并集;形态不完备 ⇒ partial。 */
function keysOfBody(body, sf) {
  const found = []
  const walk = (n) => {
    if (isStyleSheetCreate(n, sf) && n.arguments.length === 1 && ts.isObjectLiteralExpression(n.arguments[0]))
      found.push(objectLiteralKeys(n.arguments[0], sf))
    ts.forEachChild(n, walk)
  }
  walk(body)
  if (found.length === 0) return null
  const keys = new Set()
  let partial = false
  for (const f of found) {
    for (const k of f.keys) keys.add(k)
    partial = partial || f.partial
  }
  return { keys, partial }
}

/**
 * 源侧(判据 A):导出工厂的键集 + `ReturnType<typeof F>` 型别名 + **本文件内**(含未导出)造样式的工厂名。
 * localFactoryNames 是判据 C 的根据之一:同名标识符只要沾上本地工厂就整枚退出判定。
 */
export function collectFactories(sf) {
  const factories = new Map()
  const typeAliases = new Map()
  const localFactoryNames = new Set()
  const declaresStyleSheet = (node) => {
    let hit = false
    const walk = (n) => {
      if (!hit && isStyleSheetCreate(n, sf)) hit = true
      ts.forEachChild(n, walk)
    }
    walk(node)
    return hit
  }
  const noteLocal = (name, body) => {
    if (declaresStyleSheet(body)) localFactoryNames.add(name)
  }
  for (const stmt of sf.statements) {
    const exported = (stmt.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    if (ts.isTypeAliasDeclaration(stmt) && stmt.type) {
      const m = stmt.type.getText(sf).match(/^ReturnType<typeof\s+([A-Za-z0-9_$]+)>$/)
      if (m) typeAliases.set(stmt.name.getText(sf), m[1])
    }
    if (ts.isFunctionDeclaration(stmt) && stmt.name && stmt.body) noteLocal(stmt.name.getText(sf), stmt.body)
    if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)))
          noteLocal(d.name.getText(sf), d.initializer)
      }
    }
    if (!exported) continue
    let name = null
    let body = stmt
    if (ts.isFunctionDeclaration(stmt) && stmt.name) name = stmt.name.getText(sf)
    else if (ts.isVariableStatement(stmt)) {
      const d = stmt.declarationList.declarations[0]
      if (d?.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) {
        name = d.name.getText(sf)
        body = d.initializer
      }
    }
    if (!name) continue
    const info = keysOfBody(body, sf)
    if (info) factories.set(name, info)
  }
  return { factories, typeAliases, localFactoryNames }
}

/** 相对说明符 ⇒ 候选目标路径清单(与 TS 的 node 解析同序:先 .ts 后 .tsx 再 index)。 */
export function resolveRelative(fromRel, spec) {
  if (!spec.startsWith('.')) return []
  const dir = fromRel.split('/').slice(0, -1).join('/')
  let t = (dir ? dir + '/' : '') + spec.replace(/^\.?\//, '')
  t = t.replace(/\/+$/, '')
  return [`${t}.ts`, `${t}.tsx`, `${t}/index.ts`, `${t}/index.tsx`]
}

/** 消费侧第一步:本文件从**别的源文件**导入的工厂名(局部名 → 工厂名)与导入的类型别名。 */
export function importedStyleFactories(rel, sf, sourceIndex) {
  const byFactory = new Map()
  const byTypeAlias = new Map()
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.moduleSpecifier) continue
    const spec = stmt.moduleSpecifier.getText(sf).replace(/^['"]|['"]$/g, '')
    const hit = resolveRelative(rel, spec).find((c) => c !== rel && sourceIndex.has(c))
    if (!hit) continue
    const nb = stmt.importClause?.namedBindings
    if (!nb || !ts.isNamedImports(nb)) continue
    const entry = sourceIndex.get(hit)
    for (const el of nb.elements) {
      const importedName = (el.propertyName ?? el.name).getText(sf)
      const localName = el.name.getText(sf)
      if (entry.factories.has(importedName)) byFactory.set(localName, { factory: importedName, srcFile: hit })
      else if (entry.typeAliases.has(importedName))
        byTypeAlias.set(localName, { aliasTarget: entry.typeAliases.get(importedName), srcFile: hit })
    }
  }
  return { byFactory, byTypeAlias }
}

/**
 * 作用域档的绑定收集(判据 B + C)。
 * 为什么必须按作用域算而不是"整文件一个标识符表":HEAD 面上真实存在的形态是
 * 同一个文件里 `Local()` 用本文件 StyleSheet、`Shared()` 用导入工厂,两边都叫 `styles`。
 * 文件级豁免会把 Shared 那一枚也洗白(假绿),文件级判定会把 Local 那一枚判红(恒红)。
 * 未知来源(对象字面量 / 转发别人的 props / 查不到绑定)一律放过 ⇒ 反向误伤就是恒红门。
 */
const SCOPE_KINDS = new Set([
  ts.SyntaxKind.SourceFile,
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.Constructor,
])

function localSourceSignal(sf, init, txt, localFactoryNames) {
  return (
    /(?:^|[^.\w$])StyleSheet\s*\.\s*create\s*\(/.test(txt) ||
    [...localFactoryNames].some((f) => callRe(f).test(txt)) ||
    ts.isObjectLiteralExpression(init) ||
    ts.isArrayLiteralExpression(init) ||
    ts.isIdentifier(init) ||
    ts.isPropertyAccessExpression(init)
  )
}

export function collectScopes(sf, { byFactory, byTypeAlias }, localFactoryNames) {
  const scopes = new Map()
  const factoriesInText = makeFactoriesInText(byFactory)
  const aliasEntries = importEntries(byTypeAlias, 'aliasTarget')
  const ensure = (node, parent) => {
    if (!scopes.has(node)) scopes.set(node, { bindings: new Map(), local: new Set(), parent })
    return scopes.get(node)
  }
  const take = (scope, id, init) => {
    const txt = init.getText(sf)
    const used = [...factoriesInText(txt)]
    for (const f of used) addBinding(scope.bindings, id, f)
    if (localSourceSignal(sf, init, txt, localFactoryNames) || used.length === 0) scope.local.add(id)
  }
  const bindAliasType = (scope, id, typeNode) => {
    const bare = typeNode.getText(sf).replace(/\?$/, '')
    for (const e of aliasEntries) if (bare === e.localName) addBinding(scope.bindings, id, e.target)
  }
  // cur = 作用域记录(收绑定用);curNode = 作用域**节点**(parent 链上必须是节点,
  // 否则 resolveIdentifier 拿记录去 scopes.get() 恒 undefined ⇒ 所有跨文件取用被静默放过)。
  const walk = (n, parentScope) => {
    const isScope = SCOPE_KINDS.has(n.kind)
    const cur = isScope ? ensure(n, parentScope) : parentScope ? scopes.get(parentScope) : null
    const curNode = isScope ? n : parentScope
    if (cur && ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) {
      const id = n.name.getText(sf)
      if (n.initializer) take(cur, id, n.initializer)
      else cur.local.add(id) // `const styles: AStyles` 无初值 ⇒ 未知,放过
    }
    if (cur && ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(n.left)) {
      take(cur, n.left.getText(sf), n.right) // 同名标识符被覆写:声明放过、覆写也得放过(否则半截形态判红)
    }
    if (cur && ts.isParameter(n) && n.type) {
      if (ts.isIdentifier(n.name)) bindAliasType(cur, n.name.getText(sf), n.type)
      else if (ts.isObjectBindingPattern(n.name) && ts.isTypeLiteralNode(n.type)) {
        // `function Chips({ styles }: { styles: Styles })` —— 真实屏里最常见的转发型
        for (const member of n.type.members) {
          if (!ts.isPropertySignature(member) || !member.type || !member.name) continue
          const pname = ts.isIdentifier(member.name) ? member.name.getText(sf) : null
          if (pname) bindAliasType(cur, pname, member.type)
        }
      }
    }
    ts.forEachChild(n, (c) => walk(c, curNode))
  }
  walk(sf, null)
  return { scopes, factoriesInText }
}

/** 沿作用域链解析标识符:先撞上"本地/未知"就整枚退出,先撞上绑定就用它,两头都查不到 ⇒ 放过。 */
export function resolveIdentifier(scopes, scopeNode, id) {
  let cur = scopeNode
  while (cur) {
    const s = scopes.get(cur)
    if (!s) break
    if (s.local.has(id)) return null
    if (s.bindings.has(id)) return s.bindings.get(id)
    cur = s.parent
  }
  return null
}

/**
 * 判据 B 的取用面:属性访问 / 字符串下标 / **直接解构导入工厂的返回值**;计算下标一律不判(键集读不出来)。
 * 每条取用带着"它按名取了哪些工厂",交 judge 去源侧数键(测试与实跑同一条路)。
 */
export function collectUses(sf, scopes, factoriesInText) {
  const uses = []
  const line = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
  // 与 collectScopes 同一形态:沿链传的是作用域**节点**(resolveIdentifier 只认节点)。
  const walk = (n, parentScope) => {
    const cur = SCOPE_KINDS.has(n.kind) && scopes.has(n) ? n : parentScope
    const emit = (id, key, node, factories, label) => uses.push({ id, key, factories, label, line: line(node) })
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression)) {
      const id = n.expression.getText(sf)
      const facs = resolveIdentifier(scopes, cur, id)
      if (facs && !ts.isComputedPropertyName(n.name)) emit(id, n.name.getText(sf), n, [...facs], `${id}.${n.name.getText(sf)}`)
    } else if (ts.isElementAccessExpression(n) && ts.isIdentifier(n.expression)) {
      const id = n.expression.getText(sf)
      const facs = resolveIdentifier(scopes, cur, id)
      const a = n.argumentExpression
      if (facs && a && ts.isStringLiteral(a)) emit(id, a.text, n, [...facs], `${id}['${a.text}']`)
    } else if (ts.isVariableDeclaration(n) && n.name && ts.isObjectBindingPattern(n.name) && n.initializer) {
      // 解构形态没有绑定标识符 ⇒ 只能从"初始化文本按名调了哪个工厂"拿键集
      const facs = [...factoriesInText(n.initializer.getText(sf))]
      if (facs.length > 0) {
        for (const el of n.name.elements) {
          const lookup = el.propertyName ?? (ts.isIdentifier(el.name) ? el.name : null)
          if (lookup) emit(facs[0], lookup.getText(sf), el, facs, `{${lookup.getText(sf)}} 自 ${facs.join('/')}()`)
        }
      }
    }
    ts.forEachChild(n, (c) => walk(c, cur))
  }
  walk(sf, null)
  return uses
}

/**
 * 取用导入表的唯一归一形态:Map<局部名,{factory|aliasTarget, srcFile}>(面扫描产的就是它)
 * 与 `[局部名, 工厂名]`(夹具/镜像构造面)都走这一条 ⇒ 不会出现"面认得、夹具认不得"两种尺子。
 */
function importEntries(by, field) {
  const raw = typeof by?.entries === 'function' ? [...by.entries()] : [...(by ?? [])]
  return raw.map(([localName, info]) => ({
    localName,
    target: info && typeof info === 'object' ? info[field] : info,
    srcFile: info && typeof info === 'object' ? (info.srcFile ?? null) : null,
  }))
}

function callRe(name) {
  return new RegExp(`(?:^|[^\\w$.])${name}\\s*[(<]`)
}

function addBinding(bindings, id, factory) {
  if (!bindings.has(id)) bindings.set(id, new Set())
  bindings.get(id).add(factory)
}

/**
 * 「这段文本按名调用了哪些导入工厂」的唯一解析器(判据 B 的两条入口都用它:
 * 变量绑定的 take() 与解构取用的 collectUses() ⇒ 不会出现一边认、一边不认)。
 */
export function makeFactoriesInText(byFactory) {
  const re = importEntries(byFactory, 'factory').map((e) => [callRe(e.localName), e.target])
  return (txt) => {
    const out = new Set()
    for (const [r, target] of re) if (r.test(txt)) out.add(target)
    return out
  }
}

/**
 * 「工厂名 → 源文件 / 键集」查找器的唯一出口(scan 与自检夹具共用一份 ⇒ 自检判的确实是装车那把尺子)。
 */
export function makeFactoryLookup({ byFactory, byTypeAlias, sourceIndex }) {
  const entries = [...importEntries(byFactory, 'factory'), ...importEntries(byTypeAlias, 'aliasTarget')]
  const fileOf = (name) => entries.find((e) => e.target === name)?.srcFile ?? null
  const sourceKeysOf = (name) => {
    const file = fileOf(name)
    if (!file) return null
    return sourceIndex.get(file)?.factories.get(name) ?? null
  }
  return { fileOf, sourceKeysOf }
}

/** facts ⇒ sourceIndex 的唯一构造器(面扫描与自检夹具必须同序,否则自检判的不是装车那把尺子)。 */
export function buildSourceIndex(facts) {
  const sourceIndex = new Map()
  for (const [rel, f] of facts)
    if (f.factories.size > 0)
      sourceIndex.set(rel, { factories: f.factories, typeAliases: f.typeAliases, localFactoryNames: f.localFactoryNames })
  return sourceIndex
}

/**
 * 解析好的面 ⇒ 判定输入(consumers)。全仓只此一份:面扫描与内存夹具走同一条构造路,
 * 否则"自检绿而实跑瞎"就是必然(§22c 同源要求)。
 */
export function buildConsumers(parsed, facts, sourceIndex) {
  const consumers = new Map()
  for (const [rel, sf] of parsed) {
    const { byFactory, byTypeAlias } = importedStyleFactories(rel, sf, sourceIndex)
    if (byFactory.size === 0 && byTypeAlias.size === 0) continue
    const own = facts.get(rel) ?? { localFactoryNames: new Set() }
    const { scopes, factoriesInText } = collectScopes(sf, { byFactory, byTypeAlias }, own.localFactoryNames)
    const uses = collectUses(sf, scopes, factoriesInText)
    if (uses.length === 0) continue
    const { fileOf, sourceKeysOf } = makeFactoryLookup({ byFactory, byTypeAlias, sourceIndex })
    let exemptIdentifiers = 0
    for (const s of scopes.values()) exemptIdentifiers += s.local.size
    consumers.set(rel, { sf, scopes, uses, exemptIdentifiers, parseFail: null, sourceKeysOf, fileOf })
  }
  return consumers
}

/**
 * 成对判定(纯函数)。
 * @param sourceIndex Map<rel,{factories:Map,typeAliases:Map,localFactoryNames:Set}> 已按被审面解析
 * @param consumers   Map<rel,{sf,scopes,uses,exemptIdentifiers,parseFail,sourceKeysOf,fileOf}> = buildConsumers 的产物
 * @param changedSet  索引档的改动集;null = 不筛(全量档)
 */
export function judge({ sourceIndex, consumers, changedSet = null }) {
  const violations = []
  const undetermined = []
  const stats = { sources: 0, factories: 0, consumerFiles: 0, accesses: 0, exemptIdentifiers: 0, partialSources: 0, offScope: 0 }
  for (const [, s] of sourceIndex) {
    stats.sources++
    for (const [, f] of s.factories) {
      stats.factories++
      if (f.partial) stats.partialSources++
    }
  }
  for (const [rel, c] of consumers) {
    if (c.parseFail) {
      undetermined.push({ kind: 'parse', rel, why: c.parseFail })
      continue
    }
    if (c.uses.length === 0) continue
    stats.consumerFiles++
    stats.exemptIdentifiers += c.exemptIdentifiers ?? 0
    for (const use of c.uses) {
      const factoryNames = new Set(use.factories ?? [])
      if (!factoryNames || factoryNames.size === 0) continue
      const keys = new Set()
      let partial = false
      let known = 0
      for (const f of factoryNames) {
        const info = c.sourceKeysOf(f)
        if (!info) continue
        known++
        for (const k of info.keys) keys.add(k)
        partial = partial || info.partial
      }
      if (known === 0 || partial) {
        stats.partialSources += partial ? 1 : 0
        continue
      }
      stats.accesses++
      if (keys.has(use.key)) continue
      const inScope = !changedSet || changedSet.has(rel) || changedSet.has([...factoryNames].map((f) => c.fileOf(f)).find(Boolean))
      if (!inScope) {
        stats.offScope++
        continue
      }
      violations.push({
        consumer: rel,
        line: use.line,
        access: use.label ?? `${use.id}.${use.key}`,
        key: use.key,
        factories: [...factoryNames].map((f) => ({ name: f, file: c.fileOf(f) })),
      })
    }
  }
  return { violations, undetermined, stats }
}

// ─── 面扫描(唯一做 IO 的判据入口)────────────────────────────────────────────
export function scan({ face = 'head', root = ROOT } = {}) {
  const meta = { face }
  let rels
  try {
    rels = listCandidates(face, root)
  } catch (e) {
    return { violations: [], undetermined: [{ kind: 'list', why: `候选清单取不到:${String(e?.message ?? e).slice(0, 160)}` }], stats: emptyStats(), meta }
  }
  if (rels.length === 0)
    return { violations: [], undetermined: [{ kind: 'empty', why: `枚举到 0 个候选文件(${SOURCE_ROOTS.join(' / ')} 不在面上?)——判死不记绿` }], stats: emptyStats(), meta }
  let contents
  try {
    contents = readContents(face, rels, root)
  } catch (e) {
    return { violations: [], undetermined: [{ kind: 'read', why: `正文取不到:${String(e?.message ?? e).slice(0, 160)}` }], stats: emptyStats(), meta }
  }
  const missing = rels.filter((r) => contents.get(r) === null || contents.get(r) === undefined)
  // 两相取材:① 只有含 `StyleSheet.create` 的文件可能是源;② 名字全集出来后才决定谁可能是消费者。
  // 相 ② 用子串筛(而不是 AST 筛)是因为消费面必须"见到 import 才可能绑定",而工厂/型别名名
  // 是唯一稳定的线索;全量 parse 868 枚在 pre-commit 通道上会顶穿超时(门 251 同因)。
  const parsed = new Map()
  const parseFails = []
  const parseInto = (rel, text) => {
    const { sf, fail } = parseFile(rel, text)
    if (fail) {
      parseFails.push({ rel, why: fail })
      return null
    }
    parsed.set(rel, sf)
    return sf
  }
  for (const rel of rels) {
    const text = contents.get(rel)
    if (text === null || text === undefined) continue
    if (text.includes('StyleSheet.create')) parseInto(rel, text)
  }
  const computeFacts = () => {
    const f = new Map()
    for (const [rel, sf] of parsed) f.set(rel, collectFactories(sf))
    return f
  }
  const facts = computeFacts()
  const sourceIndex = buildSourceIndex(facts)
  const nameUniverse = new Set()
  for (const f of sourceIndex.values()) {
    for (const n of f.factories.keys()) nameUniverse.add(n)
    for (const n of f.localFactoryNames) nameUniverse.add(n)
  }
  const aliasUniverse = new Set()
  for (const [rel, f] of facts) {
    if (!sourceIndex.has(rel)) continue
    for (const n of f.typeAliases.keys()) aliasUniverse.add(n)
  }
  for (const rel of rels) {
    if (parsed.has(rel)) continue
    const text = contents.get(rel)
    if (text === null || text === undefined) continue
    const maybeConsumer = [...nameUniverse].some((n) => text.includes(n)) || [...aliasUniverse].some((n) => text.includes(n))
    if (maybeConsumer) parseInto(rel, text)
  }
  // 相 ② 新解析的文件增量并进 facts(不是重算也不是第二份源索引):它们当中若真冒出新工厂,
  // 必须**同批**进 sourceIndex,否则 buildConsumers 拿不到它的 localFactoryNames,或者
  // "刚被认出来的源"在这一轮里无人对账(§0.6 单一真相源:源索引只有一处构造点)。
  for (const [rel, sf] of parsed) {
    if (facts.has(rel)) continue
    const f = collectFactories(sf)
    facts.set(rel, f)
    if (f.factories.size > 0)
      sourceIndex.set(rel, { factories: f.factories, typeAliases: f.typeAliases, localFactoryNames: f.localFactoryNames })
  }
  const consumers = buildConsumers(parsed, facts, sourceIndex)
  const changed = changedSet(face, root)
  const out = judge({ sourceIndex, consumers, changedSet: changed })
  if (missing.length > 0) out.undetermined.push({ kind: 'blob', why: `${missing.length} 枚候选正文取不到(如 ${missing[0]})` })
  for (const p of parseFails) out.undetermined.push({ kind: 'parse', rel: p.rel, why: p.why })
  if (sourceIndex.size === 0) out.undetermined.push({ kind: 'no-source', why: '面上解析出 0 枚样式工厂 ⇒ 无从对账' })
  if (out.stats.accesses === 0 && out.violations.length === 0) out.undetermined.push({ kind: 'nothing-judged', why: '一枚跨文件具名取用都没判成(消费面为空/全被放过)⇒ 不记绿' })
  out.meta = { ...meta, candidates: rels.length, parsed: parsed.size, missing: missing.length }
  return out
}

function emptyStats() {
  return { sources: 0, factories: 0, consumerFiles: 0, accesses: 0, exemptIdentifiers: 0, partialSources: 0, offScope: 0 }
}

// ─── 报表 ──────────────────────────────────────────────────────────────────
export function report(result, { json = false, quiet = false, face = 'head' } = {}) {
  const { violations, undetermined, stats } = result
  const say = quiet ? () => {} : (s) => console.log(s)
  if (json && !quiet) {
    console.log(JSON.stringify({ face, stats, violations, undetermined, meta: result.meta }, null, 2))
  } else {
    if (violations.length > 0) {
      say(`❌ [${NAME}] 跨文件具名取用不在共享样式工厂的键集里,共 ${violations.length} 枚:`)
      for (const v of violations) {
        const src = v.factories.map((f) => `${f.name}@${f.file ?? '?'}`).join(' + ')
        say(`     ${v.consumer}:${v.line}  ${v.access}  ← 源 ${src}`)
      }
      say('  修复:样式源与消费面**同批**改(单边翻键名 = HEAD 类型红,见 876c4cb418 / bd41560d83)。')
    }
    if (undetermined.length > 0 && !quiet) {
      for (const u of undetermined) say(`⚠️  [${NAME}] 未判定(${u.rel ?? u.kind}):${u.why}`)
    }
  }
  const exit = undetermined.length > 0 ? 2 : violations.length > 0 ? 1 : 0
  if (quiet) return exit
  const last =
    `[${NAME}] 末行:面=${face} 候选=${result.meta.candidates ?? '-'} 解析=${result.meta.parsed ?? '-'} 源=${stats.sources}` +
    ` 工厂=${stats.factories} 消费文件=${stats.consumerFiles} 判成取用=${stats.accesses} 违规=${violations.length}` +
    ` 改动集外=${stats.offScope} partial源=${stats.partialSources} 放过的本地/未知绑定=${stats.exemptIdentifiers}` +
    ` 未判定=${undetermined.length} exit=${exit}`
  if (json) process.stderr.write(last + '\n')
  else console.log(last)
  return exit
}

function runFace(argv) {
  const { face, error } = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (error) {
    console.error(`❌ [${NAME}] 未判定(§0.4):${error}`)
    return 2
  }
  try {
    const result = scan({ face })
    return report(result, { json: argv.includes('--json'), face })
  } catch (e) {
    console.error(`❌ [${NAME}] 未判定(取材/解析层异常,§0.3 不记绿也不冒红):${String(e?.message ?? e).slice(0, 200)}`)
    return 2
  }
}

// ─── 自检(判据四方向 + 正反对照;夹具全在内存,不碰工作树)────────────────
export const FIXTURES = {
  sourceA: `import { StyleSheet } from 'react-native'
export function createAStyles(tk) {
  return StyleSheet.create({ tabText: {}, tabTextActive: {}, chipTextActive: {} })
}
export type AStyles = ReturnType<typeof createAStyles>
`,
  consumerOk: `import { createAStyles } from './a-styles'
export function Screen({ tk }) {
  const styles = createAStyles(tk)
  return styles.tabTextActive
}
`,
  consumerBad: `import { createAStyles } from './a-styles'
export function Screen({ tk }) {
  const styles = createAStyles(tk)
  return styles.tabActiveText
}
`,
  localDefinition: `import { StyleSheet } from 'react-native'
import { createAStyles } from './a-styles'
const localSheet = StyleSheet.create({ tabActiveText: {}, own: {} })
export function Local({ tk }) {
  const styles = localSheet
  return styles.tabActiveText
}
export function Shared({ tk }) {
  const styles = createAStyles(tk)
  return styles.tabTextActive
}
`,
  localSameName: `import { StyleSheet } from 'react-native'
import { createAStyles } from './a-styles'
export function Shadowed({ tk }) {
  let styles = createAStyles(tk)
  styles = StyleSheet.create({ tabActiveText: {} })
  return styles.tabActiveText
}
`,
  useMemoConsumer: `import { useMemo } from 'react'
import { createAStyles } from './a-styles'
export function Screen({ tk }) {
  const styles = useMemo(() => createAStyles(tk), [tk])
  return styles.chipTextActive
}
`,
  propTypedConsumer: `import { createAStyles } from './a-styles'
import type { AStyles } from './a-styles'
export function Chips({ styles }: { styles: AStyles }) {
  return styles.tabText
}
`,
  partialSource: `import { StyleSheet } from 'react-native'
import { base } from './base'
export function createAStyles(tk) {
  return StyleSheet.create({ ...base, tabText: {} })
}
`,
  destructuredBad: `import { createAStyles } from './a-styles'
export function Screen({ tk }) {
  const { nope } = createAStyles(tk)
  return nope
}
`,
  elementAccessOk: `import { createAStyles } from './a-styles'
export function Screen({ tk }) {
  const styles = createAStyles(tk)
  return styles['tabTextActive']
}
`,
}

function fixtureJudge(files, changed = null) {
  const parsed = new Map()
  const fails = new Map()
  for (const [rel, text] of Object.entries(files)) {
    const { sf, fail } = parseFile(rel, text)
    if (fail) fails.set(rel, fail)
    else parsed.set(rel, sf)
  }
  const facts = new Map()
  for (const [rel, sf] of parsed) facts.set(rel, collectFactories(sf))
  const sourceIndex = buildSourceIndex(facts)
  const consumers = buildConsumers(parsed, facts, sourceIndex)
  return judge({ sourceIndex, consumers, changedSet: changed })
}

function selfTest() {
  const cases = []
  const src = (extra = {}) => ({ 'pkg/a-styles.ts': FIXTURES.sourceA, ...extra })
  const keys = (r) => r.violations.map((v) => v.access).sort()
  const factory = (() => {
    const sf = parseFile('pkg/a-styles.ts', FIXTURES.sourceA).sf
    return collectFactories(sf).factories.get('createAStyles')
  })()
  cases.push(['判据 A:导出工厂键集 = {tabText,tabTextActive,chipTextActive}', [...factory.keys].sort(), ['chipTextActive', 'tabText', 'tabTextActive']])
  cases.push(['判据 A:partial = false', factory.partial, false])
  cases.push(['判据 A+D:夹具面读得出 1 枚源 / 1 枚工厂', [fixtureJudge(src()).stats.sources, fixtureJudge(src()).stats.factories], [1, 1]])
  cases.push(['判据 B 正控:跨文件取用不存在的键 ⇒ 1 枚红', keys(fixtureJudge(src({ 'pkg/b.tsx': FIXTURES.consumerBad }))), ['styles.tabActiveText']])
  cases.push(['判据 B 反控:同键在 ⇒ 0', keys(fixtureJudge(src({ 'pkg/b.tsx': FIXTURES.consumerOk }))), []])
  cases.push(['判据 B:useMemo 包裹的绑定照样判(且不误伤)', keys(fixtureJudge(src({ 'pkg/b.tsx': FIXTURES.useMemoConsumer }))), []])
  cases.push(['判据 B:props 形参走 ReturnType<typeof F> 型别名 ⇒ 判得到', keys(fixtureJudge(src({ 'pkg/b.tsx': FIXTURES.propTypedConsumer }))), []])
  cases.push(['判据 B:字符串下标取用算取用', keys(fixtureJudge(src({ 'pkg/b.tsx': FIXTURES.elementAccessOk }))), []])
  cases.push(['判据 B:解构取用不存在的键 ⇒ 1 枚红', keys(fixtureJudge(src({ 'pkg/b.tsx': FIXTURES.destructuredBad }))), ['{nope} 自 createAStyles()']])
  cases.push(['判据 C(生死线):同文件本地 StyleSheet 定义的取用放过', keys(fixtureJudge(src({ 'pkg/b.tsx': FIXTURES.localDefinition }))), []])
  cases.push(['判据 C:同名标识符被本地 StyleSheet 覆写 ⇒ 整枚退出', keys(fixtureJudge(src({ 'pkg/b.tsx': FIXTURES.localSameName }))), []])
  cases.push(['判据 A 保守:源含 spread(partial)⇒ 不判', keys(fixtureJudge({ 'pkg/a-styles.ts': FIXTURES.partialSource, 'pkg/b.tsx': FIXTURES.consumerBad })), []])
  // 索引档:s11 那一刀 —— 源被暂存(键名翻了)、消费面留在未暂存区 ⇒ 提交门必须报红,
  // 而 check-staged-typecheck 的 filterTscOutputForStagedFiles 会把这条(错在非暂存文件)整块丢掉。
  const renamedSource = {
    'pkg/a-styles.ts': FIXTURES.sourceA.replace('tabTextActive:', 'tabActiveText:'),
    'pkg/b.tsx': FIXTURES.consumerOk, // 消费面 = 改动前的那一份(索引里它没被暂存)
  }
  cases.push(['s11 复现:索引档(源在改动集、消费未暂存)⇒ 1 枚红', keys(fixtureJudge(renamedSource, new Set(['pkg/a-styles.ts']))), ['styles.tabTextActive']])
  cases.push(['s11 对照:同一份内容、改动集不含这一对 ⇒ 不报(共享索引里别人的在飞不判红)', keys(fixtureJudge(renamedSource, new Set())), []])
  cases.push(['s11 修法验证:消费面同批改 ⇒ 0', keys(fixtureJudge({ ...renamedSource, 'pkg/b.tsx': FIXTURES.consumerOk.replace('tabTextActive', 'tabActiveText') }, new Set(['pkg/a-styles.ts']))), []])
  cases.push(['s11 全量档:同内容不带改动集 ⇒ 照报(HEAD 面上两侧自洽才是绿)', keys(fixtureJudge(renamedSource, null)), ['styles.tabTextActive']])
  // 注册条目形状锁(装上即绿 / 摘掉即红 的成对夹具)
  const entry = registryEntryFacts(REGISTRY_ENTRY)
  cases.push(['接线锁:条目成套(blocking + skipEnv + 非空 stagedTriggers)', [entry.mode, !!entry.skipEnv, entry.stagedTriggers.length > 0], ['blocking', true, true]])
  cases.push(['接线锁:夹具里没这枚 ⇒ 判"未装车"', wiringVerdict(entry, 'const checks = [\n  { id: "1", script: "other.mjs" }\n]\n'), 'missing'])
  cases.push(['接线锁:夹具里装上 ⇒ 判"已装车"', wiringVerdict(entry, `const checks = [\n  { id: "1", script: "other.mjs" }\n]\n${REGISTRY_ENTRY}\n`), 'wired'])
  cases.push(['镜像面:两面旗同给 ⇒ selectFace 报错(交调用方折 exit 2)', selectFace({ staged: true, worktree: true }).error !== null, true])

  let fail = 0
  for (const [name, got, want] of cases) {
    const pass = JSON.stringify(got) === JSON.stringify(want)
    if (!pass) fail++
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : `  want=${JSON.stringify(want)} got=${JSON.stringify(got)}`}`)
  }
  const live = wiringVerdict(entry, readRunnerText())
  console.log(`ℹ️  本机注册表现读装车态:${live}(不记入通过/失败 —— 接线由主席同批落地,见报告)`)
  console.log(`[${NAME}] 自检末行:${cases.length - fail}/${cases.length} 通过`)
  return fail === 0 ? 0 : 1
}

/** 从注册表文本里读出条目事实(不 import runner ⇒ 避免把整张表拉进进程)。 */
export function registryEntryFacts(text) {
  const id = (text.match(/id:\s*'([^']+)'/) ?? [])[1] ?? null
  const script = (text.match(/script:\s*'([^']+)'/) ?? [])[1] ?? null
  const mode = (text.match(/mode:\s*'([^']+)'/) ?? [])[1] ?? 'blocking'
  const skipEnv = (text.match(/skipEnv:\s*'([^']+)'/) ?? [])[1] ?? null
  const argsRaw = (text.match(/args:\s*\[([^\]]*)\]/) ?? [])[1] ?? ''
  const triggersBlock = (text.match(/stagedTriggers:\s*\[([\s\S]*?)\]/) ?? [])[1] ?? ''
  const stagedTriggers = [...triggersBlock.matchAll(/'([^']+)'/g)].map((m) => m[1])
  return { id, script, mode, skipEnv, args: argsRaw ? [...argsRaw.matchAll(/'([^']+)'/g)].map((m) => m[1]) : [], stagedTriggers }
}

export function readRunnerText(root = ROOT) {
  try {
    return readWorktreeFile(root, 'scripts/guardian-runner.mjs') ?? git(['show', 'HEAD:scripts/guardian-runner.mjs'], root)
  } catch {
    return null
  }
}

/** 装车裁决:wired = 条目已在 runner;missing = 没装上;undetermined = runner 读不到。 */
export function wiringVerdict(entry, runnerText) {
  if (!runnerText) return 'undetermined'
  const all = [...runnerText.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1])
  if (!all.includes(entry.id)) return 'missing'
  const blocks = runnerText.split(/\n  \{\n/)
  const hit = blocks.find((b) => b.includes(`id: '${entry.id}'`) && b.includes(`script: '${entry.script}'`))
  return hit ? 'wired' : 'collision'
}

export const __test__ = {
  collectFactories,
  buildSourceIndex,
  buildConsumers,
  resolveRelative,
  importedStyleFactories,
  makeFactoriesInText,
  makeFactoryLookup,
  collectScopes,
  collectUses,
  resolveIdentifier,
  judge,
  scan,
  report,
  registryEntryFacts,
  wiringVerdict,
  parseFile,
  SOURCE_ROOTS,
  REGISTRY_ENTRY,
  FIXTURES,
  fixtureJudge,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--help')) {
    console.log('用法:node scripts/check-style-key-consumption.mjs [--staged|--worktree] [--json] [--self-test]')
    process.exit(0)
  }
  const code = argv.includes('--self-test') ? selfTest() : runFace(argv)
  process.exit(code)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
