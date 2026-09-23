#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


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
 * 历史案例: 见 .ihui-agent/archive/AGENTS_history.md
 */
import { existsSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'

const GIT = process.env.IHUI_GIT_BIN || 'git'

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
  '.ihui-agent',
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
      if (EXCLUDE_DIRS.has(name) || isExcludedDirName(name)) continue
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
      if (EXCLUDE_DIRS.has(name) || isExcludedDirName(name)) continue
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
      if (EXCLUDE_DIRS.has(name) || isExcludedDirName(name)) continue
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
 * 解析 `git check-ignore -v <path>` 的输出 ⇒ { ignored, rule }。
 *
 * 输出形态:`<来源>:<行号>:<模式>\t<路径>`。⚠️ 带 -v 时 git 对**否定规则**(`!pattern`)
 * 同样打印命中行,所以"输出非空 = 被忽略"是错的:实测 .gitignore 第 245 行那条以 `!` 开头的
 * 反忽略规则会把 apps/web/src/components/billing/__tests__/ 判成 BLOCK(假阳性,会卡死无关提交)。
 * 反忽略的 `apps/web/src/components/billing/__tests__/` 判成 BLOCK(假阳性,会卡死无关提交)。
 * 判据只能是"命中的模式本身不以 `!` 开头"。来源路径在 Windows 下含盘符冒号,故按**最后一个**
 * 冒号段取模式,不按固定下标。
 */
export function parseCheckIgnoreLine(line) {
  if (!line || !line.trim()) return { ignored: false, rule: '' }
  const head = line.split('\t')[0]
  const pattern = head.split(':').pop() ?? ''
  return { ignored: !pattern.startsWith('!'), rule: head.trim() }
}

/**
 * git check-ignore -v 复核单个路径(目录或文件)。
 * exit 1 = 无任何规则命中 ⇒ 不被忽略;exit 0 = 命中某条规则 ⇒ 再看是否否定。
 */
function probeIgnore(absPath, { asDir = true } = {}) {
  const rel = relative(ROOT, absPath).split(sep).join('/')
  // 目录探查要带尾斜杠(否则 git 按文件模式匹配,结论相反);文件探查**不得**带
  const target = asDir ? (rel.endsWith('/') ? rel : `${rel}/`) : rel
  let out = ''
  try {
    out = execFileSync(GIT, ['-c', 'safe.directory=*', 'check-ignore', '-v', target], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    })
  } catch (e) {
    if (e && e.status === 1) return { ignored: false, rule: '' }
    // status 128(不在 git 环境)/ 其他异常:宁可不判红,由"不被忽略"分支放过并如实报
    return { ignored: false, rule: `git-error:${e?.status ?? e?.message ?? 'unknown'}` }
  }
  return parseCheckIgnoreLine(out.split('\n').find((l) => l.trim()))
}

/** 目录内前若干个文件(用于"目录未命中但文件被吞"的第二层复核) */
function sampleFilesIn(dir, limit = 5) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile())
      .slice(0, limit)
      .map((d) => join(dir, d.name))
  } catch {
    return []
  }
}

function toRel(absPath) {
  return relative(ROOT, absPath)
}

async function main() {
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
      // 两层探查:目录本身 + 目录内实文件。只查目录会漏"目录未命中、里面的 .test.ts 被吞"
      // (`**/__tests__/*.ts` 这类规则);只查非否定又会把反忽略判成红(见 parseCheckIgnoreLine)。
      const dirProbe = probeIgnore(dir, { asDir: true })
      const fileProbes = sampleFilesIn(dir).map((f) => ({ f, ...probeIgnore(f, { asDir: false }) }))
      const hitFile = fileProbes.find((p) => p.ignored)
      const isIgnored = dirProbe.ignored || Boolean(hitFile)
      const ruleText = dirProbe.ignored ? dirProbe.rule : (hitFile?.rule ?? '')
      if (isIgnored && !gitkeep) {
        // 命中 ignore 规则且无 .gitkeep → 阻断
        issues.push({
          level: 'block',
          path: rel,
          reason:
            `__tests__/ 被 .gitignore 忽略(${ruleText || 'ignore 规则'}),且无 .gitkeep 标记,` +
            (hitFile ? `其中 ${toRel(hitFile.f)} 不会被 git 跟踪` : '测试文件不会被 git 跟踪'),
          fix: '方案 A(推荐):将目录重命名为 tests/; 方案 B:在目录内放 .gitkeep 并接受所有子文件需用 `!` 反忽略',
        })
        console.log(`  ${C.red}✗${C.reset} ${C.bold}${rel}${C.reset}  ${C.red}[BLOCK]${C.reset}`)
        console.log(`     ${C.dim}git rule: ${ruleText}${C.reset}`)
        console.log(`     ${C.dim}.gitkeep: ${gitkeep ? '有' : '无'}${C.reset}`)
      } else if (isIgnored && gitkeep) {
        console.log(`  ${C.green}✓${C.reset} ${rel}  ${C.dim}(已被 ignore + 含 .gitkeep,显式标记) ${C.reset}`)
      } else {
        // 不被 ignore(含"只被 `!` 反忽略命中")→ 通过
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

// §22d:本模块导出 parseCheckIgnoreLine 供测试直接 import,故入口必须加 isDirectRun 守卫,
// 否则测试一 import 就连带跑全仓扫描(副作用 + 拖慢)。Windows 反斜杠路径须经 pathToFileURL 归一。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`${C.red}❌ 脚本执行异常:${C.reset}`, e?.message ?? e)
    console.error(e?.stack ?? '(no stack)')
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
