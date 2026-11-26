// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RP-7 审批反向通道契约测试：session 追溯 / 三队列 / 断线不丢 / 重连按序补发 /
 * 幂等 / 非法字段 fail-closed / 信任边界声明。
 */
import { describe, expect, it } from 'vitest'

import {
  APPROVAL_QUEUES,
  ApprovalChannel,
  ApprovalChannelError,
  assertApprovalRequest,
  type ApprovalRequest,
  type ChannelTrust,
} from '../src/index.js'

const TRUST: ChannelTrust = {
  transport: '\\\\.\\pipe\\ihui-approval',
  allowedPrincipals: ['S-1-5-21-current-user', 'S-1-5-18'],
}

function req(seq: number, id = `r${seq}`, sessionId = 'session-A'): ApprovalRequest {
  return {
    id,
    sessionId,
    seq,
    toolName: 'terminal_run',
    kind: 'terminal',
    createdAt: 1700000000000 + seq,
  }
}

describe('审批请求校验（fail-closed）', () => {
  it('合法请求通过', () => {
    expect(() => assertApprovalRequest(req(1))).not.toThrow()
  })

  it('空 id / 空 sessionId / 非单调 seq 之外的非法字段全拒', () => {
    expect(() => assertApprovalRequest({ ...req(1), id: '' })).toThrow(ApprovalChannelError)
    expect(() => assertApprovalRequest({ ...req(1), sessionId: '  ' })).toThrow(
      ApprovalChannelError,
    )
    expect(() => assertApprovalRequest({ ...req(1), seq: -1 })).toThrow(ApprovalChannelError)
    expect(() => assertApprovalRequest({ ...req(1), seq: 1.5 })).toThrow(ApprovalChannelError)
    expect(() => assertApprovalRequest({ ...req(1), toolName: '' })).toThrow(ApprovalChannelError)
    expect(() => assertApprovalRequest({ ...req(1), kind: 'unknown' as never })).toThrow(
      ApprovalChannelError,
    )
    expect(() => assertApprovalRequest({ ...req(1), createdAt: Number.NaN })).toThrow(
      ApprovalChannelError,
    )
  })
})

describe('三队列与 session 追溯', () => {
  it('三队列常量与请求 sessionId 都在', () => {
    expect(APPROVAL_QUEUES).toEqual(['pending', 'backup', 'recovery'])
    const ch = new ApprovalChannel(TRUST)
    ch.accept(req(1, 'r1', 'session-XYZ'))
    expect(ch.queue('pending')[0].sessionId).toBe('session-XYZ')
  })

  it('受理进入 pending，队列快照排序按 seq 而非到达顺序', () => {
    const ch = new ApprovalChannel(TRUST)
    ch.accept(req(3))
    ch.accept(req(1))
    ch.accept(req(2))
    expect(ch.queue('pending').map((r) => r.seq)).toEqual([1, 2, 3])
  })

  it('队列快照是副本：外部改动不污染内部状态', () => {
    const ch = new ApprovalChannel(TRUST)
    ch.accept(req(1))
    const snap = ch.queue('pending')
    snap[0].sessionId = 'tampered'
    expect(ch.queue('pending')[0].sessionId).toBe('session-A')
  })

  it('未知队列名 fail-closed', () => {
    const ch = new ApprovalChannel(TRUST)
    expect(() => ch.queue('bogus' as never)).toThrow(ApprovalChannelError)
  })
})

describe('断线不丢 / 重连按序补发', () => {
  it('断线把 pending 全量转 backup，pending 清空', () => {
    const ch = new ApprovalChannel(TRUST)
    ch.accept(req(1))
    ch.accept(req(2))
    ch.disconnect()
    expect(ch.isConnected()).toBe(false)
    expect(ch.queue('pending')).toHaveLength(0)
    expect(ch.queue('backup').map((r) => r.seq)).toEqual([1, 2])
  })

  it('断线期间到达的请求直接进 backup，不丢', () => {
    const ch = new ApprovalChannel(TRUST)
    ch.accept(req(1))
    ch.disconnect()
    ch.accept(req(2))
    ch.accept(req(3))
    expect(ch.queue('backup').map((r) => r.seq)).toEqual([1, 2, 3])
    expect(ch.queue('pending')).toHaveLength(0)
  })

  it('重连把 backup 按 seq 升序转 recovery，backup 清空', () => {
    const ch = new ApprovalChannel(TRUST)
    ch.accept(req(1))
    ch.disconnect()
    ch.accept(req(3))
    ch.accept(req(2)) // 到达乱序
    ch.reconnect()
    expect(ch.isConnected()).toBe(true)
    expect(ch.queue('backup')).toHaveLength(0)
    expect(ch.queue('recovery').map((r) => r.seq)).toEqual([1, 2, 3])
  })

  it('重连后新请求回 pending，不被塞进 recovery', () => {
    const ch = new ApprovalChannel(TRUST)
    ch.accept(req(1))
    ch.disconnect()
    ch.reconnect()
    ch.accept(req(2))
    expect(ch.queue('recovery').map((r) => r.seq)).toEqual([1])
    expect(ch.queue('pending').map((r) => r.seq)).toEqual([2])
  })

  it('重复断线/重连幂等，不产生重复请求', () => {
    const ch = new ApprovalChannel(TRUST)
    ch.accept(req(1))
    ch.disconnect()
    ch.disconnect()
    ch.reconnect()
    ch.reconnect()
    expect(ch.queue('recovery').map((r) => r.seq)).toEqual([1])
  })
})

describe('幂等与确认', () => {
  it('同 id 重复提交幂等：不产生第二条、不推进水位', () => {
    const ch = new ApprovalChannel(TRUST)
    ch.accept(req(1, 'dup'))
    ch.accept(req(1, 'dup'))
    expect(ch.queue('pending')).toHaveLength(1)
    expect(ch.watermark()).toBe(1)
  })

  it('乱序到达也收下，水位取最大 seq（补发按 seq 排序而非到达顺序）', () => {
    const ch = new ApprovalChannel(TRUST)
    ch.accept(req(5))
    ch.accept(req(4))
    expect(ch.queue('pending').map((r) => r.seq)).toEqual([4, 5])
    expect(ch.watermark()).toBe(5)
  })

  it('按 id 确认 recovery 请求，重复确认返回 false', () => {
    const ch = new ApprovalChannel(TRUST)
    ch.accept(req(1))
    ch.disconnect()
    ch.reconnect()
    expect(ch.acknowledge('r1')).toBe(true)
    expect(ch.acknowledge('r1')).toBe(false)
    expect(ch.queue('recovery')).toHaveLength(0)
  })

  it('空 id 确认 fail-closed', () => {
    const ch = new ApprovalChannel(TRUST)
    expect(() => ch.acknowledge('')).toThrow(ApprovalChannelError)
  })
})

describe('信任边界声明', () => {
  it('transport 为空 / principals 为空都拒', () => {
    expect(() => new ApprovalChannel({ ...TRUST, transport: '' })).toThrow(ApprovalChannelError)
    expect(() => new ApprovalChannel({ ...TRUST, allowedPrincipals: [] })).toThrow(
      ApprovalChannelError,
    )
  })

  it('信任边界可从通道读取，供 ACL 审计对照', () => {
    const ch = new ApprovalChannel(TRUST)
    expect(ch.trust.allowedPrincipals).toContain('S-1-5-18')
  })
})
