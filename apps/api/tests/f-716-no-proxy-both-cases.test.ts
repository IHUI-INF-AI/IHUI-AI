// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-716 回归锁(2026-11-13)。
 *
 * 病灶:readNoProxy 先取第一个"已配置"的大小写变体(NO_PROXY / no_proxy),
 * 一旦该变量存在就只用它;若它不含目标主机而另一个变体含,真实命中被忽略 ——
 * 注释却声称"继续找另一个大小写档位"。
 *
 * 本文件锁:
 *   ① 两变体同时配置:按并集匹配,任一命中即命中(foo.com 只出现在 NO_PROXY,
 *      api.openai.com 只出现在 no_proxy,两者都必须命中);
 *   ② 两变体都未命中:noProxyMatched=false,且代理路由照常(不误判成不走代理);
 *   ③ 只配 NO_PROXY 或只配 no_proxy:命中判定与 varName 事实与修复前一致。
 *
 * 环境处理:Windows 上 process.env 的键名大小写不敏感,先后写 NO_PROXY 与 no_proxy
 * 会互相覆盖(后写者胜),两档无法并存 ⇒ 本文件把 process.env 临时换成普通对象,
 * 让"两个大小写变体同时存在"在任意平台都可判定;每个用例结束还原真实 env。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { collectEgressFacts } from '../src/utils/proxy-dispatcher.js'

const realEnv = process.env

/** 用一份普通对象充当 process.env(大小写敏感),绕开 Windows 的大小写折叠。 */
function swapEnv(vars: Record<string, string>): void {
  process.env = { ...vars } as NodeJS.ProcessEnv
}

beforeEach(() => {
  swapEnv({ PROXY_URL: 'http://127.0.0.1:7897' })
})

afterEach(() => {
  process.env = realEnv
})

describe('F-716 NO_PROXY / no_proxy 双变体合并匹配', () => {
  it('两变体同时配置:任一命中都算命中(修复前 no_proxy 里的真实命中被吞)', () => {
    swapEnv({
      PROXY_URL: 'http://127.0.0.1:7897',
      NO_PROXY: 'foo.com',
      no_proxy: 'api.openai.com',
    })
    const foo = collectEgressFacts('https://foo.com/x')
    expect(foo.noProxyMatched).toBe(true)
    expect(foo.noProxyVar).toBe('NO_PROXY')

    const openai = collectEgressFacts('https://api.openai.com/v1/models')
    // 修复前:第一个已配置的 NO_PROXY 不含该主机即 return false,这里恒红
    expect(openai.noProxyMatched).toBe(true)
    expect(openai.noProxyVar).toBe('no_proxy')
    // NO_PROXY 命中仍只是"事实",不改代理路由(改路由是另一张票)
    expect(openai.proxied).toBe(true)
  })

  it('两变体都未命中:不命中,代理照常走', () => {
    swapEnv({ PROXY_URL: 'http://127.0.0.1:7897', NO_PROXY: 'foo.com', no_proxy: 'bar.com' })
    const facts = collectEgressFacts('https://api.openai.com/v1/models')
    expect(facts.noProxyMatched).toBe(false)
    // 名字仍是事实:报第一个已配置变体
    expect(facts.noProxyVar).toBe('NO_PROXY')
    expect(facts.proxied).toBe(true)
    expect(JSON.stringify(facts)).not.toContain('foo.com')
  })

  it('只配 NO_PROXY:行为不变', () => {
    swapEnv({ PROXY_URL: 'http://127.0.0.1:7897', NO_PROXY: 'openai.com' })
    const hit = collectEgressFacts('https://api.openai.com/v1/models')
    expect(hit.noProxyMatched).toBe(true)
    expect(hit.noProxyVar).toBe('NO_PROXY')

    const miss = collectEgressFacts('https://api.stepfun.com/x')
    expect(miss.noProxyMatched).toBe(false)
    expect(miss.noProxyVar).toBe('NO_PROXY')
  })

  it('只配 no_proxy:行为不变', () => {
    swapEnv({ PROXY_URL: 'http://127.0.0.1:7897', no_proxy: 'api.openai.com' })
    const hit = collectEgressFacts('https://api.openai.com/v1/models')
    expect(hit.noProxyMatched).toBe(true)
    expect(hit.noProxyVar).toBe('no_proxy')

    const miss = collectEgressFacts('https://api.stepfun.com/x')
    expect(miss.noProxyMatched).toBe(false)
    expect(miss.noProxyVar).toBe('no_proxy')
  })

  it('两变体共用同一套归一:大小写/空白/前导点/通配符', () => {
    swapEnv({
      PROXY_URL: 'http://127.0.0.1:7897',
      NO_PROXY: 'foo.com, .openai.com',
      no_proxy: ' API.GROQ.COM ',
    })
    expect(collectEgressFacts('https://api.openai.com/v1/models').noProxyMatched).toBe(true)
    expect(collectEgressFacts('https://api.groq.com/openai/v1').noProxyMatched).toBe(true)

    swapEnv({ PROXY_URL: 'http://127.0.0.1:7897', NO_PROXY: 'foo.com', no_proxy: '*' })
    const wildcard = collectEgressFacts('https://any.example/x')
    expect(wildcard.noProxyMatched).toBe(true)
    expect(wildcard.noProxyVar).toBe('no_proxy')
  })
})
