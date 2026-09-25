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

const { parseVitestOutput, resolveEnd, runEnd, decideExit, DEFAULT_ENDS } = __test__

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

test('T3 定级反向锁:有人把 warn 改成 blocking 时,判据必须看见(不靠人眼)', () => {
  const mutated = readFileSync(RUNNER, 'utf8').replace(
    new RegExp(`(script: '${SCRIPT_NAME}',[\\s\\S]{0,200}?mode: ')warn(')`),
    '$1blocking$2',
  )
  assert.equal(registrationOf(mutated, SCRIPT_NAME).mode, 'blocking')
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

test('T12 派生纪律(§5b):绝对入口 + windowsHide + timeout,不走 pnpm/PATH', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /execFileSync\(process\.execPath,\s*\[resolved\.entry,\s*'run'\]/)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
