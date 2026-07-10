'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Terminal, Send, Loader2, History, Trash2 } from 'lucide-react'

import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

interface HistoryItem {
  id: string
  method: Method
  url: string
  status: number
  time: string
}

const METHODS: Method[] = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
const METHOD_COLOR: Record<Method, string> = {
  GET: 'bg-blue-500/10 text-blue-600',
  POST: 'bg-emerald-500/10 text-emerald-600',
  PATCH: 'bg-amber-500/10 text-amber-600',
  PUT: 'bg-amber-500/10 text-amber-600',
  DELETE: 'bg-red-500/10 text-red-600',
}
const selectClass = 'h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const textareaClass = 'flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

interface ResponseState {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  latency: number
}

export default function ApiDebugPage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')

  const [method, setMethod] = React.useState<Method>('GET')
  const [url, setUrl] = React.useState('/api/health')
  const [headers, setHeaders] = React.useState('{\n  "Content-Type": "application/json"\n}')
  const [body, setBody] = React.useState('')
  const [response, setResponse] = React.useState<ResponseState | null>(null)
  const [history, setHistory] = React.useState<HistoryItem[]>([])

  const sendMut = useMutation({
    mutationFn: async () => {
      const start = performance.now()
      let parsedHeaders: Record<string, string> = {}
      try { parsedHeaders = JSON.parse(headers) } catch { /* keep empty */ }
      const opts: RequestInit = { method, headers: parsedHeaders }
      if (method !== 'GET' && body.trim()) opts.body = body
      const res = await fetch(url, opts)
      const text = await res.text()
      const latency = Math.round(performance.now() - start)
      const respHeaders: Record<string, string> = {}
      res.headers.forEach((v, k) => { respHeaders[k] = v })
      let formatted = text
      try { formatted = JSON.stringify(JSON.parse(text), null, 2) } catch { /* keep raw */ }
      return {
        status: res.status,
        statusText: res.statusText,
        headers: respHeaders,
        body: formatted,
        latency,
      } as ResponseState
    },
    onSuccess: (data) => {
      setResponse(data)
      setHistory((prev) => [
        { id: Date.now().toString(), method, url, status: data.status, time: new Date().toLocaleTimeString() },
        ...prev,
      ].slice(0, 20))
      toast.success(t('apiDebug.sendSuccess'))
    },
    onError: (e: Error) => {
      toast.error(e.message)
    },
  })

  function send() {
    if (!url.trim()) {
      toast.error(t('apiDebug.urlRequired'))
      return
    }
    setResponse(null)
    sendMut.mutate()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Terminal className="h-6 w-6 text-primary" />
          {t('apiDebug.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('apiDebug.subtitle')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 请求构建器 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('apiDebug.request')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <select value={method} onChange={(e) => setMethod(e.target.value as Method)} className={selectClass}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="/api/..."
                className="flex-1"
              />
              <Button onClick={send} disabled={sendMut.isPending}>
                {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {t('apiDebug.send')}
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-headers">{t('apiDebug.headers')}</Label>
              <textarea
                id="d-headers"
                value={headers}
                onChange={(e) => setHeaders(e.target.value)}
                rows={4}
                className={textareaClass}
                placeholder='{"Content-Type":"application/json"}'
              />
            </div>
            {method !== 'GET' && (
              <div className="space-y-2">
                <Label htmlFor="d-body">{t('apiDebug.body')}</Label>
                <textarea
                  id="d-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  className={textareaClass}
                  placeholder='{"key":"value"}'
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* 响应展示 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('apiDebug.response')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sendMut.isPending ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t('apiDebug.waiting')}
              </div>
            ) : !response ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-12 text-muted-foreground">
                <Terminal className="h-8 w-8" />
                <p className="text-sm">{t('apiDebug.noResponse')}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2.5 py-0.5 text-sm font-medium',
                      response.status >= 200 && response.status < 300
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : response.status >= 400
                          ? 'bg-red-500/10 text-red-600'
                          : 'bg-amber-500/10 text-amber-600',
                    )}
                  >
                    {response.status} {response.statusText}
                  </span>
                  <span className="text-xs text-muted-foreground">{response.latency}ms</span>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">{t('apiDebug.respHeaders')}</div>
                  <pre className="max-h-32 overflow-auto rounded-md bg-muted/50 p-2 text-xs">{JSON.stringify(response.headers, null, 2)}</pre>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">{t('apiDebug.respBody')}</div>
                  <pre className="max-h-64 overflow-auto rounded-md bg-muted/50 p-2 text-xs">{response.body}</pre>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 请求历史 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <History className="h-5 w-5" />
            {t('apiDebug.history')}
          </h2>
          {history.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setHistory([])}>
              <Trash2 className="h-4 w-4" />
              {tc('delete')}
            </Button>
          )}
        </div>
        {history.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-muted-foreground">
            {t('apiDebug.noHistory')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">{t('apiDebug.colMethod')}</th>
                  <th className="px-4 py-2 font-medium">URL</th>
                  <th className="px-4 py-2 font-medium">{t('apiDebug.colStatus')}</th>
                  <th className="px-4 py-2 font-medium">{t('apiDebug.colTime')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((h) => (
                  <tr key={h.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <span className={cn('inline-flex rounded px-2 py-0.5 text-xs font-medium', METHOD_COLOR[h.method])}>
                        {h.method}
                      </span>
                    </td>
                    <td className="max-w-[320px] truncate px-4 py-2 font-mono text-xs" title={h.url}>{h.url}</td>
                    <td className="px-4 py-2">
                      <span className={cn('font-medium', h.status >= 400 ? 'text-red-600' : 'text-emerald-600')}>
                        {h.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{h.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
