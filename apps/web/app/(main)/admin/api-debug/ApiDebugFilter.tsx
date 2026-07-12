'use client'

import { useTranslations } from 'next-intl'
import { Send, Loader2 } from 'lucide-react'
import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { METHODS, selectClass, textareaClass } from './helpers'
import type { Method } from './types'

interface Props {
  method: Method
  setMethod: (m: Method) => void
  url: string
  setUrl: (v: string) => void
  headers: string
  setHeaders: (v: string) => void
  body: string
  setBody: (v: string) => void
  pending: boolean
  onSend: () => void
}

export function ApiDebugFilter({
  method,
  setMethod,
  url,
  setUrl,
  headers,
  setHeaders,
  body,
  setBody,
  pending,
  onSend,
}: Props) {
  const t = useTranslations('adminTools')
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('apiDebug.request')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as Method)}
            className={selectClass}
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
            placeholder="/api/..."
            className="flex-1"
          />
          <Button onClick={onSend} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
  )
}
