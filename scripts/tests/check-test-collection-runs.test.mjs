// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:守门「测试收集存续性对账」(§22c —— 直接 import 源模块的判据函数,不复制实现)
//
// 钉五件事:
//  1. **装车证明**:runner 里确有 id 114 的注册块,且 script 是本门、mode 是 warn、有真实 skipEnv;
//     并用"把注册块删掉再判一次"的**方向性对照**证明这条断言不是恒真(判据必须能认出"未接线");
//  2. **定级不得被顺手改成 blocking**(warn 是本门的立命之本:与改动无关的恒红门只会逼人 --no-verify);
//  3. **判据有牙且只认收集期形态**:真捕获的 `Failed Suites` 输出必判红并点名文件与**报错首行**;
//     而"只有断言失败"的输出必须判绿 —— 把两种故障混计,这道门就变成噪声源;
//  4. **空扫不得记绿 / 取不到结论必须未判定**(本仓最高频的假绿形态);
//  5. 派生纪律(§5b):runEnd 必须用绝对入口 + windowsHide + timeout,不走 pnpm/PATH。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ } from '../check-test-collection-runs.mjs'

const {
  parseVitestOutput,
  resolveEnd,
  runEnd,
  decideExit,
  DEFAULT_ENDS,
  vitestArgvOf,
  listHeadEnds,
  hasVitestEntry,
} = __test__

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE = join(REPO, 'scripts', 'check-test-collection-runs.mjs')
const RUNNER = join(REPO, 'scripts', 'guardian-runner.mjs')
const SCRIPT_NAME = 'check-test-collection-runs.mjs'
const GATE_ID = '114'
const SKIP_ENV = 'HUSKY_SKIP_TEST_COLLECTION'

