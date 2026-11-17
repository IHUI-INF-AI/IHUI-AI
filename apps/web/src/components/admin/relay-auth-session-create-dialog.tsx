// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 号池自助授权 —— 发起对话框(2026-11-17 立,票一第二腿)。
 *
 * 对标 qoder2api 系网关的「+ 添加账号 (OAuth)」,这里比它多做两件事:
 *  - 形态按能力表数据驱动:未实证的档**灰显并原样显示出路**(来自 /capabilities),
 *    不给用户「点了才发现等不到」的体验(对照程序把死路照原样摆出来);
 *  - 发起后立刻回显 user_code + 二维码 + 可复制的完整链接,并落到会话列表继续轮询,
 *    不在弹窗里造第二个轮询循环(两处轮询 = 上游被打两次)。
 *
 * PAT 输入:一次性凭证,提交后立即清空本地状态,不写 localStorage、不进 URL、不回显。
 */
import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@ihui/ui-react'
import { apiOrThrow } from '@/lib/api'

interface CapabilityItem {
  providerCode: string
  kind: string
  mapper: string
  verified: boolean
  issuanceUrl: string | null
  note: string
}

export interface CreatedSession {
  id: string
  providerCode: string
  kind: string
  status: string
  userCode: string | null
  verificationUri: string | null
  verificationUriComplete: string | null
  qrPayload: string | null
  intervalSeconds: number
}

const KIND_LABELS: Record<string, string> = {
  device_flow: '设备授权(扫码/输码,免客户端)',
  pat: '个人访问令牌(PAT 直贴)',
  redirect_pkce: '授权码 + PKCE(未接线)',
  cookie_exchange: '浏览器 Cookie 换票(未接线)',
}

export function RelayAuthSessionCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (s: CreatedSession) => void
}) {
  const [caps, setCaps] = React.useState<CapabilityItem[]>([])
  const [provider, setProvider] = React.useState('qoder')
  const [kind, setKind] = React.useState('device_flow')
  const [secret, setSecret] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    void apiOrThrow<{ items: CapabilityItem[] }>('/api/admin/relay/auth-sessions/capabilities')
      .then((r) => {
        if (!cancelled) setCaps(r.items)
      })
      .catch(() => {
        if (!cancelled) toast.error('能力声明读取失败,可稍后重试')
      })
    return () => {
      cancelled = true
    }
  }, [open])

  // 关窗即丢票:绝不把 PAT 留在 state 里等下次复用
  React.useEffect(() => {
    if (!open) setSecret('')
  }, [open])

  const create = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = { providerCode: provider, kind, scene: 'admin-pool' }
      if (kind === 'pat') body.secret = secret.trim()
      return apiOrThrow<CreatedSession>('/api/admin/relay/auth-sessions', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: (s) => {
      setSecret('')
      onCreated(s)
      onOpenChange(false)
      if (s.status === 'pending') toast.success('授权会话已建,请在别处完成授权')
      else if (s.status === 'imported') toast.success('已入池(默认停用,请核对通路后启用)')
    },
    onError: (e: Error) => toast.error(e.message || '发起授权失败'),
  })

  const selected = caps.find((c) => c.providerCode === provider && c.kind === kind) ?? null
  const providers = React.useMemo(() => [...new Set(caps.map((c) => c.providerCode))], [caps])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>授权入池(免客户端)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 p-3">
          <div className="space-y-1.5">
            <Label htmlFor="auth-provider">平台</Label>
            <Input
              id="auth-provider"
              list="auth-provider-list"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="qoder"
            />
            <datalist id="auth-provider-list">
              {providers.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>

          <div className="space-y-1.5">
            <Label>授权形态</Label>
            <div className="flex flex-wrap gap-2">
              {caps
                .filter((c) => c.providerCode === provider)
                .map((c) => (
                  <Button
                    key={c.kind}
                    type="button"
                    size="sm"
                    variant={c.kind === kind ? 'default' : 'outline'}
                    disabled={!c.verified}
                    onClick={() => setKind(c.kind)}
                  >
                    {KIND_LABELS[c.kind] ?? c.kind}
                  </Button>
                ))}
              {caps.filter((c) => c.providerCode === provider).length === 0 && (
                <p className="text-body text-muted-foreground">
                  这个平台还没有登记的授权面。现有通道:本机提取或 JSON / tokens 导入。
                </p>
              )}
            </div>
          </div>

          {selected && !selected.verified && (
            <p className="text-label text-muted-foreground">{selected.note}</p>
          )}

          {kind === 'pat' && (
            <div className="space-y-1.5">
              <Label htmlFor="auth-secret">个人访问令牌</Label>
              <Input
                id="auth-secret"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="粘贴上游生成的 PAT"
                autoComplete="off"
              />
              {selected?.issuanceUrl && (
                <a
                  className="text-label underline"
                  href={selected.issuanceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  去上游生成 PAT
                </a>
              )}
              <p className="text-label text-muted-foreground">
                入池默认停用:通路被确认前不会进转发选路,也不会在任何界面回显票面。
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={
              create.isPending ||
              !selected ||
              !selected.verified ||
              (kind === 'pat' && !secret.trim())
            }
          >
            {create.isPending && <Loader2 className="animate-spin" />}
            发起授权
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
