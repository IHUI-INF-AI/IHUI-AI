'use client'

import { useTranslations } from 'next-intl'
import { Edit, Trash2, Plus, Eye, EyeOff } from 'lucide-react'
import { Button } from '@ihui/ui'
import { DataTable, type Column } from '@/components/data'
import { cn } from '@/lib/utils'
import { PAGE_SIZE } from './helpers'
import type { MenuItem } from './types'

interface Props {
  list: MenuItem[]
  isLoading: boolean
  page: number
  total: number
  delPending: boolean
  onToggleVisible: (m: MenuItem) => void
  onEdit: (m: MenuItem) => void
  onAddChild: (parentId: string) => void
  onDelete: (m: MenuItem) => void
  onPageChange: (page: number) => void
}

export function MenuTable({
  list,
  isLoading,
  page,
  total,
  delPending,
  onToggleVisible,
  onEdit,
  onAddChild,
  onDelete,
  onPageChange,
}: Props) {
  const t = useTranslations('admin.menu')
  const columns: Column<MenuItem>[] = [
    {
      key: 'name',
      title: t('colName'),
      render: (m) => <span className="font-medium">{m.name}</span>,
    },
    {
      key: 'icon',
      title: t('colIcon'),
      render: (m) => (
        <code className="font-mono text-xs text-muted-foreground">{m.icon || '-'}</code>
      ),
    },
    {
      key: 'path',
      title: t('colPath'),
      render: (m) => (
        <code className="font-mono text-xs text-muted-foreground">{m.path || '-'}</code>
      ),
    },
    {
      key: 'sort',
      title: t('colSort'),
      render: (m) => <span className="text-muted-foreground">{m.sort}</span>,
    },
    {
      key: 'parentId',
      title: t('colParent'),
      render: (m) => {
        const parent = list.find((p) => p.id === m.parentId)
        return <span className="text-muted-foreground">{parent?.name ?? t('topMenu')}</span>
      },
    },
    {
      key: 'visible',
      title: t('colVisible'),
      render: (m) => (
        <button onClick={() => onToggleVisible(m)} className="inline-flex items-center gap-1">
          {m.visible ? (
            <Eye className="h-4 w-4 text-emerald-500" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
          <span className={cn('text-xs', m.visible ? 'text-emerald-600' : 'text-muted-foreground')}>
            {m.visible ? t('visible') : t('hidden')}
          </span>
        </button>
      ),
    },
    {
      key: 'actions',
      title: t('colActions'),
      align: 'right',
      render: (m) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => onEdit(m)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onAddChild(m.id)}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={delPending}
            onClick={() => {
              if (confirm(t('confirmDelete'))) onDelete(m)
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={list}
      rowKey={(m) => m.id}
      loading={isLoading}
      pagination={{ page, pageSize: PAGE_SIZE, total }}
      onPageChange={onPageChange}
    />
  )
}