/** 测试侧的注册表解析(不是判据实现的副本,是"装车"检查) */
function registrationOf(runnerSource, scriptName) {
  const blocks = runnerSource.split(/\n  {\n/).filter((b) => b.includes(`script: '${scriptName}'`))
  if (blocks.length === 0) return null
  const b = blocks[0]
  return {
    count: blocks.length,
    id: (b.match(/id: '([^']+)'/) || [])[1] ?? null,
    mode: (b.match(/mode: '([^']+)'/) || [])[1] ?? null,
    skipEnv: (b.match(/skipEnv: '([^']+)'/) || [])[1] ?? null,
  }
}

// ── 真捕获的 vitest 4.1.10 输出(含 ANSI;从真实运行里逐字取,不是手写理想版式) ──
const COLLECT_OUT = [
  ' \x1b[31m❯\x1b[39m tests/broken.test.ts \x1b[2m(0 test)\x1b[22m',
  '',
  '\x1b[31m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\x1b[39m\x1b[1m\x1b[41m Failed Suites 1 \x1b[49m\x1b[22m\x1b[31m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\x1b[39m',
  '',
  ' FAIL \x1b[22m\x1b[49m tests/broken.test.ts\x1b[2m [ tests/broken.test.ts ]\x1b[22m',
  'Error: Transform failed with 1 error:',
  'broken.test.ts:1:17: ERROR: Unexpected ";"',
  '  Plugin: vite:esbuild',
  '',
  '\x1b[31m Test Files \x1b[39m\x1b[31m1 failed\x1b[39m\x1b[90m (1)\x1b[39m',
  '\x1b[31m      Tests \x1b[39m no tests',
  '',
].join('\n')

const ASSERT_OUT = [
  '\x1b[31m⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯\x1b[39m',
  '',
  ' FAIL  tests/f.test.ts \x1b[2m> \x1b[22ma \x1b[2m> \x1b[22mb',
  'AssertionError: expected 1 to be 2 // Object.is equality',
  '',
  ' Test Files  \x1b[31m1 failed\x1b[39m\x1b[90m (1)\x1b[39m',
  '      Tests  \x1b[31m1 failed\x1b[39m\x1b[90m (1)\x1b[39m',
  '',
].join('\n')

const GREEN_OUT = [
  ' ✓ tests/p.test.ts (1 test) 2ms',
  '',
  ' Test Files  1 passed (1)',
  '      Tests  1 passed (1)',
  '',
].join('\n')

const EMPTY_OUT = 'No test files found, exiting with code 1\n\ninclude: **/*.{test,spec}.?(c|m)[jt]s?(x)\n'

test('T1 装车证明:runner 里确有本门,且 script / id / warn / skipEnv 四项齐备', () => {
  const reg = registrationOf(readFileSync(RUNNER, 'utf8'), SCRIPT_NAME)
  assert.ok(reg, `runner 里找不到 ${SCRIPT_NAME} 的注册块(造好没装车)`)
  assert.equal(reg.count, 1, '本门在 runner 里必须恰好注册一次')
  assert.equal(reg.id, GATE_ID)
  assert.equal(reg.mode, 'warn', '本门必须 warn 级(见文件头:恒红 blocking = 逼人 --no-verify)')
  assert.equal(reg.skipEnv, SKIP_ENV)
})

test('T2 方向性对照:把注册块删掉,同一条判据必须认出"未接线"(证明 T1 不是恒真)', () => {
  const src = readFileSync(RUNNER, 'utf8')
  assert.ok(registrationOf(src, SCRIPT_NAME), '前置:真 runner 必须在位')
  const unwired = src.replace(new RegExp(`script: '${SCRIPT_NAME}'`), "script: 'some-other-gate.mjs'")
  assert.equal(registrationOf(unwired, SCRIPT_NAME), null, '摘线后仍报"已接线" ⇒ T1 是一把没有牙的尺子')
})

test('T3 定级反向锁(G-29 前置②):现读 runner 条目必须仍是 warn;若被改成 blocking 则必红并点名前置①未满足', () => {
  // 定级从 runner 注册条目**现读**(§0.1 凡数字现读),不把 warn 字面量当判据复制;
  // 变异臂证明这条断言有牙:有人真把 mode 改成 blocking 时,同一把尺子必须看得见。
  const reg = registrationOf(readFileSync(RUNNER, 'utf8'), SCRIPT_NAME)
  assert.ok(reg, 'runner 里找不到本门注册块,无法现读定级')
  assert.equal(
    reg.mode,
    'warn',
    '升 blocking 的前置①(全端收集失败数现读归零)未满足,不得改 blocking(G-29;恒红 blocking = 逼人 --no-verify,见门体头注)',
  )
  const mutated = readFileSync(RUNNER, 'utf8').replace(
    new RegExp(`(script: '${SCRIPT_NAME}',[\\s\\S]{0,200}?mode: ')warn(')`),
    '$1blocking$2',
  )
  assert.equal(registrationOf(mutated, SCRIPT_NAME).mode, 'blocking', '变异后仍读出 warn ⇒ 这条定级断言没有牙')
})

test('T4 全 runner 守门编号不得重复(含本门恰好一次)', () => {
  const ids = [...readFileSync(RUNNER, 'utf8').matchAll(/^ {4}id: '([^']+)',/gm)].map((m) => m[1])
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
  assert.deepEqual([...new Set(dup)], [], `撞号会把 skipEnv 与失败归因搅在一起:${dup.join(',')}`)
  assert.equal(ids.filter((v) => v === GATE_ID).length, 1)
})

test('T5 判据有牙:真·收集失败输出必判红,且报出套件名与**报错首行**', () => {
  const r = parseVitestOutput(COLLECT_OUT, { exitCode: 1 })
  assert.equal(r.verdict, 'violation')
  assert.equal(r.count, 1)
  assert.equal(r.collectionFailures.length, 1)
  assert.equal(r.collectionFailures[0].file, 'tests/broken.test.ts')
  assert.match(r.collectionFailures[0].firstErrorLine, /^Error: Transform failed/)
  assert.equal(r.assertionFailures, 0)
})

test('T6 全绿判绿(证明本门不是恒红门)', () => {
  const r = parseVitestOutput(GREEN_OUT, { exitCode: 0 })
  assert.equal(r.verdict, 'ok')
  assert.equal(r.count, 0)
})

test('T7 混计红线:只有断言失败时**不得**判红,但必须如实报数', () => {
  const r = parseVitestOutput(ASSERT_OUT, { exitCode: 1 })
  assert.equal(r.verdict, 'ok', 'Test Files 1 failed 两种故障都会出现 ⇒ 文件级计数不作判据')
  assert.equal(r.count, 0)
  assert.equal(r.assertionFailures, 1)
})

test('T8 空扫不得记绿:零测试文件 ⇒ 判红', () => {
  const r = parseVitestOutput(EMPTY_OUT, { exitCode: 1 })
  assert.equal(r.verdict, 'violation')
  assert.match(r.reason, /空扫/)
})

test('T9 取不到结论 ⇒ 未判定并给原因(绝不记绿)', () => {
  const r = parseVitestOutput('some runner booting...\n', { exitCode: 0 })
  assert.equal(r.verdict, 'undetermined')
  assert.match(r.reason, /Test Files/)
  const blank = parseVitestOutput('', { exitCode: 1 })
  assert.equal(blank.verdict, 'undetermined')
})

test('T10 计数漂移:区块头与逐条数不一致时取大值并点名(绝不静默少报)', () => {
  const r = parseVitestOutput(
    'Failed Suites 3\n FAIL  a.test.ts [ a.test.ts ]\nError: x\n Test Files  3 failed (3)\n',
    { exitCode: 1 },
  )
  assert.equal(r.count, 3)
  assert.equal(r.collectedSuiteFailures, 1)
  assert.equal(r.countDrift, true)
})

test('T11 退出码方向:判红 1 / 未判定默认 2 而 strict 1 / 达标 0', () => {
  assert.equal(decideExit([{ verdict: 'violation' }], { strict: false }), 1)
  assert.equal(decideExit([{ verdict: 'undetermined' }], { strict: false }), 2)
  assert.equal(decideExit([{ verdict: 'undetermined' }], { strict: true }), 1)
  assert.equal(decideExit([{ verdict: 'ok' }], { strict: true }), 0)
  assert.equal(
    decideExit([{ verdict: 'undetermined' }, { verdict: 'violation' }], { strict: false }),
    1,
    '判红必须优先于未判定 —— 有确定的红就不能被"未判定"洗淡',
  )
})

test('T12 派生纪律(§5b):绝对入口 + windowsHide + timeout,不走 pnpm/PATH;且 argv 取该端 script(口径④)', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /execFileSync\(process\.execPath,\s*\[resolved\.entry,\s*\.\.\.resolved\.argv\]/)
  assert.doesNotMatch(
    src,
    /execFileSync\(process\.execPath,\s*\[resolved\.entry,\s*'run'\]/,
    '固定 [入口, run] 会把该端 test script 的旗标整片丢掉 —— 2026-10-19 实测到的假红型',
  )
  assert.match(src, /windowsHide:\s*true/)
  assert.match(src, /timeout:\s*timeoutMs/)
  assert.doesNotMatch(src, /spawnSync\(\s*'pnpm'/, '走 pnpm 就依赖 PATH,钩子/服务进程下必失')
})

test('T13 未判定路径:非 vitest 端 / 无 test script / 入口不可解析,三条各自给原因', () => {
  const scratch = mkScratch('tcr-resolve')
  try {
    const py = join(scratch, 'pyend')
    mkdirSync(py, { recursive: true })
    writeFileSync(join(py, 'package.json'), JSON.stringify({ scripts: { test: 'pytest -q' } }))
    assert.match(resolveEnd(py).reason, /不是 vitest/)

    const none = join(scratch, 'noend')
    mkdirSync(none, { recursive: true })
    writeFileSync(join(none, 'package.json'), JSON.stringify({ name: 'x' }))
    assert.match(resolveEnd(none).reason, /test script/)

    const noPkg = join(scratch, 'nopkg')
    mkdirSync(noPkg, { recursive: true })
    assert.match(resolveEnd(noPkg).reason, /package\.json/)

    const broken = join(scratch, 'brokendeps')
    mkdirSync(join(broken, 'node_modules'), { recursive: true })
    writeFileSync(join(broken, 'package.json'), JSON.stringify({ scripts: { test: 'vitest run' } }))
    assert.match(resolveEnd(broken).reason, /入口不可解析/)
  } finally {
    rmScratch(scratch)
  }
})

test('T14 端到端装车证明:临时端打印真·收集失败输出 ⇒ runEnd 判红并带出首行', () => {
  const scratch = mkScratch('tcr-e2e')
  try {
    const dir = join(scratch, 'fakeend')
    mkdirSync(join(dir, 'node_modules', 'vitest'), { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'vitest run' } }))
    writeFileSync(
      join(dir, 'node_modules', 'vitest', 'package.json'),
      JSON.stringify({ name: 'vitest', version: '4.1.10-fake', bin: { vitest: 'vitest.mjs' } }),
    )
    writeFileSync(
      join(dir, 'node_modules', 'vitest', 'vitest.mjs'),
      `process.stdout.write(${JSON.stringify(COLLECT_OUT)})\nprocess.exit(1)\n`,
    )
    const r = runEnd(dir)
    assert.equal(r.verdict, 'violation')
    assert.equal(r.collectionFailures[0].file, 'tests/broken.test.ts')
    assert.match(r.collectionFailures[0].firstErrorLine, /^Error: Transform failed/)
    assert.equal(decideExit([r], { strict: false }), 1)
  } finally {
    rmScratch(scratch)
  }
})

