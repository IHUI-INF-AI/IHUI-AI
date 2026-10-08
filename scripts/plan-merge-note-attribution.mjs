// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F5「归并落账注记不得变少」的**逐份出处尺子**(只读、只报数,不在提交链)。2026-09-29 立。
 *
 * 为什么需要它:union-converge 的落地闸在台账合并这一格报「各侧最多 537 条,归并结果只剩 501 条」,
 * 而这句话**不含任何可追责的分解** —— 读报告的人无法判断少掉的 36 份里有多少是
 * ① 搬运感知明说的「块已被 `已归档` 占位代表」(内容在归档件里,不在台账面上)、
 * ② 本侧相对共同祖先**自己**缩了量(`liveDocExpectedCounts` 的约定:基底有而本侧清了 ⇒ 处置权在本侧)、
 * ③ 真丢了。三者处置动作完全不同,混在一个数字里就等于没有判据(本仓"报数不报名"那一族)。
 * 上一轮的定性把缺口归给"base 进比较集",按行实测**并不成立**(base 单独抬高 = 0),
 * 错的正是"只有一个总数、没有逐份出处"这件事 —— 所以本器把出处一次性摆出来。
 *
 * 三条不自抄的写法:
 *  - 注记正则与 occurrence 计数一律用 `lib/plan-task-index` 的 `MERGE_NOTE_RE`(与判据同源)。
 *  - 归并内容不自己重算,复用 `union-converge` 的 `show / moveAwareForDoc / unionLines`(与落地闸同一条路径)。
 *  - 面一律取 git 内容(`show`),不读工作树:共享工作区常年滞后 HEAD(守门 118 那一族)。
 *
 * 退出码:0 = 跑完并给出分解(即便有"真丢");2 = 任一面取不到 / 搬运感知取不到归档件 ⇒ **无法判定**,
 * 绝不把"没判"写成"判过了"。本器刻意**不判红也不拦任何人** —— 裁决 F5 语义属落地闸持有人。
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { MERGE_NOTE_RE, DUP_POINTER_RE } from './lib/plan-task-index.mjs'
import { resolveRemoteHead } from './lib/face-reader.mjs'
import { __test__ as U } from './union-converge.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DOC = 'PROJECT_PLAN.md'

/** 一行携带的注记条数(非全局副本:带 g 的 .test() 会推进 lastIndex,第二次调用就漏判)。 */
export function occOfLine(line) {
  const re = new RegExp(MERGE_NOTE_RE.source, 'g')
  let n = 0
  while (re.exec(line) !== null) n++
  return n
}

/** 面文本 -> (行文本 => 注记 occurrence 总数 = 副本数 × 每行条数)。 */
export function noteTotals(text) {
  const m = new Map()
  for (const l of String(text).split('\n')) {
    const o = occOfLine(l)
    if (o) m.set(l, (m.get(l) || 0) + o)
  }
  return m
}

/**
 * 逐份归因:缺口优先记给「占位代表」,再记给「本侧相对基底自缩」,余下才是真丢。
 * 顺序有语义:同一份缺口两种解释同时成立时,占位代表是**更强的证据**(有文件可查)。
 */
export function classifyGap({ tBase, tOurs, tTheirs, tMerged, suppress, occPerLine = occOfLine }) {
  const out = { placeholder: 0, ownShrink: 0, realLoss: 0, rows: [] }
  for (const l of new Set([...tBase.keys(), ...tOurs.keys(), ...tTheirs.keys()])) {
    const have = tMerged.get(l) || 0
    const o = tOurs.get(l) || 0
    const t = tTheirs.get(l) || 0
    const b = tBase.get(l) || 0
    const wantSides = Math.max(o, t)
    const wantAll = Math.max(wantSides, b)
    if (wantAll <= have) continue
    const gap = wantAll - have
    const cover = Math.min((suppress?.get(l) || 0) * occPerLine(l), gap)
    const rest = gap - cover
    const shrink = o < b ? Math.min(rest, b - o) : 0
    const loss = rest - shrink
    out.placeholder += cover
    out.ownShrink += shrink
    out.realLoss += loss
    if (gap)
      out.rows.push({
        gap,
        cover,
        shrink,
        loss,
        o,
        t,
        b,
        have,
        dup: DUP_POINTER_RE.test(l),
        archived: /^<!--\s*已归档/.test(l),
        head: l.slice(0, 90),
      })
  }
  out.rows.sort((x, y) => y.loss - x.loss || y.gap - x.gap)
  return out
}

function gitShow(rev, path) {
  try {
    return execFileSync('git', ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', 'show', `${rev}:${path}`], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 512 * 1048576,
      timeout: 120000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    })
  } catch {
    return null
  }
}

