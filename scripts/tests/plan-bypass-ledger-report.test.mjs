// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/plan-bypass-ledger-report.mjs` + `scripts/lib/commit-attestation.mjs` 的镜像测试(G-725)。
 *
 * §22c 口径:判据一律 **import 源文件**,本文件不复制任何实现。
 * 钉六件事:
 *  T1/T2 —— 两条**反假绿锁**(票面硬要求④):旁路一行都不落时统计必须报 `unknown` 而不是"0 = 一切正常";
 *           `bypass-landing` 必须真被计进总量(否则这一维永远只是个装饰列)。
 *  T3 —— 写留痕**绝不改变落地成败**(硬要求②):写不了只回 {ok:false,why},不抛。
 *  T4 —— **装车证明**:真跑一次旁路落地(临时仓 + LAND_ROOT 测试通道),留痕必须真的落进那一本台账,
 *         且统计器读同一棵仓必须数出 bypass=1。判据在而无人调 = 本仓最高频失效型。
 *  T5 —— **同源 schema 锁**(硬要求①):留痕的键名必须与 safe-commit 那本逐字同族,只允许多
 *         gatesRun/landedSha/source 三个;safe-commit 改了键名本测试即红(不得各写一份)。
 *  T6 —— 只读性:统计器不得写盘。
 *  T7 —— **整档流式读必须与整串解析同结论**:带色日志、跨块边界(chunkBytes=5 故意把中文与 ANSI
 *         序列切成两半)、超上限必须量出被跳过的字节、文件不在位 = 未判定而不是"0 轮"。
 *         (这一格不是补装饰:改成整档读之后我第一版**漏了在流式路径里剥 ANSI**,真仓当场
 *          报"读到 0 轮 / normal=0" —— 读得更全反而什么都看不见。)
 *  T8 —— **覆盖面自证三态**:窗口没走全(`not-covered`)、取尽历史后窗口真 0 枚(`covered`+0)、
 *         仓库问不到东西(`ok=false`)必须三种答法,不得共用"0 枚"这一个词。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  BYPASS_KIND,
  LEDGER_REL,
  buildBypassRecord,
  readLedgerRecords,
  recordBypassLanding,
} from '../lib/commit-attestation.mjs'
import { __test__ as report } from '../plan-bypass-ledger-report.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS = resolve(HERE, '..')
const LANDER = join(SCRIPTS, 'object-space-land.mjs')
const GIT = process.env.IHUI_TEST_GIT || 'git'
const T0 = Date.parse('2026-09-29T03:00:00Z')

const src = (rel) => readFileSync(join(SCRIPTS, rel), 'utf8')
const mkCommit = (shaChar, files, ms = T0, parent = 'p-' + shaChar) => ({
  sha: shaChar.repeat(40),
  parent,
  iso: new Date(ms).toISOString(),
  ms,
  day: new Date(ms).toISOString().slice(0, 10),
  files,
})
const mkRecord = (o = {}) => ({
  ms: T0,
  ts: new Date(T0).toISOString(),
  kind: '',
  gatesRun: false,
  ranFullBatch: false,
  declaredFiles: [],
  headBefore: '',
  landedSha: '',
  source: '',
  ...o,
})

test('T1 反假绿锁:旁路一行都不落 ⇒ 统计报 unknown(有枚数),绝不报成"0 = 没问题"', () => {
  const commits = [mkCommit('a', ['x.ts']), mkCommit('b', ['y.ts'])]
  const r = report.classifyAll({
    commits,
    index: report.indexLedger([]),
    rounds: [],
    ledgerReadable: true,
  })
  assert.equal(r.rows.length, 1)
  assert.equal(r.rows[0].total, 2, '提交面枚数必须报出来,不得因为台账空就报 0')
  assert.equal(r.rows[0].unknown, 2)
  assert.equal(r.rows[0].bypassLanding, 0)
  assert.match(r.detail[0].why, /无旁路留痕/, 'unknown 必须带原因,不得只给一个数')
  // 台账根本不存在(missing)时原因必须换成"台账取不到" —— 不是"没有旁路"
  const r2 = report.classifyAll({
    commits,
    index: report.indexLedger([]),
    rounds: [],
    ledgerReadable: false,
    ledgerState: 'missing',
  })
  assert.match(r2.detail[0].why, /台账取不到/)
})

