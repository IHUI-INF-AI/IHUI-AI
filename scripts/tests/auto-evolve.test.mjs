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
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  __test__ as ae,
  gateTicketByHumanValve,
  VALVE_LIST_JSON,
  classifySessionWrites,
  normalizeSessionRuntime,
  judgeLandingProof,
  WRITE_TOOL_NAMES,
  classifySessionFailure,
} from '../auto-evolve.mjs'
import { NON_PROGRESS_ACTIONS, PROGRESS_ACTIONS } from '../lib/autonomy-nonprogress.mjs'

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
    assert.throws(
      () => ae.loadGates(() => raw),
      ae.GateShapeError,
      `应判形状坏: ${raw.slice(0, 60)}`,
    )
  }
})

test('② 取票唯一入口:plan-tasks + --open --dispatchable --exclude-inflight', () => {
  assert.ok(ae.PLAN_TASKS.endsWith('plan-tasks.mjs'))
  assert.deepEqual(
    [...ae.DISPATCH_ARGS].sort(),
    ['--dispatchable', '--exclude-inflight', '--open'].sort(),
  )
})

test('③a 白名单:命中/不命中/大小写不敏感/只看标题区', () => {
  assert.equal(ae.matchWhitelist('README 数字收尾对齐', ['readme']), true)
  assert.equal(ae.matchWhitelist('补齐 i18n 五语言键', ['i18n']), true)
  assert.equal(ae.matchWhitelist('重构数据库连接池', ['readme', '文档', 'i18n']), false)
  // 2026-10-25 --once 真派实测缺口:正文含白名单词而标题不含 ⇒ 不得命中(误派大工程票)
  assert.equal(
    ae.matchWhitelist('**第 3 期·进化回流**:失败票归因沉淀;pnpm 依赖升级自动生成票', ['依赖升级']),
    false,
  )
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
  assert.equal(
    ae.failureStreakOf([...ledger, { ticketKey: 'k', action: 'session-timeout' }], 'k'),
    2,
  )
  assert.equal(ae.failureStreakOf(ledger, '不存在'), 0)
})

test('③c 封票成对:未到期拦 / 已到期放 / 无封票放', () => {
  const future = new Date(Date.now() + 3600_000).toISOString()
  const past = new Date(Date.now() - 1000).toISOString()
  const led = [{ ticketKey: 'k', action: 'quarantined', until: future }]
  assert.ok(ae.quarantinedUntilOf(led, 'k') !== null)
  assert.equal(
    ae.quarantinedUntilOf([{ ticketKey: 'k', action: 'quarantined', until: past }], 'k'),
    null,
  )
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
  assert.equal(
    ae.parseSessionUsage('{"type":"complete","usage":{"totalTokens":"NaN"}}').measured,
    false,
  )
  // complete 行不是 JSON 行(人读排版)⇒ 未计量
  assert.equal(
    ae.parseSessionUsage('📊 tokens: 1000 (prompt 900 + completion 100)').measured,
    false,
  )
})

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
  const expect = createHmac('sha256', secret)
    .update(h + '.' + p)
    .digest('base64url')
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

// ===== 人工阀派发路由(2026-11-03 改档):observe-stop 由"照派"改为"单票停机不派" =====
// 立因:台账里 20 条 valve-observe-stop 是阀判"停机等人",旧代码只记账仍照派,白烧会话额度。
const VALVE_TEXT = readFileSync(VALVE_LIST_JSON, 'utf8')
const valveRoute = (ticketText, mode, valveListText = VALVE_TEXT) =>
  ae.decideValveDispatch(gateTicketByHumanValve({ ticketText, mode, valveListText }), mode, {
    ticketKey: 'k1',
    ticketLine: `L7 ${ticketText}`,
  })

test('⑩a observe + stop-for-human ⇒ 该票不派,台账 valve-observe-stop 带未派标记', () => {
  const r = valveRoute('把 DEEPSEEK_API_KEY 换成新的密钥', 'observe')
  assert.equal(r.route, 'skip-observe-stop', 'observe 档命中停机类必须单票跳过,不再照派')
  assert.equal(r.ledger.action, 'valve-observe-stop', '动作名必须保留,否则既有统计失效')
  assert.equal(r.ledger.dispatched, false, '台账要能区分"阀判停机但其实派出去了"的旧行')
  assert.equal(r.ledger.ruleId, 'api-key-change', '规则 id 原样保留')
  assert.match(r.ledger.why, /停机/, '原判据文案原样保留(不覆盖既有字段含义)')
  assert.equal(r.ledger.ticketKey, 'k1')
})

test('⑩b observe + allow ⇒ 照派(不许误伤正常派发)', () => {
  const r = valveRoute('给 scripts/lib/human-valve.mjs 补一个纯函数', 'observe')
  assert.equal(r.route, 'dispatch', '自决类必须照派')
  assert.equal(r.ledger.action, 'valve-allow')
  assert.ok(!('dispatched' in r.ledger), 'allow 行字段形状不变(不加未派标记)')
})

test('⑩c enforce + block ⇒ 跳单票(原语义不变)', () => {
  const r = valveRoute('把 DEEPSEEK_API_KEY 换成新的密钥', 'enforce')
  assert.equal(r.route, 'block', 'enforce 档命中停机类仍是单票不派')
  assert.equal(r.ledger.action, 'valve-block')
  assert.ok(!('dispatched' in r.ledger), 'block 行字段形状不变')
})

test('⑩d enforce + unjudged ⇒ 整轮停(原语义不变)', () => {
  const r = valveRoute('任意票面', 'enforce', '')
  assert.equal(r.route, 'stop-round', 'enforce 档未判定必须 fail-closed 停整轮')
  assert.equal(r.ledger.action, 'valve-unjudged')
})

test('⑩e unjudged + observe ⇒ 照派(这一档保持现状,不扩大改动面)', () => {
  const r = valveRoute('任意票面', 'observe', '')
  assert.equal(r.route, 'dispatch')
  assert.equal(r.ledger.action, 'valve-unjudged')
})

test('⑩f 接线锁:skip-observe-stop 的 continue 必须早于 dispatchSession 调用点', () => {
  const src = readFileSync(new URL('../auto-evolve.mjs', import.meta.url), 'utf8')
  const loop = src.slice(src.indexOf('for (const ticket of rows)'))
  const skipIdx = loop.indexOf("valveRoute.route === 'skip-observe-stop'")
  const continueIdx = loop.indexOf('continue', skipIdx)
  const dispatchIdx = loop.indexOf('dispatchSession(gates, ticket, dryRun)')
  assert.ok(skipIdx > 0, '派发循环里必须有 skip-observe-stop 分支')
  assert.ok(
    continueIdx > skipIdx && dispatchIdx > continueIdx,
    '跳过必须真 continue,且不落到 dispatchSession',
  )
  assert.ok(src.includes('valve-observe-stop(skip)'), '日志要能一眼分清"停机未派"')
  assert.ok(src.includes('gateTicketByHumanValve({'), 'A6 依赖的阀调用点不许搬走')
})

