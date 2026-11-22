// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 号池自助授权会话页(/admin/relay/auth-sessions,2026-11-17 立,票一第二腿)。
 *
 * 对标 qoder2api 系网关的「+ 添加账号 (OAuth)」并把这条腿做成运营面:
 *  - 会话列表 + 自动轮询(间隔取自上游声明,受服务端退避闸约束,前端不抢先打);
 *  - 设备码回显:大字 user_code + 二维码 + 可复制完整链接(对照程序只给一条链接);
 *  - 能力声明表把「哪家还没实证」写成人能读的一行,出路原样转呈,不在 UI 里另编说法;
 *  - 终局(入池/失败/过期/撤销)一律标出 failureCode,不靠颜色猜。
 *
 * 刷新只重读会话列表(数据在库里,蓝绿切流与重启都不丢),页面自身不持任何凭证。
 */
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, QrCode, RadioTower, RefreshCw, ShieldAlert, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Badge, Button } from '@ihui/ui-react'
import { QRCodeSVG } from 'qrcode.react'
import { apiOrThrow } from '@/lib/api'
import { BackButton } from '@/components/common'
import { useConfirm } from '@/hooks/use-confirm'

import {
  RelayAuthSessionCreateDialog,
  type CreatedSession,
} from '@/components/admin/relay-auth-session-create-dialog'

interface Session {
  id: string
  providerCode: string
  kind: string
  status: string
  userCode: string | null
  verificationUri: string | null
  qrPayload: string | null
  intervalSeconds: number
  pollAttempts: number
  expiresAt: string
  nextPollAt: string | null
  failureCode: string | null
  failureMessage: string | null
  accountId: string | null
  credFingerprint: string | null
  handleRetained: boolean
  createdAt: string
  capabilityNote: string | null
}

interface Capability {
  providerCode: string
  kind: string
  verified: boolean
  note: string
}

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'secondary',
  authorized: 'outline',
  imported: 'default',
  failed: 'destructive',
  expired: 'destructive',
  cancelled: 'secondary',
}

