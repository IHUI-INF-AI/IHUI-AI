#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * check-ignore-todos.mjs — .check-api-routes-ignore.json TODO 标记监控 (warn-only, 2026-07-21 立)
 *
 * 背景:
 *   check-api-routes.mjs 守门脚本已 100% 通过,但 .check-api-routes-ignore.json 是"已知豁免清单",
 *   包含两类条目:
 *     1. **TODO 后端待实装**(如 /api/v1/admin/* 占位 14 处)
 *     2. **守门脚本 bug 标注**(method 推断误报,后端已实装,如 /api/self-media/koubo/* 3 处)
 *
 *   第 1 类条目是"技术债",多 agent 并行开发时容易再次累积,需要主动监控。
 *   第 2 类条目是"已知豁免",守门脚本 bug 修复后可清理。
 *
 * 功能:
 *   1. 扫描 .check-api-routes-ignore.json
 *   2. 统计 TODO 标记数(method === 'GET' + reason 含 '待实装' 的条目)
 *   3. 统计守门 bug 标注数(reason 含 '守门脚本' 的条目)
 *   4. 打印汇总,exit 0 (warn-only,不阻塞)
 *
 * 退出码: 始终 0 (warn-only)
 *
 * 集成位置: 可选挂到 pre-commit(不阻塞)或手动 `pnpm check:routes:ignore`
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

const IGNORE_FILE = resolve(process.cwd(), '.check-api-routes-ignore.json')

function main() {
  let data
  try {
    const raw = readFileSync(IGNORE_FILE, 'utf8')
    data = JSON.parse(raw)
  } catch (e) {
    console.log(`${C.dim}⏭  ${IGNORE_FILE} 不存在或解析失败,跳过${C.reset}`)
    process.exit(0)
  }

  const items = data?.ignorePatterns ?? []
  if (!Array.isArray(items) || items.length === 0) {
    console.log(`${C.green}✅ ignore 文件为空${C.reset}`)
    process.exit(0)
  }

  // 第 1 类: TODO 后端待实装(reason 含 "待实装")
  const todoItems = items.filter(
    (it) => typeof it.reason === 'string' && it.reason.includes('待实装'),
  )
  // 第 2 类: 守门脚本 bug 标注(reason 含 "守门脚本")
  const guardBugItems = items.filter(
    (it) => typeof it.reason === 'string' && it.reason.includes('守门脚本'),
  )
  // 其他
  const otherItems = items.filter(
    (it) =>
      !(typeof it.reason === 'string' && (it.reason.includes('待实装') || it.reason.includes('守门脚本'))),
  )

  console.log('')
  console.log(`${C.cyan}${C.bold}📊 check-api-routes-ignore.json 监控报告${C.reset}`)
  console.log(`${C.dim}文件: ${IGNORE_FILE}${C.reset}`)
  console.log('')
  console.log(`总豁免条目: ${C.bold}${items.length}${C.reset}`)
  console.log(`  ${C.yellow}TODO 后端待实装${C.reset}: ${C.yellow}${C.bold}${todoItems.length}${C.reset}`)
  console.log(`  ${C.cyan}守门脚本 bug 标注${C.reset}: ${C.cyan}${C.bold}${guardBugItems.length}${C.reset}`)
  console.log(`  ${C.dim}其他(已知豁免)${C.reset}: ${C.dim}${otherItems.length}${C.reset}`)
  console.log('')

  if (todoItems.length > 0) {
    console.log(`${C.yellow}⚠️  TODO 后端待实装清单 (技术债):${C.reset}`)
    todoItems.forEach((it) => {
      console.log(
        `  ${C.yellow}${it.method}${C.reset} ${C.dim}${it.pathPattern}${C.reset} ${C.dim}— ${it.reason}${C.reset}`,
      )
    })
    console.log('')
  }

  if (guardBugItems.length > 0) {
    console.log(`${C.cyan}ℹ️  守门脚本 bug 标注清单 (非真 404):${C.reset}`)
    guardBugItems.forEach((it) => {
      console.log(
        `  ${C.cyan}${it.method}${C.reset} ${C.dim}${it.pathPattern}${C.reset} ${C.dim}— ${it.reason}${C.reset}`,
      )
    })
    console.log('')
  }

  // 健康度评估
  const healthScore = Math.round(
    ((items.length - todoItems.length) / items.length) * 100,
  )
  const healthColor =
    healthScore >= 80 ? C.green : healthScore >= 50 ? C.yellow : C.red
  console.log(
    `${healthColor}${C.bold}健康度${C.reset}: ${healthColor}${healthScore}%${C.reset} (${C.dim}豁免非 TODO 占比${C.reset})`,
  )
  console.log('')
  console.log(`${C.dim}退出码 0 (warn-only),不阻塞 commit${C.reset}`)
  process.exit(0)
}

main()
