#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 陈旧 dist 检测守门脚本。
 *
 * 背景: packages 下各子包用 tsc 增量构建,tsconfig.tsbuildinfo 是"唯一真相源"。
 * 若源码加了 export 但未重新 build,dist 会残缺(部分文件存在,部分缺失),
 * 表现为"模块找不到"或"export 不存在"。本项目已多次踩坑:
 *   - parseStreamLine export 缺失 (2026-07-16)
 *   - dist/index.js 整体缺失导致 Module not found (2026-07-16)
 *
 * 检测策略(两维,判据都是**内容判据**):
 *   V 维(原有):对比每个包 src/index.ts 的 value export 名称集合
 *               与 dist/index.js 的 export 名称集合,不一致则报错。
 *   D 维(2026-09-28 票新增):对每个包,把 src 目录下每个 .ts/.tsx 的
 *               "导出声明名 + 接口/对象类型字段名集合",与 dist 目录下每个 .d.ts 的
 *               同形集合做差(两侧**共用同一份提取实现**),差集非空 ⇒ 声明产物落后于源码。
 *               立项凭据:2026-09-27 实测 packages/types 的 dist/chat.d.ts 落后源码一个字段
 *               ⇒ 三端 typecheck 红,而本门同期打印"✓ 所有 dist 与源码同步"
 *               (wildcard 整片跳过 + "从源码消费"整片跳过)。
 *
 * 为什么**不**用 mtime("src 比 dist 新 ⇒ 判陈旧"):git 不保存 mtime,检出顺序任意,
 *   clone / worktree / 构建缓存都会重置时间戳 ⇒ 一台干净机器上每个包都红 —— 那是一台与
 *   任何提交都无关的恒红门(AGENTS §12e),唯一结局是逼人 --no-verify 连带废掉全部守门。
 *   内容判据虽然贵一点(要读两面),但它问的是"字段真的少了吗",与机器状态无关。
 *
 * 棘轮(防存量变恒红):D 维的判红锚点 = **同一轮里该包在 HEAD 面的自身落后数**(重算,
 *   不冻结进 JSON —— 落后数是"本机 dist"的函数,把某台机器的数字钉进登记表必然在别的
 *   机器上腐烂成恒红/假绿,守门 104 的 S2 同型)。默认档(HEAD 面)锚点即自身 ⇒ 存量只报数;
 *   --staged 比"索引 vs HEAD",--worktree 比"磁盘 vs HEAD",只有**本次改动新引入**的落后判红。
 *
 * dist 取不到(未构建/被清理)⇒ **判"无法判定"并逐条报名,不判绿也不判红**;--strict 下未判定 ⇒ exit 2
 *   (拒绝出合格证)。V 维原有行为一字未动。
 *
 * 用法: node scripts/check-stale-dist.mjs [--staged|--worktree] [--strict] [--self-test] [--root <dir>]
 *   exit 0 = 无陈旧(可能含"未判定",已逐条报名)
 *   exit 1 = 发现陈旧 dist / 本次改动新引入的声明落后
 *   exit 2 = 无法判定(被审面取不到、--self-test 之外的脚本异常、--strict 下有未判定)
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// 被审内容(包清单、src 入口)一律经统一取材层取**被审判的那个面**:全量档 HEAD blob、
// --staged 档索引 blob。按磁盘判会随共享工作树滞后 HEAD 而在"恒红"与"假绿"之间来回跳
// (守门 83 的 R3 登记一天被整文件回退三次即此型),且 `ROOT = process.cwd()` 意味着
// "扫哪棵树"由调用者站在哪儿决定 —— 守门 70 的镜像测试 13/14 恒红就是这一型。
//
// 唯一**故意**留在磁盘上的是 `dist/`:它是被 .gitignore 忽略的构建产物,仓库里没有对应
// blob,所以"它陈旧吗"只能判本机。这一维不假装审过 —— 报告里明写 dist 口径是本机,
// 与"读按设计只存在于部署机的 gitignore 副本"是同一条道理。
import { catBatch, gitRaw, selectFace, readWorktreeFile } from './lib/face-reader.mjs'
// 遮罩只引这一份实现(守门 131/135 同规:两处实现必漂移)。判"声明内容"必须先剥注释与字符串 ——
// 注释里出现的 `export interface X {}` 若不剥掉,门会给自己写出的说明判红,甚至给假象发合格证。
import { maskCommentsAndStrings } from './lib/code-mask.mjs'

// ROOT 默认由脚本自身位置推导(§15,不依赖 cwd —— 守门 70 的"测试靠 cwd 定位夹具而脚本按定义
// 忽略 cwd ⇒ 13/14 恒红"那一型)。`--root <dir>` 是**测试通道**:镜像测试要在临时 git 仓里
// 构造"索引≠HEAD≠磁盘"的现场,不能拿真仓的瞬时状态当判据输入(守门 103 T12 那一课)。
let ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
let PACKAGES_DIR = join(ROOT, 'packages')
function setRoot(dir) {
  ROOT = resolve(dir)
  PACKAGES_DIR = join(ROOT, 'packages')
}

/** 被审面上 packages/ 下的文件清单(索引档 ls-files,HEAD 档 ls-tree,磁盘档遍历)。 */
function listFaceFiles(face) {
  if (face === 'worktree') return listWorktreeFiles()
  const out =
    face === 'staged'
      ? gitRaw(['ls-files', '--', 'packages'], ROOT, { encoding: 'utf8' })
      : gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '--', 'packages'], ROOT, {
          encoding: 'utf8',
        })
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

/**
 * 磁盘面遍历:与 HEAD/索引面同形返回**相对 ROOT 的正斜杠路径**。
 * 跳过 node_modules / dist / .turbo —— dist 那一侧本来就有专门的遍历(listDistDts),
 * 让它渗进 src 枚举会把"产物"当"源码"读(两侧集合自己和自己比,恒绿)。
 */
