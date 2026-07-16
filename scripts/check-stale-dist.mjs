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
 * 用法: node scripts/check-stale-dist.mjs
 *   exit 0 = 所有 dist 与源码同步
 *   exit 1 = 发现陈旧 dist(需要重建对应包)
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

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
  for (const m of src.matchAll(/export\s*\{([^}]+)\}\s*(?:from\s*['"][^'"]+['"])?/g)) {
    for (const name of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
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

function main() {
  const packages = findPackagesWithBuild()
  if (packages.length === 0) {
    console.log(`${C.yellow}⚠${C.reset} 未找到任何 packages/* (有 build 脚本 + src/index.ts)`)
    process.exit(0)
  }

  const stale = []
  const ok = []

  for (const pkg of packages) {
    // dist/index.js 不存在 = 完全陈旧
    if (!existsSync(pkg.distIndex)) {
      stale.push({
        pkg: pkg.name,
        issue: 'dist/index.js 不存在(未构建或被误删)',
        fix: `pnpm --filter ${pkg.name} build`,
      })
      continue
    }

    const srcExports = extractSourceExports(pkg.srcIndex)
    const distExports = extractDistExports(pkg.distIndex)

    // 跳过 wildcard (export * from) - 无法静态校验
    if (srcExports.has('__wildcard__')) {
      ok.push(`${pkg.name} (skip: wildcard re-export)`)
      continue
    }

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
