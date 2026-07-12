import type { FeedbackStatus, Priority } from './types'

export const STATUSES: FeedbackStatus[] = ['pending', 'reviewing', 'resolved', 'closed']
export const PRIORITIES: Priority[] = ['low', 'medium', 'high']

export const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
