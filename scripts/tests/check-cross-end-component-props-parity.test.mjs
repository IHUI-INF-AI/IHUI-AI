// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

 
/**
 * 守门 288 镜像测试(§22c:判据只 import,不在此复刻一份;运行入口 node --test,与 scripts/tests 族一致)。
 * 覆盖:
 *  ① pairDelta 纯差集(含 INJECTABLE 豁免与必选性漂移形态)—— 生产判据 import lib;
 *  ② verifyAgainstBaseline 棘轮正反例(新键红/消键绿/新对带差红/undetermined warn/台账腐烂 warn);
 *  ③ 形状锁:guardian-runner 288 注册条目存在、blocking+skipEnv 成套、三件文件在场、stagedTriggers 覆盖族目录面。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
// Windows 下绝对路径必须走 file:// URL(d:\… 会被当成协议 'd:');§22d 同款坑
const { __test__: lib } = await import(pathToFileURL(join(ROOT, 'scripts/lib/component-props-parity.mjs')).href)
const { __test__: gate } = await import(pathToFileURL(join(ROOT, 'scripts/check-cross-end-component-props-parity.mjs')).href)
const { pairDelta, componentPropsOf, workspaceSrcPaths } = lib
const { verifyAgainstBaseline, buildBaselineEntry, validateEquivalence, validateJudged, applyJudged, updateGuard, resolveEvidence } = gate

const d = (name, extra = {}) => ({ name, state: 'ok', onlyRn: [], onlyMini: [], reqDrift: [], driftTotal: 0, ...extra })
const mk = (name, optional = false) => ({ name, optional })

describe('288 pairDelta(生产判据直用)', () => {
  it('共用键=无差;单侧独有键入 onlyRn/onlyMini;必选性不同入 reqDrift', () => {
    const rn = { state: 'ok', props: [mk('title'), mk('modal', true), mk('visible')] }
    const mini = { state: 'ok', props: [mk('title'), mk('modal'), mk('extra')] }
    const r = pairDelta('X', rn, mini)
    assert.equal(r.state, 'ok')
    assert.deepEqual(r.onlyRn, ['visible'])
    assert.deepEqual(r.onlyMini, ['extra'])
    assert.ok(r.reqDrift.join().includes('modal'))
    assert.equal(r.driftTotal, 3)
  })
  it('INJECTABLE(colorScheme 类平台注入腿)只在一端 ⇒ 不算差(与 screen-props 同一豁免集)', () => {
    const rn = { state: 'ok', props: [mk('title'), mk('colorScheme')] }
    const mini = { state: 'ok', props: [mk('title')] }
    assert.equal(pairDelta('X', rn, mini).driftTotal, 0)
  })
  it('任一侧 undetermined ⇒ 整对 undetermined,绝不产"没有差"', () => {
    const r = pairDelta('X', { state: 'undetermined', reason: '编译面取不到', props: [] }, { state: 'ok', props: [mk('a')] })
    assert.equal(r.state, 'undetermined')
    assert.equal(r.onlyRn, undefined)
  })
  it('zero-props 一侧对 ok 一侧 ⇒ 对端全部键=差(零 props 不是"无缺口")', () => {
    const r = pairDelta('X', { state: 'zero-props', reason: '', props: [] }, { state: 'ok', props: [mk('a'), mk('b')] })
    assert.equal(r.driftTotal, 2)
    assert.deepEqual(r.onlyMini, ['a', 'b'])
  })
})

describe('288 台账棘轮 verifyAgainstBaseline(生产判据直用)', () => {
  const base = {
    pairs: {
      Foo: { state: 'ok', onlyRn: ['onBar'], onlyMini: [], reqDrift: [] },
      ZZ: { state: 'ok', onlyRn: [], onlyMini: [], reqDrift: [] },
    },
  }
  it('在册键复刻=绿;新增键=红且逐键点名', () => {
    assert.equal(verifyAgainstBaseline([d('Foo', { onlyRn: ['onBar'], driftTotal: 1 })], base).bad.length, 0)
    const v = verifyAgainstBaseline([d('Foo', { onlyRn: ['onBar', 'onZonk'], driftTotal: 2 })], base)
    assert.equal(v.bad.length, 1)
    assert.equal(v.bad[0].pair, 'Foo')
    assert.ok(v.bad[0].detail.includes('onZonk'))
  })
  it('键集缩小=收敛:绿 + shrunk 提示(收紧台账的正当入口)', () => {
    const v = verifyAgainstBaseline([d('Foo')], base)
    assert.equal(v.bad.length, 0)
    assert.equal(v.shrunk.length, 1)
    assert.deepEqual(v.shrunk[0].goneRn, ['onBar'])
  })
  it('全新对带差未入账=红(不许静默入账);全新对无差=绿+建议落账 warn', () => {
    assert.equal(verifyAgainstBaseline([d('Brand', { onlyRn: ['a'], driftTotal: 1 })], base).bad.length, 1)
    const clean = verifyAgainstBaseline([d('CleanNew')], base)
    assert.equal(clean.bad.length, 0)
    assert.ok(clean.warn.some((w) => w.kind === 'unregistered-clean-pair'))
  })
  it('undetermined ⇒ warn 点名,永不记红也永不记绿(§0.3)', () => {
    const v = verifyAgainstBaseline([{ name: 'New', state: 'undetermined', reason: 'x' }], base)
    assert.equal(v.bad.length, 0)
    assert.ok(v.warn.some((w) => w.pair === 'New' && w.kind === 'undetermined'))
  })
  it('在册对本轮消失 ⇒ book-stale warn 不红(改名/拆族交人复核)', () => {
    const v = verifyAgainstBaseline([d('Foo', { onlyRn: ['onBar'], driftTotal: 1 })], base)
    assert.ok(v.warn.some((w) => w.kind === 'book-stale' && w.pair === 'ZZ'))
  })
  it('buildBaselineEntry:undetermined 与 ok 各按形态落账,reason 随行;人工裁决不被 --update-baseline 冲掉', () => {
    assert.equal(buildBaselineEntry({ name: 'U', state: 'undetermined', reason: '没读到' }).state, 'undetermined')
    assert.deepEqual(buildBaselineEntry(d('Foo', { onlyRn: ['a'], driftTotal: 1 })).onlyRn, ['a'])
    assert.equal(buildBaselineEntry({ name: 'U', state: 'undetermined', reason: '没读到' }, { state: 'not-applicable', owner: 'o' }).state, 'not-applicable')
  })
  it('undetermined + 台账 not-applicable(owner/expires/evidence/why 齐) ⇒ 转已裁决,未判定归零', () => {
    const ruling = {
      state: 'not-applicable',
      owner: 'cross-end-props-parity',
      expires: '2027-06-30',
      evidence: ['packages/app/src/components/ScreenStates.tsx:70'],
      why: 'ScreenStates 是两端文件基名配上的四组件族容器,文件内无同名组件出口,不能并成单组件 props 键集',
    }
    const v = verifyAgainstBaseline(
      [{ name: 'ScreenStates', state: 'undetermined', reason: '出口无默认/同名组件' }],
      { pairs: { ScreenStates: ruling } },
      { now: new Date('2026-11-03T00:00:00'), rootDir: ROOT },
    )
    assert.equal(v.bad.length, 0)
    assert.equal(v.warn.length, 0)
    assert.deepEqual(v.adjudicated.map((a) => a.pair), ['ScreenStates'])
  })
  it('not-applicable 缺 owner/expires/evidence ⇒ 裁决无效,该对仍按 undetermined 点名', () => {
    const v = verifyAgainstBaseline(
      [{ name: 'ScreenStates', state: 'undetermined', reason: '出口无默认/同名组件' }],
      { pairs: { ScreenStates: { state: 'not-applicable', why: '不是同名组件对' } } },
      { now: new Date('2026-11-03T00:00:00'), rootDir: ROOT },
    )
    assert.equal(v.adjudicated.length, 0)
    assert.ok(v.warn.some((w) => w.pair === 'ScreenStates' && w.kind === 'undetermined' && /owner|expires|evidence/.test(w.why)))
  })
  it('可测对(同名不同物整对)有效裁决 ⇒ 已裁决并剔除存量;证据不足/缺 owner ⇒ 判红', () => {
    const ruling = {
      state: 'not-applicable',
      owner: 'cross-end-props-parity',
      expires: '2027-06-30',
      evidence: ['packages/app/src/components/ScreenStates.tsx:70', 'apps/miniapp-taro/src/components/ScreenStates.taro.tsx:47'],
      why: '两端同名不同物:一侧整对是浮动入口组,另一侧是顶部 toast,不构成同一组件的 props 对账',
    }
    const opts = { now: new Date('2026-11-03T00:00:00'), rootDir: ROOT }
    const okv = verifyAgainstBaseline([d('FB', { onlyRn: ['a'], onlyMini: ['b'], driftTotal: 2 })], { pairs: { FB: ruling } }, opts)
    assert.equal(okv.bad.length, 0)
    assert.equal(okv.adjudicated[0].measurable, true)
    assert.equal(okv.adjudicated[0].driftKeys, 2)
    const fewEv = verifyAgainstBaseline(
      [d('FB', { onlyRn: ['a'], driftTotal: 1 })],
      { pairs: { FB: { ...ruling, evidence: [ruling.evidence[0]] } } },
      opts,
    )
    assert.equal(fewEv.bad.length, 1)
    assert.equal(fewEv.bad[0].kind, 'invalid-not-applicable-ruling')
    const noOwner = verifyAgainstBaseline([d('FB', { onlyMini: ['b'], driftTotal: 1 })], { pairs: { FB: { ...ruling, owner: '' } } }, opts)
    assert.equal(noOwner.bad.length, 1)
    assert.equal(noOwner.bad[0].kind, 'invalid-not-applicable-ruling')
  })
  it('映射表扩容无同轮收敛=红;同轮收敛=绿(防拿映射洗白真缺口)', () => {
    const booked = { pairs: base.pairs, counts: { equivalenceEntries: 0, driftKeysTotal: 2 } }
    const red = verifyAgainstBaseline([d('Foo', { onlyRn: ['onBar'], driftTotal: 2 })], booked, { equivalenceEntryCount: 1 })
    assert.equal(red.bad.length, 1)
    assert.equal(red.bad[0].kind, 'equivalence-growth-without-convergence')
    const green = verifyAgainstBaseline([d('Foo', { driftTotal: 0 })], booked, { equivalenceEntryCount: 2 })
    assert.equal(green.bad.length, 0)
  })
  it('映射条目失效 ⇒ warn 点名(不静默留白)', () => {
    const v = verifyAgainstBaseline([d('Foo', { mappedStale: [{ ours: 'a', theirs: 'b', why: 'declaration-missing' }] })], base)
    assert.equal(v.bad.length, 0)
    assert.ok(v.warn.some((w) => w.kind === 'equivalence-stale'))
  })
})

describe('288 语义等价映射(生产判据直用)', () => {
  const rn = { state: 'ok', props: [mk('title'), mk('label'), mk('onPress')] }
  const mini = { state: 'ok', props: [mk('title'), mk('labelKey'), mk('onTap')] }
  const eq = [
    { pair: 'X', ours: 'label', theirs: 'labelKey', kind: 'content', owner: 'o', rationale: 'r', evidence: { rn: 'a:1', mini: 'b:1' } },
    { pair: 'X', ours: 'onPress', theirs: 'onTap', kind: 'event', owner: 'o', rationale: 'r', evidence: { rn: 'a:2', mini: 'b:2' } },
  ]
  it('命中映射 ⇒ 归 mapped,不计漂移存量', () => {
    const r = pairDelta('X', rn, mini, eq)
    assert.equal(r.driftTotal, 0)
    assert.equal(r.mapped.length, 2)
    assert.equal(r.mappedKeyCount, 3)
    assert.deepEqual(r.onlyRn, [])
    assert.deepEqual(r.onlyMini, [])
  })
  it('未在表内的命名差异仍按漂移判定(不得静默)', () => {
    const r = pairDelta('X', rn, { state: 'ok', props: [mk('title'), mk('weird')] }, eq)
    assert.ok(r.onlyMini.includes('weird'))
    assert.ok(r.driftTotal > 0)
  })
  it('条目与声明对不上 ⇒ mappedStale 点名,原键仍计差', () => {
    const r = pairDelta('X', rn, mini, [{ ...eq[0], ours: 'nope' }])
    assert.equal(r.mapped.length, 0)
    assert.ok(r.mappedStale.some((s) => s.why === 'declaration-missing'))
    assert.deepEqual(r.onlyRn, ['label']) // onPress 属 INJECTABLE,本身不入差集
    assert.deepEqual(r.onlyMini, ['labelKey', 'onTap'])
  })
  it('体检:必填/kind/重复/证据行必须真实命中声明', () => {
    const good = {
      entries: [
        {
          pair: 'ScrollJumpButton',
          ours: 'label',
          theirs: 'labelKey',
          kind: 'content',
          owner: 'o',
          rationale: 'r',
          evidence: {
            rn: 'packages/app/src/components/ScrollJumpButton.tsx:51',
            mini: 'apps/miniapp-taro/src/components/ScrollJumpButton.tsx:64',
          },
        },
      ],
    }
    assert.equal(validateEquivalence(good).length, 0)
    assert.ok(validateEquivalence({ entries: [{ ...good.entries[0], kind: 'behavior' }] }).some((x) => x.includes('kind')))
    // 旧写法行号漂移(声明实际在 51 行 ⇒ 证据写 5):按符号名重定位通过,不再"加注释即红"
    assert.equal(
      validateEquivalence({
        entries: [{ ...good.entries[0], evidence: { rn: 'packages/app/src/components/ScrollJumpButton.tsx:5', mini: good.entries[0].evidence.mini } }],
      }).length,
      0,
    )
    // 符号真的不存在 ⇒ 仍判红(重定位不放行死符号)
    assert.ok(
      validateEquivalence({
        entries: [{ ...good.entries[0], ours: 'noSuchLabel', evidence: { rn: 'packages/app/src/components/ScrollJumpButton.tsx:5', mini: good.entries[0].evidence.mini } }],
      }).some((x) => x.includes('noSuchLabel')),
    )
    assert.ok(validateEquivalence({ entries: [good.entries[0], good.entries[0]] }).some((x) => x.includes('重复条目')))
  })
})

describe('288 证据定位:按符号名解析(五种漂移情形)', () => {
  const root = mkdtempSync(join(tmpdir(), 'gate288-evidence-'))
  const rel = 'apps/mobile-rn/src/components/Fixture.tsx'
  mkdirSync(join(root, 'apps/mobile-rn/src/components'), { recursive: true })
  const write = (lines) => writeFileSync(join(root, rel), lines.join('\n'))
  it('符号上移:旧行号落空,按声明形态重定位并通过', () => {
    write(['export interface P {', '  banner: ReadonlyArray<string>', '  height?: number', '}'])
    const r = resolveEvidence(root, `${rel}:4`, 'banner')
    assert.equal(r.ok, true)
    assert.equal(r.line, 2)
    assert.equal(r.moved, true)
  })
  it('符号下移:旧行号落空,重定位到新行', () => {
    write(['export interface P {', '  /** 说明 */', '  /** 说明 2 */', '  height?: number', '  banner: ReadonlyArray<string>', '}'])
    const r = resolveEvidence(root, `${rel}:2`, 'banner')
    assert.equal(r.ok, true)
    assert.equal(r.line, 5)
    assert.equal(r.moved, true)
  })
  it('中间插注释:注释行不干扰定位', () => {
    write(['export interface P {', '  // 与小程序端同名同义', '  /** 轮播数据 */', '  banner: ReadonlyArray<string>', '}'])
    const r = resolveEvidence(root, `${rel}:2`, 'banner')
    assert.equal(r.ok, true)
    assert.equal(r.line, 4)
  })
  it('注释插在声明内部:字段仍被识别', () => {
    write(['export interface P {', '  /** 新增说明 */', '  // 临时注释', '  banner: ReadonlyArray<string>', '  /* 尾注 */', '}'])
    const r = resolveEvidence(root, `${rel}:1`, 'banner')
    assert.equal(r.ok, true)
    assert.equal(r.line, 4)
  })
  it('符号真删(只在注释里出现)⇒ 红,不因重定位放行', () => {
    write(['export interface P {', '  // banner: 已移除', '  /* banner */', '  height?: number', '}'])
    assert.equal(resolveEvidence(root, `${rel}:2`, 'banner').ok, false)
    assert.equal(resolveEvidence(root, `${rel}#banner`, 'banner').ok, false)
  })
  it('新写法 文件#符号名 通过;文件不存在 ⇒ 红(不记绿)', () => {
    write(['export interface P {', '  banner: ReadonlyArray<string>', '}'])
    const okEntry = {
      pair: 'P',
      ours: 'banner',
      theirs: 'banner',
      kind: 'content',
      owner: 'o',
      rationale: 'r',
      evidence: { rn: `${rel}#banner`, mini: `${rel}#banner` },
    }
    assert.equal(validateEquivalence({ entries: [okEntry] }, root).length, 0)
    const missing = { ...okEntry, evidence: { rn: 'apps/mobile-rn/src/components/Nope.tsx:1', mini: `${rel}#banner` } }
    assert.ok(validateEquivalence({ entries: [missing] }, root).some((x) => x.includes('文件不存在')))
  })
})

