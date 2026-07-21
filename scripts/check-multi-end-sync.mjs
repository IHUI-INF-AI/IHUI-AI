#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * 多端同步开发守门 (warn-only, 2026-07-21 立)
 *
 * 触发场景: AGENTS.md §9 升级后, "每一个任务默认必须本项目所有端程序同步开发匹配连通好".
 * 但 agent 可能在执行单端任务时遗漏跨端同步, 把"应该跨端"的任务误判为"平台独占".
 *
 * 检测启发式 (warn-only, 不阻塞 commit):
 *   1. staged 文件触及 0 端 (纯 scripts/.husky/docs/AGENTS.md/PROJECT_PLAN.md 等)
 *      → pass (默认豁免, 守门脚本/文档/配置类天然不属 8 端)
 *   2. staged 文件触及 packages/* (跨端共享代码: types/ui/database/auth/config/sdk)
 *      → 检查 PROJECT_PLAN.md 当前活跃任务条目是否标注 "共享包" / "packages/*"
 *        - 未标注 → warn (共享代码改动需跨端验证引用一致)
 *        - 已标注 → pass
 *   3. staged 文件触及 ≥2 端 → pass (满足全端连通)
 *   4. staged 文件触及 1 端 → 检查 PROJECT_PLAN.md 当前活跃任务条目标注:
 *        - 标注 "跨端:仅 X 端" / "平台独占" / "X 独占" / "单端文档" / "单端脚本" → pass
 *        - 未标注 → warn (提示补标注, 否则按 §9 应跨端同步)
 *
 * 8 端映射 (AGENTS.md §9):
 *   apps/web          → web
 *   apps/api          → api
 *   apps/ai-service   → ai-service
 *   apps/desktop      → desktop
 *   apps/extension    → extension
 *   apps/mobile-rn    → mobile-rn
 *   apps/miniapp-taro → miniapp-taro
 *   apps/cli          → cli
 *
 * 退出码: 始终 0 (warn-only, 不阻塞 commit)
 * 集成位置: .husky/pre-commit 第 21 项
 */
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = process.cwd()

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

/** 8 端目录 → 端名映射 */
const END_MAP = {
  'apps/web': 'web',
  'apps/api': 'api',
  'apps/ai-service': 'ai-service',
  'apps/desktop': 'desktop',
  'apps/extension': 'extension',
  'apps/mobile-rn': 'mobile-rn',
  'apps/miniapp-taro': 'miniapp-taro',
  'apps/cli': 'cli',
}

const ALL_ENDS = Object.values(END_MAP)

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

/** 文件归类: 返回 { end: string|null, isShared: boolean, isExempt: boolean } */
function classifyFile(file) {
  // 8 端目录优先匹配
  for (const [prefix, end] of Object.entries(END_MAP)) {
    if (file.startsWith(prefix + '/') || file === prefix) {
      return { end, isShared: false, isExempt: false }
    }
  }
  // 跨端共享包
  if (file.startsWith('packages/')) {
    return { end: null, isShared: true, isExempt: false }
  }
  // 豁免目录 (非端代码: 守门脚本/钩子/文档/配置/归档)
  const exemptPrefixes = [
    'scripts/',
    '.husky/',
    '.trae-cn/',
    '.github/',
    'docs/',
    '.vscode/',
    '.idea/',
  ]
  if (exemptPrefixes.some((p) => file.startsWith(p))) {
    return { end: null, isShared: false, isExempt: true }
  }
  // 根目录文件 (AGENTS.md / PROJECT_PLAN.md / README* / package.json / pnpm-lock.yaml / tsconfig 等)
  if (!file.includes('/')) {
    return { end: null, isShared: false, isExempt: true }
  }
  // 其他未识别目录 (如 apps/ 下非 8 端的子目录)
  return { end: null, isShared: false, isExempt: true }
}

/** 读取 PROJECT_PLAN.md 当前活跃任务条目 (第一个未完成 ### 标题到下一个 ### 之间的内容)
 *  逻辑: 从文件开头找第一个 "### " 开头的标题行, 取该行 + 后续正文直到下一个 "### " 或文件结束
 *  如果第一个 ### 已完成 (标题含 "已完成 ✅"), 跳过找下一个未完成的
 */
function getActiveTaskEntry() {
  try {
    const content = readFileSync(join(ROOT, 'PROJECT_PLAN.md'), 'utf8')
    const lines = content.split('\n')
    const entries = []
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      if (line.startsWith('### ')) {
        const title = line
        const body = []
        i++
        while (i < lines.length && !lines[i].startsWith('### ')) {
          body.push(lines[i])
          i++
        }
        entries.push({ title, body: body.join('\n') })
      } else {
        i++
      }
    }
    // 找第一个未完成的 (标题不含 "已完成 ✅")
    const active = entries.find((e) => !e.title.includes('已完成') && !e.title.includes('✅'))
    return active || null
  } catch {
    return null
  }
}

