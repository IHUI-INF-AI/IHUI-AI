// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 服务与配置面判据的回归网(2026-11-25 立,第十九件)。
 *
 * 这一套里大部分用例钉的都是「本模块曾经搞反过的地方」,不是教科书式的边界:
 *   ① SECRET 字样出现在开关名里,一脱敏就把关键开关变成指纹、每轮误报;
 *   ② env 是两层结构(服务 → 变量),浅比较只比到「服务名在不在」,变量值改了看不见;
 *   ③ IHUI-API-ROUTER 只监听回环,observe 是分层设计而非缺口 —— 一刀切要求 enforce 会误报。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  judgeServiceDrift,
  remediationForService,
  normalizeEntry,
  fingerprint,
  isSecretKey,
  parseEnvBlock,
  sanitizeEnv,
  flattenEnv,
  diffEnv,
  normalizeListeners,
  partitionListeners,
  criticalEnvViolations,
  SERVICE_STATE,
  SERVICE_CLASSES,
  CRITICAL_ENV,
  DYNAMIC_PORT_FROM,
  IGNORED_PORTS,
  OBSERVED_ONLY_PROCS,
  SECRET_ENV_RE,
  SWITCH_SUFFIX_RE,
} from '../security/lib/service-drift.mjs'

/**
 * 快照夹具。
 *
 * 默认带上一个「关键开关全部合规」的 WEB-ROUTER 与 API-ROUTER —— 真实快照里这两个服务
 * 一定在,不带的话每条用例都会先被「关键变量缺失 ⇒ breach」拦掉,测不到本来要测的东西。
 * 需要测违规的用例自己覆盖对应服务,并写全该服务的所有关键键。
 */
function snap(o = {}) {
  return {
    'service-env': {
      'IHUI-WEB-ROUTER': { IHUI_EDGE_SECRET_MODE: 'enforce', IHUI_WAF_MODE: 'enforce' },
      'IHUI-API-ROUTER': { IHUI_EDGE_SECRET_MODE: 'observe', IHUI_WAF_MODE: 'enforce' },
      ...(o['service-env'] ?? {}),
    },
    'service-start': o['service-start'] ?? {},
    'external-port': o['external-port'] ?? [],
  }
}

/* ── 键名分类:这条搞反会让整件失效 ─────────────────────────── */

test('isSecretKey: 含 SECRET 但以 _MODE 结尾的是开关,不是凭据', () => {
  assert.equal(isSecretKey('IHUI_EDGE_SECRET'), true)
  assert.equal(isSecretKey('IHUI_EDGE_SECRET_MODE'), false)
  assert.equal(isSecretKey('IHUI_WAF_MODE'), false)
  assert.equal(isSecretKey('IHUI_ADMIN_PASSWORD'), true)
  assert.equal(isSecretKey('API_TOKEN'), true)
  assert.equal(isSecretKey('IHUI_NOTICE_FULL_RPS'), false)
})

test('isSecretKey: 开关后缀族齐全,新增档位不会漏', () => {
  for (const k of ['X_MODE', 'X_ENABLED', 'X_TYPE', 'X_LEVEL', 'X_POLICY', 'X_STRATEGY', 'X_RPS']) {
    assert.match(k, SWITCH_SUFFIX_RE, `${k} 应被识别为开关`)
  }
  assert.match('MY_SECRET', SECRET_ENV_RE)
})

/* ── 解析与脱敏 ─────────────────────────────────────────────── */

test('parseEnvBlock: 空行分隔(本机实测形态)解析正确', () => {
  const pairs = parseEnvBlock('A=1\n\nB=2\n\nC=3')
  assert.equal(pairs.length, 3)
  assert.deepEqual(pairs.map((p) => p.key), ['A', 'B', 'C'])
})

test('parseEnvBlock: CRLF 与单 CR 两种分隔同样认(换机不静默解析成 0 个键)', () => {
  assert.equal(parseEnvBlock('A=1\r\n\r\nB=2').length, 2)
  assert.equal(parseEnvBlock('A=1\rB=2').length, 2)
})