/**
 * ⑪ 判据面闸(2026-11-04 立):自治环落账腿必须整批拒收命中受保护面的产物,
 * 因为会话侧没有豁免签名权 —— 替它补一行 immutable-exempt 等于自己给自己发豁免。
 * 匹配判据一律走 lib/immutable-guard.mjs(本文件零复算),这里只钉"接线与方向"。
 */
const GUARD_LIST_TEXT = readFileSync(
  new URL('../data/immutable-guard.json', import.meta.url),
  'utf8',
)
const MANIFEST_KEY = 'pface1'
const manifestOfFiles = (files) => JSON.stringify({ ticketKey: MANIFEST_KEY, files })
const statusAllDirty = () => ' M x'
function spyCommit() {
  const calls = []
  return { calls, fn: (arg) => (calls.push(arg), { ok: true, status: 0 }) }
}
const land = (files, extra = {}) =>
  ae.landTicketArtifacts({
    ticketKey: MANIFEST_KEY,
    ticketText: '某票',
    manifestText: manifestOfFiles(files),
    statusFn: statusAllDirty,
    dryRun: false,
    ...extra,
  })

test('⑪a 成对·正:全部不在判据面上 ⇒ clean 并照常代提交', () => {
  const s = ae.partitionProtectedFaces(['README.ja.md', 'apps/web/src/a.tsx'], GUARD_LIST_TEXT)
  assert.equal(s.state, 'clean')
  assert.deepEqual(s.landable, ['README.ja.md', 'apps/web/src/a.tsx'])
  const spy = spyCommit()
  const r = land(['README.ja.md'], { commitFn: spy.fn, protectedFaceOf: () => s })
  assert.equal(r.action, 'artifact-committed')
  assert.equal(spy.calls.length, 1, 'clean 档必须真把代提交走到(闸不能顺手把绿档也堵死)')
})

test('⑪b 成对·反:glob / 目录前缀 / 精确三种清单形态各命中一枚 ⇒ blocked 且一次提交都不发', () => {
  for (const f of [
    'scripts/check-demo.mjs',
    'scripts/lib/demo.mjs',
    'scripts/guardian-runner.mjs',
    'scripts/data/demo-exemptions.json',
  ]) {
    const s = ae.partitionProtectedFaces([f], GUARD_LIST_TEXT)
    assert.equal(s.state, 'blocked', `${f} 应命中判据面`)
    assert.equal(s.protectedHits.length, 1)
    const spy = spyCommit()
    const r = land([f], { commitFn: spy.fn, protectedFaceOf: () => s })
    assert.equal(r.action, 'artifact-protected-face')
    assert.equal(spy.calls.length, 0, '拒收档结构上不许碰代提交(摘掉闸这一条就翻绿)')
    assert.match(r.why, /整批不落/)
  }
})

test('⑪c 混合批不部分提交:一枚命中 ⇒ 整批不落,并把命中的那枚点名', () => {
  const spy = spyCommit()
  const r = land(['README.md', 'scripts/lib/demo.mjs'], {
    commitFn: spy.fn,
    protectedFaceOf: (files) => ae.partitionProtectedFaces(files, GUARD_LIST_TEXT),
  })
  assert.equal(r.action, 'artifact-protected-face')
  assert.equal(spy.calls.length, 0)
  assert.equal(r.protectedHits.length, 1)
  assert.match(r.why, /scripts\/lib\/demo\.mjs/, '点名要能直接拿去派人工,不能只报个数')
})

test('⑪d 清单取不到/形状坏/entries 空 ⇒ 未判定,同向拒落(不读成"没有尺子拦我")', () => {
  for (const [name, text] of [
    ['null', null],
    ['坏 JSON', '{'],
    ['entries 空', JSON.stringify({ entries: [] })],
  ]) {
    const s = ae.partitionProtectedFaces(['README.md'], text)
    assert.equal(s.state, 'undetermined', `${name} 必须落未判定`)
    const spy = spyCommit()
    const r = land(['README.md'], {
      commitFn: spy.fn,
      protectedFaceOf: () => ae.partitionProtectedFaces(['README.md'], text),
    })
    assert.equal(r.action, 'artifact-protected-face', `${name} 档拒落`)
    assert.equal(spy.calls.length, 0)
    assert.match(r.why, /无法证明/)
  }
})

test('⑪e dry-run 演的是真跑那一支:命中判据面时预演也报拒收,不报"会提交"', () => {
  const spy = spyCommit()
  const r = ae.landTicketArtifacts({
    ticketKey: MANIFEST_KEY,
    ticketText: '某票',
    manifestText: manifestOfFiles(['scripts/lib/demo.mjs']),
    statusFn: statusAllDirty,
    commitFn: spy.fn,
    dryRun: true,
    protectedFaceOf: (files) => ae.partitionProtectedFaces(files, GUARD_LIST_TEXT),
  })
  assert.equal(r.action, 'artifact-protected-face')
})

test('⑪f 默认出口走的是真清单(接线不是死的):现读仓内清单,README 档 clean、门体档 blocked', () => {
  const spy = spyCommit()
  const ok = land(['README.md'], { commitFn: spy.fn })
  assert.equal(ok.action, 'artifact-committed', '默认 protectedFaceOf 必须真读到清单并放行普通文件')
  const spy2 = spyCommit()
  const bad = land(['scripts/check-demo.mjs'], { commitFn: spy2.fn })
  assert.equal(bad.action, 'artifact-protected-face')
})

test('⑪g 空转计数成套:新档进 NON_PROGRESS 且绝不进 PROGRESS(否则日预算被同一枚票白吃)', () => {
  const np = NON_PROGRESS_ACTIONS.includes('artifact-protected-face')
  const pr = PROGRESS_ACTIONS.includes('artifact-protected-face')
  assert.ok(np, '判据面拒收必须计入空转')
  assert.ok(!pr, '它不是推进;进了 PROGRESS 就等于每拒一次都把计数器清零')
})

/**
 * ⑫ 会话终态理由与取材纪律(2026-11-04 立)。
 * 立因:白名单扩档后第一次真派发(P85)实测 `exit=3 + stopReason=no_progress +
 * promptTokens≈126196 / completionTokens=22` —— 会话把预算吃在"读整份台账/规则"上,
 * 一个班次白烧。而当时台账里只有 `session-failed`,分不出该改提示词还是该改运行器。
 */
