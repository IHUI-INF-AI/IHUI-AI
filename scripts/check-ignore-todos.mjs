#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
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
import { pathToFileURL } from 'node:url'

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

// ─── 判据单元(AGENTS.md §22c:唯一真相,由文件末尾 __test__ 暴露给镜像测试) ───
// 第 1 类关键词: TODO 后端待实装
const TODO_KEYWORD = '待实装'
// 第 2 类关键词: 守门脚本 bug 标注
const GUARD_BUG_KEYWORD = '守门脚本'

// 第 1 类: TODO 后端待实装(reason 含 "待实装")
function isTodoItem(it) {
  return typeof it.reason === 'string' && it.reason.includes(TODO_KEYWORD)
}

// 第 2 类: 守门脚本 bug 标注(reason 含 "守门脚本")
function isGuardBugItem(it) {
  return typeof it.reason === 'string' && it.reason.includes(GUARD_BUG_KEYWORD)
}

// 其他(已知豁免): 两类关键词都不含
function isOtherItem(it) {
  return !isTodoItem(it) && !isGuardBugItem(it)
}

// 健康度: 豁免中非 TODO 条目占比(0-100 整数)
function computeHealthScore(items, todoItems) {
  return Math.round(((items.length - todoItems.length) / items.length) * 100)
}

async function main() {
  let data
  try {
    const raw = readFileSync(IGNORE_FILE, 'utf8')
    data = JSON.parse(raw)
  } catch (_e) {
    console.log(`${C.dim}⏭  ${IGNORE_FILE} 不存在或解析失败,跳过${C.reset}`)
    process.exit(0)
  }

  const items = data?.ignorePatterns ?? []
  if (!Array.isArray(items) || items.length === 0) {
    console.log(`${C.green}✅ ignore 文件为空${C.reset}`)
    process.exit(0)
  }

  // 第 1 类: TODO 后端待实装(reason 含 "待实装")
  const todoItems = items.filter(isTodoItem)
  // 第 2 类: 守门脚本 bug 标注(reason 含 "守门脚本")
  const guardBugItems = items.filter(isGuardBugItem)
  // 其他
  const otherItems = items.filter(isOtherItem)

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
  const healthScore = computeHealthScore(items, todoItems)
  const healthColor =
    healthScore >= 80 ? C.green : healthScore >= 50 ? C.yellow : C.red
  console.log(
    `${healthColor}${C.bold}健康度${C.reset}: ${healthColor}${healthScore}%${C.reset} (${C.dim}豁免非 TODO 占比${C.reset})`,
  )
  console.log('')
  console.log(`${C.dim}退出码 0 (warn-only),不阻塞 commit${C.reset}`)
  process.exit(0)
}

// AGENTS.md §22d 双形态入口守卫:CLI 直跑才执行 main();被 import(镜像测试等)时零副作用。
// 用 pathToFileURL 比对而非字符串拼接,因 Windows 反斜杠路径永远匹配不上手搓的 file:/// 串。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    // 脚本自身异常 = 2(warn-only 门体也不得把"自身崩了"记为通过)
    console.error(`${C.red}✗${C.reset} 脚本自身异常(不记为通过):${e?.message ?? e}`)
    process.exit(2)
  })
}

// AGENTS.md §22c 判据唯一真相:镜像测试从这里取分类判据,不再自抄一份
export const __test__ = {
  IGNORE_FILE,
  TODO_KEYWORD,
  GUARD_BUG_KEYWORD,
  isTodoItem,
  isGuardBugItem,
  isOtherItem,
  computeHealthScore,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
