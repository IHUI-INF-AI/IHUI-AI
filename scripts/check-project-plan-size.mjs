#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


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
  // 出路必须"跑得到",不许印一句跑不通的旧话(AGENTS.md §0.8;可整改性准入 §5e-1)。
  // 2026-09-25 抓到旧本门建议"把已完成(✅)历史条目归档到 .ihui-agent/archive/",而当场跑
  // `node scripts/archive-completed-tasks.mjs --all --dry-run` 报「无可归档的已完成任务条目 (共 0 个)」
  // —— 归档器按 §1 只搬 `### 标题(已完成 ✅)` 条目,登记 bullet 不在射程 ⇒ 那句是跑不通的死路。
  // 2026-10-16 存档机制整体退役(机主令"完成即删"):归档器 archive-completed-tasks / 守门 13c /
  // pnpm archive 已拆除(实测 HEAD 与磁盘皆无),`.ihui-agent/archive/` 不再承接台账存料 ⇒
  // 本门不再探测、也不再让用户去跑已退役的归档器(印一句跑不通的旧话 = §0.8 禁止)。
  // ⇒ 现状唯一可执行出路:完成(✅)行直接删除(不留档);逐字节相同且未带指针的未勾行走真实存在的
  // `plan-tasks-merge.mjs --fold-identical-open-rows`(默认只出报告,确认后再 --commit)。人工决定、不阻塞。
  console.warn(
    `   出路(现状·可执行): 完成(✅)行直接删除(2026-10-16 机主令"完成即删",不留档、不归档;` +
      `旧"移入 .ihui-agent/archive/"那条死路已随归档器退役作废)。` +
      `逐字节相同且未带指针的未勾行用 \`node scripts/plan-tasks-merge.mjs --fold-identical-open-rows\`(默认只出报告,确认后再加 --commit)。`
  )
  // 2026-08-19 立:warn-only 违规显式 exit 1,让 guardian-runner 计入 warned 计数
  // (原本 exit 0 会让违规被 guardian-runner 静默吞掉,统计不可信)
  process.exit(1)
}

console.log(`${C.green}✅ PROJECT_PLAN.md 体积信息${C.reset} ${C.dim}(${sizeKB} KB / 软参考 ${warnKB} KB, warn-only)${C.reset}`)
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
