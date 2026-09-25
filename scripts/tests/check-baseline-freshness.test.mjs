// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门「开工前基线新鲜度自检(三轴)」镜像测试(§22c:直接 import 源模块,不复制实现)。
 *
 * 本文件要钉死的是两件容易在后续重构里悄悄失效的事:
 *
 *  1. **③轴绝不进提交链**。规格原文:"恒红门的唯一结局就是没人再守门"。③轴量的是共享工作树
 *     相对 HEAD 的漂移 —— 那oday是并行会话的未提交工作,**提交者结构上无法满足**(§12e 同型),
 *     所以它的红只能在显式的开工自检档(`--preflight`/`--strict-drift`)成立。断言方式是
 *     **同一份数据在两种档下退出码必须不同**:一支无牙不行,一支恒红也不行。
 *  2. **③轴的祖先比对必须复用守门 84**,不得在门内再抄一份 blob 比对逻辑(两处算同一件事
 *     必须共用一份实现)。由"本门源码里不得出现 cat-file / hash-object"的正向锁 + "必须
 *     import analyze"的装载锁共同看守。
 *
 * 所有判据断言一律走 `decide()` 的**构造输入**(纯函数),不用真仓瞬时状态当恒定前提 ——
 * 今天的真仓恰好三轴全过,拿它当尺子等于测"仓库此刻有没有动",而不是测判据。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { __test__ as G } from '../check-baseline-freshness.mjs'

/** 三轴全绿的基线测量值,各用例只覆盖自己关心的那一维。 */
const CLEAN = () => ({
  upstream: { state: 'ok', ref: 'origin/main', behind: 0 },
  main: { state: 'ok', behind: 0, own: 0, source: 'fixture' },
  drift: { total: 0, source: 0, judged: 0, skippedJudge: 0, stale: [], analysis: 'on' },
})
const STALE_DRIFT = (n) => ({
  ...CLEAN(),
  drift: {
    total: 400,
    source: 380,
    judged: 300,
    skippedJudge: 80,
    analysis: 'on',
    stale: Array.from({ length: n }, (_, i) => ({
      path: `p${i}.ts`,
      commit: `cafe${i}0000`,
      span: i + 1,
    })),
  },
})

test('③轴边界(行为面):同一份旧基线数据,未开 strict ⇒ 0,开 strict ⇒ 1', () => {
  const m = STALE_DRIFT(3)
  const loose = G.decide(m, { strictDrift: false, maxStale: 0 })
  const strict = G.decide(m, { strictDrift: true, maxStale: 0 })
  assert.equal(loose.code, 0, '提交链形态(不带自检旗标)因③轴非零 = 每一次提交都被钉红')
  assert.equal(strict.code, 1, '开工自检档不红 = 这条判据没牙,等于没有')
  assert.equal(loose.axes.drift.status, 'report')
  assert.equal(strict.axes.drift.status, 'red')
  // 报数不得因"不判红"而静默
  assert.ok(loose.lines.join('\n').includes('漂移面 400'), '未判红也必须把漂移面数字打出来')
  assert.ok(strict.lines.join('\n').includes('在旧基线上开工)3 个'))
  assert.ok(
    strict.lines.join('\n').includes('超出判定上限 300'),
    '被性能护栏挡在门外的路径数必须如实报',
  )
})

test('③轴边界(源码锁):strictDrift 的缺省必须是 false,不得翻成 true', () => {
  const src = readFileSync(new URL('../check-baseline-freshness.mjs', import.meta.url), 'utf8')
  assert.match(src, /strictDrift\s*=\s*false/, '缺省翻成 true 就等于把③轴接进提交链')
  assert.doesNotMatch(
    src,
    /strictDrift\s*=\s*true\s*}\s*=\s*\{\}/,
    'decide() 的解构缺省不得是 true(那是把边界改成"默认判红")',
  )
  // 提交链档(--staged)必须显式把 strictDrift 关回 false
  assert.equal(G.parseArgs(['--staged']).opts.strictDrift, false)
  assert.ok(
    !G.parseArgs(['--staged']).error,
    '--staged 是 guardian-runner 统一追加的开关,不认就得 exit 2',
  )
  assert.ok(G.parseArgs(['--staged', '--preflight']).error, '两档语义冲突时必须拒绝,不得猜优先级')
})

test('轴①:落后 upstream 判红 / 不落后判绿(同一条判据的正反对照)', () => {
  const red = G.decide({ ...CLEAN(), upstream: { state: 'ok', ref: 'origin/main', behind: 4 } })
  assert.equal(red.code, 1)
  assert.ok(
    red.lines.join('\n').includes('merge --ff-only FETCH_HEAD'),
    '对齐措辞只能是 fetch + ff,§5b 禁止 pull --rebase',
  )
  const body = red.lines.join('\n')
  assert.match(body, /禁止 `git pull --rebase`/, '那句只许作为"禁止"出现,不得当成建议命令')
  assert.ok(
    body.indexOf('git fetch origin main && git merge --ff-only FETCH_HEAD') < body.indexOf('禁止'),
    '可执行的那行必须是 ff 对齐,不是 rebase',
  )
  assert.equal(
    G.decide({ ...CLEAN(), upstream: { state: 'ok', ref: 'origin/main', behind: 0 } }).code,
    0,
  )
})

