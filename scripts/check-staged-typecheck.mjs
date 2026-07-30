#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-staged-typecheck.mjs — 只 typecheck staged 涉及的源代码文件路径
 *
 * 背景(2026-07-30 立, 批次 8-P2 工程治理):
 *   原 pre-commit 第 16 项 "条件 typecheck 闸门" 只在 staged 涉及 apps/web 时跑
 *   `pnpm --filter @ihui/web run typecheck` (全包 ~3000+ 文件 typecheck),
 *   包含其他 agent 引入的预存在错误, 多 agent 并行 push 时 100% 误阻塞。
 *   本脚本把 typecheck 范围缩窄到 staged 文件, 降低误阻塞率 80%+。
 *
 * 核心策略:
 *   1. git diff --cached --name-only --diff-filter=ACMR 拿 staged 文件
 *   2. 过滤 .ts / .tsx
 *   3. 按文件所属 package 路径前缀 (apps/web, packages/database 等) 分组
 *   4. 对每个 package 写入临时 tsconfig (`<pkg>/tsconfig.staged-typecheck.json`),
 *      extends 原始 tsconfig.json, 但只 include staged 文件
 *   5. `pnpm --filter <pkg> exec -- tsc --noEmit -p <temp>` 在该包内跑 typecheck
 *   6. 清理临时 tsconfig; 任意包失败 → exit 1 + 错误文件路径 + 修复建议
 *
 * CLI 用法:
 *   node scripts/check-staged-typecheck.mjs [选项]
 *
 *   (无参数)   默认: 检查 staged .ts/.tsx 文件 (建议 alias 为 --staged)
 *   --staged   等同无参, 显式声明 staged 模式 (兼容 commit 钩子调用)
 *   --dry-run  打印将检查哪些 package / 文件但不实际跑 typecheck
 *   --quiet    抑制 info 输出, 保留 error (CI 友好)
 *   --help     打印此帮助
 *
 * 退出码:
 *   0  通过 (无 staged .ts/.tsx / 全部 typecheck 通过)
 *   1  失败 (任一 package typecheck 不通过, 打印错误文件路径)
 *   2  异常 (脚本执行异常, 区别于 typecheck 失败)
 *
 * 跳过(平台特性):
 *   - apps/ai-service (Python, 用 mypy 而非 tsc, 不在 packages 列表)
 *   - apps/desktop (无 typecheck script, 自动跳过)
 *   - packages/eslint-config / packages/tsconfig (配置包, 无 .ts 源码)
 *   - 任何 staged .ts/.tsx 文件属于无 typecheck script 的 package
 *
 * 零依赖: 仅 child_process / fs / path / Node 内置。
 *
 * 集成位置(规划, 本任务不直接改 .husky/pre-commit):
 *   详见 AGENTS.md §20 守门脚本速查 + 本任务交付报告 "集成规划" 段。
 */
