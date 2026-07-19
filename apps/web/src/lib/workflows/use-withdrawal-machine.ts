'use client'

import { useWorkflowMachine } from './use-workflow-machine'
import {
  withdrawalMachine,
  type WithdrawalEvent,
  type WithdrawalContext,
  type WithdrawalState,
} from './withdrawal-machine'

export interface UseWithdrawalMachineReturn {
  state: WithdrawalState
  context: WithdrawalContext
  can: (event: { type: WithdrawalEvent['type'] }) => boolean
  send: (event: WithdrawalEvent) => void
}

export function useWithdrawalMachine(): UseWithdrawalMachineReturn {
  const [snapshot, send, canType] = useWorkflowMachine(withdrawalMachine)
  const state = (typeof snapshot?.value === 'string'
    ? snapshot.value
    : String(snapshot?.value ?? 'requested')) as WithdrawalState
  const context = (snapshot?.context ?? { amount: 0, retryCount: 0 }) as WithdrawalContext

  return {
    state,
    context,
    can: canType,
    send: send as (e: WithdrawalEvent) => void,
  }
}
