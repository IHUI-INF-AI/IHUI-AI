#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-staged-typecheck.mjs — 只 typecheck staged 涉及的源代码文件路径
 *
 * 背景(2026-07-30 立, 批次 8-P2 工程治理):
 *   原 pre-commit 第 16 项 "条件 typecheck 闸门" 只在 staged 涉及 apps/web 时跑
 *   `pnpm --filter @ihui/web run typecheck` (全包 ~3000+ 文件 typecheck),
 *   包含其他 agent 引入的预存在错误, 多 agent 并行 push 时 100% 误阻塞。
 *   本脚本只对 staged 涉及的文件判失败, 其他 agent 的非 staged 错误不阻塞。
 *
 * 核心策略 (2026-08-18 根治改版, 解决 partial-include 误报):
 *   旧策略: 临时 tsconfig 只 include staged 文件 → 模块扩展(declare module 'fastify'
 *   等)未被加载 → 报 TS2339 等假阳性 (如 pushNotification / isMultipart / file)。
 *   新策略 (根治): 临时 tsconfig 沿用 package 原始 tsconfig 的【全量 include】,
 *   保证完整加载所有模块扩展与全局类型; 然后把 tsc 输出按行解析,
 *   只把【错误文件属于 staged 文件】的错误视为失败, 其他 agent 引入的
 *   非 staged 文件错误被过滤、不阻塞。
 *
 *   1. git diff --cached --name-only --diff-filter=ACMR 拿 staged 文件
 *   2. 过滤 .ts / .tsx
 *   3. 按文件所属 package 路径前缀 (apps/web, packages/database 等) 分组
 *   4. 对每个 package 写入临时 tsconfig (`<pkg>/tsconfig.staged-typecheck.json`),
 *      extends 原始 tsconfig.json, include 沿用原始全量 include (不缩窄),
 *      仅强制 noEmit + incremental=false 避免污染 .tsbuildinfo 缓存
 *   5. `pnpm --filter <pkg> exec -- tsc --noEmit -p <temp>` 在该包内跑全量 typecheck
 *   6. 解析 tsc 输出, 过滤出"错误文件 ∈ staged"的错误; 无 → 通过, 有 → exit 1
 *   7. 清理临时 tsconfig
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
import { fileURLToPath, pathToFileURL } from 'node:url'

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
     (<pkg>/tsconfig.staged-typecheck.json, extends 原 tsconfig, include 沿用全量)
  5. pnpm --filter <pkg> exec -- tsc --noEmit -p <temp> 在该包内跑全量 typecheck
     (全量 include 保证加载完整模块扩展, 避免 TS2339 假阳性)
  6. 解析 tsc 输出, 只保留错误文件 ∈ staged 的错误; 无 → exit 0, 有 → exit 1
     (非 staged 文件错误属其他 agent 在途改动, 自动过滤不阻塞)
  7. 清理临时 tsconfig

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
 * 读取 package 原始 tsconfig 的 include 模式 (全量源码, 保证加载完整模块扩展)。
 * 原始 tsconfig 的 include 相对其所在目录 (即 pkg.dir), 临时 tsconfig 也在
 * 同一目录, 因此可直接沿用; 若无 include (纯 extends) 则回退到默认全量。
 * @returns {string[]}
 */
function getOriginalInclude(pkg) {
  try {
    const raw = JSON.parse(readFileSync(pkg.tsconfigPath, 'utf8'))
    if (Array.isArray(raw.include) && raw.include.length > 0) {
      return raw.include.map((p) =>
        p.startsWith('.') ? p : `./${p.replace(/\\/g, '/')}`,
      )
    }
  } catch {
    /* 读取失败则走默认回退 */
  }
  return ['./src/**/*.ts', './src/**/*.tsx', './**/*.d.ts']
}

/**
 * 写入临时 tsconfig, extends 原始 tsconfig.json, include 沿用原始全量模式。
 * 关键: 不缩窄 include —— 必须加载完整源码, 否则 declare module 等模块扩展
 * 未被编译, 产生 TS2339 假阳性。错误过滤交给 filterTscOutputForStagedFiles。
 * 强制 noEmit + incremental=false 避免污染原 tsconfig 的 .tsbuildinfo 缓存。
 * @returns {string} 临时文件绝对路径
 */
