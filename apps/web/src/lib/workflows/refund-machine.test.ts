import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { refundMachine } from './refund-machine'

const getStateValue = (snap: ReturnType<ReturnType<typeof createActor<typeof refundMachine>>['getSnapshot']>) =>
  typeof snap.value === 'string' ? snap.value : String(snap.value)

describe('refundMachine', () => {
  it('初始状态为 pending,retryCount = 0', () => {
    const actor = createActor(refundMachine)
    actor.start()
    expect(getStateValue(actor.getSnapshot())).toBe('pending')
    expect(actor.getSnapshot().context.retryCount).toBe(0)
  })

  it('pending → reviewing → refunding → refunded 完整成功路径', () => {
    const actor = createActor(refundMachine)
    actor.start()
    actor.send({ type: 'REVIEW', reviewerId: 'r-1' })
    expect(getStateValue(actor.getSnapshot())).toBe('reviewing')
    expect(actor.getSnapshot().context.reviewerId).toBe('r-1')
    actor.send({ type: 'APPROVE_REFUND' })
    expect(getStateValue(actor.getSnapshot())).toBe('refunding')
    actor.send({ type: 'REFUND_SUCCESS', transactionId: 'tx-001' })
    expect(getStateValue(actor.getSnapshot())).toBe('refunded')
    expect(actor.getSnapshot().context.transactionId).toBe('tx-001')
  })

  it('reviewing → rejected (REJECT) 记录 reason', () => {
    const actor = createActor(refundMachine)
    actor.start()
    actor.send({ type: 'REVIEW', reviewerId: 'r-1' })
    actor.send({ type: 'REJECT', reason: '金额不符' })
    expect(getStateValue(actor.getSnapshot())).toBe('rejected')
    expect(actor.getSnapshot().context.rejectReason).toBe('金额不符')
  })

  it('refunding → failed (REFUND_FAIL) 记录 error,RETRY 回到 refunding 累加 retryCount', () => {
    const actor = createActor(refundMachine)
    actor.start()
    actor.send({ type: 'REVIEW', reviewerId: 'r-1' })
    actor.send({ type: 'APPROVE_REFUND' })
    actor.send({ type: 'REFUND_FAIL', error: 'gateway timeout' })
    expect(getStateValue(actor.getSnapshot())).toBe('failed')
    expect(actor.getSnapshot().context.errorMessage).toBe('gateway timeout')
    actor.send({ type: 'RETRY' })
    expect(getStateValue(actor.getSnapshot())).toBe('refunding')
    expect(actor.getSnapshot().context.retryCount).toBe(1)
  })

  it('refunded 终态拒绝后续事件', () => {
    const actor = createActor(refundMachine)
    actor.start()
    actor.send({ type: 'REVIEW', reviewerId: 'r' })
    actor.send({ type: 'APPROVE_REFUND' })
    actor.send({ type: 'REFUND_SUCCESS', transactionId: 'tx' })
    actor.send({ type: 'RETRY' })
    expect(getStateValue(actor.getSnapshot())).toBe('refunded')
  })

  it('reviewing 状态不允许 RETRY', () => {
    const actor = createActor(refundMachine)
    actor.start()
    actor.send({ type: 'REVIEW', reviewerId: 'r' })
    actor.send({ type: 'RETRY' })
    expect(getStateValue(actor.getSnapshot())).toBe('reviewing')
  })

  it('pending → cancelled (CANCEL) 合法', () => {
    const actor = createActor(refundMachine)
    actor.start()
    actor.send({ type: 'CANCEL' })
    expect(getStateValue(actor.getSnapshot())).toBe('cancelled')
  })
})