function remoteMain() {
  try {
    return resolveRemoteHead(ROOT)
  } catch {
    return null
  }
}

export function run({ base, ours, theirs, max = 20 } = {}) {
  const B = base || gitMergeBase(ours, theirs)
  if (!B || !ours || !theirs) return { verdict: 'undetermined', reason: `三面 sha 取不到 base=${B} ours=${ours} theirs=${theirs}` }
  const bt = gitShow(B, DOC)
  const a = gitShow(ours, DOC)
  const b = gitShow(theirs, DOC)
  if (!bt || !a || !b)
    return {
      verdict: 'undetermined',
      reason: `台账面取不到(${!bt ? 'base' : ''}${!bt && !a ? '/' : ''}${!a ? 'ours' : ''}${!a && !b ? '/' : ''}${!b ? 'theirs' : ''})`,
    }
  const ma = U.moveAwareForDoc(DOC, a, b, ours, ROOT)
  if (ma.fetchError) return { verdict: 'undetermined', reason: `搬运感知取不到归档件:${ma.fetchError}` }
  const merged = U.unionLines(a, b, bt, ma.suppress)
  const g = classifyGap({
    tBase: noteTotals(bt),
    tOurs: noteTotals(a),
    tTheirs: noteTotals(b),
    tMerged: noteTotals(merged),
    suppress: ma.suppress,
  })
  const res = {
    verdict: 'measured',
    faces: { base: B, ours, theirs },
    totals: { base: count(bt), ours: count(a), theirs: count(b), merged: count(merged) },
    gap: { placeholder: g.placeholder, ownShrink: g.ownShrink, realLoss: g.realLoss },
    moveAware: {
      suppressedLines: ma.stats.suppressedLines,
      blocksMatched: ma.stats.blocksMatched,
      undetermined: ma.undetermined.length,
      archives: ma.archives,
    },
    rows: g.rows,
    max,
  }
  return res
}
const count = (t) => {
  const re = new RegExp(MERGE_NOTE_RE.source, 'g')
  let n = 0
  while (re.exec(t) !== null) n++
  return n
}

function gitMergeBase(ours, theirs) {
  try {
    return execFileSync('git', ['-c', 'safe.directory=*', 'merge-base', ours, theirs], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 60000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    }).trim()
  } catch {
    return null
  }
}

export function formatReport(res) {
  if (res.verdict === 'undetermined') return `⚪ 未判定:${res.reason}\n(本器拒绝把"没量到"写成"没问题",也不写成"有问题")`
  const L = []
  const t = res.totals
  L.push(`三面注记 occurrence 总量:base=${t.base} ours=${t.ours} theirs=${t.theirs} 归并结果=${t.merged}`)
  L.push(
    `缺口逐份出处:占位代表=${res.gap.placeholder} 本侧相对基底自缩=${res.gap.ownShrink} **真丢=${res.gap.realLoss}**`,
  )
  L.push(
    `搬运感知:抑制行数=${res.moveAware.suppressedLines} 命中块=${res.moveAware.blocksMatched} 未判定块=${res.moveAware.undetermined} 读到的归档件=${res.moveAware.archives}`,
  )
  if (res.rows.length) {
    L.push(`逐条(最多 ${res.max} 行,按"真丢"降序):ours/theirs/base→merged  缺口 占位 自缩 真丢`)
    for (const r of res.rows.slice(0, res.max))
      L.push(
        `  ${r.o}/${r.t}/${r.b}→${r.have}  缺${r.gap} 占位${r.cover} 自缩${r.shrink} 真丢${r.loss}${r.archived ? ' [归档占位行]' : ''}${r.dup ? ' [副本指针行]' : ''} :: ${r.head}`,
      )
  } else L.push('无任何缺口行。')
  L.push(`面:base=${res.faces.base} ours=${res.faces.ours} theirs=${res.faces.theirs}`)
  return L.join('\n')
}

export function parseArgs(argv) {
  const o = { json: false, selfTest: false, max: 20 }
  const val = (name, a, i) => (a.includes('=') ? a.slice(name.length + 1) : argv[++i])
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') o.json = true
    else if (a === '--self-test') o.selfTest = true
    else if (a === '--max' || a.startsWith('--max=')) o.max = Number(val('--max', a, i))
    else if (a === '--base' || a.startsWith('--base=')) o.base = val('--base', a, i)
    else if (a === '--ours' || a.startsWith('--ours=')) o.ours = val('--ours', a, i)
    else if (a === '--theirs' || a.startsWith('--theirs=')) o.theirs = val('--theirs', a, i)
  }
  return o
}

