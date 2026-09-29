// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 一次性:把本机未推送的两枚登记让号(撞号组在合并落地闸上拒收整次合并)
// 判据:已推送的一侧不动,未推送的一侧让号 —— 不用 blame 时刻(并集重放会把旧行重新提交)
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = process.argv[2]
const DST = process.argv[3]
const NOTE = (old, neu) =>
  `〔让号 2026-09-29:原用 ${old},与远端已推送侧的 ${old} 是两件不同的事(合并落地闸按 F9 判"编号被 2 个不同标题共用"并拒收整次合并)。` +
  `按"已推送侧不动、未推送侧让号"改号为 ${neu},正文一字未动;取号前已 fetch 并逐面核 ${neu} 在两侧均为空闲〕`

const jobs = [
  {
    key: 'G-815401',
    neu: 'G-815409',
    needle: '- [x] ✅(2026-09-29) G-815401 **七张',
  },
  {
    key: 'G-815404',
    neu: 'G-815410',
    needle: '- [ ] G-815404 **`git-sync-converge`',
  },
]

const lines = readFileSync(SRC, 'utf8').split('\n')
const before = lines.length
let touched = 0

for (const j of jobs) {
  const hits = lines
    .map((l, i) => (l.startsWith(j.needle) ? i : -1))
    .filter((i) => i >= 0)
  if (hits.length !== 1) {
    console.log(`拒绝:${j.key} 的登记行命中 ${hits.length} 次(必须恰为 1)`)
    process.exit(1)
  }
  const i = hits[0]
  if (!lines[i].includes(j.key)) {
    console.log(`拒绝:命中行不含编号 ${j.key}`)
    process.exit(1)
  }
  const first = lines[i].indexOf(j.key)
  const rest = lines[i].slice(first + j.key.length)
  lines[i] = lines[i].slice(0, first) + j.neu + rest + NOTE(j.key, j.neu)
  touched += 1
  console.log(`改号 ${j.key} -> ${j.neu} @行 ${i + 1}`)
}

if (touched !== jobs.length) {
  console.log(`拒绝:只改了 ${touched} 处,应为 ${jobs.length} 处`)
  process.exit(1)
}
if (lines.length !== before) {
  console.log(`拒绝:行数由 ${before} 变成 ${lines.length}(必须逐字等值)`)
  process.exit(1)
}
// 反向锁:让号后本机面上不得再有"以旧号开头的登记行"(正文里提到旧号的叙述行不算登记,
// 判据只认剥掉复选框与状态装饰后的正文开头 —— 与 §1 的复合主键同一条判据)
const regIdOf = (l) => {
  const m = /^- \[[ xX]\] ?/.exec(l)
  if (!m) return null
  const body = l
    .slice(m[0].length)
    .replace(/^✅\([^)]*\)\s*/, '')
    .replace(/^（进行中(?:@[^）]*)?）\s*/, '')
    .trimStart()
  const k = /^([A-Za-z]+-?[0-9A-Za-z]*)/.exec(body)
  return k ? k[1] : null
}
for (const j of jobs) {
  const still = lines.filter((l) => regIdOf(l) === j.key).length
  if (still > 0) {
    console.log(`拒绝:${j.key} 仍有 ${still} 条登记行以旧号开头`)
    process.exit(1)
  }
}
writeFileSync(DST, lines.join('\n'))
console.log(`✅ 已产出 ${DST}(行数 ${before} 不变,改动行数 ${touched})`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
