// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `@ihui/types` 出口事实形状的单测。
 *
 * 守的重点不是"类型能编译",而是**这个结构带不走凭据**:字段集由白名单钉死,
 * 多给的一律丢(守门 67 的口径:一旦允许 host 之外的东西,就等于给 token 开了车道)。
 */
import { describe, expect, it } from 'vitest'
import {
  createEgressFacts,
  EGRESS_FACT_FIELDS,
  EGRESS_CA_STATES,
  EGRESS_POLICY_DECLINE_REASONS,
  EGRESS_PROXY_APPLIED_VIA,
  EGRESS_PROXY_SOURCES,
  type EgressFacts,
} from '../src/egress-facts'

const BASE: EgressFacts = {
  targetHostname: 'api.openai.com',
  urlParseable: true,
  proxied: true,
  proxySource: 'app-env-var',
  proxyConfigVar: 'PROXY_URL',
  proxyDomainTable: 'builtin-default',
  proxyAppliedVia: 'proxy-agent',
  envProxyVars: ['HTTPS_PROXY'],
  noProxyMatched: false,
  noProxyVar: null,
  customCa: 'none',
  policyDeclined: null,
}

describe('egress facts 闭集形状', () => {
  it('白名单字段集与类型声明逐名相等(加字段必须同时改两处)', () => {
    expect([...EGRESS_FACT_FIELDS].sort()).toEqual(Object.keys(BASE).sort())
  })

  it('装配结果恰好是白名单字段,不多不少', () => {
    expect(Object.keys(createEgressFacts(BASE)).sort()).toEqual([...EGRESS_FACT_FIELDS].sort())
  })

  it('调用方多塞的 url / proxyUrl / token 一律被丢弃 —— 凭据搭不上车', () => {
    const dirty = {
      ...BASE,
      url: 'https://user:pa55word@api.openai.com/v1?key=sk-abc',
      proxyUrl: 'http://127.0.0.1:7897',
      authorization: 'Bearer sk-secret',
    } as EgressFacts & Record<string, unknown>
    const clean = createEgressFacts(dirty)
    expect(Object.keys(clean).sort()).toEqual([...EGRESS_FACT_FIELDS].sort())
    // 反向对照:整对象序列化后不得出现任一敏感片段(只查片段,不打印内容)
    const serialized = JSON.stringify(clean)
    for (const secret of ['pa55word', 'sk-', '7897', 'user:', 'Bearer']) {
      expect(serialized.includes(secret)).toBe(false)
    }
  })

  it('装配结果是冻结的 —— 挂到响应后不得被下游改写', () => {
    const facts = createEgressFacts(BASE)
    expect(Object.isFrozen(facts)).toBe(true)
  })

  it('闭集取值集合按当前实测口径,未实现的两档不得混进来', () => {
    expect([...EGRESS_PROXY_SOURCES]).toEqual(['app-env-var', 'none', 'undetermined'])
    expect([...EGRESS_PROXY_APPLIED_VIA]).toEqual(['proxy-agent', 'no-explicit-dispatcher'])
    expect([...EGRESS_CA_STATES]).toEqual([
      'node-extra-ca-certs',
      'node-tls-ca-certs',
      'none',
      'undetermined',
    ])
    // 现状没有任何出口在传输前拒发请求 ⇒ 没有 'blocked-by-allowlist' 这一档,不得凭空造
    expect([...EGRESS_POLICY_DECLINE_REASONS]).toEqual([
      'url-unparseable',
      'proxy-unconfigured',
      'internal-host',
      'domain-not-in-table',
    ])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
