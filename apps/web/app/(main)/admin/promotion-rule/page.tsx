// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'
import * as React from 'react'
import { ChevronLeft, ChevronRight, Percent, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, SearchInput } from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { CrudFormDialog, useCrudResource, type CrudField } from '@/components/admin/crud-resource'
import type { PromotionRule, PromotionStatus } from './types'

const BADGE: Record<PromotionStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  paused: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  expired: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
}
const STATUS_LABEL: Record<PromotionStatus, string> = {
  draft: '草稿',
  active: '进行中',
  paused: '已暂停',
  expired: '已过期',
}
const c = 'px-4 py-3'
const fmt = (v: string | null) => (v ? v.replace('T', ' ').slice(0, 16) : '—')

const FORM_FIELDS: CrudField[] = [
  { key: 'name', label: '规则名称', type: 'text', placeholder: '如:满 200 减 30' },
  {
    key: 'type',
    label: '类型',
    type: 'select',
    options: [
      { value: 'discount', label: '折扣' },
      { value: 'fullReduction', label: '满减' },
      { value: 'flash', label: '限时' },
      { value: 'bundle', label: '组合' },
      { value: 'seckill', label: '秒杀' },
    ],
  },
  {
    key: 'discountType',
    label: '优惠形式',
    type: 'select',
    options: [
      { value: 'amount', label: '减固定金额' },
      { value: 'percent', label: '按百分比' },
    ],
  },
  { key: 'threshold', label: '门槛金额(0 不限)', type: 'number' },
  { key: 'discount', label: '优惠值', type: 'number' },
  {
    key: 'scope',
    label: '适用范围',
    type: 'select',
    options: [
      { value: 'all', label: '全部' },
      { value: 'category', label: '指定分类' },
      { value: 'product', label: '指定商品' },
    ],
  },
  { key: 'scopeRef', label: '范围引用 ID(可选)', type: 'text' },
  { key: 'priority', label: '优先级', type: 'number' },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    options: [
      { value: 'draft', label: '草稿' },
      { value: 'active', label: '进行中' },
      { value: 'paused', label: '已暂停' },
      { value: 'expired', label: '已过期' },
    ],
  },
  { key: 'startTime', label: '开始时间', type: 'datetime' },
  { key: 'endTime', label: '结束时间', type: 'datetime' },
]

export default function AdminPromotionRulePage() {
  const crud = useCrudResource<PromotionRule>({
    basePath: '/api/admin/promotions/rules',
    queryKey: ['admin', 'promotion-rule'],
  })
  const { list, total, totalPages } = crud
  const head = ['规则名称', '类型', '优惠', '状态', '时间', '操作']
  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex min-w-0 items-center gap-2 text-2xl font-bold tracking-tight">
          <Percent className="h-6 w-6 shrink-0 text-primary" />
          <span className="truncate">促销规则</span>
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
                list.map((row: PromotionRule) => (
                  <tr key={row.id}>
                    <td className={`${c} font-medium`}>{row.name}</td>
                    <td className={c}>{row.type}</td>
                    <td className={`${c} tabular-nums`}>
                      {row.discount}
                      {row.discountType === 'percent' ? '%' : ' 元'}
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
        title={crud.dialog?.mode === 'edit' ? `编辑促销规则` : `新增促销规则`}
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
