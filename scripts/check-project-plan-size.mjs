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

/**
 * 问归档器本身"现在有什么可归档"—— 只读:`--dry-run` 不写盘、不提交。
 * 路径由**本脚本自身位置**推(§15:不得依赖 cwd、不得硬编码盘符);派生一律带 `windowsHide`
 * (§5b/守门 52:无控制台宿主下派生 node 必弹窗)与 `timeout`(守门 80:热路径 git/node 调用不得无界)。
 * @returns {{ok:boolean, args?:string, line?:string, why?:string}}
 */
function archiverVerdict() {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'archive-completed-tasks.mjs')
  if (!existsSync(script)) return { ok: false, why: '归档器脚本不在位,无法核实' }
  const args = ['--all', '--dry-run']
  try {
    const out = execFileSync(process.execPath, [script, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60_000,
      maxBuffer: 32 << 20,
    })
    const all = String(out || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    // 取**带结论的那一行**,不是最后一行:dry-run 的末行是「⚠ --dry-run 模式,未实际归档」,
    // 拿它当答案就把量级(几条/哪些)丢了 —— 而本门要的正是在不在 0 这一格。
    const line =
      all.find((s) => /可归档的已完成任务条目/.test(s)) ||
      all.find((s) => /无可归档|不存在|跳过/.test(s)) ||
      all[all.length - 1] ||
      ''
    if (!line) return { ok: false, why: '归档器零输出 —— 拿不到结论,不计为已核实' }
    return { ok: true, args: args.join(' '), line }
  } catch (e) {
    // 归档器非零退出时它自己的输出通常仍可读,那种场合仍算"实测到了";彻底跑不起来才判未判定。
    const all = String(e?.stdout || e?.message || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    const text = all.find((s) => /可归档的已完成任务条目/.test(s)) || all[all.length - 1] || ''
    return { ok: false, why: text ? `归档器异常但回了「${text.slice(0, 90)}」` : '归档器跑不起来' }
  }
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
  const v = archiverVerdict()
  if (v.ok) {
    console.warn(`   归档器实测(${v.args}):${C.cyan}${v.line}${C.reset}`)
    console.warn(
      `   机制说明:归档器只移动「### 标题(已完成 ✅)」条目;本文件的增长来自登记 bullet ——` +
        ` §1 规定不得删、守门 71 防丢,所以"再归档"不是本警告的出路。`,
    )
    console.warn(
      `   真正的影响面:体积影响的是 AI 单次读取的上下文预算(2026-07-19 曾因此停响应),` +
        ` 需要瘦身只能按季度把**旧登记段整体**移入 .ihui-agent/archive/ 并在原位置留占位注释 —— 那是人工决定,不是一条命令。`,
    )
  } else {
    console.warn(`   归档器实测:未判定(${v.why})—— 不给你一条我没能验证过的出路`)
  }
  // 2026-08-19 立:warn-only 违规显式 exit 1,让 guardian-runner 计入 warned 计数
  // (原本 exit 0 会让违规被 guardian-runner 静默吞掉,统计不可信)
  process.exit(1)
}

console.log(`${C.green}✅ PROJECT_PLAN.md 体积信息${C.reset} ${C.dim}(${sizeKB} KB / 软参考 ${warnKB} KB, warn-only)${C.reset}`)
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