export default function RelayAuthSessionsPage() {
  const qc = useQueryClient()
  const { confirm, ConfirmDialogRenderer } = useConfirm()
  const [createOpen, setCreateOpen] = React.useState(false)
  const [qrOf, setQrOf] = React.useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: ['relay-auth-sessions'],
    queryFn: () =>
      apiOrThrow<{ items: Session[] }>(
        '/api/admin/relay/auth-sessions?includeTerminal=true&limit=100',
      ),
  })
  const capsQuery = useQuery({
    queryKey: ['relay-auth-capabilities'],
    queryFn: () =>
      apiOrThrow<{ items: Capability[] }>('/api/admin/relay/auth-sessions/capabilities'),
  })

  const sessions = listQuery.data?.items ?? []
  const pending = sessions.filter((s) => s.status === 'pending' || s.status === 'authorized')

  // 自动轮询:取所有 pending 里最小的间隔,且**不早于服务端 nextPollAt**(服务端会拒绝抢先打上游)
  const tickMs = React.useMemo(() => {
    if (pending.length === 0) return null
    const minInterval = Math.min(...pending.map((s) => s.intervalSeconds || 5))
    const gate = pending.reduce<number>((acc, s) => {
      if (!s.nextPollAt) return acc
      const wait = new Date(s.nextPollAt).getTime() - Date.now()
      return wait > 0 ? Math.min(acc, Math.max(1000, wait)) : acc
    }, Number.POSITIVE_INFINITY)
    return Math.max(3000, Math.min(Number.isFinite(gate) ? gate : minInterval * 1000, 30_000))
  }, [pending])

  const pollAll = async () => {
    const r = await apiOrThrow<{ swept: unknown; polled: unknown }>(
      '/api/admin/relay/auth-sessions/sweep',
      {
        method: 'POST',
      },
    )
    void r
    await qc.invalidateQueries({ queryKey: ['relay-auth-sessions'] })
  }

  React.useEffect(() => {
    if (!tickMs) return
    const t = setInterval(() => void pollAll().catch(() => undefined), tickMs)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pollAll 只读列表并失效缓存,引用稳定语义由 queryKey 保证
  }, [tickMs])

  const pollOne = useMutation({
    mutationFn: (id: string) =>
      apiOrThrow<Session>(`/api/admin/relay/auth-sessions/${id}/poll`, { method: 'POST' }),
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: ['relay-auth-sessions'] })
      if (s.status === 'imported') toast.success('已入池(默认停用,请核对通路后启用)')
      else if (s.status === 'pending') toast.message('上游还在等授权')
    },
    onError: (e: Error) => toast.error(e.message || '轮询失败(会话状态已如实记录)'),
  })

  const cancel = useMutation({
    mutationFn: (id: string) =>
      apiOrThrow<Session>(`/api/admin/relay/auth-sessions/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('会话已撤销,把手已销毁')
      void qc.invalidateQueries({ queryKey: ['relay-auth-sessions'] })
    },
    onError: (e: Error) => toast.error(e.message || '撤销失败'),
  })

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => toast.success('已复制'),
      () => toast.error('复制失败'),
    )
  }

  const onCreated = (s: CreatedSession) => {
    void qc.invalidateQueries({ queryKey: ['relay-auth-sessions'] })
    if (s.qrPayload) setQrOf(s.id)
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div className="flex items-end justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-display font-bold tracking-tight">
            <RadioTower aria-hidden="true" />
            自助授权入池
          </h1>
          <p className="text-body text-muted-foreground">
            免客户端把上游账号捞进号池:设备授权(扫码/输码)或个人访问令牌直贴。凭证不外显,终局全部留审计。
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void pollAll()}
            disabled={listQuery.isFetching}
          >
            {listQuery.isFetching ? <Loader2 className="animate-spin" /> : <RefreshCw className="size-4" aria-hidden />}
            检查一次
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            发起授权
          </Button>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="flex items-center text-subtitle font-semibold">
          <ShieldAlert aria-hidden="true" />
          能力声明
        </h2>
        <div className="flex flex-wrap gap-2">
          {(capsQuery.data?.items ?? []).map((c) => (
            <Badge key={`${c.providerCode}-${c.kind}`} variant={c.verified ? 'default' : 'outline'}>
              {c.providerCode} · {c.kind}
            </Badge>
          ))}
          <p className="w-full text-label text-muted-foreground">
            灰底档位 = 上游端点尚未本机取证,发起会被拒绝并给出出路(不建会话、不让人白扫)。
          </p>
        </div>
      </section>

      {qrOf &&
        (() => {
          const s = sessions.find((x) => x.id === qrOf)
          if (!s?.qrPayload) return null
          return (
            <section className="space-y-2 rounded-lg border p-4">
              <h2 className="flex items-center text-subtitle font-semibold">
                <QrCode aria-hidden="true" />
                待授权:{s.providerCode} · {s.kind}
              </h2>
              <div className="flex gap-4">
                <QRCodeSVG value={s.qrPayload} level="M" size={160} />
                <div className="space-y-2">
                  <p className="text-title font-semibold tabular-nums tracking-widest">
                    {s.userCode}
                  </p>
                  <p className="text-label text-muted-foreground">
                    在手机或另一台设备打开下面的地址并输入上面这段码;完成后点「检查一次」。
                  </p>
                  {s.verificationUri && (
                    <Button size="sm" variant="outline" onClick={() => copy(s.qrPayload ?? '')}>
                      复制完整链接
                    </Button>
                  )}
                </div>
              </div>
            </section>
          )
        })()}

      <section className="space-y-2">
        <h2 className="text-subtitle font-semibold">会话列表</h2>
        {sessions.length === 0 && <p className="text-body text-muted-foreground">还没有会话。</p>}
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={STATUS_BADGE[s.status] ?? 'outline'}>{s.status}</Badge>
                <span className="text-body font-medium">
                  {s.providerCode} · {s.kind}
                </span>
                {s.userCode && <span className="text-label tabular-nums">{s.userCode}</span>}
                <span className="text-label text-muted-foreground">
                  轮询 {s.pollAttempts} 次 · 到期 {new Date(s.expiresAt).toLocaleString()}
                </span>
                {s.credFingerprint && (
                  <span className="text-label text-muted-foreground">指纹 {s.credFingerprint}</span>
                )}
                {s.accountId && (
                  <button
                    type="button"
                    className="text-label underline"
                    onClick={() => copy(s.accountId ?? '')}
                  >
                    号池行 id
                  </button>
                )}
                <div className="ms-auto flex gap-2">
                  {s.qrPayload && s.status === 'pending' && (
                    <Button size="sm" variant="outline" onClick={() => setQrOf(s.id)}>
                      <QrCode />
                      出码
                    </Button>
                  )}
                  {(s.status === 'pending' || s.status === 'authorized') && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => pollOne.mutate(s.id)}
                        disabled={pollOne.isPending}
                      >
                        {pollOne.isPending ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <RefreshCw />
                        )}
                        检查
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          confirm({
                            title: '撤销该授权会话?',
                            description:
                              '撤销后上游把手立即销毁,需要重新发起。不会动号池里已有的账号。',
                            variant: 'destructive',
                          }).then((ok) => {
                            if (ok) cancel.mutate(s.id)
                          })
                        }
                      >
                        <XCircle />
                        撤销
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {s.failureMessage && (
                <p className="mt-2 text-label text-muted-foreground">
                  {s.failureCode}: {s.failureMessage}
                </p>
              )}
              {s.capabilityNote && s.status !== 'imported' && (
                <p className="mt-1 text-label text-muted-foreground">{s.capabilityNote}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <RelayAuthSessionCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={onCreated}
      />
      <ConfirmDialogRenderer />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
