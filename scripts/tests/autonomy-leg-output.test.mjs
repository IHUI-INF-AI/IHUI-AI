// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:scripts/lib/autonomy-leg-output.mjs(/goal R3 全腿产出对账判据)。
 *
 * 判据全部 import 生产实现(§22c),不复制算法。钉三件事:
 *   ① 账本解析口径(撕裂行/中间坏行/时间字段/近窗自报);
 *   ② 三分类判定(always 必产 / conditional 条件产 / none 不参与)与三态聚合;
 *   ③ **恒红门反向锁**:条件产腿合法静默必须 ok,派发戳只作旁证不参与三态。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  OUTPUT_KINDS,
  TIME_FIELDS,
  isUndeterminedRow,
  timeOfRow,
  parseLegLedger,
  classifyLegOutputs,
} from '../lib/autonomy-leg-output.mjs'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const REG = JSON.parse(readFileSync(join(ROOT, 'scripts', 'data', 'autonomy-leg-liveness.json'), 'utf8'))
const NOW = Date.parse('2026-11-04T15:00:00.000Z')
const row = (ts, extra = {}) => JSON.stringify({ ts, ...extra })
const leg = (o = {}) => ({
  stamp: 'x-dispatch-last.json',
  outputKind: 'conditional',
  outputRel: 'x.jsonl',
  outputTimeField: 'ts',
  silenceCeilingMs: 24 * 3600_000,
  selfReportToken: '',
  ...o,
})

test('T01 账本解析:取最新时间戳 / 总行数 / 零坏行', () => {
  const text = [row('2026-11-01T00:00:00.000Z'), row('2026-11-03T00:00:00.000Z'), row('2026-11-02T00:00:00.000Z')].join('\n') + '\n'
  const r = parseLegLedger(text, 'ts')
  assert.equal(r.total, 3)
  assert.equal(r.bad, 0)
  assert.equal(r.torn, 0)
  assert.equal(new Date(r.latestMs).toISOString(), '2026-11-03T00:00:00.000Z', '必须取最大值,不是末行')
})

test('T02 并发撕裂:仅「末段半条 + 无尾换行 + 解析失败」算 torn,不算坏行', () => {
  const r = parseLegLedger(row('2026-11-01T00:00:00.000Z') + '\n{"ts":"2026-11-04T00:00:00', 'ts')
  assert.equal(r.torn, 1)
  assert.equal(r.bad, 0)
  assert.equal(r.total, 1)
})

test('T03 中间坏行必须如实计 bad(不许靠删输入抹绿)', () => {
  const r = parseLegLedger([row('2026-11-01T00:00:00.000Z'), 'BROKEN', row('2026-11-03T00:00:00.000Z')].join('\n') + '\n', 'ts')
  assert.equal(r.bad, 1)
  assert.equal(r.torn, 0)
})

test('T04 末段合法行(无尾换行)不是撕裂', () => {
  const r = parseLegLedger(row('2026-11-01T00:00:00.000Z') + '\n' + row('2026-11-03T00:00:00.000Z'), 'ts')
  assert.equal(r.torn, 0)
  assert.equal(r.total, 2)
})

test('T05 自报未判定识别:五个字段 + 中英形态;普通失败不算', () => {
  for (const k of ['result', 'overall', 'status', 'action', 'state']) {
    assert.equal(isUndeterminedRow({ [k]: 'undetermined' }), true, `字段 ${k} 没认出`)
  }
  assert.equal(isUndeterminedRow({ result: '未判定' }), true)
  assert.equal(isUndeterminedRow({ action: 'runner-undetermined' }), true)
  assert.equal(isUndeterminedRow({ result: 'skip', action: 'session-failed' }), false, '普通失败不得被当成"我量不动"')
  assert.equal(isUndeterminedRow(null), false)
})