test('parseEnvBlock: 值里带等号时只按第一个等号切', () => {
  const p = parseEnvBlock('A=a=b=c')
  assert.equal(p[0].key, 'A')
  assert.equal(p[0].value, 'a=b=c')
})

test('sanitizeEnv: 凭据只留指纹,开关保留原值', () => {
  const s = sanitizeEnv(parseEnvBlock('IHUI_EDGE_SECRET=topsecret\n\nIHUI_EDGE_SECRET_MODE=enforce'))
  assert.match(s.IHUI_EDGE_SECRET, /^sha256:[0-9a-f]{16}$/)
  assert.equal(s.IHUI_EDGE_SECRET_MODE, 'enforce')
  /* 原值绝不能出现在结果里的任何位置 */
  assert.ok(!JSON.stringify(s).includes('topsecret'))
})

test('fingerprint: 空值返回 null,不产生「设了一个空值」的假指纹', () => {
  assert.equal(fingerprint(''), null)
  assert.equal(fingerprint('   '), null)
  assert.equal(fingerprint(null), null)
  assert.equal(fingerprint('x').length, 16)
})

/* ── 两层结构必须拍平 ───────────────────────────────────────── */

test('flattenEnv: 服务名与变量名合成一个键', () => {
  const flat = flattenEnv({ S1: { A: '1' }, S2: { B: '2' } })
  assert.deepEqual(flat, { 'S1|A': '1', 'S2|B': '2' })
})

test('diffEnv+flatten: 深层变量值变化必须被发现(浅比较会漏)', () => {
  const base = flattenEnv({ S1: { A: '1', B: '2' } })
  const cur = flattenEnv({ S1: { A: '1', B: 'CHANGED' } })
  const d = diffEnv(base, cur)
  assert.deepEqual(d.changed, ['S1|B'])
  /* 反证:不拍平时比的是服务名,一个差异都看不出来 */
  const shallow = diffEnv({ S1: { A: '1', B: '2' } }, { S1: { A: '1', B: 'CHANGED' } })
  assert.equal(shallow.changed.length, 0)
})

/* ── 端口面 ────────────────────────────────────────────────── */

test('normalizeListeners: 只留 0.0.0.0 且固定段', () => {
  const out = normalizeListeners([
    '0.0.0.0:8801', '127.0.0.1:8802', '192.168.1.37:7800',
    '0.0.0.0:49664', '0.0.0.0:445', '0.0.0.0:22', '0.0.0.0:8805',
  ])
  assert.deepEqual(out, [8801, 8805])
})

test('normalizeListeners: 已登记的高位固定端口(53389)不因落进动态段被误报', () => {
  assert.ok(IGNORED_PORTS.has(53389))
  assert.ok(53389 >= DYNAMIC_PORT_FROM, '前提:53389 确实落在动态段中间')
  assert.deepEqual(normalizeListeners(['0.0.0.0:53389', '0.0.0.0:8801']), [8801])
})

test('normalizeListeners: 去重并升序', () => {
  assert.deepEqual(normalizeListeners(['0.0.0.0:8805', '0.0.0.0:8801', '0.0.0.0:8801']), [8801, 8805])
})

/* ── 端口分流:按进程名而不是端口号 ─────────────────────────── */

test('partitionListeners: 第三方软件的随机端口进 observed,不进 tracked', () => {
  const { tracked, observed } = partitionListeners([
    { addr: '0.0.0.0:8801', proc: 'node' },
    { addr: '0.0.0.0:38099', proc: '微信开发者工具' },
    { addr: '0.0.0.0:5130', proc: 'spoolsv' },
    { addr: '127.0.0.1:8802', proc: 'node' },
  ])
  assert.deepEqual(tracked, [5130, 8801])
  assert.deepEqual(observed, [38099])
})