test('T15 默认受检端只有被实测证明会静默失败的 apps/mobile-rn(不擅自扩面)', () => {
  assert.deepEqual(DEFAULT_ENDS, ['apps/mobile-rn'])
})

test('T16 默认端在真仓必须解析得到 vitest 入口(否则本门对唯一受检端永远"未判定"= 没有)', () => {
  const dir = join(REPO, 'apps', 'mobile-rn')
  const r = resolveEnd(dir)
  assert.equal(r.reason, undefined, `真端解析失败:${r.reason}`)
  assert.match(r.entry, /vitest/)
})

test('T17 巡检入口在根 package.json 且带 --strict(未判定必须计红)', () => {
  const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'))
  const cmd = pkg.scripts['check:test-collection']
  assert.ok(cmd, '缺少 pnpm check:test-collection 入口')
  assert.match(cmd, /check-test-collection-runs\.mjs/)
  assert.match(cmd, /--strict/)
})

// T18/T19(2026-10-19 立):口径④「受检形态 = 该端真实跑法」的实测证据面。
//   立因:本门曾固定派生 [入口,'run'],packages/app 的 script 带 --environment jsdom,
//   丢旗标后 5 枚套件 31 条用例以 `document is not defined` 假红(按该端跑法复跑 22/22 绿)。
test('T18 真端对照:packages/app 的环境旗标必须进到派生 argv 里', () => {
  const dir = join(REPO, 'packages', 'app')
  const script = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).scripts.test
  const r = resolveEnd(dir)
  assert.equal(r.reason, undefined, `真端解析失败:${r.reason}`)
  assert.ok(
    r.argv.includes('--environment') && r.argv.includes('jsdom'),
    `该端 script 带环境旗标而 argv 里没有 ⇒ 旗标被丢。script=${script} argv=${JSON.stringify(r.argv)}`,
  )
  assert.ok(r.argv[0] === 'run', `子命令必须原样带上(仍按该端 script 走),实为 ${JSON.stringify(r.argv[0])}`)
})

