// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-1058646 的镜像测试(2026-10-06 立)。
 *
 * 被测**本体**是 `scripts/run-ai-service-tests.mjs` —— 这里一律 `import { __test__ }`
 * 取生产入口,不复制实现(§22c:镜像测试只复读实现就是复读机)。
 * 分类桶的输入文本是本机对真 pytest 现读的原文(见各常量旁注),不是照抄文档。
 *
 * 五组成对用例(缺一组就少一种会被读错的形态):
 *  ① 收集到 0 条 ⇒ 必非零 + 点名"未跑到"(阳性对照)
 *  ② 收集期 ModuleNotFoundError ⇒ 算成**收集期失败**而不是断言失败(分类判据问得住)
 *  ③ 正常小样例 ⇒ 必绿(反向锁:防止它变成一台恒红机 —— 恒红门的结局是逼人 --no-verify)
 *  ④ 取不到解释器/venv ⇒ "未判定"措辞 + exit 2,且**不得**出现"通过"二字
 *  ⑤ 变异自证:摘掉"0 用例 ⇒ 非零"那一支 ⇒ ① 必红;生产文件逐字节未被动过
 *
 * 夹具落点走 `mkScratch`(§26:不用 os.tmpdir、不落仓库树内),夹具面里不建 venv,
 * 用 `--python=` 指向真 venv ⇒ 被测面是假的、解释器是真的,结论才作数。
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

import { __test__ as entry } from '../run-ai-service-tests.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const CLI = join(REPO, 'scripts', 'run-ai-service-tests.mjs')
const APP = entry.DEFAULT_APP_DIR
const SRC_BEFORE = readFileSync(CLI, 'utf8')
const SHA_BEFORE = createHash('sha256').update(SRC_BEFORE).digest('hex')

/** 生产入口自己的解释器选址结果(取不到 ⇒ 依赖真解释器的用例整组 skip,不冒充红)。 */
const PY = entry.resolvePython({ appDir: APP })

function mkFixture(files = {}) {
  const dir = mkScratch('g1058646-mt-')
  mkdirSync(join(dir, 'tests'), { recursive: true })
  for (const [name, src] of Object.entries(files)) writeFileSync(join(dir, 'tests', name), src)
  return dir
}

function runCli(args, timeoutMs = 120000, script = CLI) {
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: REPO,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    timeout: timeoutMs,
  })
  return { rc: r.status, out: `${r.stdout || ''}${r.stderr || ''}`, error: r.error }
}

/** 直接派生一次 pytest,拿**原文**喂给纯函数面(证明分类不是拿假字符串凑的)。 */
function rawPytest(appDir, args, timeoutMs = 120000) {
  const r = spawnSync(PY, ['-m', 'pytest', ...args], {
    cwd: appDir,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    timeout: timeoutMs,
  })
  return { rc: r.status, text: `${r.stdout || ''}${r.stderr || ''}` }
}

const SRC_ZERO = 'def _helper():\n    return 1\n'
const SRC_PASS = 'def test_ok_case():\n    assert True\n'
const SRC_BADIMP = 'import nonexistent_module_for_g1058646  # noqa: F401\n'

// ── 纯函数面:解释器选址(与本机有没有 venv 无关,靠注入 exists 证明)──

test('解释器选址:venv 两臂都缺 ⇒ null(不猜路径、不回退裸 python)', () => {
  assert.equal(entry.resolvePython({ appDir: '/R', exists: () => false }), null)
  const seen = []
  entry.resolvePython({
    appDir: '/R',
    exists: (p) => {
      seen.push(p)
      return false
    },
  })
  // 只问 venv 两臂:裸 `python` 在本机是 Microsoft Store 别名(实测 rc=9009),回退等于偷换被测面
  assert.equal(seen.length, entry.pythonCandidates('/R').length)
  assert.ok(seen.every((p) => p.includes('.venv')), JSON.stringify(seen))
})