test('partitionListeners: 同一进程换端口仍稳定归 observed(这是按端口号拉黑追不上的原因)', () => {
  const a = partitionListeners([{ addr: '0.0.0.0:11940', proc: '微信开发者工具' }])
  const b = partitionListeners([{ addr: '0.0.0.0:38099', proc: '微信开发者工具' }])
  assert.deepEqual(a.tracked, [])
  assert.deepEqual(b.tracked, [])
  assert.equal(a.observed.length, 1)
  assert.equal(b.observed.length, 1)
})

test('partitionListeners: 进程名取不到时按受管处理(宁可多报一次,不漏报)', () => {
  const { tracked, observed } = partitionListeners([{ addr: '0.0.0.0:9999', proc: '' }])
  assert.deepEqual(tracked, [9999])
  assert.deepEqual(observed, [])
})

test('partitionListeners: 回环/内网/动态段/已登记端口全部不参与', () => {
  const { tracked } = partitionListeners([
    { addr: '127.0.0.1:8802', proc: 'node' },
    { addr: '192.168.1.37:7800', proc: 'java' },
    { addr: '0.0.0.0:49664', proc: 'svchost' },
    { addr: '0.0.0.0:53389', proc: 'svchost' },
    { addr: '0.0.0.0:22', proc: 'sshd' },
  ])
  assert.deepEqual(tracked, [])
})

/* ── 关键开关:按服务判,不一刀切 ─────────────────────────── */

test('criticalEnvViolations: WEB-ROUTER 的守卫改 observe 必须报', () => {
  const bad = criticalEnvViolations({
    'IHUI-WEB-ROUTER': { IHUI_EDGE_SECRET_MODE: 'observe', IHUI_WAF_MODE: 'enforce' },
    'IHUI-API-ROUTER': { IHUI_EDGE_SECRET_MODE: 'observe', IHUI_WAF_MODE: 'enforce' },
  })
  assert.equal(bad.length, 1)
  assert.equal(bad[0].service, 'IHUI-WEB-ROUTER')
  assert.equal(bad[0].key, 'IHUI_EDGE_SECRET_MODE')
  assert.equal(bad[0].expect, 'enforce')
})

test('criticalEnvViolations: API-ROUTER 的守卫是 observe 不算违规(分层设计)', () => {
  const bad = criticalEnvViolations({
    'IHUI-WEB-ROUTER': { IHUI_EDGE_SECRET_MODE: 'enforce', IHUI_WAF_MODE: 'enforce' },
    'IHUI-API-ROUTER': { IHUI_EDGE_SECRET_MODE: 'observe', IHUI_WAF_MODE: 'enforce' },
  })
  assert.equal(bad.length, 0)
})

test('criticalEnvViolations: 关键变量被整条删掉,等于被改掉', () => {
  /* WEB-ROUTER 缺 2 项 + API-ROUTER 缺 1 项 = 3 */
  const bad = criticalEnvViolations({ 'IHUI-WEB-ROUTER': {}, 'IHUI-API-ROUTER': {} })
  assert.equal(bad.length, 3)
  assert.ok(bad.every((b) => b.actual === null))
})

test('criticalEnvViolations: 受管服务整个不在快照里,同样按缺失报', () => {
  const bad = criticalEnvViolations({})
  assert.equal(bad.length, 3)
})

test('CRITICAL_ENV: 每条都写明为什么这个服务必须 enforce', () => {
  assert.ok(CRITICAL_ENV.length >= 3)
  assert.ok(CRITICAL_ENV.every((c) => c.service && c.key && c.expect && c.why && c.why.length >= 6))
})

/* ── 总判定 ────────────────────────────────────────────────── */

test('judgeServiceDrift: 无基线 ⇒ undetermined,不记绿', () => {
  const r = judgeServiceDrift({
    baseline: null,
    current: snap({
      'service-env': { S: { A: '1' } },
      'service-start': { 'S|Start': 'SERVICE_AUTO_START' },
      'external-port': [8801],
    }),
  })
  assert.equal(r.state, SERVICE_STATE.UNDETERMINED)
  assert.match(r.reason, /没有基线/)
})

