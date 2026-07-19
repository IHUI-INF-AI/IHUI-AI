// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWorkflowMachine } from './use-workflow-machine'
import { approvalMachine } from './approval-machine'
import { refundMachine } from './refund-machine'
import { ticketMachine } from './ticket-machine'
import { withdrawalMachine } from './withdrawal-machine'

describe('useWorkflowMachine - can() 助手 (宽松检查:只看事件类型是否在当前 state 的 transition 表中)', () => {
  it('approval draft: SUBMIT/CANCEL 可点,APPROVE/REJECT 不可点', () => {
    const { result } = renderHook(() => {
      const [, , can] = useWorkflowMachine(approvalMachine)
      return can
    })
    expect(result.current({ type: 'SUBMIT' })).toBe(true)
    expect(result.current({ type: 'CANCEL' })).toBe(true)
    expect(result.current({ type: 'APPROVE' })).toBe(false)
    expect(result.current({ type: 'REJECT' })).toBe(false)
  })

  it('refund pending: REVIEW/CANCEL 可点,APPROVE_REFUND/REJECT 不可点', () => {
    const { result } = renderHook(() => {
      const [, , can] = useWorkflowMachine(refundMachine)
      return can
    })
    expect(result.current({ type: 'REVIEW' })).toBe(true)
    expect(result.current({ type: 'CANCEL' })).toBe(true)
    expect(result.current({ type: 'APPROVE_REFUND' })).toBe(false)
    expect(result.current({ type: 'REJECT' })).toBe(false)
  })

  it('ticket open: ASSIGN/REJECT 可点(忽略 guard),START_WORK/RESOLVE 不可点', () => {
    const { result } = renderHook(() => {
      const [, , can] = useWorkflowMachine(ticketMachine)
      return can
    })
    // 宽松检查:虽然 ASSIGN 有 guard (hasAssignee) 要求 assigneeId,
    // 但 can() 只检查事件类型是否在 transition 表中,忽略 guard 字段
    expect(result.current({ type: 'ASSIGN' })).toBe(true)
    expect(result.current({ type: 'REJECT' })).toBe(true)
    // 终态事件不在 open 的 transition 表中
    expect(result.current({ type: 'START_WORK' })).toBe(false)
    expect(result.current({ type: 'RESOLVE' })).toBe(false)
  })

  it('withdrawal requested: AUTO_APPROVE/CANCEL 可点(忽略 guard 字段),APPROVE 不可点', () => {
    const { result } = renderHook(() => {
      const [, , can] = useWorkflowMachine(withdrawalMachine)
      return can
    })
    // 宽松检查:虽然 AUTO_APPROVE 的 guard 需要 amount 字段,
    // 但 can() 只检查事件类型是否在 transition 表中
    expect(result.current({ type: 'AUTO_APPROVE' })).toBe(true)
    expect(result.current({ type: 'CANCEL' })).toBe(true)
    // APPROVE 不在 requested 的 transition 表中
    expect(result.current({ type: 'APPROVE' })).toBe(false)
  })

  it('approval draft → submitted 状态切换后 can() 反映新状态', async () => {
    const { result } = renderHook(() => useWorkflowMachine(approvalMachine))
    expect(result.current[2]({ type: 'APPROVE' })).toBe(false) // draft: 无 APPROVE
    act(() => {
      result.current[1]({ type: 'SUBMIT' })
    })
    expect(result.current[2]({ type: 'APPROVE' })).toBe(true) // submitted: 有 APPROVE (忽略 guard)
    expect(result.current[2]({ type: 'SUBMIT' })).toBe(false) // submitted: 无 SUBMIT
  })
})

describe('useWorkflowMachine - send() 状态推进', () => {
  it('approval: SUBMIT 推进 draft → submitted', () => {
    const { result } = renderHook(() => useWorkflowMachine(approvalMachine))
    expect((result.current[0] as { value: unknown }).value).toBe('draft')
    act(() => {
      result.current[1]({ type: 'SUBMIT' })
    })
    expect((result.current[0] as { value: unknown }).value).toBe('submitted')
  })

  it('approval: SUBMIT 累加 submitCount', () => {
    const { result } = renderHook(() => useWorkflowMachine(approvalMachine))
    act(() => {
      result.current[1]({ type: 'SUBMIT' })
    })
    expect((result.current[0] as { context: { submitCount: number } }).context.submitCount).toBe(1)
  })

  it('withdrawal: AUTO_APPROVE(amount=50) 走小额直接 paying 路径', () => {
    const { result } = renderHook(() => useWorkflowMachine(withdrawalMachine))
    act(() => {
      result.current[1]({ type: 'AUTO_APPROVE', amount: 50 })
    })
    expect((result.current[0] as { value: unknown }).value).toBe('paying')
  })
})
