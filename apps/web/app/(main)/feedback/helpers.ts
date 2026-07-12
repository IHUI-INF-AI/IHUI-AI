import type { FeedbackType } from './types'

export const TYPES: FeedbackType[] = ['bug', 'feature', 'improvement', 'other']

export const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
