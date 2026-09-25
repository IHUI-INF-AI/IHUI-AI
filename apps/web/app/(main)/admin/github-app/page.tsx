// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​​‌‌‌‍‍​‌‌‌‌​‌‌‌​‍‍‌‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍‌‌‌‌​​​​‍‍‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​​‌‌‌‌​‍‍​‌​​​‌‌‌‌‌‍‍​‌‌‌​‌‌‌​‍‍​‌‌‌‌‌‌‍‍​​‌‌‌‌​‌‍‍​​‌‌‌‌‌‍‍‌‌‌‌‍‍​​‌‌‌‌‌‌‍‍​​‌‌‌‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  CheckCircle2,
  GitBranch,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react'

import { listAdminGithubAppInstallations, type GithubAppInstallation } from '@ihui/api-client'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { BackButton } from '@/components/common'

/** 安装状态 → 展示样式(active/removed 之外的状态按原样展示,兜底灰) */
function statusTone(status: string): string {
  if (status === 'active') return 'text-emerald-600'
  if (status === 'removed') return 'text-red-600'
  return 'text-muted-foreground'
}

/** next-intl 的翻译函数类型(本页命名空间由调用点约束,行组件共用同一形状) */
type PageT = ReturnType<typeof useTranslations>

function formatTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function GithubAppAdminPage() {
  const t = useTranslations('admin.githubApp')

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'github-app-installations'],
    queryFn: () => listAdminGithubAppInstallations(),
    refetchInterval: 60_000, // 60s 自动刷新:安装事件是 webhook 驱动,低频变化
  })

  const payload = data?.success === true ? data.data : undefined
  const installations = payload?.installations ?? []
  const config = payload?.config
  const errorMessage =
    error instanceof Error ? `${t('loadFailed')}:${error.message}` : t('loadFailed')

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <GitBranch className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          {t('refresh')}
        </Button>
      </div>

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      {/* 配置状态卡片:只展示「已配置 / 未配置」布尔,后端契约保证绝不回任何 secret 值 */}
      {config && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t('configSection')}</h2>
          <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2">
            <ConfigCard
              icon={<ShieldCheck className="h-5 w-5" />}
              title={t('webhookSecret')}
              hint={t('secretHint')}
              configured={config.webhookSecretConfigured}
              configuredLabel={t('configured')}
              notConfiguredLabel={t('notConfigured')}
            />
            <ConfigCard
              icon={<KeyRound className="h-5 w-5" />}
              title={t('appCredentials')}
              hint={t('credsHint')}
              configured={config.appCredentialsConfigured}
              configuredLabel={t('configured')}
              notConfiguredLabel={t('notConfigured')}
            />
          </div>
        </section>
      )}

      {/* 安装台账 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('installationsTitle')}</h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('refresh')}...
          </div>
        ) : installations.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-muted-foreground">
            {t('empty')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground [&>tr>th]:whitespace-nowrap">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t('colInstallation')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('colAccount')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('colType')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('colStatus')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('colInstaller')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('colCreatedAt')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('colUpdatedAt')}</th>
                </tr>
              </thead>
              <tbody>
                {installations.map((row) => (
                  <InstallationRow key={row.installationId} row={row} t={t} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

/** 单行安装记录(拆出来让 key 语义清晰,也让主组件保持窄) */
function InstallationRow({ row, t }: { row: GithubAppInstallation; t: PageT }) {
  const statusLabel =
    row.status === 'active'
      ? t('statusActive')
      : row.status === 'removed'
        ? t('statusRemoved')
        : row.status
  return (
    <tr className="transition-colors hover:bg-muted/30">
      <td className="px-4 py-2.5 font-mono font-medium">{row.installationId}</td>
      <td className="px-4 py-2.5">{row.accountLogin || '—'}</td>
      <td className="px-4 py-2.5 text-muted-foreground">{row.targetType || '—'}</td>
      <td className={cn('px-4 py-2.5 font-medium', statusTone(row.status))}>{statusLabel}</td>
      <td className="px-4 py-2.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-default text-muted-foreground underline decoration-dotted underline-offset-4">
              {row.installedByUserId ?? '—'}
            </span>
          </TooltipTrigger>
          <TooltipContent>{t('installerHint')}</TooltipContent>
        </Tooltip>
      </td>
      <td className="px-4 py-2.5 text-muted-foreground">{formatTime(row.createdAt)}</td>
      <td className="px-4 py-2.5 text-muted-foreground">{formatTime(row.updatedAt)}</td>
    </tr>
  )
}

/** 配置状态小卡片:徽标悬停出现 Radix Tooltip 解释该项的用途(禁用原生 title) */
function ConfigCard({
  icon,
  title,
  hint,
  configured,
  configuredLabel,
  notConfiguredLabel,
}: {
  icon: React.ReactNode
  title: string
  hint: string
  configured: boolean
  configuredLabel: string
  notConfiguredLabel: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </CardTitle>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'inline-flex cursor-default items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                configured ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600',
              )}
            >
              {configured ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              {configured ? configuredLabel : notConfiguredLabel}
            </span>
          </TooltipTrigger>
          <TooltipContent>{hint}</TooltipContent>
        </Tooltip>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​​‌‌‌‍‍​‌‌‌‌​‌‌‌​‍‍‌‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍‌‌‌‌​​​​‍‍‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​​‌‌‌‌​‍‍​‌​​​‌‌‌‌‌‍‍​‌‌‌​‌‌‌​‍‍​‌‌‌‌‌‌‍‍​​‌‌‌‌​‌‍‍​​‌‌‌‌‌‍‍‌‌‌‌‍‍​​‌‌‌‌‌‌‍‍​​‌‌‌‌​‍‍​​‌‌​‌‌​⁠