describe('288 逐键 judged 桶(生产判据直用)', () => {
  const now = new Date('2026-11-03T00:00:00')
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'gate288-judged-'))
  const miniFixture = 'apps/miniapp-taro/src/components/NavBar.tsx'
  const rnFixture = 'apps/mobile-rn/src/components/NavBar.tsx'
  mkdirSync(join(fixtureRoot, 'apps/miniapp-taro/src/components'), { recursive: true })
  mkdirSync(join(fixtureRoot, 'apps/mobile-rn/src/components'), { recursive: true })
  writeFileSync(join(fixtureRoot, miniFixture), '// 声明侧样板\n  showSearch?: boolean\n')
  writeFileSync(join(fixtureRoot, rnFixture), '// 对端契约样板\nexport interface NavBarProps {\n  rightActions?: ReadonlyArray<string>\n}\n')
  const ruling = {
    pair: 'NavBar',
    key: 'showSearch',
    side: 'mini',
    owner: 'cross-end-props-parity',
    expires: '2028-06-30',
    rationale: '小程序端用预设布尔槽承载搜索入口,RN 端由 rightActions 数组表达,同能力不同承载机制',
    evidence: [`${miniFixture}:2`, `${rnFixture}:3`],
  }
  const opts = { now, rootDir: fixtureRoot }
  it('judged 计数:命中键移出存差,逐键留审(owner/expires/evidence/rationale)', () => {
    const r = applyJudged([d('NavBar', { onlyMini: ['showSearch'], driftTotal: 1 })], [ruling])
    assert.equal(r.bad.length, 0)
    assert.deepEqual(r.deltas[0].onlyMini, [])
    assert.equal(r.deltas[0].driftTotal, 0)
    assert.equal(r.applied.length, 1)
    assert.equal(validateJudged({ entries: [ruling] }, opts).ok, true)
  })
  it('坏裁决判红:证据不足/单端/落点不含键名/缺 owner/过期', () => {
    const cases = [
      [{ ...ruling, evidence: [ruling.evidence[0]] }, 'evidence 不足 2 条'],
      [{ ...ruling, evidence: [ruling.evidence[0], `${miniFixture}:2`] }, '未覆盖双端'],
      [{ ...ruling, evidence: [`${miniFixture}:1`, `${rnFixture}:3`] }, '真含键名'],
      [{ ...ruling, owner: '' }, '缺 owner'],
      [{ ...ruling, expires: '2026-01-01' }, '已到期'],
    ]
    for (const [entry, needle] of cases) {
      const v = validateJudged({ entries: [entry] }, opts)
      assert.equal(v.ok, false)
      assert.ok(v.bad.some((b) => b.includes(needle)), `未点名 ${needle}: ${v.bad.join(' | ')}`)
    }
  })
  it('一键两归/重复裁决/失效裁决(键不在漂移集)= 判红', () => {
    const eq = [{ pair: 'NavBar', ours: 'showSearch', theirs: 'rightActions', kind: 'content' }]
    const double = applyJudged([d('NavBar', { onlyMini: ['showSearch'], driftTotal: 1 })], [ruling], eq)
    assert.equal(double.bad[0].kind, 'judged-mapped-double-count')
    const stale = applyJudged([d('NavBar', { onlyMini: [], driftTotal: 0 })], [ruling])
    assert.equal(stale.bad[0].kind, 'judged-stale')
    const dup = validateJudged({ entries: [ruling, ruling] }, opts)
    assert.ok(dup.bad.some((b) => b.includes('重复裁决')))
  })
  it('--update-baseline 前置闸:坏裁决拒写,不得借重落账冲成 ok', () => {
    const bad = updateGuard({ judgedLedger: { entries: [{ ...ruling, expires: '2026-01-01' }] }, deltas: [d('NavBar', { onlyMini: ['showSearch'], driftTotal: 1 })], equivalenceEntries: [], rootDir: fixtureRoot })
    assert.equal(bad.ok, false)
    const good = updateGuard({ judgedLedger: { entries: [ruling] }, deltas: [d('NavBar', { onlyMini: ['showSearch'], driftTotal: 1 })], equivalenceEntries: [], rootDir: fixtureRoot })
    assert.equal(good.ok, true)
  })
})