function listWorktreeFiles() {
  const out = []
  if (!existsSync(PACKAGES_DIR)) return out
  const stack = [PACKAGES_DIR]
  while (stack.length) {
    const dirPath = stack.pop()
    let entries
    try {
      entries = readdirSync(dirPath, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.turbo') continue
      const p = join(dirPath, e.name)
      if (e.isDirectory()) stack.push(p)
      else if (e.isFile()) out.push(relative(ROOT, p).replace(/\\/g, '/'))
    }
  }
  return out
}

/**
 * 同一面、同一轮把一批 rel 读成 Map<rel, text|null>。
 * head/staged 经一次 catBatch(逐文件派生 git 在上千文件时就是 fork 风暴,§5b 同型);
 * worktree 逐文件走层的 readWorktreeFile —— 读失败**原样抛**(一个编码错误不得伪装成
 * "该文件不存在"的业务结论),由调用方折进"无法判定"。
 */
function readFaceContents(face, rels) {
  if (face === 'worktree') {
    const m = new Map()
    for (const rel of rels) m.set(rel, readWorktreeFile(ROOT, rel))
    return m
  }
  const batch = catBatch(ROOT, rels.map((r) => specOf(face, r)))
  const m = new Map()
  for (const rel of rels) m.set(rel, batch.get(specOf(face, rel)))
  return m
}

const specOf = (face, rel) => (face === 'staged' ? `:${rel}` : `HEAD:${rel}`)

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

/**
 * 从 TS 源码中提取 value export 名称集合(不含纯类型)。
 *
 * 识别:
 *   - export { a, b } [from '...']    (value re-export,但 export type { ... } 不算)
 *   - export * from '...'             (wildcard,无法静态枚举)
 *   - export function/const/class a   (value)
 *   - export enum E                   (value,运行时存在)
 *   - export default                  (value)
 *
 * 不识别(纯类型,编译后擦除,dist/index.js 里不存在):
 *   - export interface I
 *   - export type T
 *   - export type { ... } [from '...']
 */
/**
 * 入参是**已从被审面取到的源码文本**,不是路径 —— 取内容由调用方经 face-reader 完成,
 * 于是"面取不到"与"文件里没有 export"是两件不同事,不会被折成后者(那正是假绿的形状)。
 */
function extractSourceExports(srcText) {
  const src = String(srcText)
  const names = new Set()

  // export type { ... } [from '...']  — 纯类型 re-export,先标记后排除
  const typeOnlyNames = new Set()
  for (const m of src.matchAll(/export\s+type\s*\{([^}]+)\}\s*(?:from\s*['"][^'"]+['"])?/g)) {
    for (const name of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
      const final = name.split(/\s+as\s+/).pop().trim()
      if (final) typeOnlyNames.add(final)
    }
  }

  // export { a, b, c } [from '...']  — value re-export(排除 type-only)
  // 注意:ES2024 inline type 修饰符 `export { type T, value }` 中 `type T` 是纯类型,
  // 编译后被擦除,不应计入 value exports,否则 dist 永远 "缺失" 该 export(false positive)
  for (const m of src.matchAll(/export\s*\{([^}]+)\}\s*(?:from\s*['"][^'"]+['"])?/g)) {
    for (const name of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
      // 跳过 inline type 修饰符: `type Foo` / `type { Foo }`
      if (/^type\s+/.test(name)) continue
      const final = name.split(/\s+as\s+/).pop().trim()
      if (final && !final.startsWith('//') && !typeOnlyNames.has(final)) {
        names.add(final)
      }
    }
  }

  // export * from '...' (re-export all,无法静态枚举,标记为 wildcard)
  if (/export\s*\*\s*from\s*['"]/.test(src)) {
    names.add('__wildcard__')
  }

  // export function/const/class/enum a  (value,运行时存在)
  // 注意:不识别 export interface / export type(纯类型,编译后擦除)
  for (const m of src.matchAll(
    /export\s+(?:async\s+)?(?:function|const|class|enum)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    names.add(m[1])
  }

  // export default
  if (/export\s+default\s+/.test(src)) {
    names.add('default')
  }

  return names
}

/**
 * 从编译后的 JS 中提取 export 名称集合。
 * 识别: exports.a = ... / Object.defineProperty(exports, 'a', ...) / export { a, b }
 *       export function a() / export const a = / export class A / export default
 */
function extractDistExports(distPath) {
  const dist = readFileSync(distPath, 'utf8')
  const names = new Set()

  // CommonJS: exports.a = ... / Object.defineProperty(exports, 'a', ...)
  for (const m of dist.matchAll(/exports\.([A-Za-z_$][\w$]*)\s*=/g)) {
    names.add(m[1])
  }
  for (const m of dist.matchAll(/Object\.defineProperty\(exports,\s*['"]([^'"]+)['"]/g)) {
    names.add(m[1])
  }

  // ESM: export { a, b, c }
  for (const m of dist.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const name of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
      const final = name.split(/\s+as\s+/).pop().trim()
      if (final && !final.startsWith('//')) names.add(final)
    }
  }

  // ESM: export function/const/class a
  for (const m of dist.matchAll(
    /export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    names.add(m[1])
  }

  // ESM: export default
  if (/export\s+default\s+/.test(dist)) {
    names.add('default')
  }

  return names
}

/**
 * 判断包是否"从源码直接消费"(消费方直接读 ./src/* 或 .ts 源码,不依赖 dist 构建产物)。
 *
 * 命中条件: 运行时入口(main / module / exports['.'].import|require|default)
 * 指向 ./src/ 下文件或以 .ts/.tsx 结尾。此时 dist/index.js 是否存在/同步与产物
 * 无关,陈旧 dist 校验无意义 → 跳过,避免误报(见缺陷报告 F6: @ihui/ui-react 的
 * exports.import 为 "./src/index.ts",从不生成 dist,却被判定为"陈旧 dist")。
 * 注意: 仅看运行时入口,不纳入 types/typings —— 即便类型指向源码、入口指向 dist
 * 的包仍依赖 dist,不应被跳过(不误伤真正需要 dist 的包)。
 */
function isConsumedFromSource(pkg) {
  const entries = []
  if (typeof pkg.exports === 'string') {
    entries.push(pkg.exports)
  } else if (pkg.exports && typeof pkg.exports === 'object') {
    const root = pkg.exports['.']
    if (typeof root === 'string') entries.push(root)
    else if (root && typeof root === 'object') {
      for (const k of ['import', 'require', 'default', 'node']) {
        if (typeof root[k] === 'string') entries.push(root[k])
      }
    }
  }
  if (typeof pkg.main === 'string') entries.push(pkg.main)
  if (typeof pkg.module === 'string') entries.push(pkg.module)

  return entries.some(
    (v) => v.startsWith('./src/') || v.endsWith('.ts') || v.endsWith('.tsx'),
  )
}

/**
 * 枚举改走被审面:清单与源码内容同面同轮取(一次 catBatch),不再 `readdirSync + readFileSync`。
 * 只返回"面上同时存在 package.json 与 src/index.ts"的包目录;"有没有 build 脚本"要读内容才知道,
 * 所以留到取完内容之后判 —— 否则枚举用磁盘、内容用面,就是一把基准错位的尺子。
 */
function findCandidatePackages(face) {
  const files = listFaceFiles(face)
  const set = new Set(files)
  const out = []
  for (const rel of files) {
    if (!/^packages\/[^/]+\/package\.json$/.test(rel)) continue
    const dir = rel.replace(/\/package\.json$/, '')
    const srcRel = `${dir}/src/index.ts`
    if (!set.has(srcRel)) continue
    out.push({
      rel,
      dir,
      srcRel,
      // dist 是 .gitignore 的构建产物,仓库里没有 blob ⇒ 这一侧只能判本机(见文件头注)
      distIndex: join(ROOT, dir, 'dist', 'index.js'),
      pkgRoot: join(ROOT, dir),
    })
  }
  return out
}

/**
 * 纯函数:从清单里挑出"声明指向 dist/"的入口。
 * 抽出来是为了能用构造面证明判据有牙 —— 真机改名 dist 去验证会打断别人正在跑的 tsc,
 * 而"证明取材面/存在性这类行为"本就该用构造输入,不依赖仓库瞬时状态(守门 103 的教训)。
 */
export function declaredDistEntries(raw) {
  return [raw?.main, raw?.types, raw?.module].filter(
    (v) => typeof v === 'string' && /^\.?\/?dist\//.test(v),
  )
}
export function pickMissing(declared, exists) {
  return declared.filter((v) => !exists(v))
}

// ══════════════════ D 维:声明产物落后对账(本票新增)══════════════════
// 判据是**内容判据**:src/**/*.ts 的"导出声明名 + 接口/对象类型字段名"集合,与 dist/**/*.d.ts
// 的同形集合做差。**不用 mtime**(git 不存 mtime、检出顺序任意 ⇒ 干净机上一台恒红门,§12e)。
// 两侧共用下面这一份提取器 —— 两处实现必漂移是本仓记过最多次的失败型;而"src 的 .ts"与
// "dist 的 .d.ts"在声明语法上同形,同一份提取天然把比对噪声压到最小。

const DECL_MEMBER_MODIFIERS = new Set([
  'readonly',
  'public',
  'private',
  'protected',
  'static',
  'override',
  'abstract',
  'declare',
  'async',
  'get',
  'set',
])

/** 从 openIdx 的 `{` 找配对 `}`(输入已遮罩:字符串/注释里的花括号不存在)。找不到返回 -1。 */
export function matchBalancedBrace(text, openIdx) {
  let d = 0
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === '{') d++
    else if (text[i] === '}') {
      d--
      if (d === 0) return i
    }
  }
  return -1
}

