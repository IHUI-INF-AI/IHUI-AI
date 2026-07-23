import { setup, assign } from 'xstate'

/**
 * 工单状态机
 *
 * 状态流:open → assigned → in_progress → {resolved | closed}
 * - open:用户提交,等待分配
 * - assigned:已分配给客服/工程师
 * - in_progress:处理中
 * - resolved:已解决(用户确认前可 reopen)
 * - closed:用户确认解决或超时自动关闭
 * - reopened → 回到 in_progress
 */

export type TicketEvent =
  | { type: 'ASSIGN'; assigneeId: string }
  | { type: 'START_WORK' }
  | { type: 'RESOLVE'; resolution: string }
  | { type: 'REOPEN'; reason: string }
  | { type: 'CLOSE' }
  | { type: 'REJECT'; reason: string }

export interface TicketContext {
  assigneeId?: string
  resolution?: string
  reopenReason?: string
  rejectReason?: string
  reopenCount: number
}

export const ticketMachine = setup({
  types: {
    context: {} as TicketContext,
    events: {} as TicketEvent,
  },
  guards: {
    hasAssignee: ({ event }) => event.type !== 'ASSIGN' || Boolean(event.assigneeId),
  },
  actions: {
    recordAssignee: assign({
      assigneeId: ({ event }) => (event.type === 'ASSIGN' ? event.assigneeId : undefined),
    }),
    recordResolution: assign({
      resolution: ({ event }) => (event.type === 'RESOLVE' ? event.resolution : undefined),
    }),
    recordReopen: assign({
      reopenReason: ({ event }) => (event.type === 'REOPEN' ? event.reason : undefined),
      reopenCount: ({ context }) => context.reopenCount + 1,
    }),
    recordRejection: assign({
      rejectReason: ({ event }) => (event.type === 'REJECT' ? event.reason : undefined),
    }),
  },
}).createMachine({
  id: 'ticket',
  initial: 'open',
  context: { reopenCount: 0 },
  states: {
    open: {
      on: {
        ASSIGN: { target: 'assigned', guard: 'hasAssignee', actions: 'recordAssignee' },
        REJECT: { target: 'rejected', actions: 'recordRejection' },
      },
    },
    assigned: {
      on: {
        START_WORK: 'in_progress',
        REJECT: { target: 'rejected', actions: 'recordRejection' },
      },
    },
    in_progress: {
      on: {
        RESOLVE: { target: 'resolved', actions: 'recordResolution' },
      },
    },
    resolved: {
      on: {
        REOPEN: { target: 'in_progress', actions: 'recordReopen' },
        CLOSE: 'closed',
      },
    },
    closed: { type: 'final' },
    rejected: { type: 'final' },
  },
})

export type TicketState =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'closed'
  | 'rejected'