describe('288 形状锁(注册条目与文件在场)', () => {
  // 本仓多会话并发注册/让号时会短时重写 runner——直接读会撞上"半写窗口"假失败。
  // 完整判据(四枚 needle 全在)满足即收卷;4 轮后仍不齐 = 真缺,照样红(不是放行走后门)。
  const NUM = '288'
  const NEEDLES = [
    'apps/miniapp-taro/src/components/',
    'packages/app/src/components/',
    'apps/mobile-rn/src/components/',
    'scripts/data/cross-end-props-parity-baseline.json',
    'scripts/data/component-props-equivalence.json',
  ]
  const loadRunnerWindow = () => {
    let best = null
    for (let i = 0; i < 4; i++) {
      try {
        const r = readFileSync(join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
        const idx = r.indexOf(`id: '${NUM}',`)
        if (idx >= 0) {
          const blk = r.slice(idx, idx + 2600)
          const hit = NEEDLES.filter((n) => blk.includes(n))
          if (hit.length === NEEDLES.length) return r
          if (!best || hit.length > best.hit.length) best = { text: r, hit }
        }
      } catch {
        /* 读窗竞态,等 250ms 重读 */
      }
      const t = Date.now()
      while (Date.now() - t < 250) {
        /* spin 等待(测试里避免引入 timer 依赖) */
      }
    }
    return best ? best.text : readFileSync(join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
  }
  const runner = loadRunnerWindow()
  it('288 已注册且 blocking + skipEnv 成套;同 id 不重复(R5/R13:重复注册=判红对象)', () => {
    const entries = [...runner.matchAll(/^\s{4}id: '288',$/gm)]
    assert.equal(entries.length, 1, 'runner 面出现多枚 id 288 ⇒ 撞号真缺,先解号再跑测试')
    // 窗口=从本条目 id 行到本对象收括号:固定字符窗会被并发插入挪动邻行而误切
    // 注:远端 af9c8a35 的编号权威把本门登记为 288(docs 公开面门占 288),本地旧号 288 已顺延。
    const start = runner.search(/^\s{4}id: '288',$/m)
    const endRel = runner.slice(start).search(/^\s{2},\n/m)
    const blk = runner.slice(start, start + (endRel > 0 ? endRel : 2600))
    assert.ok(blk.includes("mode: 'blocking'"))
    assert.ok(blk.includes('HUSKY_SKIP_CROSS_END_PROPS_PARITY'))
    assert.ok(blk.includes('check-cross-end-component-props-parity.mjs'))
  })
  it('门体/lib/台账三件真在仓', () => {
    for (const f of [
      'scripts/check-cross-end-component-props-parity.mjs',
      'scripts/lib/component-props-parity.mjs',
      'scripts/data/cross-end-props-parity-baseline.json',
    ])
      assert.ok(existsSync(join(ROOT, f)), `缺:${f}`)
  })
  it('stagedTriggers 覆盖两端组件目录 + 台账与判据面自身', () => {
    const start = runner.search(/^\s{4}id: '288',$/m)
    const endRel = runner.slice(start).search(/^\s{2},\n/m)
    const blk = runner.slice(start, start + (endRel > 0 ? endRel : 2600))
    for (const needle of [
      'apps/miniapp-taro/src/components/',
      'packages/app/src/components/',
      'apps/mobile-rn/src/components/',
      'scripts/data/cross-end-props-parity-baseline.json',
      'scripts/data/component-props-equivalence.json',
    ])
      assert.ok(blk.includes(needle), `stagedTriggers 缺:${needle}`)
  })
})

describe('288 审计返工接线锁(B 组真实现/死腿删除)', () => {
  const read = (p) => readFileSync(join(ROOT, p), 'utf8')
  it('LoginPopUp agreeChecked/onAgreeChange 两端声明,小程序宿主持有并回传', () => {
    const rn = read('apps/mobile-rn/src/components/LoginPopUp.tsx')
    const mini = read('apps/miniapp-taro/src/components/LoginPopUp.tsx')
    const page = read('apps/miniapp-taro/src/pages/user/index.tsx')
    assert.ok(rn.includes('agreeChecked?: boolean'), 'RN 缺 agreeChecked 声明')
    assert.ok(rn.includes('onAgreeChange?:'), 'RN 缺 onAgreeChange 声明')
    assert.ok(mini.includes('agreeChecked?: boolean'), '小程序缺 agreeChecked 声明')
    assert.ok(
      mini.includes('onAgreeChange?: (checked: boolean) => void'),
      '小程序缺 onAgreeChange 声明',
    )
    assert.ok(mini.includes('onAgreeChange(!agreeChecked)'), '小程序协议行未回传新勾选态')
    assert.ok(page.includes('agreeChecked={agreeChecked}'), '小程序宿主未持有 agreeChecked')
    assert.ok(page.includes('onAgreeChange={setAgreeChecked}'), '小程序宿主未回传 onAgreeChange')
  })
  it('UserInfoCard onOpenVip 两端声明且 RN 宿主真接线', () => {
    const rn = read('apps/mobile-rn/src/components/UserInfoCard.tsx')
    const mini = read('apps/miniapp-taro/src/components/UserInfoCard.tsx')
    const page = read('apps/mobile-rn/src/screens/ProfileScreen.tsx')
    assert.ok(rn.includes('onOpenVip?: () => void'), 'RN 缺 onOpenVip 声明')
    assert.ok(rn.includes('onPress={onOpenVip}'), 'RN 未消费 onOpenVip')
    assert.ok(mini.includes('onOpenVip?: () => void'), '小程序缺 onOpenVip 声明')
    assert.ok(
      page.includes("onOpenVip={() => rootNav?.navigate('VipTrader')}"),
      'RN 宿主未接线 onOpenVip',
    )
  })
  it('VoiceInput 图片死腿已从声明与渲染删除', () => {
    const rn = read('apps/mobile-rn/src/components/VoiceInput.tsx')
    assert.ok(!rn.includes('onImageSelected?:'), 'onImageSelected 死腿仍在')
    assert.ok(!rn.includes('showImagePicker?:'), 'showImagePicker 死腿仍在')
    assert.ok(!rn.includes('showImagePopup'), '图片弹出层 UI 仍在')
  })
  it('UserInfoCard level/levelTitle 死字段已从声明删除', () => {
    const mini = read('apps/miniapp-taro/src/components/UserInfoCard.tsx')
    assert.ok(!mini.includes('levelTitle?:'), 'levelTitle 死字段仍在')
    assert.ok(!mini.includes('level?: number'), 'level 死字段仍在')
    assert.ok(!mini.includes('displayLevel'), 'level 派生展示仍在')
  })
})

describe('288 审计返工接线锁(A 组真实现/死腿删除)', () => {
  const read = (p) => readFileSync(join(ROOT, p), 'utf8')
  it('BottomActionBar 手工压缩入口已在小程序真接线', () => {
    const mini = read('apps/miniapp-taro/src/components/BottomActionBar.tsx')
    const page = read('apps/miniapp-taro/src/pages/index/index.tsx')
    assert.ok(mini.includes('compactContextLoading?: boolean'), '小程序缺 compactContextLoading 声明')
    assert.ok(mini.includes('onCompactContext?: () => void'), '小程序缺 onCompactContext 声明')
    assert.ok(mini.includes('if (compactContextLoading) return'), '压缩按钮未消费 loading')
    assert.ok(page.includes('onCompactContext={() => void handleCompactContext()}'), '宿主未接线 onCompactContext')
    assert.ok(page.includes('compactContextLoading={compactingContext}'), '宿主未接线 compactContextLoading')
    assert.ok(page.includes('compactConversation(state.sessionId)'), '未调用共享 compactConversation')
  })
  it('ModelConfigDialog indexa/selecter 死变体与 onConfigChange 已从两端删除', () => {
    const rn = read('apps/mobile-rn/src/components/ModelConfigDialog.tsx')
    const mini = read('apps/miniapp-taro/src/components/ModelConfigDialog.tsx')
    for (const k of ['audioUrl', 'videoUrl', 'onUploadVideo', 'recordDuration']) {
      assert.ok(!rn.includes(`${k}?:`), `RN 仍声明 ${k} 死腿`)
      assert.ok(!mini.includes(`${k}?:`), `小程序仍声明 ${k} 死腿`)
    }
    assert.ok(!rn.includes('onConfigChange?:'), 'RN 仍保留零调用 onConfigChange')
    assert.ok(!rn.includes('AdvancedModelConfigDialog'), 'RN 高级变体死代码仍在')
    assert.ok(!rn.includes('ModelSelecterDialog'), 'RN 选择器死代码仍在')
    assert.ok(!mini.includes('isVip?:'), '小程序仍声明零调用 isVip')
  })
  it('InputArea 折叠/受控放大/语音受控死腿已删除', () => {
    const rn = read('apps/mobile-rn/src/components/InputArea.tsx')
    for (const k of ['collapsible?:', 'onCollapsedChange?:', 'expanded?:', 'onExpandToggle?:', 'voiceInput?:', 'voiceActive?:', 'onVoiceToggle?:'])
      assert.ok(!rn.includes(k), `RN 仍声明死腿 ${k}`)
  })
  it('ModelList onEndReached 死腿两端已删', () => {
    assert.ok(!read('apps/mobile-rn/src/components/ModelList.tsx').includes('onEndReached?:'), 'RN 仍声明 onEndReached')
    assert.ok(!read('apps/miniapp-taro/src/components/ModelList.tsx').includes('onEndReached?:'), '小程序仍声明 onEndReached')
  })
})
describe('288 workspaceSrcPaths:读数不得取决于"本机刚没刚构建过"(生产判据直用)', () => {
  const write = (dir, rel, text) => {
    const abs = join(dir, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text, 'utf8')
  }
  it('types 落 dist 且有 src/index.ts 的 @ihui/* 包被映到源码;types 本就在 src 的包、无 src 的包、packages/ 外的目录都不映', () => {
    const dir = mkScratch('props-src-paths')
    try {
      write(dir, 'packages/alpha/package.json', JSON.stringify({ name: '@ihui/alpha', types: './dist/index.d.ts' }))
      write(dir, 'packages/alpha/src/index.ts', 'export type A = 1\n')
      write(dir, 'packages/beta/package.json', JSON.stringify({ name: '@ihui/beta', types: './src/index.ts' }))
      write(dir, 'packages/beta/src/index.ts', 'export type B = 1\n')
      write(dir, 'packages/gamma/package.json', JSON.stringify({ name: '@ihui/gamma', types: './dist/index.d.ts' }))
      write(dir, 'elsewhere/delta/package.json', JSON.stringify({ name: '@ihui/delta', types: './dist/index.d.ts' }))
      write(dir, 'elsewhere/delta/src/index.ts', 'export type D = 1\n')
      const p = workspaceSrcPaths(dir)
      assert.deepEqual(p['@ihui/alpha'], ['packages/alpha/src/index.ts'], '阳性:@ihui/types 这一型必须被映到源码')
      assert.deepEqual(p['@ihui/alpha/*'], ['packages/alpha/src/*'])
      assert.equal(p['@ihui/beta'], undefined, '阴性一:types 已在 src 的包不重复映(免得造第二条取源)')
      assert.equal(p['@ihui/gamma'], undefined, '阴性二:没有 src/index.ts 就不映(不写悬空路径)')
      assert.equal(p['@ihui/delta'], undefined, '阴性三:射程只到 packages/,packages/ 外同名形态不扫')
    } finally {
      rmScratch(dir)
    }
  })
})

describe('288 componentPropsOf:基类型解析不出 ⇒ undetermined(绝不给偏小的键集)', () => {
  const mkProgram = (dir, files) => {
    for (const [rel, text] of Object.entries(files)) {
      const abs = join(dir, rel)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, text, 'utf8')
    }
    return ts.createProgram({
      rootNames: Object.keys(files).map((f) => join(dir, f)),
      options: { jsx: ts.JsxEmit.React, strict: false, noEmit: true, skipLibCheck: true },
    })
  }
  it('故障样本:props 接口 extends 一个解析不出的基类型 ⇒ state=undetermined 且点名那枚基名', () => {
    const dir = mkScratch('props-heritage-broken')
    try {
      const program = mkProgram(dir, {
        'Broken.tsx': [
          "import type { MissingBase } from './no-such-module'",
          'export interface BrokenProps extends MissingBase { title?: string }',
          'export function Broken(props: BrokenProps) {',
          '  return null',
          '}',
          '',
        ].join('\n'),
      })
      const r = componentPropsOf(dir, 'Broken.tsx', 'rn', program)
      assert.equal(r.state, 'undetermined', '解析不出必须点名未判定,不得读成"键集就是 title"')
      assert.match(r.reason, /MissingBase/, '未判定理由要带那枚失踪的基类型名')
      assert.deepEqual(r.props, [])
    } finally {
      rmScratch(dir)
    }
  })
  it('阳性对照:同形但基类型可解析 ⇒ ok,且继承来的键确实在键集里(护栏没有把正常读数一起吞掉)', () => {
    const dir = mkScratch('props-heritage-ok')
    try {
      const program = mkProgram(dir, {
        'base.ts': 'export interface GoodBase {\n  avatar?: string\n}\n',
        'Good.tsx': [
          "import type { GoodBase } from './base'",
          'export interface GoodProps extends GoodBase { title?: string }',
          'export function Good(props: GoodProps) {',
          '  return null',
          '}',
          '',
        ].join('\n'),
      })
      const r = componentPropsOf(dir, 'Good.tsx', 'rn', program)
      assert.equal(r.state, 'ok', `正常面不得被护栏误判:${r.reason ?? ''}`)
      assert.deepEqual(
        r.props.map((p) => p.name),
        ['avatar', 'title'],
      )
    } finally {
      rmScratch(dir)
    }
  })
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