test('轴②:落后且零独有提交 ⇒ 红(纯过期);有独有提交 ⇒ 只报数', () => {
  const pure = G.decide(
    { ...CLEAN(), main: { state: 'ok', behind: 9, own: 0, source: 'fixture' } },
    { maxBehind: 0 },
  )
  assert.equal(pure.code, 1, '纯过期不红 = 这条判据没牙')
  assert.ok(pure.lines.join('\n').includes('零独有提交'))
  const diverged = G.decide(
    { ...CLEAN(), main: { state: 'ok', behind: 9, own: 2, source: 'fixture' } },
    { maxBehind: 0 },
  )
  assert.equal(diverged.code, 0, '分叉是正常形态,判红会逼人在自己的分支上天天绕过钩子')
  assert.ok(diverged.lines.join('\n').includes('只报数不判红'))
  assert.ok(diverged.lines.join('\n').includes('9'), '不判红也要把数字打出来')
  assert.equal(
    G.decide({ ...CLEAN(), main: { state: 'ok', behind: 0, own: 5, source: 'fixture' } }).code,
    0,
  )
  // 阈值确实在读
  assert.equal(
    G.decide(
      { ...CLEAN(), main: { state: 'ok', behind: 3, own: 0, source: 'f' } },
      { maxBehind: 10 },
    ).code,
    0,
  )
})

test('无法判定三态:fetch 未成功 / ref 解析不到 / 抖动排除不掉 —— 既不冒红也不记绿', () => {
  const fetchFail = G.decide({
    ...CLEAN(),
    main: { state: 'undetermined', reason: 'fetch 未成功:network down' },
  })
  assert.equal(fetchFail.code, 2, '远端态未知却 exit 0 = 把"没看到"当成"没问题"')
  assert.ok(fetchFail.lines.join('\n').includes('轴②'))
  const refUnresolved = G.decide({
    ...CLEAN(),
    upstream: { state: 'undetermined', reason: '疑似 ref 抖动' },
  })
  assert.equal(refUnresolved.code, 2)
  assert.ok(
    !refUnresolved.lines.join('\n').includes('❌ 轴①'),
    'ref 抖动不得冒红(§5b:嵌套 remote-tracking ref 会被秒删)',
  )
  const both = G.decide({
    ...CLEAN(),
    upstream: { state: 'ok', ref: 'origin/main', behind: 7 },
    main: { state: 'undetermined', reason: 'x' },
  })
  assert.equal(both.code, 2, '有轴判不了时不得用另一轴的红冒充"已判定";也不得记绿')
})

test('抖动排除口径:排除不掉时 reason 必须写清,且结论是 undetermined 而非 red(真仓夹具端到端)', () => {
  const fx = G.makeGitRepo()
  try {
    fx.put('x.ts', 'x1\n') // 必须至少一枚提交:没有 HEAD 时 `git diff HEAD` 直接失败
    fx.commit('A')
    // 夹具里没有 origin/main 这个 ref ⇒ 走 flapProbe;两个探针分别代表"排除掉"与"排除不掉"
    const a = G.collect(fx.dir, {
      noFetch: true,
      flapProbe: () => ({ flapping: true, reason: 'refs-heal 报 1 个缺失' }),
    })
    assert.equal(a.main.state, 'undetermined')
    assert.match(a.main.reason, /疑似 ref 抖动/)
    const b = G.collect(fx.dir, {
      noFetch: true,
      flapProbe: () => ({ flapping: false, reason: '清单完整' }),
    })
    assert.equal(b.main.state, 'undetermined')
    assert.match(b.main.reason, /未能排除 ref 抖动/)
    assert.equal(
      b.upstream.state,
      'absent',
      '无 upstream(worktree/游离 HEAD)是正常形态,不计红也不计绿',
    )
  } finally {
    fx.cleanup()
  }
})

