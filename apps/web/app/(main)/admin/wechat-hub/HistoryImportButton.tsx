// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 历史消息导入按钮：吃 IHUI 导出的 JSONL/JSON/CSV，按 platformMessageId 去重。
 * 只写本地库，不触发出站 webhook / 自动回复。
 */

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Upload } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import type { WechatImportMessageRow } from '@ihui/types'
import { wechatHubApi } from './wechat-hub-api'
import { parseHistoryRows } from './history-import-format'

const MAX_FILE_BYTES = 20 * 1024 * 1024

export default function HistoryImportButton({ accountId }: { accountId: string }) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const [notice, setNotice] = React.useState<string | null>(null)
  const importMutation = useMutation({
    mutationFn: (rows: WechatImportMessageRow[]) =>
      wechatHubApi.importMessages(accountId, { messages: rows }),
    onSuccess: async (result) => {
      const firstError = result.errors[0]
      setNotice(
        `导入 ${result.imported} 条，跳过 ${result.skipped} 条，覆盖 ${result.conversations} 个会话${
          firstError
            ? `；${result.errors.length} 行有误，首条第 ${firstError.index + 1} 行：${firstError.reason}`
            : ''
        }`,
      )
      await queryClient.invalidateQueries({
        queryKey: ['wechat-hub', 'conversations', accountId],
      })
      await queryClient.invalidateQueries({ queryKey: ['wechat-hub', 'messages', accountId] })
      setTimeout(() => setNotice(null), 8_000)
    },
    onError: (error) => {
      setNotice(error instanceof Error ? error.message : '导入失败')
      setTimeout(() => setNotice(null), 8_000)
    },
  })

  async function onFile(file: File): Promise<void> {
    if (file.size > MAX_FILE_BYTES) {
      setNotice('文件超过 20MB，请拆成多个文件导入')
      return
    }
    try {
      importMutation.mutate(parseHistoryRows(await file.text()))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '文件解析失败')
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".json,.jsonl,.csv,application/json,text/csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void onFile(file)
        }}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={importMutation.isPending}
        onClick={() => inputRef.current?.click()}
      >
        {importMutation.isPending ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="mr-1 h-3.5 w-3.5" />
        )}
        导入历史
      </Button>
      {notice ? <span className="font-[weight:inherit] text-label text-muted-foreground">{notice}</span> : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
