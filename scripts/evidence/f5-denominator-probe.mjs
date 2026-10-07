// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 一次性探针:F5 的读数到底按"行"还是按"标记个数",以及 14 条残差出在哪个量纲
// 2026-10-07(G-998191)git 出口收口:本探针唯一的 git 派生(`git show <rev>:PROJECT_PLAN.md`)
// 由 `execFileSync('git', …)` 裸调用迁到取材层 `scripts/lib/face-reader.mjs` 的 `gitRaw`
// —— 仓内逐文件迁移的存量债(判据在 `scripts/tests/face-reader.test.mjs` 的
// `BARE_GIT_BASELINE`,只减不增)。行为面对照:
//   · 绝对路径 git + `-c safe.directory=*` + windowsHide 由层给足(旧调用只自带 safe.directory);
//   · stdio:层在不带 input 时写死 `['ignore','pipe','pipe']`(face-reader.mjs:94),与旧调用
//     显式传的那一档逐字相同(EBUSY 根治注释因此原样成立);quotepath 层强制 false,
//     `git show` 吐的是文件内容不经路径 quoting ⇒ 无可观察差异;
//   · maxBuffer 旧 `1 << 28` 显式保留(层默认 64MB 不够本探针自报的余量口径,照旧给 256MB);
//   · timeout 旧**无上界**,层给 60_000 ⇒ 净收益(PROJECT_PLAN.md 秒级返回,无界挂起不可能再发生);
//   · 锚点:旧调用不带 `-C`,靠 cwd 恰在仓根;层按 `gitRaw(args, root)` 强制 `-C <root>`,
//     故按本仓惯例从 import.meta.url 锚仓根 —— 从任意目录调用都成立,是收窄不是变更。
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gitRaw } from '../lib/face-reader.mjs'
import { auditPlan } from '../lib/plan-task-index.mjs'
import { MERGE_NOTE_RE, DUP_POINTER_RE } from '../lib/plan-task-index.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SHOW_TIMEOUT_MS = 60_000
const g = (args) => gitRaw(args, ROOT, { timeout: SHOW_TIMEOUT_MS, maxBuffer: 1 << 28 })
const rev = process.argv[2]
const t = g(['show', `${rev}:PROJECT_PLAN.md`])
const lines = t.split('\n')
const lineNoteRe = new RegExp(MERGE_NOTE_RE.source)
const noteLines = lines.filter((l) => lineNoteRe.test(l))
const globalRe = new RegExp(MERGE_NOTE_RE.source, 'g')
const markerTotal = lines.reduce((s, l) => s + (l.match(globalRe) || []).length, 0)
const a = auditPlan(t)
console.log('auditPlan.counts.mergeNotes = ' + a.counts.mergeNotes)
console.log('含注记的行数 = ' + noteLines.length)
console.log('标记总数(全局匹配) = ' + markerTotal)
console.log('DUP_POINTER 命中的注记行 = ' + noteLines.filter((l) => new RegExp(DUP_POINTER_RE.source).test(l)).length)
const multi = lines.filter((l) => (l.match(globalRe) || []).length > 1)
console.log('一行带 ≥2 枚注记的行数 = ' + multi.length)
if (multi.length) console.log('样例: ' + multi[0].slice(0, 120))
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