test('T06 时间字段口径 ts / at / epoch', () => {
  assert.equal(timeOfRow({ at: '2026-11-04T00:00:00.000Z' }, 'at'), Date.parse('2026-11-04T00:00:00.000Z'))
  assert.equal(timeOfRow({ ts: 'nope' }, 'ts'), null)
  assert.equal(timeOfRow(1762214400000, 'epoch'), 1762214400000)
  assert.equal(timeOfRow('1762214400000', 'epoch'), 1762214400000)
})

test('T07 近窗自报:陈年旧账不得让尺子永久 unjudged', () => {
  const text = [
    row('2026-10-01T00:00:00.000Z', { result: 'undetermined' }),
    row('2026-11-04T00:00:00.000Z', { result: 'undetermined' }),
  ].join('\n') + '\n'
  assert.equal(parseLegLedger(text, 'ts', Date.parse('2026-11-03T00:00:00.000Z')).undetermined, 1)
  assert.equal(parseLegLedger(text, 'ts', 0).undetermined, 2)
})

test('T08 always 腿静默超窗 ⇒ drift 且点名该腿', () => {
  const r = classifyLegOutputs({
    legs: [leg({ outputKind: 'always', silenceCeilingMs: 6 * 3600_000 })],
    ledgers: { 'x.jsonl': row('2026-11-01T00:00:00.000Z') + '\n' },
    stamps: { 'x-dispatch-last.json': { attemptAtMs: NOW - 60_000 } },
    now: NOW,
  })
  assert.equal(r.state, 'drift')
  assert.equal(r.rows[0].id, 'x-dispatch-last.json')
  assert.match(r.rows[0].why, /每轮必写却静默/)
  assert.match(r.rows[0].why, /派发戳 1min 前/, '戳只作旁证但须在读数里')
})

test('T09 always 腿窗内有产出 ⇒ ok', () => {
  const r = classifyLegOutputs({
    legs: [leg({ outputKind: 'always' })],
    ledgers: { 'x.jsonl': row('2026-11-04T14:00:00.000Z') + '\n' },
    now: NOW,
  })
  assert.equal(r.state, 'ok')
})

test('T10 always 腿账一次都没产过 ⇒ drift(不是 unjudged)', () => {
  const r = classifyLegOutputs({ legs: [leg({ outputKind: 'always' })], ledgers: { 'x.jsonl': '' }, now: NOW })
  assert.equal(r.state, 'drift')
})

test('T11 恒红门反向锁:conditional 静默超窗 + 无自报 ⇒ ok', () => {
  const r = classifyLegOutputs({
    legs: [leg()],
    ledgers: { 'x.jsonl': row('2026-10-01T00:00:00.000Z') + '\n' },
    stamps: { 'x-dispatch-last.json': { attemptAtMs: NOW - 60_000 } },
    now: NOW,
  })
  assert.equal(r.state, 'ok', '条件产腿合法静默被判红 ⇒ 尺子会被整片放宽,比没有尺子更坏')
  assert.match(r.rows[0].why, /合法静默/)
})

test('T12 dep-radar 真况回放:静默 + 日志自报未判定 ⇒ unjudged 点名输入面断链', () => {
  const id = 'dep-radar-dispatch-last.json'
  const r = classifyLegOutputs({
    legs: [leg({ stamp: id, outputRel: 'dep-advisory-ledger.jsonl', silenceCeilingMs: 48 * 3600_000 })],
    ledgers: { 'dep-advisory-ledger.jsonl': row('2026-10-30T01:04:21.776Z') + '\n' },
    selfReports: { [id]: true },
    now: NOW,
  })
  assert.equal(r.state, 'unjudged')
  assert.match(r.rows[0].why, /采集输入面断链/)
})

test('T13 conditional 账内近窗自报未判定同样顶起 unjudged(不依赖日志)', () => {
  const r = classifyLegOutputs({
    legs: [leg()],
    ledgers: { 'x.jsonl': row('2026-11-04T14:00:00.000Z', { result: 'undetermined' }) + '\n' },
    now: NOW,
  })
  assert.equal(r.state, 'unjudged')
})

