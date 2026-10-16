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
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

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
  // 出路必须**实测**,不许印一句"跑那个命令"。2026-09-25 抓到本门正给着一条跑不通的出路:
  // 它原文建议"把已完成(✅)历史条目归档到 .ihui-agent/archive/",而当场跑
  // `node scripts/archive-completed-tasks.mjs --all --dry-run` 报的是
  // 「无可归档的已完成任务条目 (共 0 个已完成,阈值 all)」—— 归档器按 §1 只搬
  // `### XXX(已完成 ✅ …)` **标题条目**,而本文件今天的体积主要来自
  // `- [x] ✅ … **G-xxx/O-xx**` 这类**登记 bullet**(§1 禁止删、守门 71 防丢),不在它射程内。
  // ⇒ 现在去问归档器本身,把它那一行原样打出来;问不到就明写"未判定",绝不印未经我验证的建议。
  // (同型先例:守门 check-c-drive-pollution 曾提示一个根 package.json 里根本不存在的脚本名。)
  // 2026-10-16 存档机制退役(机主令:完成即删):旧"移入 .ihui-agent/archive/"出路已死,
  // 本门不再提供归档出路 —— 出路 = 完成行直接删 + 长注记按"台账只记真工作"收短,人工决定。

  // 2026-08-19 立:warn-only 违规显式 exit 1,让 guardian-runner 计入 warned 计数
  // (原本 exit 0 会让违规被 guardian-runner 静默吞掉,统计不可信)
  process.exit(1)
}

console.log(`${C.green}✅ PROJECT_PLAN.md 体积信息${C.reset} ${C.dim}(${sizeKB} KB / 软参考 ${warnKB} KB, warn-only)${C.reset}`)
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
