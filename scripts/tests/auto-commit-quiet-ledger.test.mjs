// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 收编器「账本收编族」镜像测试(2026-11-03 立;§22c:判据一律 import 生产出口,本文件零复制判定)。
 *
 * 立因:守护 7 条跨端写盘腿每 30 分钟真写工作树,注释承诺「落库交给 auto-commit-quiet」,
 * 而收编侧白名单(f6e0ba44a9 那次收窄是对的)不收业务代码 ⇒ 写了盘永远悬挂。
 * 正解不是放宽白名单,而是**验过才收**:落点账本在册 ∧ blob 逐字节相符 ∧ 超静默期。
 *
 * 本档钉死的设计全部价值在**否定例**上:
 *   · contested ⇒ 临时仓**零新增提交**(副作用没发生才算拦住,而不是只报个数);
 *   · quiet / unjudged / 活文档护栏 / 去重 ⇒ 同样零提交;
 *   · 阳性对照逐条配好(证明尺没失灵、也证明不是白名单被放宽)。
 * 夹具一律 mkScratch(§15b,不落仓库树内;守门 208),git 派生一律 face-reader.gitRaw(§12g)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitRaw } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { appendLanding, collectiblePaths, ledgerPathFor } from '../lib/cross-end-landing-ledger.mjs'
import { detectPollution, parseCommitMessage } from '../check-commit-scope-consistency.mjs'
import { __test__ as auto } from '../auto-commit-quiet.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC = readFileSync(join(REPO, 'scripts', 'auto-commit-quiet.mjs'), 'utf8')
const QUIET = 3 * 60 * 1000
/** 白名单族必然判 false 的业务代码形态(每枚阳性对照都靠它:新族收编它 ≠ 白名单放宽)。 */
const BUSINESS_PATH = 'apps/demo/src/screens/HomeScreen.tsx'

const agedIso = (minAgo = 10) => new Date(Date.now() - minAgo * 60_000).toISOString()
const norm = (p) => String(p).replace(/\\/g, '/')

function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text)
  return abs
}
function hash(dir, rel) {
  return String(gitRaw(['hash-object', '--', norm(rel)], dir)).trim().toLowerCase()
}
function commitCount(dir) {
  try {
    return Number(String(gitRaw(['rev-list', '--count', 'HEAD'], dir)).trim())
  } catch {
    return 0
  }
}
/** HEAD 那枚提交动了哪些路径(多重集;证"提交内容只含这一条"就靠它)。 */
function filesOfHead(dir) {
  const out = String(gitRaw(['show', '--name-only', '--format=', 'HEAD'], dir))
  return out.split(/\r?\n/).filter(Boolean).map(norm)
}
/** subject 走 stdin(-F -):中文标题不经 argv 码页,读回来也按 utf8 直取。 */
function commitMessageOfHead(dir) {
  return String(gitRaw(['log', '-1', '--format=%s'], dir)).trim()
}

/** 独立临时 git 仓(带一枚初始提交,rev-list/HEAD 都问得到)。 */
function newRepo() {
  const dir = mkScratch('quiet-collect-')
  gitRaw(['init', '-q', '-b', 'main'], dir)
  gitRaw(['config', 'user.name', 'ihui-test'], dir)
  gitRaw(['config', 'user.email', 'ihui-test@example.invalid'], dir)
  gitRaw(['config', 'commit.gpgsign', 'false'], dir)
  put(dir, 'README.md', '# demo\n')
  gitRaw(['add', '-A'], dir)
  gitRaw(['commit', '-q', '-m', 'init'], dir)
  return dir
}

/**
 * 提交通道替身:**真**在临时仓 add+commit(pathspec 限定,绝不 -A 全扫),
 * 于是"零提交"是量出来的仓内提交枚数,不是替身自己的记账。
 * 生产默认通道仍是 auto.__test__.commitBatch(spawn safe-commit.mjs);这里只是测试注入面。
 */
function makeCommitSpy(dir) {
  const calls = []
  const commit = (paths, message) => {
    calls.push({ paths: paths.map(norm), message })
    gitRaw(['add', '-A', '--', ...paths], dir)
    gitRaw(['commit', '-q', '-F', '-'], dir, { input: `${message}\n` })
    // 与生产 commitBatch 同契约(2026-11-05:结论行的 collected 只认提交真成功的枚数,
    // 替身若不回报,本轮就会被读成"一枚没入" ⇒ 契约必须显式履行,不靠"返回空当成功")。
    return { attempted: paths.length, landed: paths.length, blocker: null }
  }
  return { calls, commit }
}

/** 跑账本族(默认关掉 busy 闸与真 safe-commit 通道;日志收进数组供机读断言)。 */
function runLedger(dir, opts = {}) {
  const spy = makeCommitSpy(dir)
  const lines = []
  const r = auto.runLedgerFamily({
    root: dir,
    now: new Date(),
    quietMs: QUIET,
    dry: false,
    busyCheck: () => null,
    commit: spy.commit,
    logLine: (l) => lines.push(String(l)),
    ...opts,
  })
  return { r, spy, lines }
}

/** 登记一条真产出(写盘 → 量 hash → appendLanding),返回登记用的 oid。 */
function declare(dir, rel, text, at = agedIso(10), leg = 'sweepRnHostShells') {
  put(dir, rel, text)
  const blobOid = hash(dir, rel)
  const ap = appendLanding([{ at, leg, path: rel, blobOid }], { root: dir })
  assert.deepEqual(ap, { appended: 1, rejected: [], deduped: 0 }, '夹具登记必须成功')
  return blobOid
}

/**
 * 按结构配平取函数体(禁止用行号邻近当证据 —— 行号一次 append 就挪位)。
 * 先配平**参数表的圆括号**,再从其后第一个 `{` 起配平花括号:默认参数里就有对象字面量
 * (`function f(tally = { collected: 0 })`),直接从第一个 `{` 配平会在参数表处提前收尾。
 */
function bodyOf(src, header) {
  const start = src.indexOf(header)
  assert.ok(start >= 0, `必须找得到 ${header}`)
  let i = src.indexOf('(', start)
  assert.ok(i > start, `${header} 必须带参数表`)
  let pd = 0
  for (; i < src.length; i++) {
    if (src[i] === '(') pd++
    else if (src[i] === ')') {
      pd--
      if (pd === 0) {
        i += 1
        break
      }
    }
  }
  const braceStart = src.indexOf('{', i)
  assert.ok(braceStart > i, `${header} 之后必须找到函数体开括号`)
  let depth = 0
  for (let j = braceStart; j < src.length; j++) {
    const ch = src[j]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return src.slice(start, j + 1)
    }
  }
  assert.fail(`${header} 的函数体括号配不平`)
}

const CONCLUSION_KEYS = [
  'ledger=',
  'collected=',
  'ledgerCollected=',
  'quiet=',
  'contested=',
  'incomplete=',
  'ignored=',
  'held=',
]

// ─── 阳性主证 ────────────────────────────────────────────────────────────────