test('解释器选址:POSIX 臂与 Windows 臂各自命中', () => {
  assert.equal(
    entry.resolvePython({ appDir: '/R', exists: (p) => p.endsWith(join('bin', 'python')) }),
    join('/R', '.venv', 'bin', 'python')
  )
  assert.equal(
    entry.resolvePython({ appDir: '/R', exists: (p) => p.endsWith('python.exe') }),
    join('/R', '.venv', 'Scripts', 'python.exe')
  )
})

test('解释器选址:--python= 指定但不存在 ⇒ null,不回退默认候选', () => {
  const asked = []
  const got = entry.resolvePython({
    appDir: '/R',
    pythonOverride: '/nope/python.exe',
    exists: (p) => {
      asked.push(p)
      return p === join('/R', '.venv', 'Scripts', 'python.exe')
    },
  })
  assert.equal(got, null)
  assert.deepEqual(asked, ['/nope/python.exe'])
})

// ── 纯函数面:分桶(文本为本机真 pytest 现读原文)──

test('分桶:收集档空面 no tests collected ⇒ collected=0', () => {
  const p = entry.parsePytestSummary({ stdout: 'no tests collected in 0.00s', tier: 'collect' })
  assert.equal(p.collected, 0)
  assert.equal(p.noTestsCollected, true)
  const v = entry.judgeTier({ tier: 'collect', rc: 5, ...p })
  assert.equal(v.state, 'no-tests')
  assert.equal(v.exitCode, 1)
})

test('分桶:实跑档 no tests ran ⇒ 同样落"未跑到",不是绿', () => {
  const p = entry.parsePytestSummary({ stdout: 'no tests ran in 0.00s', tier: 'run' })
  assert.equal(p.noTestsRan, true)
  assert.equal(entry.judgeTier({ tier: 'run', rc: 5, ...p }).state, 'no-tests')
})

test('分桶:收集期 ModuleNotFoundError 与断言失败各占一桶(现读原文)', () => {
  // 本机实测(3 tests collected, 1 error in 0.16s 档):errors=1、failed=0
  const collectErr = entry.parsePytestSummary({
    stdout: [
      'tests/test_ok.py::test_one',
      '',
      '=================================== ERRORS ====================================',
      '_____________________ ERROR collecting tests/test_imp.py ______________________',
      "ImportError while importing test module 'G:\\x\\tests\\test_imp.py'.",
      "E   ModuleNotFoundError: No module named 'nonexistent_module_xyz'",
      'ERROR tests/test_imp.py',
      '!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!',
      '3 tests collected, 1 error in 0.16s',
    ].join('\n'),
    tier: 'collect',
  })
  assert.equal(collectErr.collected, 3)
  assert.equal(collectErr.errors, 1)
  assert.equal(collectErr.failed, 0)
  assert.ok(collectErr.collectionSignals.length > 0)
  const v = entry.judgeTier({ tier: 'collect', rc: 2, ...collectErr })
  assert.equal(v.state, 'collection-error')
  assert.equal(v.exitCode, 1)

  // 本机实测断言失败档:1 failed in 0.11s ⇒ failed=1、errors=0,与上面不同桶
  const assertFail = entry.parsePytestSummary({ stdout: '1 failed in 0.11s', tier: 'run' })
  assert.equal(assertFail.failed, 1)
  assert.equal(assertFail.errors, 0)
  assert.equal(assertFail.collectionSignals.length, 0)
  assert.equal(entry.judgeTier({ tier: 'run', rc: 1, ...assertFail }).state, 'test-failure')

  // 两桶同时非零时仍然分列(不被折成一个"失败数")
  const both = entry.parsePytestSummary({ stdout: '2 failed, 1 error in 0.20s', tier: 'run' })
  assert.equal(both.failed, 2)
  assert.equal(both.errors, 1)
  const vb = entry.judgeTier({ tier: 'run', rc: 1, ...both })
  assert.equal(vb.state, 'nonassertion-error')
  assert.match(vb.detail, /断言失败桶 2 条/)
})