test('T14 conditional 账空无基线 ⇒ unjudged,不冒充合法静默', () => {
  const r = classifyLegOutputs({ legs: [leg()], ledgers: { 'x.jsonl': '' }, now: NOW })
  assert.equal(r.state, 'unjudged')
  assert.match(r.rows[0].why, /无基线/)
})

test('T15 none / coveredBy ⇒ n/a 且不参与三态', () => {
  const r = classifyLegOutputs({
    legs: [leg({ stamp: 'a.json', outputKind: 'none', outputRel: null }), leg({ stamp: 'b.json', coveredBy: 'A11-closure-output' })],
    ledgers: {},
    now: NOW,
  })
  assert.equal(r.state, 'ok')
  assert.deepEqual(r.rows.map((x) => x.state), ['n/a', 'n/a'])
  assert.match(r.summary, /n\/a 2/)
})

test('T16 登记表产出字段腐烂 ⇒ unjudged(不冒充判过)', () => {
  for (const bad of [
    leg({ outputKind: 'sometimes' }),
    leg({ outputRel: '' }),
    leg({ outputTimeField: 'when' }),
    leg({ silenceCeilingMs: 0 }),
  ]) {
    const r = classifyLegOutputs({ legs: [bad], ledgers: { 'x.jsonl': row('2026-11-04T14:00:00.000Z') + '\n' }, now: NOW })
    assert.equal(r.state, 'unjudged', `字段坏没顶起:${JSON.stringify(bad)}`)
  }
})

test('T17 产出账读不到(null)/缺席(undefined) ⇒ unjudged', () => {
  for (const ledgers of [{ 'x.jsonl': null }, {}]) {
    const r = classifyLegOutputs({ legs: [leg()], ledgers, now: NOW })
    assert.equal(r.state, 'unjudged')
  }
})

test('T18 产出账形状坏行 ⇒ unjudged 且读数带撕裂数', () => {
  const text = row('2026-11-04T14:00:00.000Z') + '\nBROKEN\n{"ts":"2026-11-04T14:30:00'
  const r = classifyLegOutputs({ legs: [leg()], ledgers: { 'x.jsonl': text }, now: NOW })
  assert.equal(r.state, 'unjudged')
  assert.match(r.rows[0].why, /1 行形状坏/)
  assert.match(r.rows[0].why, /1 行并发撕裂/)
})

test('T19 派发戳只作旁证:戳新/戳无/戳陈旧都不改三态', () => {
  const cfg = { legs: [leg({ outputKind: 'always', silenceCeilingMs: 6 * 3600_000 })], ledgers: { 'x.jsonl': row('2026-11-01T00:00:00.000Z') + '\n' }, now: NOW }
  const fresh = classifyLegOutputs({ ...cfg, stamps: { 'x-dispatch-last.json': { attemptAtMs: NOW - 1000 } } })
  const none = classifyLegOutputs(cfg)
  const stale = classifyLegOutputs({ ...cfg, stamps: { 'x-dispatch-last.json': { attemptAtMs: NOW - 10 * 24 * 3600_000 } } })
  assert.deepEqual([fresh.state, none.state, stale.state], ['drift', 'drift', 'drift'])
})

test('T20 聚合:drift 优先于 unjudged,summary 四类齐全', () => {
  const r = classifyLegOutputs({
    legs: [
      leg({ stamp: 'a.json', outputKind: 'always', outputRel: 'a.jsonl', silenceCeilingMs: 6 * 3600_000 }),
      leg({ stamp: 'b.json', outputRel: 'b.jsonl' }),
      leg({ stamp: 'c.json', outputKind: 'none', outputRel: null }),
    ],
    ledgers: { 'a.jsonl': row('2026-10-01T00:00:00.000Z') + '\n', 'b.jsonl': null },
    now: NOW,
  })
  assert.equal(r.state, 'drift')
  assert.match(r.summary, /3 腿 = ok 0 \/ n\/a 1 \/ drift 1 \/ unjudged 1/)
})

