import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { withdrawalMachine, WITHDRAWAL_AUTO_APPROVE_THRESHOLD } from './withdrawal-machine'

const getStateValue = (
  snap: ReturnType<ReturnType<typeof createActor<typeof withdrawalMachine>>['getSnapshot']>,
) => (typeof snap.value === 'string' ? snap.value : String(snap.value))

describe('withdrawalMachine', () => {
  it('初始状态为 requested', () => {
    const actor = createActor(withdrawalMachine)
    actor.start()
    expect(getStateValue(actor.getSnapshot())).toBe('requested')
    expect(actor.getSnapshot().context.amount).toBe(0)
  })

  it(`小额 (< ${WITHDRAWAL_AUTO_APPROVE_THRESHOLD}) AUTO_APPROVE 直接进入 paying`, () => {
    const actor = createActor(withdrawalMachine)
    actor.start()
    actor.send({ type: 'AUTO_APPROVE', amount: 50 })
    expect(getStateValue(actor.getSnapshot())).toBe('paying')
    expect(actor.getSnapshot().context.amount).toBe(50)
  })

  it(`大额 (>= ${WITHDRAWAL_AUTO_APPROVE_THRESHOLD}) AUTO_APPROVE 进入 verifying`, () => {
    const actor = createActor(withdrawalMachine)
    actor.start()
    actor.send({ type: 'AUTO_APPROVE', amount: 500 })
    expect(getStateValue(actor.getSnapshot())).toBe('verifying')
    expect(actor.getSnapshot().context.amount).toBe(500)
  })

  it('verifying → approved → paying → paid 完整人工审核路径', () => {
    const actor = createActor(withdrawalMachine)
    actor.start()
    actor.send({ type: 'AUTO_APPROVE', amount: 500 })
    actor.send({ type: 'APPROVE', approverId: 'a-1' })
    expect(getStateValue(actor.getSnapshot())).toBe('approved')
    expect(actor.getSnapshot().context.approverId).toBe('a-1')
    actor.send({ type: 'PAY' })
    expect(getStateValue(actor.getSnapshot())).toBe('paying')
    actor.send({ type: 'PAY_SUCCESS', transactionId: 'tx-w-1', paidAt: '2026-07-20T00:00:00Z' })
    expect(getStateValue(actor.getSnapshot())).toBe('paid')
    expect(actor.getSnapshot().context.transactionId).toBe('tx-w-1')
    expect(actor.getSnapshot().context.paidAt).toBe('2026-07-20T00:00:00Z')
  })

  it('verifying → rejected (REJECT) 记录 reason', () => {
    const actor = createActor(withdrawalMachine)
    actor.start()
    actor.send({ type: 'AUTO_APPROVE', amount: 500 })
    actor.send({ type: 'REJECT', reason: '账户风险' })
    expect(getStateValue(actor.getSnapshot())).toBe('rejected')
    expect(actor.getSnapshot().context.rejectReason).toBe('账户风险')
  })

  it('paying → failed → paying (RETRY) 累加 retryCount', () => {
    const actor = createActor(withdrawalMachine)
    actor.start()
    actor.send({ type: 'AUTO_APPROVE', amount: 50 })
    actor.send({ type: 'PAY_FAIL', error: 'insufficient funds' })
    expect(getStateValue(actor.getSnapshot())).toBe('failed')
    expect(actor.getSnapshot().context.errorMessage).toBe('insufficient funds')
    actor.send({ type: 'RETRY' })
    expect(getStateValue(actor.getSnapshot())).toBe('paying')
    expect(actor.getSnapshot().context.retryCount).toBe(1)
  })

  it('failed 状态不允许 APPROVE', () => {
    const actor = createActor(withdrawalMachine)
    actor.start()
    actor.send({ type: 'AUTO_APPROVE', amount: 50 })
    actor.send({ type: 'PAY_FAIL', error: 'e' })
    actor.send({ type: 'APPROVE', approverId: 'a' })
    expect(getStateValue(actor.getSnapshot())).toBe('failed')
  })

  it('requested 状态允许 CANCEL', () => {
    const actor = createActor(withdrawalMachine)
    actor.start()
    actor.send({ type: 'CANCEL' })
    expect(getStateValue(actor.getSnapshot())).toBe('cancelled')
  })
})
