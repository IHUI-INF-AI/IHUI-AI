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
 * 本器自己有**一条必须先答的危险**:补留痕 = 宣布"这行本侧已正当处置",而门 71 认逐字留痕且排在
 * 丢失判定之前 ⇒ 记了账的行**永远不会再被回捞**。所以一枚"用旧基线整片抹掉别人活行"的回退型提交
 * 若被顺手补上凭据,就是拿器物把真丢的行洗成已处置(§5b 记过 19339 行、§1 记过 350→1699 那一型)。
 * 牙 = `MAX_AUTO_CATCH` 单批上限(定档依据是现读的分布,不是拍的),超限一律未判定 + 零入账 + 给
 * 出路,要人先看再显式 `--max` 放宽;这一档与 §0.10 同向(失效只能"多问一次",不得"多放一次")。
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
 * 单批补凭据的条数上限(2026-10-28 立,是本器**自己**那条危险通道的牙)。
 *
 * 为什么非有不可:补留痕 = 宣布"这一行是本侧正当处置掉的",而门 71 的 `declaredExempt` 排在
 * 丢失判定**之前** ⇒ 一行一旦记进这本账,它就**永远不会再被回捞**。于是"该给谁补"必须收窄:
 * 一枚把别人整片活行抹掉的旧基线回退(§5b 记过 19339 行、§1 记过 350→1699 那一型)若被本器
 * 顺手"补了凭据",就是拿器物把**真丢的行**洗成已处置 —— 灾难方向与本器要修的那个缺陷同量级,
 * 而且失效方向是安静的(账面上只会更绿)。
 *
 * 上限不是拍的:现读锚点 = 最近 40 枚提交里只有 3 枚动过登记行、每枚各 1 条 ⇒ 合法结清是
 * "几条"量级;整片回退是"成百上千"量级。取 20 留足归并/批量摘副本的正常余量,又远低于回退型。
 * 超限 ⇒ 未判定 + 零入账 + 点名要求人先看过,再显式 `--max` 放宽(§0.10:失效方向只能是"多问一次")。
 */
export const MAX_AUTO_CATCH = 20

/** 上限判据(纯函数、零 IO)。`max` 非正整数 ⇒ 用法错,不得静默回落缺省。 */
export function judgeBatchLimit({ candidates, max = MAX_AUTO_CATCH } = {}) {
  const n = Number(candidates)
  const cap = Number(max)
  if (!Number.isInteger(cap) || cap < 1)
    return { ok: false, misuse: true, why: `上限值不是正整数(实得 ${String(max)})⇒ 用法错` }
  if (!Number.isInteger(n) || n < 0)
    return { ok: false, misuse: true, why: `候选数不成数(实得 ${String(candidates)})⇒ 用法错` }
  if (n > cap)
    return {
      ok: false,
      why:
        `候选 ${n} 条 > 上限 ${cap} ⇒ 这更像整片回退而不是结清,拒绝补凭据` +
        '(补了就等于永久放弃回捞那些可能真丢的行)。先查这枚提交到底干了什么;' +
        '确认合法再显式加 --max 放宽。',
    }
  return { ok: true, why: '' }
}

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

/**
 * merge 落点一律拒绝补凭据(纯函数、零 IO)。
 * 立因是本席预扫近 30 枚时量出来的:候选里混着一枚 `Merge origin/main …` —— 它"消失"的那行登记行
 * 不是谁结清的,而是**合并没带回对侧内容**,正是守门 100(新增丢失)/168(删除复活)与
 * union-converge 要救的那一型。给这种枚记留痕 = 宣布"本侧已正当处置" ⇒ 门 71 从此不再回捞,
 * 等于拿本器把真丢失洗成已处置。批量上限挡不住它(合并只吞一枚登记行时候选=1,远在 20 以内)。
 * 所以按**父数**判,不按候选数判:父数 ≥2 ⇒ 结构性拒绝,零入账。
 */
export function isMergeCommit(parentCount) {
  return Number.isFinite(parentCount) && parentCount >= 2
}

/**
 * 对一枚提交补留痕;返回 {rc, verdict, rows, res} —— rc 2 一律零入账。
 * merge 落点与超上限两种都在这里显式拒绝,不写盘、不记绿。
 */