test('三态分立:派生异常/无总结行/内部错误 ⇒ 未判定 exit 2,不落 1 也不落 0', () => {
  assert.equal(entry.judgeTier({ tier: 'run', timedOut: true, timeoutMs: 1 }).exitCode, 2)
  assert.equal(entry.judgeTier({ tier: 'run', spawnErrorCode: 'ENOENT' }).exitCode, 2)
  assert.equal(entry.judgeTier({ tier: 'run', rc: 1, parsed: false }).exitCode, 2)
  assert.equal(entry.judgeTier({ tier: 'run', rc: 3, parsed: true, collected: 5 }).exitCode, 2)
})

test('透传参数:--collect-only 只走档一,extra 两档共用且不重复', () => {
  const tiers = entry.buildPytestArgs({ collectOnly: true, extra: ['-k', 'foo', '--collect-only'] })
  assert.equal(tiers.length, 1)
  assert.deepEqual(tiers[0].args, ['--collect-only', '-q', '-k', 'foo'])
  const two = entry.buildPytestArgs({ collectOnly: false, extra: [] })
  assert.deepEqual(
    two.map((t) => t.tier),
    ['collect', 'run']
  )
})

// ── ① 阳性对照:收集到 0 条 ⇒ 必非零 + 点名"未跑到" ──