test('T21 登记表结构锁:12 腿字段齐备,产腿路径真实,dep-radar 笔误已修', () => {
  assert.equal(REG.legs.length, 12)
  assert.equal(new Set(REG.legs.map((l) => l.stamp)).size, 12)
  for (const l of REG.legs) {
    assert.ok(OUTPUT_KINDS.includes(l.outputKind), `${l.stamp} 的 outputKind 不在闭集`)
    assert.ok(TIME_FIELDS.includes(l.outputTimeField), `${l.stamp} 的时间字段不在闭集`)
    assert.ok(Number.isInteger(l.silenceCeilingMs) && l.silenceCeilingMs > 0, `${l.stamp} 天花板非法`)
    if (l.outputKind !== 'none' && !l.coveredBy) {
      assert.ok(typeof l.outputRel === 'string' && l.outputRel.endsWith('.jsonl'), `${l.stamp} 缺产出台账路径`)
      assert.ok(existsSync(join(ROOT, '.ihui-agent', 'state', l.outputRel)), `${l.stamp} 指向的台账不在盘上:${l.outputRel}`)
    }
  }
  const dep = REG.legs.find((l) => l.stamp === 'dep-radar-dispatch-last.json')
  assert.equal(dep.ruler, 'scripts/dep-advisory-radar.mjs', 'ruler 笔误没修')
  assert.ok(existsSync(join(ROOT, dep.ruler)))
  assert.equal(dep.selfReportToken, '依赖安全通告轮:未判定')
  assert.equal(REG.legs.find((l) => l.stamp === 'deploy-outcome-intake-dispatch-last.json').coveredBy, 'A11-closure-output')
})

test('T22 全 12 腿夹具:分类计数与真登记表一致,不许漏腿', () => {
  const r = classifyLegOutputs({ legs: REG.legs, ledgers: {}, now: NOW })
  assert.equal(r.rows.length, 12)
  assert.equal(r.rows.filter((x) => x.state === 'n/a').length, 8, '7 条 none + 1 条 coveredBy')
  assert.equal(r.rows.filter((x) => x.state === 'unjudged').length, 4, '4 条产腿都取不到账 ⇒ 全 unjudged,不许冒充绿')
})

test('T23 成对反向锁:自报未判定行不算有效产出,普通行才算', () => {
  const t = '2026-11-04T14:00:00.000Z'
  const only = row(t, { result: 'undetermined' }) + '\n'
  const plain = row(t) + '\n'
  assert.equal(parseLegLedger(only, 'ts', NOW - 24 * 3600_000).latestMs, null, '诊断行不得刷新 lastMs,否则尺子结构性恒绿')
  assert.equal(parseLegLedger(plain, 'ts', NOW - 24 * 3600_000).latestMs, Date.parse(t))
  const a = classifyLegOutputs({ legs: [leg()], ledgers: { 'x.jsonl': only }, now: NOW })
  const b = classifyLegOutputs({ legs: [leg()], ledgers: { 'x.jsonl': plain }, now: NOW })
  assert.equal(a.state, 'unjudged')
  assert.equal(b.state, 'ok')
})

test('T24 旧结论 + 近窗自报未判定 ⇒ unjudged(不许被旧结论顶成绿)', () => {
  const text = row('2026-10-01T00:00:00.000Z') + '\n' + row('2026-11-04T14:00:00.000Z', { overall: 'undetermined' }) + '\n'
  const r = classifyLegOutputs({ legs: [leg()], ledgers: { 'x.jsonl': text }, now: NOW })
  assert.equal(r.state, 'unjudged')
  assert.match(r.rows[0].why, /采集输入面断链/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