/** 构造面自证:三型缺口各必须落在自己的桶里,且"真丢"那一型不许被前两种吃掉。 */
export function selfTest() {
  const notes = (s) => `〔【归并】${s} 落账:复测 2026-09-29〕`
  const mk = (line, copies) => Array(copies).fill(line).join('\n')
  const A = notes('A自缩'),
    B = notes('B占位'),
    C = notes('C真丢')
  const tBase = noteTotals(mk(A, 5) + '\n' + mk(B, 4) + '\n' + mk(C, 3))
  const tOurs = noteTotals(mk(A, 2) + '\n' + mk(B, 4) + '\n' + mk(C, 3))
  const tTheirs = noteTotals(mk(A, 5) + '\n' + mk(B, 4) + '\n' + mk(C, 3))
  const tMerged = noteTotals(mk(A, 2) + '\n' + mk(B, 4) + '\n' + mk(C, 2))
  const suppress = new Map([[B, 0]])
  const g = classifyGap({ tBase, tOurs, tTheirs, tMerged, suppress })
  const checks = [
    { name: '本侧自缩那一型记进 ownShrink 而不是 realLoss', ok: g.ownShrink === 3 && g.rows.find((r) => r.head.startsWith(A))?.loss === 0 },
    { name: '占位代表优先于自缩(同一份缺口两种解释时先记更强的证据,余下才记自缩)', ok: (() => {
        const gg = classifyGap({ tBase, tOurs, tTheirs, tMerged, suppress: new Map([[A, 1]]) })
        const rowA = gg.rows.find((r) => r.head.startsWith(A))
        return gg.placeholder === 1 && rowA?.cover === 1 && rowA?.shrink === 2 && rowA?.loss === 0
      })() },
    { name: '两侧都没到期望且非自缩 ⇒ 必须落 realLoss', ok: g.realLoss === 1 },
    { name: 'suppress 按行份数换算成 occurrence(每行条数不是 1 时不得只扣 1)', ok: (() => {
        // 同一份输入把 A 的缺口 3 全交给占位代表后:A 不再计入 ownShrink(C 那一行的真丢 1 与 A 无关,
        // 所以这里断言的是"A 的两桶归零 + 总量仍只有 C 那 1 份真丢",不是"realLoss=0"。
        const gg = classifyGap({ tBase, tOurs, tTheirs, tMerged, suppress: new Map([[A, 3]]) })
        const rowA = gg.rows.find((r) => r.head.startsWith(A))
        return gg.placeholder === 3 && rowA?.shrink === 0 && rowA?.loss === 0 && gg.realLoss === 1
      })() },
    { name: '无缺口 ⇒ 三个桶全 0(空表不得伪装成结论)', ok: (() => {
        const gg = classifyGap({ tBase: tOurs, tOurs, tTheirs: tOurs, tMerged: tOurs, suppress: new Map() })
        return gg.placeholder === 0 && gg.ownShrink === 0 && gg.realLoss === 0 && gg.rows.length === 0
      })() },
    // 这一条是被真实故障逼出来的:`--theirs=` 曾因 slice 偏移写错被截成 `s=<sha>`,而面取不到时
    // 本器报的是"未判定"(响亮),所以 bug 只能靠这条断言在写的时候就被抓住。
    { name: '`--旗标=值` 与 `--旗标 值` 两种写法都必须解析出完整值', ok: (() => {
        const sha = '0123456789abcdef0123456789abcdef01234567'
        const eq = parseArgs([`--theirs=${sha}`, `--base=${sha}`, '--max=7'])
        const sp = parseArgs(['--theirs', sha, '--base', sha, '--max', '7'])
        return eq.theirs === sha && eq.base === sha && eq.max === 7 && sp.theirs === sha && sp.base === sha && sp.max === 7
      })() },
  ]
  let bad = 0
  for (const c of checks) {
    const ok = c.ok === true
    if (!ok) bad++
    console.log(`${ok ? '✅' : '❌'} ${c.name}`)
  }
  console.log(`自检 ${checks.length - bad}/${checks.length} 通过`)
  return bad === 0 ? 0 : 1
}

function main() {
  const o = parseArgs(process.argv.slice(2))
  if (o.selfTest) process.exit(selfTest())
  const theirs = o.theirs || remoteMain()
  const res = run({ base: o.base, ours: o.ours || 'HEAD', theirs, max: o.max })
  if (o.json) console.log(JSON.stringify(res, null, 2))
  else console.log(formatReport(res))
  process.exit(res.verdict === 'undetermined' ? 2 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()

export const __test__ = { occOfLine, noteTotals, classifyGap, selfTest, parseArgs, run }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
