'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { FlaskConical, Send, Loader2, Plus, X } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Button, Input, Label } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface HeaderRow {
  key: string
  value: string
}

interface SandboxResponse {
  status: number
  duration: number
  headers?: Record<string, string>
  body: unknown
}

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const
type Method = (typeof METHODS)[number]

const METHOD_CLASS: Record<Method, string> = {
  GET: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  POST: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  PUT: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  DELETE: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  PATCH: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
}

export default function SandboxPage() {
  const t = useTranslations('developerSandboxPage')
  const [method, setMethod] = React.useState<Method>('GET')
  const [url, setUrl] = React.useState('/api/developer/sandbox')
  const [headers, setHeaders] = React.useState<HeaderRow[]>([{ key: '', value: '' }])
  const [body, setBody] = React.useState('')
  const [resp, setResp] = React.useState<SandboxResponse | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function updateHeader(idx: number, field: keyof HeaderRow, val: string) {
    setHeaders((prev) => prev.map((h, i) => (i === idx ? { ...h, [field]: val } : h)))
  }

  function addHeader() {
    setHeaders((prev) => [...prev, { key: '', value: '' }])
  }

  function removeHeader(idx: number) {
    setHeaders((prev) => prev.filter((_, i) => i !== idx))
  }

  async function sendRequest() {
    setLoading(true)
    setError(null)
    setResp(null)
    try {
      const headerObj: Record<string, string> = {}
      headers.forEach((h) => {
        if (h.key.trim()) headerObj[h.key.trim()] = h.value
      })
      const start = Date.now()
      const r = await fetchApi<unknown>(url, {
        method,
        headers: headerObj,
        body: ['POST', 'PUT', 'PATCH'].includes(method) && body ? body : undefined,
      })
      const duration = Date.now() - start
      setResp({
        status: r.success ? 200 : (r.status ?? 500),
        duration,
        body: r.success ? r.data : { error: r.error },
      })
      if (!r.success) toast.error(r.error ?? t('requestFailed'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('requestError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <FlaskConical className="h-5 w-5 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as Method)}
              className={cn(
                'rounded-md border bg-background px-2 py-1.5 text-sm font-bold outline-none',
                METHOD_CLASS[method],
              )}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/api/developer/sandbox"
              className="flex-1"
            />
            <Button size="sm" onClick={sendRequest} disabled={loading || !url.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {t('send')}
            </Button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm">{t('requestHeaders')}</Label>
              <Button size="sm" variant="ghost" onClick={addHeader}>
                <Plus className="h-3.5 w-3.5" />
                {t('add')}
              </Button>
            </div>
            <div className="space-y-1.5">
              {headers.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={h.key}
                    onChange={(e) => updateHeader(i, 'key', e.target.value)}
                    placeholder={t('headerNamePlaceholder')}
                    className="flex-1"
                  />
                  <Input
                    value={h.value}
                    onChange={(e) => updateHeader(i, 'value', e.target.value)}
                    placeholder={t('headerValuePlaceholder')}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeHeader(i)}
                    className="text-muted-foreground hover:text-rose-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {['POST', 'PUT', 'PATCH'].includes(method) && (
            <div className="space-y-1">
              <Label className="text-sm">{t('requestBody')}</Label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder='{"key": "value"}'
                rows={5}
                className="w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {error && <Alert variant="danger" description={error} />}

      {resp && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-3 border-b pb-2">
              <span
                className={cn(
                  'rounded px-2 py-0.5 text-xs font-bold',
                  resp.status < 300
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : resp.status < 500
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                )}
              >
                {resp.status}
              </span>
              <span className="text-xs text-muted-foreground">{resp.duration}ms</span>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold">{t('responseBody')}</p>
              <pre className="max-h-80 overflow-auto rounded-md bg-muted/50 p-3 text-xs">
                <code>{JSON.stringify(resp.body, null, 2)}</code>
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
