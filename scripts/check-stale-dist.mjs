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
 * 检测策略: 对比每个包 src/index.ts 的 export 名称集合
 *           与 dist/index.js 的 export 名称集合,不一致则报错。
 *
 * 用法: node scripts/check-stale-dist.mjs
 *   exit 0 = 所有 dist 与源码同步
 *   exit 1 = 发现陈旧 dist(需要重建对应包)
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// 被审内容(包清单、src 入口)一律经统一取材层取**被审判的那个面**:全量档 HEAD blob、
// --staged 档索引 blob。按磁盘判会随共享工作树滞后 HEAD 而在"恒红"与"假绿"之间来回跳
// (守门 83 的 R3 登记一天被整文件回退三次即此型),且 `ROOT = process.cwd()` 意味着
// "扫哪棵树"由调用者站在哪儿决定 —— 守门 70 的镜像测试 13/14 恒红就是这一型。
//
// 唯一**故意**留在磁盘上的是 `dist/`:它是被 .gitignore 忽略的构建产物,仓库里没有对应
// blob,所以"它陈旧吗"只能判本机。这一维不假装审过 —— 报告里明写 dist 口径是本机,
// 与"读按设计只存在于部署机的 gitignore 副本"是同一条道理。
import { catBatch, gitRaw, selectFace } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGES_DIR = join(ROOT, 'packages')

/** 被审面上 packages/ 下的文件清单(索引档 ls-files,HEAD 档 ls-tree)。 */
function listFaceFiles(face) {
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

function main() {
  const argv = process.argv.slice(2)
  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  if (staged && worktree) {
    console.error('❌ --staged 与 --worktree 不得同时给(两面同给 = 不知道在审哪个面)')
    process.exit(2)
  }
  const face = selectFace({ staged, worktree, def: 'head' })
  const cands = findCandidatePackages(face)

  // 一次 cat-file --batch 取满"清单 + 源码入口",同面同轮 —— 清单来自磁盘、内容来自 git
  // 会造出自洽却基准错位的尺子(守门 101/103 各记过一次)。
  const specs = []
  for (const c of cands) specs.push(specOf(face, c.rel), specOf(face, c.srcRel))
  let contents
  try {
    contents = catBatch(ROOT, specs)
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
    const rawText = contents.get(specOf(face, c.rel))
    const srcText = contents.get(specOf(face, c.srcRel))
    if (typeof rawText !== 'string' || typeof srcText !== 'string') {
      undetermined.push(`${c.dir}(面 ${face} 上取不到清单或 src/index.ts)`)
      continue
    }
    let parsed
    try {
      parsed = JSON.parse(rawText.replace(/^﻿/, ''))
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
      ok.push(`${pkg.name} (skip: 从源码消费,不校验 dist)`)
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
      ok.push(`${pkg.name} (skip: wildcard re-export${declared.length ? `,已核声明入口 ${declared.length} 个在位` : ''})`)
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

  console.log(`${C.cyan}📦${C.reset} 检测 ${packages.length} 个 packages/* 的 dist 同步状态\n`)
  console.log(
    `   口径:包清单与 src 入口取被审面(${face === 'staged' ? '索引 blob' : 'HEAD blob'});` +
      `dist 取本机磁盘 —— 它是 .gitignore 的产物,仓库里没有 blob,本门不假装"审过了仓库里的 dist"\n`,
  )

  if (ok.length > 0) {
    console.log(`${C.green}✓${C.reset} 同步 (${ok.length}):`)
    for (const name of ok) {
      console.log(`  ${C.green}•${C.reset} ${name}`)
    }
  }

  if (stale.length > 0) {
    console.log(`\n${C.red}✗${C.reset} 陈旧 (${stale.length}):`)
    for (const s of stale) {
      console.log(`  ${C.red}•${C.reset} ${s.pkg}`)
      console.log(`    ${C.dim}问题:${C.reset} ${s.issue}`)
      console.log(`    ${C.dim}修复:${C.reset} ${C.yellow}${s.fix}${C.reset}`)
    }
    console.log(
      `\n${C.red}✗${C.reset} 发现 ${stale.length} 个陈旧 dist,请运行对应 build 命令重建。`,
    )
    process.exit(1)
  }

  /**
   * 未判定必须出声,但**刻意不改退出码**:并发会话正在新增/搬运包时"面上暂时取不齐"是常态,
   * 把它判红就是一台与任何提交内容无关的恒红门,唯一结局是各会话合法跳门、连带废掉全部守门(§12e)。
   * 出声与判红是两件事 —— 沉默才是缺陷,"报数但不拦"不是。
   */
  if (undetermined.length) {
    console.log(
      `\n⚠️  未判定 ${undetermined.length} 个包(面 ${face} 上取不到清单或 src/index.ts)—— 未判定不等于通过:`,
    )
    for (const u of undetermined.slice(0, 8)) console.log(`   · ${u}`)
    if (undetermined.length > 8) console.log(`   … 另有 ${undetermined.length - 8} 个`)
  }

  console.log(
    `\n${C.green}✓${C.reset} 所有 dist 与源码同步,无陈旧问题${undetermined.length ? `(另有 ${undetermined.length} 个包未判定,见上)` : ''}。`,
  )
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
}

// §22d 双形态入口守卫:测试 import 本模块时不得连带触发 CLI 主流程(它会 process.exit)。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  if (process.argv.slice(2).includes('--self-test')) runSelfTest()
  else main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
