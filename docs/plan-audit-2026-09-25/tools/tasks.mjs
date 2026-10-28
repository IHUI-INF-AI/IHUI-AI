// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'

const lines = readFileSync('PROJECT_PLAN.md', 'utf8').split(/\r?\n/)

// 进度性/述评性措辞:出现即说明这行不是"从零开始的任务",而是记录在途/受阻/遗留
const ANNOT =
  /（进行中）|⏳|进度|已落|已入库|已产出|已完成|已存在|已修|已做|已改|已补|已接|闭环|未闭环|遗留|待用户|待拍板|待补|刻意|阻塞|紧急|仍在这台|残留|已量|已核|已按|已用|已建|已迁|复核|作废|故意不并|取舍待定|需要用户/

const rows = []
lines.forEach((ln, i) => {
  if (!/^\s*- \[ \]/.test(ln)) return
  const body = ln.replace(/^\s*- \[ \]\s*/, '').trim()
  const idm = body.match(/^(\**)(D\d{1,3}|O\d{1,3}[a-z]?\d*|WP-\d+|H\d)\b/)
  rows.push({ n: i + 1, id: idm ? idm[2] : null, body, annot: ANNOT.test(body) })
})

const seen = new Set()
const uniq = rows.filter((r) => {
  const k = (r.id || '') + '|' + r.body.slice(0, 70)
  if (seen.has(k)) return false
  seen.add(k)
  return true
})

const tasks = uniq.filter((r) => r.id && !r.annot)
const notes = uniq.filter((r) => !r.id && !r.annot)

console.log(`unchecked 去重 ${uniq.length} => 带编号且无进度标注的任务 ${tasks.length} / 无编号且无标注的散记 ${notes.length}\n`)
const key = (id) => {
  const m = id.match(/^(D|O|WP|H)-?(\d+)/)
  return [m[1], Number(m[2])]
}
tasks
  .sort((a, b) => {
    const [ka, na] = key(a.id)
    const [kb, nb] = key(b.id)
    return ka.localeCompare(kb) || na - nb || a.n - b.n
  })
  .forEach((r) => console.log(`${r.id.padEnd(7)} L${String(r.n).padStart(5)}  ${r.body.slice(0, 105)}`))

console.log('\n── 无编号、无标注的散记(需人判是否算任务)──')
notes.forEach((r) => console.log(`  L${String(r.n).padStart(5)}  ${r.body.slice(0, 105)}`))
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
