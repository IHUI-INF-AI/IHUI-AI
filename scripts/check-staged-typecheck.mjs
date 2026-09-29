#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-staged-typecheck.mjs — 只 typecheck 本轮声明集涉及的源代码文件路径
 *
 * 声明集有两种口径: staged 档 = git 暂存集(默认, 提交链用); --files 档 = 命令行清单(人工取证用)。
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
 *   只把【错误文件属于本轮声明集】的错误视为失败, 其他 agent 引入的
 *   非声明集文件错误被过滤、不阻塞。
 *
 *   1. 取声明集: staged 档走 git diff --cached --name-only --diff-filter=ACMR;
 *      --files 档走命令行清单(不读索引)
 *   2. 过滤 .ts / .tsx
 *   3. 按文件所属 package 路径前缀 (apps/web, packages/database 等) 分组
 *   4. 对每个 package 写入临时 tsconfig (`<pkg>/tsconfig.staged-typecheck.json`),
 *      extends 原始 tsconfig.json, include 沿用原始全量 include (不缩窄),
 *      仅强制 noEmit + incremental=false 避免污染 .tsbuildinfo 缓存
 *   5. `pnpm --filter <pkg> exec -- tsc --noEmit -p <temp>` 在该包内跑全量 typecheck
 *   6. 解析 tsc 输出, 过滤出"错误文件 ∈ 本轮声明集"的错误; 无 → 通过, 有 → exit 1
 *   7. 清理临时 tsconfig
 *
 * CLI 用法:
 *   node scripts/check-staged-typecheck.mjs [选项]
 *
 *   (无参数)   默认: 检查 staged .ts/.tsx 文件 (建议 alias 为 --staged)
 *   --staged   等同无参, 显式声明 staged 模式 (兼容 commit 钩子调用)
 *   --files    只审命令行声明的这批 .ts/.tsx, 不读共享索引 (与 --staged 互斥)
 *   --root     换被审根目录 (镜像测试/人工取证通道; 提交链的 runner 不传它)
 *   --dry-run  打印将检查哪些 package / 文件但不实际跑 typecheck
 *   --quiet    抑制 info 输出, 保留 error (CI 友好)
 *   --help     打印此帮助
 *
 *   未知旗标与游离位置参数一律 exit 2 并点名(G-831):旧判式让任何未知 token 都落进
 *   默认 staged 档, 于是 `--files a.ts` 实际去审别人的暂存集并回 RC=0 —— "没审到"
 *   被打印成"审过了"。两档的结论行各自明写审的是哪一批。
 *
 * 退出码:
 *   0  通过 (staged 档无 .ts/.tsx / 本轮声明集全绿)
 *   1  失败 (任一 package typecheck 不通过, 打印错误文件路径)
 *   2  用法错误或脚本异常 —— 未声明旗标 / --files 没给路径或路径不存在 / --files 的
 *      声明集里没有一个可审文件 / 声明文件所在 package 不支持 typecheck / 脚本自身异常
 *
 * 跳过(平台特性, 仅 staged 档 —— --files 档一律 exit 2 点名, 不把"审不到"报成"审过"):
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
import { existsSync, writeFileSync, unlinkSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, isAbsolute } from 'node:path'
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
// 未知旗标与游离位置参数一律算用法错误(G-831):旧判式让任何未知 token 落进默认 staged 档,
// 于是 `--files a.ts` 会去审共享索引并回 RC=0 —— "没审到"被打印成"审过了"。
const KNOWN_FLAGS = new Set([
  '--staged',
  '--dry-run',
  '--quiet',
  '--help',
  '-h',
  '--files',
  '--root',
])

function isFlagToken(token) {
  return typeof token === 'string' && token.startsWith('-')
}

/**
 * 拆 argv: `--files` 收紧邻的连续非旗标 token(可多个), `--root` 只收一个。
 * 认不出的 token(含游离位置参数)进 unknown, 由调用方 exit 2 逐条点名。
 * @param {string[]} argv
 */
function parseCliArgv(argv) {
  const flags = new Set()
  const files = []
  const unknown = []
  const missingValue = []
  let seenFiles = false
  let root = null
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token === '--files') {
      seenFiles = true
      let taken = 0
      while (i + 1 < argv.length && !isFlagToken(argv[i + 1])) {
        files.push(argv[++i])
        taken++
      }
      if (taken === 0) missingValue.push(token)
      continue
    }
    if (token === '--root') {
      const next = argv[i + 1]
      if (next !== undefined && !isFlagToken(next)) {
        root = next
        i++
      } else {
        missingValue.push(token)
      }
      continue
    }
    if (KNOWN_FLAGS.has(token)) {
      flags.add(token)
      continue
    }
    unknown.push(token)
  }
  return { flags, files, unknown, missingValue, seenFiles, root }
}

