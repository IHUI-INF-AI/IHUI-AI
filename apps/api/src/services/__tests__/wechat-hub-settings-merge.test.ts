// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * metadata 合并回归：metadata 一个字段住着十几种东西，任何一次整块覆盖都是数据丢失。
 * 这里锁死三条底线：只改名中点到的键、URL 仍然过 SSRF 白名单、清空模型不留空对象。
 */

import { describe, expect, it } from 'vitest'

import { mergeSettingsMetadata } from '../wechat-hub/settings-merge'

describe('mergeSettingsMetadata', () => {
  const base = {
    allowedTargets: ['wxid_a'],
    rateLimitPerMinute: 12,
    commands: { enabled: true, groupEnabled: false, disabled: ['report'] },
    jobs: [{ id: 'job-1' }],
    contacts: { wxid_a: '张三' },
    momentsCursor: '2026-11-01T00:00:00.000Z',
  }

  it('只改 agentModel，其余键（任务/通讯录/游标/指令）原样保留', () => {
    const next = mergeSettingsMetadata(base, { agentModel: 'doubao-lite-4k' })
    expect(next.agent).toEqual({ model: 'doubao-lite-4k' })
    expect(next.jobs).toEqual(base.jobs)
    expect(next.contacts).toEqual(base.contacts)
    expect(next.momentsCursor).toBe(base.momentsCursor)
    expect(next.commands).toEqual(base.commands)
    expect(next.allowedTargets).toEqual(base.allowedTargets)
  })

  it('空串删除 model，agent 里没有别的键时整个 agent 一并清掉', () => {
    const next = mergeSettingsMetadata({ ...base, agent: { model: 'x' } }, { agentModel: '   ' })
    expect('agent' in next).toBe(false)
  })

  it('agent 上还有别的键时只删 model，不牵连其它', () => {
    const next = mergeSettingsMetadata(
      { ...base, agent: { model: 'x', temperature: 0.3 } },
      { agentModel: '' },
    )
    expect(next.agent).toEqual({ temperature: 0.3 })
  })

  it('限流夹在 1–120，超界不报错也不写脏值', () => {
    expect(mergeSettingsMetadata(base, { rateLimitPerMinute: 0 }).rateLimitPerMinute).toBe(1)
    expect(mergeSettingsMetadata(base, { rateLimitPerMinute: 999 }).rateLimitPerMinute).toBe(120)
  })

  it('出站 Webhook 留空是清除，填内网地址直接 400', () => {
    const cleared = mergeSettingsMetadata(
      { ...base, outboundWebhookUrl: 'https://n8n.example.com/hook' },
      { outboundWebhookUrl: '' },
    )
    expect('outboundWebhookUrl' in cleared).toBe(false)
    expect(() =>
      mergeSettingsMetadata(base, { outboundWebhookUrl: 'https://127.0.0.1/hook' }),
    ).toThrowError(/内网|本机/)
  })

  it('未在 patch 里出现的键一律不动（含 allowlist 与敏感词）', () => {
    const next = mergeSettingsMetadata({ ...base, blockedWords: ['免费'] }, {})
    expect(next).toEqual({ ...base, blockedWords: ['免费'] })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
