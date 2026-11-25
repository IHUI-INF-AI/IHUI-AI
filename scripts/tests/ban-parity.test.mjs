// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 判据单一真相源 = scripts/security/lib/ban-parity.mjs;这里只 import,一条都不抄。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BAN_PARITY_STATE,
  describeParity,
  ipFromFwRuleName,
  ipsOfEdgeRules,
  judgeBanParity,
  parseNetshAtkRules,
} from '../security/lib/ban-parity.mjs'

// ── 规则名反解 ──────────────────────────────────────────────────────────────
test('规则名反解:点号还原成四段十进制', () => {
  assert.equal(ipFromFwRuleName('IHUI-DENY-ATK-43-174-55-156'), '43.174.55.156')
  assert.equal(ipFromFwRuleName('IHUI-DENY-ATK-1-2-3-4'), '1.2.3.4')
})

test('规则名反解:非本前缀 / 段数不对 / 数值越界 一律 null', () => {
  assert.equal(ipFromFwRuleName('IHUI-ALLOW-WWW-8801'), null)
  assert.equal(ipFromFwRuleName('IHUI-DENY-ATK-43-174-55'), null)
  assert.equal(ipFromFwRuleName('IHUI-DENY-ATK-43-174-55-156-1'), null)
  assert.equal(ipFromFwRuleName('IHUI-DENY-ATK-43-174-55-999'), null)
  assert.equal(ipFromFwRuleName('IHUI-DENY-ATK-43-174-55-x'), null)
  assert.equal(ipFromFwRuleName(null), null)
})

// ── netsh 解析 ──────────────────────────────────────────────────────────────
test('netsh 解析:英文表头,取到 enabled/action', () => {
  const text = [
    'Rule Name:                            IHUI-DENY-ATK-43-174-55-156',
    '----------------------------------------------------------------------',
    'Enabled:                              Yes',
    'Direction:                            In',
    'Profiles:                             Public',
    'LocalIP:                              Any',
    'RemoteIP:                             43.174.55.156/32',
    'Protocol:                             Any',
    'LocalPort:                            Any',
    'RemotePort:                           Any',
    'Edge traversal:                       Defer to user',
    'Action:                               Block',
  ].join('\r\n')
  const got = parseNetshAtkRules(text)
  assert.equal(got.length, 1)
  assert.equal(got[0].ip, '43.174.55.156')
  assert.equal(got[0].enabled, true)
  assert.equal(got[0].action, 'Block')
})

test('netsh 解析:中文表头同样认得(换机器不该变瞎)', () => {
  const text = ['规则名称: IHUI-DENY-ATK-9-9-9-9', '已启用: 否', '操作: 阻止'].join('\n')
  const got = parseNetshAtkRules(text)
  assert.equal(got.length, 1)
  assert.equal(got[0].ip, '9.9.9.9')
  assert.equal(got[0].enabled, false)
})

test('netsh 解析:别人的规则一条都不进判据', () => {
  const text = [
    'Rule Name:                            IHUI-ALLOW-WWW-8801',
    'Enabled:                              Yes',
    'Rule Name:                            ios_webkit_debug_proxy',
    'Enabled:                              Yes',
    'Rule Name:                            IHUI-DENY-EXTRA-APPS',
    'Enabled:                              Yes',
  ].join('\n')
  assert.equal(parseNetshAtkRules(text).length, 0)
})

test('netsh 解析:前缀可覆盖', () => {
  const text = ['Rule Name: MY-BAN-1-2-3-4', 'Enabled: Yes'].join('\n')
  const got = parseNetshAtkRules(text, 'MY-BAN-')
  assert.equal(got.length, 1)
  assert.equal(got[0].ip, '1.2.3.4')
})

test('netsh 解析:空文本 / 非文本 不抛', () => {
  assert.deepEqual(parseNetshAtkRules(''), [])
  assert.deepEqual(parseNetshAtkRules(null), [])
})

// ── 边缘规则展开 ────────────────────────────────────────────────────────────
test('边缘规则展开:MatchContent 逗号多值', () => {
  const s = ipsOfEdgeRules([
    { MatchContent: '1.1.1.1,2.2.2.2 , 3.3.3.3' },
    { MatchContent: '4.4.4.4' },
    { MatchContent: '' },
    {},
  ])
  assert.deepEqual([...s].sort(), ['1.1.1.1', '2.2.2.2', '3.3.3.3', '4.4.4.4'])
})

// ── 三面比对 ────────────────────────────────────────────────────────────────
const W = (ips) => ips.map((ip) => ({ ip }))
const F = (ips, enabled = true) => ips.map((ip) => ({ ip, enabled }))

test('两面逐条一致 ⇒ ok', () => {
  const v = judgeBanParity({ want: W(['1.1.1.1', '2.2.2.2']), fw: F(['1.1.1.1', '2.2.2.2']), edge: new Set(['1.1.1.1', '2.2.2.2']), edgeReadable: true })
  assert.equal(v.state, BAN_PARITY_STATE.OK)
  assert.deepEqual(v.missingOnFw, [])
  assert.deepEqual(v.missingOnEdge, [])
})

test('防火墙漏封 ⇒ drift,且逐条点名', () => {
  const v = judgeBanParity({ want: W(['1.1.1.1', '2.2.2.2']), fw: F(['1.1.1.1']), edge: new Set(['1.1.1.1', '2.2.2.2']), edgeReadable: true })
  assert.equal(v.state, BAN_PARITY_STATE.DRIFT)
  assert.deepEqual(v.missingOnFw, ['2.2.2.2'])
})

