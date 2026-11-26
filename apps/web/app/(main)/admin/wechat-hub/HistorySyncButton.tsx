// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 从本地桥自动回填历史消息：wcfhttp 走 /sql 读 MSG 表，mock 返回演示数据。
 * 只做导入，不触发自动回复/出站 webhook；iLink 等不支持的后端会明确提示原因。
 */

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { History, Loader2 } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { wechatHubApi } from './wechat-hub-api'

export default function HistorySyncButton({ accountId }: { accountId: string }) {
  const queryClient = useQueryClient()
  const [notice, setNotice] = React.useState<string | null>(null)
  const syncMutation = useMutation({
    mutationFn: () => wechatHubApi.syncHistory(accountId, { limit: 500 }),
    onSuccess: async (result) => {
      if (result.status !== 'accepted') {
        setNotice(result.reason ?? '当前后端不支持自动回填')
      } else {
        setNotice(
          `拉取 ${result.fetched} 条，导入 ${result.imported} 条，跳过 ${result.skipped} 条，覆盖 ${result.conversations} 个会话${
            result.errors.length > 0 ? `，${result.errors.length} 行有误` : ''
          }${result.source?.db ? `（${result.source.db}.${result.source.table ?? 'MSG'}）` : ''}`,
        )
      }
      await queryClient.invalidateQueries({
        queryKey: ['wechat-hub', 'conversations', accountId],
      })
      await queryClient.invalidateQueries({ queryKey: ['wechat-hub', 'messages', accountId] })
      setTimeout(() => setNotice(null), 10_000)
    },
    onError: (error) => {
      setNotice(error instanceof Error ? error.message : '自动回填失败')
      setTimeout(() => setNotice(null), 10_000)
    },
  })

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={syncMutation.isPending}
        onClick={() => syncMutation.mutate()}
      >
        {syncMutation.isPending ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <History className="mr-1 h-3.5 w-3.5" />
        )}
        自动回填
      </Button>
      {notice ? <span className="font-[weight:inherit] text-label text-muted-foreground">{notice}</span> : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
