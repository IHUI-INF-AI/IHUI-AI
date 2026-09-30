#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * guard-status-where.mjs —— 结算/状态写点守卫(出处 b76-12e G-998159,新增文件交付,尚未接提交链)。
 *
 * 判据(票面原文):`git grep -n "set({ status" -- apps/api/src/db` 的每个命中,
 * 其后 3 行内必须出现 `status` 于 where 谓词,或显式注明无需守卫的理由
 * (注释标记 `status-guard-exempt: <理由>`,写在 set 行当行或其后 3 行内)。
 *
 * 背景:条件 UPDATE + 影响行数判失败 = "终态不可逆出"纪律(对照 order-queries.ts
 * cancelPayment / agents-queries.ts settleSettlement)。本脚本只做棘轮式报告:
 * 退出码 0 = 全部命中合规;1 = 存在裸写点(列出 file:line)。
 *
 * 用法:
 *   node scripts/guard-status-where.mjs             # 判当前工作树
 *   node scripts/guard-status-where.mjs --staged    # 判索引(git grep --cached)
 *
 * 注意:子进程 stdio 显式 ['ignore','pipe','pipe'] —— 本机交互会话 Node 子进程
 * stdin 管道 EBUSY(见 skill: ihui-spawn-ebusy-fix),不消费 stdin 一律 ignore。
 * 接提交链前须在真仓 HEAD 面现跑确认结论可接受(当前存量命中多为此前遗留裸写点,
 * 直接挂 blocking 会造成恒红门,故先以报告形态交付,由主会话决定棘轮节奏)。
 */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PATHSPEC = 'apps/api/src/db'
const WINDOW = 3 // set 行之后检查的行数(票面:其后 3 行内)
const EXEMPT_RE = /status-guard-exempt[:：]\s*\S+/

function gitGrep(cached) {
  const args = ['grep', '-n', '-F', 'set({ status', '--', PATHSPEC]
  if (cached) args.splice(1, 0, '--cached')
  const res = spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'], // stdin EBUSY 规避:不消费 stdin,禁默认全管道
  })
  if (res.status === 1) return [] // grep 无命中
  if (res.error || (res.status !== 0 && res.status !== 1)) {
    console.error(`[guard-status-where] git grep 失败: ${res.error?.message ?? res.stderr}`)
    process.exit(2)
  }
  return res.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^([^:]+):(\d+):(.*)$/)
      if (!m) return null
      return { file: m[1], line: Number(m[2]), text: m[3] }
    })
    .filter(Boolean)
}

function checkHit(hit) {
  const lines = readFileSync(join(ROOT, hit.file), 'utf8').split(/\r?\n/)
  const windowLines = lines.slice(hit.line, hit.line + WINDOW) // 其后 3 行
  const windowText = windowLines.join('\n')
  if (EXEMPT_RE.test(hit.text) || EXEMPT_RE.test(windowText)) return 'exempt'
  // where 谓词里出现 status:set 行后 3 行内同时见 where 构造与 status 列引用
  if (/status/.test(windowText) && /where|and\(|eq\(|ne\(|inArray|notInArray/.test(windowText)) {
    return 'guarded'
  }
  return 'bare'
}

const cached = process.argv.includes('--staged')
const hits = gitGrep(cached)
const violations = []
for (const hit of hits) {
  const verdict = checkHit(hit)
  if (verdict === 'bare') violations.push(hit)
}

console.log(`[guard-status-where] 扫描面 ${PATHSPEC},命中 ${hits.length} 处 .set({ status ...`)
for (const v of violations) console.log(`  裸写点(无 status 谓词/无豁免注记): ${v.file}:${v.line}`)
if (violations.length > 0) {
  console.error(
    `[guard-status-where] FAIL: ${violations.length} 处裸写点。` +
      '修法 = where 加 status 守卫(终态集合用 notInArray/ne),或注明 `status-guard-exempt: <理由>`。',
  )
  process.exit(1)
}
console.log('[guard-status-where] OK: 全部命中带 status 谓词或显式豁免')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
