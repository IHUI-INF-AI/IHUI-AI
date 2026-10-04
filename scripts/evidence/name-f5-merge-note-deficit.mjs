// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 一次性:把合并"顶掉"的那 30 条归并落账注记点名出来(工具只报总数)
// 用法:在干净检出里跑  node .ihui-agent/tmp/uc/name-f5.mjs <theirs-sha>
import { execFileSync } from 'node:child_process'
import { unionLines } from '../union-converge.mjs'

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf8',
  windowsHide: true,
}).trim()
const g = (args) =>
  execFileSync('git', ['-C', ROOT, ...args], {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    windowsHide: true,
  })

const theirs = process.argv[2]
if (!theirs) {
  console.log('缺 theirs sha')
  process.exit(2)
}
const oursRef = 'HEAD'
const base = g(['merge-base', oursRef, theirs]).trim()
const blob = (rev) => {
  try {
    return g(['show', rev + ':PROJECT_PLAN.md'])
  } catch {
    return ''
  }
}
const oursText = blob(oursRef)
const theirsText = blob(theirs)
const baseText = blob(base)
if (!oursText || !theirsText) {
  console.log('未判定:某一侧取不到 PROJECT_PLAN.md')
  process.exit(2)
}

const noteSet = (t) => {
  const lines = t.split('\n').filter((l) => l.includes('【归并】'))
  return { count: lines.length, lines }
}
const ours = noteSet(oursText)
const theirsN = noteSet(theirsText)
const mergedText = unionLines(oursText, theirsText, baseText)
const mergedN = noteSet(mergedText)

const key = (l) => l.trim().slice(0, 240)
const mult = (arr) => {
  const m = new Map()
  for (const l of arr) m.set(key(l), (m.get(key(l)) || 0) + 1)
  return m
}
const minus = (a, b) => {
  const out = []
  for (const [k, n] of a) {
    const left = n - (b.get(k) || 0)
    for (let i = 0; i < left; i++) out.push(k)
  }
  return out
}

console.log(
  'probe.mergeNotes  ours=' + ours.count + ' theirs=' + theirsN.count + ' merged=' + mergedN.count,
)
console.log('含【归并】标记的行数  ours=' + ours.lines.length + ' theirs=' + theirsN.lines.length + ' merged=' + mergedN.lines.length)

const lostFromOurs = minus(mult(ours.lines), mult(mergedN.lines))
const lostFromTheirs = minus(mult(theirsN.lines), mult(mergedN.lines))
console.log('被顶掉(相对本侧)ours=' + lostFromOurs.length + ' theirs=' + lostFromTheirs.length)
const show = [...lostFromOurs, ...lostFromTheirs].slice(0, 40)
for (const s of show) console.log('· ' + s.slice(0, 200))
if (show.length === 0) console.log('(该口径下没有点名项 ⇒ 差额不在带标记行上,需换维度再看)')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
