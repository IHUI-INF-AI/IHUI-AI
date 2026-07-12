'use client'

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
  const columns: Column<DemandRow>[] = [
    {
      key: 'agentName',
      title: 'Agent名称',
      render: (d) => <span className="font-medium">{d.agentName || '-'}</span>,
    },
    {
      key: 'startName',
      title: '发起人',
      render: (d) => <span className="text-muted-foreground">{d.startName || '-'}</span>,
    },
    {
      key: 'desc',
      title: '描述',
      render: (d) => <span className="text-muted-foreground">{(d.desc || '-').slice(0, 30)}</span>,
    },
    {
      key: 'examineTime',
      title: '审核时间',
      render: (d) => <span className="text-muted-foreground">{d.examineTime || '-'}</span>,
    },
    {
      key: 'status',
      title: '状态',
      render: (d) => (
        <Badge
          variant={
            d.status === 'approved' ? 'success' : d.status === 'rejected' ? 'danger' : 'warning'
          }
        >
          {d.status === 'approved' ? '已通过' : d.status === 'rejected' ? '已驳回' : '待审核'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      align: 'right',
      render: (d) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => onApproval(d)}>
            <Check className="h-4 w-4" />
            审批
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onEdit(d)}>
            <Edit className="h-4 w-4" />
            编辑
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              if (confirm('确认删除?')) onDelete(d.id)
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