/**
 * 对象成员区域 [start,end):抓**大括号深度 0** 上的行首标识符成员名(后跟 `?` `:` `(` `<`)。
 * 深度 >0 的内容(嵌套对象、参数表、函数体)一律不抓 —— 抓进"字段"会造出跨侧不对称的假落后。
 * 修饰词(readonly/private/get…)先跳过再看下一个标识符,否则 `readonly foo: T` 会记成 "readonly"。
 */
export function memberNamesOfRegion(text, start, end) {
  const names = new Set()
  let depth = 0
  let lineStart = true
  let i = start
  const skipWs = (k) => {
    while (k < end && (text[k] === ' ' || text[k] === '\t' || text[k] === '\r')) k++
    return k
  }
  while (i < end) {
    const c = text[i]
    if (c === '{' || c === '(' || c === '[') {
      depth++
      lineStart = false
      i++
      continue
    }
    if (c === '}' || c === ')' || c === ']') {
      depth--
      lineStart = false
      i++
      continue
    }
    if (c === '\n') {
      lineStart = true
      i++
      continue
    }
    // 同一行用 `;` / `,` 分隔的成员也是"行首"(`interface X { a: 1; b: 2 }` 与
    // 对象类型 `{ a: 1, b: 2 }` 是真写法;只看换行会把同行第二起的成员整批漏掉 ——
    // 而"src 一行、dist 多行"的排版本差异会把它变成**跨侧假落后**。
    if ((c === ';' || c === ',') && depth === 0) {
      lineStart = true
      i++
      continue
    }
    if (lineStart && /[A-Za-z_$]/.test(c)) {
      if (depth === 0) {
        let j = i
        while (j < end && /[\w$]/.test(text[j])) j++
        let word = text.slice(i, j)
        let k = skipWs(j)
        let guard = 0
        while (DECL_MEMBER_MODIFIERS.has(word) && guard < 4) {
          let m = k
          while (m < end && /\s/.test(text[m])) m++
          if (!/[A-Za-z_$]/.test(text[m] || '')) break
          let n = m
          while (n < end && /[\w$]/.test(text[n])) n++
          word = text.slice(m, n)
          k = skipWs(n)
          guard++
        }
        const nx = text[k]
        if (nx === ':' || nx === '?' || nx === '(' || nx === '<') names.add(word)
      }
      while (i < end && /[\w$]/.test(text[i])) i++
      lineStart = false
      continue
    }
    if (!/[ \t\r]/.test(c)) lineStart = false
    i++
  }
  return names
}

/**
 * 从一份 TS/d.ts 文本提取"声明名 → 字段集合"与解析问题清单。
 * 覆盖:export[+declare][+abstract] interface/type/class/enum/function/const/let/var/namespace/module,
 *       `export { a as b }` / `export type { X }` 名单式 re-export(名字在场,字段由定义文件并进来)。
 * 刻意不判:class/namespace/module 的成员(两侧天然不对称:tsc 把 private 字段降成 `private x;` 无冒号)、
 *          enum 成员(两侧写法不同形)。这些只比**声明名在场性** —— 漏判的方向是保守的,误判红不是。
 */
export function extractTypeDeclarations(rawText) {
  const text = maskCommentsAndStrings(String(rawText))
  const decls = new Map() // name -> Set(fields)
  const parseIssues = []
  const add = (name, fields) => {
    if (!name || name === 'default') return
    if (!decls.has(name)) decls.set(name, new Set())
    if (fields) for (const f of fields) decls.get(name).add(f)
  }

  for (const m of text.matchAll(/\bexport\s*(?:type\s*)?\{([^}]*)\}(?:\s+from)?/g)) {
    for (const part of m[1].split(',')) {
      const seg = part.trim()
      if (!seg) continue
      const mm = seg.match(/^(?:type\s+)?([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/)
      if (!mm) continue
      add(mm[2] || mm[1], null)
    }
  }

  // 正则**每次调用新建** —— 模块级 /g 正则的 lastIndex 会跨调用残留(守门 146 同型:恒假/恒绿的隐形状态)
  const headerRe =
    /\bexport\s+(?:declare\s+)?(?:abstract\s+)?(interface|type|class|const\s+enum|enum|function|namespace|module|const|let|var)\s+([A-Za-z_$][\w$]*)/g
  let m
  let cursor = 0
  while ((m = headerRe.exec(text)) !== null) {
    if (m.index < cursor) continue // 落在上一块 class/namespace body 里:两侧同跳,不 descent
    const kind = m[1] === 'const enum' ? 'enum' : m[1]
    const name = m[2]
    const after = headerRe.lastIndex
    if (kind === 'interface') {
      const open = text.indexOf('{', after)
      const semi = text.indexOf(';', after)
      if (open < 0 || (semi >= 0 && semi < open)) {
        add(name, null)
        continue
      }
      const close = matchBalancedBrace(text, open)
      if (close < 0) {
        parseIssues.push(`interface ${name}: 大括号不闭合`)
        add(name, null)
        continue
      }
      add(name, memberNamesOfRegion(text, open + 1, close))
    } else if (kind === 'type') {
      // RHS 窗口:从 `=` 起,到"深度 0 的 ;"或"深度 0 的换行且下一行不以 | & 续行"为止。
      // 窗口不收窄就会把后续非导出声明/函数体的花括号吸进别名字段 —— 立项实测的假落后正是这一型。
      const eq = text.indexOf('=', after)
      if (eq < 0) {
        add(name, null)
        continue
      }
      let end = text.length
      let depth = 0
      for (let i = eq + 1; i < text.length; i++) {
        const c = text[i]
        if (c === '{' || c === '(' || c === '[') depth++
        else if (c === '}' || c === ')' || c === ']') depth--
        else if (c === ';' && depth === 0) {
          end = i
          break
        } else if (c === '\n' && depth === 0) {
          let k = i + 1
          while (k < text.length && /[ \t\r]/.test(text[k])) k++
          if (text[k] === '|' || text[k] === '&') continue
          end = i
          break
        }
      }
      const fields = new Set()
      let d2 = 0
      for (let i = eq; i < end; ) {
        const c = text[i]
        if (c === '{' && d2 === 0) {
          const close = matchBalancedBrace(text, i)
          if (close < 0 || close > end) {
            parseIssues.push(`type ${name}: 对象字面量不闭合`)
            break
          }
          for (const f of memberNamesOfRegion(text, i + 1, close)) fields.add(f)
          i = close + 1
          continue
        }
        if (c === '{' || c === '(' || c === '[') d2++
        else if (c === '}' || c === ')' || c === ']') d2--
        i++
      }
      add(name, fields)
    } else if (kind === 'class' || kind === 'namespace' || kind === 'module') {
      // 名在场;body 整块跳过(两侧对称,且 namespace 内部成员的 export 写法在 src 与 d.ts 不同形)
      add(name, null)
      const open = text.indexOf('{', after)
      const semi = text.indexOf(';', after)
      if (open >= 0 && !(semi >= 0 && semi < open)) {
        const close = matchBalancedBrace(text, open)
        if (close < 0) parseIssues.push(`${kind} ${name}: 大括号不闭合`)
        else cursor = close + 1
      }
    } else {
      add(name, null)
    }
  }
  return { decls, parseIssues }
}

/** 把一批文本聚合成"声明名 → 字段并集";内容取不到/解析不出都落 issues(逐条报名,不静默)。 */
export function aggregateDeclarations(entries) {
  const agg = new Map()
  const issues = []
  for (const { label, text } of entries) {
    if (typeof text !== 'string') {
      issues.push(`${label}: 内容取不到`)
      continue
    }
    const { decls, parseIssues } = extractTypeDeclarations(text)
    for (const pi of parseIssues) issues.push(`${label}: ${pi}`)
    for (const [name, fields] of decls) {
      if (!agg.has(name)) agg.set(name, new Set())
      const t = agg.get(name)
      for (const f of fields) t.add(f)
    }
  }
  return { agg, issues }
}

/**
 * 差集:只算"src 有而 dist 没有"(落后方向)。dist 多出的名字是残留/被 tsc 自动递出的内部类型,
 * 单独计数**不判红** —— 把"多余"也算红会命中大量正常构建形态,恒红的代价是各会话跳门(§12e)。
 */
export function diffDeclarations(srcAgg, distAgg) {
  const missingNames = []
  const missingFields = []
  for (const [name, f] of srcAgg) {
    if (!distAgg.has(name)) {
      missingNames.push(name)
      continue
    }
    const df = distAgg.get(name)
    const miss = [...f].filter((x) => !df.has(x)).sort()
    if (miss.length) missingFields.push({ name, fields: miss })
  }
  let extrasNameCount = 0
  for (const name of distAgg.keys()) if (!srcAgg.has(name)) extrasNameCount++
  return { missingNames: missingNames.sort(), missingFields, extrasNameCount }
}

/** 落后项的稳定字符串形态 —— 棘轮两侧都用它做集合差("新增"= 被审面有、HEAD 锚没有)。 */
export function declarationLagItems(diff) {
  const items = new Set(diff.missingNames)
  for (const g of diff.missingFields) for (const f of g.fields) items.add(`${g.name}.${f}`)
  return items
}
export function lagScore(items) {
  return items.size
}
export function subtractLagItems(audited, anchor) {
  return new Set([...audited].filter((x) => !anchor.has(x)))
}

/**
 * 清单里是否有任何**声明入口**走 dist:顶层 types/typings,或 exports 树上任意键名为 types 的
 * 字符串值(含子路径与条件嵌套)。命中 ⇒ 该包消费方经 tsc/node 解析会读到 dist 的 .d.ts ⇒
 * 落后判红有真实受害者;含 `*` 的 pattern 入口无法逐文件核存在性 ⇒ 只要求 dist 里有 .d.ts。
 */
export function typesPointToDist(raw) {
  const distPaths = []
  const patterns = []
  const push = (v) => {
    if (typeof v !== 'string') return
    if (!/^\.?\/?dist\//.test(v)) return
    if (v.includes('*')) patterns.push(v)
    else distPaths.push(v)
  }
  push(raw?.types)
  push(raw?.typings)
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string') {
        if (k === 'types') push(v)
      } else if (v && typeof v === 'object') {
        walk(v)
      }
    }
  }
  walk(raw?.exports)
  return { distPaths, patterns, declared: distPaths.length + patterns.length > 0 }
}

