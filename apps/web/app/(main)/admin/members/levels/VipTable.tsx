'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Plus, Download, Search } from 'lucide-react'

import { HasPermi } from '@/components/auth/HasPermi'
import { Button, Input, Label } from '@ihui/ui-react'
import { th } from './helpers'
import type { Item, FormState } from './types'

interface VipTableProps {
  perm: string
  searchFields: { key: string; label: string }[]
  allKeys: string[]
  labels: Record<string, string>
  list: Item[]
  isLoading: boolean
  total: number
  page: number
  totalPages: number
  search: FormState
  onSearchChange: (s: FormState) => void
  onSearch: () => void
  onReset: () => void
  onExport: () => void
  onCreate: () => void
  onEdit: (item: Item) => void
  onDelete: (id: string) => void
  onPageChange: (page: number) => void
  emptyIcon: React.ReactNode
}

export function VipTable({
  perm,
  searchFields,
  allKeys,
  labels,
  list,
  isLoading,
  total,
  page,
  totalPages,
  search,
  onSearchChange,
  onSearch,
  onReset,
  onExport,
  onCreate,
  onEdit,
  onDelete,
  onPageChange,
  emptyIcon,
}: VipTableProps) {
  const t = useTranslations('admin.membersLevels')
  return (
    <>
      <div className="flex gap-2">
        <HasPermi code={`${perm}:export`}>
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4" />
            {t('export')}
          </Button>
        </HasPermi>
        <HasPermi code={`${perm}:add`}>
          <Button size="sm" onClick={onCreate} className="ml-auto">
            <Plus className="h-4 w-4" />
            {t('create')}
          </Button>
        </HasPermi>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        {searchFields.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label className="text-xs">{f.label}</Label>
            <Input
              className="h-9 w-36"
              value={search[f.key] ?? ''}
              onChange={(e) => onSearchChange({ ...search, [f.key]: e.target.value })}
              placeholder={t('searchPlaceholder', { label: f.label })}
            />
          </div>
        ))}
        <Button size="sm" onClick={onSearch}>
          <Search className="h-4 w-4" />
          {t('search')}
        </Button>
        <Button variant="outline" size="sm" onClick={onReset}>
          {t('reset')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className={th}>ID</th>
              {allKeys.map((k) => (
                <th key={k} className={th}>
                  {labels[k]}
                </th>
              ))}
              <th className={th}>{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td
                  colSpan={2 + allKeys.length}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td
                  colSpan={2 + allKeys.length}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  {emptyIcon}
                  {t('empty')}
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={String(item.id)} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">{String(item.id)}</td>
                  {allKeys.map((k) => (
                    <td key={k} className="px-4 py-2.5">
                      {String(item[k] ?? '-')}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 space-x-2">
                    <HasPermi code={`${perm}:edit`}>
                      <button className="text-primary hover:underline" onClick={() => onEdit(item)}>
                        {t('edit')}
                      </button>
                    </HasPermi>
                    <HasPermi code={`${perm}:remove`}>
                      <button
                        className="text-destructive hover:underline"
                        onClick={() => onDelete(String(item.id))}
                      >
                        {t('delete')}
                      </button>
                    </HasPermi>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('total', { total, page, totalPages })}</span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              {t('prev')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              {t('next')}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
