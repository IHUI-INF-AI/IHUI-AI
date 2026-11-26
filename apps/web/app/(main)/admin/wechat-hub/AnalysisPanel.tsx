// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Brain, Loader2 } from 'lucide-react'
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
  Switch,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import type { WechatAnalysisKind, WechatAnalysisRunView } from '@ihui/types'
import AnalysisResultView from './AnalysisResultView'
import { wechatHubApi } from './wechat-hub-api'

const KIND_OPTIONS: Array<{ value: WechatAnalysisKind; label: string }> = [
  { value: 'summary', label: '会话总结' },
  { value: 'daily', label: '当日汇总' },
  { value: 'todos', label: '待办提取' },
  { value: 'keywords', label: '关键词' },
  { value: 'relations', label: '互动关系' },
  { value: 'sentiment', label: '情绪倾向' },
  { value: 'profile', label: '联系人画像' },
]

export default function AnalysisPanel({ accountId }: { accountId: string }) {
  const [kind, setKind] = React.useState<WechatAnalysisKind>('summary')
  const [conversationId, setConversationId] = React.useState('all')
  const [limit, setLimit] = React.useState('200')
  const [force, setForce] = React.useState(false)
  const [run, setRun] = React.useState<WechatAnalysisRunView | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const conversationsQuery = useQuery({
    queryKey: ['wechat-hub', 'conversations', accountId],
    queryFn: () => wechatHubApi.conversations(accountId, 100),
  })
  const analyzeMutation = useMutation({
    mutationFn: () =>
      wechatHubApi.analyze({
        accountId,
        conversationId: conversationId === 'all' ? undefined : conversationId,
        kind,
        limit: Number(limit) || 200,
        force,
      }),
    onSuccess: (data) => {
      setRun(data)
      setError(null)
    },
    onError: (e) => {
      setRun(null)
      setError(e instanceof Error ? e.message : '分析失败')
    },
  })

  const conversations = conversationsQuery.data ?? []

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-body">
            <Brain className="h-4 w-4 text-primary" />
            微信 AI 分析
          </CardTitle>
          <CardDescription>
            本地规则基线 + 可选 LLM 增强；相同消息集合命中缓存会直接复用，force 可强制重算。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <Alert variant="danger" title="分析失败" description={error} /> : null}
          <div className="grid grid-cols-1 gap-3 min-[800px]:grid-cols-3">
            <div className="space-y-1">
              <Label>分析类型</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as WechatAnalysisKind)}>
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
              <Label>范围</Label>
              <Select value={conversationId} onValueChange={setConversationId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部会话</SelectItem>
                  {conversations.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.title || item.platformChatId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="wechat-analysis-limit">消息条数</Label>
              <Input
                id="wechat-analysis-limit"
                type="number"
                min={10}
                max={1000}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => {
                setError(null)
                analyzeMutation.mutate()
              }}
              disabled={analyzeMutation.isPending}
            >
              {analyzeMutation.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Brain className="mr-1 h-4 w-4" />
              )}
              开始分析
            </Button>
            <div className="flex items-center gap-2">
              <Switch
                id="wechat-analysis-force"
                checked={force}
                onCheckedChange={setForce}
                size="sm"
              />
              <Label htmlFor="wechat-analysis-force">强制重算（忽略缓存）</Label>
            </div>
            {run ? (
              <span className="font-[weight:inherit] text-label text-muted-foreground">
                状态：{run.status}
                {run.model ? ` · ${run.model}` : ''}
                {run.tokens ? ` · ${run.tokens} tokens` : ''}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>
      {run?.result ? <AnalysisResultView result={run.result} /> : null}
      {run?.error ? <Alert variant="danger" title="模型调用失败" description={run.error} /> : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