export function catchUpForCommit({
  sha,
  doc = LEDGER_DOC,
  root = ROOT,
  dryRun = false,
  max = MAX_AUTO_CATCH,
} = {}) {
  const full = git(['rev-parse', '--verify', '--quiet', `${sha}^{commit}`], {
    root,
    allowFail: true,
  })
  if (!full) return { rc: 2, verdict: 'undetermined', why: `提交 ${sha} 解析不到 ⇒ 未判定` }
  const headSha = git(['rev-parse', '--verify', 'HEAD'], { root, allowFail: true })
  if (!headSha) return { rc: 2, verdict: 'undetermined', why: 'HEAD 取不到 ⇒ 未判定' }
  // merge 落点先拒(排在读大文件之前:既省 IO,也让"结构性不该补"这一档不因取面失败而被读成未判定)。
  const lineage = git(['rev-list', '--parents', '-1', full], { root, allowFail: true })
  if (lineage === null)
    return { rc: 2, verdict: 'undetermined', why: '父数问不到 ⇒ 未判定(零入账)' }
  const parentCount = lineage.trim().split(/\s+/).length - 1
  if (isMergeCommit(parentCount))
    return {
      rc: 2,
      verdict: 'merge-commit',
      rows: [],
      why:
        `该枚有 ${parentCount} 个父(merge 落点)⇒ 拒绝补凭据:合并没带回对侧内容不是结清,` +
        '而是守门 100/168 与 union-converge 要救的那一型;记了留痕就等于把真丢失洗成"已处置"。',
    }
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
  // 批量上限的牙必须在**任何写盘之前**,也必须在 dry-run 之前 —— 否则 `--dry-run` 会说"将会入账"
  // 一批根本不该入账的行,把危险通道读成正常。
  const cap = judgeBatchLimit({ candidates: parentRows.length, max })
  if (cap.misuse) return { rc: 2, verdict: 'undetermined', rows: parentRows, why: cap.why }
  if (!cap.ok) return { rc: 2, verdict: 'over-limit', rows: parentRows, why: cap.why }
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
    {
      name: '⑧ 超限 ⇒ 拒绝补凭据(整片回退不许被洗成"已处置")',
      run: () => {
        const r = judgeBatchLimit({ candidates: MAX_AUTO_CATCH + 1, max: MAX_AUTO_CATCH })
        return r.ok === false && typeof r.why === 'string' && r.why.length > 10
      },
    },
    {
      name: '⑨ 恰好顶到上限 ⇒ 放行(边界不得多拦一条)',
      run: () => judgeBatchLimit({ candidates: MAX_AUTO_CATCH, max: MAX_AUTO_CATCH }).ok === true,
    },
    {
      name: '⑩ 上限值不是正整数 ⇒ 用法错,不静默回落缺省',
      run: () =>
        judgeBatchLimit({ candidates: 1, max: 'abc' }).misuse === true &&
        judgeBatchLimit({ candidates: 1, max: 0 }).misuse === true &&
        judgeBatchLimit({ candidates: 1, max: 2.5 }).misuse === true,
    },
    {
      name: '⑪ merge 落点判据:两父即拒(合并吞行不是结清),单父/根/问不到都不拒判',
      run: () =>
        isMergeCommit(2) === true &&
        isMergeCommit(3) === true &&
        isMergeCommit(1) === false &&
        isMergeCommit(0) === false &&
        isMergeCommit(null) === false &&
        isMergeCommit(undefined) === false,
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
  const opts = { sha: 'HEAD', doc: LEDGER_DOC, max: MAX_AUTO_CATCH, dryRun: false, json: false }
  const valueFlags = [
    ['--sha', 'sha', '提交'],
    ['--doc', 'doc', '路径'],
    ['--max', 'max', '正整数条数上限'],
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
        `职责: 把"某枚提交删掉却未入账的未勾登记行"补进 ${DROP_LEDGER_REL}(判定面不改)。\n` +
        `批量上限: 单批最多 ${MAX_AUTO_CATCH} 条;超限 ⇒ 未判定 + 零入账(补凭据=放弃回捞,整片回退型不许补)。\n` +
        `          确认那枚提交是合法批量摘除后,显式加 --max <正整数> 放宽。`,
    )
    return 0
  }
  if (opts.selfTest) return runSelfTest()
  const r = catchUpForCommit({
    sha: opts.sha,
    doc: opts.doc,
    root: ROOT,
    dryRun: opts.dryRun,
    max: opts.max,
  })
  if (r.verdict === 'over-limit')
    console.error(
      `🔧 出路(是"多问一次",不是"多放一次"):先跑 node scripts/check-plan-line-loss.mjs 看这枚提交` +
        `被判缺的到底是哪些行;确认这些行确属正当批量摘除,再带 --max <条数> 复跑本器。`,
    )
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
  judgeBatchLimit,
  isMergeCommit,
  selfTestCases,
  MAX_AUTO_CATCH,
  SEAT,
  NOTE,
  RESULT_PREFIX,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
