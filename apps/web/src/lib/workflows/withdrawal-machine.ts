import { setup, assign } from 'xstate'

/**
 * 提现状态机
 *
 * 状态流:requested → {verifying | auto_approved}
 * - verifying → {approved | rejected}
 * - approved → paying → {paid | failed}
 * - failed 可重试(retry)回到 paying
 * - auto_approved(小额免审) → paying
 */

export type WithdrawalEvent =
  | { type: 'AUTO_APPROVE'; amount: number }
  | { type: 'START_VERIFY' }
  | { type: 'APPROVE'; approverId: string }
  | { type: 'REJECT'; reason: string }
  | { type: 'PAY' }
  | { type: 'PAY_SUCCESS'; transactionId: string; paidAt: string }
  | { type: 'PAY_FAIL'; error: string }
  | { type: 'RETRY' }
  | { type: 'CANCEL' }

export interface WithdrawalContext {
  amount: number
  approverId?: string
  rejectReason?: string
  transactionId?: string
  paidAt?: string
  errorMessage?: string
  retryCount: number
}

const AUTO_APPROVE_THRESHOLD = 100

export const withdrawalMachine = setup({
  types: {
    context: {} as WithdrawalContext,
    events: {} as WithdrawalEvent,
  },
  guards: {
    isBelowAutoApproveThreshold: ({ event }) =>
      event.type === 'AUTO_APPROVE' && event.amount < AUTO_APPROVE_THRESHOLD,
    isAboveAutoApproveThreshold: ({ event }) =>
      event.type === 'AUTO_APPROVE' && event.amount >= AUTO_APPROVE_THRESHOLD,
  },
  actions: {
    setAmount: assign({
      amount: ({ event }) => (event.type === 'AUTO_APPROVE' ? event.amount : 0),
    }),
    recordApprover: assign({
      approverId: ({ event }) => (event.type === 'APPROVE' ? event.approverId : undefined),
    }),
    recordRejection: assign({
      rejectReason: ({ event }) => (event.type === 'REJECT' ? event.reason : undefined),
    }),
    recordTransaction: assign({
      transactionId: ({ event }) => (event.type === 'PAY_SUCCESS' ? event.transactionId : undefined),
      paidAt: ({ event }) => (event.type === 'PAY_SUCCESS' ? event.paidAt : undefined),
    }),
    recordError: assign({
      errorMessage: ({ event }) => (event.type === 'PAY_FAIL' ? event.error : undefined),
    }),
    incrementRetry: assign({
      retryCount: ({ context }) => context.retryCount + 1,
    }),
  },
}).createMachine({
  id: 'withdrawal',
  initial: 'requested',
  context: { amount: 0, retryCount: 0 },
  states: {
    requested: {
      on: {
        AUTO_APPROVE: [
          { target: 'paying', guard: 'isBelowAutoApproveThreshold', actions: 'setAmount' },
          { target: 'verifying', actions: 'setAmount' },
        ],
        CANCEL: 'cancelled',
      },
    },
    verifying: {
      on: {
        APPROVE: { target: 'approved', actions: 'recordApprover' },
        REJECT: { target: 'rejected', actions: 'recordRejection' },
      },
    },
    approved: {
      on: {
        PAY: 'paying',
        CANCEL: 'cancelled',
      },
    },
    paying: {
      on: {
        PAY_SUCCESS: { target: 'paid', actions: 'recordTransaction' },
        PAY_FAIL: { target: 'failed', actions: 'recordError' },
      },
    },
    paid: { type: 'final' },
    rejected: { type: 'final' },
    failed: {
      on: {
        RETRY: { target: 'paying', actions: 'incrementRetry' },
        CANCEL: 'cancelled',
      },
    },
    cancelled: { type: 'final' },
  },
})

export type WithdrawalState =
  | 'requested'
  | 'verifying'
  | 'approved'
  | 'paying'
  | 'paid'
  | 'rejected'
  | 'failed'
  | 'cancelled'

export const WITHDRAWAL_AUTO_APPROVE_THRESHOLD = AUTO_APPROVE_THRESHOLD
