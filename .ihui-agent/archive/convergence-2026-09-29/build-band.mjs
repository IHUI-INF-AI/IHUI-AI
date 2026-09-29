// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 把"本会话让过号"的行一次性挪到远端号段之外的带(max + GAP),终结逐轮被吃的竞态。
// 判据:行尾注记含 `2026-09-29 让号:` 的才是本链让过的(不是按号段猜),
// 且其当前键位 ≤ 当次两侧号段 max + GAP_BAND —— 这些号正被并发取号器吃。
import { execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gitBinary } from '../../../scripts/lib/face-reader.mjs'
import { usedIdsOfPrefix, keyOfRow, titleOf, DUP_POINTER_RE } from '../../../scripts/lib/plan-task-index.mjs'
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'

const GIT = gitBinary()
const root = 'D:/IHUI-AI'
const DIR = 'D:/IHUI-AI/.ihui-agent/tmp/o81-resume/docs2'
const ARCHIVE = '.ihui-agent/archive/PROJECT_PLAN_superseded-numbering-2026-09-29.md'
const GAP = Number(process.env.GAP || 20000)
const NOTE_RE = /〔2026-09-29 让号:/

const git = (args) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', root, ...args], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 240000,
  })
const listArchives = (s) =>
  git(['ls-tree', '-r', '--name-only', s, '--', '.ihui-agent/archive/'])
    .split('\n')
    .filter(Boolean)
    .filter((p) => /(^|\/)PROJECT_PLAN[^/]*\.md$/.test(p))
const wide = (s) => {
  const parts = [git(['show', `${s}:PROJECT_PLAN.md`])]
  for (const p of listArchives(s)) parts.push(git(['show', `${s}:${p}`]))
  return parts.join('\n')
}

const T = process.argv[2]
if (!T) {
  console.log('❌ 缺远端 sha')
  process.exit(2)
}
const BASE = git(['merge-base', 'HEAD', T]).trim()
const baseLines = git(['show', `${BASE}:PROJECT_PLAN.md`]).split('\n')
const wOurs = wide('HEAD')
const wTheirs = wide(T)
const all = `${wOurs}\n${wTheirs}`
const maxBoth = Math.max(
  (usedIdsOfPrefix(wOurs, 'G') || { max: 0 }).max,
  (usedIdsOfPrefix(wTheirs, 'G') || { max: 0 }).max,
)
const ledger = git(['show', 'HEAD:PROJECT_PLAN.md'])
const lines = ledger.split('\n')
const trailing = ledger.endsWith('\n')

const targets = lines.filter((l) => NOTE_RE.test(l) && keyOfRow(l))
console.log(`带内待挪行数=${targets.length}(注记含"让号:"且当前有键位);号段 max=${maxBoth},目标带起点=${maxBoth + GAP}`)
if (targets.length === 0) {
  console.log('✅ 没有需要挪的行 ⇒ 不产出 blob')
  process.exit(0)
}

const items = []
const olds = []
let cur = maxBoth + GAP
for (const before of targets) {
  const old = keyOfRow(before)
  if (baseLines.some((l) => keyOfRow(l) === old)) {
    console.log(`❌ ${old}:键位行在 merge-base 上存在 ⇒ 让号会被行 union 补回,拒绝构造`)
    process.exit(1)
  }
  // 注记里已有旧的 `让号:X → Y` 段,挪号时把它整段换成新的一次,避免一行里堆多层历史
  let next
  for (;;) {
    cur += 1
    const c = `G-${cur}`
    if (!new RegExp(`\\b${c}\\b`).test(all)) {
      next = c
      break
    }
  }
  const at = before.indexOf(old)
  let swapped = `${before.slice(0, at)}${next}${before.slice(at + old.length)}`
  swapped = swapped.replace(new RegExp(`让号:${old} → ${old}`), `让号:${old} → ${next}`)
  const m = new RegExp(`让号:(G-\\d+) → ${old}(?![0-9])`).exec(swapped)
  if (m) swapped = swapped.replace(m[0], `让号:${m[1]} → ${next}`)
  if (keyOfRow(swapped) !== next) {
    console.log(`❌ ${old}:换键位后键位不对(实得 ${String(keyOfRow(swapped))})`)
    process.exit(1)
  }
  if (titleOf(swapped) !== titleOf(before)) {
    console.log(`❌ ${old}:标题被改动`)
    process.exit(1)
  }
  if (NOTE_RE.test(swapped) === false) {
    console.log(`❌ ${old}:让号注记丢了 —— 它是唯一能让后人看出"这行被挪过"的证据`)
    process.exit(1)
  }
  if (!new RegExp(`→ ${next}(?![0-9])`).test(swapped)) {
    console.log(`❌ ${old}:注记仍写着 ${old} → 旧新号,没跟着挪`)
    process.exit(1)
  }
  items.push({ before, after: swapped })
  olds.push(before)
  console.log(`✅ ${old} → ${next}`)
  for (const p of lines.filter((l) => l !== before && l.includes(old))) {
    if (!DUP_POINTER_RE.test(p)) {
      console.log(`❌ ${old}:非留痕形态引用行,拒绝代改`); process.exit(1)
    }
    if (p.split(old).length - 1 !== 1) {
      console.log(`❌ ${old}:该号在指针行出现多次,拒绝构造`); process.exit(1)
    }
    const pa = p.split(old).join(next)
    if (keyOfRow(pa) !== null) {
      console.log(`❌ ${old}:改完的指针行有了键位`); process.exit(1)
    }
    items.push({ before: p, after: pa })
    olds.push(p)
  }
}

