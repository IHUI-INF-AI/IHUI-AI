import type { MForm, Map } from './types'

export const PAGE_SIZE = 10

export const EMPTY: MForm = {
  title: '',
  description: '',
  cover: '',
  sort: '0',
  isPublished: false,
}

export const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: {
    label: 'statusDraft',
    cls: 'bg-muted text-muted-foreground',
  },
  published: {
    label: 'statusPublished',
    cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  },
}

export function mapToForm(m: Map): MForm {
  return {
    title: m.title,
    description: m.description ?? '',
    cover: m.cover ?? '',
    sort: String(m.sort),
    isPublished: m.isPublished,
  }
}
