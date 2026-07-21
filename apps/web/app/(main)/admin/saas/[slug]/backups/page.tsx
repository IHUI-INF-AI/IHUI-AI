/**
 * P1-2.2b: 备份管理页 - 列表 + 恢复 + 删除
 * 路径: /admin/saas/[slug]/backups
 */
'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  ArrowLeft,
  Database,
  Download,
  History,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@ihui/ui'
import { CenteredText, Skeleton } from '@/components/common'
import { Tooltip } from '@/components/feedback'

import { ConfirmActionDialog } from '../../_components/ConfirmActionDialog'
import { useBackupsQuery } from '@/hooks/use-saas-tenants'
import {
  useBackupTenant,
  useDeleteBackup,
  useRestoreTenant,
} from '@/hooks/use-saas-tenant-mutations'
import type { Backup } from '../../types'

type ConfirmAction =
  | { type: 'create' | 'restore' | 'delete'; backup?: Backup }
  | null

export default function TenantBackupsPage() {
  const t = useTranslations('admin.saas.backups')
  const locale = useLocale()
  const params = useParams<{ slug: string }>()
  const slug = params?.slug ?? ''

  const { data, isLoading, error } = useBackupsQuery(slug)
  const createMut = useBackupTenant()
  const restoreMut = useRestoreTenant()
  const deleteMut = useDeleteBackup()

  const [pending, setPending] = React.useState<'create' | 'restore' | 'delete' | null>(null)
  const [confirmAction, setConfirmAction] = React.useState<ConfirmAction>(null)

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const backups = data ?? []
  const totalSizeKb = backups.reduce((sum, b) => sum + b.sizeKb, 0)
  const totalSizeLabel = formatSize(totalSizeKb)
  const latest = backups[0] // 已按时间倒序

  const handleConfirm = () => {
    if (!confirmAction) return
    const { type, backup } = confirmAction
    setPending(type)
    if (type === 'create') {
      createMut.mutate(slug, { onSettled: () => setPending(null) })
    } else if (type === 'restore' && backup) {
      restoreMut.mutate(
        { slug, body: { timestamp: backup.timestamp } },
        { onSettled: () => setPending(null) },
      )
    } else if (type === 'delete' && backup) {
      deleteMut.mutate(
        { slug, timestamp: backup.timestamp },
        { onSettled: () => setPending(null) },
      )
    }
    setConfirmAction(null)
  }

  const dialogProps = React.useMemo(() => {
    if (!confirmAction) return null
    if (confirmAction.type === 'create') {
      return {
        title: t('createTitle', { slug }),
        description: t('createHint', { slug }),
        variant: 'default' as const,
      }
    }
    if (confirmAction.type === 'restore' && confirmAction.backup) {
      return {
        title: t('restoreTitle', { timestamp: confirmAction.backup.timestamp }),
        description: t('restoreHint', { timestamp: confirmAction.backup.timestamp }),
        variant: 'default' as const,
        requireInput: confirmAction.backup.timestamp,
        requireInputHint: t('restoreInputHint', { timestamp: confirmAction.backup.timestamp }),
      }
    }
    if (confirmAction.type === 'delete' && confirmAction.backup) {
      return {
        title: t('deleteTitle', { timestamp: confirmAction.backup.timestamp }),
        description: t('deleteHint', { timestamp: confirmAction.backup.timestamp }),
        variant: 'destructive' as const,
        requireInput: confirmAction.backup.timestamp,
        requireInputHint: t('deleteInputHint', { timestamp: confirmAction.backup.timestamp }),
      }
    }
    return null
  }, [confirmAction, t, slug])

  return (
    <>
      <div className="space-y-6">
        <BackBar />

        {/* 顶部标题 + 创建按钮 */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Database className="h-6 w-6 text-primary" />
              <CenteredText>{t('title', { slug })}</CenteredText>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
          <Button
            size="sm"
            onClick={() => setConfirmAction({ type: 'create' })}
            disabled={pending !== null}
          >
            <Database className="h-4 w-4" />
            <CenteredText>{t('createNow')}</CenteredText>
          </Button>
        </header>

        {/* 统计卡片 */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label={t('stats.total')} value={String(backups.length)} />
          <StatCard
            label={t('stats.totalSize')}
            value={totalSizeLabel}
            hint={
              backups.length > 0
                ? t('stats.avg', { size: formatSize(Math.round(totalSizeKb / backups.length)) })
                : undefined
            }
          />
          <StatCard
            label={t('stats.latest')}
            value={latest ? dateFmt.format(new Date(latest.mtime)) : '—'}
            hint={latest ? latest.age : t('stats.empty')}
          />
        </div>

        {/* 备份列表 */}
        <Card>
          <CardHeader>
            <CardTitle>{t('listTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-500">
                {error.message}
              </div>
            ) : isLoading ? (
              <Skeleton variant="list" count={4} />
            ) : backups.length === 0 ? (
              <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
                {t('empty')}
              </div>
            ) : (
              <BackupsTable
                backups={backups}
                dateFmt={dateFmt}
                pending={pending}
                onRestore={(b) => setConfirmAction({ type: 'restore', backup: b })}
                onDelete={(b) => setConfirmAction({ type: 'delete', backup: b })}
              />
            )}
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
          requireInputHint={dialogProps.requireInputHint}
          confirmText={
            confirmAction?.type === 'create'
              ? t('createNow')
              : confirmAction?.type === 'restore'
                ? t('restore')
                : t('delete')
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
  const params = useParams<{ slug: string }>()
  const slug = params?.slug ?? ''
  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={`/admin/saas/${encodeURIComponent(slug)}`}>
          <ArrowLeft className="h-4 w-4" />
          <CenteredText>{t('detail.back')}</CenteredText>
        </Link>
      </Button>
    </div>
  )
}

interface BackupsTableProps {
  backups: Backup[]
  dateFmt: Intl.DateTimeFormat
  pending: 'create' | 'restore' | 'delete' | null
  onRestore: (b: Backup) => void
  onDelete: (b: Backup) => void
}

function BackupsTable({ backups, dateFmt, pending, onRestore, onDelete }: BackupsTableProps) {
  const t = useTranslations('admin.saas.backups')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium">{t('table.timestamp')}</th>
            <th className="px-4 py-2.5 text-left font-medium">{t('table.size')}</th>
            <th className="px-4 py-2.5 text-left font-medium">{t('table.files')}</th>
            <th className="px-4 py-2.5 text-left font-medium">{t('table.createdAt')}</th>
            <th className="px-4 py-2.5 text-left font-medium">{t('table.age')}</th>
            <th className="px-4 py-2.5 text-right font-medium">{t('table.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {backups.map((b) => (
            <tr key={b.timestamp} className="border-b last:border-0 hover:bg-muted/20">
              <td className="px-4 py-2.5 font-mono">{b.timestamp}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{b.size}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{b.fileCount}</td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {dateFmt.format(new Date(b.mtime))}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <History className="h-3 w-3" />
                  {b.age}
                </span>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center justify-end gap-1">
                  <Tooltip content={t('restore')}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onRestore(b)}
                      disabled={pending !== null}
                      aria-label={t('restore')}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                  <Tooltip content={t('delete')}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-500 hover:text-rose-600"
                      onClick={() => onDelete(b)}
                      disabled={pending !== null}
                      aria-label={t('delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                  <Tooltip content={t('download')}>
                    <Button
                      size="sm"
                      variant="ghost"
                      asChild
                      aria-label={t('download')}
                    >
                      <a
                        href={`/api/admin-saas/customers/${encodeURIComponent(
                          b.timestamp,
                        )}/backups/${encodeURIComponent(b.timestamp)}/download`}
                        onClick={(e) => e.preventDefault()}
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  </Tooltip>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xl font-semibold">{value}</div>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}

function formatSize(kb: number): string {
  if (kb === 0) return '0 KB'
  if (kb < 1024) return `${kb} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(2)} GB`
}