const args = process.argv.slice(2)
const CLI = parseCliArgv(args)
const isHelp = CLI.flags.has('--help') || CLI.flags.has('-h')
const isDryRun = CLI.flags.has('--dry-run')
const isQuiet = CLI.flags.has('--quiet')
// --files 档不读共享索引; 其余一律 staged 档(与旧行为同形)
const isFiles = CLI.seenFiles
// 换根只决定"审哪棵树"(测试/人工取证通道); 提交链不传 ⇒ AUDIT_ROOT === ROOT
const AUDIT_ROOT = CLI.root ? resolve(CLI.root) : ROOT

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
check-staged-typecheck.mjs — 只 typecheck 本轮声明集涉及的源代码文件路径

用途: 把 pre-commit typecheck 失败阻塞从"全包"缩窄到"本轮声明的那一批",
      解决多 agent 并行时其他 agent 引入的预存在错误导致 100% 误阻塞。

用法:
  node scripts/check-staged-typecheck.mjs [选项]

选项:
  (无)       检查 git 暂存区 .ts/.tsx 文件 (默认行为)
  --staged   同上, 显式声明 staged 模式 (commit 钩子调用)
  --files    只审命令行声明的这批 .ts/.tsx, 完全不读共享索引 (与 --staged 互斥)
  --root     换被审根目录 (镜像测试/人工取证通道; 提交链的 runner 不传它)
  --dry-run  打印将检查哪些 package / 文件但不实际跑 typecheck
  --quiet    抑制 info 输出, 保留 error (CI 友好)
  --help     打印此帮助

未知旗标与游离位置参数一律 exit 2 并点名 —— 静默回落默认档会把"没审到"打印成"审过了"。
两档的结论行各自明写审的是哪一批(--staged ⇒ 审的是索引暂存集 / --files ⇒ 审的是声明的 N 个文件)。

退出码:
  0  通过 (无 staged .ts/.tsx / 全部 typecheck 通过)
  1  失败 (任一 package typecheck 不通过, 打印错误文件路径)
  2  用法错误或脚本异常 (未声明旗标 / --files 无路径或路径不存在 / 声明集里没有一个可审 /
     声明文件所在 package 不支持 typecheck / 脚本本身执行错误)

工作流:
  1. 取声明集: staged 档 = git diff --cached --name-only --diff-filter=ACMR;
     --files 档 = 命令行清单(完全不读共享索引)
  2. 过滤 .ts / .tsx (其他扩展名 / node_modules 路径直接忽略)
  3. 按文件所属 package 路径前缀 (apps/web, packages/database 等) 分组
  4. 对每个 package 写入临时 tsconfig
     (<pkg>/tsconfig.staged-typecheck.json, extends 原 tsconfig, include 沿用全量)
  5. pnpm --filter <pkg> exec -- tsc --noEmit -p <temp> 在该包内跑全量 typecheck
     (全量 include 保证加载完整模块扩展, 避免 TS2339 假阳性)
  6. 解析 tsc 输出, 只保留错误文件 ∈ 声明集的错误; 无 → exit 0, 有 → exit 1
     (声明集之外的错误属其他 agent 在途改动, 自动过滤不阻塞)
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
  $ node scripts/check-staged-typecheck.mjs --files apps/cli/src/x.ts packages/types/src/y.ts
  $ node scripts/check-staged-typecheck.mjs --fles apps/cli/src/x.ts   # exit 2, 点名 --fles
