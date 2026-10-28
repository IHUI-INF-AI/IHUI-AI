// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 本工具是运维记账器,机器行必须走 stdout */
/**
 * record-closure-drops — 结清删行的留痕兜底腿(2026-10-28 立)。
 *
 * 立因是量出来的一个**通道缺口**,不是某次误删:`plan-drop-record.mjs` 的留痕腿此前只有
 * `live-doc-edit.mjs` 与 `plan-fields-extract.mjs` 两个调用方,而 `safe-commit.mjs` 对它的接线
 * 现读为 0 命中 ⇒ 凡"手工改台账 + 普通提交"把一行 `- [ ]` 登记删掉,这本账就没有任何凭据。
 * 门 71(`check-plan-line-loss.mjs --heal`)只认逐字留痕,认不出来的那一型正是
 * "被正当结清的未勾行" ⇒ 它按"被并发旧基线抹掉的登记行"把整行**还原成未勾**插回台账。
 * 实证:O67 于 2026-10-28 19:14 由 d4257bfc8fc51a8411d6fcd540d11e0bb4b0d17d 结清删行,
 * 45 分钟后被 dfd9b905f113a1dc761d66025aa56104c9d4ddc5 回捞;摘除台账里该票留痕 0 条。
 * 后果不止是台账脏:回捞行让 `git-sync-converge` 的零丢失自证把它读成"本侧已提交内容被吞"
 * ⇒ 当场拒绝推进 HEAD,整仓同步停摆(2026-10-28 21:5x 实测)。
 *
 * 为什么修在生产侧而不是判据侧:另两档都被实测否掉。
 *  ① 让门 71"看提交信息点没点名票号"再决定回捞 —— 失效方向变成"真丢的行不救",而门 71 存在
 *     的唯一理由就是救真丢的行(§0.10 要求失效方向是"多问一次",这条是"少救一次");
 *  ② 往提交链加"删登记行无留痕即判红"的 blocking 门 —— 手工改台账在日常里高频,存量一清不空
 *     就是人人 `--no-verify` 的恒红门(§12e),而它逼出来的动作与正解无关。
 * 本器选**第三条**:在落地之后把缺的凭据补上,判定面一字不改。
 *
 * 判据纪律(§0.6 单一真相源):本层**不复算任何"什么算登记行/什么算结清/幂等怎么判"** ——
 * 形态尺取 `plan-drop-record.rowFormOf`,落账与幂等取同模块的 `recordFlipDrops`(live-doc-edit
 * 用的就是它),git 派生与祖先三态取 `bypass-git`。本器只回答一个新问题:
 * "这一枚提交,从父版到本版,消失了哪些未勾登记行"。
 *
 * 只补"父版有、本版没有"的那几条,且刻意**不看工作区**:旁路落地(commit-tree+CAS)不跑钩子,
 * 而工作区副本常年滞后 HEAD,拿它当输入会把别人在飞的行当成"被我删了"。
 *
 * 三态(§0.3):0 = 已判定(含零候选);2 = 未判定(父版/本版取不到、祖先问不到、台账写不进)。
 * 未判定一律**零入账**,不猜"它大概是没人删过"。
 *
 * 用法:
 *   node scripts/record-closure-drops.mjs [--sha <commit>] [--doc <path>] [--dry-run] [--json]
 *   node scripts/record-closure-drops.mjs --self-test
 */
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { git, isAncestor, LEDGER_DOC } from './lib/bypass-git.mjs'
import { requireFlagValue } from './lib/flag-value.mjs'
import { rowFormOf, recordFlipDrops, DROP_LEDGER_REL } from './lib/plan-drop-record.mjs'

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..')
export const RESULT_PREFIX = 'CLOSURE-DROP'
/** 具名席位(下游只认 rowBefore,席位用于人读与归因)。 */
export const SEAT = 'post-commit-closure-catch'
export const NOTE =
  'record-closure-drops 兜底入账:该枚提交删掉了未勾登记行但当时没有留痕(结清通道未接留痕腿),' +
  '现按父版逐字原文补记,供 scrub-declared-removals、union declaredDropCaps 与门 71 declaredExempt 认账'

/**
 * 父版→本版消失的未勾登记行(纯函数、零 IO)。
 * 按**多重集差**算,不按"这行还在不在"算:台账里逐字相同的短行成片存在,一份消失与两份消失
 * 若都读成"消失了",就会少记凭据 ⇒ 门 71 照旧回捞那几份。
 * 任一输入不是字符串 ⇒ null(未判定),不折叠成空集。
 */
