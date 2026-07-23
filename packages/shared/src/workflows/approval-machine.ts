import { setup, assign } from 'xstate'

/**
 * 审批状态机
 *
 * 状态流:draft → submitted → {approved | rejected}
 * - approved 可再撤回(revoke)回到 draft
 * - rejected 可重新提交(resubmit)回到 submitted
 * - cancelled 为终态(发起方主动撤销)
 */

export type ApprovalEvent =
  | { type: 'SUBMIT' }
  | { type: 'APPROVE'; approverId: string }
  | { type: 'REJECT'; approverId: string; reason: string }
  | { type: 'REVOKE' }
  | { type: 'RESUBMIT' }
  | { type: 'CANCEL' }

export interface ApprovalContext {
  approverId?: string
  rejectReason?: string
  submitCount: number
}

export const approvalMachine = setup({
  types: {
    context: {} as ApprovalContext,
    events: {} as ApprovalEvent,
  },
  guards: {
    hasApprover: ({ event }) => event.type !== 'APPROVE' || Boolean(event.approverId),
  },
  actions: {
    recordApprover: assign({
      approverId: ({ event }) => (event.type === 'APPROVE' ? event.approverId : undefined),
    }),
    recordRejection: assign({
      approverId: ({ event }) => (event.type === 'REJECT' ? event.approverId : undefined),
      rejectReason: ({ event }) => (event.type === 'REJECT' ? event.reason : undefined),
    }),
    incrementSubmit: assign({
      submitCount: ({ context }) => context.submitCount + 1,
    }),
  },
}).createMachine({
  id: 'approval',
  initial: 'draft',
  context: { submitCount: 0 },
  states: {
    draft: {
      on: {
        SUBMIT: { target: 'submitted', actions: 'incrementSubmit' },
        CANCEL: 'cancelled',
      },
    },
    submitted: {
      on: {
        APPROVE: { target: 'approved', guard: 'hasApprover', actions: 'recordApprover' },
        REJECT: { target: 'rejected', actions: 'recordRejection' },
        CANCEL: 'cancelled',
      },
    },
    approved: {
      on: {
        REVOKE: 'draft',
      },
    },
    rejected: {
      on: {
        RESUBMIT: { target: 'submitted', actions: 'incrementSubmit' },
        CANCEL: 'cancelled',
      },
    },
    cancelled: { type: 'final' },
  },
})

export type ApprovalState =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'cancelled'
