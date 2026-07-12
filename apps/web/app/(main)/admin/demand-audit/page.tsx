'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, Plus } from 'lucide-react'
import { Button } from '@ihui/ui'
import { DemandAuditFilter } from './DemandAuditFilter'
import { DemandAuditTable } from './DemandAuditTable'
import { DemandAuditEditDialog } from './DemandAuditEditDialog'
import { DemandAuditApprovalDialog } from './DemandAuditApprovalDialog'
import { api } from './helpers'
import type { DemandRow, ListData } from './types'

export default function DemandAuditPage() {
  const t = useTranslations('admin.demandAudit')
  const qc = useQueryClient()
  const [search, setSearch] = React.useState<Record<string, string>>({})
  const [page, setPage] = React.useState(1)
  const [editOpen, setEditOpen] = React.useState(false)
  const [editForm, setEditForm] = React.useState<Record<string, string>>({})
  const [editId, setEditId] = React.useState<string | null>(null)
  const [approvalOpen, setApprovalOpen] = React.useState(false)
  const [approvalRow, setApprovalRow] = React.useState<DemandRow | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'demand-audit', search, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: '20' })
      Object.entries(search)
        .filter(([, v]) => v)
        .forEach(([k, v]) => qs.set(k, v))
      return api<ListData>(`/api/admin/examine?${qs}`)
    },
  })

  const editMut = useMutation({
    mutationFn: () =>
      editId
        ? api(`/api/admin/examine/${editId}`, { method: 'PUT', body: JSON.stringify(editForm) })
        : api('/api/admin/examine', { method: 'POST', body: JSON.stringify(editForm) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'demand-audit'] })
      setEditOpen(false)
    },
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/examine/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'demand-audit'] }),
  })

  function openEdit(row?: DemandRow) {
    setEditId(row?.id ?? null)
    setEditForm(row ? ({ ...row } as Record<string, string>) : {})
    setEditOpen(true)
  }
  function openApproval(row: DemandRow) {
    setApprovalRow(row)
    setApprovalOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => openEdit()}>
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      <DemandAuditFilter
        value={search}
        onChange={(v) => {
          setSearch(v)
          setPage(1)
        }}
      />

      <DemandAuditTable
        list={data?.list ?? []}
        isLoading={isLoading}
        page={page}
        total={data?.total ?? 0}
        onPageChange={setPage}
        onApproval={openApproval}
        onEdit={openEdit}
        onDelete={(id) => delMut.mutate(id)}
      />

      <DemandAuditEditDialog
        open={editOpen}
        editId={editId}
        form={editForm}
        isPending={editMut.isPending}
        onFormChange={setEditForm}
        onClose={() => setEditOpen(false)}
        onSubmit={() => editMut.mutate()}
      />

      <DemandAuditApprovalDialog
        open={approvalOpen}
        row={approvalRow}
        onClose={() => setApprovalOpen(false)}
      />
    </div>
  )
}
