// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:直接 import 源脚本的 __test__,禁止在测试里复制一份实现。
//
// 断的是**不变量**,不是存量数字 —— 本仓反复记录"清单/计数写死 ⇒ 清单腐烂 ⇒ 恒红 ⇒ 全队
// --no-verify ⇒ 全部守门作废"。因此这里没有任何一条形如"border-ink-exempt 必须有 149 处"的断言;
// 涉及仓内实际形态的断言一律从基线文件/源码**推导**出来再自比。
//
// 夹具在 mkScratch 临时目录构造并显式 --root 传入,绝不扫真仓(守门 70 教训:测试靠 cwd
// 定位夹具而脚本忽略 cwd,14 例全在扫真仓)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gate } from '../check-exemption-expiry.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = resolve(HERE, '..', 'check-exemption-expiry.mjs')
const REPO = resolve(HERE, '..', '..')
const SRC = readFileSync(SCRIPT, 'utf8')
const BASELINE_PATH = join(REPO, gate.BASELINE_REL)

const TODAY = '2026-09-25'
const entry = (over) => ({
  file: 'a.ts',
  family: 'border-ink-exempt',
  line: 1,
  attach: 'inline',
  expiry: null,
  hasReason: true,
  fileScoped: false,
  lifetimeDays: 90,
  registered: true,
  ...over,
})
const run = (args) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180000,
    maxBuffer: 64 << 20,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })

// ---------------------------------------------------------------- §22c 锚点

