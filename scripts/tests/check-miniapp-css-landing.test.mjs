/**
 * §22c 镜像测试 —— scripts/check-miniapp-css-landing.mjs
 *
 * 跑法:node --test scripts/tests/check-miniapp-css-landing.test.mjs
 *
 * 三件事必须被证明,缺一即测试无意义:
 *  1. **判据有牙**:C1 的算术在"全缺失"时必判 0、"全落地"时必判 1,且分母不收参考层外的名字。
 *     形状判据只能用纯函数 + 构造面证明(不得靠"真仓跑一次看它红不红"—— 真仓现在根本没有
 *     可信的 weapp 产物,那种证明方式今天会直接退化成了没测)。
 *  2. **绝不假绿**:产物缺失 / 产物是别的平台构建 / 参考层跑不起来 —— 三种输入都必须 exit 2,
 *     任何一条退化成 exit 0 就说明"把工具失效当成了通过"。
 *  3. **本门不得被静默摘线**:接线态由门自己的 `WIRING_MODE` 单点声明,镜像测试拿它和
 *     `guardian-runner.mjs` 的实际注册内容对账,**两个方向都要红**:
 *       - 声明 manual 而 runner 里出现了它 ⇒ 有人把它接进了提交链却没改声明;
 *       - 声明 commit 而 runner 里没有它 ⇒ 门被摘线(造好没装车,本仓最高频那一型)。
 *     当前真值是 manual —— 因为它判构建产物,提交者结构上未必满足,接成 blocking 只会逼人
 *     --no-verify 并连带废掉全部守门(§12e)。
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'

import { __test__ as G, WIRING_MODE } from '../check-miniapp-css-landing.mjs'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname.slice(1)), '..', '..')
const GATE = join(ROOT, 'scripts', 'check-miniapp-css-landing.mjs')
const RUNNER = join(ROOT, 'scripts', 'guardian-runner.mjs')

function runGate(args, cwd = ROOT) {
  const r = spawnSync(process.execPath, [GATE, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 300000,
    maxBuffer: 64 << 20,
    windowsHide: true,
  })
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` }
}

function mkTmp(tag) {
  const p = join(ROOT, '.ihui-agent', 'tmp', `css-landing-mirror-${tag}`)
  if (existsSync(p)) rmSync(p, { recursive: true, force: true })
  mkdirSync(p, { recursive: true })
  return p
}
function rmTmp(p) {
  if (existsSync(p)) rmSync(p, { recursive: true, force: true })
}

/* ─────────────── 1. 判据有牙:C1 算术(纯函数 + 构造面) ─────────────── */

test('C1 全缺失必判 0 覆盖并点名样例(该红必红)', () => {
  const c = G.computeCoverage(['flex', 'text-sm', 'w-full'], new Set(['flex', 'text-sm', 'w-full']), new Set())
  assert.equal(c.pct, 0)
  assert.equal(c.demandedKinds, 3)
  assert.equal(c.missKinds, 3)
  assert.equal(c.missingSamples.length, 3)
})

test('C1 全落地必判 1 覆盖(该绿必绿)', () => {
  const c = G.computeCoverage(['flex', 'text-sm'], new Set(['flex', 'text-sm']), new Set(['flex', 'text-sm']))
  assert.equal(c.pct, 1)
  assert.equal(c.missKinds, 0)
})

test('C1 分母不收参考层外的自有类(否则恒红)', () => {
  // action-btn / my-title 是端内自有语义类,Tailwind 结构上不会产出它们,
  // 把它们算进分母会让覆盖率永远到不了 100% —— 那是一把恒红的尺子。
  const c = G.computeCoverage(['flex', 'action-btn', 'my-title'], new Set(['flex']), new Set(['flex']))
  assert.equal(c.demandedKinds, 1)
  assert.equal(c.pct, 1)
})

test('C1 分母为空不得判成 0 覆盖(无需求 ≠ 全失败)', () => {
  assert.equal(G.computeCoverage(['x'], new Set(), new Set()).pct, 1)
})

/* ─────────────── 2. 转义与任意值类名不得隐身 ─────────────── */

test('任意值/感叹号前缀的转义类名必须被认出来', () => {
  assert.deepEqual([...G.harvestLandedSelectors('.\\!visible{a:b}')], ['!visible'])
  assert.ok(G.harvestLandedSelectors('.-right-\\[12rpx\\]{right:-12rpx}').has('-right-[12rpx]'))
})

