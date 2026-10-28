// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 『停着是设计内』豁免的行为锁(2026-10-28)。
 *
 * 这一族判据最容易出的错是**方向错**:豁免范围一不小心放大,表就成了新的消红通道
 * (§"skipped 不能成为消红通道" 记过同型)。所以每条正例都配一条"看起来像但不该被豁免"的反例:
 *   · 停着 + 只有 STATE/端口无应答 ⇒ 豁免;
 *   · 停着 + 还有 Application 路径烂掉 ⇒ **不**豁免(其余问题必须照旧红);
 *   · 跑着但端口不应答 ⇒ **不**豁免(那是真故障,不是"设计内停止");
 *   · STATE 量不到 ⇒ **不**豁免("没判"不等于"停着")。
 * 动作器一侧另有两条:门裁定 expected-stopped 时**不动作**,且该台即使不在 services 台账里
 * 也必须在报告里出现(否则"被判成设计内"与"压根没看见"同形)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { applyExpectedStopped, loadExpectedStopped } from '../check-service-binary-paths.mjs'
import { decideRound, parseConfig, verdictOf } from '../heal-unresponsive-services.mjs'

const LEDGER = 'expected-stopped-services.json'
const BG = 'api-bluegreen.json'

/** 夹具:一个"量到问题"的服务条目(形状与门 meta.services 的元素一致)。 */
function row(name, { stateValue = 'STOPPED', problems = ['STATE=STOPPED'], extra = {} } = {}) {
  return {
    name,
    level: problems.length ? 'issue' : 'ok',
    problems: [...problems],
    rec: { state: stateValue === null ? { kind: 'unmeasured', reason: '量不到' } : { kind: 'measured', value: stateValue } },
    ...extra,
  }
}

function names(txt) {
  return new Map([[String(txt).toLowerCase(), { source: 'static', reason: '测试', reviewBy: '2027-01-01' }]])
}

test('豁免:停着且唯一的坏就是"停着"⇒ 降为 skipped 并带上出处', () => {
  const rows = [
    row('IHUI-API'),
    row('IHUI-API-BLUE', { problems: ['STATE=STOPPED', '监听无应答(tcp):127.0.0.1:8842 —— 声明端口无应答'] }),
  ]
  const exp = { names: new Map([...names('IHUI-API'), ...names('IHUI-API-BLUE')]), notes: [] }
  const r = applyExpectedStopped(rows, exp)
  assert.equal(r.applied.length, 2)
  assert.equal(r.kept.length, 0)
  assert.equal(rows[0].level, 'skipped')
  assert.equal(rows[0].expectedStopped.source, 'static')
  assert.equal(rows[1].level, 'skipped')
})

test('反例:停着但还有别的坏(Application 路径不是可用文件)⇒ 不豁免,仍红', () => {
  const rows = [row('IHUI-API', { problems: ['STATE=STOPPED', 'Application 路径不是可用文件(missing):F:/x.exe'] })]
  const r = applyExpectedStopped(rows, { names: names('IHUI-API'), notes: [] })
  assert.equal(r.applied.length, 0)
  assert.equal(r.kept.length, 1)
  assert.equal(rows[0].level, 'issue')
  assert.match(r.kept[0].why, /Application 路径不是可用文件/)
})

test('反例:跑着却端口无应答 ⇒ 不豁免(那是真故障,不是"设计内停止")', () => {
  const rows = [row('IHUI-API-GREEN', { stateValue: 'RUNNING', problems: ['监听无应答(tcp):127.0.0.1:8843 —— 声明端口无应答'] })]
  const r = applyExpectedStopped(rows, { names: names('IHUI-API-GREEN'), notes: [] })
  assert.equal(r.applied.length, 0)
  assert.equal(rows[0].level, 'issue')
})

test('反例:STATE 量不到 ⇒ 不豁免("没判"不等于"停着")', () => {
  const rows = [row('IHUI-API', { stateValue: null, problems: ['STATE=未判定'] })]
  const r = applyExpectedStopped(rows, { names: names('IHUI-API'), notes: [] })
  assert.equal(r.applied.length, 0)
  assert.match(r.kept[0].why, /STATE 这一维量不到/)
})

test('反例:未登记的服务一台都不动', () => {
  const rows = [row('OTHER-SVC')]
  const r = applyExpectedStopped(rows, { names: names('IHUI-API'), notes: [] })
  assert.equal(r.applied.length, 0)
  assert.equal(r.kept.length, 0)
  assert.equal(rows[0].level, 'issue')
})

test('台账读不到 ⇒ 空清单 + 说明(不豁免任何人,方向朝"更响"倒)', () => {
  const r = loadExpectedStopped({ exists: () => false })
  assert.equal(r.names.size, 0)
  assert.equal(r.notes.length, 1)
  assert.match(r.notes[0], /台账不在位/)
})

