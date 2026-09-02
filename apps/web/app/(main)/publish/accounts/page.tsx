// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Upload,
  ShieldCheck,
  MoreVertical,
} from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { PLATFORM_KEY } from '../helpers'
import { usePublishAccounts, type PublishAccount } from '@/hooks/use-publish-accounts'
import {
  PLATFORM_SCHEMAS,
  getPlatformSchema,
  normalizeCredentials,
} from '@/lib/publish/platform-schemas'
import { ScanLoginDialog } from './ScanLoginDialog'
import { RiskBadge, type RiskLevel } from '@/components/publish/RiskBadge'
import { CookieHealthIndicator } from '@/components/publish/CookieHealthIndicator'
import { BatchImportDialog } from '@/components/publish/BatchImportDialog'
import { AccountGroupManager } from '@/components/publish/AccountGroupManager'

/** 扩展 PublishAccount 加入风控字段(API 暂未返回时 riskLevel 为 undefined → 显示"未评估") */
interface AccountWithRisk extends PublishAccount {
  readonly riskScore?: number
  readonly riskLevel?: RiskLevel
  readonly cooldownRemaining?: number
}

/** GET /api/publish/accounts/{id}/risk 返回结构(2026-08-17 新增) */
interface RiskData {
  readonly accountId: number
  readonly platform: string
  readonly score: number
  readonly level: RiskLevel
  readonly factors?: readonly unknown[]
  readonly cooldownUntil?: string | null
  readonly cooldownRemaining?: number
}

/** 风控展示字段(与 AccountWithRisk 对齐,拉取失败时保持"未评估") */
interface RiskView {
  readonly score: number
  readonly level: RiskLevel
  readonly cooldownRemaining?: number
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  disabled: 'bg-muted text-muted-foreground',
  expired: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
}
const ACCOUNTS_STATUS_KEY: Record<PublishAccount['status'], string> = {
  active: 'accounts.statusActive',
  disabled: 'accounts.statusDisabled',
  expired: 'accounts.statusExpired',
}