test('T2 反假绿锁:bypass-landing 必须真被计进总量(不是并列一个装饰列)', () => {
  const sha = 'c'.repeat(40)
  const commits = [mkCommit(sha[0], ['x.ts']), mkCommit('d', ['y.ts'])]
  commits[0].sha = sha
  const idx = report.indexLedger([mkRecord({ kind: BYPASS_KIND, landedSha: sha, declaredFiles: ['x.ts'] })])
  const r = report.classifyAll({ commits, index: idx, rounds: [], ledgerReadable: true })
  assert.equal(r.rows[0].bypassLanding, 1, '旁路那一枚必须落到 bypass 桶')
  assert.equal(r.rows[0].unknown, 1, '另一枚无正证 ⇒ 仍 unknown,不得连带被算掉')
  assert.equal(
    r.rows[0].normal + r.rows[0].skipped + r.rows[0].bypassLanding + r.rows[0].unknown,
    r.rows[0].total,
    '四态必须闭合等于总量(缺一桶就是漏计)',
  )
  // 绑不到 sha 的旁路留痕必须报数,不静默
  const idx2 = report.indexLedger([mkRecord({ kind: BYPASS_KIND, landedSha: '' })])
  assert.equal(idx2.bypassNoSha, 1)
  assert.equal(idx2.bypass.size, 0)
})

test('T3 写留痕不得改变落地成败:写不了只回 {ok:false},全程不抛', () => {
  const dir = mkScratch('attest-unwritable-')
  try {
    // `.workbuddy` 被占成**普通文件** ⇒ mkdir/append 必失败(不是"目录不存在"那种能自愈的形态)
    writeFileSync(join(dir, '.workbuddy'), 'occupied\n')
    let threw = null
    let res
    try {
      res = recordBypassLanding({
        root: dir,
        source: 'object-space-land',
        landedSha: 'f'.repeat(40),
        headBefore: 'e'.repeat(40),
        declaredFiles: ['a.ts'],
      })
    } catch (e) {
      threw = e
    }
    assert.equal(threw, null, `留痕写失败不得抛出:${String(threw?.message ?? threw)}`)
    assert.equal(res.ok, false)
    assert.match(res.why, /未判定/, 'why 要说清"这一维从此量不到",而不是含糊一个 errno')
    assert.equal(existsSync(join(dir, '.workbuddy')), true)
    assert.equal(statSync(join(dir, '.workbuddy')).isFile(), true, '不得把别人的文件覆盖成目录')
    // 构造面的必填:缺 landedSha / 空 declaredFiles / 缺 source ⇒ build 抛、wrapper 吞
    for (const bad of [{}, { declaredFiles: [] }, { declaredFiles: ['a.ts'] }]) {
      const r = recordBypassLanding({ root: dir, landedSha: 'a'.repeat(40), source: 'x', ...bad })
      assert.equal(r.ok, false, `必填项缺失必须判"没写成":${JSON.stringify(bad)}`)
    }
    const rec = buildBypassRecord({
      source: 'live-doc-edit',
      landedSha: 'a'.repeat(40),
      headBefore: 'b'.repeat(40),
      declaredFiles: ['PROJECT_PLAN.md'],
      nowIso: new Date(T0).toISOString(),
    })
    assert.equal(rec.kind, BYPASS_KIND)
    assert.equal(rec.gatesRun, false, '旁路一律 gatesRun:false')
    assert.equal(rec.ranFullBatch, false)
  } finally {
    rmScratch(dir)
  }
})