test('① 收集到 0 条 ⇒ 非零且写明"未跑到"', { skip: PY ? false : '本机取不到 ai-service 的 venv python' }, () => {
  const dir = mkFixture({ 'test_empty_surface.py': SRC_ZERO })
  try {
    const { rc, out } = runCli(['--app-dir=' + dir, '--python=' + PY, '--collect-only'])
    assert.equal(rc, 1, out)
    assert.match(out, /未跑到/)
    assert.doesNotMatch(out, /RESULT verdict=GREEN/)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

// ── ③ 反向锁:正常小样例必须绿(恒红机也是缺陷)──

test('③ 正常小样例 ⇒ 两档都跑且落绿', { skip: PY ? false : '本机取不到 ai-service 的 venv python' }, () => {
  const dir = mkFixture({ 'test_ok_sample.py': SRC_PASS })
  try {
    const { rc, out } = runCli(['--app-dir=' + dir, '--python=' + PY])
    assert.equal(rc, 0, out)
    assert.match(out, /RESULT verdict=GREEN exit=0/)
    assert.match(out, /档结论:通过/)
    assert.doesNotMatch(out, /未判定/)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

// ── ② 分类:收集期错误不得被算成断言失败(生产入口 + 现读原文两面)──

test('② 收集期 ModuleNotFoundError ⇒ 算收集期失败、断言失败桶记 0', { skip: PY ? false : '本机取不到 venv python' }, () => {
  const dir = mkFixture({ 'test_imp_broken.py': SRC_BADIMP, 'test_ok_sample.py': SRC_PASS })
  try {
    const { rc, out } = runCli(['--app-dir=' + dir, '--python=' + PY])
    assert.equal(rc, 1, out)
    assert.match(out, /结论:collection-error/)
    assert.match(out, /收集期/)
    assert.match(out, /断言失败桶 0 条/)

    // 同一份原文直接喂纯函数面:分类不依赖被包装的输出
    const raw = rawPytest(dir, ['--collect-only', '-q'])
    assert.equal(raw.rc, 2, raw.text)
    const p = entry.parsePytestSummary({ stdout: raw.text, tier: 'collect' })
    assert.equal(p.failed, 0)
    assert.ok(p.errors >= 1)
    assert.ok(p.collectionSignals.length >= 1)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

// ── ④ 取不到解释器 ⇒ 未判定措辞 + 非零,且不得出现"通过" ──

test('④ venv 取不到 ⇒ exit 2 未判定,输出里不许有"通过"', () => {
  const dir = mkFixture({ 'test_ok_sample.py': SRC_PASS }) // 夹具里刻意不建 .venv
  try {
    const { rc, out } = runCli(['--app-dir=' + dir])
    assert.equal(rc, 2, out)
    assert.match(out, /未判定/)
    assert.doesNotMatch(out, /通过/)
    assert.doesNotMatch(out, /verdict=GREEN/)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('④ --python= 指到不存在的解释器 ⇒ 同样 exit 2 未判定', { skip: PY ? false : '本机取不到 venv python' }, () => {
  const dir = mkFixture({ 'test_ok_sample.py': SRC_PASS })
  try {
    const { rc, out } = runCli(['--app-dir=' + dir, '--python=' + join(dir, 'nope', 'python.exe'), '--collect-only'])
    assert.equal(rc, 2, out)
    assert.match(out, /未判定/)
    assert.doesNotMatch(out, /通过/)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

// ── ⑤ 变异自证:摘掉"0 用例 ⇒ 非零"那一支,① 必须红 ──

test('⑤ 摘掉 0-用例分支 ⇒ ① 的结论消失;生产文件逐字节未动', { skip: PY ? false : '本机取不到 venv python' }, () => {
  const anchor = 'if (noTestsCollected || noTestsRan || collected === 0) {'
  const hits = SRC_BEFORE.split(anchor).length - 1
  assert.equal(hits, 1, '变异锚点在源码里出现 1 次(多了就是形状变了,该重看这条)')
  const mutantDir = mkScratch('g1058646-mutant-')
  const fixture = mkFixture({ 'test_empty_surface.py': SRC_ZERO })
  try {
    const mutant = join(mutantDir, 'mutant.mjs')
    const mutated = SRC_BEFORE.replace(anchor, 'if (false) {')
    assert.notEqual(mutated, SRC_BEFORE, '变异没生效 ⇒ 这条自证是假的')
    writeFileSync(mutant, mutated)

    const base = runCli(['--app-dir=' + fixture, '--python=' + PY, '--collect-only'])
    assert.equal(base.rc, 1, base.out)
    assert.match(base.out, /未跑到/)

    const { rc, out } = runCli(['--app-dir=' + fixture, '--python=' + PY, '--collect-only'], 120000, mutant)
    // 基线在①上是 rc=1 + 点名"未跑到";摘掉那一支后两点同时失守 ⇒ 用例 ① 必红
    assert.notEqual(rc, 1, `变异体不该复刻基线结论:${out}`)
    assert.doesNotMatch(out, /未跑到/, `变异体仍在替那一条分支说话:${out}`)
    assert.equal(
      createHash('sha256').update(readFileSync(CLI, 'utf8')).digest('hex'),
      SHA_BEFORE,
      '生产文件必须逐字节未被动过(变异只发生在 scratch 副本上)'
    )
  } finally {
    rmScratch(fixture, { bestEffort: true })
    rmScratch(mutantDir, { bestEffort: true })
  }
})

// ── 出口形状锁:钉的是不变量,不是某一条具体脚本正文 ──

test('apps/ai-service 有 test:py 出口,且出口不带任何静默兜底', () => {
  const pkg = JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8'))
  // 名字刻意不叫 `test`:根 `pnpm test` = `turbo run test`,而 CI 那条 "Unit tests" job
  // (.github/workflows/ci-monorepo.yml 的 pnpm run test 一步)**没有 Python venv** ⇒
  // 一台判"环境取不到解释器 = 未判定 exit 2"的尺子挂进 CI 就是恒红机(§12e 同型)。
  // 本票要消灭的是"pnpm --filter 对缺脚本的包静默跳过",叫 `test:py` 同样消灭它。
  const v = pkg.scripts?.['test:py']
  assert.ok(typeof v === 'string' && v.length > 0, 'test:py 脚本缺席 ⇒ pnpm 会静默跳过')
  // 触发词按位拼装:本仓有按字面量计数的文本棘轮,夹具里不内嵌完整触发词
  const forbidden = ['|' + '| true', '--passWithNo' + 'Tests', 'exit ' + '0']
  for (const token of forbidden) assert.ok(!v.includes(token), `test:py 出口含静默兜底 ${token}`)
  assert.match(v, /run-ai-service-tests\.mjs/, 'test:py 必须落到那条不会静默的真身')
})

test('生产入口自己也不许出现静默兜底形态', () => {
  const code = SRC_BEFORE
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
    .join('\n')
  assert.ok(!code.includes('|' + '| true'))
  assert.ok(!code.includes('--passWithNo' + 'Tests'))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
