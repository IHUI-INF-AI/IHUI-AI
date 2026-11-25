// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SYNC_STATE,
  buildBatchedRules,
  buildRules,
  diffRules,
  edgeRuleNameFor,
  ipsOfRule,
  isOurRule,
  judgeSync,
  mergeRules,
  selectEdgeTargets,
} from '../security/lib/edge-blocklist.mjs'

const NOW = Date.parse('2026-11-25T03:00:00Z')
const entry = (ip, over = {}) => ({ ip, bannedAt: '2026-11-24T08:00:00Z', expiresAt: '2026-12-01T08:00:00Z', ...over })

test('规则名把点号换成连字符,便于控制台回显', () => {
  assert.equal(edgeRuleNameFor('43.175.168.192'), 'ihui-edge-ban-43-175-168-192')
})

test('规则名对 IPv6 的冒号同样替换', () => {
  assert.equal(edgeRuleNameFor('2001:db8::1'), 'ihui-edge-ban-2001-db8--1')
})

test('只认本前缀的规则,他人手工规则一律不认领', () => {
  assert.equal(isOurRule({ RuleName: 'ihui-edge-ban-1-2-3-4' }), true)
  assert.equal(isOurRule({ RuleName: '手工封禁名单' }), false)
  assert.equal(isOurRule({}), false)
})

test('在册且已过取证年龄的条目被选中,并按 IP 排序', () => {
  const { targets, skipped } = selectEdgeTargets(
    { '9.9.9.9': entry('9.9.9.9'), '1.1.1.1': entry('1.1.1.1') },
    { now: NOW },
  )
  assert.deepEqual(targets.map((t) => t.ip), ['1.1.1.1', '9.9.9.9'])
  assert.equal(skipped.allowlisted + skipped.infra + skipped.expired + skipped.tooFresh + skipped.noExpiry, 0)
})

test('白名单 IP 绝不推到边缘', () => {
  const { targets, skipped } = selectEdgeTargets({ '1.1.1.1': entry('1.1.1.1') }, { now: NOW, allowlist: ['1.1.1.1'] })
  assert.equal(targets.length, 0)
  assert.equal(skipped.allowlisted, 1)
})

test('本机基础设施地址绝不推到边缘(封了等于全站下线)', () => {
  const { targets, skipped } = selectEdgeTargets({ '192.168.1.37': entry('192.168.1.37') }, { now: NOW, infra: new Set(['192.168.1.37']) })
  assert.equal(targets.length, 0)
  assert.equal(skipped.infra, 1)
})

test('已过期条目不推', () => {
  const { targets, skipped } = selectEdgeTargets({ '1.1.1.1': entry('1.1.1.1', { expiresAt: '2026-11-24T09:00:00Z' }) }, { now: NOW })
  assert.equal(targets.length, 0)
  assert.equal(skipped.expired, 1)
})

test('刚封下不到一个 tick 的条目不推 —— 首犯必须留在源站取证', () => {
  const { targets, skipped } = selectEdgeTargets({ '1.1.1.1': entry('1.1.1.1', { bannedAt: '2026-11-25T02:55:00Z' }) }, { now: NOW, minAgeMs: 10 * 60 * 1000 })
  assert.equal(targets.length, 0)
  assert.equal(skipped.tooFresh, 1)
})

test('没有到期时间的条目不推(推上去就没人会撤)', () => {
  const { targets, skipped } = selectEdgeTargets({ '1.1.1.1': entry('1.1.1.1', { expiresAt: null }) }, { now: NOW })
  assert.equal(targets.length, 0)
  assert.equal(skipped.noExpiry, 1)
})

test('buildRules 生成 EO 文档要求的形状', () => {
  const rules = buildRules([{ ip: '1.2.3.4', ruleName: 'ihui-edge-ban-1-2-3-4' }])
  assert.deepEqual(rules, [{ Action: 'drop', MatchFrom: 'ip', Operator: 'match', MatchContent: '1.2.3.4', RuleName: 'ihui-edge-ban-1-2-3-4', Status: 'on' }])
})

test('合并时他人规则原样保留,本前缀旧规则被整批替换', () => {
  const existing = [
    { RuleName: '手工-地域', MatchFrom: 'area', MatchContent: 'CN', Action: 'monitor' },
    { RuleName: 'ihui-edge-ban-1-2-3-4', MatchContent: '1.2.3.4', Action: 'drop' },
  ]
  const merged = mergeRules(existing, buildRules([{ ip: '5.6.7.8', ruleName: 'ihui-edge-ban-5-6-7-8' }]))
  assert.equal(merged.foreign.length, 1)
  assert.equal(merged.foreign[0].RuleName, '手工-地域')
  assert.equal(merged.oursOld.length, 1)
  assert.deepEqual(merged.rules.map((r) => r.MatchContent), ['CN', '5.6.7.8'])
})

