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
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

    // 阳性对照:同一枚不给 whitelistPaths ⇒ 通道被走到(证明去重真起作用,不是路径本身被别的闸拦下)
    const open = runLedger(dir)
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
  assert.match(wl, /tally\.collected = i18nPaths\.length \+ restPaths\.length/, '总结论行的 collected 必须是两族合计')

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
