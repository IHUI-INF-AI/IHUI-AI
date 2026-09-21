// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { Button, SearchInput } from '@ihui/ui-react'
import type { SensitiveWord } from './types'
import { BackButton } from '@/components/common'
import { CrudFormDialog, useCrudResource, type CrudField } from '@/components/admin/crud-resource'

const BADGE: Record<number, string> = {
  1: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  0: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
}
const LEVEL_KEY: Record<number, 'level1' | 'level2' | 'level3'> = {
  1: 'level1',
  2: 'level2',
  3: 'level3',
}
// 分类 ID(后端枚举)→ 中文显示,对齐 helpers.ts 中性标识符
const CATEGORY_LABEL: Record<string, string> = {
  default: '默认',
  politics: '时政',
  explicit: '低俗',
  ads: '广告',
  harassment: '骚扰',
}
const c = 'px-4 py-3'

export default function AdminSensitiveWordPage() {
  const t = useTranslations('admin.sensitiveWord')
  const crud = useCrudResource<SensitiveWord>({
    basePath: '/api/admin/sensitive-words',
    queryKey: ['admin', 'sensitive-word'],
    searchParam: 'word',
    transform: (v) => ({
      word: v.word,
      category: v.category ?? 'default',
      level: Number(v.level ?? 1),
      replacement: typeof v.replacement === 'string' && v.replacement ? v.replacement : null,
      status: Number(v.status ?? 1),
    }),
    onSaved: () => toast.success(t('created')),
  })
  const { list, total, totalPages } = crud

  const fields: CrudField[] = [
    { key: 'word', label: t('formWord'), type: 'text' },
    {
      key: 'category',
      label: t('formCategory'),
      type: 'select',
      options: Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label })),
    },
    {
      key: 'level',
      label: t('formLevel'),
      type: 'select',
      options: [
        { value: '1', label: t('level1') },
        { value: '2', label: t('level2') },
        { value: '3', label: t('level3') },
      ],
    },
    { key: 'replacement', label: t('formReplacement'), type: 'text' },
    {
      key: 'status',
      label: t('formStatus'),
      type: 'select',
      options: [
        { value: '1', label: t('statusOn') },
        { value: '0', label: t('statusOff') },
      ],
    },
  ]
  const head = [
    t('colWord'),
    t('colCategory'),
    t('colLevel'),
    t('colReplacement'),
    t('colStatus'),
    t('colActions'),
  ]
  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex min-w-0 items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldAlert className="h-6 w-6 shrink-0 text-primary" />
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
                list.map((w: SensitiveWord) => (
                  <tr key={w.id}>
                    <td className={`${c} font-medium`}>{w.word}</td>
                    <td className={`${c} text-muted-foreground`}>
                      {CATEGORY_LABEL[w.category] ?? w.category}
                    </td>
                    <td className={`${c} text-muted-foreground`}>
                      {t(LEVEL_KEY[w.level] ?? 'level1')}
                    </td>
                    <td className={`${c} text-muted-foreground`}>{w.replacement || '—'}</td>
                    <td className={c}>
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${BADGE[w.status] ?? BADGE[0]}`}
                      >
                        {w.status === 1 ? t('statusOn') : t('statusOff')}
                      </span>
                    </td>
                    <td className={c}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => crud.openEdit(w)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void crud.remove(w.id)}
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
        initial={crud.dialog?.row ?? null}
        pending={crud.saving}
        err={crud.err}
        onSubmit={crud.save}
        onClose={crud.closeDialog}
      />
    </div>
  )
}