test('T19 vitestArgvOf:取不到调用点 / 多次调用 / 无子命令 三型各自未判定,负向不与正向混', () => {
  assert.match(vitestArgvOf('--config vitest.json run').reason, /找不到 vitest 的调用点/)
  assert.match(vitestArgvOf('vitest run && vitest run --coverage').reason, /无法判定该量哪一轮/)
  assert.match(vitestArgvOf('vitest').reason, /子命令取不到/)
  assert.deepEqual(vitestArgvOf('pnpm vitest run -t "a b"').argv, ['run', '-t', 'a b'])
  assert.deepEqual(vitestArgvOf('node scripts/clean.mjs && vitest run --passWithNoTests').argv, [
    'run',
    '--passWithNoTests',
  ])
})

/* ------------------------------------------------------------------ *
 * T20–T22(2026-10-20 立,G-29):全端枚举 + 三态分色。
 * 立因是现读到的两个账面失真:① 票面前置写"全端归零",而拿全端读数要手敲 16 个 --end ——
 *   漏敲一个端、或将来新增第 17 端,汇总行照样打"收集失败端 0";② HEAD 面实有 25 个端目录,
 *   其中只有 16 端是 vitest 入口 —— 把"按定义不在射程"计成未判定再配 --strict,
 *   就是给一台跑得通的机器造 9 端恒红门(§12e)。
 * ------------------------------------------------------------------ */