/** 检查任务条目是否标注了平台独占 / 单端 / 仅 X 端 */
function isTaskLabeledSingleEnd(entry, endName) {
  if (!entry) return false
  const text = entry.title + '\n' + entry.body
  // 通用平台独占标注
  if (/平台独占/.test(text)) return true
  if (/单端文档|单端脚本|单端\s*配置/.test(text)) return true
  // "跨端:仅 X 端" / "跨端：仅 X 端"
  const onlyMatch = text.match(/跨端\s*[:：]\s*仅\s*(\S+?)\s*端/)
  if (onlyMatch) {
    // 仅当标注的端 == 当前 staged 触及的端
    if (endName && onlyMatch[1].includes(endName)) return true
    // 如果没指定 endName (如 packages/* 共享包场景), 只要存在标注就视为标注了
    if (!endName) return true
  }
  // "X 独占页面" / "X 独占功能" / "X 独占任务" / "X 独占"
  if (endName) {
    const exclusiveRegex = new RegExp(`${endName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*独占`)
    if (exclusiveRegex.test(text)) return true
  }
  return false
}

/** 检查任务条目是否标注了共享包 (packages/* only) */
function isTaskLabeledSharedPackage(entry) {
  if (!entry) return false
  const text = entry.title + '\n' + entry.body
  if (/共享包|packages\/\*|packages\s*only|跨端共享/.test(text)) return true
  return false
}

