// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L05 验收面:名字形态在登记期就拒;重复登记拒;未注册通道派发被拒并计数留审计;
 * 已注册通道正常放行;快照稳定可对账。
 */

import { describe, expect, it } from 'vitest'

import {
  CHANNEL_NAME_PATTERN,
  ChannelDispatcher,
  ChannelRegistry,
  ChannelRegistryError,
  ChannelRejected,
  type ChannelDomain,
} from '../src/channel-registry.js'

const spec = (
  name: string,
  kind: 'call' | 'listen' | 'subscribe' = 'call',
  domain?: ChannelDomain,
) => ({
  name,
  kind,
  owner: 'packages/agent-sdk',
  purpose: '测试用通道',
  ...(domain ? { domain } : {}),
})

describe('L05 通道注册表', () => {
  it('合法名字登记成功;快照按 kind+name 稳定排序', () => {
    const r = new ChannelRegistry()
    r.register(spec('terminal.session.create'))
    r.register(spec('mcp.tool.call', 'call'))
    r.register(spec('agent.event.stream', 'listen'))
    expect(r.size).toBe(3)
    expect(r.snapshot().map((s) => `${s.kind}:${s.name}`)).toEqual([
      'call:mcp.tool.call',
      'call:terminal.session.create',
      'listen:agent.event.stream',
    ])
    expect(r.resolve('terminal.session.create', 'call')?.owner).toBe('packages/agent-sdk')
    expect(r.resolve('terminal.session.create', 'listen')).toBeNull()
  })

  it('非法名字/未知种类/缺 owner/缺用途 全部在登记期拒', () => {
    const r = new ChannelRegistry()
    for (const bad of ['', 'Chat', 'a', 'a.*', 'a.b.c.d.e', 'A.b', 'a..b', 'a.b c']) {
      expect(CHANNEL_NAME_PATTERN.test(bad)).toBe(false)
      expect(() => r.register(spec(bad))).toThrow(ChannelRegistryError)
    }
    expect(() => r.register({ ...spec('ok.channel'), kind: 'x' as never })).toThrow(/bad-kind/)
    expect(() => r.register({ ...spec('ok.channel'), owner: '  ' })).toThrow(/missing-owner/)
    expect(() => r.register({ ...spec('ok.channel'), purpose: '' })).toThrow(/missing-purpose/)
  })

  it('同 kind 下重名拒;不同 kind 可共存', () => {
    const r = new ChannelRegistry()
    r.register(spec('agent.event.stream', 'listen'))
    expect(() => r.register(spec('agent.event.stream', 'listen'))).toThrow(/duplicate-channel/)
    r.register(spec('agent.event.stream', 'subscribe'))
    expect(r.size).toBe(2)
  })
})

describe('L05 派发器', () => {
  it('已注册通道放行并留 allowed 审计', () => {
    const r = new ChannelRegistry()
    r.register(spec('mcp.tool.call'))
    const d = new ChannelDispatcher(r, { now: () => '2026-11-26T00:00:00.000Z' })
    const out = d.dispatch('mcp.tool.call', 'call', (s) => s.purpose)
    expect(out).toBe('测试用通道')
    expect(d.allowed).toBe(1)
    expect(d.auditTrail()[0]).toMatchObject({
      channel: 'mcp.tool.call',
      kind: 'call',
      outcome: 'allowed',
      owner: 'packages/agent-sdk',
    })
  })

  it('未注册通道派发被拒:抛 ChannelRejected + 计数 + rejected 审计', () => {
    const r = new ChannelRegistry()
    r.register(spec('known.channel'))
    const d = new ChannelDispatcher(r)
    expect(() => d.dispatch('ghost.channel', 'call', () => 1)).toThrow(ChannelRejected)
    try {
      d.dispatch('ghost.channel', 'call', () => 1)
    } catch (e) {
      expect((e as ChannelRejected).code).toBe('unregistered-channel')
    }
    expect(d.rejections().get('call:ghost.channel')).toBe(2)
    expect(d.auditTrail().filter((a) => a.outcome === 'rejected')).toHaveLength(2)
    expect(d.allowed).toBe(0)
  })

  it('guard 只查表:未注册拒绝并计数,已注册返回 spec', () => {
    const r = new ChannelRegistry()
    r.register(spec('known.channel'))
    const d = new ChannelDispatcher(r)
    expect(d.guard('known.channel', 'call').owner).toBe('packages/agent-sdk')
    expect(() => d.guard('ghost.channel', 'call')).toThrow(ChannelRejected)
    expect(d.rejections().get('call:ghost.channel')).toBe(1)
  })

  it('审计环有上界,只留最近 N 条', () => {
    const r = new ChannelRegistry()
    r.register(spec('known.channel'))
    const d = new ChannelDispatcher(r, { auditCapacity: 3 })
    for (let i = 0; i < 5; i += 1) d.dispatch('known.channel', 'call', () => i)
    expect(d.auditTrail()).toHaveLength(3)
  })

  it('审计出口可外接(默认内存环不是唯一路径)', () => {
    const r = new ChannelRegistry()
    r.register(spec('known.channel'))
    const lines: string[] = []
    const d = new ChannelDispatcher(r, { onAudit: (rec) => lines.push(rec.outcome) })
    d.dispatch('known.channel', 'call', () => 0)
    expect(lines).toEqual(['allowed'])
  })
})