test('裸类名(无规则体)不得算落地,注释里的假规则不得算定义', () => {
  assert.deepEqual([...G.harvestLandedSelectors('.parent .child')], [])
  assert.deepEqual([...G.harvestClassDeclarations('/* .fake{color:red} */ .real{color:red}').keys()], ['real'])
})

/* ─────────────── 3. 同名双义三档分类,各一正一反 ─────────────── */

test('white-on-white:浅色 color × 浅色 background 且自有不设 color', () => {
  assert.equal(
    G.classifyDualMeaning(['color:var(--color-card)'], ['background:var(--color-card)', 'padding:28rpx']),
    'white-on-white',
  )
})

test('反向对照:深色 background / 自己设 color / utility 不出 color,都不得判成白底事故', () => {
  assert.notEqual(G.classifyDualMeaning(['color:var(--color-card)'], ['background:#111827']), 'white-on-white')
  assert.notEqual(G.classifyDualMeaning(['color:var(--color-card)'], ['background:#fff', 'color:#333']), 'white-on-white')
  assert.notEqual(G.classifyDualMeaning(['display:flex'], ['background:var(--color-card)']), 'white-on-white')
})

test('盲区判据只在 Tailwind 命名空间里成立(1500+ 条噪声会把真那一条埋掉)', () => {
  // text-card 前缀 text 下有 text-sm ⇒ 它可能是候选,参考层看不见就必须点名
  assert.deepEqual(G.findBlindSpots(['text-card'], new Set(['text-sm'])), ['text-card'])
  // action-btn 前缀 action 下没有任何 Tailwind 规则 ⇒ 结构上不可能,不得混进来
  assert.deepEqual(G.findBlindSpots(['action-btn', 'agent-avatar'], new Set(['text-sm', 'flex'])), [])
  assert.equal(G.namespacePrefix('text-muted-foreground'), 'text-muted')
  assert.equal(G.namespacePrefix('visible'), 'visible')
})

/* ─────────────── 4. 主包切分:长在 pages/ 下的分包根必须剔除 ─────────────── */

test('主包按 app.json 的 subpackage roots 切,不按 pkg-* 前缀', () => {
  const base = mkTmp('budget')
  try {
    const d = join(base, 'dist')
    mkdirSync(join(d, 'pages', 'circle'), { recursive: true })
    const appJson = JSON.stringify({ pages: ['pages/i'], subpackages: [{ root: 'pages/circle' }] })
    writeFileSync(join(d, 'app.json'), appJson)
    writeFileSync(join(d, 'app.wxss'), 'x'.repeat(100))
    writeFileSync(join(d, 'pages', 'circle', 'i.wxss'), 'y'.repeat(500))
    const m = G.measureMainPackage(d)
    assert.equal(m.subBytes, 500, 'pages/circle 是分包,不得算进主包')
    assert.equal(m.mainBytes, Buffer.byteLength(appJson) + 100)
    assert.equal(m.headroomBytes, G.MAIN_PACKAGE_LIMIT - m.mainBytes)
  } finally {
    rmTmp(base)
  }
})

/* ─────────────── 5. 绝不假绿:三种坏输入都必须 exit 2 ─────────────── */

test('产物不存在 ⇒ exit 2「无法判定」,不得报成 0% 覆盖', () => {
  const base = mkTmp('absent')
  try {
    const dir = mkFakeApp(base)
    const r = runGate(['--root', base, '--skip-reference', '--dist-dirname', 'nope-dist'])
    assert.equal(r.code, 2, `期望 exit 2,实得 ${r.code}\n${r.out}`)
    assert.match(r.out, /无法判定/)
    assert.doesNotMatch(r.out, /❌ C1/, '产物缺失绝不该表现为判据红(那是把工具失效当业务结论)')
    void dir
  } finally {
    rmTmp(base)
  }
})

test('dist 是 h5 构建(与 weapp 共用 outputRoot)⇒ exit 2,不得当成 0 落地', () => {
  const base = mkTmp('h5clobber')
  try {
    const app = mkFakeApp(base)
    const dist = join(app, 'dist')
    mkdirSync(dist, { recursive: true })
    writeFileSync(join(dist, 'index.html'), '<html>')
    writeFileSync(join(dist, 'app.js'), '')
    const r = runGate(['--root', base, '--skip-reference'])
    assert.equal(r.code, 2, `期望 exit 2,实得 ${r.code}\n${r.out}`)
    assert.match(r.out, /h5/, '必须点名是被 h5 构建覆盖了')
  } finally {
    rmTmp(base)
  }
})

