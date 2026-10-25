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
import { readFileSync } from 'node:fs'
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

test('③a 白名单:命中/不命中/大小写不敏感/只看标题区', () => {
  assert.equal(ae.matchWhitelist('README 数字收尾对齐', ['readme']), true)
  assert.equal(ae.matchWhitelist('补齐 i18n 五语言键', ['i18n']), true)
  assert.equal(ae.matchWhitelist('重构数据库连接池', ['readme', '文档', 'i18n']), false)
  // 2026-10-25 --once 真派实测缺口:正文含白名单词而标题不含 ⇒ 不得命中(误派大工程票)
  assert.equal(ae.matchWhitelist('**第 3 期·进化回流**:失败票归因沉淀;pnpm 依赖升级自动生成票', ['依赖升级']), false)
  assert.equal(ae.matchWhitelist('**README 数字收尾** 其他正文随便写依赖升级', ['readme']), true)
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

test('⑧ token 计量:只认终态 complete 行的 usage,缺失/形状坏判未计量', () => {
  const complete = JSON.stringify({
    type: 'complete',
    stopReason: 'end_turn',
    usage: { promptTokens: 900, completionTokens: 100, totalTokens: 1000, estimatedCostUsd: 0.12 },
  })
  const u = ae.parseSessionUsage(`${JSON.stringify({ type: 'start' })}\n${complete}\n`)
  assert.equal(u.measured, true)
  assert.equal(u.tokens, 1000)
  assert.equal(u.costUsd, 0.12)
  // 超时/被杀:没有终态行 ⇒ 未计量(不得读成 0 tokens 放行)
  assert.equal(ae.parseSessionUsage('{"type":"message_delta","text":"x"}').measured, false)
  assert.equal(ae.parseSessionUsage('').measured, false)
  // 终态行 usage 形状坏 ⇒ 未计量
  assert.equal(ae.parseSessionUsage('{"type":"complete","usage":{"totalTokens":"NaN"}}').measured, false)
  // complete 行不是 JSON 行(人读排版)⇒ 未计量
  assert.equal(ae.parseSessionUsage('📊 tokens: 1000 (prompt 900 + completion 100)').measured, false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

test('⑦ 会话 JWT 形状:HS256 三段 / sub 必在(实测缺口)/ iss/aud/exp 同 auth 包', async () => {
  const { createHmac } = await import('node:crypto')
  const secret = 'x'.repeat(40)
  const uid = '123e4567-e89b-12d3-a456-426614174000'
  const now = Math.floor(Date.now() / 1000)
  const jwt = ae.signSessionJwt(secret, { userId: uid, now })
  const [h, p, s] = jwt.split('.')
  assert.ok(h.length > 0 && p.length > 0 && s.length > 0)
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'))
  assert.equal(payload.sub, uid, 'verifyAccessToken 强制 sub(缺 ⇒ 401 且文案被吞),此步不能省')
  assert.equal(payload.userId, uid)
  assert.equal(payload.iss, 'ihui-ai')
  assert.equal(payload.aud, 'ihui-ai-users')
  assert.equal(payload.roleId, 0, '最小权限:机器会话恒 role 0')
  assert.ok(payload.exp - payload.iat === 8 * 3600)
  const expect = createHmac('sha256', secret).update(h + '.' + p).digest('base64url')
  assert.equal(s, expect)
})

// ===== 自治决策排期接线(2026-10-26):有评估才排序,没评估保持台账序 =====
test('⑨a 无候选评估 ⇒ 台账序原样返回(不补默认因子)', () => {
  const rows = [
    { line: 1, text: '票一' },
    { line: 2, text: '票二' },
  ]
  const r = ae.rankTicketRows(rows, { candidatesText: '' })
  assert.equal(r.mode, 'ledger-order')
  assert.deepEqual(r.rows, rows)
})

test('⑨b 有评估 ⇒ 按模型序放行可排期票,压后票逐条点名', () => {
  const policyText = readFileSync(new URL('../data/autonomy-policy.json', import.meta.url), 'utf8')
  const low = { line: 1, text: '低分票' }
  const high = { line: 2, text: '高分票' }
  const mk = (row, id, over) => ({
    id: ae.ticketKeyOf(row.text),
    title: id,
    benefit: { impact: 3, userValue: 3 },
    risk: { irreversible: 0, externalDependency: 0, ruleTouch: 0 },
    cost: { changeSurface: 0, verifyMinutes: 1 },
    urgency: { leaseHours: null, blockingOthers: 0 },
    ...over,
  })
  const candidates = [
    mk(low, 'low', {
      benefit: { impact: 0, userValue: 0 },
      risk: { irreversible: 3, externalDependency: 3, ruleTouch: 3 },
    }),
    mk(high, 'high'),
  ]
  const r = ae.rankTicketRows([low, high], {
    policyText,
    candidatesText: JSON.stringify({ candidates }),
  })
  assert.equal(r.mode, 'decision')
  assert.equal(r.rows.length, 1, '只放行模型判为可排期的票')
  assert.equal(r.rows[0].text, '高分票', '模型序优先于台账序')
  assert.equal(r.skipped.length, 1)
  assert.match(r.skipped[0].reason, /硬阻断|风险/, '压后原因必须逐条点名,不能只报数')
})

