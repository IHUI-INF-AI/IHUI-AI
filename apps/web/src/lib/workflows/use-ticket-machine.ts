// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

'use client'

import { useWorkflowMachine } from './use-workflow-machine'
import {
  ticketMachine,
  type TicketEvent,
  type TicketContext,
  type TicketState,
} from './ticket-machine'

export interface UseTicketMachineReturn {
  state: TicketState
  context: TicketContext
  can: (event: { type: TicketEvent['type'] }) => boolean
  send: (event: TicketEvent) => void
}

export function useTicketMachine(): UseTicketMachineReturn {
  const [snapshot, send, canType] = useWorkflowMachine(ticketMachine)
  const state = (
    typeof snapshot?.value === 'string' ? snapshot.value : String(snapshot?.value ?? 'open')
  ) as TicketState
  const context = (snapshot?.context ?? { reopenCount: 0 }) as TicketContext

  return {
    state,
    context,
    can: canType,
    send: send as (e: TicketEvent) => void,
  }
}