test('参考层不可用时 C1/C2 判不出,不得"看起来全绿"', () => {
  const base = mkTmp('noref')
  try {
    mkFakeApp(base)
    const r = runGate(['--root', base, '--skip-reference'])
    assert.equal(r.code, 2)
    assert.match(r.out, /skip-reference/)
  } finally {
    rmTmp(base)
  }
})

/* ─────────────── 6. 真仓读数:当前无可信 weapp 产物 ⇒ exit 2 ─────────────── */

test('真仓在本机当前状态下必须判「无法判定」而不是通过', () => {
  const r = runGate([])
  assert.equal(r.code, 2, `本机 dist 不是可信 weapp 产物时应为 2,实得 ${r.code}\n${r.out}`)
  assert.match(r.out, /未判定/)
})

/* ─────────────── 7. 本门不得被静默摘线(装车形状对账) ─────────────── */

test('WIRING_MODE 与实际接线必须双向一致', () => {
  assert.ok(['manual', 'commit'].includes(WIRING_MODE), `WIRING_MODE 取值非法:${WIRING_MODE}`)
  const runner = readFileSync(RUNNER, 'utf8')
  const wired = /check-miniapp-css-landing\.mjs/.test(runner)
  if (WIRING_MODE === 'manual') {
    assert.equal(wired, false, '声明为手动/CI 门,但 guardian-runner 里出现了它 —— 有人把它接进了提交链而没改声明。接成 blocking 会让提交者因"产物不存在"被逼 --no-verify(§12e)。')
  } else {
    assert.equal(wired, true, '声明已接提交链,但 runner 里没有它 —— 本门被摘线了(造好没装车,本仓最高频那一型)。')
    const block = runner.slice(Math.max(0, runner.indexOf('check-miniapp-css-landing.mjs') - 600), runner.indexOf('check-miniapp-css-landing.mjs') + 600)
    assert.match(block, /skipEnv/, '接线成提交链的门必须留应急出口')
  }
})

test('源码里必须写着「当前为手动 / CI 门」,且结论行也要说出这件事', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /手动 \/ CI 门/, '头注必须如实登记定级,否则下一个人会以为它在守提交')
  const r = runGate(['--min-coverage', '0'])
  assert.match(r.out, /未接进提交链/, '运行输出也要说明定级(只看代码的人不会跑代码,跑一次的人应当被告知)')
})

/* ─────────────── 8. §22c / §22d 结构锚点 ─────────────── */

test('§22d:源文件必须有 isDirectRun 守卫(被 import 时不得触发 main)', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/)
  assert.match(src, /if \(isDirectRun\) \{/)
  assert.match(src, /pathToFileURL/, 'Windows 反斜杠路径必须经 pathToFileURL 归一,裸拼永不匹配')
})

test('§22c:__test__ 必须导出判据函数本体(不得让测试复制第二份实现)', () => {
  for (const k of [
    'harvestClassNameTokens',
    'harvestClassDeclarations',
    'harvestLandedSelectors',
    'classifyDist',
    'collectLandedFromDist',
    'measureMainPackage',
    'classifyDualMeaning',
    'findBlindSpots',
    'namespacePrefix',
    'computeCoverage',
    'buildUtilityReference',
    'runCheck',
  ]) {
    assert.equal(typeof G[k], 'function', `__test__ 缺少 ${k}`)
  }
})

test('--self-test 必须全绿(判据自身的成对正反例)', () => {
  const r = runGate(['--self-test'])
  assert.equal(r.code, 0, `self-test 失败:\n${r.out}`)
  assert.match(r.out, /失败 0/)
})

/* ─────────────── 9. 只读性:跑门不得改动产物或源码 ─────────────── */

test('本门全程只读:跑完之后 git 状态不得出现新的改动', () => {
  const before = execFileSync('git', ['-c', 'safe.directory=*', 'status', '--porcelain'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  })
  runGate(['--min-coverage', '0'])
  runGate(['--staged', '--min-coverage', '0'])
  const after = execFileSync('git', ['-c', 'safe.directory=*', 'status', '--porcelain'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  })
  assert.equal(after, before, '门必须只读;跑一次就改工作区等于给并行会话制造假改动')
})

/* ── 夹具:一份最小可枚举的假端目录(不含 tailwind,故参考层必然判不出) ── */
function mkFakeApp(base) {
  const app = join(base, 'apps', 'miniapp-taro')
  mkdirSync(join(app, 'src', 'pages'), { recursive: true })
  writeFileSync(join(app, 'src', 'pages', 'i.tsx'), 'export const X = () => <View className="flex text-card" />')
  writeFileSync(join(app, 'src', 'app.css'), '.text-card{background:var(--color-card)}')
  return app
}
