'use client'

import * as React from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  XCircle,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

import { McpResultPreview } from './mcp-result-preview'

export interface McpToolCallResultProps {
  toolName: string
  result: unknown
  duration?: number
  status: 'success' | 'error'
  error?: string
}

export function McpToolCallResult({
  toolName,
  result,
  duration,
  status,
  error,
}: McpToolCallResultProps) {
  const t = useTranslations('mcp')
  const [expanded, setExpanded] = React.useState(true)
  const isSuccess = status === 'success'

  return (
    <Card className={cn('overflow-hidden', !isSuccess && 'border-destructive/40')}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            {isSuccess ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
            <span className="font-mono">{toolName}</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {duration !== undefined && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {duration}ms
              </span>
            )}
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-xs font-medium',
                isSuccess
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-destructive/10 text-destructive',
              )}
            >
              {isSuccess ? t('success') : t('error')}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!isSuccess && error ? (
          <pre className="overflow-auto rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs whitespace-pre-wrap text-destructive">
            {error}
          </pre>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setExpanded((p) => !p)}
              className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              {t('result')}
            </button>
            {expanded && <McpResultPreview result={result} />}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