test('⑫a parseSessionUsage 取到终态理由;没有 complete 行时为 null(不猜)', () => {
  const withReason = ae.parseSessionUsage(
    '{"type":"start"}\n{"type":"complete","stopReason":"no_progress","usage":{"totalTokens":10,"estimatedCostUsd":0.1}}\n',
  )
  assert.equal(withReason.stopReason, 'no_progress')
  assert.equal(withReason.measured, true)
  const noComplete = ae.parseSessionUsage('{"type":"start"}\n')
  assert.equal(noComplete.stopReason, null, '取不到终态理由 ⇒ null,不许回落成某个具体值')
  const badShape = ae.parseSessionUsage('{"type":"complete","usage":{"totalTokens":-1}}\n')
  assert.equal(badShape.measured, false)
  assert.equal(badShape.stopReason, null)
})

test('⑫b 派发票必须带取材纪律,且点名两份大文件(摘掉这段=本锁翻红)', () => {
  const src = readFileSync(new URL('../auto-evolve.mjs', import.meta.url), 'utf8')
  const block = src.slice(
    src.indexOf('const promptText = ['),
    src.indexOf('writeFileSync(promptFile'),
  )
  assert.ok(block.includes('取材纪律'), '派发票里必须有取材纪律这一节')
  assert.ok(
    block.includes('PROJECT_PLAN.md') && block.includes('AGENTS.md'),
    '必须点名两份会被整份读掉的大文件',
  )
  assert.ok(block.includes('no_progress'), '纪律要带着实测终态理由一起给,否则只是空喊"别浪费"')
})

test('⑫c 记账行把 stopReason 带进台账(只留 exit 码就永远分不出成因)', () => {
  const src = readFileSync(new URL('../auto-evolve.mjs', import.meta.url), 'utf8')
  // 断言按**语义形状**写,不按"某一行原文":格式化器(prettier / 钩子里的 --fix)会把超长调用折行,
  // 逐行字面锁只会把自己咬红(H69 同型教训;今天就是被折行咬了一次,内容一字未错)。
  // 这枚锁要判的是"派发结果那一处 record 有没有把终态理由带进台账",不是它折没折行。
  const KEY = "mode: dryRun ? 'dryrun' : 'dispatch'"
  const marks = []
  let cur = -1
  while ((cur = src.indexOf(KEY, cur + 1)) >= 0) marks.push(cur)
  const sliceOf = (p) => src.slice(Math.max(0, src.lastIndexOf('record({', p)), p + 900)
  // 文件里有多处带 mode 标记的 record ⇒ 必须挑"带 action: res.action 的那一处",
  // 否则切片会落到别的 record 上,把仍在的判据读成不在了(本锁第一版就是这么误红的)。
  const at = marks.find((p) => sliceOf(p).includes('action: res.action'))
  assert.ok(
    at !== undefined,
    `派发结果那一处 record 必须还在(现读带 mode 标记的候选 ${marks.length} 处,无一含 action: res.action ⇒ 搬家了就要同步本锁)`,
  )
  const rec = sliceOf(at)
  assert.ok(
    rec.includes('action: res.action'),
    '切片必须落在"派发结果"那一处 record,而不是别的 record',
  )
  assert.ok(
    rec.includes('stopReason: res.stopReason ?? null'),
    '派发记账行必须显式带 stopReason(否则只留 exit 码,永远分不出成因)',
  )
  const fnAt = src.indexOf('function dispatchSession(')
  assert.ok(fnAt > 0, 'dispatchSession 本体必须在被审面上(取不到 ⇒ 本锁红,不放行)')
  const body = src.slice(fnAt, fnAt + 24000)
  assert.ok(
    body.includes('stopReason: meter.stopReason ?? null'),
    'dispatchSession 的返回必须透出终态理由(台账那一行才有得可带)',
  )
})

/**
 * ⑬ 「退出码 0 但整班没动手」分档(2026-11-04 立)。
 * 立因是实测:9 次 session-ok 的 transcript 里写类工具命中为 0,而 `artifact-committed` 至今为 0
 * —— 尺子把"会话结束了"读成"这轮干成了"。成对夹具直接取当天真跑的两份 stdout 形态:
 * 探针那一次 write_file 成功(正例),生产票那一次全程只读(反例)。
 */
test('⑬a 真实形态:成功写一次 ⇒ known 且 writeOk=1(不许把有产出读成没产出)', () => {
  const probe = [
    '{"type":"tool_call","name":"write_file","arguments":{"path":"a.txt","content":"x"}}',
    '{"type":"tool_delta","name":"write_file","toolCallId":"t1","seq":1,"partialText":"x"}',
    '{"type":"tool_delta_clear","name":"write_file","toolCallId":"t1"}',
    '{"type":"tool_result","name":"write_file","success":true,"output":"已写入 a.txt (1 行, 20 字节)"}',
    '{"type":"iteration","count":2,"max":8}',
    '{"type":"complete","stopReason":"end_turn","usage":{"totalTokens":48205}}',
  ].join('\n')
  const w = classifySessionWrites(probe)
  assert.equal(w.known, true, 'complete 行在 ⇒ 输出形状认识')
  assert.equal(w.writeOk, 1, 'tool_result.success=true 的写类调用必须被记上')
})

test('⑬b 真实形态:只读到底 ⇒ known 而 writeOk=0(这正是 9/9 那一格)', () => {
  const readOnly = [
    '{"type":"tool_call","name":"read_file","arguments":{"path":"a"}}',
    '{"type":"tool_result","name":"read_file","success":true,"output":"…"}',
    '{"type":"tool_call","name":"grep","arguments":{"pattern":"x"}}',
    '{"type":"tool_result","name":"grep","success":true,"output":"…"}',
    '{"type":"complete","stopReason":"end_turn","usage":{"totalTokens":1000}}',
  ].join('\n')
  const w = classifySessionWrites(readOnly)
  assert.equal(w.known, true)
  assert.equal(w.writeOk, 0, '只读会话不得被读成"写过"')
  assert.equal(w.writeTried, 0)
})

test('⑬c 反向锁:写了但没成功 ⇒ writeOk 仍为 0(成败认 tool_result,不认 tool_call)', () => {
  const failedWrite = [
    '{"type":"tool_call","name":"write_file","arguments":{"path":"a"}}',
    '{"type":"tool_result","name":"write_file","success":false,"output":"权限被拒"}',
    '{"type":"complete","stopReason":"end_turn","usage":{"totalTokens":10}}',
  ].join('\n')
  const w = classifySessionWrites(failedWrite)
  assert.equal(w.writeOk, 0, 'success:false 的写不算产出')
  assert.equal(w.writeTried, 1, '但"试过"要留数,归因才有两个方向')
})

