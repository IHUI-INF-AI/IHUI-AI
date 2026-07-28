#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-solito-residue.mjs — solito 幽灵依赖回归守门
 *
 * 背景(2026-07-28 立):
 *   本仓库刚完成 P0 级优化:移除 solito 幽灵依赖(commit f8c9a6630c)。
 *   solito 在本仓库 0 真实运行时调用,packages/app 已改用纯 props 注入式跨端共享组件。
 *   为防止其他 agent 误把 solito 重新引入,新增本守门。
 *
 * 用途:检测 package.json / pnpm-workspace.yaml / patches/ / packages/app 源码 中
 *       是否重新引入 solito 依赖,发现即阻塞 commit。
 *
 * CLI 用法:
 *   node scripts/check-solito-residue.mjs [--staged] [--help]
 *
 * 检测规则:
 *   1. package.json(packages/app + apps/* + 根):dependencies/devDependencies/peerDependencies 中有 solito
 *   2. 根 package.json 的 pnpm.patchedDependencies 中有 solito
 *   3. pnpm-workspace.yaml 的 publicHoistPattern 中有 *solito*
 *   4. patches/ 目录下有 solito@*.patch 文件
 *   5. packages/app/src 下 .tsx 文件(递归子目录)中有 from 'solito/...' import 语句
 *
 * 退出码:
 *   0  无 solito 残留
 *   1  发现 solito 残留(blocking,阻塞 commit)
 *
 * 守门集成:guardian-runner.mjs(blocking 模式,阻塞 commit)
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

const ROOT = path.resolve(import.meta.dirname, '..')

// === 目标 package.json 清单(根 + packages/app + apps/*) ===
const TARGET_PACKAGE_JSONS = [
  'package.json', // 根
  'packages/app/package.json',
  'apps/web/package.json',
  'apps/mobile-rn/package.json',
  'apps/desktop/package.json',
  'apps/extension/package.json',
  'apps/cli/package.json',
  'apps/miniapp-taro/package.json',
  'apps/api/package.json',
]

const PNPM_WORKSPACE_PATH = 'pnpm-workspace.yaml'
const PATCHES_DIR = path.join(ROOT, 'patches')
const PACKAGES_APP_SRC = path.join(ROOT, 'packages/app/src')

// 检测 from 'solito' 或 from "solito" 或 from 'solito/xxx' 或 from "solito/xxx"
// 不匹配 // from 'solito' 注释(行首 // 后有内容则跳过)
const SOLITO_IMPORT_REGEX = /\bfrom\s+['"]solito(?:\/[^'"]*)?['"]/

// === 工具函数 ===

function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACM', {
      cwd: ROOT,
      encoding: 'utf8',
    })
    return out.split('\n').filter(Boolean)
  } catch {
    return []
  }
}

/**
 * 判断路径是否是本守门关心的目标文件。
 * 用于 --staged 模式:仅当 staged 中有目标文件时才执行扫描,否则跳过。
 */
function isTargetFile(relPath) {
  // 根 package.json / packages/app/package.json / apps/*/package.json
  if (relPath === 'package.json') return true
  if (relPath === 'packages/app/package.json') return true
  if (/^apps\/[^/]+\/package\.json$/.test(relPath)) return true
  // pnpm-workspace.yaml
  if (relPath === 'pnpm-workspace.yaml') return true
  // patches/solito@*.patch
  if (/^patches\/solito@.*\.patch$/.test(relPath)) return true
  // packages/app/src/**/*.tsx
  if (/^packages\/app\/src\/.*\.tsx$/.test(relPath)) return true
  return false
}

/**
 * 从 package.json 内容中检测 solito 依赖。
 * 检测 dependencies / devDependencies / peerDependencies / optionalDependencies。
 * 返回违规字段路径数组,如 ['dependencies.solito', 'peerDependencies.solito']。
 */
function findSolitoInPackageJson(content, fileLabel) {
  let pkg
  try {
    pkg = JSON.parse(content)
  } catch {
    return [{ file: fileLabel, field: '(json parse error)', value: '' }]
  }
  const hits = []
  const depSections = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]
  for (const section of depSections) {
    const deps = pkg[section]
    if (deps && typeof deps === 'object') {
      for (const [name, version] of Object.entries(deps)) {
        if (name === 'solito' || name.startsWith('solito@')) {
          hits.push({ file: fileLabel, field: `${section}.${name}`, value: version })
        }
      }
    }
  }
  // 根 package.json 的 pnpm.patchedDependencies
  const patched = pkg?.pnpm?.patchedDependencies
  if (patched && typeof patched === 'object') {
    for (const [name, patchPath] of Object.entries(patched)) {
      if (name === 'solito' || name.startsWith('solito@')) {
        hits.push({
          file: fileLabel,
          field: `pnpm.patchedDependencies.${name}`,
          value: patchPath,
        })
      }
    }
  }
  return hits
}

