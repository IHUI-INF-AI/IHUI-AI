/**
 * P1-2.2b: 租户详情页 - 基本信息 + 容器状态 + 资源限制
 * P1-2.3:  新增 Grafana 实时图表 + Prometheus 指标卡片
 * 路径: /admin/saas/[slug]
 */
'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  Activity,
  ArrowLeft,
  Database,
  ExternalLink,
  Pause,
  Play,
  Server,
  Trash2,
} from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { CenteredText, Skeleton } from '@/components/common'

import { StateBadge } from '../_components/StateBadge'
import { ContainerStatusCell } from '../_components/ContainerStatusCell'
import { ConfirmActionDialog } from '../_components/ConfirmActionDialog'
import { QuotaCard } from '../_components/QuotaCard'
import { MetricsCard } from '../_components/MetricsCard'
import { GrafanaFrame } from '../_components/GrafanaFrame'
import { useTenantDetail } from '@/hooks/use-saas-tenants'
import {
  useBackupTenant,
  useDeleteTenant,
  usePauseTenant,
  useResumeTenant,
} from '@/hooks/use-saas-tenant-mutations'
import type { Tenant } from '../types'

type ConfirmAction =
  | { type: 'pause' | 'resume' | 'backup' | 'delete'; tenant: Tenant }
  | null

