import type { TForm, Topic } from './types'

export const PAGE_SIZE = 10

export const EMPTY: TForm = {
  title: '',
  image: '',
  description: '',
  price: '0',
  originalPrice: '0',
  status: 'draft',
}

export const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: 'statusDraft', cls: 'bg-muted text-muted-foreground' },
  published: {
    label: 'statusPublished',
    cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  },
}

export function topicToForm(t: Topic): TForm {
  return {
    title: t.title,
    image: t.image,
    description: t.description,
    price: t.price ?? '0',
    originalPrice: t.originalPrice ?? '0',
    status: t.status,
  }
}
