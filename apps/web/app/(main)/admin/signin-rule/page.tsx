// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { CalendarCheck, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, SearchInput } from '@ihui/ui-react'
import type { SigninRule } from './types'
import { BackButton } from '@/components/common'
import { CrudFormDialog, useCrudResource, type CrudField } from '@/components/admin/crud-resource'

const BADGE: Record<number, string> = {
  1: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  0: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
}
const c = 'px-4 py-3'

export default function AdminSigninRulePage() {
  const t = useTranslations('admin.signinRule')
  const crud = useCrudResource<SigninRule>({
    basePath: '/api/admin/promotions/signin-rules',
    queryKey: ['admin', 'signin-rule'],
    transform: (v) => ({
      ...v,
      // 额外奖励说明 → jsonb {description}
      extraReward:
        typeof v.extraReward === 'string' && v.extraReward ? { description: v.extraReward } : {},
    }),
    onSaved: (mode) => toast.success(mode === 'create' ? t('created') : t('updateSuccess')),
  })
  const { list, total, totalPages } = crud

  const fields: CrudField[] = [
    { key: 'name', label: t('formName'), type: 'text', placeholder: t('formName') },
    { key: 'consecutiveDays', label: t('formDays'), type: 'number' },
    { key: 'rewardPoints', label: t('formPoints'), type: 'number' },
    { key: 'extraReward', label: t('formExtra'), type: 'text' },
    {
      key: 'status',
      label: t('colStatus'),
      type: 'select',
      options: [
        { value: '1', label: t('statusOn') },
        { value: '0', label: t('statusOff') },
      ],
    },
  ]
  // 编辑预填:extraReward jsonb → 说明文本
  const dialogInitial = crud.dialog?.row
    ? { ...crud.dialog.row, extraReward: crud.dialog.row.extraReward?.description ?? '' }
    : null
  const head = [
    t('colName'),
    t('formDays'),
    t('colPoints'),
    t('colExtra'),
    t('colStatus'),
    t('colActions'),
  ]
  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex min-w-0 items-center gap-2 text-2xl font-bold tracking-tight">
          <CalendarCheck className="h-6 w-6 shrink-0 text-primary" />
          <span className="truncate">{t('title')}</span>
        </h1>
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          <SearchInput
            value={crud.search}
            onChange={(e) => crud.setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            size="lg"
            wrapperClassName="w-full sm:w-64"
          />
          <Button size="sm" onClick={crud.openCreate}>
            <Plus className="h-4 w-4" />
            <span>{t('add')}</span>
          </Button>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                {head.map((h, i) => (
                  <th key={h} className={`${c} font-medium${i === 5 ? ' text-right' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!list.length ? (
                <tr>
                  <td colSpan={6} className={`${c} py-8 text-center text-muted-foreground`}>
                    {crud.isLoading ? '…' : t('noData')}
                  </td>
                </tr>
              ) : (
                list.map((r: SigninRule) => (
                  <tr key={r.id}>
                    <td className={`${c} font-medium`}>{r.name}</td>
                    <td className={`${c} tabular-nums`}>{r.consecutiveDays}</td>
                    <td className={`${c} tabular-nums text-emerald-600 dark:text-emerald-400`}>
                      +{r.rewardPoints}
                    </td>
                    <td className={`${c} text-muted-foreground`}>
                      {r.extraReward?.description || '—'}
                    </td>
                    <td className={c}>
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${BADGE[r.status] ?? BADGE[0]}`}
                      >
                        {r.status === 1 ? t('statusOn') : t('statusOff')}
                      </span>
                    </td>
                    <td className={c}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => crud.openEdit(r)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void crud.remove(r.id)}
                        >
                          <Trash2 className="h-4 w-4 text-rose-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={crud.page <= 1}
            onClick={() => crud.setPage(crud.page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {crud.page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={crud.page >= totalPages}
            onClick={() => crud.setPage(crud.page + 1)}
          >
            {t('next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <CrudFormDialog
        open={!!crud.dialog}
        mode={crud.dialog?.mode ?? 'create'}
        title={crud.dialog?.mode === 'edit' ? t('dialogEdit') : t('dialogCreate')}
        fields={fields}
        initial={dialogInitial}
        pending={crud.saving}
        err={crud.err}
        onSubmit={crud.save}
        onClose={crud.closeDialog}
      />
    </div>
  )
}
