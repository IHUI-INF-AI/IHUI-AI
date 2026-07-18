'use client'

import * as React from 'react'
import { Code2, Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DeveloperInfo {
  apiKey?: string
  secret?: string
  quota?: number | string
  used?: number | string
}

export interface UserDeveloperProps {
  info?: DeveloperInfo
  onRegenerateKey?: () => void
  className?: string
}

function maskSecret(s: string): string {
  if (!s) return ''
  if (s.length <= 8) return s.replace(/.(?=.{1,})/g, '*')
  return `${s.slice(0, 4)}****${s.slice(-4)}`
}

export default function UserDeveloper({
  info = {},
  onRegenerateKey,
  className,
}: UserDeveloperProps): React.JSX.Element {
  return (
    <div className={cn('rounded-xl border bg-card shadow', className)}>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Code2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">开发者信息</h3>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Terminal className="h-3 w-3" /> API Key
          </span>
          <code className="rounded bg-muted px-2 py-0.5 text-xs">
            {maskSecret(info.apiKey ?? '-')}
          </code>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Secret</span>
          <code className="rounded bg-muted px-2 py-0.5 text-xs">
            {maskSecret(info.secret ?? '-')}
          </code>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">配额</span>
          <span className="text-xs">
            {info.used ?? 0} / {info.quota ?? 0}
          </span>
        </div>
        {onRegenerateKey && (
          <button
            type="button"
            onClick={onRegenerateKey}
            className="mt-2 w-full rounded-md border border-primary px-3 py-1.5 text-xs text-primary hover:bg-primary/5"
          >
            重新生成 API Key
          </button>
        )}
      </div>
    </div>
  )
}
