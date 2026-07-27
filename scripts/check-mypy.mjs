#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * mypy 类型检查守门(2026-07-26 立)
 *
 * 防止 ai-service Python 代码类型错误回退:
 *   项目刚完成 mypy 全库清零(4 批次累计 256→0 errors,226 source files),
 *   但当前 mypy 检查只在 `pnpm typecheck:full` 中手工运行,没有 pre-commit 守门。
 *   一旦有 agent 改 Python 代码引入类型错误,typecheck:full 可能被 --no-verify 跳过,
 *   导致 mypy errors 回退。本脚本在 staged 涉及 apps/ai-service 下任意 .py 文件时触发
 *   mypy 检查,0 errors 才通过。
 *
 * 用法:
 *   node scripts/check-mypy.mjs             (全量检查 apps/ai-service/app/, exit 0/1)
 *   node scripts/check-mypy.mjs --staged    (仅 staged 涉及 Python 改动时检查)
 *   node scripts/check-mypy.mjs --help      (打印帮助)
 *
 * 退出码:
 *   0  mypy 0 errors(或 --staged 模式无 Python 改动快速跳过)
 *   1  mypy 有 errors,或 mypy 命令本身执行失败
 *
 * 跳过方式(紧急场景):
 *   HUSKY_SKIP_MYPY=1 git commit ...
 *
 * 与 guardian-runner.mjs 集成位置:
 *   guardian-runner 第 35 项(blocking),在 30a(check-commit-loss-guard)之后、
 *   2d(warn-only 区)之前。原任务描述要求 id '31',但 '31' 已被 verify-auth-shell.mjs
 *   占用(同日 2026-07-26 新增),'34' 也被 check-ts-ignore.mjs 占用,故用下一个可用
 *   编号 '35'。
 *
 * 依赖:apps/ai-service/pyproject.toml 的 [tool.mypy] 配置(已就绪,不修改)。
 *   mypy 命令继承 pyproject.toml 配置 + --ignore-missing-imports 兼容第三方库
 *   + --strict 强制严格模式(防止 pyproject.toml strict 被改回 false 降级)。
 */
import { execSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = process.cwd()
const AI_SERVICE_DIR = join(ROOT, 'apps', 'ai-service')
const isStaged = process.argv.includes('--staged')
const showHelp = process.argv.includes('--help') || process.argv.includes('-h')

// === 颜色(对齐 guardian-runner.mjs 的 C 对象) ===
const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

// === Help ===
if (showHelp) {
  console.log(`
check-mypy.mjs — mypy 类型检查守门(防 ai-service Python 类型回退)

用法:
  node scripts/check-mypy.mjs             (全量检查 apps/ai-service/app/, exit 0/1)
  node scripts/check-mypy.mjs --staged    (仅 staged 涉及 Python 改动时检查)
  node scripts/check-mypy.mjs --help      (打印此帮助)

退出码:
  0  mypy 0 errors(或 --staged 模式无 Python 改动快速跳过)
  1  mypy 有 errors,或 mypy 命令本身执行失败

跳过方式(紧急场景,不推荐):
  HUSKY_SKIP_MYPY=1 git commit ...

执行命令:
  cd apps/ai-service && mypy app --ignore-missing-imports --strict
  (继承 pyproject.toml [tool.mypy] 配置 + --strict 双保险)

背景:
  项目刚完成 mypy 全库清零(4 批次 256→0 errors,226 source files),
  本守门防止后续 agent 改 Python 代码引入类型错误回退。
  集成位置:guardian-runner.mjs 第 35 项(blocking)。
`)
  process.exit(0)
}

// === HUSKY_SKIP_MYPY 跳过(紧急场景) ===
if (process.env.HUSKY_SKIP_MYPY === '1') {
  console.log(`${C.yellow}⚠️  mypy 守门已跳过(HUSKY_SKIP_MYPY=1,紧急场景,不推荐)${C.reset}`)
  process.exit(0)
}

// === --staged 模式:检测是否有 apps/ai-service/**/*.py 改动 ===
if (isStaged) {
  let stagedFiles = ''
  try {
    stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      encoding: 'utf8',
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch {
    // 非 git 环境,降级跑全量
    stagedFiles = ''
  }

  const files = stagedFiles.split('\n').filter(Boolean)
  // 匹配 apps/ai-service/ 下任意 .py 文件(含子目录)
  const pyChanges = files.filter(
    (f) => f.startsWith('apps/ai-service/') && f.endsWith('.py'),
  )

  if (pyChanges.length === 0) {
    console.log(`${C.dim}⏭  mypy 类型检查守门(无 apps/ai-service/**/*.py staged 改动, 跳过)${C.reset}`)
    process.exit(0)
  }

  console.log(
    `${C.cyan}${C.bold}[mypy 守门] staged 检测到 ${pyChanges.length} 个 Python 文件改动,触发 mypy 检查:${C.reset}`,
  )
  for (const f of pyChanges.slice(0, 10)) {
    console.log(`${C.dim}  - ${f}${C.reset}`)
  }
  if (pyChanges.length > 10) {
    console.log(`${C.dim}  ... 及其他 ${pyChanges.length - 10} 个文件${C.reset}`)
  }
  console.log('')
} else {
  console.log(
    `${C.cyan}${C.bold}[mypy 守门] 全量检查 apps/ai-service/app/ (mypy --ignore-missing-imports --strict)...${C.reset}`,
  )
}

// === 执行 mypy ===
// 命令:cd apps/ai-service && mypy app --ignore-missing-imports --strict
// - 继承 pyproject.toml [tool.mypy] 配置(strict=true 已就绪)
// - --strict 显式传参作为双保险,防止有人改 pyproject.toml strict=false 降级守门
// - --ignore-missing-imports 兼容第三方库无 stub 场景
// - mypy exit 0 = 0 errors;exit 1 = 有 errors;exit 2 = 命令本身失败
const MYPY_CMD = 'mypy app --ignore-missing-imports --strict'
const startTime = Date.now()

try {
  const output = execSync(MYPY_CMD, {
    encoding: 'utf8',
    cwd: AI_SERVICE_DIR,
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 10 * 1024 * 1024,
  })
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  // mypy 成功输出:"Success: no issues found in N source files"
  // 或空输出(取决于版本)
  const trimmed = (output || '').trim()
  if (trimmed) {
    console.log(`${C.dim}${trimmed}${C.reset}`)
  }
  console.log(`${C.green}${C.bold}✅ mypy 守门通过(0 errors, ${elapsed}s)${C.reset}`)
  console.log(`${C.dim}   命令: cd apps/ai-service && ${MYPY_CMD}${C.reset}`)
  process.exit(0)
} catch (err) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  // mypy exit 1 = 有 errors(stderr 含诊断信息);exit 2 = 命令本身失败
  const stderr = err.stderr || ''
  const stdout = err.stdout || ''
  const combined = (stdout + '\n' + stderr).trim()

  console.log('')
  console.log(`${C.red}${C.bold}❌ mypy 守门失败(${elapsed}s)${C.reset}`)

  if (combined) {
    console.log(`${C.dim}--- mypy 输出 ---${C.reset}`)
    // 截断超长输出(保留最后 100 行,通常是 error 摘要)
    const lines = combined.split('\n')
    if (lines.length > 150) {
      console.log(`${C.dim}(输出超长,仅显示最后 100 行,共 ${lines.length} 行)${C.reset}`)
      console.log(lines.slice(-100).join('\n'))
    } else {
      console.log(combined)
    }
    console.log(`${C.dim}--- end ---${C.reset}`)
  }

  console.log('')
  console.log(`${C.bold}修复方法:${C.reset}`)
  console.log(`  1. 跑 mypy 查看完整错误: ${C.cyan}cd apps/ai-service && ${MYPY_CMD}${C.reset}`)
  console.log(`  2. 根据 mypy 输出修复类型错误(常见:缺类型注解 / Optional / Union / return type)`)
  console.log(`  3. 详细 mypy 配置见 apps/ai-service/pyproject.toml [tool.mypy]`)
  console.log('')
  console.log(`${C.dim}紧急跳过(不推荐): HUSKY_SKIP_MYPY=1 git commit ...${C.reset}`)
  console.log(`${C.dim}背景: 项目刚完成 mypy 全库清零(4 批次 256→0 errors, 226 files),本守门防止回退${C.reset}`)

  process.exit(1)
}
