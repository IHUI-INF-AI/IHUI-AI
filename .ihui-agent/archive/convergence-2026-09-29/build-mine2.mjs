// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 本侧自有两行让号:活行换新号(跳出现抢号段),凡被改写的行(活行 / 指向它的【归并】副本指针行)
// 的**改前整行原文**逐字进留痕归档件 ⇒ 门 71 的归档豁免永久成立,而不是等 60 枚提交窗口过去。
// 注记一律放行尾 —— 插在键位后会改掉复合主键(编号 + 标题前缀),那是比撞号更贵的一次改动。
import { execFileSync } from 'node:child_process'
import { writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gitBinary } from '../../../../scripts/lib/face-reader.mjs'
import { usedIdsOfPrefix, keyOfRow, titleOf, DUP_POINTER_RE } from '../../../../scripts/lib/plan-task-index.mjs'
import { mkScratch, rmScratch } from '../../../../scripts/lib/scratch-dir.mjs'

const GIT = gitBinary()
const root = 'D:/IHUI-AI'
const DIR = 'D:/IHUI-AI/.ihui-agent/tmp/o81-resume/docs2'
const ARCHIVE = '.ihui-agent/archive/PROJECT_PLAN_superseded-numbering-2026-09-29.md'
const MINE = [
  { old: 'G-815951', needle: '图标生成器' },
  { old: 'G-815987', needle: '活文档行 union' },
]

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
  console.log('❌ 缺远端 sha(取号面必须含远端,否则换了个号还是撞)')
  process.exit(2)
}
// 前置判据:旧形态**不得在 merge-base 上** —— 在 base 上的话,行 union 会把它按"每行重数取 max"
// 补回来,让号一侧的删除结构上无法传播(这正是本侧那枚 G-815987 登记的死锁型)。成立才动手。
const BASE = git(['merge-base', 'HEAD', T]).trim()
const baseText = git(['show', `${BASE}:PROJECT_PLAN.md`])
const baseLines = baseText.split('\n')

const wOurs = wide('HEAD')
const wTheirs = wide(T)
const all = `${wOurs}\n${wTheirs}`
const maxBoth = Math.max(
  (usedIdsOfPrefix(wOurs, 'G') || { max: 0 }).max,
  (usedIdsOfPrefix(wTheirs, 'G') || { max: 0 }).max,
)
// 跳出号段前沿:远端每几分钟吃掉十几个号,贴着 max+1 取号几乎必然再撞(今天已实证两次)
let cur = maxBoth + 40

const ledger = git(['show', 'HEAD:PROJECT_PLAN.md'])
const lines = ledger.split('\n')
const trailing = ledger.endsWith('\n')
const items = []
const olds = []

