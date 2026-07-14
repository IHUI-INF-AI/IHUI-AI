'use client'

import { Loader2, FileText } from 'lucide-react'
import { useTranslations } from 'next-intl'
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
import { selectClass } from '@/lib/edu'
import type { Paper, Question } from './types'

interface Props {
  papers: Paper[]
  paperId: string
  setPaperId: (v: string) => void
  paper: Paper | undefined
  questions: Question[]
  startPending: boolean
  onStart: () => void
}

export function PaperSelectCard({
  papers,
  paperId,
  setPaperId,
  paper,
  questions,
  startPending,
  onStart,
}: Props) {
  const t = useTranslations('admin.edu.answer.online')
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="space-y-2">
          <Label htmlFor="o-paper">{t('selectPaper')}</Label>
          <Select value={paperId} onValueChange={setPaperId}>
            <SelectTrigger className={selectClass} id="o-paper">
              <SelectValue placeholder={t('selectPublishedPaperPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {papers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {t('paperWithDuration', { title: p.title, duration: p.duration })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {paper && (
          <div className="grid grid-cols-3 gap-3 rounded-md bg-muted/40 px-4 py-3 text-sm">
            <div>
              <span className="text-muted-foreground">{t('totalScoreLabel')}</span>
              <b>{Number(paper.totalScore)}</b>
            </div>
            <div>
              <span className="text-muted-foreground">{t('durationLabel')}</span>
              <b>{t('minutesCount', { count: paper.duration })}</b>
            </div>
            <div>
              <span className="text-muted-foreground">{t('questionCountLabel')}</span>
              <b>{questions.length}</b>
            </div>
          </div>
        )}
        <Button onClick={onStart} disabled={!paperId || startPending || questions.length === 0}>
          {startPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {t('startAnswer')}
        </Button>
      </CardContent>
    </Card>
  )
}
