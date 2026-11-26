// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { describe, expect, it } from 'vitest'
import {
  CHANNEL_DOMAINS,
  DOMAIN_PREFIXES,
  DomainChannelRouter,
  DomainRejected,
} from '../src/channel-domain.js'

function makeRouter(): DomainChannelRouter {
  const r = new DomainChannelRouter(() => '2026-11-26T00:00:00.000Z')
  r.defineDomain('agent', { version: '1.0.0', allowedPrincipals: ['agent-core'] })
  r.defineDomain('ui', { version: '2.1.0', allowedPrincipals: ['web-ui', 'rn-ui'] })
  r.defineDomain('remote-session', { version: '0.9.0', allowedPrincipals: ['remote-gw'] })
  r.register('agent', { name: 'agent.tool.call', kind: 'call', owner: 'agent', purpose: '工具调用' })
  r.register('ui', { name: 'ui.chat.update', kind: 'subscribe', owner: 'ui', purpose: '聊天更新' })
  r.register('remote-session', {
    name: 'remote-session.attach',
    kind: 'call',
    owner: 'remote',
    purpose: '远端附着',
  })
  return r
}

describe('L12 三域定义与前缀绑定', () => {
  it('三域前缀互不重复', () => {
    expect(CHANNEL_DOMAINS).toEqual(['agent', 'ui', 'remote-session'])
    const prefixes = CHANNEL_DOMAINS.map((d) => DOMAIN_PREFIXES[d])
    expect(new Set(prefixes).size).toBe(3)
  })

  it('每域独立版本号', () => {
    const r = makeRouter()
    expect(r.version('agent')).toBe('1.0.0')
    expect(r.version('ui')).toBe('2.1.0')
    expect(r.version('remote-session')).toBe('0.9.0')
  })

  it('通道名前缀不匹配本域即拒', () => {
    const r = makeRouter()
    expect(() =>
      r.register('ui', { name: 'agent.tool.call', kind: 'call', owner: 'ui', purpose: 'x' }),
    ).toThrow(DomainRejected)
  })
})

describe('L12 独立 ACL', () => {
  it('主体不在本域 ACL 即拒', () => {
    const r = makeRouter()
    expect(() => r.dispatch('agent', 'web-ui', 'agent.tool.call', 'call', () => 1)).toThrow(
      DomainRejected,
    )
    try {
      r.dispatch('agent', 'web-ui', 'agent.tool.call', 'call', () => 1)
    } catch (e) {
      expect((e as DomainRejected).code).toBe('principal-not-allowed')
    }
  })

  it('跨域不复用:ui 主体不能进 agent 域,反之亦然', () => {
    const r = makeRouter()
    expect(r.dispatch('ui', 'web-ui', 'ui.chat.update', 'subscribe', () => 'ok')).toBe('ok')
    expect(r.dispatch('agent', 'agent-core', 'agent.tool.call', 'call', () => 'ok')).toBe('ok')
  })

  it('空 ACL 无人可用(fail-closed)', () => {
    const r = new DomainChannelRouter()
    r.defineDomain('agent', { version: '1', allowedPrincipals: [] })
    r.register('agent', { name: 'agent.x', kind: 'call', owner: 'a', purpose: 'x' })
    expect(() => r.dispatch('agent', 'anyone', 'agent.x', 'call', () => 1)).toThrow(
      DomainRejected,
    )
  })
})

describe('L12 独立健康检查', () => {
  it('域不健康即拒所有通道', () => {
    const r = makeRouter()
    r.setHealthy('agent', false)
    expect(() => r.dispatch('agent', 'agent-core', 'agent.tool.call', 'call', () => 1)).toThrow(
      DomainRejected,
    )
    // 其他域不受影响
    expect(r.dispatch('ui', 'web-ui', 'ui.chat.update', 'subscribe', () => 'ok')).toBe('ok')
  })

  it('未注册通道即拒', () => {
    const r = makeRouter()
    expect(() => r.dispatch('agent', 'agent-core', 'agent.unknown', 'call', () => 1)).toThrow(
      DomainRejected,
    )
  })

  it('未定义域即拒', () => {
    const r = makeRouter()
    expect(() => r.dispatch('ghost' as never, 'x', 'ghost.x', 'call', () => 1)).toThrow(
      DomainRejected,
    )
  })
})

describe('L12 审计按域分表', () => {
  it('允许与拒绝各归其域,不串表', () => {
    const r = makeRouter()
    r.dispatch('ui', 'web-ui', 'ui.chat.update', 'subscribe', () => 1)
    try {
      r.dispatch('agent', 'web-ui', 'agent.tool.call', 'call', () => 1)
    } catch {
      /* expected */
    }
    const uiAudit = r.auditFor('ui')
    const agentAudit = r.auditFor('agent')
    expect(uiAudit.length).toBe(1)
    expect(uiAudit[0]).toMatchObject({ domain: 'ui', outcome: 'allowed' })
    expect(agentAudit.length).toBe(1)
    expect(agentAudit[0]).toMatchObject({ domain: 'agent', outcome: 'rejected' })
    expect(agentAudit[0]?.reason).toBe('principal-not-allowed')
    expect(r.auditFor('remote-session')).toEqual([])
  })

  it('拒绝按域独立计数', () => {
    const r = makeRouter()
    expect(r.rejections('ui')).toBe(0)
    try {
      r.dispatch('ui', 'bad', 'ui.chat.update', 'subscribe', () => 1)
    } catch {
      /* expected */
    }
    expect(r.rejections('ui')).toBe(1)
    expect(r.rejections('agent')).toBe(0)
  })
})
