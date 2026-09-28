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
    { encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 32 << 20 },
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
