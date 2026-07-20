'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, FileText, CheckCircle2, Send, History } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label } from '@ihui/ui'

interface HistoryItem {
  id: string
  title: string
  status: string
  draftId?: string
  createdAt?: string
}

interface RunResult {
  ok: boolean
  stdout?: string
  stderr?: string
  error?: string
  returncode?: number
}

export default function WechatPage() {
  const t = useTranslations('selfMedia.wechatPage')
  const [title, setTitle] = React.useState('')
  const [digest, setDigest] = React.useState('')
  const [mdPath, setMdPath] = React.useState('')
  const [cover, setCover] = React.useState('')
  const [running, setRunning] = React.useState<'generate' | 'validate' | 'publish' | null>(null)
  const [result, setResult] = React.useState<RunResult | null>(null)
  const [history, setHistory] = React.useState<HistoryItem[]>([])

  const loadHistory = React.useCallback(async () => {
    const r = await fetchApi<{ items: HistoryItem[] }>(`/api/self-media/wechat/history?limit=20`)
    if (r.success && r.data) setHistory(r.data.items ?? [])
  }, [])

  React.useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const run = async (
    op: 'generate' | 'validate' | 'publish',
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
        if (op === 'publish' && r.data.ok) void loadHistory()
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
              <FileText className="h-4 w-4" />
              {t('formTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">{t('titleLabel')}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('titlePlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="digest">{t('digestLabel')}</Label>
              <Input
                id="digest"
                value={digest}
                onChange={(e) => setDigest(e.target.value)}
                placeholder={t('digestPlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mdPath">{t('mdPathLabel')}</Label>
              <Input
                id="mdPath"
                value={mdPath}
                onChange={(e) => setMdPath(e.target.value)}
                placeholder={t('mdPathPlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cover">{t('coverLabel')}</Label>
              <Input
                id="cover"
                value={cover}
                onChange={(e) => setCover(e.target.value)}
                placeholder={t('coverPlaceholder')}
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                onClick={() =>
                  run('generate', '/api/self-media/wechat/generate', {
                    title,
                    digest,
                    topic: '',
                    dryRun: true,
                  })
                }
                disabled={!title || running !== null}
              >
                {running === 'generate' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                {t('generate')}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  run('validate', '/api/self-media/wechat/validate', { mdPath })
                }
                disabled={!mdPath || running !== null}
              >
                {running === 'validate' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {t('validate')}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  run('publish', '/api/self-media/wechat/publish', {
                    mdPath,
                    title,
                    digest,
                    cover,
                    dryRun: true,
                  })
                }
                disabled={!mdPath || !title || running !== null}
              >
                {running === 'publish' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {t('publishDryRun')}
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
              {result.error && (
                <pre className="thin-scroll max-h-40 overflow-auto rounded-md bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  {result.error}
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
