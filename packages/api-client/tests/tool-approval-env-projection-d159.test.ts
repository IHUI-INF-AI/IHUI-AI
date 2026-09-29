// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D159(2026-09-30 立):审批帧"逐请求事实"的投影判据。
 *
 * 为什么单独测这一层:此前 `exec_environment / network_target / blocked_network_targets`
 * 三个字段只在**组件测试**里被直接喂进视图,生产链路的解析面(client.ts 的
 * tryParseToolApproval)根本不递 ⇒ 到端永远渲染不出来,而 15 条组件用例全绿。
 * 本文件钉的是"线格式 → 消费形态"这一格,并刻意把三条"不许造默认值"写成反例:
 * 造默认值 = 把"没读到"渲染成"读到了",而这条链路的失效方向必须是"信息少了"。
 */
import { describe, it, expect } from 'vitest'

import { projectToolApprovalEnvFacts } from '../src/index.js'

const FULL_ENV = {
  available: true,
  inSandbox: true,
  backend: 'docker',
  networkIsolated: true,
  degraded: false,
  degradeNote: 'none',
}

describe('D159 projectToolApprovalEnvFacts', () => {
  it('① 三字段齐备 ⇒ 逐键投影,display 原样透传(不得改写成 host:port 的另一种拼法)', () => {
    const out = projectToolApprovalEnvFacts({
      exec_environment: FULL_ENV,
      network_target: { host: 'api.example.com', port: 443, protocol: 'https', display: 'api.example.com:443', reason: 'policy_denied' },
      blocked_network_targets: [
        { host: 'evil.test', port: 80, protocol: 'http', display: 'evil.test:80' },
      ],
    })
    expect(out.execEnvironment).toEqual(FULL_ENV)
    expect(out.networkTarget).toEqual({
      host: 'api.example.com',
      port: 443,
      protocol: 'https',
      display: 'api.example.com:443',
      reason: 'policy_denied',
    })
    expect(out.blockedNetworkTargets).toHaveLength(1)
    expect(out.blockedNetworkTargets?.[0]?.display).toBe('evil.test:80')
  })

  it('② 整块缺席 ⇒ 三个键一个都不出现(不是 available:false,也不是空数组)', () => {
    const out = projectToolApprovalEnvFacts({})
    expect(Object.keys(out)).toEqual([])
    expect('execEnvironment' in out).toBe(false)
    expect('blockedNetworkTargets' in out).toBe(false)
  })

  it('③ available 不是布尔 ⇒ 不发这一字段(宁缺勿造:把没判写成判过了是本链路唯一的禁止形态)', () => {
    const out = projectToolApprovalEnvFacts({ exec_environment: { available: 'yes', inSandbox: true } })
    expect(out.execEnvironment).toBeUndefined()
  })

  it('④ available:false 必须**保留**(它与"字段缺席"是两态:前者要渲染"未上报",后者整块不渲染)', () => {
    const out = projectToolApprovalEnvFacts({ exec_environment: { available: false } })
    expect(out.execEnvironment).toEqual({ available: false })
  })

  it('⑤ 目标缺 host 或缺 port ⇒ 该目标不发 ⇒ 三档不落任何规则(不退化成"按工具名放行")', () => {
    expect(projectToolApprovalEnvFacts({ network_target: { host: '', port: 443 } }).networkTarget).toBeUndefined()
    expect(projectToolApprovalEnvFacts({ network_target: { host: 'a.test', port: '443' } }).networkTarget).toBeUndefined()
    expect(projectToolApprovalEnvFacts({ network_target: 'not-an-object' }).networkTarget).toBeUndefined()
  })

  it('⑥ display 缺席才归一成 host:port;在位时逐字保留(弹窗承诺的是后端给的那一条)', () => {
    const a = projectToolApprovalEnvFacts({ network_target: { host: 'h', port: 8080, protocol: 'tcp' } })
    expect(a.networkTarget?.display).toBe('h:8080')
    const b = projectToolApprovalEnvFacts({ network_target: { host: 'h', port: 8080, display: 'h:8080/tcp' } })
    expect(b.networkTarget?.display).toBe('h:8080/tcp')
  })

  it('⑦ blocked 清单里混入畸形项 ⇒ 只丢畸形项、保留合法项;全畸形 ⇒ 整键不发(不给空数组冒充"有清单")', () => {
    const mixed = projectToolApprovalEnvFacts({
      blocked_network_targets: [{ host: 'ok.test', port: 1 }, { host: 2, port: 1 }],
    })
    expect(mixed.blockedNetworkTargets).toHaveLength(1)
    expect(mixed.blockedNetworkTargets?.[0]?.host).toBe('ok.test')
    const allBad = projectToolApprovalEnvFacts({ blocked_network_targets: [{ nope: 1 }] })
    expect('blockedNetworkTargets' in allBad).toBe(false)
  })

  it('⑧ 装车证明:两个解析出口都必须真的调它(判据在而无人调 = 判据不存在)', async () => {
    const { readFileSync } = await import('node:fs')
    const client = readFileSync(new URL('../src/client.ts', import.meta.url), 'utf8')
    const agentEvents = readFileSync(
      new URL('../../shared/src/sse/agent-events.ts', import.meta.url),
      'utf8',
    )
    expect(client).toMatch(/\.\.\.projectToolApprovalEnvFacts\(json\)/)
    expect(agentEvents).toMatch(/\.\.\.projectToolApprovalEnvFacts\(p\)/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
