'use client'

import { selectClass } from '@/lib/edu'
import type { Paper } from './types'

interface Props {
  paperId: string
  onPaperChange: (v: string) => void
  papers: Paper[]
}

export function QuestionFilter({ paperId, onPaperChange, papers }: Props) {
  return (
    <div className="w-full max-w-sm">
      <select
        className={selectClass}
        value={paperId}
        onChange={(e) => onPaperChange(e.target.value)}
        aria-label="选择试卷"
      >
        <option value="">请选择试卷</option>
        {papers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
            {!p.isPublished ? '（未发布）' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
