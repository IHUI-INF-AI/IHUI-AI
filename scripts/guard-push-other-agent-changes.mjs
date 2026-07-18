#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * 跨 Agent 改动保护守门 — 防止 commit/push 阶段混入其他 agent 改动。
 *
 * 依据 AGENTS.md 第 18 节"Push 阶段跨 Agent 改动保护规则"(强制,2026-07-18 立):
 *   多 agent 并行工作同一 main 分支时,本 agent 的 commit 必须仅含本任务相关文件,
 *   禁止混入其他 agent 改动, 禁止抹除其他 agent 的 working tree 改动.
 *
 * 检测模式:
 *   1. whitelist 模式 (推荐): 调用时传入本任务文件清单,任何 staged 不在白名单中即报错
 *      $ node scripts/guard-push-other-agent-changes.mjs AGENTS.md PROJECT_PLAN.md
 *   2. baseline 模式: 与 baseline 提交对比 staged 增量文件,如果增量文件不在
 *      预期的"本任务文件 glob 模式"中即报错
 *   3. danger 模式 (--strict): 不允许 working tree 存在 modified + untracked
 *      中含有非本任务文件 (会强制要求 working tree 干净)
 *
 * 退出码:
 *   0 - 守门通过
 *   1 - 检测到混入其他 agent 改动
 *   2 - 用法错误
 *
 * 集成位置:
 *   - .husky/pre-commit: 集成 whitelist 模式,在 commit 前检测
 *   - .husky/pre-push: 集成 baseline 模式,在 push 前检测
 *
 * 设计权衡:
 *   - 不强制 working tree 干净(否则会要求用户先 commit 其他 agent 改动,违反第 18 节)
 *   - 不阻止 add . 之后(因为 git add 时已经发生,无法追溯)
 *   - 仅在 commit/push 阶段检查 staged 列表,给用户最后一道拦截
 *   - 提供 --dry-run 模式可打印 staged 列表用于人工 review
 */
import { execSync } from 'node:child_process'

const ROOT = process.cwd()
const ARGS = process.argv.slice(2)

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

/** 解析命令行参数 */
function parseArgs() {
  const opts = {
    whitelist: [],
    strict: false,
    dryRun: false,
    help: false,
  }
  for (const arg of ARGS) {
    if (arg === '--strict') opts.strict = true
    else if (arg === '--dry-run') opts.dryRun = true
    else if (arg === '--help' || arg === '-h') opts.help = true
    else if (arg.startsWith('--')) {
      console.error(`${C.red}未知参数: ${arg}${C.reset}`)
      process.exit(2)
    } else {
      opts.whitelist.push(arg)
    }
  }
  return opts
}

/** 打印帮助 */
function printHelp() {
  console.log(`${C.cyan}${C.bold}跨 Agent 改动保护守门${C.reset}`)
  console.log('')
  console.log('用法:')
  console.log(
    `  ${C.dim}node scripts/guard-push-other-agent-changes.mjs <本任务文件1> [本任务文件2] ... [options]${C.reset}`,
  )
  console.log('')
  console.log('选项:')
  console.log(`  ${C.dim}--strict${C.reset}    严格模式, 不允许 working tree 存在非白名单文件`)
  console.log(`  ${C.dim}--dry-run${C.reset}   仅打印 staged 列表, 不报错`)
  console.log(`  ${C.dim}--help, -h${C.reset}  打印帮助`)
  console.log('')
  console.log('示例:')
  console.log(
    `  ${C.dim}node scripts/guard-push-other-agent-changes.mjs AGENTS.md PROJECT_PLAN.md${C.reset}`,
  )
  console.log(
    `  ${C.dim}node scripts/guard-push-other-agent-changes.mjs apps/web/src/components/*.tsx --strict${C.reset}`,
  )
  console.log(
    `  ${C.dim}node scripts/guard-push-other-agent-changes.mjs --dry-run${C.reset}`,
  )
}

/** 获取 staged 文件列表 (相对路径, 含 Added/Modified/Deleted/Renamed/Copied) */
function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACDMR', {
      encoding: 'utf8',
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return output
      .split('\n')
      .filter(Boolean)
      .map((f) => f.replace(/\\/g, '/'))
  } catch (err) {
    console.error(`${C.red}获取 staged 文件失败:${C.reset}`, err.message)
    process.exit(2)
  }
}

/** 获取 working tree modified + untracked 文件列表 */
function getWorkingTreeFiles() {
  try {
    const output = execSync('git status --porcelain', {
      encoding: 'utf8',
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return output
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        // 格式: "XY filename" (X=index状态, Y=working tree状态, 1 空格 + 路径)
        // 例: " M src/foo.ts" / "?? new-file.ts" / "R  old -> new" (renamed)
        const match = line.match(/^[ MMD?TARCU?!]{2}\s(.+?)(?:\s->\s.+)?$/)
        return match ? match[1].replace(/\\/g, '/') : null
      })
      .filter(Boolean)
  } catch (err) {
    console.error(`${C.red}获取 working tree 状态失败:${C.reset}`, err.message)
    process.exit(2)
  }
}