test('③轴端到端正反对照:写回祖先版本被挑出并点名最旧的一个 / 真新编辑不算', () => {
  const fx = G.makeGitRepo()
  try {
    fx.put('deep.ts', 'v1\n')
    fx.put('shallow.ts', 's1\n')
    fx.commit('A')
    fx.put('shallow.ts', 's2\n')
    fx.commit('B') // shallow.ts 相对 HEAD 差 1 次改动
    fx.put('deep.ts', 'v2\n')
    fx.commit('C')
    fx.put('deep.ts', 'v3\n')
    fx.commit('D') // deep.ts 相对 HEAD 差 2 次改动
    const off = { noFetch: true, flapProbe: () => ({ flapping: false, reason: 'stub' }) }
    // 反例:工作树 == HEAD
    assert.equal(
      G.collect(fx.dir, off).drift.stale.length,
      0,
      '干净工作树却报旧基线 = 恒红门的起点',
    )
    // 正例:两个路径同时写回各自的历史版本,跨度不同 ⇒ 必须点名最旧的那个
    fx.put('deep.ts', 'v1\n')
    fx.put('shallow.ts', 's1\n')
    const m = G.collect(fx.dir, off)
    const spans = Object.fromEntries(m.drift.stale.map((s) => [s.path, s.span]))
    assert.deepEqual(spans, { 'deep.ts': 2, 'shallow.ts': 1 }, '跨度按该路径上到 HEAD 的提交数算')
    // 夹具里没有 origin/main ⇒ ①②天然是 undetermined(exit 2 优先)。本例只考 ③轴,
    // 所以把远端两轴换成"已判定且通过"的构造值,再验退出码 —— 顺带证明优先级没写反。
    const remoteOk = {
      ...m,
      upstream: { state: 'ok', ref: 'origin/main', behind: 0 },
      main: { state: 'ok', behind: 0, own: 0, source: 'fixture' },
    }
    assert.equal(
      G.decide(m, { strictDrift: true, maxStale: 0 }).code,
      2,
      '有一轴判不了时 exit 2 优先于红',
    )
    const v = G.decide(remoteOk, { strictDrift: true, maxStale: 0 })
    assert.equal(v.code, 1)
    const body = v.lines.join('\n')
    const iDeep = body.indexOf('deep.ts')
    const iShallow = body.indexOf('shallow.ts')
    assert.ok(iDeep > -1 && iShallow > -1 && iDeep < iShallow, '必须按跨度倒序点名(最旧的排第一)')
    assert.ok(/oldest|落后 2 次改动/.test(body))
    // 反例:未提交的新编辑不等于任何历史版本 ⇒ 绝不计入旧基线
    fx.put('shallow.ts', 'brand-new-never-committed\n')
    const m2 = G.collect(fx.dir, off)
    assert.deepEqual(
      m2.drift.stale.map((s) => s.path),
      ['deep.ts'],
      '把新编辑算成旧基线 ⇒ 每次开工都红',
    )
  } finally {
    fx.cleanup()
  }
})

test('复用守门 84,不另抄一份祖先比对(单一真相源)', () => {
  const raw = readFileSync(new URL('../check-baseline-freshness.mjs', import.meta.url), 'utf8')
  // 只判**代码**:头注释必须写"为什么不自己 cat-file",把注释也算进去就是拆掉说理。
  const code = raw.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.match(code, /from '\.\/check-stale-revert\.mjs'/, '必须 import 门 84 的判据')
  assert.match(code, /analyze\(/, 'import 了却不调用 = 摆设')
  assert.match(code, /worktreeDirtyPaths\(/, '漂移面清单同样复用门 84 的出口')
  assert.match(code, /ancestorCommits\(/, '跨度换算也走门 84 的祖先清单,不自造搜索')
  // 第二份真相的指纹:本门**代码里**不得再搭一套 blob 取材/比对
  assert.doesNotMatch(
    code,
    /hash-object|cat-file|--batch/,
    '这里出现了第二套 blob 取材/比对实现 ⇒ 与门 84 必然漂移',
  )
  assert.doesNotMatch(code, /findObject|find-object/, '同理不得自己再造祖先搜索')
  assert.ok(
    raw.includes('绝不进提交链') && raw.includes('恒红门'),
    '③轴边界的"为什么"必须留在门头注释里 —— 镜像测试只证明它有牙,证明不了它为何这样设计',
  )
})

test('decide() 是纯函数(同输入两次调用逐字相同,不藏状态)', () => {
  const m = STALE_DRIFT(2)
  const a = G.decide(m, { strictDrift: true, maxStale: 0 })
  const b = G.decide(m, { strictDrift: true, maxStale: 0 })
  assert.deepEqual(a, b)
  assert.deepEqual(G.SOURCE_RE.test('x.ts'), true)
  assert.equal(G.SOURCE_RE.test('x.md'), false, '文档不算源码类(它常年滞后,计进来只会让漂移面虚高)')
  assert.equal(G.DEFAULTS.maxBehind, 0)
  assert.equal(G.DEFAULTS.maxStale, 0)
})

test('命令行校验:未知开关 / 非整数 / 负数 / 缺值 一律 exit 2(不得静默走默认档)', () => {
  for (const bad of [
    ['--push'],
    ['--max-behind', 'x'],
    ['--max-behind', '-1'],
    ['--max-stale'],
    ['--max-stale', '1.5'],
  ]) {
    const r = G.parseArgs(bad)
    assert.ok(r.error, `${bad.join(' ')} 必须被拒,实际落进默认档就是"参数没生效而退出码看着正常"`)
  }
  assert.equal(G.parseArgs(['--max-behind', '5']).opts.maxBehind, 5)
  assert.equal(G.parseArgs(['--max-stale', '2']).opts.maxStale, 2)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