export function droppedOpenRowsOf({ parentText, headText } = {}) {
  if (typeof parentText !== 'string' || typeof headText !== 'string') return null
  const headCount = new Map()
  for (const line of headText.split('\n')) {
    headCount.set(line, (headCount.get(line) ?? 0) + 1)
  }
  const parentCount = new Map()
  const order = []
  for (const line of parentText.split('\n')) {
    if (!parentCount.has(line)) {
      parentCount.set(line, 0)
      order.push(line)
    }
    parentCount.set(line, parentCount.get(line) + 1)
  }
  const rows = []
  for (const line of order) {
    if (rowFormOf(line) !== 'open') continue
    const gone = parentCount.get(line) - (headCount.get(line) ?? 0)
    for (let i = 0; i < gone; i++) rows.push(line)
  }
  return rows
}

function readFace(sha, doc, root) {
  return git(['show', `${sha}:${doc}`], { root, raw: true, allowFail: true })
}

/** 对一枚提交补留痕;返回 {rc, verdict, rows, res} —— rc 2 一律零入账。 */
export function catchUpForCommit({ sha, doc = LEDGER_DOC, root = ROOT, dryRun = false } = {}) {
  const full = git(['rev-parse', '--verify', '--quiet', `${sha}^{commit}`], {
    root,
    allowFail: true,
  })
  if (!full) return { rc: 2, verdict: 'undetermined', why: `提交 ${sha} 解析不到 ⇒ 未判定` }
  const headSha = git(['rev-parse', '--verify', 'HEAD'], { root, allowFail: true })
  if (!headSha) return { rc: 2, verdict: 'undetermined', why: 'HEAD 取不到 ⇒ 未判定' }
  const parentText = readFace(`${full}^`, doc, root)
  const headText = readFace(full, doc, root)
  if (typeof headText !== 'string')
    return {
      rc: 2,
      verdict: 'undetermined',
      why: `${doc} 在 ${full.slice(0, 11)} 面取不到 ⇒ 未判定`,
    }
  // 父版取不到有两种:该枚是根提交(合法,视作"父版为空"),或对象读不到(未判定)。
  let parentRows
  if (typeof parentText === 'string') {
    parentRows = droppedOpenRowsOf({ parentText, headText })
  } else {
    const parentRef = git(['rev-parse', '--verify', '--quiet', `${full}^`], {
      root,
      allowFail: true,
    })
    if (!parentRef) parentRows = droppedOpenRowsOf({ parentText: '', headText })
    else
      return {
        rc: 2,
        verdict: 'undetermined',
        why: `${doc} 在父版 ${full.slice(0, 11)}^ 取不到且父提交存在 ⇒ 未判定`,
      }
  }
  if (parentRows === null)
    return { rc: 2, verdict: 'undetermined', why: '形态尺输入不成文本 ⇒ 未判定' }
  if (parentRows.length === 0)
    return { rc: 0, verdict: 'none', rows: [], why: '本版相对父版未消失未勾登记行 ⇒ 零入账' }
  const ancestor = isAncestor(full, headSha, { root })
  if (ancestor === null)
    return { rc: 2, verdict: 'undetermined', why: '祖先关系问不到 ⇒ 未判定(零入账)' }
  if (ancestor === false)
    return {
      rc: 2,
      verdict: 'undetermined',
      why: `${full.slice(0, 11)} 不在 HEAD 祖先链上(已被后续覆盖?)⇒ 未判定(零入账)`,
    }
  if (dryRun)
    return {
      rc: 0,
      verdict: 'would-record',
      rows: parentRows,
      why: `--dry-run:${parentRows.length} 条候选未入账`,
    }
  const res = recordFlipDrops({
    root,
    doc,
    pairs: parentRows.map((before) => ({ before, after: null, drop: true })),
    landed: full,
    parent: git(['rev-parse', '--verify', '--quiet', `${full}^`], { root, allowFail: true }) || '',
    head: headSha,
    ancestor,
    seat: SEAT,
    note: NOTE,
  })
  for (const l of res.lines || []) console.log(`${l.level === 'error' ? '❌' : '·'} ${l.text}`)
  if (res.unjudged)
    return { rc: 2, verdict: 'undetermined', rows: parentRows, res, why: '落账出口判未判定' }
  if (!res.ok)
    return {
      rc: 2,
      verdict: 'undetermined',
      rows: parentRows,
      res,
      why: `写盘/凭据不成(ok=false,written=${res.written})`,
    }
  return {
    rc: 0,
    verdict: res.written > 0 ? 'recorded' : 'already-declared',
    rows: parentRows,
    res,
    why: `入账 ${res.written} 条 / 幂等跳过 ${(res.skipped || []).length} 条`,
  }
}