/** dist 的 .d.ts 遍历(本机磁盘 —— 仓库里没有 blob,口径见文件头注;跳过 .map 与 node_modules)。 */
export function listDistDts(pkgRoot) {
  const dir = join(pkgRoot, 'dist')
  const out = []
  if (!existsSync(dir)) return out
  const stack = [dir]
  while (stack.length) {
    const d = stack.pop()
    let entries
    try {
      entries = readdirSync(d, { withFileTypes: true })
    } catch {
      out.push(`__unreadable__:${d}`)
      continue
    }
    for (const e of entries) {
      if (e.name === 'node_modules') continue
      const p = join(d, e.name)
      if (e.isDirectory()) stack.push(p)
      else if (e.isFile() && e.name.endsWith('.d.ts')) out.push(p)
    }
  }
  return out
}

const DECL_SRC_EXCLUDE =
  /(^|\/)(?:tests?|__tests__|fixtures?)(?:\/|$)|\.(?:test|spec)\.(?:ts|tsx)$|\.stories\.(?:ts|tsx)$/
function srcFilesForDir(faceFiles, dir) {
  const prefix = `${dir}/src/`
  return faceFiles
    .filter((p) => p.startsWith(prefix))
    .filter((p) => /\.(ts|tsx)$/.test(p))
    .filter((p) => !DECL_SRC_EXCLUDE.test(p))
    .sort()
}

/** 包级判定表头注里的"三档"。 */
const DECL_CLASSIFIED = {
  declared: 'a', // 清单声明入口走 dist ⇒ 落后判红(锚点=该包 HEAD 自身落后集)
  undeclared: 'b', // 清单不指 dist 而 dist 有 .d.ts ⇒ 校验但只报数(无 manifest 消费者,判红只造跳门)
  absent: 'skip', // 本机没有 .d.ts 且清单不指 dist ⇒ 不适用
}

/**
 * D 维主流程(包级)。返回 { rows, reds, undetermined, onlyReported, skipped, extrasTotal }。
 * rows 是人读明细(每包一行),reds 是判红项 {pkg, issue, fix};两维的口径写在各自行内,
 * 报告里不许把"未判定"折进"同步",也不许把"只报数"折进"判红"。
 */