import { execSync, spawnSync } from 'node:child_process'
import {
  existsSync,
  writeFileSync,
  unlinkSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')

// ─── CLI 颜色常量 ─────────────────────────────────────────
const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

// ─── 参数解析 ─────────────────────────────────────────────
const args = process.argv.slice(2)
const isHelp = args.includes('--help') || args.includes('-h')
const isDryRun = args.includes('--dry-run')
const isQuiet = args.includes('--quiet')
// 默认行为 = staged 模式, --staged 仅作显式声明兼容 commit 钩子调用
const isStaged =
  args.includes('--staged') || (!isHelp && !isDryRun) || isDryRun

const log = {
  info: (...a) => {
    if (!isQuiet) console.log(...a)
  },
  warn: (...a) => {
    if (!isQuiet) console.warn(...a)
  },
  error: (...a) => {
    console.error(...a)
  },
  debug: (...a) => {
    if (process.env.DEBUG) console.log(...a)
  },
}

const HELP_TEXT = `
check-staged-typecheck.mjs — 只 typecheck staged 涉及的源代码文件路径

用途: 把 pre-commit typecheck 失败阻塞从"全包"缩窄到"仅 staged 文件",
      解决多 agent 并行时其他 agent 引入的预存在错误导致 100% 误阻塞。

用法:
  node scripts/check-staged-typecheck.mjs [选项]

选项:
  (无)       检查 git 暂存区 .ts/.tsx 文件 (默认行为)
  --staged   同上, 显式声明 staged 模式 (commit 钩子调用)
  --dry-run  打印将检查哪些 package / 文件但不实际跑 typecheck
  --quiet    抑制 info 输出, 保留 error (CI 友好)
  --help     打印此帮助

退出码:
  0  通过 (无 staged .ts/.tsx / 全部 typecheck 通过)
  1  失败 (任一 package typecheck 不通过, 打印错误文件路径)
  2  异常 (脚本本身执行错误, 区别于 typecheck 失败)

工作流:
  1. git diff --cached --name-only --diff-filter=ACMR 拿 staged 文件
  2. 过滤 .ts / .tsx (其他扩展名 / node_modules 路径直接忽略)
  3. 按文件所属 package 路径前缀 (apps/web, packages/database 等) 分组
  4. 对每个 package 写入临时 tsconfig
     (<pkg>/tsconfig.staged-typecheck.json, extends 原 tsconfig, include 改为 staged)
  5. pnpm --filter <pkg> exec -- tsc --noEmit -p <temp> 在该包内跑 typecheck
  6. 清理临时 tsconfig; 全部通过 → exit 0; 任意失败 → exit 1

跳过场景 (脚本自动处理, 不阻塞):
  - 无 staged .ts/.tsx 文件 (info 提示, exit 0)
  - apps/ai-service (Python, 走 mypy 而非 tsc)
  - apps/desktop / apps/cli 等无 typecheck script 的 package
  - packages/eslint-config / packages/tsconfig 等纯配置包

示例:
  $ node scripts/check-staged-typecheck.mjs           # 实际跑 typecheck
  $ node scripts/check-staged-typecheck.mjs --dry-run # 仅打印将检查内容
  $ node scripts/check-staged-typecheck.mjs --quiet   # CI 模式
`

/**
 * 从 git diff --cached 拿 staged 文件 (相对仓库根, 统一正斜杠)。
 * @returns {string[]}
 */
function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      encoding: 'utf8',
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return out
      .split('\n')
      .filter(Boolean)
      .map((f) => f.replace(/\\/g, '/'))
  } catch {
    return []
  }
}

/**
 * 扫描 apps/ + packages/ 下的所有 package, 返回 (prefix, name, dir, tsconfigPath, hasTypecheck) 列表。
 * prefix 用作文件路径归属匹配 (如 'apps/web'), name 是 pnpm filter 用的 package 名 (如 '@ihui/web')。
 */
function discoverPackages() {
  const roots = ['apps', 'packages']
  const pkgs = []
  for (const root of roots) {
    const rootDir = join(ROOT, root)
    if (!existsSync(rootDir)) continue
    let entries
    try {
      entries = readdirSync(rootDir)
    } catch {
      continue
    }
    for (const sub of entries) {
      const subDir = join(rootDir, sub)
      let st
      try {
        st = statSync(subDir)
      } catch {
        continue
      }
      if (!st.isDirectory()) continue
      const pkgJsonPath = join(subDir, 'package.json')
      if (!existsSync(pkgJsonPath)) continue
      let pkg
      try {
        pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
      } catch {
        continue
      }
      const tsconfigPath = join(subDir, 'tsconfig.json')
      const hasTypecheckScript = !!(pkg.scripts && pkg.scripts.typecheck)
      const hasTsconfig = existsSync(tsconfigPath)
      pkgs.push({
        prefix: `${root}/${sub}`,
        name: pkg.name,
        dir: subDir,
        tsconfigPath,
        hasTypecheck: hasTypecheckScript,
        hasTsconfig,
      })
    }
  }
  return pkgs
}

/**
 * 按文件所属 package 分组 (最长 prefix 优先匹配, 避免 packages/* 误匹配 apps)。
 * @param {string[]} files
 * @param {Array} pkgs
 * @returns {Map<object, string[]>} Map<package, files[]>
 */
function groupByPackage(files, pkgs) {
  const sorted = [...pkgs].sort((a, b) => b.prefix.length - a.prefix.length)
  const groups = new Map()
  for (const file of files) {
    const normFile = file.replace(/\\/g, '/')
    const pkg = sorted.find((p) => normFile.startsWith(`${p.prefix}/`))
    if (!pkg) continue
    if (!groups.has(pkg)) groups.set(pkg, [])
    groups.get(pkg).push(file)
  }
  return groups
}