`

/**
 * @returns {string[]} 空数组 = 参数可用; 非空即调用方 exit 2 并逐条点名。
 */
function collectUsageErrors() {
  const errors = []
  for (const token of CLI.unknown) errors.push(`不认的参数: ${token}`)
  for (const token of CLI.missingValue) {
    errors.push(
      `${token} 后面没有收到${token === '--files' ? '任何路径' : '目录'}(紧邻 token 不得以 - 开头)`,
    )
  }
  if (isFiles && CLI.flags.has('--staged')) {
    errors.push(
      '--staged 与 --files 不得同轮混用: 一个审共享索引的暂存集, 另一个审命令行声明的清单',
    )
  }
  if (CLI.root !== null) {
    let isDir = false
    try {
      isDir = statSync(CLI.root).isDirectory()
    } catch {
      isDir = false
    }
    if (!isDir) errors.push(`--root 指向的目录取不到: ${AUDIT_ROOT}`)
  }
  return errors
}

/**
 * 从 git diff --cached 拿 staged 文件 (相对被审根, 统一正斜杠)。
 * @returns {string[]}
 */
function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      encoding: 'utf8',
      cwd: AUDIT_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
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
    const rootDir = join(AUDIT_ROOT, root)
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
      return raw.include.map((p) => (p.startsWith('.') ? p : `./${p.replace(/\\/g, '/')}`))
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
 * 过滤 tsc 输出, 只保留【错误文件属于声明文件】的错误块。
 * tsc 错误行格式: <path>(<line>,<col>): error TSxxxx: message,
 * 其后紧跟的 detail 行(如 "The declared type of ..." / "Two different types...")
 * 属于同一错误块, 一并保留。非声明文件错误的块整体丢弃, 不阻塞。
 * @param {string} tscOutput 原始 tsc stdout+stderr
 * @param {object} pkg 当前 package (含 dir, 用于解析相对路径)
 * @param {string[]} files 该 package 的声明文件 (被审根相对路径; staged 档即暂存文件)
 * @param {string} [root] 被审根目录, 默认 AUDIT_ROOT (3 参调用形态与旧版逐字同行为)
 * @returns {string} 过滤后的输出 (空串 = 无声明文件错误)
 */
function filterTscOutputForStagedFiles(tscOutput, pkg, files, root = AUDIT_ROOT) {
  if (!tscOutput.trim()) return ''
  const stagedAbs = new Set(files.map((f) => normalizePath(join(root, f))))
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
 * 在指定 package 内跑 tsc --noEmit (全量 include, 输出按本轮声明集过滤)。
 * @returns {{ok: boolean, filtered: string, exitCode: number, hasNonStagedErrors: boolean}}
 */
function runPackageTypecheck(pkg, files) {
  const tempPath = writeTempTsconfig(pkg)
  try {
    // 临时 tsconfig 相对路径, 相对于 package 根, 用 ./ 前缀
    const tempRel = relative(pkg.dir, tempPath).replace(/\\/g, '/')
    const args = ['--filter', pkg.name, 'exec', '--', 'tsc', '--noEmit', '-p', tempRel]
    const result = spawnSync('pnpm', args, {
      cwd: AUDIT_ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      windowsHide: true, // 防 Windows 弹可见 cmd 窗口
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
      // 声明集内文件存在真实错误 → 失败
      ok = false
    } else if (sawAnyTscError) {
      // tsc 正常跑完, 错误全部落在声明集之外(其他 agent 在途改动) → 通过
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

  const usageErrors = collectUsageErrors()
  if (usageErrors.length > 0) {
    log.error(`${C.red}${C.bold}❌ 参数用法错误 (exit 2): 本次没有跑任何 typecheck${C.reset}`)
    for (const line of usageErrors) {
      log.error(`${C.red}   ✗ ${line}${C.reset}`)
    }
    log.error(
      `${C.dim}   不接受未声明的旗标 —— 静默回落默认档会把"没审到"打印成"审过了"(G-831)。${C.reset}`,
    )
    log.error(
      `${C.dim}   可用旗标: --staged | --files <file...> | --dry-run | --quiet | --root <dir> | --help${C.reset}`,
    )
    process.exit(2)
  }

  if (isFiles) {
    runFilesMode()
    return
  }
  runStagedMode()
}

function runStagedMode() {
  log.info(`${C.cyan}${C.bold}[staged-typecheck] 扫描 staged .ts/.tsx 文件...${C.reset}`)
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

  log.info(`${C.dim}暂存区共 ${stagedAll.length} 个文件, .ts/.tsx ${stagedTs.length} 个${C.reset}`)

  const pkgs = discoverPackages()
  const groups = groupByPackage(stagedTs, pkgs)

  if (groups.size === 0) {
    const supportList = pkgs
      .filter((p) => p.hasTypecheck)
      .map((p) => p.prefix)
      .join(', ')
    log.info(`${C.green}✅ staged .ts/.tsx 文件不属于任何支持 typecheck 的 package, 跳过${C.reset}`)
    log.info(`${C.dim}  支持 typecheck 的 package: ${supportList || '(无)'}${C.reset}`)
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
      const reason = !pkg.hasTsconfig ? '无 tsconfig.json' : '无 typecheck script'
      log.warn(`${C.yellow}⚠️  ${pkg.prefix} (${pkg.name}) ${reason}, 跳过${C.reset}`)
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

  printGroups(groups)
  if (isDryRun) printDryRunTail(groups, STAGED_SCOPE.auditLabel)

  // ─── 实际 typecheck ─────────────────────────────────────
  runGroupsAndReport(groups, stagedTs.length, STAGED_SCOPE)
}

// ─── --files 档(G-831): 只审命令行声明的清单, 完全不读共享索引 ───
function runFilesMode() {
  const rel = []
  const outside = []
  for (const p of CLI.files) {
    const r = toAuditRelative(p)
    if (r === null) outside.push(p)
    else rel.push(r)
  }
  const missing = rel.filter((p) => !existsSync(resolve(AUDIT_ROOT, p)))
  const hardLines = []
  if (outside.length > 0) {
    hardLines.push(`不在被审根目录(${AUDIT_ROOT})内, 无法归属到 package: ${outside.join(', ')}`)
  }
  if (missing.length > 0) {
    hardLines.push(`路径不存在: ${missing.join(', ')}`)
  }
  if (hardLines.length > 0) {
    exitUndetermined(hardLines, '出路: 路径必须真实存在, 且相对 --root(缺省为仓库根)。')
  }

  const audited = rel.filter((p) => /\.(ts|tsx)$/.test(p))
  const ignored = rel.filter((p) => !/\.(ts|tsx)$/.test(p))
  if (ignored.length > 0) {
    log.warn(
      `${C.yellow}⚠️ --files 声明集中 ${ignored.length} 个非 .ts/.tsx 路径被剔除(不静默): ${ignored.join(', ')}${C.reset}`,
    )
  }
  if (audited.length === 0) {
    exitUndetermined(
      [`声明的 ${CLI.files.length} 个路径里没有一个是 .ts/.tsx`],
      '出路: 只把要 typecheck 的 .ts/.tsx 交给本工具, 其余扩展名各自端内自检负责。',
    )
  }

  const pkgs = discoverPackages()
  const groups = groupByPackage(audited, pkgs)
  const covered = new Set()
  for (const files of groups.values()) {
    for (const f of files) covered.add(f)
  }
  const undeliverable = []
  const uncovered = audited.filter((f) => !covered.has(f))
  if (uncovered.length > 0) {
    undeliverable.push(
      `不属于 apps/*、packages/* 任何 package, 本工具审不到: ${uncovered.join(', ')}`,
    )
  }
  for (const [pkg, files] of groups) {
    if (!pkg.hasTypecheck || !pkg.hasTsconfig) {
      const reason = !pkg.hasTsconfig ? '无 tsconfig.json' : '无 typecheck script'
      undeliverable.push(`${files.join(', ')} 所在 ${pkg.prefix} (${pkg.name}) ${reason}`)
    }
  }
  if (undeliverable.length > 0) {
    exitUndetermined(
      undeliverable,
      '出路: 这些文件改跑各自端内的 typecheck —— 静默跳过等于把"没审"报成"审过"。',
    )
  }

  const scope = filesScope(audited.length)
  log.info(
    `${C.cyan}${C.bold}[staged-typecheck] 只审 --files 声明的 .ts/.tsx 文件 (不读共享索引)...${C.reset}`,
  )
  log.info(
    `${C.dim}模式: ${isDryRun ? 'dry-run (不实际跑 typecheck)' : 'files (实际 typecheck)'} — ${scope.auditLabel}${C.reset}`,
  )
  log.info('')

  printGroups(groups)
  if (isDryRun) printDryRunTail(groups, scope.auditLabel)

  runGroupsAndReport(groups, audited.length, scope)
}

// ─── 两档的口径标签 ───────────────────────────────────────
// staged 档的三条短语与旧输出逐字同形(改一个字就是把提交链的报错文案换掉了)。
const STAGED_SCOPE = {
  title: 'staged typecheck',
  auditLabel: '审的是索引暂存集',
  commitHints: true,
  phrases: {
    outside: '非 staged 文件错误',
    none: '无 staged 文件错误输出',
    note: '非 staged 文件错误已被自动过滤, 上列错误均为 staged 文件真实错误',
  },
}

function filesScope(n) {
  return {
    title: 'files typecheck',
    auditLabel: `审的是声明的 ${n} 个文件`,
    commitHints: false,
    phrases: {
      outside: '非声明文件错误',
      none: '无声明文件错误输出',
      note: '非声明文件错误已被自动过滤, 上列错误均为声明文件真实错误',
    },
  }
}

/** 把 --files 入参折成被审根相对路径; 根外的绝对路径返回 null(无从归属到 package)。 */
function toAuditRelative(p) {
  if (isAbsolute(p)) {
    const rel = relative(AUDIT_ROOT, p)
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null
    return normalizePath(rel)
  }
  const norm = normalizePath(p)
  return norm.startsWith('./') ? norm.slice(2) : norm
}

