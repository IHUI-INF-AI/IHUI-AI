'use client'
import { Loader2, Play, Send, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { textareaClass } from '@/lib/edu'
import { Button, Label, Card, CardContent } from '@ihui/ui'
import { useTranslations } from 'next-intl'
import type { Question } from './types'

interface RunResult {
  pass: boolean
  output: string
}

interface Props {
  code: string
  onCodeChange: (v: string) => void
  lang: string
  current: Question | undefined
  onRun: () => void
  onSubmit: () => void
  runPending: boolean
  submitPending: boolean
  runResult: RunResult | null
}

export function ProgrammingEditor({
  code,
  onCodeChange,
  lang,
  current,
  onRun,
  onSubmit,
  runPending,
  submitPending,
  runResult,
}: Props) {
  const t = useTranslations('admin.edu.answer.programming')
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <Label htmlFor="p-code">{t('codeEditor')}</Label>
        <textarea
          id="p-code"
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          rows={14}
          className={cn(textareaClass, 'text-xs')}
          placeholder={t('codePlaceholder', { lang })}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={onRun}
            size="sm"
            variant="outline"
            disabled={!current || !code || runPending}
          >
            {runPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {t('runTest')}
          </Button>
          <Button onClick={onSubmit} size="sm" disabled={!current || !code || submitPending}>
            {submitPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {t('submit')}
          </Button>
        </div>
        {runResult && (
          <div
            className={cn(
              'rounded-md border p-3 text-sm',
              runResult.pass
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-rose-500/30 bg-rose-500/5',
            )}
          >
            <div className="mb-1 flex items-center gap-1 font-medium">
              {runResult.pass ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <XCircle className="h-4 w-4 text-rose-600" />
              )}
              {runResult.pass ? t('passed') : t('notPassed')}
            </div>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs">
              {runResult.output}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
