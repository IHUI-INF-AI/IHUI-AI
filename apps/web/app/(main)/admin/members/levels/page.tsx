'use client'

import * as React from 'react'
import { Crown, Users } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useVipCrud } from './useVipCrud'
import { VipTable } from './VipTable'
import { VipFormDialog, VipDeleteDialog } from './VipDialogs'
import {
  LEVEL_RESOURCE,
  LEVEL_PERM,
  LEVEL_FIELDS,
  LEVEL_SEARCH,
  LEVEL_DATE_FIELDS,
  LEVEL_ALL_KEYS,
  LEVEL_LABELS,
  LEVEL_EMPTY,
  LEVEL_EXPORT,
  USER_RESOURCE,
  USER_PERM,
  USER_FIELDS,
  USER_SEARCH,
  USER_DATE_FIELDS,
  USER_ALL_KEYS,
  USER_LABELS,
  USER_EMPTY,
  USER_EXPORT,
  type VipCrudConfig,
} from './helpers'

const levelConfig: VipCrudConfig = {
  resource: LEVEL_RESOURCE,
  perm: LEVEL_PERM,
  fields: LEVEL_FIELDS,
  searchFields: LEVEL_SEARCH,
  dateFields: LEVEL_DATE_FIELDS,
  allKeys: LEVEL_ALL_KEYS,
  labels: LEVEL_LABELS,
  empty: LEVEL_EMPTY,
  exportColumns: LEVEL_EXPORT,
  exportName: 'VIP等级',
  exportMode: 'api',
}

const userConfig: VipCrudConfig = {
  resource: USER_RESOURCE,
  perm: USER_PERM,
  fields: USER_FIELDS,
  searchFields: USER_SEARCH,
  dateFields: USER_DATE_FIELDS,
  allKeys: USER_ALL_KEYS,
  labels: USER_LABELS,
  empty: USER_EMPTY,
  exportColumns: USER_EXPORT,
  exportName: '用户VIP',
  exportMode: 'list',
}

export default function VipLevelPage() {
  const [tab, setTab] = React.useState<'level' | 'user'>('level')
  const level = useVipCrud(levelConfig)
  const user = useVipCrud({ ...userConfig, enabled: tab === 'user' })

  const tabCls = (active: boolean) =>
    cn(
      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
      active
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground',
    )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Crown className="h-6 w-6 text-primary" />
          VIP管理
        </h1>
      </div>

      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
        <button onClick={() => setTab('level')} className={tabCls(tab === 'level')}>
          <Crown className="mr-1 inline h-4 w-4" />
          VIP等级
        </button>
        <button onClick={() => setTab('user')} className={tabCls(tab === 'user')}>
          <Users className="mr-1 inline h-4 w-4" />
          用户VIP
        </button>
      </div>

      {tab === 'level' && (
        <>
          <VipTable
            perm={LEVEL_PERM}
            searchFields={LEVEL_SEARCH}
            allKeys={LEVEL_ALL_KEYS}
            labels={LEVEL_LABELS}
            list={level.list}
            isLoading={level.isLoading}
            total={level.total}
            page={level.page}
            totalPages={level.totalPages}
            search={level.search}
            onSearchChange={level.setSearch}
            onSearch={() => level.setPage(1)}
            onReset={level.handleReset}
            onExport={level.handleExport}
            onCreate={level.openCreate}
            onEdit={level.openEdit}
            onDelete={level.setDelId}
            onPageChange={level.setPage}
            emptyIcon={<Crown className="mx-auto mb-2 h-8 w-8 opacity-40" />}
          />
          <VipFormDialog
            open={level.open}
            editing={level.editing}
            form={level.form}
            fields={LEVEL_FIELDS}
            dateFields={LEVEL_DATE_FIELDS}
            titleCreate="新增VIP等级"
            titleEdit="编辑VIP等级"
            descCreate="添加新的VIP等级"
            descEdit="修改VIP等级"
            isPending={level.saveMut.isPending}
            onFormChange={level.setForm}
            onClose={level.closeDialog}
            onSubmit={level.submit}
          />
          <VipDeleteDialog
            open={level.delId !== null}
            isPending={level.delMut.isPending}
            onClose={() => level.setDelId(null)}
            onConfirm={() => level.delId && level.delMut.mutate(level.delId)}
          />
        </>
      )}

      {tab === 'user' && (
        <>
          <VipTable
            perm={USER_PERM}
            searchFields={USER_SEARCH}
            allKeys={USER_ALL_KEYS}
            labels={USER_LABELS}
            list={user.list}
            isLoading={user.isLoading}
            total={user.total}
            page={user.page}
            totalPages={user.totalPages}
            search={user.search}
            onSearchChange={user.setSearch}
            onSearch={() => user.setPage(1)}
            onReset={user.handleReset}
            onExport={user.handleExport}
            onCreate={user.openCreate}
            onEdit={user.openEdit}
            onDelete={user.setDelId}
            onPageChange={user.setPage}
            emptyIcon={<Users className="mx-auto mb-2 h-8 w-8 opacity-40" />}
          />
          <VipFormDialog
            open={user.open}
            editing={user.editing}
            form={user.form}
            fields={USER_FIELDS}
            dateFields={USER_DATE_FIELDS}
            titleCreate="新增用户VIP"
            titleEdit="编辑用户VIP"
            descCreate="添加新的用户VIP"
            descEdit="修改用户VIP进度"
            isPending={user.saveMut.isPending}
            onFormChange={user.setForm}
            onClose={user.closeDialog}
            onSubmit={user.submit}
          />
          <VipDeleteDialog
            open={user.delId !== null}
            isPending={user.delMut.isPending}
            onClose={() => user.setDelId(null)}
            onConfirm={() => user.delId && user.delMut.mutate(user.delId)}
          />
        </>
      )}
    </div>
  )
}