/**
 * 从 pnpm-workspace.yaml 检测 publicHoistPattern 中的 *solito*。
 * 简易 YAML 解析:只关心缩进列表项中是否含 solito 子串。
 */
function findSolitoInPnpmWorkspace(content, fileLabel) {
  const hits = []
  const lines = content.split(/\r?\n/)
  let inPublicHoist = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 顶层 key:publicHoistPattern:
    if (/^publicHoistPattern\s*:/.test(line)) {
      inPublicHoist = true
      continue
    }
    // 遇到另一个顶层 key(顶格非空行且非注释)→ 退出 hoist 块
    if (inPublicHoist && /^[A-Za-z]/.test(line)) {
      inPublicHoist = false
      continue
    }
    if (inPublicHoist) {
      // 列表项:  - '*solito*' / - "solito" / - solito
      const m = line.match(/^\s*-\s+['"]?([^'"]+?)['"]?\s*$/)
      if (m && /solito/i.test(m[1])) {
        hits.push({
          file: fileLabel,
          field: 'publicHoistPattern',
          value: m[1].trim(),
        })
      }
    }
  }
  return hits
}

/**
 * 扫描 packages/app/src 下 .tsx 文件(递归子目录)中的 solito import。
 * 简易递归扫描(不依赖 glob 库)。
 */
function findSolitoInTsx(dir, relBase) {
  const hits = []
  if (!existsSync(dir)) return hits
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return hits
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    const rel = path.join(relBase, entry.name).replace(/\\/g, '/')
    if (entry.isDirectory()) {
      hits.push(...findSolitoInTsx(full, rel))
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      let content
      try {
        content = readFileSync(full, 'utf8')
      } catch {
        continue
      }
      const lines = content.split(/\r?\n/)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // 跳过注释行(单行 // 注释,不匹配块注释内的描述性提及)
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
          continue
        }
        if (SOLITO_IMPORT_REGEX.test(line)) {
          hits.push({
            file: rel,
            field: `L${i + 1}`,
            value: line.trim(),
          })
        }
      }
    }
  }
  return hits
}

/**
 * 扫描 patches/ 目录下是否有 solito@*.patch 文件。
 */
function findSolitoPatches() {
  const hits = []
  if (!existsSync(PATCHES_DIR)) return hits
  let entries
  try {
    entries = readdirSync(PATCHES_DIR, { withFileTypes: true })
  } catch {
    return hits
  }
  for (const entry of entries) {
    if (entry.isFile() && /^solito@.*\.patch$/.test(entry.name)) {
      hits.push({
        file: `patches/${entry.name}`,
        field: 'patch file',
        value: entry.name,
      })
    }
  }
  return hits
}

