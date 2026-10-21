// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 台账登记行长度守门(差值棘轮;门号以 `guardian-runner.mjs` 注册条目现值为准。2026-10-22 立)。
 *
 * 立因:AGENTS §1 早就明令"登记行只留标题 + 一句现状/出路;验证过程、末行原文、取证流水一律只进
 * commit message" —— 但这条纪律**从来没有机器拦过**。2026-10-22 现读:277 条未勾登记行的标题段平均
 * 63 字、其后叙述平均 1679 字(叙述占约 96%),74% 的行超 400 字,最长一行 16650 字。
 * 也就是说"任务计划文档"这个名义和它实际承担的东西(工作日志 + 取证档案)已经分叉,
 * 而机主问的"他不就是个记录、引导吗"正是这一分叉的表象。
 *
 * 为什么不搬存量:搬家要重锚门 71/84/130/229 全部按行文本判的判据,一次改坏就是丢别人的取证。
 * 所以本门只做一件事:**掐住增量**。存量按复合主键认领为存量、逐条报名不判红(§12e:
 * 与本次提交内容无关的红,唯一结局是逼人跳门、连带约 190 道守门对每次提交作废)。
 *
 * 判据(两档同时成立才算违规):
 *   L1 未勾登记行(`- [ ]`,由 `lib/plan-task-index.mjs` 的 parseTaskRows 判,本层零复算)
 *      且整行字符数 > 阈值(默认 400;`--max-chars` / `IHUI_PLAN_ROW_MAX_CHARS` 可调);
 *   L2 该行的**违规身份**不在 HEAD 自身的存量集里。
 *      身份 = 复合主键(编号 + 题面前缀,复用 `keyOfRow`)⇒ 存量长行被改写时仍算存量,
 *      不会因为改个错别字就"新增一条红";无主键的叙述式行退化为整行文本。
 *      为什么不用整行文本做身份:CL1/CL3/CL4 用的是文本多重集,那一族判的是"这一条具体欠账";
 *      本门判的是"这条票变长了没有",按主键认领才对得上。
 *
 * 出路(§0.8 只写跑得通的):把叙述与取证搬进提交信息;要留在账上的只留"标题 + 一句现状/出路"。
 *   读数:`node scripts/check-plan-row-length.mjs`(全量档,判 HEAD blob)
 *   装车门:`node scripts/check-plan-row-length.mjs --self-test`
 *   人工逃生舱:`--worktree`(不得作为提交门禁)
 * 应急跳门:以 runner 注册条目的 skipEnv 现值为准,本文件不复制一份变量名。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseTaskRows, keyOfRow } from './lib/plan-task-index.mjs'
import { selectFace, gitRaw, readWorktreeFile } from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = 'PROJECT_PLAN.md'
const DEFAULT_MAX = 400
const MAX_ENV = 'IHUI_PLAN_ROW_MAX_CHARS'

/** 违规身份:有主键按主键,无主键退化为整行文本(§1 叙述式待办没有编号)。 */
export function violationKey(raw) {
  const k = keyOfRow(raw)
  return k ? `K:${String(k).trim()}` : `T:${raw.trim()}`
}

/** 纯判据:返回 {over:[{line,len,key}], counts:{rows,over}} —— 不碰 git,可被自检直接喂文本。 */
export function findOverLength(text, maxChars) {
  const rows = parseTaskRows(String(text ?? ''))
  const open = rows.filter((r) => r.state === 'open')
  const over = open
    .filter((r) => r.raw.length > maxChars)
    .map((r) => ({ line: r.line, len: r.raw.length, key: violationKey(r.raw) }))
  return { over, counts: { rows: open.length, over: over.length } }
}

/**
 * 差值棘轮(多重集按**违规身份**认领):存量只报数、新增判红。
 * `stock === undefined` ⇒ 不套棘轮(人工/取证面,全量判);`null` ⇒ 锚点取不到 ⇒ 判未判定,
 * 既不记绿也不冒红(§0.3)。
 */
