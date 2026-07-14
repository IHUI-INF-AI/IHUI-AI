import type { TForm, Topic } from './types'

export const PAGE_SIZE = 10

export const EMPTY: TForm = {
  title: '',
  content: '',
  lessonId: '',
  status: 'published',
  isPinned: false,
}

export const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  published: {
    label: 'statusPublished',
    cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  },
  draft: { label: 'statusDraft', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  hidden: { label: 'statusHidden', cls: 'bg-muted text-muted-foreground' },
}

export function topicToForm(t: Topic): TForm {
  return {
    title: t.title,
    content: t.content ?? '',
    lessonId: t.lessonId ?? '',
    status: t.status,
    isPinned: t.isPinned,
  }
}
