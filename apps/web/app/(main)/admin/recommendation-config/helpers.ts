import type { RecommendSlot, RecommendForm } from './types'

export const CONTENT_TYPE_LABEL: Record<RecommendSlot['contentType'], string> = {
  agent: 'Agent',
  article: 'Article',
  course: 'Course',
  activity: 'Activity',
  live: 'Live',
}

export const CONTENT_TYPE_STYLE: Record<RecommendSlot['contentType'], string> = {
  agent: 'bg-primary/10 text-primary',
  article: 'bg-emerald-500/10 text-emerald-600',
  course: 'bg-purple-500/10 text-purple-600',
  activity: 'bg-amber-500/10 text-amber-600',
  live: 'bg-red-500/10 text-red-600',
}

export const EMPTY_FORM: RecommendForm = {
  position: '',
  name: '',
  contentType: 'agent',
  sort: 0,
}

export const th = 'px-4 py-2.5 font-medium'

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export function slotToForm(s: RecommendSlot): RecommendForm {
  return { position: s.position, name: s.name, contentType: s.contentType, sort: s.sort }
}