describe('L12 通道域隔离', () => {
  it('三域可各自登记;跨域复用同名直接拒', () => {
    const r = new ChannelRegistry()
    r.register(spec('agent.tool.call', 'call', 'agent'))
    r.register(spec('ui.panel.open', 'call', 'ui'))
    r.register(spec('remote.session.attach', 'call', 'remote-session'))
    expect(r.size).toBe(3)
    expect(() => r.register(spec('agent.tool.call', 'call', 'ui'))).toThrow(/cross-domain-name/)
  })

  it('每域独立版本号 + 健康检查', () => {
    const r = new ChannelRegistry()
    r.register(spec('ui.panel.open', 'call', 'ui'))
    r.registerDomain('ui', { version: '2.1.0' })
    expect(r.domainPolicy('ui')?.version).toBe('2.1.0')
    expect(r.domainHealth('ui')).toMatchObject({
      domain: 'ui',
      version: '2.1.0',
      channels: 1,
      healthy: true,
    })
    // 只登记策略、没有通道 → 不健康;完全没策略也 false
    r.registerDomain('agent', { version: '1.0.0' })
    expect(r.domainHealth('agent').healthy).toBe(false)
    expect(r.domainHealth('remote-session').healthy).toBe(false)
  })

  it('域 ACL deny 生效:已注册通道也被拒,审计按域分表', () => {
    const r = new ChannelRegistry()
    r.register(spec('ui.panel.open', 'call', 'ui'))
    r.register(spec('agent.tool.call', 'call', 'agent'))
    r.registerDomain('ui', { version: '1.0.0', acl: { deny: ['ui.panel.open'] } })
    const d = new ChannelDispatcher(r, { now: () => '2026-11-26T00:00:00.000Z' })

    expect(() => d.guard('ui.panel.open', 'call', 'ui')).toThrow(ChannelRejected)
    expect(d.rejections().get('call:ui.panel.open')).toBe(1)
    expect(d.auditByDomain('ui')).toHaveLength(1)
    expect(d.auditByDomain('ui')[0]?.code).toBe('acl-denied')
    expect(d.auditByDomain('agent')).toHaveLength(0)
    expect(d.rejectedCount('ui')).toBe(1)
  })

  it('allow 清单只放行列出的通道', () => {
    const r = new ChannelRegistry()
    r.register(spec('ui.panel.open', 'call', 'ui'))
    r.register(spec('ui.panel.close', 'call', 'ui'))
    r.registerDomain('ui', { version: '1.0.0', acl: { allow: ['ui.panel.open'] } })
    const d = new ChannelDispatcher(r)
    expect(d.guard('ui.panel.open', 'call', 'ui').name).toBe('ui.panel.open')
    expect(() => d.guard('ui.panel.close', 'call', 'ui')).toThrow(/ACL/)
  })

  it('默认域仍是 agent,既有调用点不用改', () => {
    const r = new ChannelRegistry()
    r.register(spec('mcp.tool.call'))
    expect(r.resolve('mcp.tool.call', 'call')?.domain).toBe('agent')
    expect(r.resolve('mcp.tool.call', 'call', 'ui')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
