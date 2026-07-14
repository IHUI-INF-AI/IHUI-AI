'use client'

import { useTranslations } from 'next-intl'
import { Input } from '@ihui/ui'
import type { Question } from './types'

interface Props {
  question: Question
  value: unknown
  onChange: (v: unknown) => void
}

export function AnswerInput({ question, value, onChange }: Props) {
  const t = useTranslations('admin.edu.answer.online')
  const opts = Array.isArray(question.options)
    ? (question.options as Array<{ key: string; text: string }>)
    : []
  if (question.type === 'single_choice') {
    return (
      <div className="space-y-1">
        {opts.map((o) => (
          <label key={o.key} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name={question.id}
              checked={value === o.key}
              onChange={() => onChange(o.key)}
              className="h-4 w-4"
            />
            <span>
              <b className="mr-1">{o.key}.</b>
              {o.text}
            </span>
          </label>
        ))}
      </div>
    )
  }
  if (question.type === 'multi_choice') {
    const cur = Array.isArray(value) ? (value as string[]) : []
    function toggle(k: string) {
      onChange(cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k])
    }
    return (
      <div className="space-y-1">
        {opts.map((o) => (
          <label key={o.key} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cur.includes(o.key)}
              onChange={() => toggle(o.key)}
              className="h-4 w-4"
            />
            <span>
              <b className="mr-1">{o.key}.</b>
              {o.text}
            </span>
          </label>
        ))}
      </div>
    )
  }
  if (question.type === 'judgment') {
    return (
      <div className="flex gap-4">
        <label className="flex cursor-pointer items-center gap-1 text-sm">
          <input
            type="radio"
            name={question.id}
            checked={value === true}
            onChange={() => onChange(true)}
            className="h-4 w-4"
          />
          {t('correct')}
        </label>
        <label className="flex cursor-pointer items-center gap-1 text-sm">
          <input
            type="radio"
            name={question.id}
            checked={value === false}
            onChange={() => onChange(false)}
            className="h-4 w-4"
          />
          {t('wrong')}
        </label>
      </div>
    )
  }
  if (question.type === 'fill_blank') {
    return (
      <Input
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('fillBlankPlaceholder')}
        className="h-9"
      />
    )
  }
  return (
    <textarea
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      rows={4}
      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      placeholder={t('answerPlaceholder')}
    />
  )
}