test('T20 全端枚举的装车锁:默认腿每一枚都必须在 HEAD 面枚举里(端被改名/删除 ⇒ 这一条先响)', () => {
  const { ends, error } = listHeadEnds(REPO)
  assert.equal(error, null, `HEAD 面枚举失败:${error}`)
  assert.ok(ends.length >= 15, `HEAD 面枚举到 ${ends.length} 端 —— 少于实测 25 说明射程被改窄了`)
  for (const e of DEFAULT_ENDS)
    assert.ok(ends.includes(e), `默认腿 ${e} 不在枚举里 ⇒ 提交链那条窄腿指着已经不存在的端`)
  // 反向锁:更深位置的 package.json 不是"端"(真仓实测 apps/zcode-cli/packages/core 那一层)。
  assert.ok(
    !ends.some((e) => e.split('/').length > 2),
    `枚举混进了非端目录:${JSON.stringify(ends.filter((e) => e.split('/').length > 2))}`,
  )
})

test('T21 射程分色的牙:射程外不判红也不冒充跑过,真·未判定在 strict 下照红', () => {
  const scoped = { end: 'a', verdict: 'out-of-scope', reason: 'test 入口不是 vitest' }
  const okRes = { end: 'b', verdict: 'ok', collectionFailures: [] }
  const undet = { end: 'c', verdict: 'undetermined', reason: 'vitest 入口不可解析' }
  const red = { end: 'd', verdict: 'violation', collectionFailures: [{ file: 'x.test.ts' }] }
  assert.equal(decideExit([scoped, okRes], { strict: true }), 0, '射程外不得连累同批达标的端')
  assert.equal(decideExit([scoped], { strict: true }), 2, '全批射程外 = 一条没量到,判死不记绿')
  assert.equal(decideExit([undet], { strict: true }), 1, '真·未判定在 strict 下必须计红')
  assert.equal(decideExit([undet], { strict: false }), 2, '非 strict 档仍是未判定,不冒红也不记绿')
  assert.equal(decideExit([scoped, red], { strict: true }), 1, '有收集失败就红,与同批射程外无关')
})

test('T22 形状锁:vitest 入口的认定全仓只有一份,枚举侧不得自带第二把尺子', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.ok(hasVitestEntry('vitest run'), '正例:vitest run 必须算 vitest 入口')
  assert.ok(!hasVitestEntry('pytest -q'), '反例:pytest 不得算')
  assert.ok(!hasVitestEntry(undefined), '反例:取不到 script 不得算(也不得抛)')
  const body = src.slice(src.indexOf('export function listHeadEnds'))
  const enumPart = body.slice(0, body.indexOf('\nexport ', 10) > 0 ? body.indexOf('\nexport ', 10) : body.length)
  assert.ok(
    !/\\bvitest\\b|includes\('vitest'\)|testScript/.test(enumPart),
    '枚举层只回答"有哪些端";在它里面判 vitest = 第二把尺子(§0.6/§22c)',
  )
  assert.match(src, /if \(!hasVitestEntry\(testScript\)\)/, 'resolveEnd 必须走那一份共用认定')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
