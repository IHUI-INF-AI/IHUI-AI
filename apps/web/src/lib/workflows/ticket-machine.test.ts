import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { ticketMachine } from './ticket-machine'

const getStateValue = (snap: ReturnType<ReturnType<typeof createActor<typeof ticketMachine>>['getSnapshot']>) =>
  typeof snap.value === 'string' ? snap.value : String(snap.value)

describe('ticketMachine', () => {
  it('初始状态为 open,reopenCount = 0', () => {
    const actor = createActor(ticketMachine)
    actor.start()
    expect(getStateValue(actor.getSnapshot())).toBe('open')
    expect(actor.getSnapshot().context.reopenCount).toBe(0)
  })

  it('open → assigned → in_progress → resolved 完整路径', () => {
    const actor = createActor(ticketMachine)
    actor.start()
    actor.send({ type: 'ASSIGN', assigneeId: 'cs-1' })
    expect(getStateValue(actor.getSnapshot())).toBe('assigned')
    expect(actor.getSnapshot().context.assigneeId).toBe('cs-1')
    actor.send({ type: 'START_WORK' })
    expect(getStateValue(actor.getSnapshot())).toBe('in_progress')
    actor.send({ type: 'RESOLVE', resolution: '已修复配置' })
    expect(getStateValue(actor.getSnapshot())).toBe('resolved')
    expect(actor.getSnapshot().context.resolution).toBe('已修复配置')
  })

  it('resolved → closed (CLOSE) 合法', () => {
    const actor = createActor(ticketMachine)
    actor.start()
    actor.send({ type: 'ASSIGN', assigneeId: 'cs' })
    actor.send({ type: 'START_WORK' })
    actor.send({ type: 'RESOLVE', resolution: 'ok' })
    actor.send({ type: 'CLOSE' })
    expect(getStateValue(actor.getSnapshot())).toBe('closed')
  })

  it('resolved → in_progress (REOPEN) 累加 reopenCount 并记录 reason', () => {
    const actor = createActor(ticketMachine)
    actor.start()
    actor.send({ type: 'ASSIGN', assigneeId: 'cs' })
    actor.send({ type: 'START_WORK' })
    actor.send({ type: 'RESOLVE', resolution: 'ok' })
    actor.send({ type: 'REOPEN', reason: '问题未解决' })
    expect(getStateValue(actor.getSnapshot())).toBe('in_progress')
    expect(actor.getSnapshot().context.reopenCount).toBe(1)
    expect(actor.getSnapshot().context.reopenReason).toBe('问题未解决')
  })

  it('open 状态拒绝 RESOLVE / CLOSE / START_WORK', () => {
    const actor = createActor(ticketMachine)
    actor.start()
    actor.send({ type: 'RESOLVE', resolution: 'r' })
    expect(getStateValue(actor.getSnapshot())).toBe('open')
    actor.send({ type: 'CLOSE' })
    expect(getStateValue(actor.getSnapshot())).toBe('open')
    actor.send({ type: 'START_WORK' })
    expect(getStateValue(actor.getSnapshot())).toBe('open')
  })

  it('in_progress 状态拒绝 ASSIGN / REOPEN', () => {
    const actor = createActor(ticketMachine)
    actor.start()
    actor.send({ type: 'ASSIGN', assigneeId: 'cs' })
    actor.send({ type: 'START_WORK' })
    actor.send({ type: 'ASSIGN', assigneeId: 'cs-2' })
    expect(getStateValue(actor.getSnapshot())).toBe('in_progress')
    expect(actor.getSnapshot().context.assigneeId).toBe('cs')
    actor.send({ type: 'REOPEN', reason: 'r' })
    expect(getStateValue(actor.getSnapshot())).toBe('in_progress')
  })

  it('closed 终态拒绝所有事件', () => {
    const actor = createActor(ticketMachine)
    actor.start()
    actor.send({ type: 'ASSIGN', assigneeId: 'cs' })
    actor.send({ type: 'START_WORK' })
    actor.send({ type: 'RESOLVE', resolution: 'r' })
    actor.send({ type: 'CLOSE' })
    actor.send({ type: 'REOPEN', reason: 'r' })
    expect(getStateValue(actor.getSnapshot())).toBe('closed')
  })
})
