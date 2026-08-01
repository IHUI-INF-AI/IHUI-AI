'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui-react'
import { imChannelsApi } from './im-channels-api'
import type {
  ImMessageDirection,
  ImMessageHistoryItem,
  ImPlatform,
  ImPlatformMeta,
} from '@ihui/types'
import type { MessageHistoryFilter } from './types'

interface MessageHistoryProps {
  platforms: ImPlatformMeta[]
}

const PAGE_SIZE = 20
const TIME_FMT = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

const DIRECTION_BADGE: Record<ImMessageDirection, { label: string; className: string }> = {
  inbound: {
    label: '入站',
    className: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  },
  outbound: {
    label: '出站',
    className: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  },
}

/** 从 rawPayload 安全提取出站消息 status(契约里 ImMessageHistoryItem 无 status 字段,部分平台 rawPayload 携带) */
function extractOutboundStatus(raw: unknown): 'sent' | 'failed' | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const obj = raw as Record<string, unknown>
  const s = obj.status
  if (typeof s !== 'string') return undefined
  if (s === 'sent' || s === 'success' || s === 'ok') return 'sent'
  if (s === 'failed' || s === 'error') return 'failed'
  return undefined
}

const DEFAULT_FILTER: MessageHistoryFilter = {
  platform: 'all',
  direction: 'all',
  page: 1,
}

export default function MessageHistory({ platforms }: MessageHistoryProps) {
  const [filter, setFilter] = React.useState<MessageHistoryFilter>(DEFAULT_FILTER)

  const offset = (filter.page - 1) * PAGE_SIZE
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['im-channels', 'messages', filter],
    queryFn: () =>
      imChannelsApi.fetchMessages({
        platform: filter.platform === 'all' ? undefined : (filter.platform as ImPlatform),
        direction: filter.direction === 'all' ? undefined : filter.direction,
        limit: PAGE_SIZE,
        offset,
      }),
    placeholderData: (prev) => prev,
  })

  const items: ImMessageHistoryItem[] = data?.items ?? []
  const total: number = data?.total ?? 0
  const totalPages: number = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage: number = Math.min(filter.page, totalPages)
  const platformLabelMap = React.useMemo(
    () => new Map<string, string>(platforms.map((p) => [p.platform, p.displayName])),
    [platforms],
  )

  const updateFilter = (patch: Partial<MessageHistoryFilter>): void => {
    setFilter((prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }))
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {/* 筛选行 */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">平台</Label>
            <Select value={filter.platform} onValueChange={(v) => updateFilter({ platform: v })}>
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部平台</SelectItem>
                {platforms.map((p) => (
                  <SelectItem key={p.platform} value={p.platform}>
                    {p.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">方向</Label>
            <Select
              value={filter.direction}
              onValueChange={(v) =>
                updateFilter({ direction: v as MessageHistoryFilter['direction'] })
              }
            >
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="inbound">入站</SelectItem>
                <SelectItem value="outbound">出站</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            共 <span className="tabular-nums">{total}</span> 条
          </div>
        </div>

        {/* 表格(容器完整描边,无分割线) */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground [&>tr>th]:whitespace-nowrap">
              <tr>
                <th className="px-3 py-2 text-left">时间</th>
                <th className="px-3 py-2 text-left">平台</th>
                <th className="px-3 py-2 text-left">方向</th>
                <th className="px-3 py-2 text-left">状态</th>
                <th className="px-3 py-2 text-left">内容</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                    加载中…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    暂无消息历史
                  </td>
                </tr>
              ) : (
                items.map((m) => {
                  const dir = DIRECTION_BADGE[m.direction]
                  const outStatus =
                    m.direction === 'outbound' ? extractOutboundStatus(m.rawPayload) : undefined
                  return (
                    <tr key={m.id} className="hover:bg-muted/40">
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums text-xs text-muted-foreground">
                        {TIME_FMT.format(new Date(m.createdAt))}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {platformLabelMap.get(m.platform) ?? m.platform}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs ${dir.className}`}
                        >
                          {dir.label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {outStatus ? (
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs ${
                              outStatus === 'sent'
                                ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                                : 'bg-red-500/10 text-red-700 dark:text-red-400'
                            }`}
                          >
                            {outStatus === 'sent' ? '已发送' : '失败'}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="line-clamp-2 max-w-md text-xs">{m.content}</span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            第 <span className="tabular-nums">{currentPage}</span> /{' '}
            <span className="tabular-nums">{totalPages}</span> 页
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || isFetching}
              onClick={() => updateFilter({ page: currentPage - 1 })}
            >
              <ChevronLeft className="h-3 w-3" /> 上一页
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages || isFetching}
              onClick={() => updateFilter({ page: currentPage + 1 })}
            >
              下一页 <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