function writeTempTsconfig(pkg) {
  const tempPath = join(pkg.dir, 'tsconfig.staged-typecheck.json')
  const config = {
    extends: './tsconfig.json',
    include: getOriginalInclude(pkg),
    compilerOptions: {
      noEmit: true,
      incremental: false,
    },
  }
  writeFileSync(tempPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
  return tempPath
}

/**
 * 把 Windows/posix 路径统一为 forward slash, 用于字符串比较。
 * @param {string} p
 * @returns {string}
 */
function normalizePath(p) {
  return p.replace(/\\/g, '/')
}

/**
 * 过滤 tsc 输出, 只保留【错误文件属于 staged 文件】的错误块。
 * tsc 错误行格式: <path>(<line>,<col>): error TSxxxx: message,
 * 其后紧跟的 detail 行(如 "The declared type of ..." / "Two different types...")
 * 属于同一错误块, 一并保留。非 staged 文件错误的块整体丢弃, 不阻塞。
 * @param {string} tscOutput 原始 tsc stdout+stderr
 * @param {object} pkg 当前 package (含 dir, 用于解析相对路径)
 * @param {string[]} files 该 package 的 staged 文件 (仓库根相对路径)
 * @returns {string} 过滤后的输出 (空串 = 无 staged 文件错误)
 */
function filterTscOutputForStagedFiles(tscOutput, pkg, files) {
  if (!tscOutput.trim()) return ''
  const stagedAbs = new Set(
    files.map((f) => normalizePath(join(ROOT, f))),
  )
  const lines = tscOutput.split('\n')
  const out = []
  // 当前错误块: 从一条错误行起, 到下一个错误行(或输出末尾)为止的连续行
  let pending = []
  let pendingIsStaged = false
  const flush = () => {
    if (pendingIsStaged) out.push(...pending)
    pending = []
    pendingIsStaged = false
  }
  for (const line of lines) {
    const m = line.match(/^(.+?)\(\d+,\d+\): error TS\d+:/)
    if (m) {
      flush()
      // tsc 路径相对 pkg.dir (pnpm --filter exec 的 cwd 为 package 目录)
      const fileAbs = normalizePath(resolve(pkg.dir, m[1]))
      pendingIsStaged = stagedAbs.has(fileAbs)
      pending = [line]
    } else {
      pending.push(line)
    }
  }
  flush()
  return out.join('\n')
}

/** 删除临时 tsconfig, 失败时最多重试 2 次(Windows 偶发 transient file lock)。 */
function cleanupTempTsconfig(p) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      unlinkSync(p)
      return
    } catch {
      if (attempt < 2) {
        // 短暂等待后重试
        const start = Date.now()
        while (Date.now() - start < 50) {
          /* busy-wait 50ms */
        }
      }
    }
  }
  /* 3 次均失败, 静默忽略; .gitignore 已含该临时文件规则, 不会误入库 */
}

/**
 * 在指定 package 内跑 tsc --noEmit (全量 include, 输出按 staged 文件过滤)。
 * @returns {{ok: boolean, filtered: string, exitCode: number, hasNonStagedErrors: boolean}}
 */
function runPackageTypecheck(pkg, files) {
  const tempPath = writeTempTsconfig(pkg)
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
    const raw = (result.stderr || '') + (result.stdout || '')
    const filtered = filterTscOutputForStagedFiles(raw, pkg, files)
    const exitCode = result.status ?? -1
    // 区分三种情形, 避免"tsc 根本没跑成"被误判为通过:
    const sawAnyTscError = /error TS\d+/.test(raw)
    let ok
    let hasNonStagedErrors = false
    if (exitCode === 0) {
      ok = true
    } else if (filtered.trim() !== '') {
      // staged 文件存在真实错误 → 失败
      ok = false
    } else if (sawAnyTscError) {
      // tsc 正常跑完, 错误全部来自非 staged 文件(其他 agent 在途改动) → 通过
      ok = true
      hasNonStagedErrors = true
    } else {
      // tsc 未能真正运行(如 pnpm/tsc 未找到、进程崩溃) → 无法验证, 按失败处理
      ok = false
    }
    return { ok, filtered, exitCode, hasNonStagedErrors }
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
      if (result.hasNonStagedErrors) {
        // 全量 typecheck 有其他(非 staged)文件错误, 属其他 agent 在途改动, 已过滤不阻塞
        log.warn(
          `${C.yellow}  ⚠️ ${pkg.prefix} 全量 typecheck 存在非 staged 文件错误(已过滤, 不阻塞)${C.reset}`,
        )
      } else {
        log.info(`${C.green}  ✅ ${pkg.prefix} 通过${C.reset}`)
      }
    } else {
      failedCount++
      failedPkgs.push(pkg)
      log.error(
        `${C.red}${C.bold}  ❌ ${pkg.prefix} 失败 (exit ${result.exitCode})${C.reset}`,
      )
      if (result.filtered.trim()) {
        log.error(result.filtered)
      } else {
        log.error(
          `${C.dim}  (无 staged 文件错误输出, 请在 ${pkg.prefix} 手动跑 pnpm typecheck 排查)${C.reset}`,
        )
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
    log.error(
      `${C.dim}    (注: 非 staged 文件错误已被自动过滤, 上列错误均为 staged 文件真实错误)${C.reset}`,
    )
    process.exit(1)
  }
}

// ─── 单元测试导出锚点(§22c 镜像常量守门模式) ────────────────
// 测试文件通过 `import { __test__ as sourceFns } from '../check-staged-typecheck.mjs'`
// 引用本对象, 三个键名不允许重命名(被 check-staged-typecheck-mirror-sync 锁死)。
export const __test__ = {
  getOriginalInclude,
  normalizePath,
  filterTscOutputForStagedFiles,
}

// ─── 入口守护(§22d): 仅当作为 CLI 直接运行时执行 main(), import 时不触发 ───
// 避免测试 `import { __test__ }` 时 main() 副作用(扫 staged / 调 tsc)被执行。
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((e) => {
    log.error(
      `${C.red}❌ check-staged-typecheck 脚本执行异常: ${e?.message ?? e}${C.reset}`,
    )
    log.error(e?.stack ?? '(no stack)')
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
