// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
'use client'

/**
 * 群写审计卡：把「谁在什么时候动了哪个群、成没成」摊开。
 *
 * 频次窗口已经落库，卡片上直接显示本小时还能动几次；到 0 就别再点预览了，
 * 点了也会被 429 挡回来。列表只取最近 5 条，够看趋势又不占版面。
 */

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@ihui/ui-react'
import { wechatHubApi } from './wechat-hub-api'

const ACTION_LABELS: Record<string, string> = {
  kick: '踢出成员',
  invite: '邀请成员',
  create: '建群',
  rename: '改群名',
  announce: '发公告',
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

function formatAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function GroupWriteAuditCard({ accountId }: { accountId: string }) {
  const query = useQuery({
    queryKey: ['wechat-hub', 'group-write-audit', accountId],
    queryFn: () => wechatHubApi.groupAudit(accountId),
  })
  const view = query.data
  const entries = (view?.entries ?? []).slice(-5).reverse()

  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">群写审计</span>
          <span className="text-xs text-muted-foreground">
            {view
              ? `本小时还剩 ${view.remaining} 次（上限 ${view.windowLimit}，已执行 ${view.windowCount}）`
              : '读取中…'}
          </span>
        </div>
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">还没有执行过群写动作。</p>
        ) : (
          <ul className="space-y-0.5 text-xs">
            {entries.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-muted-foreground">{formatAt(entry.at)}</span>
                <span>{actionLabel(entry.action)}</span>
                <span className="truncate">{entry.chatTitle || '（未命名群）'}</span>
                {entry.memberIds.length > 0 ? (
                  <span className="text-muted-foreground">{entry.memberIds.length} 人</span>
                ) : null}
                {entry.ok ? (
                  <span className="text-emerald-600">成功</span>
                ) : (
                  <span className="text-red-600">{entry.status ?? '失败'}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {query.isError ? (
          <p className="text-xs text-red-600">
            {query.error instanceof Error ? query.error.message : '读取审计失败'}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

