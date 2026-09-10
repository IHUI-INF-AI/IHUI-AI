// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * agent-event-trigger 服务纯函数单测(2026-09-08 立)。
 * 不连 DB / 不连网络 —— 只测签名校验 / 规则匹配 / 占位符渲染 / 去重。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'
import {
  verifyGitHubSignature,
  parseSignatureHeader,
  matchTriggers,
  buildTriggerPrompt,
  DeliveryDedup,
} from '../agent-event-trigger'
import type { AgentEventTrigger } from '@ihui/database'

const SECRET = 'topsecret'

function sign(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body, 'utf8').digest('hex')
}

function makeTrigger(partial: Partial<AgentEventTrigger>): AgentEventTrigger {
  return {
    id: 't1',
    userId: 'u1',
    repoFullName: 'octo/hello',
    event: 'pull_request',
    action: { prompt: 'run tests' },
    enabled: 'true',
    lastFiredAt: null,
    lastResult: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as AgentEventTrigger
}

describe('parseSignatureHeader', () => {
  it('提取 sha256= 后的十六进制', () => {
    expect(parseSignatureHeader('sha256=abc123')).toBe('abc123')
  })
  it('大小写 hex 均可', () => {
    expect(parseSignatureHeader('sha256=ABCDEF')).toBe('ABCDEF')
  })
  it('无头 / 格式非法 → null', () => {
    expect(parseSignatureHeader(undefined)).toBeNull()
    expect(parseSignatureHeader('')).toBeNull()
    expect(parseSignatureHeader('md5=deadbeef')).toBeNull()
    expect(parseSignatureHeader('sha256_abc')).toBeNull()
  })
})

describe('verifyGitHubSignature', () => {
  it('正确签名 → true', () => {
    const body = '{"action":"opened"}'
    const sig = sign(body, SECRET)
    expect(verifyGitHubSignature(body, sig, SECRET)).toBe(true)
  })
  it('错误签名 → false', () => {
    const body = '{"action":"opened"}'
    expect(verifyGitHubSignature(body, sign(body, SECRET) + 'ff', SECRET)).toBe(false)
  })
  it('篡改 body → false', () => {
    const sig = sign('{"action":"opened"}', SECRET)
    expect(verifyGitHubSignature('{"action":"closed"}', sig, SECRET)).toBe(false)
  })
  it('无签名头 → false', () => {
    expect(verifyGitHubSignature('{}', undefined, SECRET)).toBe(false)
  })
  it('secret 为空 → 恒 false(调用方据配置决定 503)', () => {
    const body = '{}'
    expect(verifyGitHubSignature(body, sign(body, ''), '')).toBe(false)
  })
})

describe('matchTriggers', () => {
  const triggers = [
    makeTrigger({ id: 'a', repoFullName: 'octo/hello', event: 'pull_request', enabled: 'true' }),
    makeTrigger({ id: 'b', repoFullName: 'octo/hello', event: 'pull_request', enabled: 'false' }),
    makeTrigger({ id: 'c', repoFullName: 'octo/other', event: 'pull_request', enabled: 'true' }),
    makeTrigger({ id: 'd', repoFullName: 'octo/hello', event: 'push', enabled: 'true' }),
  ]
  it('按 repo+event 匹配且只返回启用中', () => {
    const r = matchTriggers('octo/hello', 'pull_request', triggers)
    expect(r.map((t) => t.id)).toEqual(['a']) // b 禁用、c 仓库不符、d 事件不符均排除
  })
  it('无命中 → 空数组', () => {
    expect(matchTriggers('x/y', 'issues', triggers)).toEqual([])
  })
})

describe('buildTriggerPrompt', () => {
  it('渲染占位符', () => {
    const out = buildTriggerPrompt(
      { prompt: '在 {{repo}} 处理来自 {{sender}} 的 {{action}}' },
      { repo: 'octo/hello', sender: 'alice', action: 'opened' },
    )
    expect(out).toBe('在 octo/hello 处理来自 alice 的 opened')
  })
  it('未提供值的占位符原样保留', () => {
    const out = buildTriggerPrompt({ prompt: 'hi {{missing}}' }, {})
    expect(out).toBe('hi {{missing}}')
  })
})

describe('DeliveryDedup', () => {
  let dedup: DeliveryDedup
  beforeEach(() => {
    dedup = new DeliveryDedup(3)
  })
  it('首次见到 deliveryId → true', () => {
    expect(dedup.record('d1')).toBe(true)
  })
  it('重复 deliveryId → false', () => {
    expect(dedup.record('d1')).toBe(true)
    expect(dedup.record('d1')).toBe(false)
  })
  it('空 deliveryId 不拦(交由其他逻辑)', () => {
    expect(dedup.record('')).toBe(true)
  })
  it('超出容量淘汰最旧', () => {
    dedup.record('d1')
    dedup.record('d2')
    dedup.record('d3')
    dedup.record('d4') // 淘汰 d1
    expect(dedup.record('d1')).toBe(true) // d1 已不在
    expect(dedup.record('d2')).toBe(false) // d2 仍在
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