test('⑬d 取不到形状 ⇒ known=false ⇒ 上层不得据此改判(未判定不冒红)', () => {
  const junk = 'not json at all\n{"type":"start","prompt":"x"}\n'
  const w = classifySessionWrites(junk)
  assert.equal(w.known, false, '既无 complete 也无工具事件 ⇒ 不认识,不许当成"没写"')
  assert.equal(w.writeOk, 0)
})

test('⑬e 发射端接线:known∧零写 ⇒ action 必须是 session-no-write(§0.9 有档名没发射=没有)', () => {
  const src = readFileSync(new URL('../auto-evolve.mjs', import.meta.url), 'utf8')
  const at = src.indexOf("    action = 'session-ok'")
  assert.ok(at > 0, "exit 0 那一支必须还在 `action = 'session-ok'` 处")
  const branch = src.slice(at, at + 700)
  assert.ok(branch.includes("action = 'session-no-write'"), '该支里必须紧跟零写改判')
  assert.ok(branch.includes('w.known && w.writeOk === 0'), '改判判据必须是 known∧零写双条件')
})

test('⑬f 写类工具名清单不得腐烂:每个名字必须在 CLI 源码里真注册', () => {
  // 只验存在性(改名/下架即翻红)。dangerLevel 档位本身分散在各工具文件里声明,本锁不重抄档位判据。
  const hits = new Set()
  for (const rel of [
    '../../apps/cli/src/tools/file-edit.ts',
    '../../apps/cli/src/tools/file-batch-edit.ts',
  ]) {
    const text = readFileSync(new URL(rel, import.meta.url), 'utf8')
    for (const name of WRITE_TOOL_NAMES) {
      if (new RegExp(`name:\\s*'${name}'`).test(text)) {
        hits.add(name)
      }
    }
  }
  for (const name of WRITE_TOOL_NAMES) {
    assert.ok(
      hits.has(name),
      `清单里的 ${name} 在 CLI 工具源码里找不到注册点 ⇒ 清单腐烂,零写判据会恒真`,
    )
  }
})

/**
 * ⑭ 落地自证五问(2026-11-04,与私有索引通道同批)。
 * 为什么换通道:`safe-commit.mjs` 的 Step 1 是 `git reset HEAD`(自述"无论谁 staged 的"),
 * 而多会话共树下当次实测共享索引里有 12 枚他人暂存(含 2 枚他人暂存删除的保护标记)。
 * 自主环一旦能落账就是按小时清别人现场 —— 所以换 §12i 的 isolated-git,并补五问自证:
 * 退出码 0 不等于"这枚是我的、且带了声明集"。
 */
test('⑭a 五问全过 ⇒ ok 并透出 landedSha', () => {
  const r = judgeLandingProof({
    beforeSha: 'a'.repeat(40),
    afterSha: 'b'.repeat(40),
    advanced: 1,
    declaredPaths: ['scripts/x.mjs'],
    committedPaths: new Set(['scripts/x.mjs']),
  })
  assert.equal(r.ok, true)
  assert.equal(r.landedSha, 'b'.repeat(40))
})

test('⑭b 逐问成对:每一问单独破坏都必须不记已落地', () => {
  const good = {
    beforeSha: 'a'.repeat(40),
    afterSha: 'b'.repeat(40),
    advanced: 1,
    declaredPaths: ['scripts/x.mjs'],
    committedPaths: new Set(['scripts/x.mjs']),
  }
  const cases = [
    ['afterSha 取不到', { afterSha: null }],
    ['beforeSha 取不到', { beforeSha: null }],
    ['HEAD 原地未动', { afterSha: 'a'.repeat(40) }],
    ['推进枚数取不到', { advanced: null }],
    ['一次推进多枚(顶上可能不是本票)', { advanced: 3 }],
    ['改动集取不到', { committedPaths: null }],
    ['声明集没全进这枚提交', { committedPaths: new Set() }],
  ]
  for (const [label, patch] of cases) {
    const r = judgeLandingProof({ ...good, ...patch })
    assert.equal(r.ok, false, `${label} ⇒ 必须不记已落地`)
    assert.ok(String(r.why).length > 6, `${label} 必须点名原因`)
  }
})