for (const { old, needle } of MINE) {
  const keyed = lines.filter((l) => keyOfRow(l) === old)
  if (keyed.length !== 1) {
    console.log(`❌ ${old}:键位命中 ${keyed.length} 行(应为 1)⇒ 不猜,拒绝构造`)
    process.exit(1)
  }
  if (baseLines.some((l) => keyOfRow(l) === old)) {
    console.log(`❌ ${old}:该键位行在 merge-base ${BASE.slice(0, 10)} 上存在 ⇒ 行 union 会把旧形态补回,让号无效`)
    process.exit(1)
  }
  const before = keyed[0]
  if (!before.includes(needle)) {
    console.log(`❌ ${old}:命中的不是同一枚登记(正文不含 "${needle}")`)
    process.exit(1)
  }
  if (before.split(old).length - 1 !== 1) {
    console.log(`❌ ${old}:活行里该号出现不止一次,替换会连带改掉叙述引用`)
    process.exit(1)
  }
  // 行尾那段"曾试让号…已还原为本号"的旧留痕:让号后它与本行结论矛盾,逐字摘进归档件再从活行去掉
  let stem = before
  const legacy = /〔2026-09-29 曾试让号至[^〕]*〕\s*$/.exec(before)
  if (legacy) {
    stem = before.slice(0, before.length - legacy[0].length).replace(/\s+$/, '')
    olds.push(legacy[0])
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
  const note = `〔2026-09-29 让号:${old} → ${next} —— 与 origin 面上一枚同号异题登记撞上(union-converge 落地闸 F9 现读),按 §1「后来者改号、由未推的一侧让号」本侧让;旧形态整行原文已逐字入 ${ARCHIVE}(门 71 的归档豁免),本行上一条"已还原为本号"的留痕已被本条取代〕`
  const at = stem.indexOf(old)
  const after = `${stem.slice(0, at)}${next}${stem.slice(at + old.length)} ${note}`
  if (keyOfRow(after) !== next) {
    console.log(`❌ ${old}:造出来的行键位不是 ${next}(实得 ${String(keyOfRow(after))})`)
    process.exit(1)
  }
  if (titleOf(after) !== titleOf(stem)) {
    console.log(`❌ ${old}:注记或换号改掉了标题前缀(注记必须在行尾)`)
    process.exit(1)
  }
  // 注记里**必须**留旧号(可追溯),但它不在编号位 ⇒ F9 按编号位判,不会算成第二次登记;
  // 真正的判据是下面那条"产出面上旧号不得再有键位行",不是"旧号不得出现在任何文本里"。
  items.push({ before, after })
  olds.push(before)
  console.log(`✅ ${old} → ${next}(标题逐字未变;摘出旧留痕 ${legacy ? 1 : 0} 段)`)

  // 指向旧号的【归并】副本指针行必须跟着改,否则"现行登记 = <旧号>"变成指空 —— 比没有指针更糟
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
      console.log(`❌ ${old}:改完的指针行凭空有了键位 ${String(keyOfRow(pAfter))}(它不得参与取号)`)
      process.exit(1)
    }
    items.push({ before: p, after: pAfter })
    olds.push(p)
    console.log(`   ↳ 指针行连带改写(键位仍为空,正文只换"现行登记"指向)`)
  }
}

const kept = lines.map((l) => {
  const it = items.find((i) => i.before === l)
  return it ? it.after : l
})
if (kept.length !== lines.length) {
  console.log('❌ 行数变了(本件只做整行替换,不增不删)')
  process.exit(1)
}
// 零损失:除被改写的行外,其余每一行必须**同位置逐字相同**
for (let i = 0; i < lines.length; i++) {
  const isTarget = items.some((it) => it.before === lines[i])
  if (!isTarget && kept[i] !== lines[i]) {
    console.log(`❌ 第 ${i + 1} 行被顺手动了:${lines[i].slice(0, 60)}`)
    process.exit(1)
  }
}
// 造完的面上:我的两个旧号不得再有任何键位行,新号必须恰好各一枚键位行
for (const { old } of MINE) {
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
  `${oldArchive.replace(/\n+$/, '')}\n\n## 追加(同日·第二次):本侧自有两行让号前的形态\n\n` +
  '下面这批原文是本会话那两枚登记(图标生成器 / 活文档行 union)让号**之前**的整行形态,' +
  '含指向它们的【归并】副本指针行、以及被取代的那段"已还原为本号"旧留痕,全部逐字留此 —— ' +
  '登记行的原文前缀能在**已入库**的归档件里逐字找到,所以门 71 的防丢判据走的是归档豁免,不是等窗口过去。' +
  '现行登记已让到新号,同标题可在台账正文检索;本件不再参与派单,也不再参与合并面对账。\n\n' +
  olds.join('\n') +
  '\n'

const scratch = mkScratch('renumber-mine-')
try {
  const lp = join(scratch, 'PLAN.md')
  const ap = join(scratch, 'ARC.md')
  writeFileSync(lp, newLedger, 'utf8')
  writeFileSync(ap, archiveNew, 'utf8')
  execFileSync(process.execPath, [join(root, 'scripts/watermark.mjs'), 'inject', '--reseat-tail', ap], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60000,
  })
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
    `${DIR}/blobs-mine3.json`,
    JSON.stringify({ files: [{ path: 'PROJECT_PLAN.md', blob: lb }, { path: ARCHIVE, blob: ab }] }, null, 2),
    'utf8',
  )
  console.log(
    `✅ blob:${lb.slice(0, 10)} / ${ab.slice(0, 10)};` +
      `改写的行 ${items.length} 条 / 归档留痕 ${olds.length} 段;两侧号段 max=${maxBoth},跳 40 位取号`,
  )
} finally {
  rmScratch(scratch)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
