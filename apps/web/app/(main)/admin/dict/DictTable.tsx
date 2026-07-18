'use client'

import * as React from 'react'
import { Loader2, ChevronRight, ChevronDown, Edit, Trash2, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { Button } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import { th } from './helpers'
import { DictTag } from '@/components/DictTag'
import type { DictType } from './types'

interface DictTableProps {
  list: DictType[]
  isLoading: boolean
  expanded: Set<string>
  delTypePending: boolean
  delItemPending: boolean
  onToggle: (id: string) => void
  onEditType: (d: DictType) => void
  onCreateItem: (d: DictType) => void
  onDeleteType: (id: string) => void
  onEditItem: (d: DictType, it: DictType['items'][number]) => void
  onDeleteItem: (id: string) => void
}

export function DictTable({
  list,
  isLoading,
  expanded,
  delTypePending,
  delItemPending,
  onToggle,
  onEditType,
  onCreateItem,
  onDeleteType,
  onEditItem,
  onDeleteItem,
}: DictTableProps) {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {tc('search')}
      </div>
    )
  }

  if (list.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
        {t('dict.noData')}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {list.map((d) => {
        const isOpen = expanded.has(d.id)
        return (
          <div key={d.id} className="overflow-hidden rounded-lg border">
            <div className="flex items-center justify-between bg-muted/30 px-4 py-3">
              <button
                onClick={() => onToggle(d.id)}
                className="flex flex-1 items-center gap-2 text-left"
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-medium">{d.name}</span>
                <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                  {d.code}
                </code>
                <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  {d.itemCount}
                </span>
              </button>
              <div className="flex gap-1">
                <HasPermi code="ai:dictionary:edit">
                  <Button size="sm" variant="ghost" onClick={() => onEditType(d)}>
                    <Edit className="h-4 w-4" />
                    {tc('edit')}
                  </Button>
                </HasPermi>
                <HasPermi code="ai:dictionary:add">
                  <Button size="sm" variant="ghost" onClick={() => onCreateItem(d)}>
                    <Plus className="h-4 w-4" />
                    {t('dict.addItem')}
                  </Button>
                </HasPermi>
                <HasPermi code="ai:dictionary:remove">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={delTypePending}
                    onClick={() => {
                      if (confirm(t('dict.deleteConfirm'))) onDeleteType(d.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </HasPermi>
              </div>
            </div>
            {d.description && (
              <div className="px-4 py-2 text-xs text-muted-foreground">{d.description}</div>
            )}
            {isOpen && (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className={th}>{t('dict.colLabel')}</th>
                    <th className={th}>{t('dict.colValue')}</th>
                    <th className={th}>{t('dict.colSort')}</th>
                    <th className={th}>{t('dict.colStatus')}</th>
                    <th className={cn(th, 'text-right')}>{t('dict.colActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {d.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                        {t('dict.noItems')}
                      </td>
                    </tr>
                  ) : (
                    d.items.map((it) => (
                      <tr key={it.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-medium">{it.label}</td>
                        <td className="px-4 py-2.5">
                          <DictTag value={it.value} listClass={it.listClass} />
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{it.sort}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 text-xs',
                              it.status === 1
                                ? 'text-emerald-600 dark:text-emerald-500'
                                : 'text-muted-foreground',
                            )}
                          >
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                it.status === 1 ? 'bg-emerald-500' : 'bg-muted-foreground',
                              )}
                            />
                            {it.status === 1 ? t('dict.statusEnabled') : t('dict.statusDisabled')}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <HasPermi code="ai:dictionary:edit">
                            <Button size="sm" variant="ghost" onClick={() => onEditItem(d, it)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </HasPermi>
                          <HasPermi code="ai:dictionary:remove">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={delItemPending}
                              onClick={() => {
                                if (confirm(t('dict.deleteConfirm'))) onDeleteItem(it.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </HasPermi>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        )
      })}
    </div>
  )
}
