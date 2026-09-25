// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 出站事实(egress facts)在**真实厂商出口**上的单测。
 *
 * 立票理由:AGENTS §5b 那三条"网络时通时不通 / 钩子不继承 shell env / 服务身份不相通"最后都靠
 * 人肉现读配置才搞清,因为没有任何一次调用把"我这趟实际用了哪份代理/CA 配置"带回来。
 * 所以这里必须有一条断言证明 **egress 字段真的被填上**(不是只证明类型能编译)。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  attachEgressFacts,
  collectEgressFacts,
  isProxiedUrl,
  readEgressFacts,
} from '../src/utils/proxy-dispatcher.js'
import { fetchWithTimeout } from '../src/routes/ai-vendors/_shared.js'
import { EGRESS_FACT_FIELDS, type EgressFacts } from '@ihui/types'

/** 本测试涉及的变量在 .env.test / 宿主 shell 里都可能已存在 ⇒ 逐条存取,不得盲删。*/
const MANAGED_VARS = [
  'PROXY_URL',
  'PROXY_DOMAINS',
  'NO_PROXY',
  'no_proxy',
  'HTTPS_PROXY',
  'https_proxy',
  'HTTP_PROXY',
  'http_proxy',
  'ALL_PROXY',
  'all_proxy',
  'NODE_EXTRA_CA_CERTS',
  'NODE_TLS_CA_CERTS',
] as const

let saved: Record<string, string | undefined> = {}

beforeEach(() => {
  saved = {}
  for (const name of MANAGED_VARS) {
    saved[name] = process.env[name]
    delete process.env[name]
  }
})

afterEach(() => {
  for (const name of MANAGED_VARS) {
    if (saved[name] === undefined) delete process.env[name]
    else process.env[name] = saved[name]
  }
})

describe('collectEgressFacts —— 判据与路由同源', () => {
  it('未配置 PROXY_URL:不代理,并如实说"配置缺失"而不是"域名不在表里"', () => {
    const facts = collectEgressFacts('https://api.openai.com/v1/chat/completions')
    expect(facts.proxied).toBe(false)
    expect(facts.proxySource).toBe('none')
    expect(facts.proxyConfigVar).toBe(null)
    expect(facts.policyDeclined).toBe('proxy-unconfigured')
    expect(isProxiedUrl('https://api.openai.com/v1/chat/completions')).toBe(false)
  })

  it('配了 PROXY_URL 且域名在内置表里:代理,且代理值不外泄', () => {
    process.env.PROXY_URL = 'http://127.0.0.1:7897'
    const facts = collectEgressFacts('https://api.openai.com/v1/models')
    expect(facts.proxied).toBe(true)
    expect(facts.proxySource).toBe('app-env-var')
    expect(facts.proxyConfigVar).toBe('PROXY_URL')
    expect(facts.proxyDomainTable).toBe('builtin-default')
    expect(facts.proxyAppliedVia).toBe('proxy-agent')
    expect(facts.policyDeclined).toBe(null)
    expect(JSON.stringify(facts)).not.toContain('7897')
  })

  it('PROXY_DOMAINS 覆盖内置表时,表格出处是事实之一', () => {
    process.env.PROXY_URL = 'http://127.0.0.1:7897'
    process.env.PROXY_DOMAINS = 'internal-saas.example'
    const covered = collectEgressFacts('https://internal-saas.example/api')
    const uncovered = collectEgressFacts('https://api.openai.com/v1/models')
    expect(covered.proxied).toBe(true)
    expect(covered.proxyDomainTable).toBe('env-override')
    expect(uncovered.proxied).toBe(false)
    expect(uncovered.policyDeclined).toBe('domain-not-in-table')
  })

  it('内网/本机地址永不走代理(策略判掉,与"没配代理"可判别)', () => {
    process.env.PROXY_URL = 'http://127.0.0.1:7897'
    process.env.PROXY_DOMAINS = '10.0.0.1,192.168.1.5'
    for (const url of [
      'http://10.0.0.1:8802/api',
      'http://192.168.1.5/x',
      'http://localhost:8801/y',
    ]) {
      const facts = collectEgressFacts(url)
      expect(facts.proxied).toBe(false)
      expect(facts.policyDeclined).toBe('internal-host')
    }
  })

  it('URL 解析不出来单独成一档,不得被读成"没走代理"', () => {
    process.env.PROXY_URL = 'http://127.0.0.1:7897'
    const facts = collectEgressFacts('not a url')
    expect(facts.urlParseable).toBe(false)
    expect(facts.targetHostname).toBe(null)
    expect(facts.proxied).toBe(false)
    expect(facts.policyDeclined).toBe('url-unparseable')
  })

  it('NO_PROXY 命中只作为**事实**回来,不改变路由(改路由是另一张票)', () => {
    process.env.PROXY_URL = 'http://127.0.0.1:7897'
    process.env.NO_PROXY = 'openai.com'
    const facts = collectEgressFacts('https://api.openai.com/v1/models')
    expect(facts.noProxyMatched).toBe(true)
    expect(facts.noProxyVar).toBe('NO_PROXY')
    // 这一对(proxied=true ∧ noProxyMatched=true)正是"配了却不生效"的可诊断指纹
    expect(facts.proxied).toBe(true)
  })

  it('环境变量只带名字、不带值;CA 状态单独一档', () => {
    process.env.HTTPS_PROXY = 'http://should-never-leak:9999'
    process.env.https_proxy = 'http://should-never-leak:9999'
    process.env.NODE_EXTRA_CA_CERTS = '/etc/ssl/custom-ca.pem'
    const facts = collectEgressFacts('https://api.deepseek.com/v1/models')
    expect(facts.envProxyVars).toContain('HTTPS_PROXY')
    expect(facts.envProxyVars).toContain('https_proxy')
    expect(facts.customCa).toBe('node-extra-ca-certs')
    const serialized = JSON.stringify(facts)
    expect(serialized).not.toContain('should-never-leak')
    expect(serialized).not.toContain('custom-ca.pem')
    expect(serialized).not.toContain('9999')
  })

  it('返回对象恰好是白名单字段(出口事实结构上带不进第四类内容)', () => {
    const facts = collectEgressFacts('https://api.openai.com/v1/models')
    expect(Object.keys(facts).sort()).toEqual([...EGRESS_FACT_FIELDS].sort())
  })
})

