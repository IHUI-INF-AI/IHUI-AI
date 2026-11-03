// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

 
/**
 * 守门 285 镜像测试(§22c:判据只 import,不在此复刻一份;运行入口 node --test,与 scripts/tests 族一致)。
 * 覆盖:
 *  ① pairDelta 纯差集(含 INJECTABLE 豁免与必选性漂移形态)—— 生产判据 import lib;
 *  ② verifyAgainstBaseline 棘轮正反例(新键红/消键绿/新对带差红/undetermined warn/台账腐烂 warn);
 *  ③ 形状锁:guardian-runner 285 注册条目存在、blocking+skipEnv 成套、三件文件在场、stagedTriggers 覆盖族目录面。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
// Windows 下绝对路径必须走 file:// URL(d:\… 会被当成协议 'd:');§22d 同款坑
const { __test__: lib } = await import(pathToFileURL(join(ROOT, 'scripts/lib/component-props-parity.mjs')).href)
const { __test__: gate } = await import(pathToFileURL(join(ROOT, 'scripts/check-cross-end-component-props-parity.mjs')).href)
const { pairDelta } = lib
const { verifyAgainstBaseline, buildBaselineEntry } = gate

const d = (name, extra = {}) => ({ name, state: 'ok', onlyRn: [], onlyMini: [], reqDrift: [], driftTotal: 0, ...extra })
const mk = (name, optional = false) => ({ name, optional })

describe('285 pairDelta(生产判据直用)', () => {
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

describe('285 台账棘轮 verifyAgainstBaseline(生产判据直用)', () => {
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
  it('buildBaselineEntry:undetermined 与 ok 各按形态落账,reason 随行', () => {
    assert.equal(buildBaselineEntry({ name: 'U', state: 'undetermined', reason: '没读到' }).state, 'undetermined')
    assert.deepEqual(buildBaselineEntry(d('Foo', { onlyRn: ['a'], driftTotal: 1 })).onlyRn, ['a'])
  })
})

describe('285 形状锁(注册条目与文件在场)', () => {
  // 本仓多会话并发注册/让号时会短时重写 runner——直接读会撞上"半写窗口"假失败。
  // 完整判据(四枚 needle 全在)满足即收卷;4 轮后仍不齐 = 真缺,照样红(不是放行走后门)。
  const NUM = '285'
  const NEEDLES = [
    'apps/miniapp-taro/src/components/',
    'packages/app/src/components/',
    'apps/mobile-rn/src/components/',
    'scripts/data/cross-end-props-parity-baseline.json',
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
  it('285 已注册且 blocking + skipEnv 成套;同 id 不重复(R5/R13:重复注册=判红对象)', () => {
    const entries = [...runner.matchAll(/^\s{4}id: '285',$/gm)]
    assert.equal(entries.length, 1, 'runner 面出现多枚 id 285 ⇒ 撞号真缺,先解号再跑测试')
    // 窗口=从本条目 id 行到本对象收括号:固定字符窗会被并发插入挪动邻行而误切
    const start = runner.search(/^\s{4}id: '285',$/m)
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
    const start = runner.search(/^\s{4}id: '285',$/m)
    const endRel = runner.slice(start).search(/^\s{2},\n/m)
    const blk = runner.slice(start, start + (endRel > 0 ? endRel : 2600))
    for (const needle of [
      'apps/miniapp-taro/src/components/',
      'packages/app/src/components/',
      'apps/mobile-rn/src/components/',
      'scripts/data/cross-end-props-parity-baseline.json',
    ])
      assert.ok(blk.includes(needle), `stagedTriggers 缺:${needle}`)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
