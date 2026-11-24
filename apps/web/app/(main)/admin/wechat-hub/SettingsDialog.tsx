// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import type { WechatAccountView } from '@ihui/types'
import { wechatHubApi } from './wechat-hub-api'

function readList(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.filter((item): item is string => typeof item === 'string').join('\n')
}

function parseList(value: string): string[] {
  return value
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

export default function SettingsDialog({
  account,
  onClose,
  onSaved,
}: {
  account: WechatAccountView | null
  onClose: () => void
  onSaved: () => void
}) {
  const [allowlistEnabled, setAllowlistEnabled] = React.useState(true)
  const [allowedTargets, setAllowedTargets] = React.useState('')
  const [blockedWords, setBlockedWords] = React.useState('')
  const [rateLimit, setRateLimit] = React.useState('20')
  const [outboundWebhookUrl, setOutboundWebhookUrl] = React.useState('')
  const [testNotice, setTestNotice] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!account) return
    setAllowlistEnabled(account.allowlistEnabled)
    setAllowedTargets(readList(account.metadata.allowedTargets))
    setBlockedWords(readList(account.metadata.blockedWords))
    const rate = account.metadata.rateLimitPerMinute
    setRateLimit(typeof rate === 'number' ? String(rate) : '20')
    const webhook = account.metadata.outboundWebhookUrl
    setOutboundWebhookUrl(typeof webhook === 'string' ? webhook : '')
    setTestNotice(null)
    setError(null)
  }, [account])

  const mutation = useMutation({
    mutationFn: () =>
      wechatHubApi.updateSettings(account?.id ?? '', {
        allowlistEnabled,
        allowedTargets: parseList(allowedTargets),
        blockedWords: parseList(blockedWords),
        rateLimitPerMinute: Number(rateLimit) || 20,
        outboundWebhookUrl: outboundWebhookUrl.trim(),
      }),
    onSuccess: () => {
      onSaved()
      onClose()
    },
    onError: (e) => setError(e instanceof Error ? e.message : '保存失败'),
  })

  const testMutation = useMutation({
    mutationFn: () =>
      wechatHubApi.testOutboundWebhook(account?.id ?? '', outboundWebhookUrl.trim()),
    onSuccess: () => {
      setTestNotice('测试事件已送达')
      setTimeout(() => setTestNotice(null), 4_000)
    },
    onError: (e) => {
      setTestNotice(e instanceof Error ? e.message : '测试失败')
      setTimeout(() => setTestNotice(null), 4_000)
    },
  })

  return (
    <Dialog open={Boolean(account)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>发送策略 · {account?.label}</DialogTitle>
          <DialogDescription>
            白名单开启后只允许向清单内目标发送；敏感词命中直接本地拒绝；限流按分钟计数。 出站
            Webhook 可把每条入站消息转发给 n8n / Dify / 自建系统。
          </DialogDescription>
        </DialogHeader>
        {error ? <Alert variant="danger" title="保存失败" description={error} /> : null}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Switch
              id="wechat-settings-allowlist"
              checked={allowlistEnabled}
              onCheckedChange={setAllowlistEnabled}
              size="sm"
            />
            <Label htmlFor="wechat-settings-allowlist">启用目标白名单</Label>
          </div>
          <div className="space-y-1">
            <Label htmlFor="wechat-settings-targets">允许的接收方（一行一个）</Label>
            <textarea
              id="wechat-settings-targets"
              value={allowedTargets}
              onChange={(e) => setAllowedTargets(e.target.value)}
              rows={3}
              className="w-full rounded-sm border border-stroke-field bg-transparent px-3 py-2 text-sm outline-none focus:border-stroke-focus"
              placeholder={'wxid_xxx\nroom_xxx'}
            />
            <p className="text-xs text-muted-foreground">
              白名单开启但清单为空时当前实现会放行，建议先把常用目标填进来。
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="wechat-settings-blocked">敏感词（一行一个）</Label>
            <textarea
              id="wechat-settings-blocked"
              value={blockedWords}
              onChange={(e) => setBlockedWords(e.target.value)}
              rows={3}
              className="w-full rounded-sm border border-stroke-field bg-transparent px-3 py-2 text-sm outline-none focus:border-stroke-focus"
              placeholder="刷单&#10;返利"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wechat-settings-rate">每分钟发送上限</Label>
            <Input
              id="wechat-settings-rate"
              type="number"
              min={1}
              max={120}
              value={rateLimit}
              onChange={(e) => setRateLimit(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wechat-settings-webhook">出站 Webhook（入站消息转发）</Label>
            <div className="flex items-center gap-2">
              <Input
                id="wechat-settings-webhook"
                value={outboundWebhookUrl}
                onChange={(e) => setOutboundWebhookUrl(e.target.value)}
                placeholder="https://n8n.example.com/webhook/wechat"
                className="flex-1"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!outboundWebhookUrl.trim() || testMutation.isPending}
                onClick={() => testMutation.mutate()}
              >
                {testMutation.isPending ? '测试中…' : '测试'}
              </Button>
            </div>
            {testNotice ? <p className="text-xs text-muted-foreground">{testNotice}</p> : null}
            <p className="text-xs text-muted-foreground">
              只允许公网 HTTPS；留空关闭。若账号已配置 bridge webhookSecret，会附带 HMAC-SHA256
              签名头，接收方可按时间戳 + 原始 body 验签。
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
