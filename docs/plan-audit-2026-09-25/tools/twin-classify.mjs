// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { execFileSync } from 'node:child_process'
const g = (...a) => {
  try {
    return execFileSync('git', ['-c', 'safe.directory=*', ...a], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, windowsHide: true })
  } catch {
    return ''
  }
}
const src = process.argv[2] === '--worktree' ? 'file' : 'head'
const plan = src === 'file' ? (await import('node:fs')).readFileSync('PROJECT_PLAN.md', 'utf8') : g('show', 'HEAD:PROJECT_PLAN.md')
const lines = plan.split('\n')

const TWINS = process.argv[3] ? process.argv[3].split(',') : null
const IDAT = /(?:\*\*)?(D\d{1,3}|O\d{1,3}[a-z]?\d*|WP-\d+)(?:\b|(?=[^0-9]))/
const byId = new Map()
lines.forEach((l, i) => {
  const m = l.match(IDAT)
  if (!m) return
  if (!/^- \[[x ]]/.test(l)) return
  const st = /\[x\]/.test(l) ? 'x' : ' '
  if (!byId.has(m[1])) byId.set(m[1], { open: [], done: [] })
  byId.get(m[1])[st === 'x' ? 'done' : 'open'].push({
    n: i + 1,
    t: l.replace(/^- \[[x ]]\s*(?:（进行中）)?\s*/, '').trim(),
  })
})

const squash = (s) => s.replace(/\s+/g, '').replace(/^[*>-]+/, '')
const twins = [...byId.entries()].filter(([, v]) => v.open.length && v.done.length)
if (TWINS) {
  const keep = new Set(TWINS)
  twins.filter((t) => !keep.has(t[0])).forEach((t) => twins.splice(twins.indexOf(t), 1))
}
console.log(`双态票 ${twins.length} 张(工作树口径=${src === 'file'})\n`)
const buckets = { 裸副本: [], 范围不同: [], 状态相反: [] }
for (const [id, v] of twins) {
  for (const o of v.open) {
    const so = squash(o.t)
    const rel = v.done
      .map((d) => {
        const sd = squash(d.t)
        if (!so.length || !sd.length) return null
        if (sd.includes(so)) return { kind: 'done 含 open 全文', d }
        if (so.includes(sd)) return { kind: 'open 含 done 全文', d }
        return null
      })
      .filter(Boolean)[0]
    if (rel) buckets['裸副本'].push({ id, n: o.n, rel: rel.kind, rn: rel.d.n, len: o.t.length })
    else {
      const near = v.done.map((d) => d).find((d) => jacc(sim(squash(o.t), squash(d.t))) >= 0.6)
      buckets[near ? '范围不同' : '状态相反'].push({ id, n: o.n, len: o.t.length })
    }
  }
}
function sim(a, b) {
  const A = new Set(), B = new Set()
  for (let i = 0; i < a.length - 1; i++) A.add(a.slice(i, i + 2))
  for (let i = 0; i < b.length - 1; i++) B.add(b.slice(i, i + 2))
  return [A, B]
}
function jacc([A, B]) {
  let inter = 0
  for (const t of A) if (B.has(t)) inter++
  return A.size + B.size - inter === 0 ? 0 : inter / (A.size + B.size - inter)
}
for (const [k, arr] of Object.entries(buckets)) {
  console.log(`【${k}】${arr.length} 行: ` + arr.map((x) => `${x.id}@L${x.n}${x.rel ? `(${x.rel}->L${x.rn})` : ''}`).join('  '))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
