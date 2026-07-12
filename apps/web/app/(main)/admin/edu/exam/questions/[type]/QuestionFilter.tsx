'use client'

import { useTranslations } from 'next-intl'
import { selectClass } from '@/lib/edu'
import type { Paper } from './types'

interface Props {
  paperId: string
  onPaperChange: (v: string) => void
  papers: Paper[]
}

export function QuestionFilter({ paperId, onPaperChange, papers }: Props) {
  const t = useTranslations('admin.edu.exam.questionsType')
  return (
    <div className="w-full max-w-sm">
      <select
        className={selectClass}
        value={paperId}
        onChange={(e) => onPaperChange(e.target.value)}
        aria-label={t('selectPaper')}
      >
        <option value="">{t('selectPaperPlaceholder')}</option>
        {papers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
            {!p.isPublished ? t('unpublished') : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
