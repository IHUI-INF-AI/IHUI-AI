'use client'
import * as React from 'react'
import { ChevronLeft, ChevronRight, ShoppingBag, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, SearchInput } from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { CrudFormDialog, useCrudResource, type CrudField } from '@/components/admin/crud-resource'
import type { PointsProduct, PointsProductStatus } from './types'

const BADGE: Record<PointsProductStatus, string> = {
  on: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  off: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  soldout: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
}
const STATUS_LABEL: Record<PointsProductStatus, string> = {
  on: '上架',
  off: '下架',
  soldout: '售罄',
}
const c = 'px-4 py-3'
const fmt = (v: string | null) => (v ? v.replace('T', ' ').slice(0, 16) : '—')

const FORM_FIELDS: CrudField[] = [
  { key: 'name', label: '商品名称', type: 'text', placeholder: '如:VIP 月卡' },
  {
    key: 'category',
    label: '分类',
    type: 'select',
    options: [
      { value: 'virtual', label: '虚拟' },
      { value: 'physical', label: '实物' },
      { value: 'coupon', label: '优惠券' },
      { value: 'vip', label: '会员' },
    ],
  },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    options: [
      { value: 'on', label: '上架' },
      { value: 'off', label: '下架' },
      { value: 'soldout', label: '售罄' },
    ],
  },
  { key: 'pointsCost', label: '兑换积分', type: 'number' },
  { key: 'stock', label: '库存', type: 'number' },
  { key: 'limitPerUser', label: '限购/人(0 不限)', type: 'number' },
  { key: 'startTime', label: '上架时间', type: 'datetime' },
  { key: 'endTime', label: '下架时间', type: 'datetime' },
]

export default function AdminPointsMallPage() {
  const crud = useCrudResource<PointsProduct>({
    basePath: '/api/admin/points/mall',
    queryKey: ['admin', 'points-mall'],
  })
  const { list, total, totalPages } = crud
  const head = ['商品名称', '分类', '积分', '库存/已售', '状态', '时间', '操作']
  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex min-w-0 items-center gap-2 text-2xl font-bold tracking-tight">
          <ShoppingBag className="h-6 w-6 shrink-0 text-primary" />
          <span className="truncate">积分商城商品</span>
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
                list.map((row: PointsProduct) => (
                  <tr key={row.id}>
                    <td className={`${c} font-medium`}>{row.name}</td>
                    <td className={c}>{row.category}</td>
                    <td className={`${c} tabular-nums`}>{row.pointsCost}</td>
                    <td className={`${c} tabular-nums`}>
                      {row.stock}
                      <span className="text-muted-foreground">/{row.sold}</span>
                    </td>
                    <td className={c}>
                      <span className={`rounded px-2 py-0.5 text-xs ${BADGE[row.status]}`}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td className={`${c} text-xs text-muted-foreground`}>
                      {fmt(row.startTime)} ~ {fmt(row.endTime)}
                    </td>
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
        title={crud.dialog?.mode === 'edit' ? `编辑积分商城商品` : `新增积分商城商品`}
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
