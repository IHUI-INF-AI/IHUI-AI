'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Plus, ChevronLeft } from 'lucide-react'
import { Button, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { selectClass } from './helpers'
import type { Lesson } from './types'

interface Props {
  lessonId: string
  onLessonChange: (v: string) => void
  lessons: Lesson[]
  onCreate: () => void
}

export function ChapterFilter({ lessonId, onLessonChange, lessons, onCreate }: Props) {
  const t = useTranslations('admin.learn')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/learn">
          <ChevronLeft className="h-4 w-4" />
          {t('backToLearn')}
        </Link>
      </Button>
      <div className="w-full max-w-sm">
        <Select value={lessonId} onValueChange={onLessonChange}>
          <SelectTrigger className={selectClass} aria-label={t('selectLesson')}>
            <SelectValue placeholder={t('selectLessonPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {lessons.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.title}
                {!l.isPublished ? `（${t('unpublished')}）` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={onCreate} size="sm" className="ml-auto" disabled={!lessonId}>
        <Plus className="h-4 w-4" />
        {t('create')}
      </Button>
    </div>
  )
}
