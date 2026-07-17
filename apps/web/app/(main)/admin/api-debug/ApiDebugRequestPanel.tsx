'use client'

import { useTranslations } from 'next-intl'
import { Terminal, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'
import type { ResponseState } from './types'

interface Props {
  response: ResponseState | null
  pending: boolean
}

export function ApiDebugRequestPanel({ response, pending }: Props) {
  const t = useTranslations('adminTools')
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('apiDebug.response')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pending ? (
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
                  'inline-flex rounded-md px-2.5 py-0.5 text-sm font-medium',
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
              <div className="text-xs font-medium text-muted-foreground">
                {t('apiDebug.respHeaders')}
              </div>
              <pre className="max-h-32 overflow-auto rounded-md bg-muted/50 p-2 text-xs">
                {JSON.stringify(response.headers, null, 2)}
              </pre>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                {t('apiDebug.respBody')}
              </div>
              <pre className="max-h-64 overflow-auto rounded-md bg-muted/50 p-2 text-xs">
                {response.body}
              </pre>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
