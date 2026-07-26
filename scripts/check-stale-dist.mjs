#!/usr/bin/env node
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
 * 用法:
 *   node scripts/check-stale-dist.mjs                       全 workspace 检查(默认,向后兼容)
 *   node scripts/check-stale-dist.mjs --staged-only         只检查 staged 涉及的 packages/* dist
 *   node scripts/check-stale-dist.mjs --staged              (pre-commit 透传标志)等价于 --staged-only
 *   node scripts/check-stale-dist.mjs --help                打印帮助
 *
 *   exit 0 = 所有 dist 与源码同步
 *   exit 1 = 发现陈旧 dist(需要重建对应包)
 *
 * 多 agent 并行场景:
 *   guardian-runner.mjs 在 pre-commit 阶段会向所有子脚本透传 --staged。
 *   本脚本识别该 flag 后自动切换 staged-only 模式,只检查本批次 staged 的 packages/*,
 *   避免其他 agent 改 src 未 rebuild dist 导致本批次 --no-verify 误拦。
 *   若 staged 文件不涉及任何 packages/*,直接 exit 0(无检查)。
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = process.cwd()
const PACKAGES_DIR = join(ROOT, 'packages')

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
function extractSourceExports(srcPath) {
  const src = readFileSync(srcPath, 'utf8')
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

function findPackagesWithBuild() {
  const packages = []
  if (!existsSync(PACKAGES_DIR)) return packages
  for (const entry of readdirSync(PACKAGES_DIR)) {
    const pkgJsonPath = join(PACKAGES_DIR, entry, 'package.json')
    if (!existsSync(pkgJsonPath)) continue
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
    // 只检测有 build 脚本 + 有 src/index.ts 的包
    if (pkg.scripts?.build && existsSync(join(PACKAGES_DIR, entry, 'src', 'index.ts'))) {
      packages.push({
        name: pkg.name,
        dir: join(PACKAGES_DIR, entry),
        srcIndex: join(PACKAGES_DIR, entry, 'src', 'index.ts'),
        distIndex: join(PACKAGES_DIR, entry, 'dist', 'index.js'),
      })
    }
  }
  return packages
}

/**
 * 从 `git diff --cached --name-only` 输出中提取涉及的 packages/* 短名集合。
 * 路径分隔符兼容(正斜杠 + Windows 反斜杠),跨平台稳定。
 *
 * @returns {string[]} 涉及的 package 目录短名,例如 ['ui-react', 'auth']
 */
function getStagedPackageDirs() {
  const out = new Set()
  let raw
  try {
    raw = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    // 非 git 环境 / 无 staged
    return []
  }
  // 同时匹配 packages/foo/... 和 packages\foo\... (Windows git 输出)
  const re = /^packages[\\/]([^\\/]+)[\\/]/
  for (const line of raw.split('\n')) {
    const file = line.trim()
    if (!file) continue
    const m = file.match(re)
    if (m) out.add(m[1])
  }
  return [...out]
}

function printHelp() {
  console.log(`
check-stale-dist.mjs — packages 陈旧 dist 检测

用法:
  node scripts/check-stale-dist.mjs [选项]

选项:
  (无)         全 workspace 检查(默认,向后兼容)
  --staged-only 只检查 staged 涉及的 packages/* dist(本批次精准检查)
  --staged     等价于 --staged-only(pre-commit 透传标志,guardian-runner.mjs 透传)
  --help       打印此帮助

退出码:
  0  所有 dist 与源码同步
  1  发现陈旧 dist(需 pnpm --filter <包名> build 重建)

多 agent 并行场景:
  --staged-only 模式下,只检查本批次 git staged 中涉及的 packages/* dist。
  其他 agent 改动 packages/*/src 但未 rebuild dist 不会误拦本批次 commit。
  staged 文件不涉及任何 packages/* 时直接 exit 0(无检查)。
`)
}

function main() {
  const cliArgs = process.argv.slice(2)
  if (cliArgs.includes('--help') || cliArgs.includes('-h')) {
    printHelp()
    process.exit(0)
  }
  // --staged 由 guardian-runner.mjs 在 pre-commit 阶段透传给所有子脚本
  // 本脚本将其视为 staged-only 触发条件,避免多 agent 改动互相误拦
  const stagedOnly = cliArgs.includes('--staged-only') || cliArgs.includes('--staged')

  const allPackages = findPackagesWithBuild()
  if (allPackages.length === 0) {
    console.log(`${C.yellow}⚠${C.reset} 未找到任何 packages/* (有 build 脚本 + src/index.ts)`)
    process.exit(0)
  }

  // === 解析待检查的包集合 ===
  let packages = allPackages
  if (stagedOnly) {
    const stagedPkgDirs = getStagedPackageDirs()
    if (stagedPkgDirs.length === 0) {
      console.log(
        `${C.green}✅${C.reset} Staged files 不涉及 packages/*,跳过 dist 检查(staged-only 模式)`,
      )
      process.exit(0)
    }
    // 通过目录短名匹配(如 packages/ui-react → ui-react)
    const stagedSet = new Set(stagedPkgDirs)
    packages = allPackages.filter((p) => {
      const shortName = p.dir.split(/[\\/]/).pop()
      return stagedSet.has(shortName)
    })
    if (packages.length === 0) {
      console.log(
        `${C.green}✅${C.reset} Staged 涉及 ${stagedPkgDirs.length} 个 packages/*,但均无 build 脚本,跳过`,
      )
      process.exit(0)
    }
    console.log(
      `${C.cyan}📦${C.reset} Staged-only 模式:检查 ${packages.length} 个 packages/* (${packages.map((p) => p.name).join(', ')})`,
    )
  } else {
    console.log(
      `${C.cyan}📦${C.reset} 检测 ${allPackages.length} 个 packages/* 的 dist 同步状态(全 workspace 模式)`,
    )
  }

  const stale = []
  const ok = []

  for (const pkg of packages) {
    const srcExports = extractSourceExports(pkg.srcIndex)

    // 跳过 wildcard (export * from) - 无法静态校验,且可能无 dist(源码直接消费)
    if (srcExports.has('__wildcard__')) {
      ok.push(`${pkg.name} (skip: wildcard re-export)`)
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

  console.log(`\n${C.green}✓${C.reset} 所有 dist 与源码同步,无陈旧问题。`)
  process.exit(0)
}

main()
