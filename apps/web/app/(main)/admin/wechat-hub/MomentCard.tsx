// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 朋友圈发布卡：文本 + 最多 9 张图片 URL，仅 bridge 后端。
 */

'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import type { WechatActionResult } from '@ihui/types'
import { wechatHubApi } from './wechat-hub-api'

export default function MomentCard({ accountId }: { accountId: string }) {
  const [text, setText] = React.useState('')
  const [media, setMedia] = React.useState('')
  const [result, setResult] = React.useState<WechatActionResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      wechatHubApi.publishMoment(accountId, {
        text: text.trim(),
        mediaUrls: media
          .split(/[\s,，]+/)
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    onSuccess: (data) => {
      setError(null)
      setResult(data)
    },
    onError: (e) => {
      setResult(null)
      setError(e instanceof Error ? e.message : '发布朋友圈失败')
    },
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-body">朋友圈</CardTitle>
        <CardDescription>文本 + 最多 9 张图片 URL，仅 bridge 后端可发布。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="wechat-moment-text">正文</Label>
          <textarea
            id="wechat-moment-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="w-full rounded-sm border border-stroke-field bg-transparent px-3 py-2 text-sm outline-none focus:border-stroke-focus"
            placeholder="这条会发到账号朋友圈。"
          />
          <p className="text-xs text-muted-foreground">{text.length} / 5000</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="wechat-moment-media">图片 URL（逗号或换行分隔，可选）</Label>
          <Input
            id="wechat-moment-media"
            value={media}
            onChange={(e) => setMedia(e.target.value)}
            placeholder="https://…"
          />
        </div>
        {result ? (
          <Alert
            variant={result.ok ? 'success' : result.status === 'unsupported' ? 'warning' : 'danger'}
            title={
              result.ok
                ? '桥已接受'
                : result.status === 'unsupported'
                  ? '当前后端不支持'
                  : '发布失败'
            }
            description={result.reason ?? (result.ok ? '动作已交给桥执行。' : '桥未返回原因')}
          />
        ) : null}
        {error ? <Alert variant="danger" title="请求失败" description={error} /> : null}
        <Button
          onClick={() => {
            setResult(null)
            setError(null)
            mutation.mutate()
          }}
          disabled={mutation.isPending || text.trim().length === 0}
        >
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          <span>发布朋友圈</span>
        </Button>
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
