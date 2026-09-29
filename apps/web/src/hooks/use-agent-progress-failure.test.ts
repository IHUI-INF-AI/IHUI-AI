// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-937980 子代理失败原因证据阶梯覆盖规则单测:
 * subagent_end / subagent_status 先后到达时,弱文案(仅 error 文本)不得覆盖强证据
 * (HTTP 状态码 / 稳定错误码 / 结构化 reason)已定下的归因。
 */
import { describe, expect, it } from 'vitest'

import { applySubagentFailure, type Subagent } from '@/hooks/use-agent-progress'

function makeSubagent(): Subagent {
  return {
    id: 'sub-1',
    threadId: 'thread-1',
    nickname: 'validator',
    handle: '@validator',
    color: 'cyan',
    status: 'failed',
    spawnedAt: '2026-09-29T00:00:00.000Z',
  }
}

describe('applySubagentFailure — 弱文案永不覆盖强证据(G-937980)', () => {
  it('强证据(statusCode=401)在案后,后续仅文案更新不得覆盖 failureSource/failureKind', () => {
    const sub = makeSubagent()
    applySubagentFailure(sub, {
      failureReason: 'status 401: quota exceeded',
      statusCode: 401,
    })
    expect(sub.failureSource).toBe('provider')
    expect(sub.failureKind).toBe('auth_failed')
    expect(sub.failureAttributionStrong).toBe(true)

    // 后来 subagent_status 只带来一段泛化错误文案(无结构化字段)⇒ 整体不改写
    applySubagentFailure(sub, { error: '请求失败,请稍后重试' })
    expect(sub.failureReason).toBe('status 401: quota exceeded')
    expect(sub.failureKind).toBe('auth_failed')
  })

  it('强→强正常替换;弱→弱取最新(与改前行为一致)', () => {
    const sub = makeSubagent()
    applySubagentFailure(sub, { failureReason: 'write EPIPE', errorCode: 'EPIPE' })
    expect(sub.failureKind).toBe('network_error')
    // 强→强:新的结构化证据替换旧归因
    applySubagentFailure(sub, { failureReason: 'status 429: too many requests', statusCode: 429 })
    expect(sub.failureKind).toBe('rate_limited')
    expect(sub.failureSource).toBe('provider')
    // 弱→弱:取最新文案
    const weakSub = makeSubagent()
    applySubagentFailure(weakSub, { error: '网络异常' })
    expect(weakSub.failureKind).toBe('network_error')
    applySubagentFailure(weakSub, { error: '连接超时' })
    expect(weakSub.failureReason).toBe('连接超时')
    expect(weakSub.failureKind).toBe('timeout')
  })

  it('仅文案证据照常走阶梯(auth 先于 quota),不产生 unknown 之外的行为变化', () => {
    const sub = makeSubagent()
    applySubagentFailure(sub, { failureReason: 'Error: 401 Unauthorized — usage limit reached' })
    expect(sub.failureSource).toBe('provider')
    expect(sub.failureKind).toBe('auth_failed')
    expect(sub.failureAttributionStrong).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
