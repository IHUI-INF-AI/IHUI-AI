'use client'
import * as React from 'react'
import { ChevronLeft, ChevronRight, FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, SearchInput } from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { CrudFormDialog, useCrudResource, type CrudField } from '@/components/admin/crud-resource'
import type { TaxRule, TaxStatus } from './types'

const BADGE: Record<TaxStatus, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  disabled: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
}
const STATUS_LABEL: Record<TaxStatus, string> = {
  active: '启用',
  disabled: '停用',
}
const c = 'px-4 py-3'
const fmt = (v: string | null) => (v ? v.replace('T', ' ').slice(0, 16) : '—')

const FORM_FIELDS: CrudField[] = [
  { key: 'name', label: '名称', type: 'text', placeholder: '如:增值税-一般纳税人' },
  { key: 'category', label: '类别', type: 'text', placeholder: '如:default' },
  { key: 'rate', label: '税率(%)', type: 'number' },
  { key: 'threshold', label: '起征点(0 不限)', type: 'number' },
  { key: 'description', label: '说明', type: 'text' },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    options: [
      { value: 'active', label: '启用' },
      { value: 'disabled', label: '停用' },
    ],
  },
  { key: 'effectiveAt', label: '生效时间', type: 'datetime' },
]

export default function AdminTaxPage() {
  const crud = useCrudResource<TaxRule>({
    basePath: '/api/admin/billing/tax',
    queryKey: ['admin', 'tax'],
  })
  const { list, total, totalPages } = crud
  const head = ['名称', '类别', '税率', '起征点', '状态', '生效时间', '操作']
  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex min-w-0 items-center gap-2 text-2xl font-bold tracking-tight">
          <FileText className="h-6 w-6 shrink-0 text-primary" />
          <span className="truncate">税率规则</span>
        </h1>
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          <SearchInput
            value={crud.search}
            onChange={(e) => crud.setSearch(e.target.value)}
            placeholder="__PLACEHOLDER__"
            size="lg"
            wrapperClassName="w-full sm:w-64"
          />
          <Button size="sm" onClick={crud.openCreate}>
            <Plus className="h-4 w-4" />
            <span>新增</span>
          </Button>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                {head.map((h) => (
                  <th key={h} className={`${c} font-medium`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!list.length ? (
                <tr>
                  <td
                    colSpan={head.length}
                    className={`${c} py-8 text-center text-muted-foreground`}
                  >
                    {crud.isLoading ? '…' : '暂无数据'}
                  </td>
                </tr>
              ) : (
                list.map((row: TaxRule) => (
                  <tr key={row.id}>
                    <td className={`${c} font-medium`}>{row.name}</td>
                    <td className={c}>{row.category}</td>
                    <td className={`${c} tabular-nums`}>{row.rate}%</td>
                    <td className={`${c} tabular-nums`}>{row.threshold}</td>
                    <td className={c}>
                      <span className={`rounded px-2 py-0.5 text-xs ${BADGE[row.status]}`}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td className={`${c} text-xs text-muted-foreground`}>{fmt(row.effectiveAt)}</td>
                    <td className={c}>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => crud.openEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void crud.remove(row.id)}
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
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={crud.page <= 1}
            onClick={() => crud.setPage(crud.page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
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
            下一页
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <CrudFormDialog
        open={!!crud.dialog}
        mode={crud.dialog?.mode ?? 'create'}
        title={crud.dialog?.mode === 'edit' ? `编辑税率规则` : `新增税率规则`}
        fields={FORM_FIELDS}
        initial={crud.dialog?.row ?? null}
        pending={crud.saving}
        err={crud.err}
        onSubmit={crud.save}
        onClose={crud.closeDialog}
      />
    </div>
  )
}
