/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ApiLogDetail {
  id: string
  method?: string
  path?: string
  statusCode?: number
  duration?: number
  requestHeader?: Record<string, string>
  requestBody?: unknown
  responseHeader?: Record<string, string>
  responseBody?: unknown
  createdAt?: string
}

export interface LogDetailDialogProps {
  open: boolean
  log?: ApiLogDetail | null
  onClose?: () => void
  className?: string
}

function formatJson(v: unknown): string {
  if (v === null || v === undefined) return '-'
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}

export default function LogDetailDialog({
  open,
  log,
  onClose,
  className,
}: LogDetailDialogProps): React.JSX.Element {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return <></>

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      onKeyDown={(e) => e.key === 'Escape' && onClose?.()}
      tabIndex={-1}
    >
      <div
        className={cn(
          'relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-background shadow-xl',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-base font-medium">日志详情</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-auto p-5 text-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="方法" value={log?.method ?? '-'} />
            <Field label="状态码" value={String(log?.statusCode ?? '-')} />
            <Field label="耗时" value={log?.duration ? `${log.duration}ms` : '-'} />
            <Field label="时间" value={log?.createdAt ?? '-'} />
          </div>
          <Field label="路径" value={log?.path ?? '-'} />
          <Section title="请求体">
            <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
              {formatJson(log?.requestBody)}
            </pre>
          </Section>
          <Section title="响应体">
            <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
              {formatJson(log?.responseBody)}
            </pre>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 break-words font-medium">{value}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{title}</div>
      {children}
    </div>
  )
}
