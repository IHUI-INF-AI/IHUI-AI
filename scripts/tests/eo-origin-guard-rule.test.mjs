// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * EdgeOne 回源鉴权规则落器的判据锁(2026-10-29)。
 *
 * 这一族的错法都是「云端已经改错了但本地看不出来」,所以每条都配反向对照:
 *   · 条件少枚举一个域名 ⇒ 那个域名的流量在 enforce 后整站 403;
 *   · 密钥不同却判「已就绪」⇒ 源站永远 match 不上,而脚本报绿;
 *   · 多挂一个动作还判就绪 ⇒ 规则被改脏了却没人发现;
 *   · 取不到密钥/凭据时硬建 ⇒ 建出一条空密钥的规则,等于把守卫拆了。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as g } from '../eo-origin-guard-rule.mjs'

const SECRET = 'k-test-secret-value'

function ruleWith({ condition, name = 'ModifyRequestHeader', headerName = 'X-IHUI-Edge-Secret', value = SECRET, action = 'set', status = 'enable' } = {}) {
  return {
    RuleId: 'rule-x',
    RuleName: 'origin-guard-edge-secret',
    Status: status,
    Branches: [{
      Condition: condition,
      Actions: [{
        Name: name,
        ModifyRequestHeaderParameters: { HeaderActions: [{ Action: action, Name: headerName, Value: value }] },
      }],
    }],
  }
}

test('buildCondition:单域名/多域名都按单引号数组', () => {
  assert.equal(g.buildCondition(['www.aizhs.top']), "${http.request.host} in ['www.aizhs.top']")
  assert.equal(g.buildCondition(['a.top', 'b.top']), "${http.request.host} in ['a.top', 'b.top']")
})

test('ruleIsCurrent:条件/动作/密钥三者全等才算就绪', () => {
  const domains = ['www.aizhs.top']
  const cond = g.buildCondition(domains)
  assert.equal(g.ruleIsCurrent(ruleWith({ condition: cond }), domains, SECRET), true)

  // 反向:少一个域名
  assert.equal(g.ruleIsCurrent(ruleWith({ condition: "${http.request.host} in ['other.top']" }), domains, SECRET), false)
  // 反向:密钥不同
  assert.equal(g.ruleIsCurrent(ruleWith({ condition: cond, value: 'other' }), domains, SECRET), false)
  // 反向:动作不是 ModifyRequestHeader
  assert.equal(g.ruleIsCurrent(ruleWith({ condition: cond, name: 'Cache' }), domains, SECRET), false)
  // 反向:头部操作不是 set(增加会重复,删除等于拆守卫)
  assert.equal(g.ruleIsCurrent(ruleWith({ condition: cond, action: 'add' }), domains, SECRET), false)
  // 反向:头名不同
  assert.equal(g.ruleIsCurrent(ruleWith({ condition: cond, headerName: 'X-Other' }), domains, SECRET), false)
})

test('ruleIsCurrent:多挂动作判不就绪(规则被改脏必须被发现)', () => {
  const domains = ['www.aizhs.top']
  const r = ruleWith({ condition: g.buildCondition(domains) })
  r.Branches[0].Actions.push({ Name: 'Cache', CacheParameters: {} })
  assert.equal(g.ruleIsCurrent(r, domains, SECRET), false)
})

test('resolveEdgeSecret:env 优先,source 里不含密钥值', () => {
  const out = g.resolveEdgeSecret({ IHUI_EDGE_SECRET: SECRET })
  assert.deepEqual(out, { secret: SECRET, source: 'env:IHUI_EDGE_SECRET' })
  assert.ok(!out.source.includes(SECRET))
})

test('resolveEdgeSecret:env 缺失且 envFile 不存在时绝不给空串', () => {
  const out = g.resolveEdgeSecret({}, 'Z:\\\\definitely-not-exists\\\\.env')
  if (out) assert.ok(String(out.secret).length > 0)
  else assert.equal(out, null)
})

test('run 只读档:规则缺失 ⇒ drift rule-missing', async () => {
  const out = await g.run({ mode: 'check', cred: { id: 'x', key: 'y' }, secretInfo: { secret: SECRET, source: 't' }, teo: fakeTeo([]) })
  assert.equal(out.state, 'drift')
  assert.equal(out.reason, 'rule-missing')
})

test('run 只读档:规则已就绪 ⇒ ok in-sync', async () => {
  const cond = g.buildCondition(['www.aizhs.top'])
  const out = await g.run({ mode: 'check', cred: { id: 'x', key: 'y' }, secretInfo: { secret: SECRET, source: 't' }, teo: fakeTeo([ruleWith({ condition: cond })]) })
  assert.equal(out.state, 'ok')
  assert.equal(out.reason, 'in-sync')
})

test('run 只读档:规则存在但被停用 ⇒ drift', async () => {
  const cond = g.buildCondition(['www.aizhs.top'])
  const out = await g.run({ mode: 'check', cred: { id: 'x', key: 'y' }, secretInfo: { secret: SECRET, source: 't' }, teo: fakeTeo([ruleWith({ condition: cond, status: 'disable' })]) })
  assert.equal(out.state, 'drift')
})

test('run:取不到密钥 ⇒ unjudged,不去建空密钥规则', async () => {
  const out = await g.run({ mode: 'apply', cred: { id: 'x', key: 'y' }, secretInfo: null, teo: fakeTeo([]) })
  assert.equal(out.state, 'unjudged')
  assert.equal(out.reason, 'no-edge-secret')
})

test('run:取不到腾讯云凭据 ⇒ unjudged', async () => {
  const out = await g.run({ mode: 'check', cred: null, secretInfo: { secret: SECRET, source: 't' }, teo: fakeTeo([]) })
  assert.equal(out.state, 'unjudged')
  assert.equal(out.reason, 'no-tencent-credentials')
})

test('结论行恒纯 ASCII 且带 state', () => {
  const line = g.machineLine({ state: 'ok', ruleId: 'rule-1', domains: ['a'], apply: false, reason: 'in-sync' })
  assert.equal(line, 'EO-GUARD-RULE state=ok rule=rule-1 domains=1 apply=false reason=in-sync')
  assert.match(line, /^[\x20-\x7e]+$/)
})

function fakeTeo(rules) {
  return async (_cred, action) => {
    if (action === 'DescribeZones') return { ok: true, data: { Zones: [{ ZoneId: 'z1', ZoneName: 'aizhs.top' }] } }
    if (action === 'DescribeAccelerationDomains') return { ok: true, data: { AccelerationDomains: [{ DomainName: 'www.aizhs.top', DomainStatus: 'online' }] } }
    if (action === 'DescribeL7AccRules') return { ok: true, data: { Rules: rules } }
    return { ok: false, error: 'unexpected-action:' + action }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
