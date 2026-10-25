// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `auto-evolve.mjs` 的镜像测试(§22c 模式:判据 import 源脚本 `__test__`,本文件零复制判据)。
 *
 * 钉四环:
 *  ① 闸门形状锁(成对:合法过 / 各型坏配置抛)——调度器不可在坏配置下回落放行;
 *  ② 取票唯一入口形状:源脚本指向 plan-tasks.mjs 且三旗齐全,派单口径不搬家、不抄第二份;
 *  ③ 派发闸三件套:白名单 / 连败封票(成对:达限判出 / 未到期拦、到期放) / 模板填充;
 *  ④ 派单面解析:只取「判定面」之后的登记行,元信息行(剔除统计/惰判)不进候选。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __test__ as ae } from '../auto-evolve.mjs'

const GOOD_GATES = {
  enabled: false,
  dailyDispatchBudget: 6,
  failureStreakLimit: 3,
  quarantineHours: 48,
  maxSessionMinutes: 45,
  sessionCommandTemplate: '',
  ticketWhitelist: ['readme', '文档'],
}

function readGatesThrough(raw) {
  return ae.loadGates(() => (typeof raw === 'string' ? raw : JSON.stringify(raw)))
}

test('① 闸门形状锁:合法配置通过且字段原样', () => {
  const g = readGatesThrough(GOOD_GATES)
  assert.equal(g.enabled, false)
  assert.equal(g.dailyDispatchBudget, 6)
  assert.deepEqual(g.ticketWhitelist, ['readme', '文档'])
})

test('① 闸门形状锁:各型坏配置一律 GateShapeError 不回落', () => {
  const bad = [
    'not-json',
    '{}',
    JSON.stringify({ ...GOOD_GATES, dailyDispatchBudget: 0 }),
    JSON.stringify({ ...GOOD_GATES, failureStreakLimit: 1 }),
    JSON.stringify({ ...GOOD_GATES, ticketWhitelist: [] }),
    JSON.stringify({ ...GOOD_GATES, ticketWhitelist: ['x', ''] }),
    JSON.stringify({ ...GOOD_GATES, enabled: 'yes' }),
    JSON.stringify({ ...GOOD_GATES, sessionCommandTemplate: null }),
  ]
  for (const raw of bad) {
    assert.throws(() => ae.loadGates(() => raw), ae.GateShapeError, `应判形状坏: ${raw.slice(0, 60)}`)
  }
})

test('② 取票唯一入口:plan-tasks + --open --dispatchable --exclude-inflight', () => {
  assert.ok(ae.PLAN_TASKS.endsWith('plan-tasks.mjs'))
  assert.deepEqual([...ae.DISPATCH_ARGS].sort(), ['--dispatchable', '--exclude-inflight', '--open'].sort())
})

test('③a 白名单:命中/不命中/大小写不敏感', () => {
  assert.equal(ae.matchWhitelist('README 数字收尾对齐', ['readme']), true)
  assert.equal(ae.matchWhitelist('补齐 i18n 五语言键', ['i18n']), true)
  assert.equal(ae.matchWhitelist('重构数据库连接池', ['readme', '文档', 'i18n']), false)
})

test('③b 连败封票:计数只看连续失败,派发成功打断', () => {
  const ledger = [
    { ticketKey: 'k', action: 'session-failed' },
    { ticketKey: 'k', action: 'session-failed' },
    { ticketKey: 'k', action: 'session-ok' },
    { ticketKey: 'k', action: 'session-failed' },
  ]
  assert.equal(ae.failureStreakOf(ledger, 'k'), 1)
  assert.equal(ae.failureStreakOf([...ledger, { ticketKey: 'k', action: 'session-timeout' }], 'k'), 2)
  assert.equal(ae.failureStreakOf(ledger, '不存在'), 0)
})

test('③c 封票成对:未到期拦 / 已到期放 / 无封票放', () => {
  const future = new Date(Date.now() + 3600_000).toISOString()
  const past = new Date(Date.now() - 1000).toISOString()
  const led = [{ ticketKey: 'k', action: 'quarantined', until: future }]
  assert.ok(ae.quarantinedUntilOf(led, 'k') !== null)
  assert.equal(ae.quarantinedUntilOf([{ ticketKey: 'k', action: 'quarantined', until: past }], 'k'), null)
  assert.equal(ae.quarantinedUntilOf([], 'k'), null)
})

test('③d 模板填充:三占位替换,未知占位原样保留', () => {
  const out = ae.fillTemplate('x --prompt {promptFile} --key {ticketKey} --unknown {nope}', {
    promptFile: 'p.md',
    ticketKey: 'kk',
  })
  assert.equal(out, 'x --prompt p.md --key kk --unknown {nope}')
})

test('④ 派单面解析:只取判定面 L 行,元信息不进候选', () => {
  const sample = [
    '── 派单口径中"现在可做" 14 / 99 行(剔除:…)',
    '  --exclude-inflight:暂移 7 行 ⇒ 出单 7 行 —— L7616 / L7644',
    '── 7 行(判定面:HEAD blob)──',
    '  L7626  - [ ] 补号(取号器当场回 pool-exhausted:G 拒发)',
    '  L7643  - [ ] `--allow-dangerous` 确认旁路仍在调用方(`commands/agent.ts`)。',
    '',
  ].join('\n')
  const rows = ae.parseTicketRows(sample)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].line, 7626)
  assert.ok(rows[1].text.includes('--allow-dangerous'))
})

test('④ 派单面解析:空输出/无 L 行 ⇒ 空候选(不抛)', () => {
  assert.deepEqual(ae.parseTicketRows(''), [])
  assert.deepEqual(ae.parseTicketRows('── 无票可派 ──'), [])
})

test('⑤ 票键:登记前缀与注记剥除后等值(跨会话同票识别)', () => {
  const a = ae.ticketKeyOf('- [ ]（进行中@2026-10-25/autoevolve） 修 README 数字 〔进展@…〕')
  const b = ae.ticketKeyOf('修 README 数字')
  assert.equal(a, b)
  assert.notEqual(a, ae.ticketKeyOf('修 README 表格'))
})

test('⑥ pid 判活:自身活 / 非法与不存在者死', () => {
  assert.equal(ae.isPidAlive(process.pid), true)
  assert.equal(ae.isPidAlive(0), false)
  assert.equal(ae.isPidAlive(-1), false)
  assert.equal(ae.isPidAlive(999999999), false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