test('judgeServiceDrift: 关键开关违规优先于「无基线」', () => {
  const r = judgeServiceDrift({
    baseline: null,
    current: snap({ 'service-env': { 'IHUI-WEB-ROUTER': { IHUI_WAF_MODE: 'off' } } }),
  })
  assert.equal(r.state, SERVICE_STATE.BREACH)
  assert.match(r.reason, /关键防线开关被改松/)
})

test('judgeServiceDrift: 与基线一致 ⇒ ok', () => {
  const b = snap({
    'service-env': { 'IHUI-WEB-ROUTER': { IHUI_WAF_MODE: 'enforce', IHUI_EDGE_SECRET_MODE: 'enforce' } },
    'service-start': { 'IHUI-WEB-ROUTER|Start': 'SERVICE_AUTO_START' },
    'external-port': [8801],
  })
  const r = judgeServiceDrift({ baseline: b, current: JSON.parse(JSON.stringify(b)) })
  assert.equal(r.state, SERVICE_STATE.OK)
  assert.equal(r.addedAll.length, 0)
})

test('judgeServiceDrift: 新开一个对外端口 ⇒ breach', () => {
  const b = snap({ 'external-port': [8801] })
  const c = snap({ 'external-port': [8801, 9999] })
  const r = judgeServiceDrift({ baseline: b, current: c })
  assert.equal(r.state, SERVICE_STATE.BREACH)
  assert.deepEqual(r.addedAll, ['port:9999'])
})

test('judgeServiceDrift: 启动类型被改成手动 ⇒ breach(重启起不来)', () => {
  const b = snap({ 'service-start': { 'S|Start': 'SERVICE_AUTO_START' } })
  const c = snap({ 'service-start': { 'S|Start': 'SERVICE_DEMAND_START' } })
  const r = judgeServiceDrift({ baseline: b, current: c })
  assert.equal(r.state, SERVICE_STATE.BREACH)
  assert.deepEqual(r.addedAll, ['start:S|Start'])
})

test('judgeServiceDrift: 端口消失只点名不阻断', () => {
  const b = snap({ 'external-port': [8801, 9999] })
  const c = snap({ 'external-port': [8801] })
  const r = judgeServiceDrift({ baseline: b, current: c })
  assert.equal(r.state, SERVICE_STATE.OK)
  assert.deepEqual(r.removedAll, ['port:9999'])
})

test('judgeServiceDrift: 三面全采空 ⇒ undetermined,不是「干净」', () => {
  /* 这里刻意用裸空快照(绕过 snap 的默认合规服务):模拟采集全失败的真实现场 */
  const r = judgeServiceDrift({
    baseline: { 'service-env': {}, 'service-start': {}, 'external-port': [] },
    current: { 'service-env': {}, 'service-start': {}, 'external-port': [] },
  })
  assert.equal(r.state, SERVICE_STATE.UNDETERMINED)
  assert.equal(r.totalCurrent, 0)
})

test('三个受管面就是 env/start/port', () => {
  assert.deepEqual(SERVICE_CLASSES.map((c) => c.id), ['service-env', 'service-start', 'external-port'])
})

/* ── 处置建议 ─────────────────────────────────────────────── */

test('remediationForService: 新端口给「找 pid → 查进程」的具体路径', () => {
  const r = judgeServiceDrift({ baseline: snap({ 'external-port': [8801] }), current: snap({ 'external-port': [8801, 9999] }) })
  const steps = remediationForService(r)
  assert.equal(steps.length, 1)
  assert.match(steps[0], /netstat -ano/)
  assert.match(steps[0], /9999/)
})

test('remediationForService: 启动项变更点名「重启该服务不会自己起来」', () => {
  const r = judgeServiceDrift({ baseline: snap({ 'service-start': { 'S|Start': 'SERVICE_AUTO_START' } }), current: snap({ 'service-start': { 'S|Start': 'SERVICE_DEMAND_START' } }) })
  const steps = remediationForService(r)
  assert.match(steps[0], /nssm get <svc> Start/)
})

test('normalizeEntry: 空白归一', () => {
  assert.equal(normalizeEntry('  a   b  '), 'a b')
  assert.equal(normalizeEntry(null), '')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