/** 声明集没被全部覆盖 ⇒ exit 2 逐条点名; 绝不回 0("没审到"不得读成"审过了")。 */
function exitUndetermined(lines, guidance) {
  log.error(
    `${C.red}${C.bold}❌ 无法判定 (exit 2): --files 声明集未被全部覆盖, 本次不出任何通过结论${C.reset}`,
  )
  for (const line of lines) {
    log.error(`${C.red}   ✗ ${line}${C.reset}`)
  }
  log.error(`${C.dim}   ${guidance}${C.reset}`)
  process.exit(2)
}

// ─── 两档共用的打印与判定出口 ─────────────────────────────
function printGroups(groups) {
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
}

function printDryRunTail(groups, auditLabel) {
  log.info(`${C.cyan}🔍 dry-run 模式: 以下 package 将被 typecheck (不会实际执行 tsc):${C.reset}`)
  for (const [pkg, files] of groups) {
    log.info(`  ${C.cyan}${pkg.prefix}${C.reset} — ${files.length} 个文件`)
  }
  log.info('')
  log.info(`${C.green}✅ dry-run 完成 (0 个实际 typecheck) — ${auditLabel}${C.reset}`)
  process.exit(0)
}

function runGroupsAndReport(groups, totalFiles, scope) {
  let failedCount = 0
  const failedPkgs = []
  for (const [pkg, files] of groups) {
    log.info(`${C.cyan}🔍 typecheck ${pkg.prefix} (${files.length} 个文件)...${C.reset}`)
    const result = runPackageTypecheck(pkg, files)
    if (result.ok) {
      if (result.hasNonStagedErrors) {
        // 全量 typecheck 存在不在本次口径内的文件错误, 属其他 agent 在途改动, 已过滤不阻塞
        log.warn(
          `${C.yellow}  ⚠️ ${pkg.prefix} 全量 typecheck 存在${scope.phrases.outside}(已过滤, 不阻塞)${C.reset}`,
        )
      } else {
        log.info(`${C.green}  ✅ ${pkg.prefix} 通过${C.reset}`)
      }
    } else {
      failedCount++
      failedPkgs.push(pkg)
      log.error(`${C.red}${C.bold}  ❌ ${pkg.prefix} 失败 (exit ${result.exitCode})${C.reset}`)
      if (result.filtered.trim()) {
        log.error(result.filtered)
      } else {
        log.error(
          `${C.dim}  (${scope.phrases.none}, 请在 ${pkg.prefix} 手动跑 pnpm typecheck 排查)${C.reset}`,
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
      `${C.green}${C.bold}✅ ${scope.title} 全部通过 (${groups.size} 个 package, ${totalFiles} 个文件) — ${scope.auditLabel}${C.reset}`,
    )
    process.exit(0)
  }
  log.error(
    `${C.red}${C.bold}❌ ${scope.title} 失败: ${failedCount}/${groups.size} 个 package 不通过 — ${scope.auditLabel}${C.reset}`,
  )
  log.error(`${C.dim}  失败 package: ${failedPkgs.map((p) => p.prefix).join(', ')}${C.reset}`)
  log.error(`${C.dim}  建议:${C.reset}`)
  log.error(`${C.dim}    1. 在对应 package 目录跑 pnpm typecheck 修复所有错误${C.reset}`)
  if (scope.commitHints) {
    log.error(`${C.dim}    2. 修复后 git add . && git commit${C.reset}`)
    log.error(`${C.dim}    3. 紧急跳过: HUSKY_SKIP_STAGED_TYPECHECK=1 git commit${C.reset}`)
  } else {
    log.error(
      `${C.dim}    2. 单独复现: node scripts/check-staged-typecheck.mjs --files <path...>${CLI.root !== null ? ' --root <dir>' : ''}${C.reset}`,
    )
  }
  log.error(`${C.dim}    (注: ${scope.phrases.note})${C.reset}`)
  process.exit(1)
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
    log.error(`${C.red}❌ check-staged-typecheck 脚本执行异常: ${e?.message ?? e}${C.reset}`)
    log.error(e?.stack ?? '(no stack)')
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