export function judge(fresh, stock, maxChars) {
  if (stock === null) {
    return { state: 'undetermined', why: 'HEAD 面取不到 ⇒ 没有棘轮锚点', fresh: [], stock: [] }
  }
  if (!Array.isArray(stock)) return { state: 'blocking', fresh, stock: [] }
  const left = new Map()
  for (const k of stock) left.set(k, (left.get(k) || 0) + 1)
  const freshRows = []
  const stockRows = []
  for (const r of fresh) {
    const n = left.get(r.key) || 0
    if (n > 0) {
      left.set(r.key, n - 1)
      stockRows.push(r)
    } else freshRows.push(r)
  }
  return { state: freshRows.length ? 'blocking' : 'ok', fresh: freshRows, stock: stockRows, maxChars }
}

function resolveMax(flagVal) {
  if (Number.isFinite(flagVal) && flagVal > 0) return flagVal
  const env = Number(process.env[MAX_ENV] || '')
  return Number.isFinite(env) && env > 0 ? env : DEFAULT_MAX
}

/**
 * 面选择自成纯函数并可被自检直接打到:本门第一版把 `selectFace` 当 `(argv, {file, root})` 调,
 * 参数对不上 ⇒ 参数全 undefined ⇒ **任何档都落回 head**,于是一道自称 blocking 的门
 * 实际永远只报数(§0.9:造好没装车 = 没有;绿本身就是缺陷)。
 */
export function pickFace(argv) {
  return selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree') })
}

function run(argv, nowMs = Date.now()) {
  void nowMs
  if (argv.includes('--self-test')) return selfTest()
  const maxFlag = argv.find((a) => a.startsWith('--max-chars'))
  const maxChars = resolveMax(maxFlag ? Number(String(maxFlag).split('=')[1]) : undefined)
  const face = pickFace(argv)
  if (face.error) {
    console.log(`❌ ${face.error}`)
    return 2
  }
  let headText = null
  try {
    headText = gitRaw(['show', `HEAD:${FILE}`], ROOT, { timeout: 120000 })
  } catch {
    headText = null
  }
  let subjectText = null
  if (face.face === 'head') subjectText = headText
  else if (face.face === 'staged') {
    try {
      subjectText = gitRaw(['show', `:${FILE}`], ROOT, { timeout: 120000 })
    } catch {
      subjectText = null
    }
  } else subjectText = readWorktreeFile(ROOT, FILE)

  if (typeof subjectText !== 'string' || subjectText === '') {
    console.log(`❌ 未判定:被审面(${face.face})取不到 ${FILE} ⇒ 不记绿也不冒红(§0.3)`)
    return 2
  }
  const subject = findOverLength(subjectText, maxChars)
  const stockHit = headText === null ? null : findOverLength(headText, maxChars).over.map((o) => o.key)
  // 索引档的锚点是 HEAD;HEAD 档自己判自己 ⇒ 锚点即同一集(全量档只报数)
  const stock = face.face === 'head' ? subject.over.map((o) => o.key) : stockHit
  const v = judge(subject.over, stock, maxChars)
  console.log(
    `[台账行长] 阈值 ${maxChars} 字 · 未勾登记行 ${subject.counts.rows} · 超阈 ${subject.counts.over} 处 · 判定面:${face.face} blob`,
  )
  if (v.state === 'undetermined') {
    console.log(`❓ 未判定:${v.why} —— 既不记绿也不冒红,请先修取材面`)
    return 2
  }
  if (face.face === 'head') {
    const lens = subject.over.map((o) => o.len).sort((a, b) => a - b)
    console.log(
      `📊 存量(全量档只报数,不判红):${subject.over.length} 处 · 中位 ${lens.length ? lens[Math.floor(lens.length / 2)] : '—'} 字 · 最长 ${lens.length ? lens[lens.length - 1] : '—'} 字`,
    )
    for (const o of subject.over.slice(0, 5)) console.log(`    · 存量 L${o.line} ${o.len} 字`)
    if (subject.over.length > 5) console.log(`    · …另有 ${subject.over.length - 5} 处同档报数`)
    console.log('✅ 全量档通过(存量归各行持有人清账,本门不代删一个字)')
    return 0
  }
  if (v.fresh.length === 0) {
    console.log(`✅ 差值棘轮:本轮新增超阈登记行 0 处(存量 ${v.stock.length} 处只报数)`)
    for (const o of v.stock.slice(0, 3)) console.log(`    · 存量 L${o.line} ${o.len} 字`)
    return 0
  }
  console.log(`❌ 新增超阈登记行 ${v.fresh.length} 处 —— §1 明令"登记行只留标题 + 一句现状/出路",取证流水只进 commit message`)
  for (const o of v.fresh) console.log(`    · L${o.line} ${o.len} 字(> ${maxChars})  ${o.key.slice(0, 60)}`)
  console.log('  出路:把叙述/取证从这一行删进提交信息,行内留"标题 + 一句现状/出路";或按 runner 现值登记的 skipEnv 具名跳门并写明理由。')
  return 1
}