/** --self-test 夹具:全部走纯判据,零 git、零写盘。 */
export function selfTestCases() {
  const open = '- [ ] G-1 真工作一条'
  const openTwin = '- [ ] G-2 逐字相同的孪生'
  const closed = '- [x] G-3 已勾行'
  const prose = '  正文里提到 - [ ] 不算登记行(缩进非登记行形)'
  return [
    {
      name: '① 消失的未勾登记行被点名',
      run: () => {
        const r = droppedOpenRowsOf({ parentText: [open, closed].join('\n'), headText: closed })
        return r.length === 1 && r[0] === open
      },
    },
    {
      name: '② 已勾行删除不在射程(归清扫器,不得双写)',
      run: () => {
        const r = droppedOpenRowsOf({ parentText: closed, headText: '' })
        return r.length === 0
      },
    },
    {
      name: '③ 多重集差:父版两份本版一份 ⇒ 只记一份消失',
      run: () => {
        const r = droppedOpenRowsOf({
          parentText: [openTwin, openTwin].join('\n'),
          headText: openTwin,
        })
        return r.length === 1
      },
    },
    {
      name: '④ 父版两份本版零份 ⇒ 记两份(少记=门 71 照旧回捞)',
      run: () => {
        const r = droppedOpenRowsOf({ parentText: [openTwin, openTwin].join('\n'), headText: '' })
        return r.length === 2
      },
    },
    {
      name: '⑤ 非登记行不入账',
      run: () => {
        const r = droppedOpenRowsOf({ parentText: prose, headText: '' })
        return r.length === 0
      },
    },
    {
      name: '⑥ 输入取不到 ⇒ null(不折叠成"没人删过"的空集)',
      run: () => droppedOpenRowsOf({ parentText: undefined, headText: '' }) === null,
    },
    {
      name: '⑦ 行没动 ⇒ 零候选',
      run: () => {
        const t = [open, closed, openTwin].join('\n')
        return droppedOpenRowsOf({ parentText: t, headText: t }).length === 0
      },
    },
  ]
}

function runSelfTest() {
  const cases = selfTestCases()
  let pass = 0
  for (const c of cases) {
    let ok = false
    try {
      ok = c.run() === true
    } catch {
      ok = false
    }
    console.log(`${ok ? '  ✓' : '  ×'} ${c.name}`)
    if (ok) pass++
  }
  console.log(
    `${pass === cases.length ? '✅' : '❌'} [${RESULT_PREFIX}] self-test ${pass}/${cases.length}`,
  )
  return pass === cases.length ? 0 : 1
}

function parseArgv(argv) {
  const opts = { sha: 'HEAD', doc: LEDGER_DOC, dryRun: false, json: false }
  const valueFlags = [
    ['--sha', 'sha', '提交'],
    ['--doc', 'doc', '路径'],
  ]
  for (const [flag, key, noun] of valueFlags) {
    const f = requireFlagValue(argv, flag, { noun })
    if (f.error) return { error: f.error }
    if (f.present) opts[key] = f.value
  }
  const names = new Set(valueFlags.map(([f]) => f))
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (names.has(a)) {
      i++ // 它的值已由 requireFlagValue 取走,这里只跳过该 token,不再判一次
      continue
    }
    if (a === '--dry-run') opts.dryRun = true
    else if (a === '--json') opts.json = true
    else if (a === '--self-test') opts.selfTest = true
    else if (a === '--help' || a === '-h') opts.help = true
    else return { error: `不认识的参数 ${a}` }
  }
  return opts
}

function main() {
  const opts = parseArgv(process.argv.slice(2))
  if (opts.error) {
    console.error(`❌ [${RESULT_PREFIX}] ${opts.error}`)
    return 2
  }
  if (opts.help) {
    console.log(
      `用法: node scripts/record-closure-drops.mjs [--sha <commit>] [--doc <path>] [--dry-run] [--json]\n` +
        `      node scripts/record-closure-drops.mjs --self-test\n` +
        `职责: 把"某枚提交删掉却未入账的未勾登记行"补进 ${DROP_LEDGER_REL}(判定面不改)。`,
    )
    return 0
  }
  if (opts.selfTest) return runSelfTest()
  const r = catchUpForCommit({ sha: opts.sha, doc: opts.doc, root: ROOT, dryRun: opts.dryRun })
  if (opts.json) {
    console.log(
      JSON.stringify({
        verdict: r.verdict,
        why: r.why,
        candidates: r.rows?.length ?? 0,
        written: r.res?.written ?? 0,
        skipped: (r.res?.skipped || []).length,
      }),
    )
  } else {
    console.log(
      `${r.rc === 0 ? '✅' : '🛑'} [${RESULT_PREFIX}] state=${r.verdict} 候选=${r.rows?.length ?? 0}` +
        ` 入账=${r.res?.written ?? 0} 幂等跳过=${(r.res?.skipped || []).length} | ${r.why}`,
    )
  }
  return r.rc
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  process.exit(main())
}

export const __test__ = {
  droppedOpenRowsOf,
  catchUpForCommit,
  selfTestCases,
  SEAT,
  NOTE,
  RESULT_PREFIX,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
