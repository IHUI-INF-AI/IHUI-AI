import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { approvalMachine } from './approval-machine'

const getStateValue = (snap: ReturnType<ReturnType<typeof createActor<typeof approvalMachine>>['getSnapshot']>) =>
  typeof snap.value === 'string' ? snap.value : String(snap.value)

describe('approvalMachine', () => {
  it('初始状态为 draft', () => {
    const actor = createActor(approvalMachine)
    actor.start()
    expect(getStateValue(actor.getSnapshot())).toBe('draft')
    expect(actor.getSnapshot().context.submitCount).toBe(0)
  })

  it('draft → submitted (SUBMIT) → approved (APPROVE) 合法路径', () => {
    const actor = createActor(approvalMachine)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    expect(getStateValue(actor.getSnapshot())).toBe('submitted')
    expect(actor.getSnapshot().context.submitCount).toBe(1)
    actor.send({ type: 'APPROVE', approverId: 'admin-1' })
    expect(getStateValue(actor.getSnapshot())).toBe('approved')
    expect(actor.getSnapshot().context.approverId).toBe('admin-1')
  })

  it('draft → submitted → rejected (REJECT) 记录 reason', () => {
    const actor = createActor(approvalMachine)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'REJECT', approverId: 'admin-2', reason: '材料不全' })
    expect(getStateValue(actor.getSnapshot())).toBe('rejected')
    expect(actor.getSnapshot().context.rejectReason).toBe('材料不全')
  })

  it('rejected → submitted (RESUBMIT) 累加 submitCount', () => {
    const actor = createActor(approvalMachine)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'REJECT', approverId: 'a', reason: 'r' })
    actor.send({ type: 'RESUBMIT' })
    expect(getStateValue(actor.getSnapshot())).toBe('submitted')
    expect(actor.getSnapshot().context.submitCount).toBe(2)
  })

  it('approved → draft (REVOKE) 合法', () => {
    const actor = createActor(approvalMachine)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'APPROVE', approverId: 'a' })
    actor.send({ type: 'REVOKE' })
    expect(getStateValue(actor.getSnapshot())).toBe('draft')
  })

  it('draft 状态拒绝 APPROVE/REJECT 事件', () => {
    const actor = createActor(approvalMachine)
    actor.start()
    actor.send({ type: 'APPROVE', approverId: 'a' })
    expect(getStateValue(actor.getSnapshot())).toBe('draft')
    actor.send({ type: 'REJECT', approverId: 'a', reason: 'r' })
    expect(getStateValue(actor.getSnapshot())).toBe('draft')
  })

  it('submitted 状态拒绝 RESUBMIT 事件', () => {
    const actor = createActor(approvalMachine)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'RESUBMIT' })
    expect(getStateValue(actor.getSnapshot())).toBe('submitted')
  })

  it('cancelled 是终态,所有后续事件不改变状态', () => {
    const actor = createActor(approvalMachine)
    actor.start()
    actor.send({ type: 'CANCEL' })
    expect(getStateValue(actor.getSnapshot())).toBe('cancelled')
    actor.send({ type: 'SUBMIT' })
    expect(getStateValue(actor.getSnapshot())).toBe('cancelled')
  })
})
