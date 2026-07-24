'use client'
import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import { Button, Input } from '@ihui/ui-react'
import { useTranslations } from 'next-intl'

interface Props {
  search: string
  onSearchChange: (v: string) => void
  onCreate: () => void
}

export function ExamFilter({ search, onSearchChange, onCreate }: Props) {
  const t = useTranslations('admin.edu.exam.index')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-9 pl-8"
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/edu/exam/questions">{t('questionsManage')}</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/edu/exam/grades">{t('gradesManage')}</Link>
        </Button>
        <Button onClick={onCreate} size="sm">
          <Plus className="h-4 w-4" />
          {t('createPaper')}
        </Button>
      </div>
    </div>
  )
}
