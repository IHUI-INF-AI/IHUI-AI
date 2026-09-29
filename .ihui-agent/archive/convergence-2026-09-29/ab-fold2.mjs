// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// A/B:同一份三面输入,分别在"有折叠判据"与"把折叠判据中和"两种口径下比较期望重数,
// 用来回答「G-668 那行没存活,是折叠判据造成的,还是本来就少这一行」。
// 中和只在**探针进程里**做(把 caps 加回期望表),不改磁盘任何文件(那份属于他人在飞)。
import { execFileSync } from 'node:child_process'
import { gitBinary } from '../../../../scripts/lib/face-reader.mjs'
import * as U from '../../../../scripts/union-converge.mjs'

const GIT = gitBinary()
const root = 'D:/IHUI-AI'
const git = (args) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', root, ...args], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    windowsHide: true,
    timeout: 180000,
  })

const OURS = process.argv[2]
const THEIRS = process.argv[3]
const BASE = git(['merge-base', OURS, THEIRS]).trim()
const ours = git(['show', `${OURS}:PROJECT_PLAN.md`])
const theirs = git(['show', `${THEIRS}:PROJECT_PLAN.md`])
const base = git(['show', `${BASE}:PROJECT_PLAN.md`])
console.log(`base=${BASE.slice(0, 11)} ours=${OURS.slice(0, 11)} theirs=${THEIRS.slice(0, 11)}`)

const count = (t) => {
  const m = new Map()
  for (const l of String(t).split('\n')) m.set(l, (m.get(l) || 0) + 1)
  return m
}
const wFold = U.liveDocExpectedCounts(ours, theirs, base, null)
const caps = U.theirsRewriteCaps(ours, theirs, base, null)
const wNoFold = new Map(wFold)
for (const [l, n] of caps) wNoFold.set(l, (wNoFold.get(l) || 0) + n)

const cFold = wFold
const cNoFold = wNoFold
const cOurs = count(ours)
const cTheirs = count(theirs)
const cBase = count(base)

console.log(`caps 命中 ${caps.size} 条(折叠判据本轮打算少带的东西)`)
let shown = 0
for (const [l, n] of caps) {
  if (shown++ >= 12) {
    console.log(`   …其余 ${caps.size - shown} 条未打印`)
    break
  }
  console.log(
    `   [折掉 ${n} 份] base=${cBase.get(l) || 0} ours=${cOurs.get(l) || 0} theirs=${cTheirs.get(l) || 0}` +
      ` → 折后=${cFold.get(l) || 0} / 不折=${cNoFold.get(l) || 0} | ${l.slice(0, 96)}`,
  )
}
for (const needle of ['G-668 忙时收到的 tick 不得丢']) {
  const lines = new Set(
    [...cBase.keys(), ...cOurs.keys(), ...cTheirs.keys()].filter((l) => l.includes(needle)),
  )
  console.log(`\n=== 含「${needle}」的行 ${lines.size} 条:`)
  for (const l of lines) {
    console.log(
      `   base=${cBase.get(l) || 0} ours=${cOurs.get(l) || 0} theirs=${cTheirs.get(l) || 0}` +
        ` → 期望(折)=${cFold.get(l) || 0} / 期望(不折)=${cNoFold.get(l) || 0}\n     文:${l.slice(0, 190)}`,
    )
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
