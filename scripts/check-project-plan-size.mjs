#!/usr/bin/env node
/**
 * PROJECT_PLAN.md 长度守门脚本。
 *
 * 背景: PROJECT_PLAN.md 是项目唯一任务计划文档(AGENTS.md 第 1 节强制规则)。
 * 历史上曾膨胀至 1.88MB(18056 行,200+ 历史条目),导致 AI 单次 Read 即吃满
 * 上下文窗口,模型被迫停止响应(2026-07-19 根因诊断)。
 *
 * 守门策略: 限制 PROJECT_PLAN.md 文件大小不超过 50KB(约 1250 行)。
 *           超过阈值则阻止 commit,强制开发者归档历史条目至 .trae-cn/archive/。
 *
 * 用法: node scripts/check-project-plan-size.mjs
 *   exit 0 = 文件大小合规
 *   exit 1 = 文件超过 50KB,阻止 commit
 */
import { statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const FILE = join(ROOT, 'PROJECT_PLAN.md')
const MAX_BYTES = 50 * 1024 // 50KB 阈值

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

if (!existsSync(FILE)) {
  console.log(`${C.dim}⏭  PROJECT_PLAN.md 不存在,跳过长度检查${C.reset}`)
  process.exit(0)
}

const stats = statSync(FILE)
const sizeKB = (stats.size / 1024).toFixed(2)
const maxKB = (MAX_BYTES / 1024).toFixed(0)

if (stats.size > MAX_BYTES) {
  console.error(`${C.red}❌ PROJECT_PLAN.md 体积超限${C.reset}`)
  console.error(`   当前: ${C.yellow}${sizeKB} KB${C.reset}`)
  console.error(`   阈值: ${C.cyan}${maxKB} KB${C.reset}`)
  console.error('')
  console.error(`${C.yellow}处理方法:${C.reset}`)
  console.error(`  1. 把已完成(✅)的历史条目移动到 ${C.cyan}.trae-cn/archive/${C.reset} 目录`)
  console.error(`  2. 仅保留"当前活跃任务"+"待办"+"项目守门规则速查"`)
  console.error(`  3. 历史归档示例: ${C.dim}mv PROJECT_PLAN.md .trae-cn/archive/PROJECT_PLAN_$(date +%Y%m%d).md${C.reset}`)
  console.error(`     然后新建精简版 PROJECT_PLAN.md`)
  console.error('')
  console.error(`${C.red}背景:${C.reset} PROJECT_PLAN.md 膨胀会导致 AI 上下文窗口撑爆,模型被迫停止响应`)
  process.exit(1)
}

console.log(`${C.green}✅ PROJECT_PLAN.md 体积合规${C.reset} ${C.dim}(${sizeKB} KB / ${maxKB} KB)${C.reset}`)
process.exit(0)
