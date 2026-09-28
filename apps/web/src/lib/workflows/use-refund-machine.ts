// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
  const state = (
    typeof snapshot?.value === 'string' ? snapshot.value : String(snapshot?.value ?? 'pending')
  ) as RefundState
  const context = (snapshot?.context ?? { retryCount: 0 }) as RefundContext

  return {
    state,
    context,
    can: canType,
    send: send as (e: RefundEvent) => void,
  }
}