function runDeclarationDimension({ face, packages, faceFiles, undetermined }) {
  const rows = []
  const reds = []
  const onlyReported = []
  const skipped = []
  const stockOnly = [] // 判出落后但落在锚内(或被审面非 HEAD 的档 a)/档 b ⇒ 不判红,但**不得被读成"同步"**
  let extrasTotal = 0

  // ① 分类 + dist 取材(一次磁盘遍历,锚与被审面共用 —— dist 只有一个,在本机)
  const ctx = []
  for (const pkg of packages) {
    const tp = typesPointToDist(pkg.raw)
    const dtsPaths = listDistDts(pkg.pkgRoot)
    const unreadableDir = dtsPaths.filter((p) => p.startsWith('__unreadable__:'))
    const realDts = dtsPaths.filter((p) => !p.startsWith('__unreadable__:'))
    const declaredMissing = tp.distPaths.filter((v) => !existsSync(join(pkg.pkgRoot, v)))
    const cls = tp.declared ? DECL_CLASSIFIED.declared : realDts.length ? DECL_CLASSIFIED.undeclared : DECL_CLASSIFIED.absent

    if (cls === DECL_CLASSIFIED.absent) {
      skipped.push(`${pkg.name}(本机 dist 无 .d.ts,清单也未把声明入口指向 dist ⇒ 无声明面可对)`)
      continue
    }
    if (cls === DECL_CLASSIFIED.declared && (realDts.length === 0 || declaredMissing.length || unreadableDir.length)) {
      // §7:--staged 档(dist 与本次提交无关是常态)取不到 dist ⇒ **判"无法判定"**,既不冒红也不记绿
      undetermined.push(
        `${pkg.name}[D维] dist 取不到:` +
          (realDts.length === 0
            ? ' 本机 dist 下没有任何 .d.ts(未构建/被清理)'
            : '') +
          (declaredMissing.length ? `; 声明入口缺失 ${declaredMissing.join(', ')}` : '') +
          (unreadableDir.length ? `; dist 目录读不开` : '') +
          ' —— 无法判定 ≠ 同步',
      )
      rows.push(`⚠ ${pkg.name} [档a] dist 取不到 ⇒ 无法判定`)
      continue
    }

    const distEntries = realDts.map((p) => {
      let text = null
      try {
        text = readFileSync(p, 'utf8')
      } catch {
        text = null // aggregateDeclarations 会把这条落进 issues(报名),不静默当"没有"
      }
      return { label: relative(ROOT, p).replace(/\\/g, '/'), text }
    })
    const distAgg = aggregateDeclarations(distEntries)
    const srcRels = srcFilesForDir(faceFiles, pkg.dir)
    ctx.push({ pkg, tp, cls, srcRels, distAgg })
  }

  // ② 被审面 src 取材(一次 batch,同面同轮)
  const allRels = [...new Set(ctx.flatMap((c) => c.srcRels))]
  let faceContents = new Map()
  let faceReadErr = null
  if (allRels.length) {
    try {
      faceContents = readFaceContents(face, allRels)
    } catch (e) {
      faceReadErr = (e?.message || e).toString().slice(0, 160)
    }
  }
  if (faceReadErr) {
    for (const c of ctx) {
      if (c.cls === DECL_CLASSIFIED.declared) {
        undetermined.push(`${c.pkg.name}[D维] 被审面(${face})的 src 取不到:${faceReadErr}`)
      }
    }
    return { rows, reds, undetermined, onlyReported, skipped, stockOnly, extrasTotal }
  }

  // ③ HEAD 锚取材:只在"档 a 且被审面判出落后项、且被审面不是 HEAD"时才需要第二面
  const needAnchor = face !== 'head'
  let headContents = null
  let headReadErr = null
  const audited = new Map() // dir -> {items, diff, issues}

  for (const c of ctx) {
    const srcEntries = c.srcRels.map((rel) => ({ label: rel, text: faceContents.get(rel) }))
    const srcAgg = aggregateDeclarations(srcEntries)
    const diff = diffDeclarations(srcAgg.agg, c.distAgg.agg)
    const issues = [...srcAgg.issues, ...c.distAgg.issues]
    audited.set(c.pkg.dir, { items: declarationLagItems(diff), diff, issues })
    extrasTotal += diff.extrasNameCount
  }

  if (needAnchor) {
    const anchorRels = [
      ...new Set(
        ctx
          .filter(
            (c) =>
              c.cls === DECL_CLASSIFIED.declared &&
              (audited.get(c.pkg.dir).items.size > 0 || audited.get(c.pkg.dir).issues.length > 0),
          )
          .flatMap((c) => c.srcRels),
      ),
    ]
    if (anchorRels.length) {
      try {
        headContents = readFaceContents('head', anchorRels)
      } catch (e) {
        headReadErr = (e?.message || e).toString().slice(0, 160)
      }
    }
  }

  // ④ 逐包结论
  for (const c of ctx) {
    const { pkg, cls } = c
    const a = audited.get(pkg.dir)
    const tag = cls === DECL_CLASSIFIED.declared ? '档a(声明入口走 dist)' : '档b(清单不指 dist,只报数)'

    if (a.items.size === 0 && a.issues.length === 0) {
      rows.push(`✓ ${pkg.name} [${tag}] 声明落后 0 项`)
      continue
    }

    // 解析不完整 ⇒ 这一包的结论不可靠:落"无法判定",逐条报名,不冒红也不记绿
    if (a.issues.length) {
      if (cls === DECL_CLASSIFIED.declared) {
        undetermined.push(
          `${pkg.name}[D维] 解析判不出(${a.issues.length} 处,例:${a.issues.slice(0, 3).join(' | ')})—— 判不出 ≠ 同步`,
        )
      }
      rows.push(
        `⚠ ${pkg.name} [${tag}] 解析判不出 ${a.issues.length} 处${cls === DECL_CLASSIFIED.declared ? ' ⇒ 无法判定' : '(档b 不计)'};已判出的落后项 ${a.items.size}`,
      )
      continue
    }

    if (cls === DECL_CLASSIFIED.undeclared) {
      // 档 b:manifest 没有任何声明入口走 dist ⇒ 消费方结构上读不到这份 d.ts。
      // 落后不再"整片跳过"而是不判红地**报名 + 给修复出口**(§4:不许为消存量把包整片跳过)。
      onlyReported.push({
        pkg: pkg.name,
        items: [...a.items].slice(0, 6),
        total: a.items.size,
        fix: `pnpm --filter ${pkg.name} build`,
      })
      stockOnly.push({ pkg: pkg.name, total: a.items.size })
      rows.push(`• ${pkg.name} [${tag}] 声明落后 ${a.items.size} 项(只报数,见下)`)
      continue
    }

    if (!needAnchor) {
      // 被审面就是 HEAD:锚即自身 ⇒ 全量档按"零容忍现读"报名并判红(存量实测为 0,见票面纪律④;
      // 任何一项都是"这台机的声明产物落后",修复出口唯一:重建该包)。
      reds.push({
        pkg: pkg.name,
        issue: `声明产物落后于源码(内容判据,D维·HEAD 面):落后 ${a.items.size} 项 —— ${[...a.items].slice(0, 8).join(', ')}${a.items.size > 8 ? ` …另有 ${a.items.size - 8} 项` : ''}`,
        fix: `pnpm --filter ${pkg.name} build`,
      })
      rows.push(`✗ ${pkg.name} [${tag}] 声明落后 ${a.items.size} 项 ⇒ 判红`)
      continue
    }

    // 被审面(索引/磁盘)有落后项:棘轮锚 = 该包 HEAD 自身落后集。存量不拦本次无关提交(§12e),
    // 只有"本次改动把落后加回来了"才红。
    if (headReadErr) {
      undetermined.push(`${pkg.name}[D维] 锚面(HEAD)取不到:${headReadErr} —— 无法判定 ≠ 同步`)
      rows.push(`⚠ ${pkg.name} [${tag}] 锚面取不到 ⇒ 无法判定(被审面落后 ${a.items.size} 项)`)
      continue
    }
    const headEntries = c.srcRels.map((rel) => ({ label: `HEAD:${rel}`, text: headContents.get(rel) }))
    const headAgg = aggregateDeclarations(headEntries)
    if (headAgg.issues.length) {
      undetermined.push(`${pkg.name}[D维] 锚面(HEAD)解析判不出(${headAgg.issues.slice(0, 2).join(' | ')})`)
      rows.push(`⚠ ${pkg.name} [${tag}] 锚面判不出 ⇒ 无法判定(被审面落后 ${a.items.size} 项)`)
      continue
    }
    const anchorItems = declarationLagItems(diffDeclarations(headAgg.agg, c.distAgg.agg))
    const newItems = subtractLagItems(a.items, anchorItems)
    if (newItems.size > 0) {
      reds.push({
        pkg: pkg.name,
        issue:
          `声明产物落后于源码(D维·${face === 'staged' ? '索引' : '磁盘'} 面,新增 ${newItems.size} 项 / 该包 HEAD 自身存量 ${anchorItems.size} 项,存量不拦本次):` +
          `${[...newItems].slice(0, 8).join(', ')}${newItems.size > 8 ? ` …另有 ${newItems.size - 8} 项` : ''}`,
        fix: `pnpm --filter ${pkg.name} build`,
      })
      rows.push(`✗ ${pkg.name} [${tag}] 声明落后 ${a.items.size} 项(其中新增 ${newItems.size})⇒ 判红`)
    } else {
      if (a.items.size > 0) stockOnly.push({ pkg: pkg.name, total: a.items.size, anchor: anchorItems.size })
      rows.push(`• ${pkg.name} [${tag}] 声明落后 ${a.items.size} 项 = 全部为该包 HEAD 自身存量 ⇒ 不拦本次(存量属于"这台机的 dist 旧",全量档会判红)`)
    }
  }

  return { rows, reds, undetermined, onlyReported, skipped, stockOnly, extrasTotal }
}

