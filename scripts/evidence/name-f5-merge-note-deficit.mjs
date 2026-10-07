// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 一次性:把合并"顶掉"的那 30 条归并落账注记点名出来(工具只报总数)
// 用法:在干净检出里跑  node .ihui-agent/tmp/uc/name-f5.mjs <theirs-sha>
// 2026-10-07(G-998191 第四批)git 出口收口:本器两处裸 git 派生(ROOT 探测的
// `rev-parse --show-toplevel` 与 `g()` helper 喂 merge-base / show 共 2 个调用点)由
// `execFileSync('git', …)` 迁到取材层 `scripts/lib/face-reader.mjs` 的 `gitRaw`
// —— 仓内逐文件迁移的存量债(判据在 `scripts/tests/face-reader.test.mjs` 的
// `BARE_GIT_BASELINE`,只减不增)。行为面对照:
//   · 绝对路径 git + windowsHide + EBUSY 兜底由层给足;旧两处都**不带** safe.directory,层补上
//     (净收益);quotepath 层强制 false —— merge-base 出 sha、show 出文件正文,均不经路径
//     quoting ⇒ 无可观察差异;
//   · ROOT 探测:旧靠进程 cwd 让 git 自找 toplevel,层按 `gitRaw(args, process.cwd())` 以
//     `-C <cwd>` 逐字同效 —— 锚点不变(从哪个目录跑就在哪个仓探测);timeout 旧无上界 →
//     层 60s、maxBuffer 旧默认 1MB → 层 64MB(均净收益);
//   · `g()`:maxBuffer 旧 `1 << 28`(256MB)> 层默认,显式保留;timeout 旧无上界 → 层 60s(净收益);
//   · 失败语义不变:blob() 的 catch 折空串照旧;ROOT 探测与 merge-base 无 catch,派生失败照旧
//     向上抛(层抛 Undetermined,进程退出码同为非零)。
import { gitRaw } from '../lib/face-reader.mjs'
import { unionLines } from '../union-converge.mjs'

const ROOT = gitRaw(['rev-parse', '--show-toplevel'], process.cwd()).trim()
const g = (args) => gitRaw(args, ROOT, { maxBuffer: 1 << 28 })

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
