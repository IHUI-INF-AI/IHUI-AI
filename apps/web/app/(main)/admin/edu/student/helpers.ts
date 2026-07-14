import type { SForm } from './types'

export const EMPTY: SForm = { nickname: '', phone: '', email: '', level: '1', status: 1 }

export const PAGE_SIZE = 10

export const LEVEL_MAP: Record<number, string> = {
  1: 'beginner',
  2: 'intermediate',
  3: 'advanced',
  4: 'expert',
}
