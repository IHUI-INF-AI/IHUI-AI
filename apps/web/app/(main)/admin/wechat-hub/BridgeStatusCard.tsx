// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 桥体检卡：不用再开 PowerShell 去 curl /status。
 *
 * 显示的是真话：桥连不上就是连不上，并把「3 秒没响应」「HTTP 401」「没配地址」分开说，
 * 因为这些情况的修法完全不同——端口没开、密钥不对、账号没配桥地址。
 */

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { wechatHubApi } from './wechat-hub-api'

function dotClass(view: { reachable: boolean; online: boolean | null } | undefined): string {
  if (!view) return 'bg-muted-foreground'
  if (!view.reachable) return 'bg-red-500'
  if (view.online === false) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function verdict(view: {
  reachable: boolean
  online: boolean | null
  error: string | null
} | undefined): string {
  if (!view) return '正在探活'
  if (!view.reachable) return '桥不可达'
  if (view.online === false) return '桥在线但没有连上微信'
  if (view.error) return view.error
  return '桥在线'
}

export default function BridgeStatusCard({ accountId }: { accountId: string }) {
  const query = useQuery({
    queryKey: ['wechat-hub', 'bridge-status', accountId],
    queryFn: () => wechatHubApi.bridgeStatus(accountId),
    // 桥状态变化快，30 秒自己再探一次，避免面板显示的还是启动时的老状态
    refetchInterval: 30_000,
    staleTime: 10_000,
  })
  const view = query.data

  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${dotClass(view)}`} />
            <span className="text-body font-medium">桥体检</span>
            <span className="font-[weight:inherit] text-label text-muted-foreground">{verdict(view)}</span>
          </div>
          <Button variant="ghost" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>
            {query.isFetching ? '探测中…' : '重新探测'}
          </Button>
        </div>
        {view ? (
          <div className="font-[weight:inherit] grid grid-cols-2 gap-x-4 gap-y-1 text-label text-muted-foreground">
            <span>地址</span>
            <span className="truncate">{view.baseUrl || '—'}</span>
            <span>驱动</span>
            <span>{view.driver ?? '—'}</span>
            <span>驱动状态</span>
            <span>{view.status ?? '—'}</span>
            <span>待取队列</span>
            <span>{view.queued === null ? '—' : `${view.queued} 条`}</span>
            <span>响应耗时</span>
            <span>{view.latencyMs} ms</span>
            <span>HTTP</span>
            <span>{view.httpStatus === null ? '—' : view.httpStatus}</span>
          </div>
        ) : null}
        {query.isError ? (
          <p className="font-[weight:inherit] text-label text-red-600">
            {query.error instanceof Error ? query.error.message : '探测失败'}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
