import type { QForm, QType } from './types'

export const TYPE_BADGE: Record<string, string> = {
  single_choice: 'bg-primary/10 text-primary',
  multi_choice: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  judgment: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  fill_blank: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  subjective: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  programming: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
}

export const TYPE_LABEL: Record<string, string> = {
  single_choice: 'typeLabel.single_choice',
  multi_choice: 'typeLabel.multi_choice',
  judgment: 'typeLabel.judgment',
  fill_blank: 'typeLabel.fill_blank',
  subjective: 'typeLabel.subjective',
  programming: 'typeLabel.programming',
}

export const TYPES: { value: QType; label: string }[] = [
  { value: 'single_choice', label: 'typeLabel.single_choice' },
  { value: 'multi_choice', label: 'typeLabel.multi_choice' },
  { value: 'judgment', label: 'typeLabel.judgment' },
  { value: 'fill_blank', label: 'typeLabel.fill_blank' },
  { value: 'subjective', label: 'typeLabel.subjective' },
  { value: 'programming', label: 'typeLabel.programming' },
]

export const EMPTY: QForm = {
  type: 'single_choice',
  title: '',
  score: '5',
  sortOrder: '0',
  options: '',
  answer: '',
  analysis: '',
}