function main() {
  const argv = process.argv.slice(2)
  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  const strict = argv.includes('--strict')
  const rootIdx = argv.indexOf('--root')
  if (rootIdx >= 0 && argv[rootIdx + 1]) setRoot(argv[rootIdx + 1])
  // selectFace 返回 {face, error}(层的对外形状);两面同给必须判死,不能任选一面开工。
  const faceSel = selectFace({ staged, worktree, def: 'head' })
  if (faceSel.error) {
    console.error(`❌ 无法判定:${faceSel.error}`)
    process.exit(2)
  }
  const face = faceSel.face
  let cands
  try {
    cands = findCandidatePackages(face)
  } catch (e) {
    console.error(`❌ 无法判定:枚举被审面(${face})失败 —— ${(e?.message || e).toString().slice(0, 160)}`)
    process.exit(2)
  }

  // 一次 cat-file --batch 取满"清单 + 源码入口",同面同轮 —— 清单来自磁盘、内容来自 git
  // 会造出自洽却基准错位的尺子(守门 101/103 各记过一次)。
  let contents
  try {
    contents = readFaceContents(face, cands.flatMap((c) => [c.rel, c.srcRel]))
  } catch (e) {
    console.error(`❌ 无法判定:被审面(${face})的内容取不到 —— ${(e?.message || e).toString().slice(0, 160)}`)
    process.exit(2)
  }
  if (cands.length === 0) {
    console.error('❌ 无法判定:面上枚举到 0 个候选包 ⇒ 枚举本身坏了,不得把"0 个包"读成"全部同步"')
    process.exit(2)
  }

  const packages = []
  const undetermined = []
  for (const c of cands) {
    const rawText = contents.get(c.rel)
    const srcText = contents.get(c.srcRel)
    if (typeof rawText !== 'string' || typeof srcText !== 'string') {
      undetermined.push(`${c.dir}(面 ${face} 上取不到清单或 src/index.ts)`)
      continue
    }
    let parsed
    try {
      parsed = JSON.parse(rawText.replace(/^\uFEFF/, ''))
    } catch (e) {
      undetermined.push(`${c.dir}(清单不是合法 JSON:${(e?.message || e).toString().slice(0, 60)})`)
      continue
    }
    if (!parsed?.scripts?.build) continue // 没有 build 脚本 ⇒ 不产 dist,不属本门
    packages.push({ ...c, name: parsed.name || c.dir, raw: parsed, srcText })
  }
  if (packages.length === 0) {
    console.log(
      `${C.yellow}⚠${C.reset} 未找到有 build 脚本的 packages/* (候选 ${cands.length} 个,未判定 ${undetermined.length} 个)`,
    )
    process.exit(undetermined.length ? 2 : 0)
  }

  const stale = []
  const ok = []

  for (const pkg of packages) {
    const srcExports = extractSourceExports(pkg.srcText)

    // 从源码直接消费的包(exports/main 指向 ./src/ 或 .ts)不依赖 dist 构建产物,
    // 跳过陈旧 dist 校验,避免误报(见缺陷报告 F6: @ihui/ui-react)
    if (isConsumedFromSource(pkg.raw)) {
      ok.push(`${pkg.name} (skip: 从源码消费,不校验 dist〔V维 value 名〕;声明对账见 D 维)`)
      continue
    }

    // 跳过 wildcard (export * from) - 无法静态校验,且可能无 dist(源码直接消费)
    if (srcExports.has('__wildcard__')) {
      /**
       * wildcard 只让"符号集合比不了"成立,不能让"入口文件在不在"也变成判不了。
       * 2026-09-26 实测:本仓 4 个包是 wildcard re-export,其中 `@ihui/types` 的 dist 陈旧
       * (源码有 AgentInstanceState 而 dist 没有)、`@ihui/i18n` 的 dist **整个不存在** ——
       * 三端 typecheck 因此红到 56 条,而本门同期打印"✓ 所有 dist 与源码同步,无陈旧问题"。
       * 一道在故障现场报绿的尺子比没有尺子更糟(§12e 同型:它还会让人养成跳门的习惯)。
       * 收紧的判据只有一条、且不会误伤"从源码消费"的包:清单里 main/types **自己声明**指向
       * dist/ 的,那个入口就必须存在;不指向 dist 的包(从源码消费)天然不进这一条。
       */
      const declared = declaredDistEntries(pkg.raw)
      const gone = pickMissing(declared, (v) => existsSync(join(pkg.pkgRoot, v)))
      if (declared.length && gone.length) {
        stale.push({
          pkg: pkg.name,
          issue: `清单声明入口指向 dist 但文件不存在(未构建或被误删): ${gone.join(', ')} —— 该包是 wildcard re-export,符号比对做不了,但存在性做得了`,
          fix: `pnpm --filter ${pkg.name} build`,
        })
        continue
      }
      ok.push(`${pkg.name} (skip: wildcard re-export${declared.length ? `,已核声明入口 ${declared.length} 个在位` : ''};声明对账见 D 维)`)
      continue
    }

    // dist/index.js 不存在 = 完全陈旧
    if (!existsSync(pkg.distIndex)) {
      stale.push({
        pkg: pkg.name,
        issue: 'dist/index.js 不存在(未构建或被误删)',
        fix: `pnpm --filter ${pkg.name} build`,
      })
      continue
    }

    const distExports = extractDistExports(pkg.distIndex)

    // 找源码有但 dist 没有的 export
    const missing = [...srcExports].filter((n) => !distExports.has(n) && n !== '__wildcard__')
    if (missing.length > 0) {
      stale.push({
        pkg: pkg.name,
        issue: `dist 缺失 export: ${missing.join(', ')}`,
        fix: `pnpm --filter ${pkg.name} build`,
      })
      continue
    }

    ok.push(pkg.name)
  }

  // ── D 维:声明产物落后对账(内容判据;wildcard 包与"从源码消费"包都在射程内)──
  const decl = runDeclarationDimension({ face, packages, faceFiles: listFaceFiles(face), undetermined })

  console.log(`${C.cyan}📦${C.reset} 检测 ${packages.length} 个 packages/* 的 dist 同步状态\n`)
  console.log(
    `   口径:包清单与 src 入口取被审面(${face === 'staged' ? '索引 blob' : face === 'worktree' ? '工作树磁盘(人工档)' : 'HEAD blob'});` +
      `dist 取本机磁盘 —— 它是 .gitignore 的产物,仓库里没有 blob,本门不假装"审过了仓库里的 dist"\n`,
  )

  if (ok.length > 0) {
    console.log(`${C.green}✓${C.reset} 同步 (V维, ${ok.length}):`)
    for (const name of ok) {
      console.log(`  ${C.green}•${C.reset} ${name}`)
    }
  }

  console.log(`\n${C.cyan}🧭${C.reset} D 维·声明对账(内容判据:src 导出声明+接口/对象类型字段 ⊖ dist 同形集合;不用 mtime,git 不存 mtime ⇒ 干净机上会造恒红门):`)
  for (const r of decl.rows) console.log(`  ${r}`)
  for (const s of decl.skipped) console.log(`  · ${s}`)
  if (decl.onlyReported.length) {
    console.log(`\n${C.yellow}•${C.reset} D 维·档 b 只报数(清单没有任何声明入口走 dist ⇒ 判红只会拦无关提交;重新构建即可消账):`)
    for (const o of decl.onlyReported) {
      console.log(
        `    ${o.pkg} 落后 ${o.total} 项(例:${o.items.join(', ')}) ${C.dim}修复:${C.reset}${C.yellow}${o.fix}${C.reset}`,
      )
    }
  }
  console.log(`   dist 多出的声明名(tsc 递出的内部类型/残留,方向不算落后,只计数): ${decl.extrasTotal}`)

  const allReds = [...stale, ...decl.reds]
  if (allReds.length > 0) {
    console.log(`\n${C.red}✗${C.reset} 陈旧 (${allReds.length} 项${decl.reds.length ? ',含 D 维' : ''}):`)
    for (const s of allReds) {
      console.log(`  ${C.red}•${C.reset} ${s.pkg}`)
      console.log(`    ${C.dim}问题:${C.reset} ${s.issue}`)
      console.log(`    ${C.dim}修复:${C.reset} ${C.yellow}${s.fix}${C.reset}`)
    }
    console.log(
      `\n${C.red}✗${C.reset} 发现 ${allReds.length} 个陈旧 dist,请运行对应 build 命令重建。`,
    )
    process.exit(1)
  }

  /**
   * 未判定必须出声,但**刻意不改退出码**:并发会话正在新增/搬运包时"面上暂时取不齐"是常态,
   * 把它判红就是一台与任何提交内容无关的恒红门,唯一结局是各会话合法跳门、连带废掉全部守门(§12e)。
   * 出声与判红是两件事 —— 沉默才是缺陷,"报数但不拦"不是。--strict 例外:那是"拒绝出合格证",
   * 与"判红"不同(exit 2 = 本轮没有任何合格证可签,CI/问责用)。
   */
  if (undetermined.length) {
    console.log(`\n⚠️  未判定 ${undetermined.length} 项(V维取材 + D维 dist/解析)—— 未判定不等于通过:`)
    for (const u of undetermined.slice(0, 8)) console.log(`   · ${u}`)
    if (undetermined.length > 8) console.log(`   … 另有 ${undetermined.length - 8} 项`)
  }

  if (undetermined.length) {
    console.log(
      `\n${C.yellow}⚠${C.reset} 已判部分未发现新增陈旧,但有 ${undetermined.length} 项无法判定 —— 本轮**不出具**"所有 dist 与源码同步"的合格证(未判定不是未拦,更不是通过)。`,
    )
    process.exit(strict ? 2 : 0)
  }

  if (decl.stockOnly.length) {
    console.log(
      `\n${C.yellow}⚠${C.reset} 本次改动无新增落后,但有 ${decl.stockOnly.length} 个包的 dist 声明产物**落后于 HEAD 源码的存量**(本机 dist 旧:${decl.stockOnly.map((s) => `${s.pkg}(${s.total} 项)`).join(', ')})—— 本轮不判红,但同样**不是**"所有 dist 与源码同步"。`,
    )
    process.exit(0)
  }

  console.log(`\n${C.green}✓${C.reset} 所有 dist 与源码同步,无陈旧问题。`)
  process.exit(0)
}

