'use client'
import Link from 'next/link'
import { ChevronLeft, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { selectClass } from '@/lib/edu'
import { Button, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { TYPES } from './helpers'
import type { Paper } from './types'

interface Props {
  paperId: string
  onPaperChange: (v: string) => void
  typeFilter: string
  onTypeFilterChange: (v: string) => void
  papers: Paper[]
  onCreate: () => void
}

export function QuestionsFilter({
  paperId,
  onPaperChange,
  typeFilter,
  onTypeFilterChange,
  papers,
  onCreate,
}: Props) {
  const tc = useTranslations('admin.edu.exam.questions')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/edu/exam">
          <ChevronLeft className="h-4 w-4" />
          {tc('backToExam')}
        </Link>
      </Button>
      <div className="w-full max-w-sm">
        <Select value={paperId} onValueChange={onPaperChange}>
          <SelectTrigger className={selectClass} aria-label={tc('selectPaper')}>
            <SelectValue placeholder={tc('selectPaperPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {papers.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
                {!p.isPublished ? tc('unpublishedSuffix') : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full max-w-[160px]">
        <Select value={typeFilter} onValueChange={onTypeFilterChange}>
          <SelectTrigger className={selectClass} aria-label={tc('typeFilterLabel')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tc('allTypes')}</SelectItem>
            {TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {tc(t.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={onCreate} size="sm" className="ml-auto" disabled={!paperId}>
        <Plus className="h-4 w-4" />
        {tc('createTitle')}
      </Button>
    </div>
  )
}
