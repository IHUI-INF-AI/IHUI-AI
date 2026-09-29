// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 把落地闸里那两条互相顶账的尺子放在同一次调用里跑,打印**全文**的涉事行 ——
// 「因副本指针有意少带 1 份(每条仍保留 ≥1 份)」与「未存活行:同一行」不可能同时为真,
// 只报截断前缀就永远分不出是哪一条、哪一把尺子错了。
import { execFileSync } from 'node:child_process'
import { gitBinary } from '../../../../scripts/lib/face-reader.mjs'
import { DUP_POINTER_RE } from '../../../../scripts/lib/plan-task-index.mjs'
import * as U from '../../../../scripts/union-converge.mjs'

const GIT = gitBinary()
const root = 'D:/IHUI-AI'
const git = (args) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', root, ...args], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    windowsHide: true,
    timeout: 240000,
  })
const OURS = process.argv[2]
const THEIRS = process.argv[3]
const DOC = 'PROJECT_PLAN.md'
const BASE = git(['merge-base', OURS, THEIRS]).trim()
const ours = git(['show', `${OURS}:${DOC}`])
const theirs = git(['show', `${THEIRS}:${DOC}`])
const base = git(['show', `${BASE}:${DOC}`])
const ma = U.moveAwareForDoc(DOC, ours, theirs, OURS, root)
const merged = U.unionLines(ours, theirs, base, ma.suppress)
const c = (t) => {
  const m = new Map()
  for (const l of String(t).split('\n')) m.set(l, (m.get(l) || 0) + 1)
  return m
}
const cb = c(base)
const co = c(ours)
const ct = c(theirs)
const cm = c(merged)
console.log(
  `suppress 条目 ${ma.suppress ? ma.suppress.size : 0} / 未判定块 ${ma.undetermined.length}` +
    ` / 抑制行数 ${ma.stats.suppressedLines}`,
)
const caps = U.liveDocPointerCaps(base, [ours, theirs], merged)
console.log(`\n=== liveDocPointerCaps:`)
for (const e of (caps && caps.capped) || []) {
  console.log(`  少带 ${e.dropped} 份 | 带指针=${DUP_POINTER_RE.test(e.line)} | 面上重数 base=${cb.get(e.line) || 0} ours=${co.get(e.line) || 0} theirs=${ct.get(e.line) || 0} merged=${cm.get(e.line) || 0}`)
  console.log(`     全文:${String(e.line).slice(0, 400)}`)
}
const la = U.lostAddedLines(base, ours, theirs, merged)
const lb = U.lostAddedLines(base, theirs, ours, merged)
for (const [label, L] of [['本侧独有', la], ['对侧独有', lb]]) {
  console.log(`\n=== lostAddedLines(${label}): list=${(L.list || []).length} pointerCapped=${(L.pointerCapped || []).length}`)
  for (const e of (L.list || []).slice(0, 8)) {
    console.log(`   未存活 需 ${e.need} 实得 ${e.have} | 带指针=${DUP_POINTER_RE.test(e.line)} | merged=${cm.get(e.line) || 0}`)
    console.log(`     全文:${String(e.line).slice(0, 400)}`)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
