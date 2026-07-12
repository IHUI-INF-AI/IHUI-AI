'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Terminal, History, Trash2 } from 'lucide-react'

import { Button } from '@ihui/ui'

import { ApiDebugFilter } from './ApiDebugFilter'
import { ApiDebugTable } from './ApiDebugTable'
import { ApiDebugRequestPanel } from './ApiDebugRequestPanel'
import type { Method, HistoryItem, ResponseState } from './types'

export default function ApiDebugPage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')
  const locale = useLocale()

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
      try {
        parsedHeaders = JSON.parse(headers)
      } catch {
        /* keep empty */
      }
      const opts: RequestInit = { method, headers: parsedHeaders }
      if (method !== 'GET' && body.trim()) opts.body = body
      const res = await fetch(url, opts)
      const text = await res.text()
      const latency = Math.round(performance.now() - start)
      const respHeaders: Record<string, string> = {}
      res.headers.forEach((v, k) => {
        respHeaders[k] = v
      })
      let formatted = text
      try {
        formatted = JSON.stringify(JSON.parse(text), null, 2)
      } catch {
        /* keep raw */
      }
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
      setHistory((prev) =>
        [
          {
            id: Date.now().toString(),
            method,
            url,
            status: data.status,
            time: new Intl.DateTimeFormat(locale, { timeStyle: 'medium' }).format(new Date()),
          },
          ...prev,
        ].slice(0, 20),
      )
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
        <ApiDebugFilter
          method={method}
          setMethod={setMethod}
          url={url}
          setUrl={setUrl}
          headers={headers}
          setHeaders={setHeaders}
          body={body}
          setBody={setBody}
          pending={sendMut.isPending}
          onSend={send}
        />
        <ApiDebugRequestPanel response={response} pending={sendMut.isPending} />
      </div>

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
        <ApiDebugTable list={history} />
      </section>
    </div>
  )
}
