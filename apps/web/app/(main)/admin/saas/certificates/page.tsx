/**
 * P1-2.2c: 证书状态页 — 扫描 Traefik acme.json
 * 路径: /admin/saas/certificates
 *
 * 字段:
 *  - domain / sans / issuer / subject
 *  - notBefore / notAfter / daysUntilExpiry
 *  - status: healthy / warning / critical / expired
 *  - source: letsencrypt / self-signed / custom
 */
'use client'

import * as React from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Lock,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { CenteredText, Skeleton } from '@/components/common'

import { useCertificatesQuery } from '@/hooks/use-saas-tenants'
import type { CertStatus, TenantCertificate as Certificate } from '@ihui/api-client'

function StatusBadge({ status }: { status: CertStatus }) {
  const t = useTranslations('admin.saas.certificates')
  const map: Record<CertStatus, { variant: 'default' | 'destructive' | 'outline' | 'secondary'; label: string; className: string }> = {
    healthy: {
      variant: 'default',
      label: t('status.healthy'),
      className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    },
    warning: {
      variant: 'outline',
      label: t('status.warning'),
      className: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    },
    critical: {
      variant: 'outline',
      label: t('status.critical'),
      className: 'border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400',
    },
    expired: {
      variant: 'destructive',
      label: t('status.expired'),
      className: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400',
    },
  }
  const { variant, label, className } = map[status]
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  )
}

function SourceBadge({ source }: { source: Certificate['source'] }) {
  const t = useTranslations('admin.saas.certificates.source')
  const labels: Record<Certificate['source'], string> = {
    letsencrypt: t('letsencrypt'),
    'self-signed': t('selfSigned'),
    custom: t('custom'),
  }
  return (
    <Badge variant="outline" className="font-mono text-[10px]">
      {labels[source]}
    </Badge>
  )
}

export default function CertificatesPage() {
  const t = useTranslations('admin.saas.certificates')
  const locale = useLocale()

  const { data, isLoading, error, refetch, isRefetching } = useCertificatesQuery({
    refetchInterval: 60_000,
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

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
        <Skeleton variant="card" count={2} />
      </div>
    )
  }

  const { certificates, total, healthy, warning, critical, expired, acmePath, acmeExists, generatedAt } = data

  return (
    <div className="space-y-6">
      <BackBar />

      {/* 标题 + 刷新 */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Lock className="h-6 w-6 text-primary" />
            <CenteredText>{t('title')}</CenteredText>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <CenteredText>{t('subtitle')}</CenteredText>
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={isRefetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          <CenteredText>{t('refresh')}</CenteredText>
        </Button>
      </header>

      {/* 概览统计 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label={t('stats.total')}
          value={total}
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <StatCard
          label={t('stats.healthy')}
          value={healthy}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          tone="healthy"
        />
        <StatCard
          label={t('stats.warning')}
          value={warning}
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
          tone="warning"
        />
        <StatCard
          label={t('stats.critical')}
          value={critical}
          icon={<AlertCircle className="h-4 w-4 text-orange-500" />}
          tone="critical"
        />
        <StatCard
          label={t('stats.expired')}
          value={expired}
          icon={<XCircle className="h-4 w-4 text-rose-500" />}
          tone="expired"
        />
      </div>

      {/* acme 状态提示 */}
      {!acmeExists ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <CenteredText>{t('acmeMissing', { path: acmePath })}</CenteredText>
        </div>
      ) : null}

      {/* 证书列表 */}
      {certificates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <CenteredText>{t('empty')}</CenteredText>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {certificates.map((cert) => (
            <CertCard key={cert.domain} cert={cert} dateFmt={dateFmt} />
          ))}
        </div>
      )}

      {/* 底部扫描元信息 */}
      <p className="text-xs text-muted-foreground">
        <Clock className="mr-1 inline h-3 w-3" />
        {t('generatedAt', { time: dateFmt.format(new Date(generatedAt)) })}
      </p>
    </div>
  )
}

function CertCard({
  cert,
  dateFmt,
}: {
  cert: Certificate
  dateFmt: Intl.DateTimeFormat
}) {
  const t = useTranslations('admin.saas.certificates')
  const tDays = useTranslations('admin.saas.certificates.days')

  const daysLabel =
    cert.daysUntilExpiry < 0
      ? tDays('expired', { days: Math.abs(cert.daysUntilExpiry) })
      : cert.daysUntilExpiry === 0
        ? tDays('today')
        : tDays('remaining', { days: cert.daysUntilExpiry })

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="break-all font-mono text-base">{cert.domain}</CardTitle>
            {cert.sans.length > 0 ? (
              <p className="mt-1 break-all text-xs text-muted-foreground">
                {t('sans', { sans: cert.sans.join(', ') })}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={cert.status} />
            <SourceBadge source={cert.source} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 md:grid-cols-3">
          <Item label={t('issuer')} value={cert.issuer} mono />
          <Item label={t('subject')} value={cert.subject} mono />
          <Item
            label={t('notBefore')}
            value={dateFmt.format(new Date(cert.notBefore))}
            mono
          />
          <Item
            label={t('notAfter')}
            value={dateFmt.format(new Date(cert.notAfter))}
            mono
          />
          <Item label={t('daysUntilExpiry')} value={daysLabel} mono />
          {cert.fingerprint ? (
            <Item
              label={t('fingerprint')}
              value={`${cert.fingerprint.slice(0, 16)}…`}
              mono
            />
          ) : null}
        </dl>
      </CardContent>
    </Card>
  )
}

function Item({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono break-all' : 'break-all'}>{value}</dd>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: number
  icon: React.ReactNode
  tone?: 'healthy' | 'warning' | 'critical' | 'expired'
}) {
  const toneClass: Record<string, string> = {
    healthy: 'border-emerald-500/30',
    warning: 'border-amber-500/30',
    critical: 'border-orange-500/30',
    expired: 'border-rose-500/30',
  }
  return (
    <Card className={tone ? toneClass[tone] : ''}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>{label}</span>
          {icon}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  )
}

function BackBar() {
  const t = useTranslations('admin.saas.certificates')
  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/admin/saas">
          <ArrowLeft className="h-4 w-4" />
          <CenteredText>{t('back')}</CenteredText>
        </Link>
      </Button>
    </div>
  )
}
