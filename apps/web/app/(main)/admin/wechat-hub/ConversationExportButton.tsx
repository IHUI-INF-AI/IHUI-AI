// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import type { WechatExportFormat } from '@ihui/types'
import { wechatHubApi } from './wechat-hub-api'

const FORMATS: Array<{ value: WechatExportFormat; label: string }> = [
  { value: 'jsonl', label: 'JSONL' },
  { value: 'csv', label: 'CSV' },
  { value: 'html', label: 'HTML 单文件' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'xlsx', label: 'Excel' },
  { value: 'chatlab', label: 'ChatLab JSON' },
]

/** xlsx 返回 base64，其余是 UTF-8 文本；两种都落成 Blob 再下载。 */
function downloadExport(
  filename: string,
  content: string,
  mimeType: string,
  encoding?: string,
): void {
  let blob: Blob
  if (encoding === 'base64') {
    const binary = atob(content)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    blob = new Blob([bytes], { type: mimeType })
  } else {
    blob = new Blob([content], { type: mimeType })
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export default function ConversationExportButton({
  accountId,
  conversationId,
}: {
  accountId: string
  conversationId: string | null
}) {
  const [notice, setNotice] = React.useState<string | null>(null)
  const [format, setFormat] = React.useState<WechatExportFormat>('jsonl')
  const exportMutation = useMutation({
    mutationFn: (selectedFormat: WechatExportFormat) =>
      wechatHubApi.exportMessages(accountId, {
        format: selectedFormat,
        conversationId: conversationId ?? undefined,
        limit: 5_000,
      }),
    onSuccess: (result) => {
      downloadExport(result.filename, result.content, result.mimeType, result.encoding)
      setNotice(`已导出 ${result.count} 条`)
      setTimeout(() => setNotice(null), 4_000)
    },
    onError: (error) => {
      setNotice(error instanceof Error ? error.message : '导出失败')
      setTimeout(() => setNotice(null), 4_000)
    },
  })

  return (
    <div className="flex items-center gap-2">
      <select
        value={format}
        onChange={(event) => setFormat(event.target.value as WechatExportFormat)}
        aria-label="导出格式"
        className="h-8 rounded-md border border-stroke-field bg-transparent px-2 text-xs outline-none focus:border-stroke-focus"
      >
        {FORMATS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        variant="outline"
        onClick={() => exportMutation.mutate(format)}
        disabled={exportMutation.isPending}
      >
        {exportMutation.isPending ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="mr-1 h-3.5 w-3.5" />
        )}
        导出
      </Button>
      {notice ? <span className="text-xs text-muted-foreground">{notice}</span> : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
