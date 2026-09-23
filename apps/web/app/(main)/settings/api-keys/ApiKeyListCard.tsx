// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
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
  const t = useTranslations()
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
          {t('apiKeysPage.title')}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={onCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          <span>{t('apiKeysPage.createKey')}</span>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span>{tc('loading')}</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="text-sm text-destructive">
              {t('apiKeysPage.loadFailedDetail', { message: error.message })}
            </p>
            <Button size="sm" variant="outline" onClick={onRetry}>
              <span>{tc('retry')}</span>
            </Button>
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="rounded-md bg-muted p-3">
              <KeyRound className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{t('apiKeysPage.emptyTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('apiKeysPage.emptyHint')}</p>
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
                        {k.status === 'active'
                          ? t('apiKeysPage.statusActive')
                          : t('apiKeysPage.statusRevoked')}
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
                          {t(PERM_LABELS[p] ?? p)}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {k.lastUsedAt
                        ? t('apiKeysPage.lastUsedAt', {
                            time: dateFmt.format(new Date(k.lastUsedAt)),
                          })
                        : t('apiKeysPage.lastUsedNever')}
                      <span className="mx-1.5">·</span>
                      {t('apiKeysPage.rateLimitPerMinute', { rateLimit: k.rateLimit })}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Tooltip content={t('apiKeysPage.rotateSecret')}>
                      <span className="inline-flex">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pendingRotate}
                          onClick={() =>
                            ask(
                              k,
                              t('apiKeysPage.rotateSecretTitle'),
                              t('apiKeysPage.rotateSecretDesc', { name: k.name }),
                              false,
                              onRotate,
                            )
                          }
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip content={tc('delete')}>
                      <span className="inline-flex">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={pendingDelete}
                          onClick={() =>
                            ask(
                              k,
                              t('apiKeysPage.deleteKeyTitle'),
                              t('apiKeysPage.deleteKeyDesc', { name: k.name }),
                              true,
                              onDelete,
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </span>
                    </Tooltip>
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
            <Button
              type="button"
              variant="outline"
              onClick={closeConfirm}
              disabled={confirm.pending}
            >
              {tc('cancel')}
            </Button>
            <Button
              type="button"
              variant={confirm.destructive ? 'destructive' : 'default'}
              onClick={confirm.onConfirm}
              disabled={confirm.pending}
            >
              {confirm.pending && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{tc('confirm')}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
