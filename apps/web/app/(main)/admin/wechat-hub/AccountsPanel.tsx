// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, LogIn, LogOut, QrCode, Settings, Trash2 } from 'lucide-react'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import type { WechatAccountView } from '@ihui/types'
import { cn } from '@/lib/utils'
import CreateAccountDialog from './CreateAccountDialog'
import DeleteAccountDialog from './DeleteAccountDialog'
import QrLoginDialog from './QrLoginDialog'
import SettingsDialog from './SettingsDialog'
import { BACKEND_LABELS, WechatStatusBadge } from './status-badge'
import { wechatHubApi } from './wechat-hub-api'

function formatTime(value: string | null): string {
  if (!value) return '从未'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function AccountsPanel({
  accounts,
  selectedId,
  onSelect,
  onChanged,
}: {
  accounts: WechatAccountView[]
  selectedId: string | null
  onSelect: (id: string) => void
  onChanged: () => void
}) {
  const qc = useQueryClient()
  const [qrAccountId, setQrAccountId] = React.useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<WechatAccountView | null>(null)
  const [settingsTarget, setSettingsTarget] = React.useState<WechatAccountView | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const invalidate = React.useCallback((): void => {
    void qc.invalidateQueries({ queryKey: ['wechat-hub'] })
    onChanged()
  }, [onChanged, qc])

  const connectMutation = useMutation({
    mutationFn: (id: string) => wechatHubApi.connect(id),
    onSuccess: (_data, id) => {
      const account = accounts.find((item) => item.id === id)
      if (account?.backend === 'ilink') setQrAccountId(id)
      invalidate()
    },
    onError: (e) => setError(e instanceof Error ? e.message : '连接失败'),
  })
  const disconnectMutation = useMutation({
    mutationFn: (id: string) => wechatHubApi.disconnect(id),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof Error ? e.message : '断开失败'),
  })

  const busy = connectMutation.isPending || disconnectMutation.isPending

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-body font-semibold">微信账号</h2>
          <p className="font-[weight:inherit] text-label text-muted-foreground">
            一个账号一条长连接；凭据加密存储，前端只看到状态与脱敏信息。
          </p>
        </div>
        <CreateAccountDialog onCreated={invalidate} />
      </div>

      {error ? <Alert variant="danger" title="操作失败" description={error} /> : null}

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-body text-muted-foreground">
            还没有微信账号。先新增一个 iLink 账号扫码，或用 Mock 后端把整条链路跑通。
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2 min-[1400px]:grid-cols-3">
          {accounts.map((account) => {
            const selected = account.id === selectedId
            return (
              <Card
                key={account.id}
                className={cn(
                  'transition-colors',
                  selected ? 'border-stroke-strong bg-muted/30' : 'hover:border-stroke-default',
                )}
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-body font-semibold">{account.label}</p>
                      <p className="font-[weight:inherit] text-label text-muted-foreground">
                        {BACKEND_LABELS[account.backend] ?? account.backend}
                        {account.externalId ? ` · ${account.externalId}` : ''}
                        {account.allowlistEnabled ? ' · 白名单' : ''}
                      </p>
                    </div>
                    <WechatStatusBadge status={account.status} />
                  </div>
                  <p className="font-[weight:inherit] text-label text-muted-foreground">
                    最近轮询：{formatTime(account.lastPollAt)}
                  </p>
                  {account.lastError ? (
                    <p className="font-[weight:inherit] line-clamp-2 break-words text-label text-red-600 dark:text-red-400">
                      {account.lastError}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => onSelect(account.id)}>
                      查看
                    </Button>
                    {account.status === 'online' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => disconnectMutation.mutate(account.id)}
                      >
                        <LogOut className="mr-1 h-3.5 w-3.5" />
                        断开
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => connectMutation.mutate(account.id)}
                      >
                        {connectMutation.isPending ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <LogIn className="mr-1 h-3.5 w-3.5" />
                        )}
                        {account.backend === 'ilink' ? '扫码登录' : '连接'}
                      </Button>
                    )}
                    {account.status === 'awaiting_scan' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setQrAccountId(account.id)}
                      >
                        <QrCode className="mr-1 h-3.5 w-3.5" />
                        二维码
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => setSettingsTarget(account)}>
                      <Settings className="mr-1 h-3.5 w-3.5" />
                      策略
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(account)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      删除
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <QrLoginDialog
        accountId={qrAccountId}
        onClose={() => setQrAccountId(null)}
        onOnline={invalidate}
      />
      <SettingsDialog
        account={settingsTarget}
        onClose={() => setSettingsTarget(null)}
        onSaved={invalidate}
      />
      <DeleteAccountDialog
        account={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={invalidate}
      />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
