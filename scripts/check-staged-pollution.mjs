#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Staged 文件污染预警守门 (warn-only, 2026-07-20 立)
 *
 * 触发场景: 多 agent 并行开发同一 main 分支时, 如果 agent 误把其他 agent 改动
 * 一起 `git add` + commit, 会导致"污染事故"(AGENTS.md §16).
 *
 * 检测启发式 (满足任一即警告, 降低误报):
 *   - 跨 ≥ 4 个一级子目录 (apps/web, apps/api, apps/ai-service, packages/ui 等)
 *     单 agent 任务极少跨 4+ 目录, 跨 4+ 目录大概率是多 agent 改动混入
 *   - 或: staged 文件数 > 15 且跨 ≥ 3 个目录 (大改但跨目录)
 *
 * 不触发条件 (避免误报):
 *   - 单目录大改 (如重构 apps/web 多文件): 文件多但目录单一
 *   - 跨目录小改 (如改 1 个 api + 1 个 web 类型): 跨目录但文件少
 *
 * 退出码: 始终 0 (warn-only, 不阻塞 commit)
 *
 * 配套工具: scripts/guard-push-other-agent-changes.mjs (白名单模式, 阻塞)
 * 用法: $ node scripts/guard-push-other-agent-changes.mjs <本任务文件1> [本任务文件2] ...
 *
 * 集成位置: .husky/pre-commit 第 19 项 (末尾, 不影响其他守门)
 */
import { execSync } from 'node:child_process'

const ROOT = process.cwd()

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
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
  } catch {
    return []
  }
}

/** 提取一级子目录 (如 apps/web, apps/api, packages/ui, scripts, .husky)
 *  apps/* 和 packages/* 取二级 (apps/web, packages/ui 等)
 *  其他目录 (scripts, .husky, docs 等) 取一级即可
 */
function getTopGroup(file) {
  const parts = file.split('/')
  if (parts.length === 1) return parts[0]
  if (parts[0] === 'apps' || parts[0] === 'packages') {
    return `${parts[0]}/${parts[1]}`
  }
  return parts[0]
}

function main() {
  const staged = getStagedFiles()

  if (staged.length === 0) {
    console.log(`${C.dim}⏭  staged 污染预警(无 staged 文件, 跳过)${C.reset}`)
    process.exit(0)
  }

  // 按一级子目录分组
  const groups = new Map()
  for (const file of staged) {
    const group = getTopGroup(file)
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group).push(file)
  }

  const uniqueGroups = groups.size
  const fileCount = staged.length

  // 启发式 (满足任一即警告):
  //   - 跨 ≥ 4 个一级子目录 (单 agent 任务极少跨 4+ 目录)
  //   - 或: 文件数 > 15 且跨 ≥ 3 个目录 (大改但跨目录)
  const shouldWarn = uniqueGroups >= 4 || (fileCount > 15 && uniqueGroups >= 3)

  if (!shouldWarn) {
    console.log(
      `${C.dim}⏭  staged 污染预警(${fileCount} 文件, ${uniqueGroups} 个目录, 启发式未触发)${C.reset}`,
    )
    process.exit(0)
  }

  // 打印警告
  console.log('')
  console.log(
    `${C.yellow}${C.bold}⚠️  Staged 污染预警 (warn-only, 不阻塞)${C.reset}`,
  )
  console.log(
    `${C.dim}依据: AGENTS.md §16 Push 阶段跨 Agent 改动保护规则${C.reset}`,
  )
  console.log('')
  console.log(
    `${C.yellow}检测到 staged 文件 ${fileCount} 个, 跨 ${uniqueGroups} 个一级子目录 (≥ 4 或 >15+≥3)${C.reset}`,
  )
  console.log(`${C.yellow}这可能是污染事故的征兆:${C.reset}`)
  console.log(
    `${C.dim}  多 agent 并行时, 如果误把其他 agent 改动一起 commit,${C.reset}`,
  )
  console.log(
    `${C.dim}  会导致"污染事故"(commit 历史不清晰, 但已落地无法回退).${C.reset}`,
  )
  console.log('')
  console.log(`${C.bold}Staged 文件分布:${C.reset}`)
  for (const [group, files] of groups) {
    console.log(`  ${C.cyan}${group}${C.reset} ${C.dim}(${files.length} 个)${C.reset}`)
    files.slice(0, 5).forEach((f) => console.log(`    ${C.dim}+ ${f}${C.reset}`))
    if (files.length > 5) {
      console.log(`    ${C.dim}... 还有 ${files.length - 5} 个${C.reset}`)
    }
  }
  console.log('')
  console.log(`${C.bold}建议预检 (commit 前可手动跑):${C.reset}`)
  console.log(
    `  ${C.dim}node scripts/guard-push-other-agent-changes.mjs <本任务文件1> <本任务文件2> ...${C.reset}`,
  )
  console.log(
    `  ${C.dim}# 白名单模式, 检测 staged 是否仅含本任务文件 (阻塞 + 给修复建议)${C.reset}`,
  )
  console.log('')
  console.log(
    `${C.dim}若确认这些文件确实属于本任务 (如跨端同步开发), 可忽略此警告直接 commit.${C.reset}`,
  )
  console.log(
    `${C.dim}若发现污染, 修复方法: git restore --staged <违规文件> (非破坏, working tree 保留)${C.reset}`,
  )
  console.log('')
  // warn-only, exit 0 不阻塞
  process.exit(0)
}

main()
