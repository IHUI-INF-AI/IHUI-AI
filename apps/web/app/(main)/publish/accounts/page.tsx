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
  Wrench,
  ChevronDown,
  FolderKanban,
  KeyRound,
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
import { fetchApi, isAbortError } from '@/lib/api'
import { PLATFORM_KEY } from '../helpers'
import { usePublishAccounts, type PublishAccount } from '@/hooks/use-publish-accounts'
import { CredentialGuide } from '@/components/publish/CredentialGuide'
import {
  PLATFORM_SCHEMAS,
  getPlatformSchema,
  normalizeCredentials,
} from '@/lib/publish/platform-schemas'
import { ScanLoginDialog } from './ScanLoginDialog'
import { Dropdown, type DropdownItem } from '@/components/feedback'
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
  const [riskMap, setRiskMap] = React.useState<Record<number, RiskView>>({})

  const pendingPlatforms = React.useMemo(() => {
    const configured = new Set(accounts.map((a) => a.platform))
    return PLATFORM_SCHEMAS.filter((s) => !configured.has(s.platformId))
  }, [accounts])

  // 2026-08-17:风控评分并行拉取(失败静默,保持"未评估")
  React.useEffect(() => {
    if (accounts.length === 0) {
      setRiskMap({})
      return
    }
    const controller = new AbortController()
    let cancelled = false
    void Promise.all(
      accounts.map((a) =>
        fetchApi<RiskData>(`/api/publish/accounts/${a.id}/risk`, { signal: controller.signal })
          .then((r) => (r.success && r.data ? ([a.id, r.data] as const) : null))
          .catch((e) => {
            if (!isAbortError(e)) {
              return null
            }
            throw e
          }),
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
      controller.abort()
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
    <div className="px-4 space-y-4">
      <BackButton />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{t('accounts.title')}</h2>
          <p className="text-xs text-muted-foreground">{t('accounts.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {/* 2026-09-07:次要功能收纳进"开发者"下拉,头部只保留高频操作 */}
          <Dropdown
            trigger={
              <Button size="sm" variant="outline">
                <Wrench className="h-4 w-4" />
                {t('accounts.developer')}
                <ChevronDown className="h-4 w-4" />
              </Button>
            }
            items={
              [
                {
                  key: 'scanLogin',
                  label: t('accounts.scanLogin'),
                  icon: QrCode,
                  onSelect: () => openScanLogin(),
                },
                {
                  // 2026-09-07:扫码登录为主要添加方式,"添加账号"按钮直达扫码,
                  // 专业凭证配置作为高级入口收纳在此
                  key: 'manualAdd',
                  label: t('accounts.manualAdd'),
                  icon: KeyRound,
                  onSelect: () => openAdd(),
                },
                {
                  key: 'batchImport',
                  label: t('accounts.batchImport'),
                  icon: Upload,
                  onSelect: () => setBatchOpen(true),
                },
                {
                  key: 'batchVerify',
                  label: t('accounts.batchVerify'),
                  icon: ShieldCheck,
                  disabled: batchVerifying || accounts.length === 0,
                  onSelect: () => void batchVerify(),
                },
                { key: 'groups-divider', divider: true },
                {
                  key: 'manageGroups',
                  label: t('accounts.manageGroups'),
                  icon: FolderKanban,
                  disabled: loading || accounts.length === 0,
                  onSelect: () =>
                    document.getElementById('account-groups')?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    }),
                },
              ] satisfies DropdownItem[]
            }
          />
          {/* 2026-09-07:添加账号以扫码登录为主,避免普通用户面对专业凭证配置 */}
          <Button size="sm" onClick={() => openScanLogin()}>
            <Plus className="h-4 w-4" />
            {t('accounts.add')}
          </Button>
        </div>
      </div>

      {!loading && pendingPlatforms.length > 0 && (
        <div className="rounded-md border border-dashed border-orange-500/30 bg-orange-500/5 p-3">
          <div className="mb-1.5 text-xs font-medium text-orange-600 dark:text-orange-400">
            待配置平台({pendingPlatforms.length} 个)— 点击直接配置
          </div>
          <div className="flex flex-wrap gap-1.5">
            {pendingPlatforms.map((s) => (
              <button
                key={s.platformId}
                type="button"
                onClick={() => openScanLogin(s.platformId)}
                className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
              >
                <span className="font-medium">{s.platformName}</span>
                <span className="text-muted-foreground">+ 配置</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('accounts.noAccounts')}</p>
          <Button size="sm" variant="outline" onClick={() => openScanLogin()}>
            <Plus className="h-4 w-4" />
            {t('accounts.add')}
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
                      size="xs"
                      variant="outline"
                      onClick={() => verify(a.id)}
                      disabled={isVerifying}
                      className="text-xs"
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
                          size="xs"
                          variant="ghost"
                          onClick={() => openScanLogin(a.platform)}
                          className="text-xs"
                        >
                          <QrCode className="h-3 w-3" />
                          {t('accounts.scan')}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('accounts.scanLoginHint')}</TooltipContent>
                    </Tooltip>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => openEdit(a)}
                      className="text-xs"
                    >
                      <Pencil className="h-3 w-3" />
                      {t('accounts.edit')}
                    </Button>
                    <Button
                      size="default"
                      variant="ghost"
                      className="text-xs text-destructive hover:text-destructive px-3"
                      onClick={() => {
                        setDeleteTarget(a)
                        setDeleteOpen(true)
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                      {t('accounts.delete')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {!loading && accounts.length > 0 && (
        <div id="account-groups">
          <AccountGroupManager accounts={accounts} />
        </div>
      )}

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
              <CredentialGuide
                platformId={form.platform}
                value={credentials}
                onChange={setCredentials}
                disabled={saving}
              />
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
