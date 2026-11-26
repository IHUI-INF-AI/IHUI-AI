// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Loader2, Plus } from 'lucide-react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import type { WechatAccountCreateInput, WechatBackend } from '@ihui/types'
import { wechatHubApi } from './wechat-hub-api'

export default function CreateAccountDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [label, setLabel] = React.useState('')
  const [backend, setBackend] = React.useState<WechatBackend>('ilink')
  const [baseUrl, setBaseUrl] = React.useState('http://127.0.0.1:8848')
  const [token, setToken] = React.useState('')
  const [webhookSecret, setWebhookSecret] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  const reset = (): void => {
    setLabel('')
    setBackend('ilink')
    setToken('')
    setWebhookSecret('')
    setError(null)
  }

  const submit = async (): Promise<void> => {
    if (!label.trim()) {
      setError('请填写账号名称')
      return
    }
    const credentials: Record<string, string> = {}
    if (backend === 'bridge') {
      if (!baseUrl.trim()) {
        setError('本地桥必须填写 baseUrl')
        return
      }
      credentials.baseUrl = baseUrl.trim()
      if (token.trim()) credentials.token = token.trim()
      if (webhookSecret.trim()) credentials.webhookSecret = webhookSecret.trim()
    }
    const input: WechatAccountCreateInput = {
      label: label.trim(),
      backend,
      credentials,
    }
    setPending(true)
    setError(null)
    try {
      await wechatHubApi.createAccount(input)
      setOpen(false)
      reset()
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" />
        新增微信账号
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增微信账号</DialogTitle>
          <DialogDescription>
            iLink 用腾讯官方扫码通道；本地桥对接 WeChatFerry / RPA / chatlog；Mock 用于演示。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {error ? <Alert variant="danger" title="创建失败" description={error} /> : null}
          <div className="space-y-1">
            <Label htmlFor="wechat-label">账号名称</Label>
            <Input
              id="wechat-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="例如：主号 / 运营小号"
            />
          </div>
          <div className="space-y-1">
            <Label>接入后端</Label>
            <Select value={backend} onValueChange={(v) => setBackend(v as WechatBackend)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ilink">iLink 官方（仅私聊）</SelectItem>
                <SelectItem value="bridge">本地 HTTP 桥（支持群聊）</SelectItem>
                <SelectItem value="mock">Mock（演示/测试）</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {backend === 'bridge' ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="wechat-bridge-url">桥地址</Label>
                <Input
                  id="wechat-bridge-url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://127.0.0.1:8848"
                />
                <p className="font-[weight:inherit] text-label text-muted-foreground">
                  约定 GET /status、GET /messages?since=、POST /message、POST /typing。
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="wechat-bridge-token">桥 Token（可选）</Label>
                <Input
                  id="wechat-bridge-token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="作为 Authorization: Bearer 发给桥"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wechat-bridge-secret">Webhook Secret（推荐）</Label>
                <Input
                  id="wechat-bridge-secret"
                  type="password"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder="桥主动推送入站消息时的验签密钥"
                />
              </div>
            </>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            取消
          </Button>
          <Button onClick={() => void submit()} disabled={pending}>
            {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
