// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { CalendarCheck, Plus, Trash2 } from 'lucide-react'
import { Button, Input } from '@ihui/ui-react'
import { BackButton, AuthGatePrompt } from '@/components/common'
import { useAuthGate } from '@/hooks/use-auth-gate'
import { apiOrThrow as api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface PoolRow {
  id: string
  providerCode: string
  uid: string
  name: string
  isEnabled: boolean
  healthStatus: string
  tokenExpiresAt: string | null
  totalCalls: number
  checkinPending: boolean
  checkinSyncedAt: string | null
}

const PROVIDERS = ['trae', 'workbuddy', 'qoder', 'codearts'] as const
const EMPTY_FORM = { providerCode: 'trae', name: '', token: '', refreshToken: '' }

export default function AccountPoolPage() {
  const t = useTranslations('accountPool')
  const { allow } = useAuthGate()
  const qc = useQueryClient()
  const [adding, setAdding] = React.useState(false)
  const [form, setForm] = React.useState(EMPTY_FORM)
  const [confirmId, setConfirmId] = React.useState<string | null>(null)

  const listQ = useQuery({
    queryKey: ['account-pool'],
    enabled: allow,
    queryFn: () => api<{ list: PoolRow[]; total: number }>('/api/account-pool'),
  })
  const rows = listQ.data?.list ?? []

  const invalidate = () => qc.invalidateQueries({ queryKey: ['account-pool'] })
  const addMut = useMutation({
    mutationFn: () =>
      api('/api/account-pool', {
        method: 'POST',
        body: JSON.stringify({
          providerCode: form.providerCode,
          name: form.name.trim(),
          token: form.token.trim(),
          refreshToken: form.refreshToken.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success(t('addSuccess'))
      setForm(EMPTY_FORM)
      setAdding(false)
      invalidate()
    },
    onError: (e: Error) => toast.error(t('actionFailed'), { description: e.message }),
  })
  const toggleMut = useMutation({
    mutationFn: (row: PoolRow) =>
      api(`/api/account-pool/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled: !row.isEnabled }),
      }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(t('actionFailed'), { description: e.message }),
  })
  const checkinMut = useMutation({
    mutationFn: (row: PoolRow) => api(`/api/account-pool/${row.id}/checkin`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(t('checkinSuccess'))
      invalidate()
    },
    onError: (e: Error) => toast.error(t('actionFailed'), { description: e.message }),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/account-pool/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setConfirmId(null)
      invalidate()
    },
    onError: (e: Error) => toast.error(t('actionFailed'), { description: e.message }),
  })

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4">
      <div className="flex items-center justify-between">
        <BackButton />
        <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-4 w-4" />
          <span>{t('add')}</span>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {!allow ? (
        <AuthGatePrompt message={t('loginRequired')} />
      ) : (
        <>
          {adding ? (
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">{t('provider')}</span>
                  <select
                    className="ui-control w-full rounded-sm border border-border bg-background px-3 py-2 text-sm"
                    value={form.providerCode}
                    onChange={(e) => setForm((f) => ({ ...f, providerCode: e.target.value }))}
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">{t('name')}</span>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder={t('namePlaceholder')}
                  />
                </label>
              </div>
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">{t('token')}</span>
                <textarea
                  className="ui-control min-h-20 w-full rounded-sm border border-border bg-background px-3 py-2 text-sm"
                  value={form.token}
                  onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">{t('refreshToken')}</span>
                <Input
                  value={form.refreshToken}
                  onChange={(e) => setForm((f) => ({ ...f, refreshToken: e.target.value }))}
                  placeholder={t('optional')}
                />
              </label>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                  {t('cancel')}
                </Button>
                <Button
                  size="sm"
                  disabled={!form.name.trim() || !form.token.trim() || addMut.isPending}
                  onClick={() => addMut.mutate()}
                >
                  {t('save')}
                </Button>
              </div>
            </div>
          ) : null}

          {listQ.isLoading ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-sm font-medium">{t('empty')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('emptyHint')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                        {row.providerCode}
                      </span>
                      <span className="truncate text-sm font-medium">{row.name}</span>
                      <span
                        className={cn(
                          'rounded-sm px-1.5 py-0.5 text-xs',
                          row.isEnabled
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {row.isEnabled ? t('enabled') : t('disabled')}
                      </span>
                      {row.checkinPending ? (
                        <span className="rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-600">
                          {t('syncPending')}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {t('uid')}: {row.uid}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={checkinMut.isPending}
                      onClick={() => checkinMut.mutate(row)}
                    >
                      <CalendarCheck className="h-4 w-4" />
                      <span>{t('checkin')}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={toggleMut.isPending}
                      onClick={() => toggleMut.mutate(row)}
                    >
                      {row.isEnabled ? t('disable') : t('enable')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={cn(confirmId === row.id && 'text-destructive')}
                      disabled={deleteMut.isPending}
                      onClick={() =>
                        confirmId === row.id ? deleteMut.mutate(row.id) : setConfirmId(row.id)
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>{confirmId === row.id ? t('confirmDelete') : t('delete')}</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