test('⑭c 落账腿真的走私有索引通道,且不再指 safe-commit(反向锁:改回去即翻红)', () => {
  const src = readFileSync(new URL('../auto-evolve.mjs', import.meta.url), 'utf8')
  assert.ok(src.includes("'isolated-git.mjs'"), 'LAND_COMMIT 必须指向 isolated-git')
  assert.ok(!src.includes('[SAFE_COMMIT,'), '代提交不得再拼 safe-commit(它 Step1 清共享索引)')
  assert.ok(
    /spawnSync\(process\.execPath, \[LAND_COMMIT, 'commit'/.test(src),
    '必须以 commit 子命令形态调用',
  )
  const fn = src.slice(
    src.indexOf('export function runLandCommit'),
    src.indexOf('async function runOnce('),
  )
  assert.ok(fn.length > 400, 'runLandCommit 函数体切片取到了(锚点漂了就要同步本锁)')
  assert.ok(
    fn.includes('recordGatesThenCommit({') && fn.includes('recordForCommit({'),
    '提交后两腿必须接上(否则每枚自主提交都被读成没跑门/无归属)',
  )
})

/**
 * ⑮ 会话运行时归一(2026-11-05 立)。
 * 立因是台账原文,不是推测:16:09:00 那轮 `session-failed exit=1`,stderr 按 GBK 码页解出来是
 * 「'node' 不是内部或外部命令…」⇒ 模板首 token 是裸 `node`,而派发方是 nssm 服务身份的守护,
 * 服务读机器级 PATH(本机实测那是死目录)。而 `preflightSessionRunner` 放行了它 —— 它只核验模板里的
 * **绝对路径 token**(tsx/cli.mjs、index.ts 全在位),可执行文件能不能解析这一格不在射程 ⇒
 * 器物在库、核验在跑、产出恒为零(§0.9 同一型)。正解用派发进程自己的运行时:当次取、不写死盘符(§0)。
 */
test('⑮a 裸 node / node.exe 换成当次运行时,其余一字不动', () => {
  const filled =
    'node D:/R/apps/cli/node_modules/tsx/dist/cli.mjs D:/R/apps/cli/src/index.ts --json --max-iterations 40'
  const r = normalizeSessionRuntime(filled, 'D:/DevEnv/runtimes/node.exe')
  assert.equal(r.replaced, true)
  assert.ok(
    r.cmd.startsWith('D:/DevEnv/runtimes/node.exe '),
    `首 token 必须被换掉,实得:${r.cmd.slice(0, 40)}`,
  )
  assert.ok(r.cmd.includes('--max-iterations 40'), '模板其余部分必须逐字保留')
  assert.equal(
    normalizeSessionRuntime('node.exe D:/a.mjs', 'D:/x/node.exe').replaced,
    true,
    'node.exe 写法同档',
  )
})

test('⑮b 反向锁:自定义 runner 与取不到路径都不得改写(不猜、不静默改)', () => {
  const own = normalizeSessionRuntime('py -3.12 D:/a.py', 'D:/x/node.exe')
  assert.equal(own.replaced, false, '首 token 不是裸 node ⇒ 原样(自定义 runner 必须照原样跑)')
  assert.equal(own.cmd, 'py -3.12 D:/a.py')
  const noPath = normalizeSessionRuntime('node D:/a.mjs', '')
  assert.equal(noPath.replaced, false, 'execPath 取不到 ⇒ 不猜路径')
  assert.equal(
    noPath.cmd,
    'node D:/a.mjs',
    '取不到就原样交给 cmd,失败会如实落 session-failed 而不是被假运行时顶掉',
  )
  const abs = normalizeSessionRuntime('D:/already/node D:/a.mjs', 'D:/x/node.exe')
  assert.equal(abs.replaced, false, '已经写绝对路径的模板不得被二次改写')
})

test('⑮c 带空格的运行时必须加引号(cmd.exe 语义),且只加这一对', () => {
  const r = normalizeSessionRuntime('node D:/a.mjs --json', 'C:/Program Files/node.exe')
  assert.equal(r.cmd, '"C:/Program Files/node.exe" D:/a.mjs --json', `实得:${r.cmd}`)
  assert.equal((r.cmd.match(/"/g) || []).length, 2, '模板本身零内嵌引号是既有纪律,这里只许加一对')
})

test('⑮d 接线锁:真起子进程的两处都必须过归一,且读数进台账', () => {
  const src = readFileSync(new URL('../auto-evolve.mjs', import.meta.url), 'utf8')
  const n = (src.match(/normalizeSessionRuntime\(/g) || []).length
  assert.ok(
    n >= 3,
    `派发档 + probe 档两处调用 + 定义至少 3 处命中,实得 ${n} ⇒ 少一处就是那条通道仍依赖 PATH`,
  )
  assert.ok(
    /runtimeNormalized: res\.runtimeNormalized \?\? null/.test(src),
    '归一与否必须记进台账(否则下次只剩一个 exit=1 没人看得见成因)',
  )
})

/**
 * ⑯ 自我面闸(2026-11-05 立)。本器**从盘上被 spawn 运行**,而共享工作树里盘上那份可能是
 * 某席从旧基线改的半成品 —— 当次实测:工作树 2851 行 vs HEAD 2263 行,缺当天 7 条判据锚点。
 * 那种时刻照派 = 拿半成品当执行体。但判据只能看"回潮方向":盘上多出东西是常态(共树常年脏),
 * 若要求"盘必须等于 HEAD"就等于把自主环饿死 —— 所以超集必须放行。
 */
const INV_TEXT = JSON.stringify({
  entries: [
    {
      path: 'scripts/auto-evolve.mjs',
      anchors: ['alphaAnchor', 'betaAnchor'],
      why: '自我面核验用的样例锚点说明',
    },
  ],
})

test('⑯a 盘上缺 HEAD 已有的锚点 ⇒ stale-disk 并逐条点名', () => {
  const r = ae.judgeSelfFace({
    invariantsText: INV_TEXT,
    headText: 'x alphaAnchor y betaAnchor z',
    diskText: 'x alphaAnchor y —— 当天那枚判据没跟上来 z',
    selfRel: 'scripts/auto-evolve.mjs',
  })
  assert.equal(r.state, 'stale-disk')
  assert.deepEqual(r.missing, ['betaAnchor'], '只点名真缺的那条,不许把整张表甩出来')
  assert.match(r.why, /1\/2/, '读数要给出"缺几条/共几条"')
})

test('⑯b 三向不并桶:超集放行、任一面取不到未判定、清单无本器条目未判定', () => {
  const F = ae.judgeSelfFace
  const superset = F({
    invariantsText: INV_TEXT,
    headText: 'x alphaAnchor',
    diskText: 'x alphaAnchor y betaAnchor 别人今天新加的第三枚锚点',
    selfRel: 'scripts/auto-evolve.mjs',
  })
  assert.equal(superset.state, 'ok', '盘上是超集 ⇒ 照派(共树常年脏,要求"盘==HEAD"会饿死环)')
  assert.equal(
    F({ invariantsText: null, headText: 'x', diskText: 'x', selfRel: 'a' }).state,
    'undetermined',
    '清单取不到 ⇒ 不猜',
  )
  assert.equal(
    F({ invariantsText: INV_TEXT, headText: null, diskText: 'x', selfRel: 'a' }).state,
    'undetermined',
    'HEAD 面取不到 ⇒ 不猜',
  )
  assert.equal(
    F({ invariantsText: INV_TEXT, headText: 'x', diskText: null, selfRel: 'a' }).state,
    'undetermined',
    '盘上读不到 ⇒ 不猜',
  )
  assert.equal(
    F({ invariantsText: INV_TEXT, headText: 'x', diskText: 'x', selfRel: 'scripts/other.mjs' })
      .state,
    'undetermined',
    '清单里没有本器这一条 ⇒ 无从判落后,必须响而不是"没问题"',
  )
  assert.equal(
    F({
      invariantsText: '{坏 JSON',
      headText: 'x',
      diskText: 'x',
      selfRel: 'scripts/auto-evolve.mjs',
    }).state,
    'undetermined',
    '清单坏 ⇒ 未判定(不冒充"锚点齐")',
  )
})

test('⑯c 接线锁:自我面闸真在派发路径上,且两档都带 informational(不带就会把每张票推去 park)', () => {
  const src = readFileSync(new URL('../auto-evolve.mjs', import.meta.url), 'utf8')
  assert.ok(src.includes('const selfFace = readSelfFace()'), '派发路径必须真调自我面闸')
  assert.ok(
    src.includes("'runner-face-stale-disk'") && src.includes("'runner-face-undetermined'"),
    '两档都必须是字面量发射:模板串 `runner-face-${state}` 会让 C4「豁免须验过才免」拿不到可核对的串',
  )
  const gate = src.slice(
    src.indexOf('const selfFace = readSelfFace()'),
    src.indexOf('const res = dispatchSession'),
  )
  assert.ok(gate.includes('informational: true'), '自我面留痕必须标 informational ⇒ 不进空转阶梯')
  assert.ok(gate.includes("if (selfFace.state !== 'ok')"), 'ok 之外一律不派(含未判定)')
})

// ⑯d 接线锁(2026-11-05 立,治今天真发生的那一型):自我面闸必须读**锚点表**,
// 而不是长得更像"清单"的受保护面清单。今天 507043a 之前它一直喂 immutable-guard.json ⇒
// 每一轮都以"anchors 缺失或为空"未判定停派,而镜像夹具喂的本来就是对表 ⇒ 锁全绿、环长期不跑。
test('⑯d 锚点表接线锁:读错文件即翻红,且真表当场可解析并含本器条目', () => {
  const src = readFileSync(new URL('../auto-evolve.mjs', import.meta.url), 'utf8')
  const fn = src.slice(
    src.indexOf('function readSelfFace('),
    src.indexOf('export function parseSessionUsage'),
  )
  assert.ok(fn.length > 80, 'readSelfFace 本体必须取到(取不到 ⇒ 本锁红,不放行)')
  assert.ok(
    /HEAD:\$\{INV_SELF\.DATA_REL\}/.test(fn),
    '自我面必须从门 299 同一份锚点表取数(§0.6:不在本层声明第二个路径常量)',
  )
  assert.ok(
    !/HEAD:\$\{GUARD_LIST_REL\}/.test(fn),
    '自我面不得再读受保护面清单当锚点表(今天就是它把环长期钉在停派)',
  )
  const inv = JSON.parse(
    readFileSync(new URL('../data/autonomy-invariants.json', import.meta.url), 'utf8'),
  )
  const ent = (inv.entries || []).find((e) => e.path === 'scripts/auto-evolve.mjs')
  assert.ok(
    ent && Array.isArray(ent.anchors) && ent.anchors.length > 0,
    '真表里必须有本器条目与非空 anchors',
  )
  const r = ae.judgeSelfFace({
    invariantsText: JSON.stringify(inv),
    headText: src,
    diskText: src,
    selfRel: 'scripts/auto-evolve.mjs',
  })
  assert.equal(
    r.state,
    'ok',
    `真表现读判不出停派理由才对,实读:${r.state} ${String(r.why || '').slice(0, 90)}`,
  )
})

// ⑰ 会话终态分型改向(2026-11-05):exit=3 = CLI 的 no_progress,不是"发起腿故障"
test('⑰a 调度器拿到的分型是对的:rc=3 + 那行劫持诊断 ⇒ no-progress;同一份诊断 rc=0 ⇒ ok', () => {
  const HIJACK =
    '⚠ [security-scan] stop|workspace-aggregate-diff|status=undetermined: ' +
    'not-judged-safe | missing=untracked-files-over-cap(total=69, scanned=30)'
  assert.equal(classifySessionFailure({ status: 3, stderr: HIJACK }).kind, 'no-progress')
  assert.equal(classifySessionFailure({ status: 0, stderr: HIJACK }).kind, 'ok')
})

test('⑰b session-no-progress 归空转集(它确实吃掉班次),且不许同时是推进档', () => {
  assert.ok(
    NON_PROGRESS_ACTIONS.includes('session-no-progress'),
    '零推进必须计入空转阶梯(rotate/park)',
  )
  assert.ok(!PROGRESS_ACTIONS.includes('session-no-progress'), '同一枚不许两档(计推进就等于没修)')
})

test('⑰c 接线锁:字面量发射 + 排在连败块之前(走连败=给零推进开了一条封票通道)', () => {
  const src = readFileSync(new URL('../auto-evolve.mjs', import.meta.url), 'utf8')
  assert.ok(
    src.includes(`action = kind.kind === 'no-progress' ? 'session-no-progress' : 'session-failed'`),
    '派发腿必须按分型发射字面量(模板串会被 C4「豁免须验过才免」判成收不到)',
  )
  const iNo = src.indexOf("if (res.action === 'session-no-progress')")
  const iFail = src.indexOf(
    "if (res.action === 'session-failed' || res.action === 'session-timeout')",
  )
  assert.ok(iNo > 0 && iFail > 0 && iNo < iFail, '零推进档必须短路在连败封票之前')
  assert.ok(src.slice(iNo, iFail).includes('return'), '那一档只 return,不许顺手把票计进连败')
})

// ── Ⓐ–Ⓓ 票面范围预解析(2026-11-05 立)──
// 立因:68 份派发转录写类命中 0;今天那班(票 P85)被派去"新增" compute_simhash,
// 而 HEAD 面 `git grep` 现读它已在 rename_detect.py 等处存在 —— 会话一路只读到 end_turn。
// 这一族钉的是"调度侧把查得到的事实先交给会话",不是给会话加散文规矩(散文规矩实测挡不住)。
const SCOPE_TEXT =
  'P85 代码检索改名检测:对侧把 `compute_simhash`/`hamming_distance` 作为一等导出、而 `diffTree` 只有三桶 ⇒ ' +
  '本仓在 `codebase_indexer` 的快照差集上补一枚改名候选;改 `apps/ai-service/app/services/x.py` 与 `docs/README.md`,还有 `odd 短` 和 `abc`'

test('Ⓐ 抽提示:只抽代码标识符与带扩展名路径,散文/中文/短词不进', () => {
  const h = ae.extractTicketScopeHints(SCOPE_TEXT)
  assert.deepEqual(h.idents, [
    'compute_simhash',
    'hamming_distance',
    'diffTree',
    'codebase_indexer',
  ])
  assert.deepEqual(
    h.paths,
    ['apps/ai-service/app/services/x.py', 'docs/README.md'],
    '路径按出现顺序',
  )
  assert.ok(!h.idents.includes('abc'), '3 字符及以下不当标识符(噪声)')
  assert.ok(!h.idents.some((x) => x.includes(' ')), '带空格的整段散文不抽')
  const capped = ae.extractTicketScopeHints(
    '`aaaa_b` `cccc_d` `eeee_f` `gggg_h` `iiii_j` `kkkk_l`',
    {
      maxIdents: 2,
    },
  )
  assert.deepEqual(capped.idents, ['aaaa_b', 'cccc_d'], '上限照收,不静默多抽')
  assert.deepEqual(ae.extractTicketScopeHints(''), { idents: [], paths: [] }, '空票面不炸')
})

test('Ⓑ 三态分开:权威"没有"、真没查到、预算用尽——三档形态互不可挪用', () => {
  const F = ae.buildTicketScope
  const ok = F(SCOPE_TEXT, {
    rev: 'r1',
    grepFn: () =>
      `r1:apps/ai-service/app/services/rename_detect.py\nr1:PROJECT_PLAN.md\nr1:scripts/data/p.jsonl\nr1:.archify/a/candidate.json`,
    existsFn: () => true,
  })
  assert.equal(ok.hits.length, 4)
  assert.deepEqual(
    ok.hits[0].files,
    ['apps/ai-service/app/services/rename_detect.py'],
    '剥 HEAD: 前缀并排掉 *.md/*.jsonl/.archify',
  )
  assert.deepEqual(ok.presentPaths, ['apps/ai-service/app/services/x.py', 'docs/README.md'])
  assert.equal(ok.undetermined.length, 0)

  // 取数口答"确实没有"(git grep 退出码 1 ⇒ 空串):算 unresolved,**不**算未判定
  const none = F(SCOPE_TEXT, { rev: 'r2', grepFn: () => '', existsFn: () => false })
  assert.equal(none.hits.length, 0)
  assert.deepEqual(none.unresolved, [
    'compute_simhash',
    'hamming_distance',
    'diffTree',
    'codebase_indexer',
  ])
  assert.equal(none.undetermined.length, 0, '权威否定不许混进"未判定"')
  assert.deepEqual(none.absentPaths, ['apps/ai-service/app/services/x.py', 'docs/README.md'])

  // 取数口没答(null):逐枚点名未判定,而不是折成"没有"
  const blind = F(SCOPE_TEXT, { rev: 'r3', grepFn: () => null, existsFn: () => null })
  assert.equal(blind.hits.length, 0)
  assert.equal(blind.unresolved.length, 4)
  assert.equal(blind.undetermined.length, 6, '4 枚标识符 + 2 条路径存在性都没答 ⇒ 逐条点名')
  assert.ok(
    blind.undetermined.every((x) => x.includes('未')),
    '未判定字样必须出现在每一条',
  )

  // 预算闸:越过预算的余下枚逐条点名"未查",且不冒充 hits/unresolved
  let clock = 0
  const over = F(SCOPE_TEXT, {
    rev: 'r4',
    budgetMs: 10,
    now: () => clock,
    grepFn: () => {
      clock += 7
      return 'r4:a.py'
    },
    existsFn: () => true,
  })
  assert.ok(over.hits.length <= 2, '预算内只查得动前两枚')
  assert.ok(
    over.undetermined.some((x) => /预算.*未查/.test(x)),
    '查不完的必须点名"预算已用尽"',
  )
})

test('Ⓒ 文案:命中即讲"可能已实现、不要重写、不记完成";无命中讲"按票面新建"', () => {
  const withHits = ae.renderTicketScope(
    ae.buildTicketScope(SCOPE_TEXT, { rev: 'r', grepFn: () => 'r:s/a.py', existsFn: () => true }),
  )
  assert.match(withHits, /已被实现/)
  assert.match(withHits, /不要再写第二份/)
  assert.match(withHits, /不会被记成完成/, '不许给会话留"报了就算做完"的错觉')
  assert.match(withHits, /调度侧在 r 面现查/, '取材面必须署名到那一枚提交')

  const empty = ae.renderTicketScope(
    ae.buildTicketScope('本票没有任何反引号', {
      rev: 'r',
      grepFn: () => 'x',
      existsFn: () => true,
    }),
  )
  assert.match(empty, /无结论/, '没抽到标识符 ⇒ 说"本表无结论",而不是替票面下结论')
  assert.ok(!/确实尚不存在/.test(empty), '一枚都没查时不许冒"确实不存在"(§0.3)')
  assert.ok(!/已被实现/.test(empty), '没命中不许冒"已实现"')

  const partial = ae.renderTicketScope(
    ae.buildTicketScope(SCOPE_TEXT, { rev: 'r', grepFn: () => null, existsFn: () => null }),
  )
  assert.match(partial, /没答全/, '没答全时不许冒"确实尚不存在"')
  assert.match(partial, /未判定/, '没答的部分要单独成行')
  assert.ok(!/确实尚不存在/.test(partial), '未判定与"权威没有"两种形态互不可挪用')
})

test('Ⓓ 接线锁:范围表真进派发 prompt,不是造好没装车(§0.9)', () => {
  const src = readFileSync(new URL('../../scripts/auto-evolve.mjs', import.meta.url), 'utf8')
  assert.ok(/renderTicketScope\(scope\)/.test(src), 'promptText 里必须拼进范围表')
  assert.ok(/const scope = buildTicketScope\(ticket\.text/.test(src), '范围表按当次票面现算')
  const iRev = src.indexOf('const revForScope = headShaOf()')
  const iScope = src.indexOf('const scope = buildTicketScope(')
  assert.ok(
    iRev > 0 && iScope > iRev,
    '先取那一枚提交,再在它上面查(不在 HEAD 上查会读到别席刚推进的面)',
  )
  assert.ok(
    /仓根唯一取值\(调度侧现读\)/.test(src),
    '盘符事实必须写进 prompt:转录实测有会话按 G:/ 找文件',
  )
})

// ── Ⓔ–Ⓖ 旗标纪律(2026-11-05 立)──
// 立因:本器没有 --help 档,"问一次用法"= 真跑一轮(实测:读阀 + 分诊轮 + 写台账 + 占派发额度)。
// 而改成"未知旗标即拒绝"之前必须先量收发射点 —— 守护侧真传 `--once --no-triage`,
// `--once` 从未被认识过,一直靠静默忽略活着;照字面拒绝会当场冻住生产派发腿(自伤形态)。
const REPO = fileURLToPath(new URL('../../', import.meta.url))
const LEDGER_PATH = new URL('../../.ihui-agent/state/auto-evolve-ledger.jsonl', import.meta.url)
const ledgerLines = () => {
  try {
    return readFileSync(LEDGER_PATH, 'utf8').split(/\r?\n/).filter(Boolean).length
  } catch {
    return 0
  }
}
const runCli = (argv) =>
  spawnSync(process.execPath, [join('scripts', 'auto-evolve.mjs'), ...argv], {
    cwd: REPO,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  })

test('Ⓔ 清单必须覆盖发射侧真传的 argv(少一枚就冻腿,红要落在加旗标那一枚)', () => {
  const known = ae.knownFlags()
  const guardian = readFileSync(new URL('../../scripts/git-guardian.mjs', import.meta.url), 'utf8')
  const m = guardian.match(
    /spawn\(\s*process\.execPath,\s*\[\s*script,\s*'(--[a-z-]+)'(?:,\s*'(--[a-z-]+)')?\s*\]/,
  )
  assert.ok(m, '取不到守护侧 argv ⇒ 本锁空转,必须喊响而不是默认通过')
  const passed = m.slice(1).filter(Boolean)
  for (const f of passed) assert.ok(known.includes(f), `守护侧传了 ${f} 而清单没有 ⇒ 生产腿会被拒`)
  assert.deepEqual(
    passed.slice().sort(),
    ['--no-triage', '--once'],
    '守护侧 argv 形态变了要同步本锁',
  )
})

test('Ⓕ --help 打用法且一个动作都不跑(台账行数逐枚核过,不靠推断)', () => {
  const before = ledgerLines()
  const r = runCli(['--help'])
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /usage: node scripts\/auto-evolve\.mjs/)
  assert.match(r.stdout, /认识的全部旗标:/)
  assert.equal(ledgerLines(), before, '--help 不许往台账写一行(写了就是真跑了轮)')
  const h = runCli(['-h'])
  assert.equal(h.status, 0, h.stderr)
  assert.equal(ledgerLines(), before, '-h 同样不许跑轮')
})

test('Ⓖ 未知旗标 ⇒ exit 2 并点名,不跑轮也不静默忽略', () => {
  const before = ledgerLines()
  const r = runCli(['--hel']) // 手滑形态:今天真踩过的那一次
  assert.equal(r.status, 2, `期望 2,实得 ${r.status}:${r.stdout}`)
  assert.match(r.stderr, /不认识旗标 --hel/)
  assert.match(r.stderr, /usage:/)
  assert.equal(ledgerLines(), before, '未知旗标那一次也不许写台账(写了=轮真跑了)')
  for (const f of ['--once', '--no-triage'])
    assert.ok(ae.knownFlags().includes(f), `生产旗标 ${f} 必须在清单里,否则本改动就是冻腿的那一刀`)
})

test('Ⓗ 池可赢性:四档互斥 + 没核完如实报"未核" + 只挂在停派出口(§0.3)', () => {
  const F = ae.readPoolWinnability
  const rows = [
    { text: '`aaa_bbb` 补一枚新判据' },
    { text: '这行没有任何反引号标识符' },
    { text: '`ccc_ddd` 另一枚可新建的' },
    { text: '`eee_fff` 超出上限的第一枚' },
    { text: '`ggg_hhh` 超出上限的第二枚' },
  ]
  const t = F(rows, { rev: 'r1', grepFn: (i) => (i === 'aaa_bbb' ? 'r1:apps/x/y.py' : ''), max: 3 })
  assert.deepEqual(
    [t.疑已实现, t.无从预检, t.可新建, t.未判定, t.未核],
    [1, 1, 1, 0, 2],
    '前三枚核过并各归一档,后两枚必须记"未核",不许拿前 3 枚冒充整池',
  )
  // 取数口没答 ⇒ 未判定一档,且仍未核数如实
  const blind = F(rows, { rev: 'r2', grepFn: () => null, max: 1 })
  assert.equal(blind.未判定, 1)
  assert.equal(blind.未核, 4)
  assert.equal(blind.可新建, 0, '没答上来时不许冒"可新建"')
  assert.deepEqual(F([], { rev: 'r3' }), {
    可新建: 0,
    疑已实现: 0,
    无从预检: 0,
    未判定: 0,
    未核: 0,
  })
  const src = readFileSync(new URL('../../scripts/auto-evolve.mjs', import.meta.url), 'utf8')
  assert.match(
    src,
    /willNotDispatch[\s\S]{0,220}poolWinnabilityNote\(rows\.filter\([\s\S]{0,120}matchWhitelist/,
    '读数只挂在"本轮不派"的出口,且**按派发侧同一张白名单**收窄 —— 把不会派的行算进来会读出没决策价值的数',
  )
  assert.match(
    src,
    /rows\.length === 0 \|\| dispatched >= gates\.dailyDispatchBudget/,
    '不派的两档都要算到',
  )
})

test('Ⓙ 点号成员引用与裸点文件都能被预检(补 P84 暴露的仪器盲点)', () => {
  const h = ae.extractTicketScopeHints(
    '枚举过 `ignore_rules.filter_paths`,三层引用 `a.b.c.d`;还有 `.gitignore` 与 `apps/x/y.py`;噪声 `id` 与 `id.other`',
  )
  assert.deepEqual(h.idents, ['ignore_rules.filter_paths'], '点号引用算标识符(旧实现两类都不认)')
  assert.ok(
    !h.idents.includes('a.b.c.d'),
    '尾段只有 1 字符 ⇒ 查它会捞一片假命中,不算标识符(假阳比漏判更坏)',
  )
  assert.deepEqual(h.paths, ['.gitignore', 'apps/x/y.py'], '裸点文件按存在性核,不当标识符')
  assert.ok(
    !h.idents.includes('id.other') && !h.idents.includes('id'),
    '首段短于 3 字符的点号串仍是噪声,不放宽',
  )

  const s = ae.buildTicketScope('枚举过 `ignore_rules.filter_paths`', {
    rev: 'r9',
    // 全串搜不到、末段搜得到 —— 代码里 import 末段名的真实形态
    grepFn: (k) =>
      k === 'filter_paths' ? 'r9:apps/ai-service/app/services/ignore_rules.py\nr9:notes.md' : '',
    existsFn: () => false,
  })
  assert.equal(s.identCount, 1)
  assert.equal(s.hits.length, 1, '按末段核到 ⇒ 不再被读成"无从预检"')
  assert.equal(s.hits[0].ident, 'ignore_rules.filter_paths', '标签保留点号全称')
  assert.equal(s.hits[0].via, 'tail', '换过查询体就必须声明是末段命中,不冒充全串命中')
  assert.deepEqual(s.hits[0].files, ['apps/ai-service/app/services/ignore_rules.py'])
  assert.match(ae.renderTicketScope(s), /点号引用按末段核/)

  // 反向对照:全串就能命中时 via 必须是 exact(不被 tail 档掩盖)
  const e = ae.buildTicketScope('新增 `compute_simhash`', {
    rev: 'r10',
    grepFn: () => 'r10:a/b.py',
    existsFn: () => true,
  })
  assert.equal(e.hits[0].via, 'exact')
  assert.ok(!/点号引用按末段核/.test(ae.renderTicketScope(e)), 'exact 命中不许冒"末段核"的说明')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