test('台账 reviewBy 已过期 ⇒ 该条失效并点名', () => {
  const r = loadExpectedStopped({
    exists: () => true,
    nowMs: Date.parse('2027-06-01T00:00:00Z'),
    readText: (p) =>
      p.endsWith(LEDGER)
        ? JSON.stringify({ static: [{ name: 'IHUI-API', reason: 'x', reviewBy: '2027-01-01' }], blueGreen: null })
        : '{}',
  })
  assert.equal(r.names.size, 0)
  assert.match(r.notes.join('\n'), /reviewBy 缺失或已过期/)
})

test('蓝绿:active=green ⇒ 只豁免 BLUE,活跃色 GREEN 绝不进豁免集', () => {
  const r = loadExpectedStopped({
    exists: () => true,
    nowMs: Date.parse('2026-10-28T00:00:00Z'),
    readText: (p) => {
      if (p.endsWith(LEDGER))
        return JSON.stringify({
          static: [],
          blueGreen: {
            stateFile: 'X:/run/' + BG,
            defaultActive: 'blue',
            colors: { blue: { service: 'IHUI-API-BLUE', port: 8842 }, green: { service: 'IHUI-API-GREEN', port: 8843 } },
          },
        })
      if (p.endsWith(BG)) return JSON.stringify({ active: 'green' })
      throw new Error('ENOENT:' + p)
    },
  })
  assert.equal(r.names.has('ihui-api-blue'), true)
  assert.equal(r.names.has('ihui-api-green'), false)
  assert.equal(r.activeColor, 'green')
})

test('蓝绿:状态文件不在位 ⇒ 退默认色 + 点名(不静默挑一个)', () => {
  const r = loadExpectedStopped({
    exists: (p) => String(p).endsWith(LEDGER), // 状态文件"不存在"
    nowMs: Date.parse('2026-10-28T00:00:00Z'),
    readText: () =>
      JSON.stringify({
        static: [],
        blueGreen: {
          stateFile: 'X:/run/' + BG,
          defaultActive: 'blue',
          colors: { blue: { service: 'IHUI-API-BLUE' }, green: { service: 'IHUI-API-GREEN' } },
        },
      }),
  })
  assert.equal(r.activeColor, 'blue')
  assert.equal(r.names.has('ihui-api-green'), true)
  assert.match(r.notes.join('\n'), /蓝绿状态文件不在位/)
})

test('动作器:门裁定 expected-stopped ⇒ 不动作(verdict 档位先于 STATE 判定)', () => {
  const gate = { rec: { state: { kind: 'measured', value: 'STOPPED' } }, expectedStopped: { source: 'blue-green', reason: '冷备' } }
  const v = verdictOf('IHUI-API-BLUE', gate)
  assert.equal(v.verdict, 'expected-stopped')
})

test('动作器:expected-stopped 的台即使不在 services 台账里也要在报告里出现', () => {
  const config = parseConfig(
    JSON.stringify({
      limits: { consecutiveRounds: 2, cooldownMinutes: 60, maxRestartsPerWindow: 2, windowMinutes: 60 },
      services: [{ name: 'A', reason: 'r', owner: 'o', reviewBy: '2027-01-01' }],
    }),
  )
  const { actions } = decideRound({
    config,
    state: { services: {}, restarts: [] },
    verdicts: { 'RETIRED-SVC': { verdict: 'expected-stopped', why: '门已裁定' }, A: { verdict: 'answering', why: 'ok' } },
    nowMs: Date.parse('2026-10-28T00:00:00Z'),
    apply: true,
  })
  const hit = actions.find((a) => a.name === 'RETIRED-SVC')
  assert.ok(hit, '不在册的 expected-stopped 必须报名,不能静默')
  assert.equal(hit.kind, 'expected-stopped')
  assert.match(hit.why, /台账未登记该服务/)
})

test('动作器:expected-stopped 绝不产生 restart(即使连跑多轮)', () => {
  const config = parseConfig(
    JSON.stringify({
      limits: { consecutiveRounds: 1, cooldownMinutes: 0, maxRestartsPerWindow: 9, windowMinutes: 60 },
      services: [{ name: 'IHUI-API-BLUE', reason: 'r', owner: 'o', reviewBy: '2027-01-01' }],
    }),
  )
  const { actions, next } = decideRound({
    config,
    state: { services: { 'IHUI-API-BLUE': { strikes: 5, lastRestartMs: null } }, restarts: [] },
    verdicts: { 'IHUI-API-BLUE': { verdict: 'expected-stopped', why: '冷备' } },
    nowMs: Date.parse('2026-10-28T00:00:00Z'),
    apply: true,
  })
  assert.equal(actions.some((a) => a.kind === 'restart'), false)
  assert.equal(next.restarts.length, 0)
  // strikes 也不清零:它不是"恢复",下一轮仍按原计数看待
  assert.equal(next.services['IHUI-API-BLUE'].strikes, 5)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
