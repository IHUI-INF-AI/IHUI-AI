import { setup, assign } from 'xstate'

/**
 * 退款状态机
 *
 * 状态流:pending → reviewing → {refunding | rejected}
 * - refunding → {refunded | failed}
 * - failed 可重试(retry)回到 refunding
 */

export type RefundEvent =
  | { type: 'REVIEW'; reviewerId: string }
  | { type: 'APPROVE_REFUND' }
  | { type: 'REJECT'; reason: string }
  | { type: 'REFUND_SUCCESS'; transactionId: string }
  | { type: 'REFUND_FAIL'; error: string }
  | { type: 'RETRY' }
  | { type: 'CANCEL' }

export interface RefundContext {
  reviewerId?: string
  rejectReason?: string
  transactionId?: string
  errorMessage?: string
  retryCount: number
}

export const refundMachine = setup({
  types: {
    context: {} as RefundContext,
    events: {} as RefundEvent,
  },
  actions: {
    recordReviewer: assign({
      reviewerId: ({ event }) => (event.type === 'REVIEW' ? event.reviewerId : undefined),
    }),
    recordRejection: assign({
      rejectReason: ({ event }) => (event.type === 'REJECT' ? event.reason : undefined),
    }),
    recordTransaction: assign({
      transactionId: ({ event }) => (event.type === 'REFUND_SUCCESS' ? event.transactionId : undefined),
    }),
    recordError: assign({
      errorMessage: ({ event }) => (event.type === 'REFUND_FAIL' ? event.error : undefined),
    }),
    incrementRetry: assign({
      retryCount: ({ context }) => context.retryCount + 1,
    }),
  },
}).createMachine({
  id: 'refund',
  initial: 'pending',
  context: { retryCount: 0 },
  states: {
    pending: {
      on: {
        REVIEW: { target: 'reviewing', actions: 'recordReviewer' },
        CANCEL: 'cancelled',
      },
    },
    reviewing: {
      on: {
        APPROVE_REFUND: 'refunding',
        REJECT: { target: 'rejected', actions: 'recordRejection' },
      },
    },
    refunding: {
      on: {
        REFUND_SUCCESS: { target: 'refunded', actions: 'recordTransaction' },
        REFUND_FAIL: { target: 'failed', actions: 'recordError' },
      },
    },
    refunded: { type: 'final' },
    rejected: { type: 'final' },
    failed: {
      on: {
        RETRY: { target: 'refunding', actions: 'incrementRetry' },
        CANCEL: 'cancelled',
      },
    },
    cancelled: { type: 'final' },
  },
})

export type RefundState =
  | 'pending'
  | 'reviewing'
  | 'refunding'
  | 'refunded'
  | 'rejected'
  | 'failed'
  | 'cancelled'
