'use client'

import { useWorkflowMachine } from './use-workflow-machine'
import {
  refundMachine,
  type RefundEvent,
  type RefundContext,
  type RefundState,
} from './refund-machine'

export interface UseRefundMachineReturn {
  state: RefundState
  context: RefundContext
  can: (event: { type: RefundEvent['type'] }) => boolean
  send: (event: RefundEvent) => void
}

export function useRefundMachine(): UseRefundMachineReturn {
  const [snapshot, send, canType] = useWorkflowMachine(refundMachine)
  const state = (typeof snapshot?.value === 'string'
    ? snapshot.value
    : String(snapshot?.value ?? 'pending')) as RefundState
  const context = (snapshot?.context ?? { retryCount: 0 }) as RefundContext

  return {
    state,
    context,
    can: canType,
    send: send as (e: RefundEvent) => void,
  }
}