test('防火墙残留(名单已放过但还封着) ⇒ drift', () => {
  const v = judgeBanParity({ want: W(['1.1.1.1']), fw: F(['1.1.1.1', '9.9.9.9']), edge: new Set(['1.1.1.1']), edgeReadable: true })
  assert.equal(v.state, BAN_PARITY_STATE.DRIFT)
  assert.deepEqual(v.extraOnFw, ['9.9.9.9'])
})

test('Enabled: No 不算封住 ⇒ 报漏封', () => {
  const v = judgeBanParity({ want: W(['1.1.1.1']), fw: F(['1.1.1.1'], false), edge: new Set(['1.1.1.1']), edgeReadable: true })
  assert.equal(v.state, BAN_PARITY_STATE.DRIFT)
  assert.deepEqual(v.missingOnFw, ['1.1.1.1'])
  assert.deepEqual(v.fwDisabled, ['1.1.1.1'])
})

test('边缘读不到 ⇒ partial,不是 ok(§0.3 不许把半判写成判过)', () => {
  const v = judgeBanParity({ want: W(['1.1.1.1', '2.2.2.2']), fw: F(['1.1.1.1', '2.2.2.2']), edge: null, edgeReadable: false })
  assert.equal(v.state, BAN_PARITY_STATE.PARTIAL)
  assert.deepEqual(v.unjudged, ['edge'])
  assert.equal(v.faces.edge.judged, false)
  assert.equal(v.missingOnEdge, null)
})

test('边缘读不到但防火墙已经漏 ⇒ 仍然 drift(已知有错优先于未判定)', () => {
  const v = judgeBanParity({ want: W(['1.1.1.1', '2.2.2.2']), fw: F(['1.1.1.1']), edge: null, edgeReadable: false })
  assert.equal(v.state, BAN_PARITY_STATE.DRIFT)
  assert.deepEqual(v.missingOnFw, ['2.2.2.2'])
})

test('边缘漏封 ⇒ drift;边缘残留 ⇒ drift', () => {
  const a = judgeBanParity({ want: W(['1.1.1.1']), fw: F(['1.1.1.1']), edge: new Set(), edgeReadable: true })
  assert.equal(a.state, BAN_PARITY_STATE.DRIFT)
  assert.deepEqual(a.missingOnEdge, ['1.1.1.1'])

  const b = judgeBanParity({ want: W(['1.1.1.1']), fw: F(['1.1.1.1']), edge: new Set(['1.1.1.1', '8.8.8.8']), edgeReadable: true })
  assert.equal(b.state, BAN_PARITY_STATE.DRIFT)
  assert.deepEqual(b.extraOnEdge, ['8.8.8.8'])
})

test('want 为空 ∧ 两面都空 ⇒ ok(零封禁也是一个合法状态)', () => {
  const v = judgeBanParity({ want: [], fw: [], edge: new Set(), edgeReadable: true })
  assert.equal(v.state, BAN_PARITY_STATE.OK)
  assert.equal(v.wantCount, 0)
})

// ── 冷却期(cooling):新封的 IP 防火墙已有,按设计还没推边缘 ────────────────
// 这组是线上抓到的真缺陷:不区分冷却期,每封一个新 IP 都会报一次假 drift 并寄假告警。
test('冷却中的 IP 只差边缘 ⇒ ok,不许报 drift(否则每封一个都假告警)', () => {
  const v = judgeBanParity({
    want: W(['1.1.1.1']),
    cooling: ['9.9.9.9'],
    fw: F(['1.1.1.1', '9.9.9.9']),
    edge: new Set(['1.1.1.1']),
    edgeReadable: true,
  })
  assert.equal(v.state, BAN_PARITY_STATE.OK)
  assert.deepEqual(v.extraOnFw, [])
  assert.deepEqual(v.missingOnEdge, [])
  assert.equal(v.coolingCount, 1)
})

test('冷却中的 IP 若防火墙也漏 ⇒ 仍报漏封(冷却不等于可以不封)', () => {
  const v = judgeBanParity({ want: W([]), cooling: ['9.9.9.9'], fw: F([]), edge: new Set(), edgeReadable: true })
  assert.equal(v.state, BAN_PARITY_STATE.DRIFT)
  assert.deepEqual(v.missingOnFw, ['9.9.9.9'])
})

test('冷却中的 IP 已在边缘 ⇒ 也不算边缘残留(它本来就在册)', () => {
  const v = judgeBanParity({
    want: W(['1.1.1.1']),
    cooling: ['9.9.9.9'],
    fw: F(['1.1.1.1', '9.9.9.9']),
    edge: new Set(['1.1.1.1', '9.9.9.9']),
    edgeReadable: true,
  })
  assert.equal(v.state, BAN_PARITY_STATE.OK)
  assert.deepEqual(v.extraOnEdge, [])
})

// ── 人读摘要 ────────────────────────────────────────────────────────────────
test('describeParity:四种状态各自说人话', () => {
  assert.equal(describeParity({ state: 'ok', wantCount: 41 }), '41 个 IP 两面逐条一致')
  assert.match(describeParity({ state: 'partial', wantCount: 41, unjudged: ['edge'] }), /边缘未判定/)
  assert.equal(describeParity(null), '未判定')
  const v = judgeBanParity({ want: W(['1.1.1.1', '2.2.2.2']), fw: F(['1.1.1.1']), edge: null, edgeReadable: false })
  assert.match(describeParity(v), /防火墙漏封 1/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