test('T01 源脚本必须 export __test__ 且含判据核心(缺锚点即漂移)', () => {
  for (const key of [
    'scanFile',
    'analyze',
    'mergeBaseline',
    'isPast',
    'parseMarkerTail',
    'BASELINE_REL',
    'suppressionUndatedCountsOf',
    'resolveSuppressionAnchor',
  ]) {
    assert.ok(key in gate, `__test__ 缺键 ${key}`)
  }
  // §22d:CLI 入口必须被 isDirectRun 挡住,且 pathToFileURL 不得被手写 file:/// 拼接取代
  assert.match(SRC, /export const __test__ = \{/)
  assert.match(SRC, /import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/)
  assert.doesNotMatch(SRC, /new URL\(`file:\/\/\//)
})

test('T02 取材口径必须与全链一致(HEAD blob / 索引 blob / 工作树仅逃生舱)', () => {
  assert.match(SRC, /selectFace\(\{/)
  assert.match(SRC, /readWorktreeFile/)
  // 面为 head 时必须带 `HEAD:` 前缀剥离 —— 不剥会让每条 blob 变成 HEAD:HEAD:path,
  // 表现是"0 条豁免 + 绿灯"(写门当场中过的那一发)。
  assert.match(SRC, /startsWith\('HEAD:'\)/)
})

// ---------------------------------------------------------------- 判据方向

test('T03 isPast 的方向是唯一真相(反一次就让 9 条判据同时错位)', () => {
  assert.equal(gate.isPast('2020-01-01', TODAY), true)
  assert.equal(gate.isPast('2099-12-31', TODAY), false)
  assert.equal(gate.isPast(TODAY, TODAY), false, '到期日当天必须仍有效')
  assert.equal(gate.isPast('坏日期', TODAY), false, '解析不出来的日期不得被当成已过期')
})

test('T04 E1 只认"超出基线的部分"(新增豁免不带日期才红)', () => {
  const entries = [entry({}), entry({ line: 2 })]
  const base = { grandfatherUntil: '2099-01-01', undatedCounts: { 'a.ts::border-ink-exempt': 2 } }
  assert.equal(
    gate.analyze({ entries, suppressionsByFile: {}, baseline: base, today: TODAY }).red.length,
    0,
  )
  const grown = [...entries, entry({ line: 3 })]
  const r = gate.analyze({ entries: grown, suppressionsByFile: {}, baseline: base, today: TODAY })
  assert.equal(r.red.length, 1)
  assert.equal(r.red[0].code, 'E1')
  assert.match(r.red[0].msg, /多出的 1 处必须写/)
})

test('T05 E2 已过期豁免无条件红,基线救不了它(豁免=借来的时间)', () => {
  const expired = entry({ expiry: '2020-01-01' })
  const r = gate.analyze({
    entries: [expired],
    suppressionsByFile: {},
    baseline: { grandfatherUntil: '2099-01-01', undatedCounts: { 'a.ts::border-ink-exempt': 1 } },
    today: TODAY,
  })
  assert.equal(r.red.length, 1)
  assert.equal(r.red[0].code, 'E2')
  assert.equal(r.red[0].file, 'a.ts')
})

test('T06 E3 基线自身过期即整门红;账销完即绿;字段缺失按"过期"处理', () => {
  const stock = { grandfatherUntil: '2020-01-01', undatedCounts: { 'a.ts::border-ink-exempt': 3 } }
  assert.ok(
    gate
      .analyze({ entries: [], suppressionsByFile: {}, baseline: stock, today: TODAY })
      .red.some((v) => v.code === 'E3'),
  )
  const cleared = gate.analyze({
    entries: [],
    suppressionsByFile: {},
    baseline: { grandfatherUntil: '2020-01-01', undatedCounts: {} },
    today: TODAY,
  })
  assert.equal(cleared.red.length, 0)
  const missing = gate.analyze({
    entries: [],
    suppressionsByFile: {},
    baseline: { undatedCounts: { 'a::b': 1 } },
    today: TODAY,
  })
  assert.ok(
    missing.red.some((v) => v.code === 'E3'),
    'grandfatherUntil 缺失不得被读成"永久宽限"',
  )
})

test('T07 lint 抑制面总账只报数(锚点缺失档,E5 退回只报数 —— 规格 §7 + G-666)', () => {
  const s = gate.scanFile(
    'g.ts',
    '/* eslint-disable no-console */\n// eslint-disable-next-line x/y\n// @ts-ignore\n',
  )
  assert.equal(s.suppressions['eslint-disable'], 2)
  assert.equal(s.suppressions['ts-ignore'], 1)
  // 不传 headSuppressionCounts(= HEAD 锚点取不到的退化档)⇒ E5 整维退回只报数,
  // 与真仓旧基线(无 suppressionUndatedCounts 字段)同形 —— 拿 0 当锚点就是上线恒红 342/70 处。
  const r = gate.analyze({
    entries: [],
    suppressionsByFile: { 'g.ts': s.suppressions },
    baseline: { grandfatherUntil: '2099-01-01', undatedCounts: {} },
    today: TODAY,
  })
  assert.equal(r.red.length, 0)
  assert.equal(r.totals.suppressTotals['eslint-disable'], 2)
  assert.ok(r.soft.some((x) => x.code === 'S5'), '锚点缺失必须喊出,不得静默装绿')
})

// ---------------------------------------------------------------- 语法覆盖面

test('T08 两种挂靠方式与各族拼写都能被同一判据看见(否则同时产假红与假绿)', () => {
  const cases = [
    ['x = 1 // border-ink-exempt: 正圆', 'border-ink-exempt', 'inline'],
    ['// statusbar-exempt: 与封面同高\nconst a = 1', 'statusbar-exempt', 'prev-line'],
    ['<Text>›</Text> // glyph-arrow-exempt: 同源指示符', 'glyph-arrow-exempt', 'inline'],
    ["a('*!important/*!ihui-allow-important:理由*/')", 'ihui-allow-important', 'inline'],
    ['// alpha-plugin-exempt: 默认色板 until 2099-01-01', 'alpha-plugin-exempt', 'prev-line'],
    ['// r7-nest-exempt: 压在图上', 'r7-nest-exempt', 'prev-line'],
    ['// brand-mail-exempt: 演练', 'brand-mail-exempt', 'prev-line'],
    ['// r3-cta-exempt: 端内旧键', 'r3-cta-exempt', 'prev-line'],
    ['// rust-state-exempt: 托盘态', 'rust-state-exempt', 'prev-line'],
    ['// arch-exempt: 循环依赖 until 2099-01-01', 'arch-exempt', 'prev-line'],
    ['// r5-cta-exempt: 图片浮层', 'r5-cta-exempt', 'prev-line'],
    [
      '// i18n-content-exempt-file: 本文件中文即对外 payload 文本(≥12 字)',
      'i18n-content-exempt-file',
      'prev-line',
    ],
  ]
  for (const [text, family, attach] of cases) {
    const { entries } = gate.scanFile('t.tsx', text)
    assert.equal(entries.length, 1, `应恰好一条:${family}`)
    assert.equal(entries[0].family, family)
    assert.equal(entries[0].attach, attach)
    assert.ok(entries[0].hasReason, `${family} 的理由不得被吞`)
  }
})

test('T09 标记之前的散文日期不得被当成本笔到期日', () => {
  const line =
    ' * 出口形态照守门 70 在 2026-09-24 补的 `i18n-content-exempt-file: 理由要十二字以上才算数\n'
  const { entries } = gate.scanFile('h.mjs', line)
  assert.equal(entries[0].expiry, null)
})

test('T10 未登记族仍入账并给默认存活期(新门加的族不得隐身)', () => {
  const { entries } = gate.scanFile('u.ts', '// some-future-gate-exempt: 某道还没登记的门\n')
  assert.equal(entries.length, 1)
  assert.equal(entries[0].registered, false)
  assert.equal(entries[0].lifetimeDays, gate.DEFAULT_LIFETIME_DAYS)
})

// ---------------------------------------------------------------- 基线文件本身

test('T11 基线是合法账本:日期有效、额度非负整数、族都已登记(清单腐烂即红)', () => {
  const b = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  assert.match(String(b.grandfatherUntil), /^20\d{2}-\d{2}-\d{2}$/, '宽限截止日必须是有效日期')
  assert.ok(Object.keys(b.undatedCounts).length > 0, '空账本意味着建门时没量存量')
  const bad = Object.entries(b.undatedCounts).filter(
    ([k, v]) => !/::[a-z0-9-]+$/.test(k) || !Number.isInteger(v) || v < 1,
  )
  assert.deepEqual(bad, [], '键必须形如 <path>::<family> 且额度为正整数')
  const families = new Set(Object.keys(b.undatedCounts).map((k) => k.split('::')[1]))
  const unregistered = [...families].filter((f) => !(f in gate.FAMILY_LIFETIME_DAYS))
  assert.deepEqual(
    unregistered,
    [],
    `基线里出现未登记族(要么补存活期,要么它的豁免已腐烂):${unregistered}`,
  )
})

test('T12 mergeBaseline:只下调、并集、绝不上调、保留未观测键与他人顶层键', () => {
  const old = { noteBy: '他人注释', undatedCounts: { keep: 9, down: 5 } }
  const m = gate.mergeBaseline(old, {
    undatedCounts: { down: 2, fresh: 1 },
    grandfatherUntil: '2099-01-01',
    updatedAt: TODAY,
  })
  assert.equal(m.next.undatedCounts.down, 2)
  assert.equal(m.next.undatedCounts.keep, 9, '本轮没扫到的键不得被删(整表重写会冲掉并行会话的条目)')
  assert.equal(m.next.undatedCounts.fresh, 1)
  assert.equal(m.next.noteBy, '他人注释', '未知顶层键必须原样保留')
  assert.equal(
    gate.mergeBaseline({ undatedCounts: { up: 1 } }, { undatedCounts: { up: 99 } }).next
      .undatedCounts.up,
    1,
    '额度只允许下调',
  )
})

// ---------------------------------------------------------------- CLI 行为

test('T13 CLI 只读档绝不写盘(唯一写盘动作是 --update-baseline)', () => {
  const before = readFileSync(BASELINE_PATH, 'utf8')
  const r = run([])
  assert.equal(r.status, 0, `全量档应当只报数不判红:${r.stderr}`)
  assert.equal(readFileSync(BASELINE_PATH, 'utf8'), before, '只判不写:不得有任何副作用')
  assert.match(r.stdout, /缺日期\(新增\)= 0 \/ 已过期 = 0/)
})

test('T14 --staged 与 --worktree 同给必须判死(两个面互斥,取哪一面都是假绿)', () => {
  const r = run(['--staged', '--worktree'])
  assert.equal(r.status, 2)
  assert.match(r.stderr, /无法判定/)
})

test('T15 取材失败必须 exit 2 而不是冒绿(指向不存在的 --root)', () => {
  const r = run(['--root', join(dirname(SCRIPT), 'no-such-dir-xyz')])
  assert.equal(r.status, 2, `应判死,实际 ${r.status}:${r.stdout}`)
  assert.match(`${r.stderr}${r.stdout}`, /无法判定/)
})

test('T16 --json 可 parse 且 red/soft 是数组(供 runner 归因解析)', () => {
  const r = run(['--json'])
  const parsed = JSON.parse(r.stdout)
  assert.ok(Array.isArray(parsed.red) && Array.isArray(parsed.soft))
  assert.equal(parsed.face, 'head')
})

test('T17 --self-test 必须全绿且不得把用例数写死进断言', () => {
  const r = run(['--self-test'])
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.doesNotMatch(r.stdout, /FAIL/)
  const m = /self-test:(\d+)\/(\d+) 通过/.exec(r.stdout)
  assert.ok(m, '末行必须报"N/M 通过"')
  assert.equal(Number(m[1]), Number(m[2]))
})

// 【接线状态:已接入】这一行引导语是头注必须有的现状陈述(T18 判据要求它):
// 本门早已注册进 guardian-runner(实测 id:'108' / mode:'blocking' /
// skipEnv:'HUSKY_SKIP_EXEMPTION_EXPIRY'),头注如实写成「已接入」才是**真话**。
test('T18 头注声称的接线态必须与注册表真值一致(两态都认,不许把真话判红)', () => {
  // 立意不变:头注若声称"已接入"而注册表里没有 → 那是给后人一个跑不通的出路(守门 89 反向锁),必须拦。
  //
  // 2026-10-06 改判据的原因(与门 133 的 M3、radius 的 T2、token-sync 的 T9、
  // model-capacity-parity 的 T8 同族):原判据是**无条件** `doesNotMatch(/已接入 pre-commit|已注册 guardian|/)`
  // —— 它锚死一句会过期的台词,不看注册表真值。而接线**真的已经发生**
  // (guardian-runner.mjs:2937-2942 实测 id:'108' / blocking / skipEnv:HUSKY_SKIP_EXEMPTION_EXPIRY),
  // 于是谁把头注如实改成「已接入」谁就被判红 —— **一条把真相判红的尺子,教出来的就是谎报**。
  // 同文件自相矛盾的事实:T16 断言本门 --json 输出要"供 runner 归因解析"、T13/T15/T17 都按
  // "runner 里注册着的一道 blocking 门"来跑,唯独 T18 仍禁"已接入"措辞。
  //
  // ⚠️ 只认**现状陈述**,不认存档引文(同族三次踩坑换来的收口):判据只吃『接线状态:』引导的那一行
  // (容许括号里的时点注记),并显式剔掉带 `已漂移 / 原<日期> / 不再是` 的历史记录与引文
  // —— 否则一句"如实记录历史"会被读成现状,变异时全绿 = 无牙;而若改成否定义句,基线自己先红。
  // 【接线状态:已接入】的写法见上;主门头注当前尚未补这一行引导语,故 statusLines 为空时
  // 走下面的"补齐前"档(只拦硬谎报),补齐后自动切到两态对账。**主门头注的接线状态行由主会话统一补齐。**
  const runner = readFileSync(join(HERE, '..', 'guardian-runner.mjs'), 'utf8')
  const wired = runner.includes('check-exemption-expiry.mjs')
  // 注册表条目的 id 与本门同段(挨在 script 那行上下),取出来只为让红字能指名道姓,不写死 '108'
  const entryId = /id: '(\d+)'[\s\S]{0,200}?check-exemption-expiry\.mjs/.exec(runner)?.[1]
  const head = SRC.slice(0, SRC.indexOf('\nimport '))
  const STATUS_GUIDE = /接线状态\s*(?:\([^)]*\))?\s*[:：]/
  const HISTORY = /已漂移|原\s*20\d{2}[-/]\d{2}|不再是/
  const statusLines = (head.match(/^.*$/gm) || []).filter(
    (l) => STATUS_GUIDE.test(l) && !HISTORY.test(l),
  )
  // 存档引文整段剔掉后再看"本门此刻在说什么":否则一句如实记录历史会被读成现状
  // (变异时全绿 = 无牙)。两分支共用这一份剔过的文本,免得否定义句把存档判红。
  const spoken = (head.match(/^.*$/gm) || []).filter((l) => !HISTORY.test(l)).join('\n')
  if (statusLines.length === 0) {
    // 补齐前:还没有引导语可供对账,但硬谎报一句都不许留(判据只能变宽,不能变松)。
    assert.doesNotMatch(spoken, /已接 pre-commit|已注册 guardian|guardian 第 \d+ 项|CI 必跑|未接/, '未给出接线状态行之前更不得夹带任何接线态声称')
  } else if (wired) {
    assert.ok(
      statusLines.some((l) => /已接入/.test(l)),
      `注册表里本门已注册(id:${entryId}),但头注的『接线状态:』那一行仍说未接线 ⇒ 文档与提交链分叉:${JSON.stringify(statusLines)}`,
    )
  } else {
    assert.ok(
      statusLines.some((l) => /未接/.test(l)),
      `头注必须明说未接线(而不是留白让人猜):${JSON.stringify(statusLines)}`,
    )
    assert.doesNotMatch(spoken, /已接 pre-commit|CI 必跑/, '不得谎称已接')
  }
  assert.doesNotMatch(SRC, /^const SKIP_ENV/m, '脚本自身不得内置 HUSKY_SKIP_* 逃生舱')
})

test('T19 自豁免只认本门那两份文件(过宽 = 后门,过窄 = 门吃掉自己的夹具)', () => {
  const re = gate.SELF_EXEMPT_RE
  assert.ok(re instanceof RegExp, '__test__ 必须导出 SELF_EXEMPT_RE')
  for (const hit of [
    'scripts/check-exemption-expiry.mjs',
    'scripts/tests/check-exemption-expiry.test.mjs',
  ]) {
    assert.ok(re.test(hit), `${hit} 必须被自豁免(它含的全是判据夹具)`)
  }
  for (const miss of [
    'scripts/check-other.mjs',
    'scripts/lib/check-exemption-expiry.mjs',
    'apps/web/src/x.mjs',
    'scripts/check-file-size.mjs',
  ]) {
    assert.ok(!re.test(miss), `${miss} 不得被自豁免`)
  }
})

test('T20 自豁免不得吃掉别的文件里的过期豁免(临时仓双向对照)', () => {
  const dir = mkScratch('exemption-self-exempt')
  try {
    const git = (a) =>
      execFileSync('git', ['-c', 'safe.directory=*', '-C', dir, ...a], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 30000,
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    git(['init', '-q'])
    git(['config', 'user.email', 't@test.invalid'])
    git(['config', 'user.name', 't'])
    mkdirSync(join(dir, 'scripts'), { recursive: true })
    mkdirSync(join(dir, 'apps'), { recursive: true })
    writeFileSync(
      join(dir, gate.BASELINE_REL),
      JSON.stringify({ grandfatherUntil: '2099-01-01', undatedCounts: {} }),
    )
    const EXPIRED = 'export const v = 1 // border-ink-exempt: 夹具日期已过去 until 2020-01-01\n'
    // 同名文件走自豁免 ⇒ 不红;换个路径的同一条豁免必须照红
    writeFileSync(join(dir, 'scripts', 'check-exemption-expiry.mjs'), EXPIRED)
    writeFileSync(join(dir, 'apps', 'other.ts'), EXPIRED)
    git(['add', '.'])
    git(['commit', '-q', '-m', 'fixture'])
    const r = spawnSync(process.execPath, [SCRIPT, '--root', dir, '--json'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const parsed = JSON.parse(r.stdout || '{}')
    assert.equal(r.status, 1, `别的文件里的过期豁免必须判红:${r.stderr}`)
    const named = (parsed.red || []).map((v) => v.file)
    assert.ok(named.includes('apps/other.ts'), '必须点名非自豁免文件')
    assert.ok(
      !named.some((f) => f.includes('check-exemption-expiry')),
      '自豁免不得扩大到别的文件之外',
    )
  } finally {
    rmScratch(dir)
  }
})

test('T21 工具面(scripts/**)只影响记账面,且两侧都有牙 —— 纯函数 + 构造面', () => {
  const re = gate.TOOL_FACE_RE
  assert.ok(re instanceof RegExp, '__test__ 必须导出 TOOL_FACE_RE')
  assert.ok(re.source.startsWith('^'), '工具面必须锚定路径行首:写成 /scripts\\// 会把别的面吞掉')
  const LINE = '// border-ink-exempt: 头像要纯圆'
  const EXPIRED_LINE = '// border-ink-exempt: 头像要纯圆 until 2020-01-01'
  const tool = gate.scanFile('scripts/check-some-gate.mjs', LINE).entries
  const app = gate.scanFile('apps/web/src/x.ts', LINE).entries
  assert.equal(tool.length, 1)
  assert.equal(tool[0].toolFace, true)
  assert.equal(app[0].toolFace, false, 'apps/ 一侧不得被吞(吞了 = 本门对全部业务代码失明)')
  // 无日期账:工具面不进账,记账面照进 —— 观测侧与 HEAD 锚点侧共用 undatedCountsOf,对称
  assert.deepEqual(gate.undatedCountsOf(tool), {})
  assert.deepEqual(gate.undatedCountsOf(app), { 'apps/web/src/x.ts::border-ink-exempt': 1 })
  const base = { grandfatherUntil: '2099-01-01', undatedCounts: {} }
  const run = (entries) =>
    gate.analyze({ entries, suppressionsByFile: {}, baseline: base, today: TODAY, headCounts: {} })
  assert.equal(run(tool).red.length, 0, '工具面新增无日期豁免不得判红(否则新门无法登记)')
  assert.equal(run(app).red[0]?.code, 'E1', '记账面同一行文字必须照红(与上一格成对)')
  assert.equal(run(gate.scanFile('scripts/g.mjs', EXPIRED_LINE).entries).red.length, 0)
  assert.equal(run(gate.scanFile('apps/a.ts', EXPIRED_LINE).entries).red[0]?.code, 'E2')
  assert.equal(run(tool).totals.toolFace, 1, '工具面条数必须如实报出,不得静默并账')
  assert.equal(run(tool).totals.undated, 0)
})

test('T23 E4「新豁免族必须同笔登记」:判据只引一次真相源,族集合按面分两侧(§22c 不抄实现)', () => {
  // 登记与否的唯一真相 = FAMILY_LIFETIME_DAYS 的键集;构造面少填 `registered` 旗不得改变结论
  assert.equal(gate.isFamilyRegistered('border-ink-exempt'), true)
  assert.equal(gate.isFamilyRegistered('brand-new-gate-exempt'), false)
  const app = { family: 'brand-new-gate-exempt', file: 'apps/demo/a.ts', expiry: '2099-12-31' }
  const tool = { ...app, file: 'scripts/check-demo.mjs', toolFace: true }
  assert.deepEqual([...gate.unregisteredUsedFamiliesOf([app])], ['brand-new-gate-exempt'])
  assert.deepEqual([...gate.unregisteredUsedFamiliesOf([tool])], [], '工具面是说明书,不算在用')
  const base = { grandfatherUntil: '2099-01-01', undatedCounts: {} }
  const run = (headSet) =>
    gate.analyze({
      entries: [app],
      suppressionsByFile: {},
      baseline: base,
      today: TODAY,
      headCounts: {},
      headUnregisteredFamilies: headSet,
    })
  const armed = run(new Set())
  assert.equal(armed.red[0]?.code, 'E4', 'HEAD 没有这一族而记账面用了 ⇒ 必须点名 E4')
  assert.match(armed.red[0].msg, /FAMILY_LIFETIME_DAYS/)
  assert.deepEqual(run(new Set(['brand-new-gate-exempt'])).red, [], 'HEAD 已有的族是存量,只报数')
  assert.deepEqual(run(undefined).red, [], '面=head 时 E4 不响(否则存量变恒红门,§12e)')
  assert.deepEqual(
    run(new Set()).totals.unregisteredUsedFamilies,
    ['brand-new-gate-exempt'],
    '在用未登记族必须如实报出,不得静默',
  )
})

test('T24 E4 端到端有牙:临时索引新增未登记族必红、新增已登记族的第二处不红', () => {
  const dir = mkScratch('exemption-e4')
  const git = (a) =>
    execFileSync('git', ['-c', 'safe.directory=*', '-C', dir, ...a], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  try {
    git(['init', '-q'])
    git(['config', 'user.email', 't@test.invalid'])
    git(['config', 'user.name', 't'])
    mkdirSync(join(dir, 'scripts'), { recursive: true })
    mkdirSync(join(dir, 'apps'), { recursive: true })
    writeFileSync(
      join(dir, gate.BASELINE_REL),
      JSON.stringify({ grandfatherUntil: '2099-01-01', undatedCounts: {} }),
    )
    // HEAD 面:已登记族的豁免(border-ink-exempt,带未来到期日)⇒ E1/E2/E4 都该静默
    writeFileSync(join(dir, 'apps', 'first.ts'), 'x // border-ink-exempt: 夹具 until 2099-12-31\n')
    git(['add', '.'])
    git(['commit', '-q', '-m', 'fixture'])
    const runJSON = (args) => {
      const r = spawnSync(process.execPath, [SCRIPT, '--root', dir, '--json', ...args], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      return { status: r.status, out: JSON.parse(r.stdout || '{}') }
    }
    const clean = runJSON(['--staged'])
    assert.equal(clean.status, 0, `干净索引不得判红:${JSON.stringify(clean.out.red)}`)
    // ① 索引新增一处**已登记**族的豁免 ⇒ E4 不响(不得把"表里有"也判红)
    writeFileSync(join(dir, 'apps', 'second.ts'), 'y // border-ink-exempt: 第二处 until 2099-12-31\n')
    git(['add', 'apps/second.ts'])
    assert.deepEqual(runJSON(['--staged']).out.red, [], '已登记族的新使用不得触发 E4')
    // ② 索引新增一处**未登记**族的豁免 ⇒ E4 必须点名该族
    writeFileSync(join(dir, 'apps', 'third.ts'), 'z // brand-new-gate-exempt: 新族 until 2099-12-31\n')
    git(['add', 'apps/third.ts'])
    const hit = runJSON(['--staged'])
    assert.equal(hit.status, 1, '未登记的新族被真的用上必须判红')
    assert.ok(
      (hit.out.red || []).some((v) => v.code === 'E4' && /brand-new-gate-exempt/.test(v.msg)),
      `E4 必须点名族:${JSON.stringify(hit.out.red)}`,
    )
    // ③ 同一行文字只出现在 scripts/** ⇒ 不响(新立一道带豁免出口的门必须有合法出口)
    git(['rm', '-q', '--cached', 'apps/third.ts'])
    rmSync(join(dir, 'apps', 'third.ts'), { force: true })
    writeFileSync(join(dir, 'scripts', 'check-new-gate.mjs'), 'z // brand-new-gate-exempt: 描述自己的出口\n')
    git(['add', 'scripts/check-new-gate.mjs'])
    const toolOnly = runJSON(['--staged'])
    assert.deepEqual(
      toolOnly.out.red.filter((v) => v.code === 'E4'),
      [],
      `工具面不得被 E4 判红:${JSON.stringify(toolOnly.out.red)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('T22 基线里不得再有工具面键(存量债必须是真豁免,prose 不是)', () => {
  const b = gate.loadBaseline(REPO)
  const keys = Object.keys(b.undatedCounts || {})
  const tool = keys.filter((k) => gate.TOOL_FACE_RE.test(k.split('::')[0]))
  assert.deepEqual(
    tool,
    [],
    `基线含 ${tool.length} 个工具面键(跑 --update-baseline 下调):${tool.slice(0, 5).join(', ')}`,
  )
})

// T25 存档面(`.ihui-agent/archive/**`)与记账面**成对**。立因是本仓把 3 份 09-26 去重归档件入库
// (枚 f2b06a395)之后,门 108 的 E2 立刻在归档件里一条**早已撤销**的豁免上判红 —— 那批文件是
// AGENTS §1 要求的"被删原文逐字归档",把它算成当下生效的出口,等于让"把证据入库"这个正确动作变红,
// 而后果定是逼人绕开门。成对方向必须钉死:同一行文字在**活文件**里仍无条件判 E2,
// 否则"不红"就只是判据失效(本仓最高频那型假绿)。
test('T25 存档面只报数不入账,但活文件同一条过期豁免照旧判 E2(成对)', () => {
  const TXT = '// border-ink-exempt: 头像要纯圆 until 2020-01-01'
  const arch = gate.scanFile('.ihui-agent/archive/PROJECT_PLAN_dedup-2026-09-26.md', TXT)
  const live = gate.scanFile('apps/demo/src/a.ts', TXT)
  assert.equal(arch.entries.length, 1, '存档面也必须被扫到(不是不读,是不入账)')
  assert.equal(arch.entries[0].archiveFace, true)
  assert.equal(live.entries[0].archiveFace, false)
  // 形状锁:三处判定都必须显式带上存档面,漏一处就是"半接线"(E2 / 无日期账 / E4)
  for (const [name, re] of [
    ['E2 过期判定', /!e\.toolFace\s*&&\s*!e\.archiveFace\s*&&\s*isPast/],
    ['无日期入账', /if \(e\.expiry \|\| e\.toolFace \|\| e\.archiveFace\) continue/],
    ['E4 未登记族', /if \(e\.toolFace \|\| e\.archiveFace \|\| isFamilyRegistered/],
  ])
    assert.match(SRC, re, `判据缺"存档面"半边:${name}`)
  // 报数不得静默并入别的档
  assert.match(SRC, /archiveFace: entries\.filter\(\(e\) => e\.archiveFace\)\.length/, 'totals 缺存档面计数')
})

// T26/T27/T28:G-666 的 E5(新增 lint 抑制须同笔带到期豁免)。票面验收 = 棘轮四向 + 阳性对照;
// 镜像侧断**不变量**(观测/锚点同函数、独立键空间、锚点缺失退回只报数),存量数字一律不写死。
test('T26 scanFile 把抑制账劈成"有到期豁免/无到期豁免"两半,与总账同轮同面', () => {
  const undated = gate.scanFile(
    'g.ts',
    '/* eslint-disable no-console */\n// eslint-disable-next-line x/y\n// @ts-ignore\n',
  ).suppressionUndated
  assert.deepEqual(undated, { 'eslint-disable': 2, 'ts-ignore': 1 }, '无 until 的抑制进 E5 观测面')
  const dated = gate.scanFile('g.ts', '/* eslint-disable no-console */ // 等清理 until 2099-12-31')
  assert.deepEqual(
    dated.suppressionUndated,
    {},
    '同行带 until 的抑制算有到期豁免,不得进 E5 观测面(出口必须是真的)',
  )
  assert.equal(dated.suppressions['eslint-disable'], 1, '总账照旧计,不得因为劈账丢数')
  // 观测/锚点两侧走同一个函数(T21 的对称性同一条规矩)
  assert.deepEqual(
    gate.suppressionUndatedCountsOf({ 'g.ts': undated }),
    { 'g.ts::eslint-disable': 2, 'g.ts::ts-ignore': 1 },
  )
})

test('T27 E5 棘轮四向:新增红 / 锚点兜底绿 / 带 until 绿 / 锚点缺失退回只报数', () => {
  const s = gate.scanFile(
    'g.ts',
    '/* eslint-disable no-console */\n// eslint-disable-next-line x/y\n// @ts-ignore\n',
  )
  const supU = { 'g.ts': s.suppressionUndated }
  const base = { grandfatherUntil: '2099-01-01', undatedCounts: {} }
  const run = (headSup, supBase) =>
    gate.analyze({
      entries: [],
      suppressionsByFile: { 'g.ts': s.suppressions },
      suppressionUndatedByFile: supU,
      baseline: supBase ? { ...base, suppressionUndatedCounts: supBase } : base,
      today: TODAY,
      headSuppressionCounts: headSup,
    })
  // ① 新增超锚点 ⇒ 红,恰好只红多出的那一笔(锚点 1、观测 2;ts-ignore 1≤1 不得陪绑)
  const hit = run({ 'g.ts::eslint-disable': 1, 'g.ts::ts-ignore': 1 })
  assert.equal(hit.red.length, 1)
  assert.equal(hit.red[0].code, 'E5')
  assert.equal(hit.red[0].file, 'g.ts')
  assert.equal(hit.red[0].family, 'eslint-disable')
  assert.match(hit.red[0].msg, /until YYYY-MM-DD/)
  // ② 锚点取大兜住存量 ⇒ 不红(与 ① 同输入:绿必须来自锚点,不是判据失效)
  assert.deepEqual(run({ 'g.ts::eslint-disable': 2, 'g.ts::ts-ignore': 1 }).red, [])
  // ③ 基线额度兜底(取大含基线)⇒ 不红
  assert.deepEqual(run({}, { 'g.ts::eslint-disable': 5, 'g.ts::ts-ignore': 5 }).red, [])
  // ④ 锚点缺失 ⇒ 整维退回只报数 + S5 喊出(旧基线无该字段,拿 0 当锚点 = 恒红存量)
  const degraded = run(undefined)
  assert.deepEqual(degraded.red, [])
  assert.ok(degraded.soft.some((x) => x.code === 'S5'))
  // 阳性对照:从真扫产物判出的红,不是手拼计数表喂出来的
  const e2eSup = gate.scanFile('apps/x.ts', 'x // eslint-disable-next-line z\n')
  const armed = gate.analyze({
    entries: [],
    suppressionsByFile: { 'apps/x.ts': e2eSup.suppressions },
    suppressionUndatedByFile: { 'apps/x.ts': e2eSup.suppressionUndated },
    baseline: base,
    today: TODAY,
    headSuppressionCounts: {},
  })
  assert.equal(armed.red[0]?.code, 'E5')
  // resolveSuppressionAnchor 三情形(与 resolveAnchor 的 N01–N03 同型)
  assert.deepEqual(
    gate.resolveSuppressionAnchor({ face: 'head', undatedByFile: { 'g.ts': s.suppressionUndated } }),
    { 'g.ts::eslint-disable': 2, 'g.ts::ts-ignore': 1 },
    '面=head 自比 ⇒ 观测=锚点,结构上不响',
  )
  assert.equal(
    gate.resolveSuppressionAnchor({ face: 'index', undatedByFile: { 'g.ts': s.suppressionUndated }, headUndatedByFile: null }),
    null,
    'HEAD 取不到 ⇒ null(退回只报数,不得拿 0 当锚点)',
  )
  // mergeBaseline:第二类账并集 + 只下调,且不被族清除误清(kind 不是族名)
  const m = gate.mergeBaseline(
    { undatedCounts: { 'apps/x.ts::radius-exempt': 41 }, suppressionUndatedCounts: { 'g.ts::eslint-disable': 3 } },
    { undatedCounts: {}, suppressionUndatedCounts: { 'g.ts::eslint-disable': 2, 'i.ts::ts-ignore': 1 } },
  )
  assert.equal(m.next.suppressionUndatedCounts['g.ts::eslint-disable'], 2, '只下调')
  assert.equal(m.next.suppressionUndatedCounts['i.ts::ts-ignore'], 1, '并集')
  assert.equal(
    gate.mergeBaseline(
      { suppressionUndatedCounts: { 'g.ts::eslint-disable': 1 } },
      { suppressionUndatedCounts: { 'g.ts::eslint-disable': 99 } },
    ).next.suppressionUndatedCounts['g.ts::eslint-disable'],
    1,
    '绝不上调(与 undatedCounts 的 M02 同锁,独立键空间各锁各的)',
  )
})

test('T28 E5 端到端有牙:临时索引新增无 until 抑制必红、新增带 until 的不红', () => {
  const dir = mkScratch('exemption-e5')
  const git = (a) =>
    execFileSync('git', ['-c', 'safe.directory=*', '-C', dir, ...a], {
      encoding: 'utf8',
      timeout: 30000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  try {
    git(['init', '-q'])
    git(['config', 'user.email', 't@test.invalid'])
    git(['config', 'user.name', 't'])
    mkdirSync(join(dir, 'scripts'), { recursive: true })
    writeFileSync(
      join(dir, gate.BASELINE_REL),
      JSON.stringify({ grandfatherUntil: '2099-01-01', undatedCounts: {} }),
    )
    // HEAD 面:一条无到期豁免的抑制(存量,锚点的来源)。
    // 附一条带远期日期的**豁免标记**:collect 的反假绿闸要求候选里必须解析出 ≥1 条豁免,
    // 纯抑制夹具(不含 -exempt 字样)会被它判成"判据失效"exit 2 —— 那道闸是对的,E5 夹具绕它。
    writeFileSync(
      join(dir, 'a.ts'),
      'x // eslint-disable-next-line no-console\n// border-ink-exempt: 夹具 until 2099-12-31\n',
    )
    git(['add', '.'])
    git(['commit', '-q', '-m', 'fixture'])
    const runJSON = (args) => {
      const r = spawnSync(process.execPath, [SCRIPT, '--root', dir, '--json', ...args], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      return { status: r.status, out: JSON.parse(r.stdout || '{}') }
    }
    assert.deepEqual(runJSON(['--staged']).out.red, [], '干净索引不得判红')
    // ① 索引新增**带 until** 的抑制 ⇒ 有到期豁免,E5 不响
    writeFileSync(
      join(dir, 'a.ts'),
      'x // eslint-disable-next-line no-console\ny // eslint-disable no-console -- 等清理 until 2099-12-31\n' +
        '// border-ink-exempt: 夹具 until 2099-12-31\n',
    )
    git(['add', 'a.ts'])
    assert.deepEqual(
      runJSON(['--staged']).out.red,
      [],
      '带同行 until 的新增抑制是合法出口,不得判红',
    )
    // ② 索引新增**无 until** 的抑制 ⇒ E5 必须点名 kind@file(棘轮:锚点=HEAD 现测 1)
    writeFileSync(
      join(dir, 'a.ts'),
      'x // eslint-disable-next-line no-console\ny // eslint-disable no-console -- 先压住\n' +
        '// border-ink-exempt: 夹具 until 2099-12-31\n',
    )
    git(['add', 'a.ts'])
    const hit = runJSON(['--staged'])
    assert.equal(hit.status, 1, '新增无到期豁免的抑制必须判红')
    assert.ok(
      (hit.out.red || []).some((v) => v.code === 'E5' && v.file === 'a.ts' && v.family === 'eslint-disable'),
      `E5 必须点名 kind@file:${JSON.stringify(hit.out.red)}`,
    )
    // ③ --update-baseline 后同面复跑 ⇒ 绿(存量已并账,棘轮额度抬到现状)
    const upd = spawnSync(process.execPath, [SCRIPT, '--root', dir, '--update-baseline', '--staged'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.equal(upd.status, 0, upd.stderr)
    const bl = JSON.parse(readFileSync(join(dir, gate.BASELINE_REL), 'utf8'))
    assert.equal(bl.suppressionUndatedCounts['a.ts::eslint-disable'], 2, '第二类账必须进基线')
    assert.deepEqual(runJSON(['--staged']).out.red, [], '并账后同面复跑必须绿')
  } finally {
    rmScratch(dir)
  }
})

/**
 * T-FAM 已废除的圆角豁免族不得留在登记表里(2026-09-29 O81 票㊵)。
 * `FAMILY_LIFETIME_DAYS` 的语义是"合法出口的寿命清单":留一行没人能用的族名,等于替一条已废除的
 * 通道继续背书 —— 下一个读表的人会以为"挂这行标记有 90 天寿命",而判据那边早已没有任何放行支路。
 * 这是"清单腐烂"那一型的镜像:本仓 RN_ONLY_BRAND_KEYS / waivers 空表都记过同一条。
 * 反向的一半(写了就红)由门 77 的镜像 T-B8 钉 —— 两条合起来才是"通道死了"的完整证据。
 */
test('T-FAM 已废除的圆角豁免族不得留在登记表里', () => {
  const fams = Object.keys(gate.FAMILY_LIFETIME_DAYS)
  for (const dead of ['radius-exempt', 'radius-role-exempt'])
    assert.ok(
      !fams.includes(dead),
      `${dead} 仍在 FAMILY_LIFETIME_DAYS ⇒ 门 108 还在替一条已废除的出口发寿命`,
    )
  assert.equal(gate.isFamilyRegistered('radius-exempt'), false, 'isFamilyRegistered 必须与表同形')
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