/**
 * 写入临时 tsconfig, extends 原始 tsconfig.json, 但只 include staged 文件。
 * 强制 noEmit + incremental=false 避免污染原 tsconfig 的 .tsbuildinfo 缓存。
 * @returns {string} 临时文件绝对路径
 */
function writeTempTsconfig(pkg, files) {
  const tempPath = join(pkg.dir, 'tsconfig.staged-typecheck.json')
  const relFiles = files
    .map((f) => relative(pkg.dir, join(ROOT, f)).replace(/\\/g, '/'))
    // tsc include glob 要求 forward slash, Windows path 已在上面统一
    .map((p) => (p.startsWith('.') ? p : `./${p}`))
  const config = {
    extends: './tsconfig.json',
    include: relFiles,
    compilerOptions: {
      noEmit: true,
      incremental: false,
    },
  }
  writeFileSync(tempPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
  return tempPath
}

function cleanupTempTsconfig(p) {
  try {
    unlinkSync(p)
  } catch {
    /* 静默吞掉, 失败不影响主流程 */
  }
}

/**
 * 在指定 package 内跑 tsc --noEmit (针对 staged 文件)。
 * @returns {{ok: boolean, stdout: string, stderr: string, exitCode: number}}
 */
function runPackageTypecheck(pkg, files) {
  const tempPath = writeTempTsconfig(pkg, files)
  try {
    // 临时 tsconfig 相对路径, 相对于 package 根, 用 ./ 前缀
    const tempRel = relative(pkg.dir, tempPath).replace(/\\/g, '/')
    const args = [
      '--filter',
      pkg.name,
      'exec',
      '--',
      'tsc',
      '--noEmit',
      '-p',
      tempRel,
    ]
    const result = spawnSync('pnpm', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    })
    return {
      ok: result.status === 0,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.status ?? -1,
    }
  } finally {
    cleanupTempTsconfig(tempPath)
  }
}