test('差集按 MatchContent 算,added/removed 排序返回', () => {
  const d = diffRules(
    [{ MatchContent: '9.9.9.9' }, { MatchContent: '1.1.1.1' }],
    [{ MatchContent: '1.1.1.1' }, { MatchContent: '7.7.7.7' }, { MatchContent: '3.3.3.3' }],
  )
  assert.deepEqual(d.added, ['3.3.3.3', '7.7.7.7'])
  assert.deepEqual(d.removed, ['9.9.9.9'])
  assert.equal(d.unchanged, 1)
})

test('复核三条齐全时判 ok', () => {
  const v = judgeSync({
    targets: [{ ip: '1.1.1.1' }],
    existingForeign: [{ RuleName: '手工', MatchContent: 'CN' }],
    actualRules: [{ RuleName: '手工', MatchContent: 'CN' }, { RuleName: 'ihui-edge-ban-1-1-1-1', MatchContent: '1.1.1.1' }],
    wafModeBefore: 'observe',
    wafModeAfter: 'observe',
  })
  assert.equal(v.state, SYNC_STATE.OK)
  assert.equal(v.missing.length, 0)
  assert.equal(v.foreignLost.length, 0)
  assert.equal(v.modeChanged, false)
  assert.equal(v.modeUnjudged, false)
})

test('期望的 IP 没写进去 ⇒ drift 并逐条点名', () => {
  const v = judgeSync({ targets: [{ ip: '1.1.1.1' }, { ip: '2.2.2.2' }], actualRules: [{ MatchContent: '1.1.1.1' }] })
  assert.equal(v.state, SYNC_STATE.DRIFT)
  assert.deepEqual(v.missing, ['2.2.2.2'])
})

test('他人的规则丢了 ⇒ drift(哪怕我们的全写进去了)', () => {
  const v = judgeSync({
    targets: [{ ip: '1.1.1.1' }],
    existingForeign: [{ RuleName: '手工', MatchContent: 'CN' }],
    actualRules: [{ MatchContent: '1.1.1.1' }],
  })
  assert.equal(v.state, SYNC_STATE.DRIFT)
  assert.equal(v.foreignLost.length, 1)
})

test('WAF 模式被顺带改掉 ⇒ drift(写 IP 表不该动别的东西)', () => {
  const v = judgeSync({ targets: [], actualRules: [], wafModeBefore: 'observe', wafModeAfter: 'block' })
  assert.equal(v.state, SYNC_STATE.DRIFT)
  assert.equal(v.modeChanged, true)
})

test('读不出 WAF 模式时只标「未判定」,不冒红也不记绿', () => {
  const v = judgeSync({ targets: [], actualRules: [], wafModeBefore: undefined, wafModeAfter: undefined })
  assert.equal(v.modeUnjudged, true)
  assert.equal(v.modeChanged, false)
  assert.equal(v.state, SYNC_STATE.OK)
})

test('41 个 IP 按每规则 20 个压成 3 条,MatchContent 用英文逗号', () => {
  const targets = Array.from({ length: 41 }, (_, i) => ({ ip: `10.0.0.${i + 1}` }))
  const rules = buildBatchedRules(targets, 20)
  assert.equal(rules.length, 3)
  assert.equal(rules[0].MatchContent.split(',').length, 20)
  assert.equal(rules[2].MatchContent.split(',').length, 1)
  assert.ok(rules.every((r) => r.RuleName.startsWith('ihui-edge-ban-') && r.Action === 'drop' && r.MatchFrom === 'ip' && r.Status === 'on'))
})

test('分批结果确定:同样名单每轮生成同样规则名(否则每轮全量改写)', () => {
  const a = buildBatchedRules([{ ip: '9.9.9.9' }, { ip: '1.1.1.1' }], 5)
  const b = buildBatchedRules([{ ip: '1.1.1.1' }, { ip: '9.9.9.9' }], 5)
  assert.deepEqual(a, b)
})

test('ipsOfRule 拆逗号多值', () => {
  assert.deepEqual(ipsOfRule({ MatchContent: '1.1.1.1, 2.2.2.2 ,3.3.3.3' }), ['1.1.1.1', '2.2.2.2', '3.3.3.3'])
})

test('只调分批大小不算改 IP(条数变了 IP 没变)', () => {
  const targets = [{ ip: '1.1.1.1' }, { ip: '2.2.2.2' }, { ip: '3.3.3.3' }]
  const d = diffRules(buildBatchedRules(targets, 3), buildBatchedRules(targets, 1))
  assert.equal(d.added.length, 0)
  assert.equal(d.removed.length, 0)
  assert.equal(d.unchanged, 3)
})

test('复核能穿过「一条规则多个 IP」把 IP 认全', () => {
  const v = judgeSync({
    targets: [{ ip: '1.1.1.1' }, { ip: '2.2.2.2' }],
    actualRules: [{ RuleName: 'ihui-edge-ban-b1', MatchContent: '1.1.1.1,2.2.2.2' }],
    wafModeBefore: 'observe',
    wafModeAfter: 'observe',
  })
  assert.equal(v.state, SYNC_STATE.OK)
  assert.equal(v.actualCount, 2)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
