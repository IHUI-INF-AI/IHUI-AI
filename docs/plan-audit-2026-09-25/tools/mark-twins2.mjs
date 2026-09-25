// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync, writeFileSync } from 'node:fs'

const F = 'PROJECT_PLAN.md'
const raw = readFileSync(F, 'utf8')
const eol = raw.includes('\r\n') ? '\r\n' : '\n'
const lines = raw.split(/\r?\n/)

const IDAT = /(?:\*\*)?(D\d{1,3}|O\d{1,3}[a-z]?\d*|WP-\d+)(?:\b|(?=[^0-9]))/
const body = (l) => l.replace(/^\s*- \[[x ]\]\s*/, '').replace(/^（进行中）\s*/, '').trim()
// 归一:剥掉复选框与全角括号标记后再比"正题是否逐字存活"(剥前缀是必须的 —— 带 `[ ]` 去比 `[x]` 永不包含)
const squash = (s) => s.replace(/\s+/g, '')

const open = new Map()
const done = new Map()
lines.forEach((l, i) => {
  const m = l.match(IDAT)
  if (!m || !/^\s*- \[[x ]]/.test(l)) return
  const box = /^\s*- \[x\]/.test(l) ? done : open
  if (!box.has(m[1])) box.set(m[1], [])
  box.get(m[1]).push({ n: i + 1, t: body(l) })
})

let marked = 0
const report = []
for (const [id, opens] of open) {
  const dones = done.get(id) || []
  for (const o of opens) {
    const so = squash(o.t)
    if (so.length < 20) {
      report.push(`短行跳过 ${id}@L${o.n}`)
      continue
    }
    const hit = dones.find((d) => squash(d.t).includes(so))
    if (!hit) continue
    const i = o.n - 1
    if (lines[i].includes('[O60 判:裸副本]')) {
      report.push(`已标注 ${id}@L${o.n}`)
      continue
    }
    lines[i] =
      lines[i].replace(/\s+$/, '') +
      ` **[O60 判:裸副本]** 本行正题逐字存活于 L${hit.n} 的同编号登记(那行已勾,本行没勾) ⇒ 不重复计账、勿照本行派单;该勾选态是否属实以 O60 的 HEAD 复跑结论为准,欠项照 O60 三态清单追。`
    marked++
    report.push(`标注 ${id}@L${o.n} -> L${hit.n}`)
  }
}
writeFileSync(F, lines.join(eol), 'utf8')
console.log(`标注 ${marked} 行`)
console.log(report.filter((r) => r.startsWith('标注')).join('\n') || '(无)')
const again = readFileSync(F, 'utf8').split(/\r?\n/)
console.log('回读首条:', again.find((l) => l.includes('[O60 判:裸副本]'))?.slice(0, 100) || '(无)')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