function runGit(dir, args) {
  return execFileSync(
    GIT,
    ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e.local', '-c', 'user.name=e2e', '-c', 'core.autocrlf=false', '-C', dir, ...args],
    { encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 32 << 20,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'] },
  )
}

test('T4 装车证明:真跑一次旁路落地 ⇒ 留痕真的进了同一本台账,统计器数出 bypass=1', () => {
  const dir = mkScratch('attest-e2e-')
  try {
    runGit(dir, ['init', '-q'])
    writeFileSync(join(dir, 'doc.md'), '# doc\nline-1\n')
    runGit(dir, ['add', '--', 'doc.md'])
    runGit(dir, ['commit', '-q', '-m', 'chore: fixture base'])
    const parent = runGit(dir, ['rev-parse', 'HEAD']).trim()
    writeFileSync(join(dir, 'doc.md'), '# doc\nline-1\nline-2 旁路落地的新行\n')

    const env = {
      ...process.env,
      LAND_ROOT: dir,
      LAND_PATHS: 'doc.md',
      LAND_MSG: 'test(plan): G-725 留痕端到端',
      IHUI_LAND_SKIP_WATERMARK: '1', // 夹具文件本来就没水印;这一维另由 reason 后缀点名
    }
    const run = spawnSync(process.execPath, [LANDER], {
      env,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 180_000,
      maxBuffer: 64 << 20,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.equal(run.status, 0, `落地器必须成功:\n${run.stdout}\n${run.stderr}`)
    assert.match(run.stdout, /跳门留痕 1 行已写入/, '落地器必须自己点名写了留痕')

    const landed = runGit(dir, ['rev-parse', 'HEAD']).trim()
    const led = readLedgerRecords(dir)
    assert.equal(led.ok, true, `台账必须可读:${led.why}`)
    assert.equal(led.records.length, 1, '旁路落地只许多写 1 行')
    const rec = led.records[0]
    assert.equal(rec.kind, BYPASS_KIND)
    assert.equal(rec.gatesRun, false)
    assert.equal(rec.landedSha, landed, 'landedSha 必须就是 HEAD(绑不上 sha 的留痕等于没写)')
    assert.equal(rec.headBefore, parent)
    assert.deepEqual(rec.declaredFiles, ['doc.md'])
    assert.equal(rec.source, 'object-space-land')
    assert.equal(led.badLines.length, 0, '自己写的行必须自己解得出')

    const got = report.collectCommits({ root: dir })
    assert.equal(got.ok, true)
    const r = report.classifyAll({
      commits: got.commits,
      index: report.indexLedger(led.records),
      rounds: [],
      ledgerReadable: true,
    })
    assert.equal(r.rows[0].bypassLanding, 1, '统计器读同一棵仓必须数出这枚旁路')
    assert.equal(r.rows[0].unknown, 1, 'base fixture 那枚没有任何正证 ⇒ unknown(不得被顺手算成 normal)')
    assert.equal(r.rows[0].total, 2)
  } finally {
    rmScratch(dir)
  }
})

test('T5 同源 schema 锁:键名与 safe-commit 那本逐字同族,只多 gatesRun/landedSha/source', () => {
  const safe = src('safe-commit.mjs')
  const p = safe.indexOf('safe-commit-attestation.jsonl')
  assert.ok(p > 0, 'safe-commit 里找不到那本台账 ⇒ 本测试无从对账(它改了落点?)')
  const s = safe.indexOf('JSON.stringify(', p)
  assert.ok(s > p, 'safe-commit 的那次落盘不再是 JSON.stringify 内联形态 ⇒ 键名对账失去对象')
  // 把对账范围**收在那段对象字面量之内**(它的收尾就是 `})}`):切到 1200 字符会把后面的
  // `error: …` 之类也算成"那本的键",于是本测试变成一台与判据无关的恒红锁。
  const tail = safe.slice(s)
  const end = tail.indexOf('})}')
  assert.ok(end > 0, '找不到那段对象字面量的收尾 `})}` ⇒ safe-commit 的落盘形状变了,本测试需同步重读')
  const block = tail.slice(0, end)
  // safe-commit 那一行写的键(它自己那本的既有形状)
  const theirs = [...block.matchAll(/([A-Za-z][A-Za-z0-9]*):\s/g)].map((m) => m[1])
  const mine = Object.keys(
    buildBypassRecord({
      source: 'x',
      landedSha: 'a'.repeat(40),
      headBefore: 'b'.repeat(40),
      declaredFiles: ['a.ts'],
    }),
  )
  // 它写 batchSelfRun 等键名用的是 `verdict.xxx`,清单里补上(同一行的三个新键)
  const extraTheirs = ['batchSelfRun', 'selfRunOk', 'blockerBeforeBatch']
  for (const k of [...theirs, ...extraTheirs])
    assert.ok(mine.includes(k), `safe-commit 写了键 ${k} 而旁路留痕没有 ⇒ 两份 schema(硬要求①)`)
  for (const k of ['gatesRun', 'landedSha', 'source'])
    assert.ok(mine.includes(k), '本票新增的三个键必须在位:绑不到 sha 就统计不了,不写 gatesRun 就分不清绕门')
  // 只有这三个是新增;其余顺序与命名必须与那本一致
  assert.deepEqual(
    mine.filter((k) => !['gatesRun', 'landedSha', 'source'].includes(k)),
    ['ts', 'kind', 'ranFullBatch', 'reason', 'failedGates', 'declaredFiles', 'headBefore', 'batchSelfRun', 'selfRunOk', 'blockerBeforeBatch'],
    '键集漂移(增删改名)即红:台账有两份形状 = 统计永远对不上',
  )
  assert.equal(LEDGER_REL, join('.workbuddy', 'safe-commit-attestation.jsonl'), '必须是那一本,不得另立文件')
  // 落地器不得自己再拼一次路径(第二份落点)
  for (const f of ['object-space-land.mjs', 'live-doc-edit.mjs']) {
    const s = src(f)
    assert.ok(!s.includes('safe-commit-attestation.jsonl'), `${f} 里出现了台账路径字面量 ⇒ 落点分叉`)
    assert.match(s, /from '\.\/lib\/commit-attestation\.mjs'/, `${f} 必须引唯一出口`)
    assert.match(s, /recordBypassLanding\(\{/, `${f} 必须真的调用留痕出口(判据在而无人调 = 没有)`)
    const j = s.indexOf('if (!attest.ok)')
    assert.ok(j > 0, `${f} 的写失败分支不见了`)
    const warn = s.slice(j, j + 320)
    assert.match(warn, /console\.log\(/, '写失败必须喊一行')
    assert.ok(!warn.includes('process.exit'), '写失败不得改落地成败(硬要求②)')
  }
})

/**
 * T5b —— 装车锁必须判 **HEAD 面**,不能只判工作树。
 * 立因(2026-09-29 实测):`object-space-land.mjs` 的留痕接线**被一次"按滞后工作树副本提交的旁路落地"
 * 整体抹掉**(现读 `git show HEAD:<该文件> | grep -c recordBypassLanding` = 0),而 T5 读的是工作树副本
 * ⇒ 台账里那一族的接线在 HEAD 上已经不存在,账面却一路报绿。这正是本仓最高频的那一型:
 * **判据只问"盘上有没有",而仓库真正交付的是 HEAD**。工作树锁保留(T5,防"没写出来"),
 * HEAD 锁补在它后面(本条,防"写了又被回写掉")。两条缺一不可,失效方向也不同。
 */
test('T5b HEAD 面装车锁:两个落地器在**被审面**上都必须真的接了留痕出口', () => {
  const repo = resolve(SCRIPTS, '..')
  for (const rel of ['object-space-land.mjs', 'live-doc-edit.mjs']) {
    const head = execFileSync(
      GIT,
      ['-c', 'safe.directory=*', '-C', repo, 'show', `HEAD:scripts/${rel}`],
      { encoding: 'utf8', maxBuffer: 1 << 28, windowsHide: true,
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'] },
    )
    assert.ok(
      head.includes("from './lib/commit-attestation.mjs'"),
      `${rel} 的 HEAD 版本没有引唯一出口 ⇒ 接线已被回写掉(工作树副本仍算是"没入库",不能当已交付)`,
    )
    assert.equal(
      head.split('recordBypassLanding(').length - 1,
      1,
      `${rel} 的 HEAD 版本里 recordBypassLanding( 的**调用**应恰好 1 处(import 那行不带左括号,由上面那条断言单独锁),实测 ${head.split('recordBypassLanding(').length - 1} 处`,
    )
    assert.ok(
      !head.includes('safe-commit-attestation.jsonl'),
      `${rel} 的 HEAD 版本自己拼了台账路径 ⇒ 落点分叉`,
    )
  }
})

test('T6 只读性:统计器不写盘、不碰 ref', () => {
  const s = src('plan-bypass-ledger-report.mjs')
  for (const bad of ['writeFileSync(', 'appendFileSync(', 'mkdirSync(', 'update-ref', 'commit -'])
    assert.ok(!s.includes(bad), `统计器里出现写盘/写 ref 的形态:${bad}`)
  assert.match(s, /readSync|readFileSync/, '它必须只读')
})

test('T7 钩子轮次:ANSI 色码与"等值才作保"两条都得有牙', () => {
  const E = String.fromCharCode(27)
  const plain = ['ℹ️  staged 文件清单(2 个):', '  - a.ts', '  - b.ts', '  失败: 0'].join('\n')
  const colored = ['ℹ️  staged 文件清单(2 个):', '  - a.ts', '  - b.ts', `  ${E}[31m失败: 0${E}[0m`].join('\n')
  assert.equal(report.parseHookRounds(plain).length, 1)
  assert.equal(report.parseHookRounds(colored).length, 1, '带色汇总行不得被读成"没有一轮"')
  // 清单之后的杂项 `- xxx` 不得混进文件集合(否则 normal 的正证会被脏行凑成等值)
  const withNoise = ['staged 文件清单(2 个):', '  - a.ts', '  - b.ts', '⏭  [44] 别的门跳过', '  - 失败项:44', '  失败: 0'].join('\n')
  const r = report.parseHookRounds(withNoise)[0]
  assert.deepEqual(r.files, ['a.ts', 'b.ts'], `清单块必须在非清单行处收口,实得 ${JSON.stringify(r.files)}`)
  // 只有"失败: 0"的那一轮才给 normal 作保
  const idx = report.indexLedger([])
  const commits = [mkCommit('e', ['a.ts', 'b.ts'])]
  const failedRounds = report.parseHookRounds(['staged 文件清单(2 个):', '  - a.ts', '  - b.ts', '  失败: 3'].join('\n'))
  assert.equal(report.classifyAll({ commits, index: idx, rounds: failedRounds, ledgerReadable: true }).rows[0].normal, 0)
  assert.equal(report.classifyAll({ commits, index: idx, rounds: report.parseHookRounds(plain), ledgerReadable: true }).rows[0].normal, 1)
})

test('T8 台账坏行不得被算成"没发生"', () => {
  const dir = mkScratch('attest-badline-')
  try {
    mkdirSync(join(dir, '.workbuddy'), { recursive: true })
    writeFileSync(
      join(dir, '.workbuddy', 'safe-commit-attestation.jsonl'),
      `${JSON.stringify(mkRecord({ kind: BYPASS_KIND, landedSha: 'a'.repeat(40) }))}\n{不是 JSON\n`,
    )
    const led = readLedgerRecords(dir)
    assert.equal(led.ok, true)
    assert.equal(led.records.length, 1)
    assert.equal(led.badLines.length, 1, '解不出的行必须点名,不得静默丢')
    assert.equal(led.badLines[0].n, 2)
  } finally {
    rmScratch(dir)
  }
})

test('T7 整档流式读必须与整串解析同结论(带色日志 + 跨块半行)', () => {
  const dir = mkScratch('bypass-stream')
  try {
    const E = String.fromCharCode(27)
    const log = [
      'ℹ️  staged 文件清单(2 个):',
      '  - 中文路径/组件名.tsx',
      '  - b.ts',
      `  ${E}[31m失败: 0${E}[0m`,
      'ℹ️  staged 文件清单(1 个):',
      '  - c.ts',
      `  ${E}[32m失败: 1${E}[0m`,
    ].join('\n')
    const p = join(dir, 'hook.log')
    writeFileSync(p, log, 'utf8')
    const full = report.readHookRounds(p)
    assert.equal(full.ok, true, `取不到就说取不到:${full.why}`)
    assert.equal(full.rounds.length, 2, '整档流式读不得比整串解析少认轮')
    assert.equal(full.rounds[0].failed, 0)
    assert.equal(full.rounds[1].failed, 1)
    assert.deepEqual(full.rounds[0].files, ['中文路径/组件名.tsx', 'b.ts'], '多字节行名不得被切坏')
    assert.equal(full.capped, false)
    assert.equal(full.bytesParsed, statSync(p).size, '未截断时"已读字节"必须等于文件大小')
    // 同一份内容两条路径必须逐字同结论(流式 vs 整串):漂开 = 同一本日志两种真相
    assert.deepEqual(full.rounds, report.parseHookRounds(readFileSync(p, 'utf8')))
    // 块边界刻意切在多字节字符与 ANSI 序列中间(chunkBytes=5):结论不得变
    const tiny = report.readHookRounds(p, { chunkBytes: 5 })
    assert.deepEqual(tiny.rounds, full.rounds, '分块边界把中文切成 U+FFFD 或把色码切断 ⇒ 判据失效而账面无声')
    // 上限退回读尾部时必须**大声**报被跳过的字节,不得静默当成"全读过了"
    const capped = report.readHookRounds(p, { capBytes: 40 })
    assert.equal(capped.ok, true)
    assert.equal(capped.capped, true)
    assert.ok(capped.skippedBytes > 0, '超上限必须量出被跳过多少字节')
    // 文件不在位 = 未判定,不得被读成"0 轮 = 今天没人跑门"
    const missing = report.readHookRounds(join(dir, 'nope.log'))
    assert.equal(missing.ok, false)
    assert.equal(missing.state, 'missing')
    assert.equal(missing.rounds.length, 0)
  } finally {
    rmScratch(dir)
  }
})

test('T8 覆盖面自证:窗口没走全时不得把枚数当全量(三态)', () => {
  const dir = mkScratch('bypass-cov')
  try {
    const gitHere = (...args) =>
      execFileSync('git', ['-c', 'safe.directory=*', ...args], {
        cwd: dir,
        encoding: 'utf8',
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    gitHere('init', '-q', '-b', 'main', dir)
    gitHere('config', 'user.email', 't@example.invalid')
    gitHere('config', 'user.name', 'T')
    for (const f of ['one.md', 'two.md', 'three.md']) {
      writeFileSync(join(dir, f), `${f}\n`, 'utf8')
      gitHere('add', '--', f)
      gitHere('commit', '-q', '-m', `seed ${f}`)
    }
    // 本地日,不是 UTC 日:本仓在 +08:00,凌晨两点用 toISOString() 会得到**昨天**,
    // 于是窗口把刚造的三枚提交整批滤掉、`covered` 被读成 `empty`(判据没坏,是夹具算错了日子)。
    const nowD = new Date()
    const p = (n) => String(n).padStart(2, '0')
    const today = `${nowD.getFullYear()}-${p(nowD.getMonth() + 1)}-${p(nowD.getDate())}`
    const wide = report.collectCommits({ root: dir, sinceDay: '2000-01-01', untilDay: today })
    assert.equal(wide.ok, true)
    assert.equal(wide.coverage, 'covered', '历史取到底(未用尽 --limit)才许说"完整"')
    assert.equal(wide.commits.length, 3)
    // limit=1 ⇒ 只走到最新一枚,窗口起点根本没碰到 ⇒ 必须自证"不完整"
    const thin = report.collectCommits({ root: dir, sinceDay: '2000-01-01', untilDay: today, limit: 1 })
    assert.equal(thin.coverage, 'not-covered', '吃满 --limit 且没走到 sinceDay ⇒ 枚数是下界,不得当全量报')
    assert.equal(thin.truncated, true)
    // 窗口落在未来:历史已被走尽(没用满 --limit)⇒ 'covered' + 0 枚是**有效结论**,
    // 不是"没取到"。把这两种情形混成一格,就会 Either 把真 0 报成未判定(狼来了),
    // Or 把"根本没走到窗口"报成"这个窗口没有提交"(假干净)。
    const future = report.collectCommits({ root: dir, sinceDay: '2099-01-01', untilDay: '2099-12-31' })
    assert.equal(future.coverage, 'covered', '取数走尽历史 ⇒ 窗口 0 枚是真结论')
    assert.equal(future.commits.length, 0)
    // 仓库一枚提交都没有:git 直接报错 ⇒ ok=false(调用方必须落"未判定",不得打"0 枚提交")。
    // 与上面那一格**不同形**才是关键 —— "窗口里没有提交"与"问不到提交"不能共用一个答案。
    const bareDir = mkScratch('bypass-cov-bare')
    try {
      execFileSync('git', ['-c', 'safe.directory=*', 'init', '-q', '-b', 'main', bareDir], {
        encoding: 'utf8',
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      const bare = report.collectCommits({ root: bareDir, sinceDay: '2000-01-01', untilDay: today })
      assert.equal(bare.ok, false, '空仓必须报"取不到",不得报"窗口内 0 枚"')
      assert.ok(String(bare.why ?? '').length > 0, '取不到必须带原因')
    } finally {
      rmScratch(bareDir)
    }
  } finally {
    rmScratch(dir)
  }
})

test('T9 引用事务见证的取材三态:读到 / 坏行不吞 / 文件不在位不得读成"全部无见证"', () => {
  const dir = mkScratch('witness-read')
  try {
    const wdir = join(dir, '.workbuddy')
    mkdirSync(wdir, { recursive: true })
    const good = 'a'.repeat(40)
    const good2 = 'b'.repeat(40)
    writeFileSync(
      join(wdir, 'commit-witness.log'),
      `${good}\trefs/heads/main\n${good2}\t refs/heads/other \n不是sha\trefs/heads/x\n\n`,
      'utf8',
    )
    const w = report.readWitness(dir)
    assert.equal(w.ok, true)
    assert.equal(w.state, 'read')
    assert.equal(w.shas.has(good), true, '制表符分隔的第一列必须认成 sha')
    assert.equal(w.shas.has(good2), true, '空格分隔与首尾空白不得影响判定')
    assert.equal(w.badLines, 1, '解不出的行必须点名计数,不得静默跳(静默跳 = 漏记一次见证)')
    assert.equal(w.records, 2)
    // 文件不在位 ⇒ ok=false + state=missing;分类必须落 unsplittable,不得落 unwitnessed
    const miss = report.readWitness(join(dir, 'nope'))
    assert.equal(miss.ok, false)
    assert.equal(miss.state, 'missing')
    const commits = [
      { sha: good, parent: 'p', iso: '2026-09-30T00:00:00.000Z', ms: T0, day: '2026-09-30', files: ['x.ts'] },
    ]
    const split = report.classifyAll({
      commits,
      index: report.indexLedger([]),
      rounds: [],
      ledgerReadable: true,
      witness: miss,
    })
    assert.equal(split.rows[0].unknownUnsplittable, 1, '取不到 = 无从分')
    assert.equal(split.rows[0].unknownUnwitnessed, 0, '不得把"这台机没记"写成"这台机没发生过"')
  } finally {
    rmScratch(dir)
  }
})

test('T10 一方轮次记录:读到 / 坏行计数 / 文件不在位退回回显正证,不得静默', () => {
  const dir = mkScratch('first-party-rounds')
  try {
    const hdir = join(dir, '.workbuddy', 'hook-logs')
    mkdirSync(hdir, { recursive: true })
    const parent = 'f'.repeat(40)
    writeFileSync(
      join(hdir, 'pre-commit-rounds.jsonl'),
      [
        JSON.stringify({ ts: 't1', headBefore: parent, stagedFiles: ['a.ts', ' 中文.ts '], gatesRan: true, gatesPassed: true, exitCode: 0 }),
        '{不是 JSON',
        JSON.stringify({ headBefore: parent, stagedFiles: '应为数组', gatesRan: true, gatesPassed: true, exitCode: 0 }),
        '',
      ].join('\n'),
      'utf8',
    )
    const fp = report.readFirstPartyRounds(dir)
    assert.equal(fp.ok, true)
    assert.equal(fp.state, 'read')
    assert.equal(fp.rounds.length, 1, '坏行与畸形行都要点名,不得静默吞(吞一条 = 丢一次正证)')
    assert.equal(fp.badLines, 2)
    assert.equal(fp.records, 1)
    assert.equal(fp.rounds[0].files.has('中文.ts'), true, '文件名两侧空白必须归一,否则"⊆ 本轮所见"永远失配')
    const commit = {
      sha: 'e'.repeat(40),
      parent,
      iso: '2026-09-30T00:00:00.000Z',
      ms: T0,
      day: '2026-09-30',
      files: ['a.ts', '中文.ts'],
    }
    assert.equal(report.matchFirstPartyRound(commit, fp.rounds) !== null, true)
    // 文件不在位 ⇒ missing;分类照旧走回显,而报告必须把"一方记录取不到"喊出来(由 run() 打印,这里钉数据层)
    const miss = report.readFirstPartyRounds(join(dir, 'nope'))
    assert.equal(miss.ok, false)
    assert.equal(miss.state, 'missing')
    assert.equal(miss.rounds.length, 0)
  } finally {
    rmScratch(dir)
  }
})

test('T10b G-978004 ②:声明集与落地面多重集等值 ⇒ 强证 strongDeclared,否则维持弱证两档分开', () => {
  const dir = mkScratch('first-party-declared')
  try {
    const hdir = join(dir, '.workbuddy', 'hook-logs')
    mkdirSync(hdir, { recursive: true })
    const parent = 'f'.repeat(40)
    writeFileSync(
      join(hdir, 'pre-commit-rounds.jsonl'),
      [
        // 强证轮:声明集与提交面逐名等值(顺序不同也等,多重集)
        JSON.stringify({ ts: 't1', headBefore: parent, stagedFiles: ['a.ts', 'b.ts'], declaredFiles: ['b.ts', 'a.ts'], gatesRan: true, gatesPassed: true, exitCode: 0 }),
        // 弱证轮:声明集只是提交面的真子集(lint-staged 派生了额外落地面)⇒ 不得冒充实证
        JSON.stringify({ ts: 't2', headBefore: parent, stagedFiles: ['a.ts', 'b.ts'], declaredFiles: ['a.ts'], gatesRan: true, gatesPassed: true, exitCode: 0 }),
        // 弱证轮:普通直 git commit,声明集留空
        JSON.stringify({ ts: 't3', headBefore: parent, stagedFiles: ['a.ts', 'b.ts'], gatesRan: true, gatesPassed: true, exitCode: 0 }),
      ].join('\n'),
      'utf8',
    )
    const fp = report.readFirstPartyRounds(dir)
    assert.equal(fp.ok, true)
    const commit = { sha: 'e'.repeat(40), parent, iso: '2026-09-30T00:00:00.000Z', ms: T0, day: '2026-09-30', files: ['a.ts', 'b.ts'] }
    const matched = report.matchFirstPartyRound(commit, fp.rounds)
    assert.equal(matched !== null, true, '⊆ 弱证成立 ⇒ 仍判 normal,不得因缺强证而丢正证')
    assert.equal(matched.strongDeclared, true, '强证轮在队首,应带 strongDeclared')
    // 强证轮已 consumed ⇒ 同面再匹配落到弱证轮,不得带 strongDeclared(两档不互相冒充)
    const weak = report.matchFirstPartyRound(commit, fp.rounds)
    assert.equal(weak !== null, true)
    assert.equal(weak.strongDeclared, undefined, '声明集不等的轮不得带 strongDeclared')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ─── G-1059139 第五态(ran-with-self-skip)的成对用例 ───
// 一律经生产入口 report.classifyAll 驱动;batch 上下文由调用方(run)构造,这里照同一形状喂构造面,
// **不在测试里重写绑定判据**(§22c)。D1 是 treeDigest,'none' 分支对应"完全找不到批次"。
const BC = (sha, parent, tree, files) => ({
  sha,
  parent,
  tree,
  iso: '2026-10-06T10:00:00+08:00',
  ms: Date.parse('2026-10-06T10:00:00+08:00'),
  day: '2026-10-06',
  files,
})

test('P1 批次留痕唯一匹配且 selfSkipped 非空 ⇒ 归 ran-with-self-skip(不再落 unknown)', () => {
  const sha = 'e'.repeat(40)
  const dg = 'a'.repeat(64)
  const commits = [BC(sha, 'p1', 't1', ['x.ts'])]
  const batch = {
    available: true,
    state: 'read',
    byDigest: new Map([[dg, [{ treeDigest: dg, selfSkipped: [{ id: '52', skipEnv: 'HUSKY_SKIP_X' }] }]]]),
    digestBySha: new Map([[sha, dg]]),
    reasonBySha: new Map(),
    commitCountByTree: new Map([['t1', 1]]),
  }
  const r = report.classifyAll({ commits, index: report.indexLedger([]), rounds: [], ledgerReadable: true, batch })
  assert.equal(r.rows[0].ranWithSelfSkip, 1, JSON.stringify(r.rows))
  assert.equal(r.rows[0].unknown, 0, '新态不得再从 unknown 里重复计一次')
  assert.equal(r.detail[0].proof, 'gate-batch-run')
  assert.match(r.detail[0].why, /按名字自跳/)
})

test('P2 批次跑了且 selfSkipped 为空 ⇒ 归 normal(是一条正证,不是新债)', () => {
  const sha = 'f'.repeat(40)
  const dg = 'b'.repeat(64)
  const commits = [BC(sha, 'p2', 't2', ['x.ts'])]
  const batch = {
    available: true,
    state: 'read',
    byDigest: new Map([[dg, [{ treeDigest: dg, selfSkipped: [] }]]]),
    digestBySha: new Map([[sha, dg]]),
    reasonBySha: new Map(),
    commitCountByTree: new Map([['t2', 1]]),
  }
  const r = report.classifyAll({ commits, index: report.indexLedger([]), rounds: [], ledgerReadable: true, batch })
  assert.equal(r.rows[0].normal, 1, JSON.stringify(r.rows))
  assert.equal(r.rows[0].ranWithSelfSkip, 0)
  assert.equal(r.rows[0].normalByBatch, 1, '批次正证单列一档,不得冒充钩子回显/一方记录')
})

test('P3 同一 digest 命中窗口内两枚 ⇒ 落"无从分",绝不判新态(错归 = 给没跑门的机器发证)', () => {
  const s1 = '1'.repeat(40)
  const s2 = '2'.repeat(40)
  const dg = 'c'.repeat(64)
  const commits = [BC(s1, 'pA', 'treeSame', ['x.ts']), BC(s2, 'pB', 'treeSame', ['y.ts'])]
  const batch = {
    available: true,
    state: 'read',
    byDigest: new Map([[dg, [{ treeDigest: dg, selfSkipped: [{ id: '9', skipEnv: 'HUSKY_SKIP_Y' }] }]]]),
    digestBySha: new Map([
      [s1, dg],
      [s2, dg],
    ]),
    reasonBySha: new Map(),
    commitCountByTree: new Map([['treeSame', 2]]),
  }
  const r = report.classifyAll({ commits, index: report.indexLedger([]), rounds: [], ledgerReadable: true, batch })
  assert.equal(r.rows[0].ranWithSelfSkip, 0)
  assert.equal(r.rows[0].unknown, 2)
  assert.equal(r.rows[0].unknownBatchAmbiguous, 2, '这是 unknown 的第四格,单列计数')
})

test('P4 完全找不到批次 ⇒ 维持原态,且 unknown 原有三格不被吞', () => {
  const sha = '3'.repeat(40)
  const commits = [BC(sha, 'pC', 't3', ['x.ts'])]
  const batch = {
    available: true,
    state: 'read',
    byDigest: new Map(),
    digestBySha: new Map([[sha, 'd'.repeat(64)]]),
    reasonBySha: new Map(),
    commitCountByTree: new Map([['t3', 1]]),
  }
  const witness = { ok: true, state: 'read', shas: new Set([sha]), records: 1, badLines: 0, truncated: false }
  const r = report.classifyAll({ commits, index: report.indexLedger([]), rounds: [], ledgerReadable: true, batch, witness })
  assert.equal(r.rows[0].ranWithSelfSkip, 0)
  assert.equal(r.rows[0].unknown, 1)
  assert.equal(r.rows[0].unknownWitnessed, 1, '原有"本机可疑"这一格必须照计')
  assert.equal(r.rows[0].unknownBatchAmbiguous, 0)
  assert.match(r.detail[0].why, /索引面与落地 tree 不等|批次绑定/)
})

test('P5 同一 digest 的多条留痕在"有没有自跳"上不一致 ⇒ 不判新态', () => {
  const sha = '4'.repeat(40)
  const dg = '5'.repeat(64)
  const commits = [BC(sha, 'pD', 't4', ['x.ts'])]
  const batch = {
    available: true,
    state: 'read',
    byDigest: new Map([[dg, [{ treeDigest: dg, selfSkipped: [] }, { treeDigest: dg, selfSkipped: [{ id: '7', skipEnv: 'HUSKY_SKIP_Z' }] }]]]),
    digestBySha: new Map([[sha, dg]]),
    reasonBySha: new Map(),
    commitCountByTree: new Map([['t4', 1]]),
  }
  const r = report.classifyAll({ commits, index: report.indexLedger([]), rounds: [], ledgerReadable: true, batch })
  assert.equal(r.rows[0].ranWithSelfSkip, 0)
  assert.equal(r.rows[0].normal, 0)
  assert.equal(r.rows[0].unknownBatchAmbiguous, 1)
})

test('P6 五态不并桶:total 恰等于各态之和,批次面不可用时退回原四态', () => {
  const commits = [BC('6'.repeat(40), 'pE', 't5', ['x.ts'])]
  const r = report.classifyAll({ commits, index: report.indexLedger([]), rounds: [], ledgerReadable: true })
  const row = r.rows[0]
  assert.equal(row.total, row.normal + row.ranWithSelfSkip + row.skipped + row.bypassLanding + row.unknown)
  assert.equal(row.unknown, 1, '没有批次面 ⇒ 维持原态(不得凭"没有证据"发证,也不得凭"没有证据"指控)')
  assert.match(r.detail[0].why, /批次面未提供/)
})
