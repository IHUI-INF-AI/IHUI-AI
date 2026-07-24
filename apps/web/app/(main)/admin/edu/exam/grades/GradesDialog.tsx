'use client'

import { useTranslations } from 'next-intl'
import { Loader2, Save } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
} from '@ihui/ui-react'
import { selectClass } from '@/lib/edu'
import { cn } from '@/lib/utils'
import type { Question } from './types'

interface Props {
  open: boolean
  subjectiveQs: Question[]
  grades: Record<string, string>
  setGrades: (g: Record<string, string>) => void
  pending: boolean
  onClose: () => void
  onSubmit: () => void
}

export function GradesDialog({
  open,
  subjectiveQs,
  grades,
  setGrades,
  pending,
  onClose,
  onSubmit,
}: Props) {
  const t = useTranslations('admin.edu.exam.grades')
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('dialogTitle')}</DialogTitle>
        </DialogHeader>
        {subjectiveQs.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">{t('noSubjective')}</div>
        ) : (
          <div className="space-y-3">
            {subjectiveQs.map((q, idx) => (
              <div key={q.id} className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">
                  {t('subjectiveInfo', { index: idx + 1, score: Number(q.score) })}
                </div>
                <div className="mt-1 text-sm font-medium">{q.title}</div>
                <div className="mt-2 flex items-center gap-2">
                  <Label htmlFor={`g-${q.id}`} className="text-xs">
                    {t('fieldScore')}
                  </Label>
                  <Input
                    id={`g-${q.id}`}
                    type="number"
                    min="0"
                    max={Number(q.score)}
                    step="0.5"
                    className={cn(selectClass, 'h-8 max-w-[120px]')}
                    value={grades[q.id] ?? ''}
                    onChange={(e) => setGrades({ ...grades, [q.id]: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4" />
            {t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