function main() {
  const staged = getStagedFiles()

  if (staged.length === 0) {
    console.log(`${C.dim}⏭  多端同步守门(无 staged 文件, 跳过)${C.reset}`)
    process.exit(0)
  }

  // 分类
  const endSet = new Set()
  const sharedFiles = []
  const exemptFiles = []
  const endFiles = new Map() // end → file[]
  for (const f of staged) {
    const cls = classifyFile(f)
    if (cls.end) {
      endSet.add(cls.end)
      if (!endFiles.has(cls.end)) endFiles.set(cls.end, [])
      endFiles.get(cls.end).push(f)
    } else if (cls.isShared) {
      sharedFiles.push(f)
    } else if (cls.isExempt) {
      exemptFiles.push(f)
    }
  }

  const endCount = endSet.size

  // 场景 1: 0 端 + 0 共享 (纯豁免目录)
  if (endCount === 0 && sharedFiles.length === 0) {
    console.log(
      `${C.dim}⏭  多端同步守门(${staged.length} 文件均为非端代码: scripts/.husky/docs/配置, 豁免)${C.reset}`,
    )
    process.exit(0)
  }

  // 场景 2: 触及 packages/* (跨端共享代码)
  if (sharedFiles.length > 0 && endCount === 0) {
    const entry = getActiveTaskEntry()
    const labeled = isTaskLabeledSharedPackage(entry)
    if (labeled) {
      console.log(
        `${C.dim}⏭  多端同步守门(staged 仅 packages/* 共享代码, 任务已标注共享包, pass)${C.reset}`,
      )
      process.exit(0)
    }
    console.log('')
    console.log(`${C.yellow}${C.bold}⚠️  多端同步守门: 共享包改动未标注跨端验证 (warn-only)${C.reset}`)
    console.log(`${C.dim}依据: AGENTS.md §9 多端同步开发强制规则${C.reset}`)
    console.log('')
    console.log(
      `${C.yellow}staged 含 ${sharedFiles.length} 个 packages/* 文件, 未触及任何端代码:${C.reset}`,
    )
    sharedFiles.slice(0, 8).forEach((f) => console.log(`  ${C.dim}+ ${f}${C.reset}`))
    if (sharedFiles.length > 8) {
      console.log(`  ${C.dim}... 还有 ${sharedFiles.length - 8} 个${C.reset}`)
    }
    console.log('')
    console.log(`${C.bold}风险:${C.reset}`)
    console.log(
      `${C.dim}  packages/types / packages/ui / packages/database / packages/auth 等是跨端共享代码,${C.reset}`,
    )
    console.log(
      `${C.dim}  改动后必须验证 8 端 (web+api+ai-service+desktop+extension+mobile-rn+miniapp-taro+cli)${C.reset}`,
    )
    console.log(`${C.dim}  引用一致, 任一端引用断裂 → 运行时类型错 / 模块缺失.${C.reset}`)
    console.log('')
    console.log(`${C.bold}修复建议:${C.reset}`)
    console.log(
      `  ${C.dim}若确属共享包单端改动 (如新增 export 给某端用), 在 PROJECT_PLAN.md 当前任务条目${C.reset}`,
    )
    console.log(`  ${C.dim}补标注:${C.reset}`)
    console.log(`    ${C.cyan}跨端:共享包 only (类型/UI/database/auth 单包改动, 8 端引用已验证一致)${C.reset}`)
    console.log(`  ${C.dim}或补完整跨端验证证据 (列出各端 typecheck 输出).${C.reset}`)
    console.log('')
    process.exit(0)
  }

  // 场景 3: 触及 ≥2 端 → pass (满足全端连通, 不警告)
  if (endCount >= 2) {
    const endList = Array.from(endSet).join(', ')
    console.log(
      `${C.dim}⏭  多端同步守门(staged 触及 ${endCount} 端: ${endList}, 满足跨端连通)${C.reset}`,
    )
    process.exit(0)
  }

  // 场景 4: 触及 1 端 → 检查 PROJECT_PLAN.md 当前活跃任务条目标注
  if (endCount === 1) {
    const endName = Array.from(endSet)[0]
    const entry = getActiveTaskEntry()
    const labeled = isTaskLabeledSingleEnd(entry, endName)

    if (labeled) {
      console.log(
        `${C.dim}⏭  多端同步守门(staged 仅 ${endName} 端, PROJECT_PLAN.md 当前任务已标注平台独占, pass)${C.reset}`,
      )
      process.exit(0)
    }

    const files = endFiles.get(endName) || []
    console.log('')
    console.log(
      `${C.yellow}${C.bold}⚠️  多端同步守门: 单端改动未标注平台独占 (warn-only)${C.reset}`,
    )
    console.log(`${C.dim}依据: AGENTS.md §9 多端同步开发强制规则 (2026-07-21 升级)${C.reset}`)
    console.log('')
    console.log(
      `${C.yellow}staged 仅触及 ${C.bold}${endName}${C.reset}${C.yellow} 端 ${files.length} 个文件, 未标注平台独占:${C.reset}`,
    )
    files.slice(0, 8).forEach((f) => console.log(`  ${C.dim}+ ${f}${C.reset}`))
    if (files.length > 8) {
      console.log(`  ${C.dim}... 还有 ${files.length - 8} 个${C.reset}`)
    }
    console.log('')
    console.log(`${C.bold}规则 (AGENTS.md §9):${C.reset}`)
    console.log(
      `${C.dim}  每一个任务开发时, 默认必须本项目所有端程序同步开发匹配连通好,${C.reset}`,
    )
    console.log(`${C.dim}  不限于"影响 API 契约/共享类型/schema/共享 UI/业务功能"的改动才同步.${C.reset}`)
    console.log(
      `${C.dim}  平台独占豁免必须在 PROJECT_PLAN.md 任务条目显式标注, 未标注按全端同步执行.${C.reset}`,
    )
    console.log('')
    if (entry) {
      console.log(`${C.bold}当前活跃任务 (PROJECT_PLAN.md):${C.reset}`)
      console.log(`  ${C.cyan}${entry.title.replace(/^###\s+/, '')}${C.reset}`)
    } else {
      console.log(`${C.bold}当前活跃任务:${C.reset} ${C.dim}(未找到 PROJECT_PLAN.md 未完成任务条目)${C.reset}`)
    }
    console.log('')
    console.log(`${C.bold}修复建议 (二选一):${C.reset}`)
    console.log(`  ${C.magenta}A.${C.reset} ${C.dim}若确属 ${endName} 端独占, 在 PROJECT_PLAN.md 当前任务条目补标注:${C.reset}`)
    console.log(`    ${C.cyan}跨端:仅 ${endName} 端 (${endName} 独占页面/功能/任务)${C.reset}`)
    console.log(`    ${C.dim}或: 平台独占 (${endName} ...)${C.reset}`)
    console.log(`  ${C.magenta}B.${C.reset} ${C.dim}若应跨端同步, 补齐其他端代码改动 + 跨端 typecheck/build/test 齐绿${C.reset}`)
    console.log(
      `    ${C.dim}其他端: ${ALL_ENDS.filter((e) => e !== endName).join(' / ')}${C.reset}`,
    )
    console.log('')
    console.log(
      `${C.dim}warn-only 不阻塞 commit, 但请在交付报告中明确跨端处理结论.${C.reset}`,
    )
    console.log('')
    process.exit(0)
  }

  // 兜底: 1 端 + 共享包 → 视为跨端, pass
  if (endCount >= 1 && sharedFiles.length > 0) {
    const endList = Array.from(endSet).join(', ')
    console.log(
      `${C.dim}⏭  多端同步守门(staged 触及 ${endCount} 端: ${endList} + ${sharedFiles.length} 个共享包, 视为跨端, pass)${C.reset}`,
    )
    process.exit(0)
  }

  process.exit(0)
}

main()