export default function TenantDetailPage() {
  const t = useTranslations('admin.saas')
  const locale = useLocale()
  const params = useParams<{ slug: string }>()
  const slug = params?.slug ?? ''

  const { data, isLoading, error } = useTenantDetail(slug)

  const pauseMut = usePauseTenant()
  const resumeMut = useResumeTenant()
  const backupMut = useBackupTenant()
  const deleteMut = useDeleteTenant()

  const [pending, setPending] = React.useState<'pause' | 'resume' | 'backup' | 'delete' | null>(
    null,
  )
  const [confirmAction, setConfirmAction] = React.useState<ConfirmAction>(null)

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const handleConfirm = () => {
    if (!confirmAction) return
    const { type, tenant } = confirmAction
    setPending(type)
    if (type === 'pause') {
      pauseMut.mutate(tenant.slug, { onSettled: () => setPending(null) })
    } else if (type === 'resume') {
      resumeMut.mutate(tenant.slug, { onSettled: () => setPending(null) })
    } else if (type === 'backup') {
      backupMut.mutate(tenant.slug, { onSettled: () => setPending(null) })
    } else {
      deleteMut.mutate(tenant.slug, { onSettled: () => setPending(null) })
    }
    setConfirmAction(null)
  }

  const dialogProps = React.useMemo(() => {
    if (!confirmAction) return null
    const { type, tenant } = confirmAction
    if (type === 'pause') {
      return {
        title: t('confirm.pauseTitle', { slug: tenant.slug }),
        description: t('confirm.pauseHint', { slug: tenant.slug }),
        variant: 'default' as const,
      }
    }
    if (type === 'resume') {
      return {
        title: t('confirm.resumeTitle', { slug: tenant.slug }),
        description: t('confirm.resumeHint', { slug: tenant.slug }),
        variant: 'default' as const,
      }
    }
    if (type === 'backup') {
      return {
        title: t('confirm.backupTitle', { slug: tenant.slug }),
        description: t('confirm.backupHint', { slug: tenant.slug }),
        variant: 'default' as const,
      }
    }
    return {
      title: t('confirm.destroyTitle', { slug: tenant.slug }),
      description: t('confirm.destroyHint', { slug: tenant.slug }),
      variant: 'destructive' as const,
      requireInput: tenant.slug,
    }
  }, [confirmAction, t])

  if (error) {
    return (
      <div className="space-y-4">
        <BackBar />
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-500">
          {error.message}
        </div>
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <BackBar />
        <Skeleton variant="card" count={3} />
      </div>
    )
  }

  const tenant = data
  const isPaused = tenant.state === 'paused'
  const isNotFound = !tenant.exists

  return (
    <>
      <div className="space-y-6">
        <BackBar />

        {/* 顶部标题区 */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                <Server className="h-6 w-6 text-primary" />
                <CenteredText>{tenant.slug}</CenteredText>
              </h1>
              <StateBadge state={tenant.state} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {tenant.domain !== '-' ? (
                <a
                  href={`https://${tenant.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-primary"
                >
                  {tenant.domain}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                '—'
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isPaused ? (
              <Button
                size="sm"
                variant="default"
                onClick={() => setConfirmAction({ type: 'resume', tenant })}
                disabled={!!pending || isNotFound}
              >
                <Play className="h-4 w-4" />
                <CenteredText>{t('action.resume')}</CenteredText>
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmAction({ type: 'pause', tenant })}
                disabled={!!pending || isNotFound}
              >
                <Pause className="h-4 w-4" />
                <CenteredText>{t('action.pause')}</CenteredText>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmAction({ type: 'backup', tenant })}
              disabled={!!pending || isNotFound}
            >
              <Database className="h-4 w-4" />
              <CenteredText>{t('action.backup')}</CenteredText>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
              onClick={() => setConfirmAction({ type: 'delete', tenant })}
              disabled={!!pending}
            >
              <Trash2 className="h-4 w-4" />
              <CenteredText>{t('action.destroy')}</CenteredText>
            </Button>
          </div>
        </header>

        {/* 概览卡片组 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard
            label={t('detail.status')}
            value={
              <StateBadge state={tenant.state} />
            }
            hint={t('detail.statusHint', {
              time: tenant.stateChangedAt
                ? dateFmt.format(new Date(tenant.stateChangedAt))
                : '—',
            })}
          />
          <InfoCard
            label={t('detail.containers')}
            value={
              <ContainerStatusCell
                running={tenant.containersRunning}
                total={tenant.containersTotal}
              />
            }
            hint={t('detail.containersHint')}
          />
          <InfoCard
            label={t('detail.resources')}
            value={
              <div className="text-sm">
                <div>
                  {t('detail.memory')}: <span className="font-mono">{tenant.memory}</span>
                </div>
                <div>
                  {t('detail.cpu')}: <span className="font-mono">{tenant.cpu}</span>
                </div>
              </div>
            }
            hint={t('detail.resourcesHint')}
          />
          <InfoCard
            label={t('detail.domain')}
            value={
              <span className="break-all font-mono text-sm">
                {tenant.domain !== '-' ? tenant.domain : '—'}
              </span>
            }
            hint={t('detail.domainHint')}
          />
        </div>

        {/* P1-2.2c: 配额占位卡片 + P1-2.3: 实时 Prometheus 指标 */}
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <QuotaCard slug={tenant.slug} />
          </div>
          <div className="lg:col-span-1">
            <MetricsCard slug={tenant.slug} />
          </div>
        </div>

        {/* P1-2.3: Grafana 实时图表 iframe(近 1h CPU/内存/磁盘/网络) */}
        <GrafanaFrame tenant={tenant.slug} timeRange="now-1h" refresh="15s" />

        {/* 快捷导航 */}
        <Card>
          <CardHeader>
            <CardTitle>{t('detail.shortcuts')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              <Button variant="outline" asChild>
                <Link href={`/admin/saas/${encodeURIComponent(tenant.slug)}/backups`}>
                  <Database className="h-4 w-4" />
                  <CenteredText>{t('detail.manageBackups')}</CenteredText>
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin/saas/metrics">
                  <Activity className="h-4 w-4" />
                  <CenteredText>{t('detail.compareTenants')}</CenteredText>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {dialogProps ? (
        <ConfirmActionDialog
          open={!!confirmAction}
          onOpenChange={(v: boolean) => !v && setConfirmAction(null)}
          title={dialogProps.title}
          description={dialogProps.description}
          variant={dialogProps.variant}
          requireInput={dialogProps.requireInput}
          confirmText={
            confirmAction?.type === 'delete'
              ? t('action.destroy')
              : confirmAction?.type === 'backup'
                ? t('action.backup')
                : confirmAction?.type === 'pause'
                  ? t('action.pause')
                  : t('action.resume')
          }
          onConfirm={handleConfirm}
          pending={pending !== null}
        />
      ) : null}
    </>
  )
}

function BackBar() {
  const t = useTranslations('admin.saas')
  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/admin/saas">
          <ArrowLeft className="h-4 w-4" />
          <CenteredText>{t('detail.back')}</CenteredText>
        </Link>
      </Button>
    </div>
  )
}

interface InfoCardProps {
  label: string
  value: React.ReactNode
  hint?: string
}

function InfoCard({ label, value, hint }: InfoCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="min-h-[2.5rem]">{value}</div>
        {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}
