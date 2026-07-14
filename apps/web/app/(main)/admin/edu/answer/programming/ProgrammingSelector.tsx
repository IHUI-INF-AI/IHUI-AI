'use client'
import { Loader2, Code2 } from 'lucide-react'
import { selectClass } from '@/lib/edu'
import {
  Button,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Card,
  CardContent,
} from '@ihui/ui'
import { useTranslations } from 'next-intl'
import { LANGS } from './helpers'
import type { Paper, Question } from './types'

interface Props {
  papers: Paper[]
  paperId: string
  lang: string
  questions: Question[]
  recordId: string | null
  onPaperChange: (v: string) => void
  onLangChange: (v: string) => void
  onStart: () => void
  startPending: boolean
}

export function ProgrammingSelector({
  papers,
  paperId,
  lang,
  questions,
  recordId,
  onPaperChange,
  onLangChange,
  onStart,
  startPending,
}: Props) {
  const t = useTranslations('admin.edu.answer.programming')
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="p-paper">{t('selectPaper')}</Label>
            <Select value={paperId} onValueChange={onPaperChange}>
              <SelectTrigger className={selectClass} id="p-paper">
                <SelectValue placeholder={t('selectPaperPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {papers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-lang">{t('language')}</Label>
            <Select value={lang} onValueChange={onLangChange}>
              <SelectTrigger className={selectClass} id="p-lang">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {paperId && !recordId && (
          <Button onClick={onStart} disabled={startPending || questions.length === 0}>
            {startPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Code2 className="h-4 w-4" />
            )}
            {t('startWithCount', { count: questions.length })}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