describe('attachEgressFacts / readEgressFacts', () => {
  it('取不到事实的响应 → null,而不是"没走代理"的假结论', () => {
    expect(readEgressFacts(new Response('x'))).toBe(null)
    expect(readEgressFacts(null)).toBe(null)
    expect(readEgressFacts('string')).toBe(null)
  })

  it('挂上去的字段不可枚举:不进 Object.keys,也不进 JSON', () => {
    const res = new Response('ok')
    const facts = collectEgressFacts('https://api.openai.com/v1/models')
    attachEgressFacts(res, facts)
    expect(readEgressFacts(res)).toEqual(facts)
    expect(Object.keys(res)).not.toContain('egress')
    expect(JSON.stringify(res)).not.toContain('api.openai.com')
  })
})

describe('真实出口:fetchWithTimeout 必须把 egress 填在响应上', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('直连分支也带事实,且事实与本次实际生效的配置一致', async () => {
    let seenRequestUrl = ''
    globalThis.fetch = (async (input: string | URL | Request) => {
      seenRequestUrl = String(input)
      return new Response('{"ok":true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof fetch

    const res = await fetchWithTimeout('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      body: '{}',
    })
    expect(seenRequestUrl).toBe('https://api.deepseek.com/v1/chat/completions')

    const facts = readEgressFacts(res) as EgressFacts
    // 这条断言是本票的验收底线:字段**真的被填上了**,不是类型上可选就完事
    expect(facts).not.toBe(null)
    expect(facts.targetHostname).toBe('api.deepseek.com')
    expect(facts.proxied).toBe(false)
    expect(facts.proxyAppliedVia).toBe('no-explicit-dispatcher')
    expect(facts.policyDeclined).toBe('proxy-unconfigured')
    expect(await res.json()).toEqual({ ok: true })
  })

  it('配置变则事实变(不是缓存的旧结论)—— 代理分支本身不在这里跑', async () => {
    // 说明:让 proxied=true 的分支真跑需要本机有个活的 HTTP 代理端口,那是环境态不是判据。
    // 所以这一格验**决策面**(collectEgressFacts 是 fetchWithTimeout 用的同一个函数),
    // 并用下一格证明"决策为 true 时走的是 proxiedFetch 而不是 global fetch"。
    globalThis.fetch = (async () => new Response('{}', { status: 200 })) as unknown as typeof fetch
    process.env.PROXY_URL = 'http://127.0.0.1:7897'
    process.env.PROXY_DOMAINS = 'api.stepfun.com'
    const url = 'https://api.stepfun.com/step_plan/v1/models'
    const facts = collectEgressFacts(url)
    expect(facts.proxyDomainTable).toBe('env-override')
    expect(facts.proxySource).toBe('app-env-var')
    expect(facts.proxied).toBe(true)
    expect(facts.proxyAppliedVia).toBe('proxy-agent')
    // 同一趟里另一个域名的事实不受它影响(逐请求计算,不是进程级缓存)
    expect(collectEgressFacts('https://api.openai.com/v1/models').proxied).toBe(false)
  })

  it('决策为 true 时确实换掉了传输:global fetch 一次都不该被调用', async () => {
    let globalFetchCalls = 0
    globalThis.fetch = (async () => {
      globalFetchCalls += 1
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch
    // 指向一个必然连不上的端口:目的是看它**有没有尝试走代理链路**,不是要请求成功
    process.env.PROXY_URL = 'http://127.0.0.1:1'
    process.env.PROXY_DOMAINS = 'api.stepfun.com'
    await expect(fetchWithTimeout('https://api.stepfun.com/step_plan/v1/models')).rejects.toThrow()
    expect(globalFetchCalls).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
