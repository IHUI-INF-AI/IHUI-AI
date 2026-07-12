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
  single_choice: '单选题',
  multi_choice: '多选题',
  judgment: '判断题',
  fill_blank: '填空题',
  subjective: '简答题',
  programming: '编程题',
}

export const TYPES: { value: QType; label: string }[] = [
  { value: 'single_choice', label: '单选题' },
  { value: 'multi_choice', label: '多选题' },
  { value: 'judgment', label: '判断题' },
  { value: 'fill_blank', label: '填空题' },
  { value: 'subjective', label: '简答题' },
  { value: 'programming', label: '编程题' },
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
