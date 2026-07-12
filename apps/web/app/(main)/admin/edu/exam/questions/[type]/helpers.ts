import type { Question, QForm } from './types'

export const TYPE_LABEL: Record<string, string> = {
  single: '单选题',
  multi: '多选题',
  judgment: '判断题',
  fill: '填空题',
  subjective: '简答题',
  programming: '编程题',
}

export const TYPE_API: Record<string, string> = {
  single: 'single_choice',
  multi: 'multi_choice',
  judgment: 'judgment',
  fill: 'fill_blank',
  subjective: 'subjective',
  programming: 'programming',
}

export const EMPTY: QForm = {
  title: '',
  score: '5',
  sortOrder: '0',
  options: '',
  answer: '',
  analysis: '',
}

export function questionToForm(q: Question): QForm {
  return {
    title: q.title,
    score: q.score,
    sortOrder: String(q.sortOrder),
    options: q.options ? JSON.stringify(q.options, null, 2) : '',
    answer: q.answer ? JSON.stringify(q.answer, null, 2) : '',
    analysis: q.analysis || '',
  }
}

export function buildBody(apiType: string, form: QForm): Record<string, unknown> {
  const body: Record<string, unknown> = {
    type: apiType,
    title: form.title.trim(),
    score: form.score,
    sortOrder: Number(form.sortOrder) || 0,
  }
  if (form.options.trim()) body.options = JSON.parse(form.options)
  if (form.answer.trim()) body.answer = JSON.parse(form.answer)
  if (form.analysis.trim()) body.analysis = form.analysis.trim()
  return body
}
