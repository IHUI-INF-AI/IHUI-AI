// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { BarChart3, Copy, Download, Loader2 } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import type { WechatReportKind, WechatReportResult } from '@ihui/types'
import { wechatHubApi } from './wechat-hub-api'

const KIND_OPTIONS: Array<{ value: WechatReportKind; label: string }> = [
  { value: 'annual', label: '年度报告（全账号）' },
  { value: 'pair', label: '双人对话报告' },
  { value: 'group', label: '群聊活跃报告' },
]

function downloadMarkdown(report: WechatReportResult) {
  const blob = new Blob([report.markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${report.title.replace(/[\\/:*?"<>|]/g, '-')}.md`
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function ReportPanel({ accountId }: { accountId: string }) {
  const [kind, setKind] = React.useState<WechatReportKind>('annual')
  const [year, setYear] = React.useState(String(new Date().getFullYear()))
  const [conversationId, setConversationId] = React.useState('')
  const [report, setReport] = React.useState<WechatReportResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  const conversationsQuery = useQuery({
    queryKey: ['wechat-hub', 'conversations', accountId],
    queryFn: () => wechatHubApi.conversations(accountId, 100),
  })
  const conversations = conversationsQuery.data ?? []

  const reportMutation = useMutation({
    mutationFn: () =>
      wechatHubApi.report(accountId, {
        kind,
        year: Number(year) || undefined,
        conversationId: kind === 'annual' ? undefined : conversationId || undefined,
      }),
    onSuccess: (data) => {
      setReport(data)
      setError(null)
    },
    onError: (e) => {
      setReport(null)
      setError(e instanceof Error ? e.message : '生成报告失败')
    },
  })

  const needConversation = kind !== 'annual' && conversations.length > 0

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-body">
            <BarChart3 className="h-4 w-4 text-primary" />
            微信报告
          </CardTitle>
          <CardDescription>
            年度 / 双人 / 群聊三类报告，全部按本地消息聚合；数字不经过模型，模型不参与统计。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <Alert variant="danger" title="生成失败" description={error} /> : null}
          <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-4">
            <div className="space-y-1">
              <Label>报告类型</Label>
              <Select value={kind} onValueChange={(value) => setKind(value as WechatReportKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>年份</Label>
              <Input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" />
            </div>
            {kind === 'annual' ? null : (
              <div className="space-y-1">
                <Label>会话</Label>
                <Select value={conversationId} onValueChange={setConversationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="先选一个会话" />
                  </SelectTrigger>
                  <SelectContent>
                    {conversations.map((conversation) => (
                      <SelectItem key={conversation.id} value={conversation.id}>
                        {conversation.title || conversation.platformChatId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-end">
              <Button
                onClick={() => reportMutation.mutate()}
                disabled={reportMutation.isPending || (needConversation && !conversationId)}
              >
                {reportMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                生成报告
              </Button>
            </div>
          </div>

          {report ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 min-[900px]:grid-cols-4">
                {[
                  { label: '消息总数', value: report.stats.messageCount },
                  { label: '参与者', value: report.stats.participantCount },
                  { label: '有聊天天数', value: report.stats.activeDays },
                  {
                    label: '回复中位数',
                    value:
                      report.stats.medianReplySeconds === null
                        ? '—'
                        : `${report.stats.medianReplySeconds}s`,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-md border border-stroke-subtle bg-muted/20 px-3 py-2"
                  >
                    <p className="text-[11px] text-muted-foreground">{item.label}</p>
                    <p className="text-body font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>

              {report.highlights.length > 0 ? (
                <ul className="space-y-1 rounded-md border border-stroke-subtle p-3">
                  {report.highlights.map((highlight) => (
                    <li key={highlight} className="text-label text-muted-foreground">
                      · {highlight}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(report.markdown).then(() => {
                      setCopied(true)
                      setTimeout(() => setCopied(false), 1_500)
                    })
                  }}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  {copied ? '已复制' : '复制 Markdown'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadMarkdown(report)}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  下载 .md
                </Button>
              </div>

              <pre className="max-h-[420px] overflow-auto rounded-md border border-stroke-subtle bg-muted/10 p-3 text-[12px] leading-relaxed whitespace-pre-wrap">
                {report.markdown}
              </pre>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
