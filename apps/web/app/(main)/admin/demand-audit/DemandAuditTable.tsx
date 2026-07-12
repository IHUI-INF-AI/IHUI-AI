'use client'

import { useTranslations } from 'next-intl'
import { Check, Edit, Trash2 } from 'lucide-react'
import { Button } from '@ihui/ui'
import { DataTable, type Column, Badge } from '@/components/data'
import type { DemandRow } from './types'

interface DemandAuditTableProps {
  list: DemandRow[]
  isLoading: boolean
  page: number
  total: number
  onPageChange: (p: number) => void
  onApproval: (row: DemandRow) => void
  onEdit: (row: DemandRow) => void
  onDelete: (id: string) => void
}

export function DemandAuditTable({
  list,
  isLoading,
  page,
  total,
  onPageChange,
  onApproval,
  onEdit,
  onDelete,
}: DemandAuditTableProps) {
  const t = useTranslations('admin.demandAudit')
  const columns: Column<DemandRow>[] = [
    {
      key: 'agentName',
      title: t('colAgentName'),
      render: (d) => <span className="font-medium">{d.agentName || '-'}</span>,
    },
    {
      key: 'startName',
      title: t('colStartName'),
      render: (d) => <span className="text-muted-foreground">{d.startName || '-'}</span>,
    },
    {
      key: 'desc',
      title: t('colDesc'),
      render: (d) => <span className="text-muted-foreground">{(d.desc || '-').slice(0, 30)}</span>,
    },
    {
      key: 'examineTime',
      title: t('colExamineTime'),
      render: (d) => <span className="text-muted-foreground">{d.examineTime || '-'}</span>,
    },
    {
      key: 'status',
      title: t('colStatus'),
      render: (d) => (
        <Badge
          variant={
            d.status === 'approved' ? 'success' : d.status === 'rejected' ? 'danger' : 'warning'
          }
        >
          {d.status === 'approved'
            ? t('statusApproved')
            : d.status === 'rejected'
              ? t('statusRejected')
              : t('statusPending')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      title: t('colActions'),
      align: 'right',
      render: (d) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => onApproval(d)}>
            <Check className="h-4 w-4" />
            {t('approveBtn')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onEdit(d)}>
            <Edit className="h-4 w-4" />
            {t('edit')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              if (confirm(t('deleteConfirm'))) onDelete(d.id)
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
      rowKey={(d) => d.id}
      loading={isLoading}
      pagination={{ page, pageSize: 20, total }}
      onPageChange={onPageChange}
    />
  )
}