test('T1 账本在册 + blob 相符 + 超静默 ⇒ 真提交进临时仓,且提交内容只含这一条', () => {
  const dir = newRepo()
  try {
    // 阳性对照:白名单族对同一路径判 false ⇒ 收编成功只能归功于新族,不是白名单被放宽。
    assert.equal(auto.isCollectible(BUSINESS_PATH), false, '白名单必须仍不收业务代码')
    assert.equal(auto.partitionCollectible([BUSINESS_PATH]).collected.length, 0)

    const before = commitCount(dir)
    declare(dir, BUSINESS_PATH, 'export const HomeScreen = () => null\n')
    const { r, spy, lines } = runLedger(dir)

    assert.equal(r.ledger, 'ok')
    assert.equal(r.ledgerCollected, 1)
    assert.equal(spy.calls.length, 1, '必须真的走了一次提交通道')
    assert.deepEqual(spy.calls[0].paths, [BUSINESS_PATH])
    assert.equal(commitCount(dir), before + 1, '临时仓必须多出这一枚提交')
    assert.deepEqual(filesOfHead(dir), [BUSINESS_PATH], '提交内容必须只含这一条')
    assert.match(
      commitMessageOfHead(dir),
      /^chore\(cross-end\): 收编守护落档产出\(1 件,凭落点账本\)$/,
      '标题必须与白名单族不同批次不同标题,且不撞 commit-msg 的 scope 门',
    )
    const conclusion = lines.find((l) => l.startsWith('COLLECT-RESULT'))
    assert.ok(conclusion, `必须有结论行,实得:${lines.join(' | ')}`)
    assert.match(conclusion, /ledger=ok/)
    assert.match(conclusion, /collected=1/)
    assert.match(conclusion, /ledgerCollected=1/)
    assert.match(conclusion, /dry=false/)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

// ─── 否定例(本设计的全部价值)────────────────────────────────────────────

test('T2 登记后文件被改一行 ⇒ contested,临时仓零新增提交(副作用没发生)', () => {
  const dir = newRepo()
  try {
    declare(dir, BUSINESS_PATH, 'export const a = 1\n')
    // 守护腿之外又有人动了一行 ⇒ 落点 blob 不再等于登记 blobOid
    put(dir, BUSINESS_PATH, 'export const a = 1\nexport const b = 2\n')

    const before = commitCount(dir)
    const { r, spy, lines } = runLedger(dir)

    assert.equal(r.ledger, 'ok', '账本读到了,只是这一枚不符')
    assert.equal(r.contested, 1)
    assert.equal(r.collectible ? r.collectible.length : 0, 0)
    assert.equal(r.ledgerCollected, 0)
    assert.equal(spy.calls.length, 0, 'contested 一条都不许交通道')
    assert.equal(commitCount(dir), before, '临时仓必须一枚提交都没多出来(这才叫拦住)')
    assert.ok(
      lines.some((l) => l.includes('账本族 contested 逐条点名') && l.includes(BUSINESS_PATH)),
      'contested 必须逐条点名(带路径),不能只报总数',
    )
    // 阳性对照:同夹具把改动还原(内容与登记一致)⇒ 通道立刻被走到,证明不是夹具失灵
    put(dir, BUSINESS_PATH, 'export const a = 1\n')
    const back = runLedger(dir)
    assert.equal(back.r.ledgerCollected, 1, '还原后必须收编(否则尺是哑的)')
    assert.equal(back.r.contested, 0)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T2b 双检臂:库那一检放行(face=head)而工作树已改 ⇒ 本器第二检拦下,零提交', () => {
  const dir = newRepo()
  try {
    // 先让 v1 入库(HEAD 面 blob 即登记值),再把工作树改成 v2 ⇒ 库按 head 面判"相符"。
    put(dir, BUSINESS_PATH, 'v1\n')
    gitRaw(['add', '-A', '--', BUSINESS_PATH], dir)
    gitRaw(['commit', '-q', '-m', 'seed'], dir)
    const oid = hash(dir, BUSINESS_PATH)
    const ap = appendLanding(
      [{ at: agedIso(10), leg: 'sweepMiniappStyleTiers', path: BUSINESS_PATH, blobOid: oid }],
      { root: dir },
    )
    assert.deepEqual(ap, { appended: 1, rejected: [], deduped: 0 })
    put(dir, BUSINESS_PATH, 'v2 收编途中被改\n')

    const gate = collectiblePaths(new Date(), { quietMs: QUIET, root: dir, face: 'head' })
    assert.equal(gate.ok, true)
    assert.equal(gate.collectible.length, 1, '对照:库那一检(face=head)确实放行了这一枚')

    const before = commitCount(dir)
    const { r, spy } = runLedger(dir, { face: 'head' })
    assert.equal(r.contested, 1, '本器落地前的第二检必须把它拦下来')
    assert.equal(r.ledgerCollected, 0)
    assert.equal(spy.calls.length, 0)
    assert.equal(commitCount(dir), before, '双检不过 ⇒ 临时仓零新增提交')
    const entries = auto.collectLedgerEntries(new Date(), { root: dir, face: 'head', quietMs: QUIET })
    assert.equal(entries.contested[0].stage, 'recheck-before-commit', '点名必须带臂次')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T3 未到静默期 ⇒ quiet,零提交(与白名单族同一把尺,不因来源不同而放宽)', () => {
  const dir = newRepo()
  try {
    declare(dir, BUSINESS_PATH, 'x\n', agedIso(1)) // 1 分钟前 < 3 分钟静默期
    const before = commitCount(dir)
    const { r, spy, lines } = runLedger(dir)
    assert.equal(r.ledger, 'ok')
    assert.equal(r.quiet, 1)
    assert.equal(r.ledgerCollected, 0)
    assert.equal(spy.calls.length, 0)
    assert.equal(commitCount(dir), before)
    assert.ok(lines.some((l) => l.includes('账本族 quiet(未到静默期)逐条点名')))
    // 阳性对照:同一枚把时刻改老 ⇒ 立刻可收编
    const aged = runLedger(dir, { quietMs: 30_000 })
    assert.equal(aged.r.ledgerCollected, 1)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T4 账本不存在 ⇒ ledger=unjudged 且零提交;白名单族同轮判据一字未变', () => {
  const dir = newRepo()
  try {
    assert.equal(ledgerPathFor(dir), join(dir, '.ihui-agent', 'state', 'cross-end-landing.jsonl'))
    assert.ok(!readFileSyncExists(dir))
    const before = commitCount(dir)
    const { r, spy, lines } = runLedger(dir)

    assert.equal(r.ledger, 'unjudged', '取不到输入 ⇒ 未判定,不得记绿也不得当成"没有待收"')
    assert.ok(r.reason && r.reason.includes('not-found'), `reason 必须点名,实得:${r.reason}`)
    assert.equal(r.ledgerCollected, 0)
    assert.equal(spy.calls.length, 0)
    assert.equal(commitCount(dir), before)
    const conclusion = lines.find((l) => l.startsWith('COLLECT-RESULT'))
    assert.match(conclusion, /ledger=unjudged/)
    assert.match(conclusion, /ledgerCollected=0/)
    assert.match(
      conclusion,
      /whitelistCollected=0/,
      '结论行每个键都必须是**数**,不得让 undefined 漏进机读面(实测踩过一次)',
    )
    assert.match(conclusion, /reason=/, '未判定必须带原因进机读行')

    // 两族互不干扰:白名单族的判据一字未动(派生产物仍收、业务代码仍不收)。
    assert.equal(auto.isCollectible('README.md'), true)
    assert.equal(auto.isCollectible('apps/web/src/lib/ui-routes.generated.ts'), true)
    assert.equal(auto.isCollectible('apps/api/src/routes/relay-account.ts'), false)
    assert.equal(auto.isCollectible('PROJECT_PLAN.md'), false)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})
function readFileSyncExists(dir) {
  try {
    readFileSync(ledgerPathFor(dir), 'utf8')
    return true
  } catch {
    return false
  }
}

test('T5 白名单族命中的同路径 ⇒ 账本族去重让路,绝不重复提交同一路径', () => {
  const dir = newRepo()
  try {
    declare(dir, 'README.md', '# README 被守护腿刷过\n')
    const before = commitCount(dir)
    const { r, spy } = runLedger(dir, { whitelistPaths: new Set(['README.md']) })
    assert.equal(r.deduped, 1)
    assert.equal(r.ledgerCollected, 0)
    assert.equal(spy.calls.length, 0, '已归白名单族的路径不得再交账本族通道')
    assert.equal(commitCount(dir), before)

    // 阳性对照:同一枚不给 whitelistPaths ⇒ 通道被走到(证明去重真起作用,不是路径本身被别的闸拦下)。
    // README 自 2026-11-05 起也是活文档面(与 PROJECT_PLAN/AGENTS 同一把尺),所以这一臂要把闸判绿:
    // 要验的是"去重基准来自 whitelistPaths",不是"活文档闸放不放行"(后者由 T26 单独钉)。
    const open = runLedger(dir, { liveDocGuard: () => ({ ok: true }) })
    assert.equal(open.r.ledgerCollected, 1)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T6 活文档必须过同批护栏(mergeLiveDoc+scrub),不过即让路;同批业务件仍正常收编(对照)', () => {
  const dir = newRepo()
  try {
    declare(dir, 'AGENTS.md', '# 活文档(账本申报它,但护栏器物在临时仓里取不到 ⇒ 必须让路)\n')
    declare(dir, BUSINESS_PATH, 'export const ok = 1\n')
    const before = commitCount(dir)
    const { r, spy } = runLedger(dir)

    assert.equal(r.held, 1, '活文档必须计入 held 并点名')
    assert.equal(r.ledgerCollected, 1, '同批的业务件必须照收(不得因活文档让路而整批停摆)')
    assert.equal(spy.calls.length, 1)
    assert.deepEqual(spy.calls[0].paths, [BUSINESS_PATH], '提交集里绝不能出现 AGENTS.md')
    assert.equal(commitCount(dir), before + 1)
    assert.deepEqual(filesOfHead(dir), [BUSINESS_PATH])
    assert.ok(
      !filesOfHead(dir).includes('AGENTS.md'),
      '活文档从账本族入库 = 绕过了归并/复洁链,这一条就是本设计的事故面',
    )
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T7 MAX_PATHS 分批护栏同样作用于账本族(超上限只收前 N 枚,余量计入 held)', () => {
  const dir = newRepo()
  try {
    for (const seg of ['web', 'api', 'cli']) declare(dir, `apps/${seg}/src/x.ts`, `${seg}\n`)
    const before = commitCount(dir)
    const { r, spy } = runLedger(dir, { maxPaths: 2 })
    assert.equal(r.ledgerCollected, 2)
    assert.equal(r.held, 1, '超出单轮上限的那一枚必须计入 held(让位下一轮,不是丢掉)')
    assert.equal(spy.calls.reduce((n, c) => n + c.paths.length, 0), 2)
    assert.equal(commitCount(dir), before + 1)
    assert.equal(filesOfHead(dir).length, 2)
    // 端数是按**本轮这一批**数的(切完才判),所以 web+api 这批仍是 cross-end;
    // ≥3 端整批才降级为无 scope 聚合 —— 那一刀由 T11 按门的判据钉住。
    assert.equal(parseCommitMessage(spy.calls[0].message).scope, 'cross-end')
    assert.match(spy.calls[0].message, /^chore\(cross-end\): 收编守护落档产出\(2 件,凭落点账本\)$/)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T7b 三端整批真跑:标题必须降级为无 scope 聚合,且门判不红(R3 明文允许)', () => {
  const dir = newRepo()
  try {
    for (const seg of ['web', 'api', 'cli']) declare(dir, `apps/${seg}/src/y.ts`, `${seg}\n`)
    const { r, spy } = runLedger(dir)
    assert.equal(r.ledgerCollected, 3)
    assert.equal(spy.calls.length, 1, '非 i18n 批只该一枚提交')
    assert.equal(parseCommitMessage(spy.calls[0].message).scope, null)
    assert.match(spy.calls[0].message, /^chore: 收编守护落档产出\(3 件,凭落点账本\)$/)
    assert.equal(detectPollution(spy.calls[0].paths, parseCommitMessage(spy.calls[0].message).scope).block, false)
    // 反向例:同批硬套 cross-end ⇒ 必红(证明降级不是白写的,判据也没被削)
    assert.equal(detectPollution(spy.calls[0].paths, 'cross-end').block, true)
    assert.deepEqual(filesOfHead(dir).sort(), ['apps/api/src/y.ts', 'apps/cli/src/y.ts', 'apps/web/src/y.ts'])
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T8 busy 闸在落地前再问一次:守门批正在写 ⇒ 一条不交,可收编枚数计入 held', () => {
  const dir = newRepo()
  try {
    declare(dir, BUSINESS_PATH, 'x\n')
    const before = commitCount(dir)
    const { r, spy } = runLedger(dir, { busyCheck: () => 'index.lock 在用' })
    assert.equal(r.ledgerCollected, 0)
    assert.equal(r.held, 1)
    assert.equal(spy.calls.length, 0)
    assert.equal(commitCount(dir), before)
    assert.ok(r.reason.includes('busy'))
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T9 dry-run 只判定不写盘:通道零调用,结论行仍报全读数', () => {
  const dir = newRepo()
  try {
    declare(dir, BUSINESS_PATH, 'x\n')
    const before = commitCount(dir)
    const { r, spy, lines } = runLedger(dir, { dry: true })
    assert.equal(r.ledgerCollected, 0)
    assert.equal(spy.calls.length, 0)
    assert.equal(commitCount(dir), before)
    assert.match(lines.find((l) => l.startsWith('COLLECT-RESULT')), /dry=true/)
    assert.ok(lines.some((l) => l.includes('dry-run:账本族可收编 1 枚不提交')))
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T10 incomplete 点名:缺 blobOid 的行不得进收编,键缺失清单必须逐条报出', () => {
  const dir = newRepo()
  try {
    mkdirSync(dirname(ledgerPathFor(dir)), { recursive: true })
    writeFileSync(
      ledgerPathFor(dir),
      `${JSON.stringify({ at: agedIso(10), leg: 'sweepWeb', path: 'apps/web/src/a.ts' })}\n`,
      'utf8',
    )
    const before = commitCount(dir)
    const { r, spy, lines } = runLedger(dir)
    assert.equal(r.incomplete, 1)
    assert.equal(r.ledgerCollected, 0)
    assert.equal(spy.calls.length, 0)
    assert.equal(commitCount(dir), before)
    assert.ok(lines.some((l) => l.includes('incomplete') && l.includes('blobOid')), '必须点名缺哪个键')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

// ─── 标题与门形态(复用门自己的判据,不复制规则)────────────────────────────

test('T11 标题形态必须过 commit-msg 的污染签名(i18n 批/跨端批各归各位)', () => {
  const i18nBatch = [
    'packages/i18n/messages/web/en.json',
    'packages/i18n/messages/web/ja.json',
    'apps/web/src/i18n/generated/zh-cn-pack.gen.ts',
    'apps/miniapp-taro/src/i18n/generated/zh-cn-pack.gen.ts',
  ]
  const { i18n, rest } = auto.partitionI18nBatch(i18nBatch)
  const mI18n = auto.ledgerCommitMessage(i18n, 'i18n')
  const mRest = auto.ledgerCommitMessage(rest, 'rest')
  assert.equal(detectPollution(i18n, parseCommitMessage(mI18n).scope).block, false, 'i18n 批必红 = 刀没切对')
  assert.equal(detectPollution(rest, parseCommitMessage(mRest).scope).block, false)
  assert.equal(parseCommitMessage(mI18n).scope, 'i18n')

  // ≥3 个 apps 端:cross-end 不在跨切白名单 ⇒ 必降级为无 scope 聚合(chore: 是 R3 明文允许的形态)
  const wide = ['apps/web/a.ts', 'apps/api/b.ts', 'apps/cli/c.ts']
  assert.equal(appsSegmentsOfSafe(wide), 3)
  const mWide = auto.ledgerCommitMessage(wide, 'rest')
  assert.equal(parseCommitMessage(mWide).type, 'chore')
  assert.equal(parseCommitMessage(mWide).scope, null)
  assert.equal(detectPollution(wide, parseCommitMessage(mWide).scope).block, false)

  // 反向例:同批硬套 chore(cross-end) ⇒ R3 判红(证明降级那一刀不是白写的)
  assert.equal(detectPollution(wide, 'cross-end').block, true)
  // 两枚端内批仍用 cross-end(既有高频形态,现读 git log 近 500 枚 40 次)
  const narrow = auto.ledgerCommitMessage(['apps/web/a.ts', 'apps/api/b.ts'], 'rest')
  assert.match(narrow, /^chore\(cross-end\): 收编守护落档产出\(2 件,凭落点账本\)$/)
})
function appsSegmentsOfSafe(paths) {
  return auto.appsSegmentsOf(paths)
}

test('T12 结论行键集齐全且顺序无关(机读消费方靠键名取数)', () => {
  const line = auto.ledgerConclusionLine({
    ledger: 'ok',
    collected: 3,
    whitelistCollected: 2,
    ledgerCollected: 1,
    quiet: 4,
    contested: 5,
    incomplete: 6,
    ignored: 7,
    deduped: 8,
    held: 9,
    dry: false,
  })
  for (const k of CONCLUSION_KEYS) assert.ok(line.includes(` ${k}`), `结论行缺 ${k}:${line}`)
  assert.match(line, /^COLLECT-RESULT ledger=ok collected=3 whitelistCollected=2 ledgerCollected=1/)
  const un = auto.ledgerConclusionLine({
    ledger: 'unjudged',
    collected: 0,
    whitelistCollected: 0,
    ledgerCollected: 0,
    quiet: 0,
    contested: 0,
    incomplete: 0,
    ignored: 0,
    deduped: 0,
    held: 0,
    dry: false,
    reason: 'not-found:x',
  })
  assert.match(un, /ledger=unjudged .*ledgerCollected=0/)
  assert.match(un, /reason=not-found:x/)
})

// ─── 装车锁与红线 ────────────────────────────────────────────────────────────

test('T13 形状锁:双检必须在 collectLedgerEntries 体内,且取 oid 走 face-reader 出口', () => {
  const body = bodyOf(SRC, 'export function collectLedgerEntries(')
  assert.ok(body.length > 400, '必须取到函数体本身(防空串假绿)')
  assert.match(body, /collectiblePaths\(/, '准入判据必须问库,不得在收编侧复算')
  assert.match(body, /worktreeBlobOid\(/, '落地前的第二检必须真在体内(不是只在注释里)')
  assert.match(body, /stage: 'recheck-before-commit'/, '双检失败必须标臂次')
  assert.match(body, /contested\.push/, '双检失败必须并入 contested,不得静默剔')
  assert.match(body, /ledger: 'unjudged'/, '取不到输入 ⇒ 未判定(§0.3)')
  assert.doesNotMatch(body, /isCollectible\(/, '账本族不得借道白名单判据(两族互不干扰)')

  const probe = bodyOf(SRC, 'function worktreeBlobOid(')
  assert.match(probe, /gitRaw\(/, '取 oid 必须走 scripts/lib/face-reader.mjs 的出口(§12g)')
  assert.match(probe, /'hash-object'/, '与库内 currentOidsForFace 同一条 git 出口(两把尺同形)')
  assert.doesNotMatch(probe, /execFileSync\(\s*'git'/, '不得在本层裸起 git')
})

test('T14 接线锁:账本族必须真挂在 main 里,且白名单族从任何早退出去都不短路它', () => {
  const m = bodyOf(SRC, 'function main()')
  assert.match(m, /runWhitelistFamily\(tally\)/, '白名单族仍是第一条通道')
  assert.match(m, /finally\s*\{[\s\S]*?runLedgerFamily\(/, '账本族必须在 finally 里(①的早退不得短路②)')
  assert.match(m, /whitelistPaths:\s*tally\.paths/, '去重基准必须来自白名单族本轮集合')
  const wl = bodyOf(SRC, 'function runWhitelistFamily(')
  // 2026-11-05 改这条锁的钉法(意图不变,口径变诚实):`collected` 必须是**两族真入库**的合计,
  // 而"挑了但被门拦下"的枚数必须单列 blocked 并点名拦路者 —— 旧钉法把"本批枚数"直接当 collected,
  // 正是"被无关全局面红门整批拦死却在机读面上长得像收得很好"的成因(现读:账本 229 条申报
  // 带 landedSha 的 0 条,而结论行连日报 collected=10x)。
  assert.match(wl, /tally\.collected = wlLanded/, '总结论行的 collected 必须只认提交真成功的枚数')
  assert.match(wl, /tally\.blocked = wlBlocked/, '被拦枚数必须单列,不许并进 held(held 另有语义)')
  assert.match(wl, /tally\.blocker \?\?=|blocker = /, '拦路者必须被记名')

  const fam = bodyOf(SRC, 'export function runLedgerFamily(')
  for (const needle of [
    'collectLedgerEntries(',
    'busyCheck()',
    'HUMAN_LEDGER_RE.test(',
    'maxPaths',
    'partitionI18nBatch(',
    'ledgerCommitMessage(',
    'commit(',
  ])
    assert.ok(fam.includes(needle), `账本族缺既有护栏复用:${needle}`)
  assert.doesNotMatch(fam, /git\s+commit|execFileSync\([^)]*'commit'/, '本族不得自开第二套提交通道')
  assert.doesNotMatch(fam, /git-push-guard.mjs|'push'/, '推送腿仍归 post-commit,本器不自带(§16b/§20 契约)')
})

test('T15 红线锁:白名单数组本体与 HEAD 面逐字节相同(一条都没放宽)', () => {
  const slice = (text) => {
    const s = text.indexOf('const COLLECT_WHITELIST = [')
    assert.ok(s >= 0, '白名单数组必须还在源码里')
    const e = text.indexOf(String.fromCharCode(10) + ']', s)
    assert.ok(e > s, '必须取到整个数组闭合')
    return text.slice(s, e + 1)
  }
  const headSrc = String(gitRaw(['show', 'HEAD:scripts/auto-commit-quiet.mjs'], REPO))
  assert.ok(headSrc.length > 1000, 'HEAD 面必须取到原文(取不到 ⇒ 本条未判定,不得假绿)')
  assert.equal(slice(SRC), slice(headSrc), '白名单条目被改动 = 触碰本次任务的红线')
})

// ─── 结论行纪律(2026-11-03 追加;§0.3/§0.9:每一条退出路径都必须出声到 stdout)──
// 立因:守护 sweepCrossEndLandingLeg 派 `node scripts/auto-commit-quiet.mjs` 后按
// `COLLECT-RESULT` 前缀解析 stdout,而该器实测 `--dry-run` **stdout 0 行** —— 器物在工作,
// 消费者却只能记"未判定"。以下用例全部走**直跑子进程**(结论行必须达 stdout 这一事实,
// import 形态的结构断言替代不了);ROOT 由 IHUI_AUTO_COMMIT_QUIET_TEST_ROOT 钉到 mkScratch
// 临时仓(生产/守护派发从不设置该变量 ⇒ 生产形态逐字节同形),绝不碰真实工作树。

const SCRIPT = join(REPO, 'scripts', 'auto-commit-quiet.mjs')

function subRun(dir, args = [], extraEnv = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'], // §12g:派生必须显式 stdio
    env: { ...process.env, IHUI_AUTO_COMMIT_QUIET_TEST_ROOT: dir, ...extraEnv },
  })
}

/** stdout 上必须**恰有一行**以 COLLECT-RESULT 起头(不多不少;多行=消费者会读到串轮)。 */
function onlyConclusion(stdout) {
  const hits = String(stdout ?? '')
    .split(/\r?\n/)
    .filter((l) => l.startsWith('COLLECT-RESULT'))
  assert.equal(hits.length, 1, `stdout 必须恰有一行 COLLECT-RESULT,实得 ${hits.length} 行:\n${stdout}`)
  return hits[0]
}

test('T16 直跑子进程 --dry-run 于"无事发生"面(干净仓+账本不存在)⇒ stdout 恰一行,reason 点名两型', () => {
  const dir = newRepo()
  try {
    const p = subRun(dir, ['--dry-run'])
    assert.equal(p.status, 0, `退出码必须仍为 0(本次红线:不改退出码语义),stderr:${p.stderr}`)
    const line = onlyConclusion(p.stdout)
    // 账本不存在 ⇒ ledger=unjudged(§0.3,不得折成"没有待收")
    assert.match(line, /ledger=unjudged/)
    assert.match(line, /reason=\S*not-found/, '未判定必须把 not-found 写进机读 reason')
    // git status 干净 ⇒ 白名单族的具体形态码(不是"skipped"这种读不出的词)
    assert.match(line, /reason=\S*no-changes/)
    assert.match(line, /collected=0/)
    assert.match(line, /dry=true/)
    // 阳性对照(尺能读出非零):同一夹具登记一条真凭据 ⇒ quiet 桶立刻非零
    declare(dir, BUSINESS_PATH, 'export const v = 1\n', agedIso(1)) // 1 分钟前 < 3 分钟静默期
    const q = onlyConclusion(subRun(dir, ['--dry-run']).stdout)
    assert.match(q, /ledger=ok/)
    assert.match(q, /quiet=1/, '同一把尺必须能读出非零读数 ⇒ T16 的 0 是量出来的,不是哑的')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T17 guardBusy 让路(index.lock 真实构造)⇒ 仍恰出一行,reason 点名 busy-index-lock', () => {
  const dir = newRepo()
  try {
    put(dir, '.git/index.lock', '') // 按 guardBusy 的判据真实造那一型(不注入替身)
    const p = subRun(dir, ['--dry-run'])
    assert.equal(p.status, 0)
    const line = onlyConclusion(p.stdout)
    assert.match(line, /reason=busy-index-lock/, '两型 busy 必须分得清是哪一路')
    assert.match(line, /ledger=unjudged/, '让路轮没问账本 ⇒ 如实未判定,不冒 ok')
    assert.match(line, /collected=0/)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
  // 另一型 busy(pre-commit.log 增长族)由同一把分类尺点名:guardBusy 的返回文案含
  // "pre-commit.log" 不含 "index.lock" ⇒ 必须落 busy-pre-commit-log。
  assert.equal(auto.classifyBusy('index.lock 在用'), 'busy-index-lock')
  assert.equal(
    auto.classifyBusy('守门批正在写(pre-commit.log 30秒内仍在增长:10→20)'),
    'busy-pre-commit-log',
  )
})

test('T18 直跑子进程非 dry 阳性对照:真凭据判 collectible ⇒ stdout 同一行读到 collected=1', () => {
  const dir = newRepo()
  try {
    // 提交通道的桩只存在于临时仓(fam 的 commitBatch 按注入 root spawn,绝不碰真实仓)。
    put(dir, 'scripts/safe-commit.mjs', 'process.stdout.write("stub ok\\n")\n')
    declare(dir, BUSINESS_PATH, 'export const w = 1\n') // 10 分钟前 ⇒ 超静默期
    const p = subRun(dir, [])
    assert.equal(p.status, 0, `stderr:${p.stderr}`)
    const line = onlyConclusion(p.stdout)
    assert.match(line, /ledger=ok/)
    assert.match(line, /collected=1/)
    assert.match(line, /ledgerCollected=1/)
    assert.match(line, /dry=false/)
    assert.match(line, /reason=\S*no-whitelist-hits/, '白名单外让路型必须同轮点名(留给人清的枚数也在 held= 里)')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T19 stdout 闸只在直跑形态开:被 import 形态调用器物不得写调用方 stdout', () => {
  const dir = newRepo()
  try {
    declare(dir, BUSINESS_PATH, 'export const z = 1\n')
    const drv = [
      `import { __test__ as auto } from ${JSON.stringify(pathToFileURL(SCRIPT).href)};`,
      'if (process.env.DRV_ON === "1") auto.setConclusionStdout(true);',
      'auto.runLedgerFamily({',
      `  root: ${JSON.stringify(dir)},`,
      '  now: new Date(),',
      '  quietMs: 3 * 60 * 1000,',
      '  dry: false,',
      '  busyCheck: () => null,',
      '  commit: (p) => ({ attempted: p.length, landed: p.length, blocker: null }),',
      '  logLine: () => {},',
      '});',
      '',
    ].join('\n')
    put(dir, 'drv.mjs', drv)
    const off = spawnSync(process.execPath, [join(dir, 'drv.mjs')], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 120_000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, DRV_ON: '0' },
    })
    assert.equal(off.status, 0, off.stderr)
    assert.ok(
      !String(off.stdout).includes('COLLECT-RESULT'),
      'import 形态(闸未开)一行 stdout 都不许写 —— 否则是在污染调用方(§22d 同取向)',
    )
    const on = spawnSync(process.execPath, [join(dir, 'drv.mjs')], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 120_000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, DRV_ON: '1' },
    })
    assert.equal(on.status, 0, on.stderr)
    const line = onlyConclusion(on.stdout)
    assert.match(line, /collected=1/, '闸开后的阳性对照:同一器物同一夹具必须读得出非零')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T22 被门整批拦下 ⇒ collected 只认真入库,blocked 单列并点名拦路者(挑了 N 枚 ≠ 入库 N 枚)', () => {
  // 现读成因:一整个下午 `collected=103` 那类读数其实全是"本轮挑了 103 枚",
  // 而提交被 check-capability-matrix(J4,别的席位在飞的 ai-service 开关)整批拦死 ——
  // 账本 229 条申报里带 landedSha 的 0 条。机读面必须能分出这两种形状。
  const dir = newRepo()
  try {
    declare(dir, BUSINESS_PATH, 'x\n')
    const fail = runLedger(dir, {
      commit: (p) => ({ attempted: p.length, landed: 0, blocker: 'check-capability-matrix' }),
    })
    assert.equal(fail.r.collected, 0, '一枚没入库 ⇒ collected 必须是 0,不得把挑了的枚数报成收了')
    assert.equal(fail.r.blocked, 1)
    assert.match(fail.lines.join('\n'), /⛔ 账本族本轮被拦 1 枚\(拦路者=check-capability-matrix\)/)
    const concl = fail.lines.find((l) => l.startsWith('COLLECT-RESULT'))
    assert.match(concl, / blocked=1 dry=false blocker=check-capability-matrix settled=0$/, `结论行缺拦路者:${concl}`)

    // 阳性对照:同一夹具同一枚数,提交真成功 ⇒ blocked=0 且 blocker 键整个缺席
    const dir2 = newRepo()
    try {
      declare(dir2, BUSINESS_PATH, 'y\n')
      const okRun = runLedger(dir2)
      assert.equal(okRun.r.collected, 1, '真入库才算 collected(替身按契约回报)')
      assert.equal(okRun.r.blocked, 0)
      const c2 = okRun.lines.find((l) => l.startsWith('COLLECT-RESULT'))
      assert.ok(!c2.includes('blocker='), `成功轮不得带拦路者键:${c2}`)
      assert.match(c2, / blocked=0 dry=false settled=0$/)
    } finally {
      rmScratch(dir2, { bestEffort: true })
    }
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T23 拦路者认得出:喂真实 safe-commit 输出必须认出那道门,认不出要写 unidentified(不猜)', () => {
  const f = auto.blockerFromOutput
  const real =
    '❌ check-capability-matrix: 能力台账对账失败(1 条;判定面:索引 blob):\n' +
    '   [J4 settings族台账逃逸] 未登记进 capability_matrix.py\n' +
    '❌ 📋 能力矩阵对账守门(默认关 env 必须登记台账;判定面=索引 blob)...失败，提交已阻止\n'
  assert.match(f(real), /check-capability-matrix/, '真 safe-commit 输出必须认得出拦路门名')
  assert.equal(f('❌ check-radius-single-source: 圆角漂移'), 'check-radius-single-source')
  assert.equal(f('随机一段崩溃栈,没有任何门名'), 'unidentified')
  assert.equal(f(''), 'unidentified')
  // 另几类整轮拒(safe-commit 自身的出口,不是某道门判红)—— 现读都真发生过
  assert.equal(
    f('❌ 中止 commit —— 这是「有意删除被复活后又收编进提交」的回流,不是正常新增'),
    'resurrected-deletion-refusal',
  )
  assert.equal(f('❌ Step 3: 暂存清单与本任务声明集不符'), 'safe-commit-scope-refusal')
  assert.equal(f('❌ 并发锁争用耗尽 ⇒ 不落地'), 'safe-commit-lock-exhausted')
  // Step 3e 活文档闸(2026-11-05 现读:白名单族 13 枚/轮就是被它整轮拒)
  assert.equal(
    f('活文档对账判红:README.md 的工作树副本吃掉 HEAD 已入库的行'),
    'live-doc-line-loss',
    '活文档拒收必须认得出类别(§5e-3 寄信身份按稳定类别,不能落 unidentified)',
  )
  // hint:认不出精确门名时必须给一行可归因摘要(§5e-1),且去掉引号/反引号/美元符防注入形态
  assert.match(
    auto.blockerHint('前一行\n❌ 复活检测命中 scripts/data/x.json 与 87 枚暂存件'),
    /复活检测命中/,
  )
  assert.ok(
    !auto.blockerHint('❌ 坏掉的东西 "带引号" 与 `反引号` 和 $变量').includes('"'),
    '摘要必须脱掉引号/反引号/美元符(不得把可执行形态带进日志与邮件)',
  )
  assert.equal(auto.blockerHint(''), '')
})

test('T20 两族合流的机读面:held 相加、reason 以 + 连接具体形态码(键集与前缀一字不改)', () => {
  const dir = newRepo()
  try {
    declare(dir, BUSINESS_PATH, 'x\n')
    const { r, lines } = runLedger(dir, {
      whitelistHeld: 2,
      whitelistReasons: ['no-whitelist-hits'],
      busyCheck: () => 'index.lock 在用',
    })
    assert.equal(r.held, 1 + 2, '账本族 held + 白名单族 held 必须同键合计(不加新键)')
    assert.equal(r.reason, 'no-whitelist-hits+busy-index-lock')
    const conclusion = lines.find((l) => l.startsWith('COLLECT-RESULT'))
    assert.match(conclusion, /^COLLECT-RESULT ledger=ok /, '前缀与首键顺序是消费者匹配面,不得动')
    assert.match(conclusion, / held=3 /)
    // 尾键顺序同为消费者匹配面:reason 之后依次 blocker/hint/settled,新维只准追加在最后。
    assert.match(conclusion, /reason=no-whitelist-hits\+busy-index-lock settled=0$/)
    // 无让路形态时 reason 键必须整个缺席(与既有形态同形,消费者按 if (r.reason) 追加)
    const plain = auto.ledgerConclusionLine(auto.baseConclusion({ dry: false }))
    assert.ok(!plain.includes('reason='), plain)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

/**
 * 形状锁的实现:剥掉 `=> {…}` 块体后逐个 return 调用点检查(行号邻近不算证据,
 * §0.6/任务令)。允许前缀之外的任何 return 都视为"静默早退回潮"。
 */
function stripArrowBodies(body) {
  let out = ''
  let i = 0
  while (i < body.length) {
    if (body.startsWith('=>', i)) {
      let j = i + 2
      while (j < body.length && /\s/.test(body[j])) j++
      if (body[j] === '{') {
        let depth = 0
        let k = j
        for (; k < body.length; k++) {
          if (body[k] === '{') depth++
          else if (body[k] === '}') {
            depth--
            if (depth === 0) {
              k++
              break
            }
          }
        }
        i = k
        continue
      }
    }
    out += body[i]
    i += 1
  }
  return out
}

function returnHeads(body) {
  const heads = []
  const re = /\breturn\b/g
  let m
  while ((m = re.exec(body))) {
    heads.push(
      body
        .slice(m.index, m.index + 80)
        .replace(/\s+/g, ' ')
        .replace(/\(\s+/g, '(')
        .trim(),
    )
  }
  return heads
}

test('T21 形状锁:main/白名单族/账本族的每一条 return 都经由唯一出口(不得有静默早退)', () => {
  const m = stripArrowBodies(bodyOf(SRC, 'function main()'))
  const mh = returnHeads(m)
  assert.ok(mh.length >= 1)
  for (const h of mh) assert.ok(h.startsWith('return emitConclusion('), `main 的 return 未经由唯一结论出口:${h}`)

  const wl = stripArrowBodies(bodyOf(SRC, 'function runWhitelistFamily('))
  const wh = returnHeads(wl)
  assert.ok(wh.length >= 6, `白名单族应至少 6 条让路出口,实得 ${wh.length}`)
  for (const h of wh) assert.ok(h.startsWith('return exitWhitelist('), `白名单族静默 return 回潮:${h}`)
  assert.ok(wl.includes('tally.held = held.length'), '白名单外的枚数必须计入轮级 held')
  // 逐码点名:五型让路各有具体形态码,不得都写成"skipped"
  for (const code of [
    'no-changes',
    'no-whitelist-hits',
    'whitelist-conflicted',
    'not-quiet',
    'livedoc-held-empty',
    'whitelist-dry-run',
    'stale-copy-held-empty',
  ])
    assert.ok(wl.includes(`'${code}'`), `白名单族缺具体形态码:${code}`)

  const famRaw = bodyOf(SRC, 'export function runLedgerFamily(')
  const fam = stripArrowBodies(famRaw)
  const fh = returnHeads(fam)
  assert.ok(fh.length >= 6, `账本族应至少 6 条结论出口,实得 ${fh.length}`)
  for (const h of fh) assert.ok(h.startsWith('return withCounts('), `账本族 return 未经由 withCounts:${h}`)
  // emit 的唯一出口调用住在 `const emit = (r) => {…}` 块体内(stripArrowBodies 会剥掉它),
  // 所以这一臂必须在**未剥离**的原始体上查;withCounts/joinReason 是表达式箭头,两版都在。
  assert.ok(famRaw.includes('emitConclusion('), 'emit 必须经唯一出口(不得回退成只写文件日志)')
  assert.ok(fam.includes('classifyBusy(busy)'), '账本族 busy 必须点名是哪一路')
  assert.ok(fam.includes("held: (over.held ?? 0) + whitelistHeld"), 'held 两族合计必须同键')
  assert.ok(fam.includes('reason: joinReason(over.reason)'), 'reason 两族合流必须经 joinReason')

  const ec = bodyOf(SRC, 'function emitConclusion(')
  assert.ok(ec.includes('ledgerConclusionLine('), '唯一出口必须复用既有拼装(§0.6,不得第二套)')
  assert.ok(ec.includes('process.stdout.write'), '直跑形态必须达 stdout(消费者读 stdout)')
  assert.ok(ec.includes('conclusionStdoutEnabled'), 'stdout 臂必须有闸(import 形态不写调用方)')
  const ew = bodyOf(SRC, 'function exitWhitelist(')
  assert.ok(ew.includes('reasons.push('), '让路形态码必须记账进 tally,由轮级结论行带出')

  // 直跑块:先闸、后 try/catch,异常路径先行后抛(退出码语义不变)
  const drStart = SRC.indexOf('if (isDirectRun)')
  assert.ok(drStart >= 0, '直跑块消失 ⇒ 本锁要重写,不得静默失配')
  const dr = SRC.slice(drStart, SRC.indexOf('export const __test__'))
  assert.ok(dr.includes('setConclusionStdout(true)'))
  assert.ok(/catch\s*\(/.test(dr), '异常路径必须有先行后抛的兜底')
  assert.ok(dr.slice(dr.indexOf('catch')).includes('emitConclusion'), '异常兜底必须经同一唯一出口')
  assert.ok(/throw\s+e/.test(dr), '兜底后必须重抛(不改退出码语义)')
})

test('T24 申报内容已在 HEAD ⇒ 落 settled 桶、剔出批;同批真活一枚都不许被连坐挤掉', () => {
  const dir = newRepo()
  const ALREADY = 'apps/demo/src/screens/Already.tsx'
  try {
    // 别席把这一枚带走了:先入库,再按**同一 blob**登记 ⇒ 账本行还在,内容已在主干。
    put(dir, ALREADY, 'export const already = 1\n')
    gitRaw(['add', '--', ALREADY], dir)
    gitRaw(['commit', '-q', '-F', '-'], dir, { input: 'foreign seat lands it\n' })
    const oid = hash(dir, ALREADY)
    const ap = appendLanding(
      [{ at: agedIso(10), leg: 'sweepMiniappStyleTiers', path: ALREADY, blobOid: oid }],
      { root: dir },
    )
    assert.deepEqual(ap, { appended: 1, rejected: [], deduped: 0 })
    // 同批另一枚:盘上有内容、HEAD 里没有 ⇒ 这是本轮唯一的真活
    declare(dir, BUSINESS_PATH, 'export const fresh = 1\n')

    const before = commitCount(dir)
    const { r, spy, lines } = runLedger(dir)
    assert.equal(r.settled, 1, '已在 HEAD 的那一枚必须落进 settled 桶')
    assert.equal(spy.calls.length, 1, '结清件不得再交通道(safe-commit 对它是零暂存 ⇒ 整轮 0 入库)')
    assert.deepEqual(spy.calls[0].paths, [BUSINESS_PATH], '交给通道的批里只能有真活')
    assert.equal(r.ledgerCollected, 1, '真活一枚都不许被死行挤掉批预算')
    assert.equal(commitCount(dir), before + 1)
    assert.ok(
      lines.some((l) => l.includes('账本族 settled') && l.includes(ALREADY)),
      `结清件必须逐条点名,实得:${lines.join(' | ')}`,
    )
    assert.match(lines.find((l) => l.startsWith('COLLECT-RESULT')), / settled=1$/)

    // 反向对照(尺子有牙):HEAD 是 v1、盘上与申报都是 v2 ⇒ **不是**结清,照旧交给通道
    const dir2 = newRepo()
    try {
      put(dir2, ALREADY, 'v1\n')
      gitRaw(['add', '--', ALREADY], dir2)
      gitRaw(['commit', '-q', '-F', '-'], dir2, { input: 'seed v1\n' })
      declare(dir2, ALREADY, 'v2 守护腿的新产出\n')
      const again = runLedger(dir2)
      assert.equal(again.r.settled, 0, '内容比 HEAD 更新 ⇒ 绝不是结清')
      assert.deepEqual(again.spy.calls[0].paths, [ALREADY], '这一枚必须交给通道')
      assert.equal(again.r.ledgerCollected, 1)
    } finally {
      rmScratch(dir2, { bestEffort: true })
    }
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T25 结清维取不到 ⇒ 一条都不剔(unjudged 上机读面),失效方向是撞显式报错而非静默丢活', () => {
  const dir = newRepo()
  try {
    declare(dir, BUSINESS_PATH, 'export const a = 1\n')
    const boom = () => {
      throw new Error('cat-file 取不到(夹具)')
    }
    const entries = auto.collectLedgerEntries(new Date(), {
      root: dir,
      quietMs: QUIET,
      headOidsOf: boom,
    })
    assert.equal(entries.ledger, 'ok', '账本本身读到了,只是结清维取不到')
    assert.equal(entries.settledCheck, 'unjudged')
    assert.equal(entries.settled.length, 0, '取不到 ⇒ 一条都不许剔(不得把"读不到"当"已结清")')
    assert.equal(entries.collectible.length, 1, '真活必须留在批里')
    assert.match(String(entries.settledCheckReason), /cat-file/, `未判定原因必须带出:${entries.settledCheckReason}`)

    // 机读面:未判定必须看得见,不能与"测过且 settled=0"同形
    const line = auto.ledgerConclusionLine(
      auto.baseConclusion({ dry: false, settled: 0, settledCheck: 'unjudged' }),
    )
    assert.match(line, / settled=0 settledCheck=unjudged$/, line)
    // 测过且都还活着 ⇒ 只写 settled=0,不写 settledCheck(缺席的 unjudged 键不得凭空出现)
    const okLine = auto.ledgerConclusionLine(auto.baseConclusion({ dry: false, settled: 0 }))
    assert.ok(!okLine.includes('settledCheck='), okLine)
    // 白名单族那一类结论没有这一维 ⇒ 整键缺席(缺席 = 没测,不用 settled=0 冒充测过)
    const plain = auto.ledgerConclusionLine(auto.baseConclusion({ dry: false }))
    assert.ok(!plain.includes('settled='), plain)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T26 活文档面只认共享清单:README 必须进活文档闸(旧口径漏它 ⇒ 白名单族 13 枚/轮被 3e 整轮拒)', () => {
  const dir = newRepo()
  try {
    put(dir, 'README.md', '# demo 改写\n')
    declare(dir, 'README.md', '# demo 改写\n')
    put(dir, BUSINESS_PATH, 'export const a = 1\n')
    declare(dir, BUSINESS_PATH, 'export const a = 1\n')

    // 反例先跑:此时 README 还没入库,红档才有得判(先绿后红会被 settled 维剔掉,判不出这一臂)
    const red = runLedger(dir, {
      liveDocGuard: () => ({ ok: false, why: '工作树吃掉 HEAD 已入库的行(夹具)' }),
    })
    assert.deepEqual(
      red.spy.calls.flatMap((c) => c.paths).filter((p) => p === 'README.md'),
      [],
      '活文档闸红 ⇒ README 一枚都不许交通道',
    )
    assert.ok(red.r.held >= 1, `红档必须落进 held,实得 held=${red.r.held}`)
    assert.ok(
      red.lines.some((l) => l.includes('账本族不收编活文档(README.md)')),
      `让路必须点名,实得:${red.lines.join(' | ')}`,
    )

    // 正例:闸绿 ⇒ README 照常收编,且**必须被问过**(旧口径根本不问它,才是 3e 整轮拒的成因)
    // 独立夹具:上一臂的红档轮已经把业务件真提交入库了,同一枚在下一轮会落 settled 桶 ⇒ 判不出这一臂
    const dir2 = newRepo()
    try {
      put(dir2, 'README.md', '# demo 改写\n')
      declare(dir2, 'README.md', '# demo 改写\n')
      put(dir2, BUSINESS_PATH, 'export const a = 1\n')
      declare(dir2, BUSINESS_PATH, 'export const a = 1\n')
      const asked = []
      const green = runLedger(dir2, {
        liveDocGuard: (p) => {
          asked.push(String(p))
          return { ok: true }
        },
      })
      assert.ok(
        asked.includes('README.md'),
        `README 必须过活文档闸(与 PROJECT_PLAN/AGENTS 同一把尺),实得:${asked}`,
      )
      assert.ok(!asked.includes(BUSINESS_PATH), '非活文档不得进这道闸')
      assert.equal(green.r.ledgerCollected, 2, '两枚都该交出(README + 业务件)')
    } finally {
      rmScratch(dir2, { bestEffort: true })
    }

    // 形状锁:清单向 lib/content-loss-gate 问,不再本地抄一份两枚形态;两族共用同一个谓词
    assert.match(
      SRC,
      /import \{ DEFAULT_LIVE_DOCS \} from '\.\/lib\/content-loss-gate\.mjs'/,
      '活文档清单必须来自唯一出处(§0.6)',
    )
    assert.match(SRC, /const HUMAN_LEDGER_RE = new RegExp\(/, '正则必须由共享清单派生')
    assert.doesNotMatch(
      SRC,
      /const HUMAN_LEDGER_RE = \/[^/]*PROJECT_PLAN\|AGENTS/,
      '旧的两枚字面量写法不得回潮(README 被漏掉即本轮实测事故)',
    )
    const wl = bodyOf(SRC, 'function runWhitelistFamily(')
    assert.ok(wl.includes('HUMAN_LEDGER_RE.test('), '白名单族必须走同一个谓词(不得两套口径)')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T27 活文档拒收只重发一次:三道闸各自成立才重发,别类拦路者一律不重发(不是跳门)', () => {
  const plan = auto.liveDocRetryPlan
  // ① 拦路者不是活文档闸 ⇒ 连 merge 都不许问(重发只会掩盖别处的红,或变成重试轰炸)
  let calls = []
  const mergeSpy = (f) => {
    calls.push(f)
    return { ok: true }
  }
  let p = plan({ blocker: 'safe-commit-lock-exhausted', paths: ['README.md'], merge: mergeSpy })
  assert.deepEqual(p, { retry: false, docs: [], notReady: [] })
  assert.deepEqual(calls, [], '非活文档拦路者不得触发任何重备')

  // ② 活文档拦路者 + 批内没有活文档路径 ⇒ 不重发、不问 merge(红来自别处)
  calls = []
  p = plan({ blocker: 'live-doc-line-loss', paths: ['apps/demo/a.tsx', 'docs/notes.md'], merge: mergeSpy })
  assert.equal(p.retry, false, '批内没有活文档 ⇒ 重发只会掩盖别处的红')
  assert.deepEqual(p.docs, [])
  assert.deepEqual(calls, [], '没有活文档就不许问 merge')

  // ②b 嵌套件也算活文档(本器射程刻意**宽于** 3e:失效方向恒为"多准备一次",不是"多放一次")
  calls = []
  p = plan({ blocker: 'live-doc-line-loss', paths: ['apps/web/AGENTS.md'], merge: mergeSpy })
  assert.deepEqual(calls, ['apps/web/AGENTS.md'], '嵌套 AGENTS.md 必须被备到')
  assert.equal(p.retry, true)

  // ③ 批内有活文档且重备全绿 ⇒ 只重发一次(retry=true 由调用方发一次令),docs 逐枚点名
  calls = []
  p = plan({
    blocker: 'live-doc-line-loss',
    paths: ['README.md', 'AGENTS.md', 'PROJECT_PLAN.md', 'apps/demo/a.tsx'],
    merge: mergeSpy,
  })
  assert.deepEqual(calls, ['README.md', 'AGENTS.md', 'PROJECT_PLAN.md'], '三枚活文档都必须被问过')
  assert.equal(p.retry, true)
  assert.equal(p.docs.length, 3)

  // ④ 重备未达标 ⇒ 不重发,并把未达标逐枚点名(不得用重试掩盖真丢失)
  calls = []
  p = plan({
    blocker: 'live-doc-line-loss',
    paths: ['README.md', 'AGENTS.md'],
    merge: (f) => ({ ok: false, why: `夹具:${f} 仍判 lost` }),
  })
  assert.equal(p.retry, false)
  assert.equal(p.notReady.length, 2)
  assert.match(p.notReady.join(' '), /README\.md:夹具:README\.md 仍判 lost/, `未达标要能点名:${p.notReady}`)

  // ⑤ 形状锁:白名单族的调用点必须真的接上这条判据(否则判据只是"造好没装车")
  const wl = bodyOf(SRC, 'function runWhitelistFamily(')
  assert.ok(wl.includes('live-doc-line-loss'), '白名单族必须认出这一类拦路者')
  assert.ok(wl.includes('retryPlan('), '白名单族必须走这条判据出口(注入面)')
  assert.match(SRC, /r = commit\(list, msg\)/, '重发只有一次(不得写成循环)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