export default function AccountsPage() {
  const t = useTranslations('publish')
  const tc = useTranslations('common')
  const {
    accounts,
    loading,
    saving,
    verifyingId,
    batchVerifying,
    create,
    update,
    verify,
    remove,
    batchVerify,
    reload,
  } = usePublishAccounts()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PublishAccount | null>(null)
  const [form, setForm] = React.useState({ platform: 'wordpress', nickname: '' })
  const [credentials, setCredentials] = React.useState<Record<string, string>>({})
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<PublishAccount | null>(null)
  const [scanOpen, setScanOpen] = React.useState(false)
  const [scanDefaultPlatform, setScanDefaultPlatform] = React.useState<string | undefined>(
    undefined,
  )
  const [batchOpen, setBatchOpen] = React.useState(false)
  const [moreOpen, setMoreOpen] = React.useState(false)
  const [cardMenuOpen, setCardMenuOpen] = React.useState<number | undefined>(undefined)
  const [riskMap, setRiskMap] = React.useState<Record<number, RiskView>>({})

  React.useEffect(() => {
    if (!moreOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-more-menu]')) setMoreOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [moreOpen])

  React.useEffect(() => {
    if (cardMenuOpen === undefined) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-card-menu]')) setCardMenuOpen(undefined)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [cardMenuOpen])

  // 2026-08-17:风控评分并行拉取(失败静默,保持"未评估")
  React.useEffect(() => {
    if (accounts.length === 0) {
      setRiskMap({})
      return
    }
    let cancelled = false
    void Promise.all(
      accounts.map((a) =>
        fetchApi<RiskData>(`/api/publish/accounts/${a.id}/risk`)
          .then((r) => (r.success && r.data ? ([a.id, r.data] as const) : null))
          .catch(() => null),
      ),
    ).then((results) => {
      if (cancelled) return
      const next: Record<number, RiskView> = {}
      for (const item of results) {
        if (item) {
          next[item[0]] = {
            score: item[1].score,
            level: item[1].level,
            cooldownRemaining: item[1].cooldownRemaining,
          }
        }
      }
      setRiskMap(next)
    })
    return () => {
      cancelled = true
    }
  }, [accounts])

  function openAdd(platformId?: string) {
    setEditing(null)
    setForm({ platform: platformId ?? 'wordpress', nickname: '' })
    setCredentials({})
    setDialogOpen(true)
  }
  function openEdit(a: PublishAccount) {
    setEditing(a)
    setForm({ platform: a.platform, nickname: a.displayName })
    setCredentials(normalizeCredentials(a.credentials))
    setDialogOpen(true)
  }
  function openScanLogin(platform?: string) {
    setScanDefaultPlatform(platform)
    setScanOpen(true)
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const input = { platform: form.platform, displayName: form.nickname, credentials }
    const ok = editing ? await update(editing.id, input) : await create(input)
    if (ok) setDialogOpen(false)
  }
  async function confirmDelete() {
    if (!deleteTarget) return
    const ok = await remove(deleteTarget.id)
    if (ok) {
      setDeleteOpen(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-4">
      <BackButton />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">{t('accounts.title')}</h2>
          <p className="text-xs text-muted-foreground">{t('accounts.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button size="default" onClick={() => openScanLogin()}>
            <QrCode className="h-4 w-4" />
            {t('accounts.scanLogin')}
          </Button>
          <div className="relative" data-more-menu>
            <Button size="sm" variant="ghost" onClick={() => setMoreOpen((o) => !o)}>
              <MoreVertical className="h-4 w-4" />
            </Button>
            {moreOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-md border bg-background shadow-md">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent"
                  onClick={() => {
                    setMoreOpen(false)
                    openAdd()
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('accounts.advancedAdd')}
                </button>
                <div className="mx-2 my-1 h-px bg-border" />
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent"
                  onClick={() => {
                    setMoreOpen(false)
                    setBatchOpen(true)
                  }}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {t('accounts.batchImport')}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent"
                  onClick={() => {
                    setMoreOpen(false)
                    void batchVerify()
                  }}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {t('accounts.batchVerify')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('accounts.noAccounts')}</p>
          <Button size="default" onClick={() => openScanLogin()}>
            <QrCode className="h-4 w-4" />
            {t('accounts.scanLogin')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
          {accounts.map((a) => {
            const schema = getPlatformSchema(a.platform)
            const isVerifying = verifyingId === a.id
            const risk = riskMap[a.id]
            const acc: AccountWithRisk = {
              ...a,
              ...(risk
                ? {
                    riskScore: risk.score,
                    riskLevel: risk.level,
                    cooldownRemaining: risk.cooldownRemaining,
                  }
                : {}),
            }
            const inCooldown = (acc.cooldownRemaining ?? 0) > 0
            return (
              <Card key={a.id} className={cn(inCooldown && 'border-orange-500/40 opacity-60')}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary">
                        {(schema?.platformName ?? a.platform).charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{a.displayName}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {schema?.platformName ??
                            t(PLATFORM_KEY[a.platform] ?? 'platforms.unknown')}
                        </div>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-md px-2 py-0.5 text-xs font-medium',
                        STATUS_STYLE[a.status] ?? STATUS_STYLE.disabled,
                      )}
                    >
                      {t(ACCOUNTS_STATUS_KEY[a.status] ?? 'accounts.statusUnknown')}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {acc.riskLevel ? (
                      <RiskBadge
                        riskScore={acc.riskScore ?? 0}
                        riskLevel={acc.riskLevel}
                        cooldownRemaining={acc.cooldownRemaining}
                        size="sm"
                      />
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {t('riskNotEvaluated')}
                      </span>
                    )}
                    <CookieHealthIndicator
                      accountId={a.id}
                      compact={false}
                      onRefreshed={() => void reload()}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => verify(a.id)}
                      disabled={isVerifying}
                      className="h-7 text-xs"
                    >
                      {isVerifying ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      {t('accounts.verify')}
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openScanLogin(a.platform)}
                          className="h-7 text-xs"
                        >
                          <QrCode className="h-3 w-3" />
                          {t('accounts.scan')}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('accounts.scanLoginHint')}</TooltipContent>
                    </Tooltip>
                    <div className="relative" data-card-menu>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCardMenuOpen((o) => (o === a.id ? undefined : a.id))}
                        className="h-7 text-xs"
                      >
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                      {cardMenuOpen === a.id && (
                        <div className="absolute right-0 top-full z-10 mt-1 w-36 rounded-md border bg-background shadow-md">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent"
                            onClick={() => {
                              setCardMenuOpen(undefined)
                              openEdit(a)
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            {t('accounts.edit')}
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-destructive hover:text-destructive hover:bg-accent"
                            onClick={() => {
                              setCardMenuOpen(undefined)
                              setDeleteTarget(a)
                              setDeleteOpen(true)
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t('accounts.delete')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {!loading && accounts.length > 0 && <AccountGroupManager accounts={accounts} />}

      <Dialog open={dialogOpen} onOpenChange={(o) => !saving && setDialogOpen(o)}>
        <DialogContent className="min-[640px]:max-w-lg">
          <form onSubmit={submit} className="space-y-3">
            <DialogHeader>
              <DialogTitle>{editing ? t('accounts.edit') : t('accounts.add')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-1">
              <Label className="text-xs">{t('accounts.platform')}</Label>
              <Select
                value={form.platform}
                onValueChange={(v) => {
                  setForm({ ...form, platform: v })
                  setCredentials({})
                }}
                disabled={!!editing}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_SCHEMAS.map((s) => (
                    <SelectItem key={s.platformId} value={s.platformId}>
                      {s.platformName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('accounts.nickname')}</Label>
              <Input
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                required
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('accounts.credentials')}</Label>
              <Input
                type="password"
                value={credentials.password ?? ''}
                onChange={(e) =>
                  setCredentials((c) => ({ ...c, password: e.target.value }))
                }
                placeholder={t('accounts.passwordPlaceholder')}
                className="h-8 text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                {t('accounts.passwordHint')}
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? tc('save') : tc('create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('accounts.delete')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('accounts.deleteConfirm')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {tc('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScanLoginDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onSuccess={() => void reload()}
        defaultPlatform={scanDefaultPlatform}
      />

      <BatchImportDialog
        open={batchOpen}
        onOpenChange={setBatchOpen}
        onSuccess={() => void reload()}
      />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
