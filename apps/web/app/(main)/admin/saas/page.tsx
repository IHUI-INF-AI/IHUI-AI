'use client'

/**
 * P1-2.2: SaaS 租户管理 — 主列表页
 */
import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Plus, Server } from 'lucide-react'
import { Button } from '@ihui/ui'
import { Skeleton, CenteredText } from '@/components/common'

import { TenantFilter } from './_components/TenantFilter'
import { TenantTable } from './_components/TenantTable'
import { CreateTenantDialog, EMPTY_TENANT_FORM } from './_components/CreateTenantDialog'
import { ConfirmActionDialog } from './_components/ConfirmActionDialog'
import { useTenantsQuery } from '@/hooks/use-saas-tenants'
import {
  useBackupTenant,
  useCreateTenant,
  useDeleteTenant,
  usePauseTenant,
  useResumeTenant,
} from '@/hooks/use-saas-tenant-mutations'
import type { Tenant, TenantForm } from './types'

type PendingMap = { [slug: string]: 'pause' | 'resume' | 'backup' | 'delete' | null }

type ConfirmAction =
  | { type: 'pause' | 'resume' | 'backup' | 'delete'; tenant: Tenant }
  | null

export default function AdminSaasPage() {
  const t = useTranslations('admin.saas')
  const locale = useLocale()

  const { data, isLoading, error } = useTenantsQuery({ refetchInterval: 30_000 })

  const createMut = useCreateTenant()
  const pauseMut = usePauseTenant()
  const resumeMut = useResumeTenant()
  const backupMut = useBackupTenant()
  const deleteMut = useDeleteTenant()

  const [search, setSearch] = React.useState('')
  const [stateFilter, setStateFilter] = React.useState('all')
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createForm, setCreateForm] = React.useState<TenantForm>(EMPTY_TENANT_FORM)
  const [confirmAction, setConfirmAction] = React.useState<ConfirmAction>(null)
  const [pending, setPending] = React.useState<PendingMap>({})

  const allTenants = data ?? []
  const filteredTenants = React.useMemo(() => {
    return allTenants.filter((tn) => {
      if (search && !tn.slug.toLowerCase().includes(search.toLowerCase())) {
        return false
      }
      if (stateFilter !== 'all' && tn.state !== stateFilter) {
        return false
      }
      return true
    })
  }, [allTenants, search, stateFilter])

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    createMut.mutate(createForm, {
      onSuccess: () => {
        setCreateOpen(false)
        setCreateForm(EMPTY_TENANT_FORM)
      },
    })
  }

  const setPendingFor = (slug: string, value: PendingMap[string]) => {
    setPending((prev) => ({ ...prev, [slug]: value }))
  }

  const handlePause = () => {
    if (!confirmAction) return
    const slug = confirmAction.tenant.slug
    setPendingFor(slug, 'pause')
    pauseMut.mutate(slug, { onSettled: () => setPendingFor(slug, null) })
    setConfirmAction(null)
  }
  const handleResume = () => {
    if (!confirmAction) return
    const slug = confirmAction.tenant.slug
    setPendingFor(slug, 'resume')
    resumeMut.mutate(slug, { onSettled: () => setPendingFor(slug, null) })
    setConfirmAction(null)
  }
  const handleBackup = () => {
    if (!confirmAction) return
    const slug = confirmAction.tenant.slug
    setPendingFor(slug, 'backup')
    backupMut.mutate(slug, { onSettled: () => setPendingFor(slug, null) })
    setConfirmAction(null)
  }
  const handleDelete = () => {
    if (!confirmAction) return
    const slug = confirmAction.tenant.slug
    setPendingFor(slug, 'delete')
    deleteMut.mutate(slug, { onSettled: () => setPendingFor(slug, null) })
    setConfirmAction(null)
  }

  const dialogProps = React.useMemo(() => {
    if (!confirmAction) return null
    const { type, tenant } = confirmAction
    const slug = tenant.slug
    if (type === 'pause') {
      return {
        title: t('confirm.pauseTitle', { slug }),
        description: t('confirm.pauseHint', { slug }),
        variant: 'default' as const,
        onConfirm: handlePause,
        pending: pending[slug] === 'pause',
      }
    }
    if (type === 'resume') {
      return {
        title: t('confirm.resumeTitle', { slug }),
        description: t('confirm.resumeHint', { slug }),
        variant: 'default' as const,
        onConfirm: handleResume,
        pending: pending[slug] === 'resume',
      }
    }
    if (type === 'backup') {
      return {
        title: t('confirm.backupTitle', { slug }),
        description: t('confirm.backupHint', { slug }),
        variant: 'default' as const,
        onConfirm: handleBackup,
        pending: pending[slug] === 'backup',
      }
    }
    return {
      title: t('confirm.destroyTitle', { slug }),
      description: t('confirm.destroyHint', { slug }),
      variant: 'destructive' as const,
      requireInput: slug,
      onConfirm: handleDelete,
      pending: pending[slug] === 'delete',
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmAction, pending, t])

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Server className="h-6 w-6 text-primary" />
              <CenteredText>{t('title')}</CenteredText>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            <CenteredText>{t('createTenant')}</CenteredText>
          </Button>
        </div>

        <TenantFilter
          search={search}
          onSearchChange={setSearch}
          state={stateFilter}
          onStateChange={setStateFilter}
        />

        {isLoading ? (
          <Skeleton variant="list" count={5} />
        ) : error ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-500">
            {error.message}
          </div>
        ) : (
          <TenantTable
            tenants={filteredTenants}
            dateFmt={dateFmt}
            pending={pending}
            onPause={(tn) => setConfirmAction({ type: 'pause', tenant: tn })}
            onResume={(tn) => setConfirmAction({ type: 'resume', tenant: tn })}
            onBackup={(tn) => setConfirmAction({ type: 'backup', tenant: tn })}
            onDelete={(tn) => setConfirmAction({ type: 'delete', tenant: tn })}
          />
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {t('total', { total: filteredTenants.length })}
          </span>
        </div>
      </div>

      <CreateTenantDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        form={createForm}
        onChange={setCreateForm}
        submitting={createMut.isPending}
        onSubmit={handleCreate}
      />

      {dialogProps ? (
        <ConfirmActionDialog
          open={!!confirmAction}
          onOpenChange={(v) => !v && setConfirmAction(null)}
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
          onConfirm={dialogProps.onConfirm}
          pending={dialogProps.pending}
        />
      ) : null}
    </>
  )
}
