// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Key, Plus, Trash2, RotateCcw, Copy, Eye, EyeOff, Loader2, Power } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'
import { BackButton } from '@/components/common'
import { useConfirm } from '@/hooks/use-confirm'
// 一键接入配置生成器(2026-09-16,对标 Sub2API useKeyModal)
import { KeyUseDialog } from '@/components/developer/KeyUseDialog'

interface RelayKey {
  id: string
  name: string
  key: string
  permissions: string[]
  status: string
  rateLimit: number
  tokenBalance: number
  costBalanceCents: number
  tokenUsedTotal: number
  costUsedTotalCents: number
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
}

interface KeysData {
  list: RelayKey[]
}

// 2026-09-13 修复:原先的 read/write/admin/billing/webhook 不是合法权限点,
// 会被后端 isValidApiKeyPermission 全部过滤掉,导致新建 Key permissions 为空
// 2026-09-23 i18n 接线:本表只存 `developer.relayKeys` 族内的取词键名(渲染处 t(s.labelKey)),
// value 是后端权限点字面值,不得改动。
const SCOPES: Array<{ value: string; labelKey: string }> = [
  { value: 'chat:write', labelKey: 'scopeChat' },
  { value: 'models:read', labelKey: 'scopeModels' },
  { value: 'embeddings:write', labelKey: 'scopeEmbeddings' },
  { value: 'images:write', labelKey: 'scopeImages' },
  { value: 'audio:write', labelKey: 'scopeAudio' },
  { value: 'videos:write', labelKey: 'scopeVideos' },
]

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function maskKey(k: string): string {
  if (k.length <= 8) return k
  return k.slice(0, 4) + '****' + k.slice(-4)
}

/** 额度三态文案(取词在组件内完成,模块层不取词) */
interface QuotaLabels {
  unlimited: string
  exhausted: string
}

interface QuotaCell {
  text: string
  danger: boolean
}

function formatToken(n: number, labels: QuotaLabels, num: Intl.NumberFormat): QuotaCell {
  if (n === -1) return { text: labels.unlimited, danger: false }
  if (n === 0) return { text: labels.exhausted, danger: true }
  return { text: num.format(n), danger: false }
}

function formatBalance(cents: number, labels: QuotaLabels, money: Intl.NumberFormat): QuotaCell {
  if (cents === -1) return { text: labels.unlimited, danger: false }
  if (cents === 0) return { text: labels.exhausted, danger: true }
  return { text: money.format(cents / 100), danger: false }
}

