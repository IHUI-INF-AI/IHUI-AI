#!/usr/bin/env node
/**
 * PROJECT_PLAN.md 长度守门脚本(warn-only,2026-07-23 用户规则解除阻塞)。
 *
 * 背景: PROJECT_PLAN.md 是项目唯一任务计划文档(AGENTS.md 第 1 节强制规则)。
 * 历史上曾膨胀至 1.88MB(18056 行,200+ 历史条目),导致 AI 单次 Read 即吃满
 * 上下文窗口,模型被迫停止响应(2026-07-19 根因诊断),当时设立 50KB 阻塞阈值。
 *
 * 调整: 2026-07-23 用户反馈"50K 限制会导致计划缺失不详细",解除阻塞,
 *       改为 warn-only 模式 —— 始终 exit 0,仅打印体积信息供能见度参考。
 *       保留 500KB 极端阈值作软参考(不阻塞),超过时打印更醒目的 warn。
 *
 * 用法: node scripts/check-project-plan-size.mjs
 *   exit 0 = 始终通过(warn-only,不阻塞 commit)
 */
import { statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const FILE = join(ROOT, 'PROJECT_PLAN.md')
const WARN_BYTES = 500 * 1024 // 500KB 软参考阈值(仅 warn,不阻塞)

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
const warnKB = (WARN_BYTES / 1024).toFixed(0)

if (stats.size > WARN_BYTES) {
  console.warn(`${C.yellow}⚠️  PROJECT_PLAN.md 体积偏大(warn-only,不阻塞)${C.reset}`)
  console.warn(`   当前: ${C.yellow}${sizeKB} KB${C.reset}`)
  console.warn(`   软参考: ${C.cyan}${warnKB} KB${C.reset}`)
  console.warn(`   建议: 把已完成(✅)历史条目归档到 ${C.cyan}.trae-cn/archive/${C.reset} 以保持 AI 可读性`)
  process.exit(0)
}

console.log(`${C.green}✅ PROJECT_PLAN.md 体积信息${C.reset} ${C.dim}(${sizeKB} KB / 软参考 ${warnKB} KB, warn-only)${C.reset}`)
process.exit(0)
