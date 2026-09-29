// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 剩下 7 组「两侧各自新增、同号异题」的真撞号:按 §1「后来者改号,由未推的一侧让号」本侧让。
// 前置判据(不成立就拒绝):该键位行**不在 merge-base 上** —— 在 base 上的话行 union 的
// 「每行重数取 max」会把旧形态补回来,让号就成了第三次改号(本会话已实证过一次那条死路)。
// 与上一轮同一套断言:键位命中唯一 / 标题逐字不变 / 注记放行尾 / 指向旧号的【归并】指针行连带改
// / 除被改写行外逐位置逐字相同 / 旧形态整行原文进已入库归档件(门 71 走归档豁免,永久成立)。
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
const NUMS = process.argv.slice(3)
if (NUMS.length === 0) {
  console.log('❌ 没给编号清单')
  process.exit(2)
}

const git = (args, opt = {}) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', root, ...args], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 180000,
    ...opt,
  })
const listArchives = (source) =>
  git(['ls-tree', '-r', '--name-only', source, '--', '.ihui-agent/archive/'])
    .split('\n')
    .filter(Boolean)
    .filter((p) => /(^|\/)PROJECT_PLAN[^/]*\.md$/.test(p))
const wide = (source) => {
  const parts = [git(['show', `${source}:PROJECT_PLAN.md`])]
  for (const p of listArchives(source)) parts.push(git(['show', `${source}:${p}`]))
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
let cur = maxBoth + Number(process.env.GAP || 40)

const ledger = git(['show', 'HEAD:PROJECT_PLAN.md'])
const lines = ledger.split('\n')
const trailing = ledger.endsWith('\n')
const items = []
const olds = []

for (const old of NUMS) {
  const keyed = lines.filter((l) => keyOfRow(l) === old)
  if (keyed.length !== 1) {
    console.log(`❌ ${old}:键位命中 ${keyed.length} 行(应为 1)⇒ 不猜,拒绝构造`)
    process.exit(1)
  }
  // 让号会不会被 union 补回,判据不是"旧形态在不在 base",而是**对侧是否仍原样携带这一行**:
  //  期望重数 = 本侧 + max(0, 对侧 − max(基底, 本侧)) ⇒ 本侧改成 0 份、对侧也 0 份时,基底那份不会回来。
  // 只有"对侧仍带着同一行"时删除才无法传播 —— 那才是本仓记过的那条死路。旧判据把 base 有该键位一律拒掉,
  // 会在"两侧同号但各是一件不同议题"这一格误拒(实测 G-816103 正是这一格),而那一格恰恰让号有效。
  const baseHas = baseLines.some((l) => keyOfRow(l) === old)
  const theirsStillCarries = git(['show', `${T}:PROJECT_PLAN.md`])
    .split('\n')
    .some((l) => l === keyed[0])
  if (baseHas && theirsStillCarries) {
    console.log(`❌ ${old}:对侧仍**逐字带着这一行** ⇒ 让号的删除传播不过去,拒绝构造(这是死路那一型)`)
    process.exit(1)
  }
  const before = keyed[0]
  if (before.split(old).length - 1 !== 1) {
    console.log(`❌ ${old}:活行里该号出现不止一次,替换会连带改掉叙述引用`)
    process.exit(1)
  }
  let next
  for (;;) {
    cur += 1
    const c = `G-${cur}`
    if (!new RegExp(`\\b${c}\\b`).test(all)) {
      next = c
      break
    }
  }
  const note = `〔2026-09-29 让号:${old} → ${next} —— origin 面上 ${old} 这枚号被另一条**不同议题**的登记占着(union-converge 落地闸 F9 现读点名),按 §1「后来者改号、由未推的一侧让号」由未推的本侧让;本行不是让号执行人所写,处置只换编号、正文与勾选状态逐字未动;旧形态整行原文已逐字入 ${ARCHIVE}(门 71 的归档豁免)〕`
  // 顺序必须是「先换键位、再拼注记」:注记里带旧号,若先拼注记,行首键位还是旧号,
  // 键位断言就会把"我自己还没换"读成"换错了"(第一版正是这样,红的是构造顺序而不是数据)。
  const at = before.indexOf(old)
  const swapped = `${before.slice(0, at)}${next}${before.slice(at + old.length)}`
  if (keyOfRow(swapped) !== next || titleOf(swapped) !== titleOf(before)) {
    console.log(`❌ ${old}:换键位后键位/标题校验不过(实得 ${String(keyOfRow(swapped))})`)
    process.exit(1)
  }
  const after = `${swapped} ${note}`
  if (keyOfRow(after) !== next) {
    console.log(`❌ ${old}:加注记后键位漂了(实得 ${String(keyOfRow(after))})`)
    process.exit(1)
  }
  if (titleOf(after) !== titleOf(before)) {
    console.log(`❌ ${old}:注记改掉了标题前缀(注记必须在行尾)`)
    process.exit(1)
  }
  if (!after.includes(old)) {
    console.log(`❌ ${old}:注记没写回旧号,后来人无从追溯让过什么号`)
    process.exit(1)
  }
  items.push({ before, after: swapped })
  olds.push(before)
  console.log(`✅ ${old} → ${next}(正文与勾选态逐字未动)`)

  const pointers = lines.filter((l) => l !== before && l.includes(old))
  for (const p of pointers) {
    if (!DUP_POINTER_RE.test(p)) {
      console.log(`❌ ${old}:发现非留痕形态的引用行,拒绝代改:${p.slice(0, 80)}`)
      process.exit(1)
    }
    if (p.split(old).length - 1 !== 1) {
      console.log(`❌ ${old}:指针行里该号出现不止一次,拒绝构造`)
      process.exit(1)
    }
    const pAfter = p.split(old).join(next)
    if (keyOfRow(pAfter) !== null) {
      console.log(`❌ ${old}:改完的指针行凭空有了键位 ${String(keyOfRow(pAfter))}`)
      process.exit(1)
    }
    items.push({ before: p, after: pAfter })
    olds.push(p)
  }
}

const kept = lines.map((l) => {
  const it = items.find((i) => i.before === l)
  return it ? it.after : l
})
if (kept.length !== lines.length) {
  console.log('❌ 行数变了(本件只做整行替换)')
  process.exit(1)
}
for (let i = 0; i < lines.length; i++) {
  const isTarget = items.some((it) => it.before === lines[i])
  if (!isTarget && kept[i] !== lines[i]) {
    console.log(`❌ 第 ${i + 1} 行被顺手动了:${lines[i].slice(0, 60)}`)
    process.exit(1)
  }
}
for (const old of NUMS) {
  if (kept.some((l) => keyOfRow(l) === old)) {
    console.log(`❌ 产出面上 ${old} 仍有键位行`)
    process.exit(1)
  }
}
for (const it of items) {
  const kk = keyOfRow(it.after)
  if (kk && kept.filter((l) => keyOfRow(l) === kk).length !== 1) {
    console.log(`❌ ${kk}:产出面上键位行不唯一`)
    process.exit(1)
  }
}
const newLedger = kept.join('\n') + (trailing ? '\n' : '')

const oldArchive = git(['show', `HEAD:${ARCHIVE}`])
const archiveNew =
  `${oldArchive.replace(/\n+$/, '')}\n\n## 追加(同日·第四次):${NUMS.length} 枚同号异题登记让号前的形态\n\n` +
  `下面这批原文是 ${NUMS.join(', ')} 这几枚登记在让号**之前**的整行形态` +
  '(含指向它们的【归并】副本指针行),逐字留此。让号理由与执行判据写在台账那七行的行尾注记里;' +
  '登记行的原文前缀能在**已入库**的归档件里逐字找到,所以门 71 的防丢判据走归档豁免,不是等窗口过去。' +
  '本件不参与派单,也不参与合并面对账。\n\n' +
  olds.join('\n') +
  '\n'

const scratch = mkScratch('renumber-7-')
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
    console.log(`❌ 归档件水印注入失败(rc=${inj.status}):${inj.stdout || inj.stderr}`)
    process.exit(1)
  }
  const ver = spawnSync(process.execPath, [join(root, 'scripts/watermark.mjs'), 'verify', ap], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
  })
  if (ver.status !== 0) {
    console.log(`❌ 归档件水印 verify 非完好(rc=${ver.status}):\n${ver.stdout}`)
    process.exit(1)
  }
  const back = readFileSync(ap, 'utf8')
  for (const o of olds) {
    if (!back.includes(o)) {
      console.log(`❌ 归档件不再逐字含原文:${o.slice(0, 60)}`)
      process.exit(1)
    }
  }
  const lb = git(['hash-object', '-w', lp]).trim()
  const ab = git(['hash-object', '-w', ap]).trim()
  writeFileSync(
    `${DIR}/blobs-mine5.json`,
    JSON.stringify({ files: [{ path: 'PROJECT_PLAN.md', blob: lb }, { path: ARCHIVE, blob: ab }] }, null, 2),
    'utf8',
  )
  console.log(
    `✅ blob:${lb.slice(0, 10)} / ${ab.slice(0, 10)};改写 ${items.length} 行 / 留痕 ${olds.length} 段;` +
      `两侧号段 max=${maxBoth}`,
  )
} finally {
  rmScratch(scratch)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
