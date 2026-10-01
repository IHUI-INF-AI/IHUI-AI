// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  aggregateUsageFaces,
  toUsageFaceOutcome,
  type UsageFaceOutcome,
} from './usage-face-semantics'

describe('usage-face-semantics(G-652 必须面/可选面双语义降级)', () => {
  const statsOk: UsageFaceOutcome<{ points: number; followingCount: number; fansCount: number }> = {
    kind: 'ok',
    data: { points: 120, followingCount: 3, fansCount: 8 },
  }
  const walletOk: UsageFaceOutcome<{ balance: number }> = { kind: 'ok', data: { balance: 42.5 } }
  const faces = (wallet: UsageFaceOutcome<{ balance: number }>) => [
    { id: 'user-stats', mandatory: true, outcome: statsOk },
    { id: 'wallet-balance', mandatory: false, outcome: wallet },
  ]

  it('验收用例1:mock 429(可选面 transport 失败)⇒ aggregate 形状:该区清空 + dropped 计数行,其余区照常', () => {
    const result = aggregateUsageFaces(
      faces({ kind: 'failed', reason: 'transport', message: 'HTTP 429' }),
    )
    expect(result.shape).toBe('aggregate')
    if (result.shape !== 'aggregate') throw new Error('unreachable')
    const wallet = result.sections.find((s) => s.faceId === 'wallet-balance')
    // 区域清空(unavailable),绝不是"余额 0"
    expect(wallet?.status).toBe('unavailable')
    // 带 dropped 计数行:累计失败 1 次
    expect(result.dropped).toEqual([
      { faceId: 'wallet-balance', message: 'HTTP 429', count: 1 },
    ])
    // 其余区域照常
    expect(result.sections.find((s) => s.faceId === 'user-stats')?.status).toBe('ready')
    // 计数回传,调用方持久化
    expect(result.failureCounts['wallet-balance']).toBe(1)
  })

  it('验收用例2:mock 200+code!=0(信封失败)⇒ fatal 形状:整体红,绝不降级成零/清空', () => {
    const result = aggregateUsageFaces(
      faces({ kind: 'failed', reason: 'envelope', message: '后端报错' }),
    )
    // 整体上抛形状:没有 sections/dropped,不产生任何"零用量"渲染材料
    expect(result).toEqual({
      shape: 'fatal',
      faceId: 'wallet-balance',
      reason: 'envelope',
      mandatory: false,
      message: '后端报错',
    })
  })

  it('两条验收路径输出形状不得同形:aggregate 有 sections/dropped,fatal 两字段皆无', () => {
    const transport = aggregateUsageFaces(
      faces({ kind: 'failed', reason: 'transport', message: 'HTTP 429' }),
    )
    const envelope = aggregateUsageFaces(
      faces({ kind: 'failed', reason: 'envelope', message: '后端报错' }),
    )
    expect(transport.shape).not.toBe(envelope.shape)
    expect('sections' in transport && 'dropped' in transport).toBe(true)
    expect('sections' in envelope || 'dropped' in envelope).toBe(false)
    expect(Object.keys(envelope).sort()).not.toEqual(Object.keys(transport).sort())
  })

  it('必须面 transport 失败(429 打在 user-stats)也整体红 —— 必须面无降级资格', () => {
    const result = aggregateUsageFaces([
      { id: 'user-stats', mandatory: true, outcome: { kind: 'failed', reason: 'transport', message: 'HTTP 429' } },
      { id: 'wallet-balance', mandatory: false, outcome: walletOk },
    ])
    expect(result).toEqual({
      shape: 'fatal',
      faceId: 'user-stats',
      reason: 'transport',
      mandatory: true,
      message: 'HTTP 429',
    })
  })

  it('toUsageFaceOutcome:status===200 失败=信封;429/无 status(网络断)=transport;成功=ok', () => {
    expect(toUsageFaceOutcome({ success: false, error: '业务报错', status: 200 })).toEqual({
      kind: 'failed',
      reason: 'envelope',
      message: '业务报错',
    })
    expect(
      toUsageFaceOutcome({ success: false, error: 'too many requests', status: 429, retryAfter: 3 }),
    ).toEqual({ kind: 'failed', reason: 'transport', message: 'too many requests' })
    expect(toUsageFaceOutcome({ success: false, error: '网络异常' })).toEqual({
      kind: 'failed',
      reason: 'transport',
      message: '网络异常',
    })
    expect(toUsageFaceOutcome({ success: true, data: 7 })).toEqual({ kind: 'ok', data: 7 })
  })

  it('计数:priorFailures 累进、成功归零(恢复清账)、pending 不计数不产 dropped 行', () => {
    const failed = aggregateUsageFaces(
      faces({ kind: 'failed', reason: 'transport', message: 'HTTP 429' }),
      { 'wallet-balance': 3 },
    )
    if (failed.shape !== 'aggregate') throw new Error('unreachable')
    expect(failed.dropped[0]?.count).toBe(4)
    expect(failed.failureCounts['wallet-balance']).toBe(4)

    const recovered = aggregateUsageFaces(faces(walletOk), failed.failureCounts)
    if (recovered.shape !== 'aggregate') throw new Error('unreachable')
    expect(recovered.failureCounts['wallet-balance']).toBe(0)
    expect(recovered.dropped).toEqual([])

    const pending = aggregateUsageFaces([
      { id: 'user-stats', mandatory: true, outcome: null },
      { id: 'wallet-balance', mandatory: false, outcome: null },
    ])
    if (pending.shape !== 'aggregate') throw new Error('unreachable')
    expect(pending.dropped).toEqual([])
    expect(pending.sections.every((s) => s.status === 'pending')).toBe(true)
    expect(pending.failureCounts['wallet-balance']).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
