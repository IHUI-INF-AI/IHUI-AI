// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 群发卡：按标签或全部未拉黑联系人群发，单次上限 100，逐条走出站策略。
 */

'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, Megaphone } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import type { WechatBroadcastResult } from '@ihui/types'
import { wechatHubApi } from './wechat-hub-api'

export default function BroadcastCard({ accountId }: { accountId: string }) {
  const [text, setText] = React.useState('')
  const [tags, setTags] = React.useState('')
  const [dryRun, setDryRun] = React.useState(false)
  const [result, setResult] = React.useState<WechatBroadcastResult | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      wechatHubApi.broadcast(accountId, {
        text: text.trim(),
        tags: tags
          .split(/[,，\s]+/)
          .map((item) => item.trim())
          .filter(Boolean),
        dryRun,
      }),
    onSuccess: (data) => setResult(data),
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-body">
          <Megaphone className="h-4 w-4" />
          <span>群发</span>
        </CardTitle>
        <CardDescription>
          按标签或全部未拉黑联系人群发；单次最多 100 个目标，逐条走白名单/敏感词/限流。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="wechat-broadcast-text">正文</Label>
          <textarea
            id="wechat-broadcast-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="font-[weight:inherit] w-full rounded-md border border-stroke-field bg-transparent px-3 py-2 text-body outline-none focus:border-stroke-focus"
            placeholder="群发文案；不带标签时发给全部未拉黑联系人。"
          />
          <p className="font-[weight:inherit] text-label text-muted-foreground">{text.length} / 5000</p>
        </div>
        <div className="grid grid-cols-1 gap-3 min-[800px]:grid-cols-[1fr_auto]">
          <div className="space-y-1">
            <Label htmlFor="wechat-broadcast-tags">只发给这些标签（可选）</Label>
            <Input
              id="wechat-broadcast-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="VIP, 老客户（任一命中）"
            />
          </div>
          <div className="flex items-end gap-2 pb-1">
            <Switch
              id="wechat-broadcast-dry"
              checked={dryRun}
              onCheckedChange={setDryRun}
              size="sm"
            />
            <Label htmlFor="wechat-broadcast-dry">只预演</Label>
          </div>
        </div>
        {result ? (
          <Alert
            variant={result.failed === 0 ? 'success' : 'warning'}
            title={`群发完成：成功 ${result.sent} / ${result.total}`}
            description={
              result.failed > 0
                ? result.results
                    .filter((item) => !item.ok)
                    .slice(0, 5)
                    .map((item) => `${item.target}: ${item.reason ?? item.status}`)
                    .join('；')
                : '全部目标已投递。'
            }
          />
        ) : null}
        {mutation.isError ? (
          <Alert
            variant="danger"
            title="群发失败"
            description={mutation.error instanceof Error ? mutation.error.message : '未知错误'}
          />
        ) : null}
        <Button
          onClick={() => {
            setResult(null)
            mutation.mutate()
          }}
          disabled={mutation.isPending || !text.trim()}
        >
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          <span>开始群发</span>
        </Button>
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