const kept = lines.map((l) => {
  const it = items.find((i) => i.before === l)
  return it ? it.after : l
})
if (kept.length !== lines.length) {
  console.log('❌ 行数变了')
  process.exit(1)
}
for (let i = 0; i < lines.length; i++) {
  const isTarget = items.some((it) => it.before === lines[i])
  if (!isTarget && kept[i] !== lines[i]) {
    console.log(`❌ 第 ${i + 1} 行被顺手动了`); process.exit(1)
  }
}
for (const it of items) {
  const kk = keyOfRow(it.after)
  if (kk && kept.filter((l) => keyOfRow(l) === kk).length !== 1) {
    console.log(`❌ ${kk}:键位行不唯一`); process.exit(1)
  }
}
const newLedger = kept.join('\n') + (trailing ? '\n' : '')

const oldArchive = git(['show', `HEAD:${ARCHIVE}`])
const archiveNew =
  `${oldArchive.replace(/\n+$/, '')}\n\n## 追加(同日·第五次):一次性挪出并发取号带的 ${targets.length} 行\n\n` +
  '这批行此前已被让过一次号,但落点仍在"当次 max + 小跳距"的带里 —— 而并发会话的取号器就在那一带逐号前进,' +
  '于是每收敛一轮就被吃掉一枚(F9 现读逐轮更换撞号对象)。这次一次挪到 `max + ' +
  GAP +
  '` 之外,' +
  '让"取号竞态"靠带距离而不是靠运气闭合。原文逐字留此,门 71 走已入库归档件的豁免。\n\n' +
  olds.join('\n') +
  '\n'

const scratch = mkScratch('band-move-')
try {
  const lp = join(scratch, 'PLAN.md')
  const ap = join(scratch, 'ARC.md')
  writeFileSync(lp, newLedger, 'utf8')
  writeFileSync(ap, archiveNew, 'utf8')
  const inj = spawnSync(process.execPath, [join(root, 'scripts/watermark.mjs'), 'inject', '--reseat-tail', ap], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
  })
  if (inj.status !== 0) {
    console.log(`❌ 注入失败 rc=${inj.status}:${inj.stdout || inj.stderr}`); process.exit(1)
  }
  const ver = spawnSync(process.execPath, [join(root, 'scripts/watermark.mjs'), 'verify', ap], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
  })
  if (ver.status !== 0) {
    console.log(`❌ verify rc=${ver.status}:\n${ver.stdout}`); process.exit(1)
  }
  const back = readFileSync(ap, 'utf8')
  for (const o of olds) if (!back.includes(o)) { console.log('❌ 归档件不再逐字含原文'); process.exit(1) }
  const lb = git(['hash-object', '-w', lp]).trim()
  const ab = git(['hash-object', '-w', ap]).trim()
  writeFileSync(
    `${DIR}/blobs-band.json`,
    JSON.stringify({ files: [{ path: 'PROJECT_PLAN.md', blob: lb }, { path: ARCHIVE, blob: ab }] }, null, 2),
    'utf8',
  )
  console.log(`✅ blob:${lb.slice(0, 10)} / ${ab.slice(0, 10)};改写 ${items.length} 行 / 留痕 ${olds.length} 段`)
} finally {
  rmScratch(scratch)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