/**
 * 自检全部用**构造面**:本门判的是磁盘上的构建产物,真去改名 dist 会打断别的会话正在跑的 tsc,
 * 而"证明这类行为"本就不该依赖仓库瞬时状态(守门 103 的同一教训)。
 * 成对用例,缺任何一条都说明"收紧"只是写了个表达式。
 */
function runSelfTest() {
  const results = []
  const check = (name, ok) => results.push({ name, ok })

  // ① 通配包的声明入口这一维:挑得出来、缺了能点名、都在位不凭空造红
  const declared = declaredDistEntries({ main: './dist/index.js', types: './dist/index.d.ts' })
  check('S1 清单声明指向 dist 的入口应全部挑出(2 个)', declared.length === 2)
  const gone = pickMissing(declared, (v) => v !== './dist/index.js')
  check('S2 其中一个不存在 ⇒ 必须被点名', gone.length === 1 && gone[0] === './dist/index.js')
  check('S3 反向:两个都在位 ⇒ 不得凭空造陈旧', pickMissing(declared, () => true).length === 0)
  // ④ "从源码消费"那一族不得被拖进这一条 —— 误伤会让人跳门,而跳门废掉的是全部守门
  check(
    'S4 main 指向 src 的包不声明 dist 入口(不误伤从源码消费那一族)',
    declaredDistEntries({ main: './src/index.ts', types: './src/index.ts' }).length === 0,
  )
  // ⑤ 空文本与"面上取不到该文件"是两件事:这里钉住前者不会被伪装成 wildcard
  check(
    'S5 空源码文本 ⇒ 判不出任何导出,且不会被标成 wildcard',
    extractSourceExports('').has('__wildcard__') === false,
  )

  // ── D 维(声明对账)── 成对用例。全部用**构造面**,不碰仓库瞬时状态(§22c:判据的对象是
  // 形态时用构造输入,而"取材面这类行为只能用纯函数+构造面"是守门 103 记过的课)。
  const mkAgg = (t) => aggregateDeclarations([{ label: 'x.ts', text: t }])
  // D1 阳性:src 多一个字段 ⇒ 该项进落后集
  {
    const src = mkAgg('export interface Msg { id: string; newerField: number }')
    const dist = mkAgg('export interface Msg { id: string }')
    const diff = diffDeclarations(src.agg, dist.agg)
    const items = declarationLagItems(diff)
    check('D1 src 有而 dist 无的接口字段 ⇒ 必须被点名(正向)', items.has('Msg.newerField') && items.size === 1)
    check('D1b 同一形态换成两侧齐备 ⇒ 不得命中(反向对照)', lagScore(declarationLagItems(diffDeclarations(dist.agg, dist.agg))) === 0)
  }
  // D2 阳性:src 整个声明缺失
  {
    const src = mkAgg('export interface Ghost { a: string }\nexport type Alias = { b: number }')
    const dist = mkAgg('export interface Unrelated { c: string }')
    const items = declarationLagItems(diffDeclarations(src.agg, dist.agg))
    check('D2 声明名缺失 ⇒ 点名(名+Alias 字段不误判)', items.has('Ghost') && items.has('Alias') && !items.has('Alias.b'))
  }
  // D3 注释里的声明不得入账(门不得给自己发合格证,也不得把说明判成违规)
  {
    const a = mkAgg('// export interface GhostComment { a: string }\n/* export interface BlockGhost { b: 1 } */\nexport const x = 1')
    check('D3 注释中的 export interface 不得被算作声明', !a.agg.has('GhostComment') && !a.agg.has('BlockGhost'))
  }
  // D4 字符串里的花括号不得打断配对(遮罩方向钉死)
  {
    const a = mkAgg('export interface S { t: string\n}\nconst noise = "} { export interface StrGhost { a: 1 }"')
    const items = [...a.agg.keys()]
    check('D4 字符串里的声明形态不得入账', !a.agg.has('StrGhost') && items.includes('S'))
    check('D4b 解析无问题 ⇒ 不产生"判不出"', a.issues.length === 0 && mkAgg('export interface Broken { a: string').issues.length === 1)
  }
  // D5 type 别名 RHS 窗口:后续 const 对象的字段不得被吸入别名(立项实测假阳,见头注)
  {
    const a = mkAgg("export type Level = 'low' | 'high'\nconst TAB = { low: 1, high: 2 }\nexport interface Tail { z: number }")
    check('D5 别名 RHS 不吞后续声明字段/不吸 Tail 名', a.agg.get('Level').size === 0 && a.agg.has('Tail') && !a.agg.has('TAB'))
  }
  // D6 名单式 re-export:两侧同形,不得造出假落后;`export {}` 空清单不得产出名
  {
    const src = mkAgg("export { type Foo } from './f'\nexport { bar as renamed } from './b'")
    const dist = mkAgg("export { Foo } from './f.js';\nexport { renamed } from './b.js';")
    check('D6 re-export 名单两侧对齐 ⇒ 零落后', lagScore(declarationLagItems(diffDeclarations(src.agg, dist.agg))) === 0)
    check('D6b 空 export {} 不得产出幽灵名', !mkAgg('export {};\n').agg.size)
  }
  // D7 class/namespace 只比名在场;body 不 descent(src 与 d.ts 的 private/成员写法天然不同形)
  {
    const src = mkAgg('export class C { private secret: string\n  constructor() {} }')
    const dist = mkAgg('export declare class C {\n    private secret;\n    constructor();\n}')
    const d = diffDeclarations(src.agg, dist.agg)
    check('D7 class 不比成员 ⇒ 不误判(private 两侧写法不同形)', lagScore(declarationLagItems(d)) === 0 && d.missingNames.length === 0)
    const ns1 = mkAgg('export namespace N { export interface M { a: number } }')
    const ns2 = mkAgg('export declare namespace N {\n    interface M {\n        a: number;\n    }\n}')
    check('D7b namespace body 两侧同跳 ⇒ 不造跨侧假落后', !ns1.agg.has('M') && !ns2.agg.has('M') && ns1.agg.has('N') && ns2.agg.has('N'))
  }
  // D8 清单分类:types→dist 走 a 档;exports 子路径里的 types 也要认;全 src ⇒ b 档
  {
    const a = typesPointToDist({ types: './src/index.ts', exports: { './sub': { types: './dist/sub.d.ts' } } })
    check('D8 exports 子路径的 types 指 dist ⇒ 判为 a 档', a.declared === true && a.distPaths.length === 1)
    const b = typesPointToDist({ main: './src/index.ts', types: './src/index.ts', exports: { '.': { types: './src/index.ts' } } })
    check('D8b 全 src 清单 ⇒ 判为 b 档(不冒充有声明消费方)', b.declared === false)
    const p = typesPointToDist({ exports: { './*': { types: './dist/*.d.ts' } } })
    check('D8c pattern 入口单列(无法逐文件核存在性)', p.declared && p.patterns.length === 1 && p.distPaths.length === 0)
  }
  // D9 dist 取不到 ⇒ 不得被算作"同步",也不得被算作"落后"(三态第三格)
  check(
    'D9 dist 完全缺失 ⇒ 枚举为空,由主流程折进"无法判定"(枚举为空即无从对账,不冒红不记绿)',
    listDistDts(join(ROOT, 'packages', '__definitely_no_such_pkg__')).length === 0,
  )
  // D10 extras 方向:dist 多出的名不判落后,只计数
  {
    const src = mkAgg('export interface A { x: 1 }')
    const dist = mkAgg('export interface A { x: 1 }\nexport interface ExtraOnly { y: 2 }')
    const d = diffDeclarations(src.agg, dist.agg)
    check('D10 dist 残留多出声明 ⇒ 不算落后、extrasNameCount 计数', lagScore(declarationLagItems(d)) === 0 && d.extrasNameCount === 1)
  }
  // D11 内容取不到 ≠ 没有声明:必须落 issues(把"没判到"写成"判过了"是本仓最高频失效型)
  {
    const a = aggregateDeclarations([{ label: 'missing.ts', text: null }, { label: 'ok.ts', text: 'export interface K { a: 1 }' }])
    check('D11 text=null 的文件必须报名为问题项,不得静默跳过', a.issues.length === 1 && a.agg.has('K'))
  }
  // D12 棘轮方向:新增项才红;存量项(HEAD 已判出)不得顶红本次无关提交
  {
    const anchor = new Set(['Old.a', 'Old.b'])
    const audited = new Set(['Old.a', 'Old.b', 'NewField.c'])
    const pure = subtractLagItems(audited, anchor)
    check('D12 被审面 ⊃ 锚 ⇒ 只点名新增', pure.size === 1 && pure.has('NewField.c'))
    check('D12b 被审面 == 锚 ⇒ 新增集为空(存量不判红)', subtractLagItems(anchor, anchor).size === 0)
  }
  // D13 src 枚举口径:tests/fixture/spec/stories 不进比对;src 下的 .d.ts 进(它是手写的声明源头)
  {
    const rels = srcFilesForDir(
      [
        'packages/p/src/index.ts',
        'packages/p/src/a.test.ts',
        'packages/p/src/__tests__/b.ts',
        'packages/p/tests/c.ts',
        'packages/p/src/types.d.ts',
        'packages/p/src/ui.tsx',
        'packages/p/dist/index.d.ts',
      ],
      'packages/p',
    )
    check(
      'D13 测试面不进射程、src 的 .d.ts 与 dist 目录本身按口径处理',
      rels.includes('packages/p/src/index.ts') &&
        rels.includes('packages/p/src/types.d.ts') &&
        rels.includes('packages/p/src/ui.tsx') &&
        !rels.includes('packages/p/src/a.test.ts') &&
        !rels.includes('packages/p/src/__tests__/b.ts') &&
        !rels.includes('packages/p/tests/c.ts') &&
        !rels.includes('packages/p/dist/index.d.ts'),
    )
  }

  const failed = results.filter((r) => !r.ok)
  for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.name}`)
  console.log(
    failed.length
      ? `\n❌ check-stale-dist self-test ${failed.length}/${results.length} 条失败`
      : `\n✅ check-stale-dist self-test 全部通过(${results.length} 条)`,
  )
  process.exit(failed.length ? 1 : 0)
}

export const __test__ = {
  declaredDistEntries,
  pickMissing,
  extractSourceExports,
  extractDistExports,
  isConsumedFromSource,
  // D 维(声明对账)—— 镜像测试直接 import 这些源实现,禁止在测试里再抄一份判据(§22c)
  extractTypeDeclarations,
  aggregateDeclarations,
  diffDeclarations,
  declarationLagItems,
  lagScore,
  subtractLagItems,
  typesPointToDist,
  matchBalancedBrace,
  memberNamesOfRegion,
  listDistDts,
  srcFilesForDir,
  setRoot,
  getRoot: () => ROOT,
}

// §22d 双形态入口守卫:测试 import 本模块时不得连带触发 CLI 主流程(它会 process.exit)。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  if (process.argv.slice(2).includes('--self-test')) runSelfTest()
  else main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
