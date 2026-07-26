#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-test-paths.mjs — 测试目录与误忽略路径守门(AGENTS.md §23 配套)
 *
 * 背景(2026-07-25 立,真实事故):
 *   .gitignore 第 154 行 `__*` 规则会静默忽略所有以 `__` 开头的路径,
 *   包括合法的 `__tests__/` 目录。阶段 13 集成测试 subagent
 *   在 `apps/web/__tests__/storage-adapter.test.ts` 写了测试文件,
 *   `git status` 完全不显示(untracked 都被忽略),险些导致整个 stage 13
 *   测试丢失,直到最后 `git check-ignore -v` 才被发现。
 *
 * 检查项:
 *   1. **__tests__/ 目录(主项)**:扫描项目内所有 `__tests__/` 目录
 *      - 含 `.gitkeep` → 通过(明确"目录内全部文件被故意 ignore")
 *      - 不含 `.gitkeep` → 阻断 + 建议改用 `tests/`(避开 `__*` 规则)
 *   2. **临时/备份目录**:`*.tmp` / `*.bak` 结尾的目录(常见误忽略源)
 *   3. **隐藏目录白名单**:`.vscode` / `.idea` / `.git` 等合法隐藏目录
 *      之外的纯 `.xxx` 目录(可能是误忽略)
 *   4. **git check-ignore 复核**:对发现的每个 `__tests__/` 目录调
 *      `git check-ignore -v`,确认是否被 `__*` 规则命中
 *
 * 退出码:
 *   0 — 通过(无阻断)
 *   1 — 阻断(存在误忽略风险,需修复)
 *
 * 用法:
 *   node scripts/check-test-paths.mjs
 *   node scripts/check-test-paths.mjs --strict
 *
 * 集成位置: CI / guardian-runner / pre-commit 后续项
 * 历史案例: 见 .trae-cn/archive/AGENTS_history.md
 */
import { existsSync, readdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, relative, resolve, sep } from 'node:path'

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

// 扫描根(相对 cwd 的绝对路径)
const ROOT = resolve(process.cwd())
// 只扫描源码区,跳过产物/依赖/审计
const SCAN_ROOTS = ['apps', 'packages', 'scripts']
// 排除目录(产物/依赖/审计/版本控制)
const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.next',
  '.turbo',
  '.output',
  'dist',
  'build',
  'coverage',
  '.trae-cn',
  '.git',
  '.swc',
  '.cache',
  '.pnpm-store',
  '.husky',
  'storybook-static',
  '.vercel',
  '.nitro',
  '.angular',
])
// 合法隐藏目录白名单
const ALLOWED_DOT_DIRS = new Set([
  '.vscode',
  '.idea',
  '.git',
  '.github',
  '.husky',
  '.changeset',
  '.vs',
  '.devcontainer',
  '.editorconfig',
  '.gitattributes',
  '.npmrc',
  '.nvmrc',
  '.node-version',
  '.env',
  '.env.example',
  '.env.local',
])

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim()
  } catch (e) {
    if (opts.allowFail) return ''
    throw e
  }
}

function header(label) {
  return `\n${C.cyan}${C.bold}── ${label} ──${C.reset}`
}

/**
 * 递归扫描目录,返回指定 basename 的目录绝对路径列表
 */
function findDirsByName(root, basename) {
  const results = []
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const name = entry.name
      if (EXCLUDE_DIRS.has(name)) continue
      const full = join(dir, name)
      if (name === basename) {
        results.push(full)
        // __tests__/ 子目录不再下钻(避免重复扫内部 fixtures 里的 __tests__)
        continue
      }
      // 跳过明显 . 开头隐藏目录
      if (name.startsWith('.') && !ALLOWED_DOT_DIRS.has(name)) continue
      stack.push(full)
    }
  }
  return results
}

/**
 * 扫描所有以 .tmp / .bak 结尾的目录
 */
function findTempDirs(root) {
  const results = []
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const name = entry.name
      if (EXCLUDE_DIRS.has(name)) continue
      if (/\.(tmp|bak)$/i.test(name)) {
        results.push(join(dir, name))
        continue
      }
      if (name.startsWith('.') && !ALLOWED_DOT_DIRS.has(name)) continue
      stack.push(join(dir, name))
    }
  }
  return results
}

/**
 * 扫描不在白名单中的隐藏目录(可能是误忽略源)
 */