export default function RelayKeysPage() {
  const { confirm, ConfirmDialogRenderer } = useConfirm()
  const locale = useLocale()
  const t = useTranslations('developer.relayKeys')
  // 复用开发者中心既有词表(developer.*)与通用词表(common.*),不造第二套
  const td = useTranslations('developer')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [scopes, setScopes] = React.useState<string[]>(['chat:write', 'models:read'])
  // 2026-09-13 修复:创建成功后展示明文 secret(仅此一次,后端只返回一次);
  // mode 区分「创建」与「重置」,重置同样会返回新 secret,复用同一弹窗展示
  const [created, setCreated] = React.useState<{
    mode: 'create' | 'reset'
    apiKey: { id: string; name: string; key: string }
    secret: string
  } | null>(null)
  const [secretVisible, setSecretVisible] = React.useState(false)
  const [visible, setVisible] = React.useState<Record<string, boolean>>({})
  // 一键接入配置生成器弹窗状态(2026-09-16)
  const [useOpen, setUseOpen] = React.useState(false)
  const [useTarget, setUseTarget] = React.useState<{ id: string; name: string } | null>(null)
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' })
  const num = new Intl.NumberFormat(locale)
  // 金额一律走 Intl:币种符号由 locale 决定,不焊进文案
  const money = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const quotaLabels: QuotaLabels = {
    unlimited: t('unlimitedQuota'),
    exhausted: t('exhausted'),
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['developer', 'relay', 'keys'],
    queryFn: () =>
      api<KeysData>('/api/developer/relay/keys').catch(() => ({ list: [] }) as KeysData),
  })
  const list = data?.list ?? []

  // 2026-09-13 修复:原 POST /api/developer/keys + scopes 字段名均错误,
  // 改为中转站端点 /api/developer/relay/keys + permissions 字段
  const createMut = useMutation({
    mutationFn: () =>
      api<{ apiKey: { id: string; name: string; key: string }; secret: string }>(
        '/api/developer/relay/keys',
        {
          method: 'POST',
          body: JSON.stringify({ name, permissions: scopes }),
        },
      ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['developer', 'relay', 'keys'] })
      setOpen(false)
      setName('')
      setScopes(['chat:write', 'models:read'])
      setCreated({ mode: 'create', ...data })
      setSecretVisible(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  // 2026-09-16 升级:改用专用吊销端点 POST /keys/:id/revoke(软操作/幂等/单向迁移,
  // 服务端保留 Key 记录与调用日志);恢复仍走 PATCH status='active'。
  const revokeMut = useMutation({
    mutationFn: (id: string) => api(`/api/developer/relay/keys/${id}/revoke`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer', 'relay', 'keys'] })
      toast.success(t('revokedToast'))
    },
    onError: (e: Error) => toast.error(e.message),
  })
  // 2026-09-13 新增:误吊销可恢复,避免一次性不可逆操作
  const restoreMut = useMutation({
    mutationFn: (id: string) =>
      api(`/api/developer/relay/keys/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'active' }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer', 'relay', 'keys'] })
      toast.success(t('enabledToast'))
    },
    onError: (e: Error) => toast.error(e.message),
  })
  // 2026-09-13 修复:原 /api/developer/keys/:id/reset 不是中转站端点;
  // 改为 relay 侧新增的 reset 端点,新 secret 仅此一次返回,复用创建成功弹窗展示
  const resetMut = useMutation({
    mutationFn: (id: string) =>
      api<{ apiKey: { id: string; name: string; key: string }; secret: string }>(
        `/api/developer/relay/keys/${id}/reset`,
        { method: 'POST' },
      ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['developer', 'relay', 'keys'] })
      setCreated({ mode: 'reset', ...data })
      setSecretVisible(false)
      toast.success(t('resetToast'))
    },
    onError: (e: Error) => toast.error(e.message),
  })
  // 2026-09-16 新增:重置当前 Key 的限流窗口用量计数(清空窗口统计,非重置 secret)
  const resetWindowsMut = useMutation({
    mutationFn: (id: string) =>
      api<{ cleared: number }>(`/api/developer/relay/keys/${id}/reset-windows`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['developer', 'relay', 'keys'] })
      toast.success(t('windowsCleared', { count: data.cleared }))
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function copyKey(k: string) {
    navigator.clipboard?.writeText(k).then(
      () => toast.success(td('bootstrap.copied')),
      () => toast.error(td('bootstrap.copyFailed')),
    )
  }
  function toggleScope(s: string) {
    setScopes((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <BackButton />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Key className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          {t('createKey')}
        </Button>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {td('loading')}
          </div>
        ) : list.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{td('noData')}</p>
        ) : (
          <div className="space-y-2 p-3">
            {list.map((k) => {
              const tok = formatToken(k.tokenBalance, quotaLabels, num)
              const bal = formatBalance(k.costBalanceCents, quotaLabels, money)
              return (
                <div key={k.id} className="rounded-md bg-muted/40 p-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{k.name}</p>
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 text-xs font-medium',
                            k.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                          )}
                        >
                          {k.status === 'active'
                            ? t('statusActive')
                            : td('capabilities.keyRevoked')}
                        </span>
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          {k.rateLimit}/min
                        </span>
                        {k.permissions.map((p) => (
                          <span
                            key={p}
                            className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="text-xs text-muted-foreground">
                          {visible[k.id] ? k.key : maskKey(k.key)}
                        </code>
                        <button
                          onClick={() => setVisible((v) => ({ ...v, [k.id]: !v[k.id] }))}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={t('toggleVisibility')}
                        >
                          {visible[k.id] ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </button>
                        <button
                          onClick={() => copyKey(k.key)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={td('bootstrap.copy')}
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        <span>
                          {t('tokenBalance')}
                          <span
                            className={cn(
                              'ml-0.5 font-medium',
                              tok.danger ? 'text-rose-600 dark:text-rose-400' : 'text-foreground',
                            )}
                          >
                            {tok.text}
                          </span>
                        </span>
                        <span>
                          {t('costBalance')}
                          <span
                            className={cn(
                              'ml-0.5 font-medium',
                              bal.danger ? 'text-rose-600 dark:text-rose-400' : 'text-foreground',
                            )}
                          >
                            {bal.text}
                          </span>
                        </span>
                        <span>
                          {t('tokenUsed')}
                          <span className="ml-0.5 font-medium text-foreground">
                            {num.format(k.tokenUsedTotal)}
                          </span>
                        </span>
                        <span>
                          {t('costUsed')}
                          <span className="ml-0.5 font-medium text-foreground">
                            {money.format(k.costUsedTotalCents / 100)}
                          </span>
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('createdOn', { time: dateFmt.format(new Date(k.createdAt)) })}
                        {k.lastUsedAt && (
                          <>
                            {' · '}
                            {td('capabilities.lastUsedAt', {
                              time: dateFmt.format(new Date(k.lastUsedAt)),
                            })}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setUseTarget({ id: k.id, name: k.name })
                          setUseOpen(true)
                        }}
                      >
                        <Key className="h-3.5 w-3.5" aria-hidden />
                        <span>{t('use')}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          if (
                            await confirm({
                              title: t('resetWindowsConfirm'),
                              variant: 'destructive',
                            })
                          ) {
                            resetWindowsMut.mutate(k.id)
                          }
                        }}
                        disabled={resetWindowsMut.isPending}
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                        {t('resetWindows')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resetMut.mutate(k.id)}
                        disabled={resetMut.isPending}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {t('reset')}
                      </Button>
                      {k.status === 'active' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            if (
                              await confirm({
                                title: t('revokeConfirm'),
                                variant: 'destructive',
                              })
                            ) {
                              revokeMut.mutate(k.id)
                            }
                          }}
                          disabled={revokeMut.isPending}
                          className="text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t('revoke')}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => restoreMut.mutate(k.id)}
                          disabled={restoreMut.isPending}
                        >
                          <Power className="h-3.5 w-3.5" />
                          {t('enableAction')}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createKeyTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-sm">{t('keyNameLabel')}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('keyNamePlaceholder')}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">{t('scopesLabel')}</Label>
              <div className="flex flex-wrap gap-2">
                {SCOPES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => toggleScope(s.value)}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs transition-colors',
                      scopes.includes(s.value)
                        ? 'border-brand-accent-deep bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {t(s.labelKey)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('scopesHint', { chat: t('scopeChat'), models: t('scopeModels') })}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={!name.trim() || createMut.isPending}
            >
              {createMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2026-09-13 新增:创建/重置成功后展示明文 secret,仅此一次可复制 */}
      <Dialog open={!!created} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {created?.mode === 'reset' ? t('secretResetTitle') : t('keyCreatedTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Alert variant="warning" title={t('saveSecretNow')} description={t('secretOnceHint')} />
            <div className="space-y-1">
              <Label className="text-sm">{t('keyIdLabel')}</Label>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs">
                  {created?.apiKey.key}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => created && copyKey(created.apiKey.key)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Secret</Label>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs">
                  {created ? (secretVisible ? created.secret : maskKey(created.secret)) : ''}
                </code>
                <button
                  onClick={() => setSecretVisible((v) => !v)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={t('toggleVisibility')}
                >
                  {secretVisible ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => created && copyKey(created.secret)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {/* 2026-09-13 实测闭环补注:网关鉴权 Bearer 用 Key 标识(ihui_ 开头),sk_ Secret 仅用于 X-Api-Secret 辅助校验——不注明用户拿 sk_ 调用会 401 */}
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {t('gatewayHintA')}
              <code className="mx-1 rounded bg-background px-1 py-0.5">
                Authorization: Bearer &lt;{t('keyIdLabel')}&gt;
              </code>
              {t('gatewayHintB')}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>{t('savedClose')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <KeyUseDialog
        open={useOpen}
        onOpenChange={setUseOpen}
        keyId={useTarget?.id ?? ''}
        keyName={useTarget?.name ?? ''}
      />
      <ConfirmDialogRenderer />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
