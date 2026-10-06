#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
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
import { pathToFileURL } from 'node:url'

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
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      // 返回值被消费(下面 output.split)⇒ stdout 仍须 pipe,只把 stdin 切掉
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
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

// ─── 判据单元(§22c:经下方 __test__ 暴露给镜像测试,测试不得另抄数字/另写一遍分组) ───
// 阈值语义与 2026-07-20 立项时逐字同形,本次改动只把它们命名化,不放宽也不收紧。
const DIR_GATE = 4 // 跨 ≥ 4 个一级子目录即警告
const FILE_GATE = 15 // 大改判据的文件数阈值(严格 > 15)
const BIG_CHANGE_DIR_GATE = 3 // 大改时跨 ≥ 3 个目录即警告
const PREVIEW_LIMIT = 5 // 每组最多展示 5 个文件,其余折叠成"还有 N 个"

/** 判据单元:按一级子目录分组(纯函数,零副作用;保持 Map 插入序 = staged 原序) */
function groupStagedByTopDir(staged) {
  const groups = new Map()
  for (const file of staged) {
    const group = getTopGroup(file)
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group).push(file)
  }
  return groups
}

/** 判据单元:污染裁定(纯函数,零副作用)
 *  启发式 (满足任一即警告):
 *    - 跨 ≥ DIR_GATE 个一级子目录 (单 agent 任务极少跨 4+ 目录)
 *    - 或: 文件数 > FILE_GATE 且跨 ≥ BIG_CHANGE_DIR_GATE 个目录 (大改但跨目录)
 */
function judgePollution(staged) {
  const groups = groupStagedByTopDir(staged)
  const uniqueGroups = groups.size
  const fileCount = staged.length
  const shouldWarn =
    uniqueGroups >= DIR_GATE || (fileCount > FILE_GATE && uniqueGroups >= BIG_CHANGE_DIR_GATE)
  return { groups, uniqueGroups, fileCount, shouldWarn }
}

async function main() {
  const staged = getStagedFiles()

  if (staged.length === 0) {
    console.log(`${C.dim}⏭  staged 污染预警(无 staged 文件, 跳过)${C.reset}`)
    return 0
  }

  // 按一级子目录分组 + 启发式裁定(判据见 judgePollution)
  const { groups, uniqueGroups, fileCount, shouldWarn } = judgePollution(staged)

  if (!shouldWarn) {
    console.log(
      `${C.dim}⏭  staged 污染预警(${fileCount} 文件, ${uniqueGroups} 个目录, 启发式未触发)${C.reset}`,
    )
    return 0
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
    `${C.yellow}检测到 staged 文件 ${fileCount} 个, 跨 ${uniqueGroups} 个一级子目录 (≥ ${DIR_GATE} 或 >${FILE_GATE}+≥${BIG_CHANGE_DIR_GATE})${C.reset}`,
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
    files.slice(0, PREVIEW_LIMIT).forEach((f) => console.log(`    ${C.dim}+ ${f}${C.reset}`))
    if (files.length > PREVIEW_LIMIT) {
      console.log(`    ${C.dim}... 还有 ${files.length - PREVIEW_LIMIT} 个${C.reset}`)
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
  // 2026-08-19 立:warn-only 违规显式 exit 1,让 guardian-runner 计入 warned 计数
  // (原本 exit 0 会让违规被 guardian-runner 静默吞掉,统计不可信;
  //  warn-only 不阻塞 commit,exit 1 仅供统计)
  // G-1058651:该退出码改由 main() 返回,顶层不再裸调 process.exit(import 方不会被击杀)
  return 1
}

// §22d 双形态入口(G-1058651):此前顶层裸跑 main(),而 main() 内有 3 处 process.exit ——
// 镜像测试一旦 import 本模块就会执行 CLI 主流程(实测打印 26 行并 process.exit(1) 击杀宿主)。
// 守卫只决定"何时触发",判据与输出面一字未改;必须经 pathToFileURL():
// Windows 下 process.argv[1] 带反斜杠,手拼 'file:///' 永不相等 ⇒ CLI 永不触发 main ⇒ 静默失控。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => {
      if (code !== 0) process.exit(code)
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

// §22c/§22d(G-1058651):判据单元导出给镜像测试 scripts/tests/check-staged-pollution.test.mjs,
// 测试经进程入口取值,禁止再自抄一份阈值/分组实现。
export const __test__ = {
  DIR_GATE,
  FILE_GATE,
  BIG_CHANGE_DIR_GATE,
  PREVIEW_LIMIT,
  getTopGroup,
  groupStagedByTopDir,
  judgePollution,
  getStagedFiles,
  main,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