/** 自检:阈值上下、主键认领(改存量长行不得算新增)、无主键退化、锚点缺失未判定、取材不到不记绿。 */
function selfTest() {
  let pass = 0
  let fail = 0
  const t = (name, ok, extra = '') => {
    if (ok) {
      pass++
      console.log(`✅ ${name}`)
    } else {
      fail++
      console.log(`❌ ${name}${extra ? `:${extra}` : ''}`)
    }
  }
  const LONG = `- [ ] G-901 ${'长'.repeat(500)}`
  const SHORT = '- [ ] G-902 一句现状'
  const doc = `${SHORT}\n${LONG}\n- [x] G-903 ✅(2026-10-01) ${'叙述'.repeat(400)}\n`
  const f = findOverLength(doc, 400)
  t('未勾长行被计,已勾长行不计(§1:已勾行不进保护射程也不进本门)', f.over.length === 1 && f.counts.rows === 2, JSON.stringify(f.counts))
  t('短行不违规', f.over[0].key.startsWith('K:'))
  const same = judge(f.over, f.over.map((o) => o.key), 400)
  t('存量同主键 ⇒ 不判红(改错别字不该算新增)', same.state === 'ok' && same.stock.length === 1)
  const rewritten = judge([{ line: 9, len: 900, key: 'K:G-901' }], f.over.map((o) => o.key), 400)
  t('存量长行被改写变更长 ⇒ 仍认领为存量', rewritten.state === 'ok')
  const freshKey = judge([{ line: 10, len: 800, key: 'K:G-999' }], f.over.map((o) => o.key), 400)
  t('新主键且超阈 ⇒ 判红', freshKey.state === 'blocking' && freshKey.fresh.length === 1)
  const noKey = violationKey(`- [ ] ${'叙述式待办'.repeat(90)}`)
  t('无主键行退化为整行文本身份(不许悄悄不认)', noKey.startsWith('T:'))
  t('锚点取不到 ⇒ 未判定,既不记绿也不冒红', judge(f.over, null, 400).state === 'undetermined')
  t('阈值可上调(环境/旗标生效路径与默认档同形)', findOverLength(LONG, 900).over.length === 0 && findOverLength(LONG, 400).over.length === 1)
  // 面选择四臂:这一族错了,上面所有判据都白写(实测第一版就是这么把 blocking 门跑成永远只报数的)
  t('面选择:--staged ⇒ 索引档(不得落回 head)', pickFace(['--staged']).face === 'staged')
  t('面选择:默认档 = HEAD blob', pickFace([]).face === 'head')
  t('面选择:两面旗同给当场判死', pickFace(['--staged', '--worktree']).face === null)
  t('面选择:--worktree ⇒ 磁盘人工档', pickFace(['--worktree']).face === 'worktree')
  console.log(`--self-test: ${pass}/${pass + fail} 通过`)
  return fail
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exitCode = run(process.argv.slice(2))

export const __test__ = { findOverLength, judge, violationKey, pickFace, DEFAULT_MAX }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
