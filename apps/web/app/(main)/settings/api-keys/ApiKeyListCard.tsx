'use client'

import * as React from 'react'
import { KeyRound, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'
import { cn } from '@/lib/utils'
import { PERM_LABELS } from './PermissionSelector'
import { IDLE_CONFIRM, type ApiKeyInfo, type ConfirmState } from './types'

/** 脱敏展示 key:保留首尾,中间省略。 */
function maskKey(key: string): string {
  if (key.length <= 14) return key
  return `${key.slice(0, 10)}...${key.slice(-4)}`
}

interface Props {
  list: ApiKeyInfo[]
  isLoading: boolean
  error: Error | null
  onRetry: () => void
  onCreate: () => void
  onDelete: (id: string) => Promise<void>
  onRotate: (id: string) => Promise<void>
  pendingDelete: boolean
  pendingRotate: boolean
}

export function ApiKeyListCard({
  list,
  isLoading,
  error,
  onRetry,
  onCreate,
  onDelete,
  onRotate,
  pendingDelete,
  pendingRotate,
}: Props) {
  const tc = useTranslations('common')
  const [confirm, setConfirm] = React.useState<ConfirmState>(IDLE_CONFIRM)

  const dateFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [],
  )

  const closeConfirm = () => setConfirm((s) => ({ ...s, open: false, pending: false }))

  const ask = (
    k: ApiKeyInfo,
    title: string,
    desc: string,
    destructive: boolean,
    action: (id: string) => Promise<void>,
  ) =>
    setConfirm({
      open: true,
      title,
      desc,
      pending: false,
      destructive,
      onConfirm: async () => {
        setConfirm((s) => ({ ...s, pending: true }))
        try {
          await action(k.id)
          closeConfirm()
        } catch {
          setConfirm((s) => ({ ...s, pending: false }))
        }
      },
    })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" />
          我的 API 密钥
        </CardTitle>
        <Button size="sm" variant="outline" onClick={onCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          <span>创建密钥</span>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span>加载中...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="text-sm text-destructive">加载失败:{error.message}</p>
            <Button size="sm" variant="outline" onClick={onRetry}>
              <span>重试</span>
            </Button>
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <div className="rounded-md bg-muted p-3">
              <KeyRound className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">尚未创建 API 密钥</p>
            <p className="text-xs text-muted-foreground">点击右上角「创建密钥」生成您的第一把密钥</p>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((k) => (
              <div key={k.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{k.name}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'rounded-md px-1.5 py-0 text-[10px]',
                          k.status === 'active'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'border-border bg-muted text-muted-foreground',
                        )}
                      >
                        {k.status === 'active' ? '启用' : '已撤销'}
                      </Badge>
                    </div>
                    <code className="block break-all rounded bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground">
                      {maskKey(k.key)}
                    </code>
                    <div className="flex flex-wrap gap-1">
                      {k.permissions.map((p) => (
                        <span
                          key={p}
                          className="inline-flex rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
                        >
                          {PERM_LABELS[p] ?? p}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {k.lastUsedAt
                        ? `最近使用:${dateFmt.format(new Date(k.lastUsedAt))}`
                        : '最近使用:从未'}
                      <span className="mx-1.5">·</span>
                      速率 {k.rateLimit}/分钟
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pendingRotate}
                      onClick={() =>
                        ask(
                          k,
                          '轮换密钥 Secret',
                          `轮换「${k.name}」的 secret 后,旧 secret 立即失效,使用旧 secret 的应用需更新。确认继续?`,
                          false,
                          onRotate,
                        )
                      }
                      title="轮换 secret"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={pendingDelete}
                      onClick={() =>
                        ask(
                          k,
                          '删除 API 密钥',
                          `确定删除「${k.name}」?删除后该密钥立即失效,且无法恢复。`,
                          true,
                          onDelete,
                        )
                      }
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog
        open={confirm.open}
        onOpenChange={(o) => (o ? null : !confirm.pending && closeConfirm())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{confirm.desc}</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeConfirm} disabled={confirm.pending}>
              {tc('cancel')}
            </Button>
            <Button
              type="button"
              variant={confirm.destructive ? 'destructive' : 'default'}
              onClick={confirm.onConfirm}
              disabled={confirm.pending}
            >
              {confirm.pending && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>确认</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