// === 主流程 ===

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.log('用法: node scripts/check-solito-residue.mjs [--staged] [--help]')
    console.log('')
    console.log('检测 solito 幽灵依赖回归(blocking,阻塞 commit)。')
    console.log('')
    console.log('检测范围:')
    console.log('  1. package.json(根 + packages/app + apps/*)的 dependencies/devDependencies/')
    console.log('     peerDependencies/optionalDependencies 中是否有 solito')
    console.log('  2. 根 package.json 的 pnpm.patchedDependencies 中是否有 solito')
    console.log('  3. pnpm-workspace.yaml 的 publicHoistPattern 中是否有 *solito*')
    console.log('  4. patches/ 目录下是否有 solito@*.patch 文件')
    console.log('  5. packages/app/src/**/*.tsx 中是否有 from "solito/..." import 语句')
    console.log('')
    console.log('模式:')
    console.log('  无 --staged 参数  全量扫描所有目标文件')
    console.log('  --staged           仅扫描 staged 文件中涉及的目标文件,无目标文件则跳过')
    process.exit(0)
  }

  const stagedMode = args.includes('--staged')

  // --staged 模式:若 staged 无目标文件,直接跳过(性能优化)
  if (stagedMode) {
    const staged = getStagedFiles()
    const targets = staged.filter(isTargetFile)
    if (targets.length === 0) {
      console.log(`${C.dim}ℹ️  check-solito-residue: staged 无目标文件,跳过${C.reset}`)
      process.exit(0)
    }
  }

  const violations = []

  // 规则 1 + 2:扫描 package.json(根 + packages/app + apps/*)
  for (const rel of TARGET_PACKAGE_JSONS) {
    const abs = path.join(ROOT, rel)
    if (!existsSync(abs)) continue
    let content
    try {
      content = readFileSync(abs, 'utf8')
    } catch {
      continue
    }
    violations.push(...findSolitoInPackageJson(content, rel))
  }

  // 规则 3:pnpm-workspace.yaml 的 publicHoistPattern
  {
    const abs = path.join(ROOT, PNPM_WORKSPACE_PATH)
    if (existsSync(abs)) {
      try {
        const content = readFileSync(abs, 'utf8')
        violations.push(...findSolitoInPnpmWorkspace(content, PNPM_WORKSPACE_PATH))
      } catch {
        // 读失败忽略,不阻塞
      }
    }
  }

  // 规则 4:patches/ 目录下 solito@*.patch
  violations.push(...findSolitoPatches())

  // 规则 5:packages/app/src/**/*.tsx 中 from 'solito/...' import
  violations.push(...findSolitoInTsx(PACKAGES_APP_SRC, 'packages/app/src'))

  // === 输出 ===
  if (violations.length === 0) {
    console.log(`${C.green}✅${C.reset} check-solito-residue: 无 solito 残留(${C.dim}全量扫描${C.reset})`)
    process.exit(0)
  }

  console.log(
    `${C.red}❌${C.reset} check-solito-residue: 发现 ${C.bold}${violations.length}${C.reset}${C.red} 处 solito 残留(blocking,阻塞 commit)${C.reset}`
  )
  console.log(
    `   ${C.dim}本仓库已于 2026-07-28 移除 solito 幽灵依赖(commit f8c9a6630c),${C.reset}`
  )
  console.log(
    `   ${C.dim}packages/app 改用纯 props 注入式跨端共享组件,任何重新引入都是回退。${C.reset}`
  )
  console.log('')
  for (const v of violations) {
    console.log(`   ${C.bold}${v.file}${C.reset} ${C.dim}(${v.field})${C.reset}`)
    if (v.value) {
      console.log(`     ${C.red}${v.value}${C.reset}`)
    }
  }
  console.log('')
  console.log(`   ${C.cyan}修复:${C.reset}`)
  console.log(`     1. 从 package.json 删除 solito 依赖(dependencies/devDependencies/peerDependencies)`)
  console.log(`     2. 从根 package.json 的 pnpm.patchedDependencies 删除 solito`)
  console.log(`     3. 从 pnpm-workspace.yaml 的 publicHoistPattern 删除 *solito*`)
  console.log(`     4. 删除 patches/solito@*.patch 文件`)
  console.log(`     5. 删除 packages/app/src/**/*.tsx 中 import from "solito/..." 语句`)
  process.exit(1)
}

main().catch((e) => {
  console.error(`${C.red}❌ check-solito-residue 脚本执行异常:${C.reset}`, e?.message ?? e)
  console.error(e?.stack ?? '(no stack)')
  process.exit(2)
})