function findUnknownDotDirs(root) {
  const results = []
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const name = entry.name
      if (EXCLUDE_DIRS.has(name)) continue
      if (name.startsWith('.') && !ALLOWED_DOT_DIRS.has(name)) {
        results.push(join(dir, name))
        continue
      }
      stack.push(join(dir, name))
    }
  }
  return results
}

/**
 * 检查目录内是否有 .gitkeep 文件
 */
function hasGitkeep(dir) {
  return existsSync(join(dir, '.gitkeep'))
}

/**
 * 调用 git check-ignore -v 验证目录是否被 ignore
 * 返回空字符串表示不被 ignore,非空表示被 ignore(含规则来源)
 */
function checkIgnore(absPath) {
  const rel = relative(ROOT, absPath).split(sep).join('/')
  // 加 / 表示检查目录本身
  return run(`git check-ignore -v "${rel}/" 2>&1`, { allowFail: true })
}

function toRel(absPath) {
  return relative(ROOT, absPath)
}

function main() {
  const isStrict = process.argv.includes('--strict')

  console.log(`${C.cyan}${C.bold}🧪 测试目录与误忽略路径守门(AGENTS.md §23 配套)${C.reset}`)
  console.log(`${C.dim}扫描根: ${ROOT}${C.reset}`)
  console.log(`${C.dim}扫描范围: ${SCAN_ROOTS.join(', ')}${C.reset}`)

  const issues = []
  let totalScanned = 0

  // ── 1. __tests__/ 目录检测(主项) ──
  console.log(header('1. __tests__/ 目录检测(主项)'))
  const testsDirs = []
  for (const r of SCAN_ROOTS) {
    const abs = join(ROOT, r)
    if (!existsSync(abs)) continue
    testsDirs.push(...findDirsByName(abs, '__tests__'))
  }
  totalScanned += testsDirs.length

  if (testsDirs.length === 0) {
    console.log(`  ${C.green}✅ 未发现 __tests__/ 目录${C.reset}`)
  } else {
    console.log(`  发现 ${C.bold}${testsDirs.length}${C.reset} 个 __tests__/ 目录,逐个核对…`)
    for (const dir of testsDirs) {
      const rel = toRel(dir)
      const gitkeep = hasGitkeep(dir)
      const ignoreRule = checkIgnore(dir)
      const isIgnored = Boolean(ignoreRule)
      if (isIgnored && !gitkeep) {
        // 命中 __* 规则且无 .gitkeep → 阻断
        issues.push({
          level: 'block',
          path: rel,
          reason: `__tests__/ 目录被 .gitignore 忽略(${ignoreRule.split('\n')[0] || '__* 规则'}),且无 .gitkeep 标记,测试文件不会被 git 跟踪`,
          fix: '方案 A(推荐):将目录重命名为 tests/; 方案 B:在目录内放 .gitkeep 并接受所有子文件需用 `!` 反忽略',
        })
        console.log(`  ${C.red}✗${C.reset} ${C.bold}${rel}${C.reset}  ${C.red}[BLOCK]${C.reset}`)
        console.log(`     ${C.dim}git rule: ${ignoreRule.split('\n')[0]}${C.reset}`)
        console.log(`     ${C.dim}.gitkeep: ${gitkeep ? '有' : '无'}${C.reset}`)
      } else if (isIgnored && gitkeep) {
        console.log(`  ${C.green}✓${C.reset} ${rel}  ${C.dim}(已被 ignore + 含 .gitkeep,显式标记) ${C.reset}`)
      } else {
        // 不被 ignore → 通过
        console.log(`  ${C.green}✓${C.reset} ${rel}  ${C.dim}(未命中 ignore 规则)${C.reset}`)
      }
    }
  }

  // ── 2. 临时/备份目录 ──
  console.log(header('2. 临时/备份目录检测(*.tmp / *.bak)'))
  const tempDirs = []
  for (const r of SCAN_ROOTS) {
    const abs = join(ROOT, r)
    if (!existsSync(abs)) continue
    tempDirs.push(...findTempDirs(abs))
  }
  totalScanned += tempDirs.length

  if (tempDirs.length === 0) {
    console.log(`  ${C.green}✅ 未发现 *.tmp / *.bak 目录${C.reset}`)
  } else {
    for (const dir of tempDirs) {
      const rel = toRel(dir)
      issues.push({
        level: 'warn',
        path: rel,
        reason: '存在 *.tmp / *.bak 目录,可能残留构建副本或临时产物',
        fix: '确认是否需要保留;若不需要,删除即可',
      })
      console.log(`  ${C.yellow}⚠${C.reset} ${rel}  ${C.dim}[WARN]${C.reset}`)
    }
  }

  // ── 3. 未知隐藏目录(白名单外) ──
  console.log(header('3. 隐藏目录白名单检测(非白名单 .xxx 目录)'))
  const dotDirs = []
  for (const r of SCAN_ROOTS) {
    const abs = join(ROOT, r)
    if (!existsSync(abs)) continue
    dotDirs.push(...findUnknownDotDirs(abs))
  }
  totalScanned += dotDirs.length

  if (dotDirs.length === 0) {
    console.log(`  ${C.green}✅ 未发现白名单外隐藏目录${C.reset}`)
  } else {
    for (const dir of dotDirs) {
      const rel = toRel(dir)
      // 仅 warn,不断(blocking 太严)
      issues.push({
        level: 'warn',
        path: rel,
        reason: '非白名单隐藏目录,确认是否被 .gitignore 误忽略',
        fix: '在 ALLOWED_DOT_DIRS 加白名单,或重命名为非 . 前缀',
      })
      console.log(`  ${C.yellow}⚠${C.reset} ${rel}  ${C.dim}[WARN]${C.reset}`)
    }
  }

  // ── 4. 综合判定 ──
  console.log(header('4. 综合判定'))
  const blockIssues = issues.filter((i) => i.level === 'block')
  const warnIssues = issues.filter((i) => i.level === 'warn')

  console.log(`  扫描总数: ${C.bold}${totalScanned}${C.reset}`)
  console.log(`  阻断项: ${C.red}${C.bold}${blockIssues.length}${C.reset}`)
  console.log(`  警告项: ${C.yellow}${C.bold}${warnIssues.length}${C.reset}`)

  if (blockIssues.length === 0 && warnIssues.length === 0) {
    console.log(`\n  ${C.green}${C.bold}✅ 所有测试路径与目录均合规${C.reset}`)
    process.exit(0)
  }

  if (blockIssues.length > 0) {
    console.log(`\n${C.red}${C.bold}❌ 发现 ${blockIssues.length} 个阻断项:${C.reset}`)
    for (const it of blockIssues) {
      console.log(`  ${C.red}✗${C.reset} ${C.bold}${it.path}${C.reset}`)
      console.log(`     ${C.dim}原因:${C.reset} ${it.reason}`)
      console.log(`     ${C.dim}修复:${C.reset} ${it.fix}`)
    }
  }

  if (warnIssues.length > 0) {
    console.log(`\n${C.yellow}${C.bold}⚠️  发现 ${warnIssues.length} 个警告项:${C.reset}`)
    for (const it of warnIssues) {
      console.log(`  ${C.yellow}⚠${C.reset} ${it.path}`)
      console.log(`     ${C.dim}${it.reason}${C.reset}`)
    }
  }

  // blocking 策略:
  //   - 默认(blockIssues > 0 → exit 1)
  //   - --strict 模式(warnIssues > 0 也 exit 1)
  if (blockIssues.length > 0) {
    console.log(`\n${C.red}💡 建议:${C.reset}`)
    console.log(`   1. ${C.cyan}git check-ignore -v <path>${C.reset}  确认具体 ignore 规则来源`)
    console.log(`   2. 将 __tests__/ 重命名为 ${C.cyan}tests/${C.reset}(避开 .gitignore 第 154 行 __* 规则)`)
    console.log(`   3. 详细规则见 ${C.cyan}AGENTS.md §23${C.reset}`)
    process.exit(1)
  }

  if (isStrict && warnIssues.length > 0) {
    console.log(`\n${C.yellow}💡 --strict 模式下警告项视为阻断,请人工复核${C.reset}`)
    process.exit(1)
  }

  console.log(`\n${C.green}✅ 阻断项 0,警告项已提示(不阻塞)${C.reset}`)
  process.exit(0)
}

main().catch((e) => {
  console.error(`${C.red}❌ 脚本执行异常:${C.reset}`, e?.message ?? e)
  console.error(e?.stack ?? '(no stack)')
  process.exit(2)
})
