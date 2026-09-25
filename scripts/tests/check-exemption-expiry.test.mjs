// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:直接 import 源脚本的 __test__,禁止在测试里复制一份实现。
//
// 断的是**不变量**,不是存量数字 —— 本仓反复记录"清单/计数写死 ⇒ 清单腐烂 ⇒ 恒红 ⇒ 全队
// --no-verify ⇒ 全部守门作废"。因此这里没有任何一条形如"radius-exempt 必须有 149 处"的断言;
// 涉及仓内实际形态的断言一律从基线文件/源码**推导**出来再自比。
//
// 夹具在 mkScratch 临时目录构造并显式 --root 传入,绝不扫真仓(守门 70 教训:测试靠 cwd
// 定位夹具而脚本忽略 cwd,14 例全在扫真仓)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
  family: 'radius-exempt',
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
  const base = { grandfatherUntil: '2099-01-01', undatedCounts: { 'a.ts::radius-exempt': 2 } }
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
    baseline: { grandfatherUntil: '2099-01-01', undatedCounts: { 'a.ts::radius-exempt': 1 } },
    today: TODAY,
  })
  assert.equal(r.red.length, 1)
  assert.equal(r.red[0].code, 'E2')
  assert.equal(r.red[0].file, 'a.ts')
})

test('T06 E3 基线自身过期即整门红;账销完即绿;字段缺失按"过期"处理', () => {
  const stock = { grandfatherUntil: '2020-01-01', undatedCounts: { 'a.ts::radius-exempt': 3 } }
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

test('T07 lint 抑制面只报数不判红(规格 §7 的"不得独立成第二道同类门")', () => {
  const s = gate.scanFile(
    'g.ts',
    '/* eslint-disable no-console */\n// eslint-disable-next-line x/y\n// @ts-ignore\n',
  )
  assert.equal(s.suppressions['eslint-disable'], 2)
  assert.equal(s.suppressions['ts-ignore'], 1)
  const r = gate.analyze({
    entries: [],
    suppressionsByFile: { 'g.ts': s.suppressions },
    baseline: { grandfatherUntil: '2099-01-01', undatedCounts: {} },
    today: TODAY,
  })
  assert.equal(r.red.length, 0)
  assert.equal(r.totals.suppressTotals['eslint-disable'], 2)
})

// ---------------------------------------------------------------- 语法覆盖面

test('T08 两种挂靠方式与各族拼写都能被同一判据看见(否则同时产假红与假绿)', () => {
  const cases = [
    ['x = 1 // radius-exempt: 正圆', 'radius-exempt', 'inline'],
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

test('T18 本门不得自称已接入提交链(接线是主会话的活,虚假声称会骗过门 89)', () => {
  assert.doesNotMatch(SRC, /已接入 pre-commit|已注册 guardian|guardian 第 \d+ 项/)
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
    const EXPIRED = 'export const v = 1 // radius-exempt: 夹具日期已过去 until 2020-01-01\n'
    // 同名文件走自豁免 ⇒ 不红;换个路径的同一条豁免必须照红
    writeFileSync(join(dir, 'scripts', 'check-exemption-expiry.mjs'), EXPIRED)
    writeFileSync(join(dir, 'apps', 'other.ts'), EXPIRED)
    git(['add', '.'])
    git(['commit', '-q', '-m', 'fixture'])
    const r = spawnSync(process.execPath, [SCRIPT, '--root', dir, '--json'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
