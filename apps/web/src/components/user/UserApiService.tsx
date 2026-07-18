'use client'

import * as React from 'react'
import { Zap, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ApiEntry {
  key: string
  label: string
  desc?: string
  href?: string
}

export interface UserApiServiceProps {
  entries?: ApiEntry[]
  onJump?: (key: string) => void
  className?: string
}

const DEFAULT_ENTRIES: ApiEntry[] = [
  { key: 'keys', label: 'API 密钥', desc: '管理 AccessKey / Secret', href: '/developer/keys' },
  { key: 'limits', label: '配额与限流', desc: '查看调用上限', href: '/developer/limits' },
  { key: 'team', label: '团队协作', desc: '多成员协同', href: '/developer/team' },
  { key: 'docs', label: 'API 文档', desc: '接口说明', href: '/docs' },
]

export default function UserApiService({
  entries = DEFAULT_ENTRIES,
  onJump,
  className,
}: UserApiServiceProps): React.JSX.Element {
  return (
    <div className={cn('rounded-xl border bg-card', className)}>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Zap className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">API 服务</h3>
      </div>
      <ul className="divide-y">
        {entries.map((e) => (
          <li key={e.key}>
            <button
              type="button"
              onClick={() => onJump?.(e.key)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{e.label}</div>
                {e.desc && <div className="truncate text-xs text-muted-foreground">{e.desc}</div>}
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
