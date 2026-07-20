'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Mic, CheckCircle2, History } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label } from '@ihui/ui'

interface HistoryItem {
  id: string
  title: string
  status: string
  createdAt?: string
}

interface RunResult {
  ok: boolean
  stdout?: string
  stderr?: string
  error?: string
  returncode?: number
  displayOutput?: string
  guide?: string
}

export default function KouboPage() {
  const t = useTranslations('selfMedia.kouboPage')
  const [date, setDate] = React.useState('')
  const [filePath, setFilePath] = React.useState('')
  const [topic, setTopic] = React.useState('')
  const [running, setRunning] = React.useState<'generate' | 'validate' | null>(null)
  const [result, setResult] = React.useState<RunResult | null>(null)
  const [history, setHistory] = React.useState<HistoryItem[]>([])

  const loadHistory = React.useCallback(async () => {
    const r = await fetchApi<{ items: HistoryItem[] }>(`/api/self-media/koubo/history?limit=20`)
    if (r.success && r.data) setHistory(r.data.items ?? [])
  }, [])

  React.useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const run = async (
    op: 'generate' | 'validate',
    endpoint: string,
    body: Record<string, unknown>,
  ) => {
    setRunning(op)
    setResult(null)
    try {
      const r = await fetchApi<RunResult>(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (r.success && r.data) {
        setResult(r.data)
      } else {
        setResult({ ok: false, error: r.error || 'request failed' })
      }
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : 'network error' })
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="space-y-4 md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mic className="h-4 w-4" />
              {t('formTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="date">{t('dateLabel')}</Label>
                <Input
                  id="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder="0720"
                  maxLength={4}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="topic">{t('topicLabel')}</Label>
                <Input
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={t('topicPlaceholder')}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filePath">{t('filePathLabel')}</Label>
              <Input
                id="filePath"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder={t('filePathPlaceholder')}
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                onClick={() =>
                  run('generate', '/api/self-media/koubo/generate', {
                    date,
                    topic,
                    dryRun: true,
                  })
                }
                disabled={!date || !/^\d{4}$/.test(date) || running !== null}
              >
                {running === 'generate' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                {t('generate')}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  run('validate', '/api/self-media/koubo/validate', { filePath })
                }
                disabled={!filePath || running !== null}
              >
                {running === 'validate' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {t('validate')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('resultTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4">
              <div
                className={
                  result.ok
                    ? 'text-sm font-medium text-emerald-600'
                    : 'text-sm font-medium text-rose-600'
                }
              >
                {result.ok ? '✅ ' + t('runSuccess') : '❌ ' + t('runFailed')}
                {typeof result.returncode === 'number' && ` (rc=${result.returncode})`}
              </div>
              {result.guide && (
                <p className="rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                  {result.guide}
                </p>
              )}
              {result.error && (
                <pre className="thin-scroll max-h-40 overflow-auto rounded-md bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  {result.error}
                </pre>
              )}
              {result.displayOutput && (
                <pre className="thin-scroll max-h-40 overflow-auto rounded-md bg-muted p-2 text-xs">
                  {result.displayOutput}
                </pre>
              )}
              {result.stdout && (
                <pre className="thin-scroll max-h-60 overflow-auto rounded-md bg-muted p-2 text-xs">
                  {result.stdout}
                </pre>
              )}
              {result.stderr && (
                <pre className="thin-scroll max-h-40 overflow-auto rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  {result.stderr}
                </pre>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            {t('historyTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          {history.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">{t('historyEmpty')}</p>
          ) : (
            <ul className="space-y-1">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent"
                >
                  <div className="truncate font-medium">{h.title}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                    <span
                      className={
                        h.status === 'published'
                          ? 'text-emerald-600'
                          : h.status === 'failed'
                            ? 'text-rose-600'
                            : 'text-muted-foreground'
                      }
                    >
                      {h.status}
                    </span>
                    {h.createdAt && <span>· {new Date(h.createdAt).toLocaleDateString()}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
