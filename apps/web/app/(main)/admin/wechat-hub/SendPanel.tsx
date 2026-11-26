// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, Send } from 'lucide-react'
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
import type { WechatMessageKind, WechatSendResult } from '@ihui/types'
import { wechatHubApi } from './wechat-hub-api'

type SendKind = Exclude<WechatMessageKind, 'system' | 'other'>

const KIND_OPTIONS: Array<{ value: SendKind; label: string }> = [
  { value: 'text', label: '文本' },
  { value: 'image', label: '图片' },
  { value: 'file', label: '文件' },
  { value: 'video', label: '视频' },
  { value: 'voice', label: '语音' },
  { value: 'link', label: '链接（按文本发）' },
  { value: 'card', label: '卡片（按文本发）' },
]

function ResultView({ result }: { result: WechatSendResult }) {
  if (result.ok) {
    return (
      <Alert
        variant="success"
        title="发送成功"
        description={`平台回执：${result.platformMessageId ?? '无'}（尝试 ${result.attempts} 次）`}
      />
    )
  }
  return (
    <Alert
      variant="danger"
      title={`发送失败 · ${result.status}`}
      description={`${result.reason ?? '未知原因'}${result.rejectedBy ? `（规则：${result.rejectedBy}）` : ''}`}
    />
  )
}

export default function SendPanel({ accountId }: { accountId: string }) {
  const [target, setTarget] = React.useState('')
  const [kind, setKind] = React.useState<SendKind>('text')
  const [text, setText] = React.useState('')
  const [mediaUrl, setMediaUrl] = React.useState('')
  const [replyTo, setReplyTo] = React.useState('')
  const [mentions, setMentions] = React.useState('')
  const [dryRun, setDryRun] = React.useState(false)
  const [result, setResult] = React.useState<WechatSendResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const statusQuery = useQuery({
    queryKey: ['wechat-hub', 'status', accountId],
    queryFn: () => wechatHubApi.status(accountId),
    refetchInterval: 15_000,
  })
  const sendMutation = useMutation({
    mutationFn: () =>
      wechatHubApi.send({
        accountId,
        target: target.trim(),
        kind,
        text: kind === 'text' || kind === 'link' || kind === 'card' ? text : undefined,
        mediaUrl:
          kind !== 'text' && kind !== 'link' && kind !== 'card' ? mediaUrl.trim() : undefined,
        replyToMessageId: replyTo.trim() || undefined,
        mentions: mentions
          .split(/[,，\s]+/)
          .map((item) => item.trim())
          .filter(Boolean),
        dryRun,
      }),
    onSuccess: (data) => setResult(data),
    onError: (e) => {
      setResult(null)
      setError(e instanceof Error ? e.message : '发送失败')
    },
  })

  const mediaKind = kind !== 'text' && kind !== 'link' && kind !== 'card'
  const online = statusQuery.data?.online ?? false

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-body">主动发送</CardTitle>
        <CardDescription>
          发送前会走白名单、敏感词与每分钟限流；dry-run 只校验策略不真正投递。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!online ? (
          <Alert
            variant="warning"
            title="账号不在线"
            description="请先到账号卡片点「连接/扫码登录」，否则发送会被后端拒绝。"
          />
        ) : null}
        <div className="grid grid-cols-1 gap-3 min-[800px]:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="wechat-send-target">接收方</Label>
            <Input
              id="wechat-send-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="iLink 对方 user_id / 群 chat_id / 桥定义的 target"
            />
          </div>
          <div className="space-y-1">
            <Label>消息类型</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as SendKind)}>
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
        </div>
        {mediaKind ? (
          <div className="space-y-1">
            <Label htmlFor="wechat-send-media">媒体 URL</Label>
            <Input
              id="wechat-send-media"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://…（iLink 会下载后 AES-128-ECB 加密上传）"
            />
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="wechat-send-text">正文</Label>
            <textarea
              id="wechat-send-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              className="font-[weight:inherit] w-full rounded-md border border-stroke-field bg-transparent px-3 py-2 text-body outline-none focus:border-stroke-focus"
              placeholder="支持多行；iLink 会剥离 Markdown 标记后按纯文本发送。"
            />
            <p className="font-[weight:inherit] text-label text-muted-foreground">{text.length} / 5000</p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 min-[800px]:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1">
            <Label htmlFor="wechat-send-reply">引用回复的消息 ID（可选）</Label>
            <Input
              id="wechat-send-reply"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder="platform_message_id"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wechat-send-mentions">群 @ 成员（可选）</Label>
            <Input
              id="wechat-send-mentions"
              value={mentions}
              onChange={(e) => setMentions(e.target.value)}
              placeholder="成员 id，逗号分隔（仅 bridge 群聊）"
            />
          </div>
          <div className="flex items-end gap-2 pb-1">
            <Switch id="wechat-send-dry" checked={dryRun} onCheckedChange={setDryRun} size="sm" />
            <Label htmlFor="wechat-send-dry">只预演（dry-run）</Label>
          </div>
        </div>
        {result ? <ResultView result={result} /> : null}
        {error ? <Alert variant="danger" title="请求失败" description={error} /> : null}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setResult(null)
              setError(null)
              sendMutation.mutate()
            }}
            disabled={sendMutation.isPending || !target.trim()}
          >
            {sendMutation.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1 h-4 w-4" />
            )}
            {dryRun ? '预演' : '发送'}
          </Button>
          <span className="font-[weight:inherit] text-label text-muted-foreground">
            账号状态：{statusQuery.data?.status ?? '未知'}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
