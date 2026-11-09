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
import { __test__ as ae, gateTicketByHumanValve, VALVE_LIST_JSON } from '../auto-evolve.mjs'
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
  assert.ok(continueIdx > skipIdx && dispatchIdx > continueIdx, '跳过必须真 continue,且不落到 dispatchSession')
  assert.ok(src.includes('valve-observe-stop(skip)'), '日志要能一眼分清"停机未派"')
  assert.ok(src.includes('gateTicketByHumanValve({'), 'A6 依赖的阀调用点不许搬走')
})


/**
 * ⑪ 判据面闸(2026-11-04 立):自治环落账腿必须整批拒收命中受保护面的产物,
 * 因为会话侧没有豁免签名权 —— 替它补一行 immutable-exempt 等于自己给自己发豁免。
 * 匹配判据一律走 lib/immutable-guard.mjs(本文件零复算),这里只钉"接线与方向"。
 */
const GUARD_LIST_TEXT = readFileSync(new URL('../data/immutable-guard.json', import.meta.url), 'utf8')
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
  for (const f of ['scripts/check-demo.mjs', 'scripts/lib/demo.mjs', 'scripts/guardian-runner.mjs', 'scripts/data/demo-exemptions.json']) {
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
