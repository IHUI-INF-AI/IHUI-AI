// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 接线锁:金丝雀绝对 P95 维不得由单枚离群样本判死(B37 立案,2026-11-06 实测)。
// 判据单源:该模块本就具名导出 loadPolicy/decideCanary/percentile95,直接 import;
// 夹具的阈值与端点表**逐字节继承真策略文件**(不另造一套数,否则测的是我编的阈值,不是线上的)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { decideCanary, loadPolicy, percentile95 } from '../canary-verdict.mjs'

const REAL = JSON.parse(readFileSync(new URL('../data/canary-policy.json', import.meta.url), 'utf8'))
const MAX = REAL.thresholds.maxP95Ms // 现读真阈值,不写死
// origin 腿有 3 条(web/api/llm)。只喂一条 ⇒ 另两条"候选无样本⇒整体 unknown",
// 测的就不是本档而是采样器(2026-11-06 实测踩过,故写成显式断言而不是注释)。
const ORIGIN_IDS = REAL.endpoints.filter((e) => e.kind === 'origin').map((e) => e.id)
assert.ok(ORIGIN_IDS.length >= 1, '真策略里没有 origin 腿 ⇒ 本文件前提失效,请改测试而不是放宽断言')

const policy = (extraThresholds = {}, extraWindow = {}) => ({
  ...REAL,
  window: { ...REAL.window, ...extraWindow },
  thresholds: { ...REAL.thresholds, ...extraThresholds },
})
/** 一"拍" = 每条 origin 腿各一条 pass 样本(与真观察窗同形)。 */
const tick = (ms) =>
  ORIGIN_IDS.map((id) => ({
    endpoint: id,
    kind: 'origin',
    verdict: 'pass',
    ms,
    status: 200,
    stage: 'candidate',
    ts: '',
  }))
/** 一"拍"全腿硬失败。 */
const failTick = (ms, status = 500) =>
  ORIGIN_IDS.map((id) => ({
    endpoint: id,
    kind: 'origin',
    verdict: 'fail',
    ms,
    status,
    stage: 'candidate',
    ts: '',
  }))
const candOf = (perTickMs) => perTickMs.flatMap(tick)
const failCandOf = (perTickMs) => perTickMs.flatMap((m) => failTick(m))

test('算式事实先钉住:n≤20 时最近秩 P95 == 最大值(所以单枚离群与整体变慢在 p95Ms 这一个数上不可区分)', () => {
  const vals = [2581, 3676, 2654, 3183, 2558, 2655, 2977] // B37 现读那串去掉 unknown 后的形态
  assert.equal(percentile95(vals), Math.max(...vals), '分位数实现与立案依据不符,下面几条的前提要重核')
})

test('现场复现:一枚离群(> 真阈值)其余快 ⇒ 不再判死,且必须出声', () => {
  const c = candOf([MAX + 1477, 10, 12, 11, 13, 12, 11, 10])
  const r = decideCanary({ policy: policy(), candidate: c })
  assert.equal(r.verdict, 'pass', `实得 ${r.verdict}:${JSON.stringify(r.reasons ?? r).slice(0, 320)}`)
  assert.equal(r.exitCode, 0, '不判死却给非 0 退出码 ⇒ 调用方仍会回滚')
  const blob = JSON.stringify(r)
  assert.match(blob, /单枚离群未判死/, '没出声 = 静默放行(§0.3 不许把"没判"写成"判过")')
  assert.match(blob, /超阈样本仅 1 枚/, '出声但没给样本数 = 读数不可核')
})

test('真劣化不被吞:两枚超阈 ⇒ 仍 fail 且 exit 3', () => {
  const r = decideCanary({ policy: policy(), candidate: candOf([MAX + 100, MAX + 900, 10, 11, 12, 13, 12, 11]) })
  assert.equal(r.verdict, 'fail', JSON.stringify(r.reasons ?? r).slice(0, 320))
  assert.equal(r.exitCode, 3, 'fail 但退出码不是 3 ⇒ 调用方不会回滚,判据成摆设')
})

test('变异自证:把下限摘回 1 ⇒ 同一句立刻翻 fail(证明是本字段在起作用,不是别的档顺手接住)', () => {
  const ms = [MAX + 1477, 10, 12, 11, 13, 12, 11, 10]
  assert.equal(decideCanary({ policy: policy(), candidate: candOf(ms) }).verdict, 'pass')
  assert.equal(
    decideCanary({ policy: policy({ minAbsP95OverSamples: 1 }), candidate: candOf(ms) }).verdict,
    'fail',
    '摘掉下限仍不 fail ⇒ 上面那条是假锁',
  )
})

test('不削弱别的维:错误率维与相对维一字未动(成对反例)', () => {
  const rErr = decideCanary({ policy: policy(), candidate: failCandOf([10, 10, 10, 10]).concat(candOf([10, 10, 10, 10])) })
  assert.equal(rErr.verdict, 'fail', '错误率维被 B 档误伤')
  const base = candOf(new Array(REAL.thresholds.minSamples + 3).fill(10))
  const cand = candOf(new Array(REAL.thresholds.minSamples + 3).fill(MAX + 2000))
  const rRel = decideCanary({ policy: policy(), baseline: base, candidate: cand })
  assert.equal(rRel.verdict, 'fail', '相对维被 B 档误伤')
})

test('形状锁:下限写成非整数/小于 1/大于 ticks ⇒ 抛形状错(不许把档位改成永远不会判死)', () => {
  // 先证明夹具本身过得了 loadPolicy —— 否则下面几条会被"version 形状坏"顶成假绿(实测踩过)
  const good = loadPolicy(JSON.stringify(policy({ minAbsP95OverSamples: 2 })))
  assert.equal(good.thresholds.minAbsP95OverSamples, 2, '夹具没过真校验器,后面的 throws 全是假绿')
  for (const bad of [1.5, 0, -1]) {
    assert.throws(
      () => loadPolicy(JSON.stringify(policy({ minAbsP95OverSamples: bad }))),
      /minAbsP95OverSamples/,
      `漏放 ${bad}(或错误被别的形状检查抢先,报错要点名本项)`,
    )
  }
  assert.throws(
    () => loadPolicy(JSON.stringify(policy({ minAbsP95OverSamples: 99 }))),
    /不得大于 window\.ticks/,
    '下限大于采样数 = 该维永远不会判死,必须拒',
  )
})

test('形状锁:不写这一项时缺省仍是 2,且 loadPolicy 不凭空造字段', () => {
  const doc = loadPolicy(JSON.stringify(REAL))
  assert.equal(doc.thresholds.minAbsP95OverSamples, undefined, 'loadPolicy 不该凭空造这一项')
  const r = decideCanary({ policy: doc, candidate: candOf([MAX + 1477, 10, 12, 11, 13, 12, 11, 10]) })
  assert.equal(r.verdict, 'pass', '缺省没落到 2 ⇒ 真策略文件在裸奔')
})

test('覆盖面自证:每条 origin 腿各判一次单枚离群(不是只看第一条)', () => {
  const c = candOf([MAX + 1477, 10, 12, 11, 13, 12, 11, 10])
  const r = decideCanary({ policy: policy(), candidate: c })
  const voiced = (JSON.stringify(r.details ?? r).match(/单枚离群未判死/g) || []).length
  assert.equal(
    voiced,
    ORIGIN_IDS.length,
    `只有 ${voiced}/${ORIGIN_IDS.length} 条 origin 腿出了声 ⇒ B 档射程没覆盖全部腿`,
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
