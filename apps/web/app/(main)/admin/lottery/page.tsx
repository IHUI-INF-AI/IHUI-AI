// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'
import * as React from 'react'
import { ChevronLeft, ChevronRight, Gift, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, SearchInput } from '@ihui/ui-react'
import type { Lottery, LotteryStatus } from './types'
import { BackButton } from '@/components/common'
import { CrudFormDialog, useCrudResource, type CrudField } from '@/components/admin/crud-resource'

const BADGE: Record<LotteryStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  finished: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  cancelled: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
}
const STATUS_LABEL: Record<LotteryStatus, string> = {
  draft: '草稿',
  active: '进行中',
  finished: '已结束',
  cancelled: '已取消',
}
const c = 'px-4 py-3'
const fmt = (v: string | null) => (v ? v.replace('T', ' ').slice(0, 16) : '—')

const FORM_FIELDS: CrudField[] = [
  { key: 'name', label: '活动名称', type: 'text', placeholder: '如:开门大吉抽奖' },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    options: [
      { value: 'draft', label: '草稿' },
      { value: 'active', label: '进行中' },
      { value: 'finished', label: '已结束' },
      { value: 'cancelled', label: '已取消' },
    ],
  },
  { key: 'costPoints', label: '消耗积分/次', type: 'number' },
  { key: 'freeQuota', label: '免费次数', type: 'number' },
  { key: 'startTime', label: '开始时间', type: 'datetime' },
  { key: 'endTime', label: '结束时间', type: 'datetime' },
]

export default function AdminLotteryPage() {
  const crud = useCrudResource<Lottery>({
    basePath: '/api/admin/promotions/lottery',
    queryKey: ['admin', 'lottery'],
  })
  const { list, total, totalPages } = crud
  const head = ['活动名称', '消耗积分', '参与/中奖', '奖品数', '状态', '时间', '操作']
  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex min-w-0 items-center gap-2 text-2xl font-bold tracking-tight">
          <Gift className="h-6 w-6 shrink-0 text-primary" />
          <span className="truncate">抽奖活动</span>
        </h1>
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          <SearchInput
            value={crud.search}
            onChange={(e) => crud.setSearch(e.target.value)}
            placeholder="搜索活动名"
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
                  <td colSpan={7} className={`${c} py-8 text-center text-muted-foreground`}>
                    {crud.isLoading ? '…' : '暂无活动'}
                  </td>
                </tr>
              ) : (
                list.map((l: Lottery) => (
                  <tr key={l.id}>
                    <td className={`${c} font-medium`}>{l.name}</td>
                    <td className={`${c} tabular-nums`}>
                      {l.costPoints}
                      <span className="text-muted-foreground">/次</span>
                    </td>
                    <td className={`${c} tabular-nums`}>
                      {l.participants}
                      <span className="text-muted-foreground">/{l.winners}</span>
                    </td>
                    <td className={c}>{l.prizes.length}</td>
                    <td className={c}>
                      <span className={`rounded px-2 py-0.5 text-xs ${BADGE[l.status]}`}>
                        {STATUS_LABEL[l.status]}
                      </span>
                    </td>
                    <td className={`${c} text-xs text-muted-foreground`}>
                      {fmt(l.startTime)} ~ {fmt(l.endTime)}
                    </td>
                    <td className={c}>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => crud.openEdit(l)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void crud.remove(l.id)}
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
        title={crud.dialog?.mode === 'edit' ? '编辑抽奖活动' : '新增抽奖活动'}
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
