'use client'

import { useWorkflowMachine } from './use-workflow-machine'
import {
  approvalMachine,
  type ApprovalEvent,
  type ApprovalContext,
  type ApprovalState,
} from './approval-machine'

/**
 * 审批状态机 React hook。
 *
 * 业务约束:
 * - 仅由 admin 端调用,服务端只接收合法转换
 * - APPROVE 事件必须携带 approverId(由 guard 强制)
 * - 终态(cancelled)后 send 调用为 no-op
 */
export interface UseApprovalMachineReturn {
  state: ApprovalState
  context: ApprovalContext
  can: (event: { type: ApprovalEvent['type'] }) => boolean
  send: (event: ApprovalEvent) => void
}

export function useApprovalMachine(): UseApprovalMachineReturn {
  const [snapshot, send, canType] = useWorkflowMachine(approvalMachine)
  const state = (typeof snapshot?.value === 'string'
    ? snapshot.value
    : String(snapshot?.value ?? 'draft')) as ApprovalState
  const context = (snapshot?.context ?? { submitCount: 0 }) as ApprovalContext

  return {
    state,
    context,
    can: canType,
    send: send as (e: ApprovalEvent) => void,
  }
}