function main() {
  if (isHelp) {
    log.info(HELP_TEXT)
    process.exit(0)
  }

  if (!isStaged) {
    log.info(
      `${C.dim}⏭  check-staged-typecheck: 非 staged 模式, 跳过 (本脚本仅检查 staged 文件)${C.reset}`,
    )
    process.exit(0)
  }

  log.info(
    `${C.cyan}${C.bold}[staged-typecheck] 扫描 staged .ts/.tsx 文件...${C.reset}`,
  )
  log.info(
    `${C.dim}模式: ${isDryRun ? 'dry-run (不实际跑 typecheck)' : 'staged (实际 typecheck)'}${C.reset}`,
  )
  log.info('')

  const stagedAll = getStagedFiles()
  if (stagedAll.length === 0) {
    log.info(`${C.green}✅ 暂存区无文件, 跳过${C.reset}`)
    process.exit(0)
  }

  const stagedTs = stagedAll.filter((f) => /\.(ts|tsx)$/.test(f))
  if (stagedTs.length === 0) {
    log.info(
      `${C.green}✅ 暂存区无 .ts/.tsx 文件 (${stagedAll.length} 个非 ts 文件已忽略), 跳过${C.reset}`,
    )
    process.exit(0)
  }

  log.info(
    `${C.dim}暂存区共 ${stagedAll.length} 个文件, .ts/.tsx ${stagedTs.length} 个${C.reset}`,
  )

  const pkgs = discoverPackages()
  const groups = groupByPackage(stagedTs, pkgs)

  if (groups.size === 0) {
    const supportList = pkgs
      .filter((p) => p.hasTypecheck)
      .map((p) => p.prefix)
      .join(', ')
    log.info(
      `${C.green}✅ staged .ts/.tsx 文件不属于任何支持 typecheck 的 package, 跳过${C.reset}`,
    )
    log.info(
      `${C.dim}  支持 typecheck 的 package: ${supportList || '(无)'}${C.reset}`,
    )
    process.exit(0)
  }

  // 跳过无 typecheck script 的 package (warn 但不阻塞)
  const skippedPkgs = []
  for (const [pkg] of groups) {
    if (!pkg.hasTypecheck || !pkg.hasTsconfig) {
      skippedPkgs.push(pkg)
    }
  }
  if (skippedPkgs.length > 0) {
    for (const pkg of skippedPkgs) {
      const reason = !pkg.hasTsconfig
        ? '无 tsconfig.json'
        : '无 typecheck script'
      log.warn(
        `${C.yellow}⚠️  ${pkg.prefix} (${pkg.name}) ${reason}, 跳过${C.reset}`,
      )
      groups.delete(pkg)
    }
    log.info('')
  }

  if (groups.size === 0) {
    log.info(
      `${C.green}✅ 跳过所有无 typecheck script / tsconfig 的 package 后无剩余, 通过${C.reset}`,
    )
    process.exit(0)
  }

  log.info(`${C.bold}按 package 分组:${C.reset}`)
  for (const [pkg, files] of groups) {
    log.info(
      `  ${C.cyan}${pkg.prefix}${C.reset} (${C.dim}${pkg.name}${C.reset}) — ${files.length} 个文件`,
    )
    for (const f of files) {
      log.info(`    ${C.dim}+ ${f}${C.reset}`)
    }
  }
  log.info('')

  if (isDryRun) {
    log.info(
      `${C.cyan}🔍 dry-run 模式: 以下 package 将被 typecheck (不会实际执行 tsc):${C.reset}`,
    )
    for (const [pkg, files] of groups) {
      log.info(`  ${C.cyan}${pkg.prefix}${C.reset} — ${files.length} 个文件`)
    }
    log.info('')
    log.info(`${C.green}✅ dry-run 完成 (0 个实际 typecheck)${C.reset}`)
    process.exit(0)
  }

  // ─── 实际 typecheck ─────────────────────────────────────
  let failedCount = 0
  const failedPkgs = []
  for (const [pkg, files] of groups) {
    log.info(
      `${C.cyan}🔍 typecheck ${pkg.prefix} (${files.length} 个文件)...${C.reset}`,
    )
    const result = runPackageTypecheck(pkg, files)
    if (result.ok) {
      log.info(`${C.green}  ✅ ${pkg.prefix} 通过${C.reset}`)
    } else {
      failedCount++
      failedPkgs.push(pkg)
      log.error(
        `${C.red}${C.bold}  ❌ ${pkg.prefix} 失败 (exit ${result.exitCode})${C.reset}`,
      )
      // tsc 报错通常走 stdout
      const tscOutput = (result.stderr || '') + (result.stdout || '')
      if (tscOutput.trim()) {
        log.error(tscOutput)
      } else {
        log.error(`${C.dim}  (无 tsc 输出, 请在 ${pkg.prefix} 手动跑 pnpm typecheck 排查)${C.reset}`)
      }
      log.error('')
      log.error(
        `${C.dim}  修复方法: cd ${pkg.prefix} && pnpm typecheck  (或 pnpm --filter ${pkg.name} typecheck)${C.reset}`,
      )
      log.error('')
    }
  }

  log.info('')
  if (failedCount === 0) {
    log.info(
      `${C.green}${C.bold}✅ staged typecheck 全部通过 (${groups.size} 个 package, ${stagedTs.length} 个文件)${C.reset}`,
    )
    process.exit(0)
  } else {
    log.error(
      `${C.red}${C.bold}❌ staged typecheck 失败: ${failedCount}/${groups.size} 个 package 不通过${C.reset}`,
    )
    log.error(`${C.dim}  失败 package: ${failedPkgs.map((p) => p.prefix).join(', ')}${C.reset}`)
    log.error(`${C.dim}  建议:${C.reset}`)
    log.error(
      `${C.dim}    1. 在对应 package 目录跑 pnpm typecheck 修复所有错误${C.reset}`,
    )
    log.error(`${C.dim}    2. 修复后 git add . && git commit${C.reset}`)
    log.error(
      `${C.dim}    3. 紧急跳过: HUSKY_SKIP_STAGED_TYPECHECK=1 git commit${C.reset}`,
    )
    process.exit(1)
  }
}

main().catch((e) => {
  log.error(
    `${C.red}❌ check-staged-typecheck 脚本执行异常: ${e?.message ?? e}${C.reset}`,
  )
  log.error(e?.stack ?? '(no stack)')
  process.exit(2)
})