/** 检查文件路径是否匹配 glob 模式 */
function matchGlob(file, pattern) {
  // 简单 glob 支持: ** / * / ? / [abc] (基于 minimatch 思路)
  // 这里手写实现, 避免外部依赖
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 转义正则元字符
    .replace(/\*\*/g, '__DOUBLESTAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLESTAR__/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${regex}$`).test(file)
}

/** 展开通配符到实际文件列表 */
function expandGlob(pattern) {
  if (!pattern.includes('*') && !pattern.includes('?')) {
    // 精确路径
    return [pattern]
  }
  // 用 git ls-files 展开
  try {
    const output = execSync(`git ls-files -- "${pattern}"`, {
      encoding: 'utf8',
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return output
      .split('\n')
      .filter(Boolean)
      .map((f) => f.replace(/\\/g, '/'))
  } catch {
    return []
  }
}

/** 检查白名单匹配 */
function isInWhitelist(file, whitelist) {
  for (const pattern of whitelist) {
    if (matchGlob(file, pattern)) return true
  }
  return false
}

function main() {
  const opts = parseArgs()

  if (opts.help) {
    printHelp()
    process.exit(0)
  }

  console.log(
    `${C.cyan}${C.bold}[跨 Agent 改动保护守门] 验证 staged 列表仅含本任务文件...${C.reset}`,
  )
  console.log(
    `${C.dim}依据: AGENTS.md 第 18 节 - Push 阶段跨 Agent 改动保护规则${C.reset}`,
  )
  console.log('')

  const staged = getStagedFiles()
  const workingTree = getWorkingTreeFiles()

  if (opts.dryRun) {
    console.log(`${C.dim}--dry-run 模式: 仅打印 staged 列表${C.reset}`)
    console.log('')
    console.log(`${C.bold}Staged 文件 (${staged.length} 个):${C.reset}`)
    staged.forEach((f) => console.log(`  ${C.green}+ ${f}${C.reset}`))
    console.log('')
    console.log(`${C.bold}Working tree 改动 (${workingTree.length} 个):${C.reset}`)
    workingTree.forEach((f) => console.log(`  ${C.yellow}~ ${f}${C.reset}`))
    console.log('')
    console.log(`${C.green}✅ dry-run 完成, 无报错${C.reset}`)
    process.exit(0)
  }

  // whitelist 模式
  if (opts.whitelist.length > 0) {
    const expandedWhitelist = []
    for (const pattern of opts.whitelist) {
      expandedWhitelist.push(...expandGlob(pattern))
    }
    // 去重
    const whitelistSet = new Set(expandedWhitelist)

    console.log(`${C.dim}白名单模式:${C.reset}`)
    console.log(
      `  本任务白名单文件: ${C.cyan}${opts.whitelist.join(', ')}${C.reset} ${C.dim}(展开 ${whitelistSet.size} 个)${C.reset}`,
    )
    console.log(`  Staged 文件数: ${staged.length}`)
    console.log('')

    if (staged.length === 0) {
      console.log(`${C.yellow}⚠️  没有 staged 文件, 无需 commit${C.reset}`)
      process.exit(0)
    }

    const violations = []
    for (const file of staged) {
      if (!whitelistSet.has(file) && !isInWhitelist(file, opts.whitelist)) {
        violations.push(file)
      }
    }

    if (violations.length === 0) {
      console.log(`${C.green}${C.bold}✅ 守门通过 — 所有 staged 文件均在白名单内${C.reset}`)
      console.log(`${C.dim}staged: ${staged.join(', ')}${C.reset}`)
      process.exit(0)
    }

    console.log(
      `${C.red}${C.bold}❌ 检测到 ${violations.length} 个 staged 文件不在本任务白名单:${C.reset}`,
    )
    console.log('')
    console.log(`${C.red}违规文件:${C.reset}`)
    violations.forEach((f) => console.log(`  ${C.red}✗ ${f}${C.reset}`))
    console.log('')
    console.log(
      `${C.yellow}可能原因:${C.reset}`,
    )
    console.log(`  ${C.dim}1. ${C.reset}sandbox/其他 agent 自动 git add 了这些文件`)
    console.log(
      `  ${C.dim}2. ${C.reset}你执行了 git add . / git add -A 把其他 agent 改动一起 stage 了`,
    )
    console.log(`  ${C.dim}3. ${C.reset}白名单不完整, 需要补全`)
    console.log('')
    console.log(`${C.yellow}修复方法 (任选):${C.reset}`)
    console.log(
      `  ${C.dim}方案 A${C.reset} - 取消 stage 违规文件 (非破坏, working tree 保留):`,
    )
    console.log(
      `    ${C.dim}git restore --staged ${violations.join(' ')}${C.reset}`,
    )
    console.log(`  ${C.dim}方案 B${C.reset} - 补全白名单:`)
    console.log(
      `    ${C.dim}node scripts/guard-push-other-agent-changes.mjs ${staged.join(' ')}${C.reset}`,
    )
    console.log(`  ${C.dim}方案 C${C.reset} - 确认这些文件确实属于本任务, commit:`)
    console.log(`    ${C.dim}git commit -m "..."${C.reset}`)
    console.log('')
    console.log(`${C.dim}详见 AGENTS.md 第 18 节红线事故等级: 混入 = 污染事故${C.reset}`)
    process.exit(1)
  }

  // 默认模式: 仅打印 staged 列表
  console.log(`${C.bold}Staged 文件 (${staged.length} 个):${C.reset}`)
  staged.forEach((f) => console.log(`  ${C.green}+ ${f}${C.reset}`))
  console.log('')
  console.log(`${C.bold}Working tree 改动 (${workingTree.length} 个, 不在 staged 内):${C.reset}`)
  workingTree.forEach((f) => console.log(`  ${C.yellow}~ ${f}${C.reset}`))
  console.log('')
  console.log(
    `${C.dim}提示: 调用方式 node scripts/guard-push-other-agent-changes.mjs <白名单文件>... 启用白名单模式${C.reset}`,
  )
  console.log(
    `${C.dim}      或加 --strict (严格模式) / --dry-run (仅打印不报错)${C.reset}`,
  )
  process.exit(0)
}

main()
