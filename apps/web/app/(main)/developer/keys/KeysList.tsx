'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Trash2, Copy, RefreshCw, Loader2, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent, Button } from '@ihui/ui'
import type { ApiKey } from './types'

interface Props {
  list: ApiKey[]
  isLoading: boolean
  dateFmt: Intl.DateTimeFormat
  resetPending: boolean
  delPending: boolean
  onReset: (id: string) => void
  onDelete: (id: string) => void
}

function maskKey(k: string) {
  if (k.length <= 8) return k
  return k.slice(0, 4) + '****' + k.slice(-4)
}

export function KeysList({
  list,
  isLoading,
  dateFmt,
  resetPending,
  delPending,
  onReset,
  onDelete,
}: Props) {
  const [visible, setVisible] = React.useState<Record<string, boolean>>({})

  function copyKey(k: string) {
    navigator.clipboard?.writeText(k).then(
      () => toast.success('已复制'),
      () => toast.error('复制失败'),
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : list.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">暂无 API 密钥</p>
        ) : (
          <div className="divide-y">
            {list.map((k) => (
              <div key={k.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{k.name}</p>
                    <div className="flex gap-1">
                      {k.scopes.map((s) => (
                        <span
                          key={s}
                          className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <code className="text-xs text-muted-foreground">
                      {visible[k.id] ? k.key : maskKey(k.key)}
                    </code>
                    <button
                      onClick={() => setVisible((v) => ({ ...v, [k.id]: !v[k.id] }))}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {visible[k.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                    <button
                      onClick={() => copyKey(k.key)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    创建于 {dateFmt.format(new Date(k.createdAt))}
                    {k.lastUsedAt && ` · 最近使用 ${dateFmt.format(new Date(k.lastUsedAt))}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onReset(k.id)}
                    disabled={resetPending}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => confirm('确认删除该密钥?') && onDelete(k.id)}
                    disabled={delPending}
                    className="text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
