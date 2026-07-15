'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

import { Button } from '@ihui/ui'
import { Alert } from '@/components/feedback'

import { VariableTable } from './VariableTable'
import { VariableDialog } from './VariableDialog'
import { EMPTY_VARIABLE_FORM, api } from './helpers'
import type { Variable, VariableForm } from './types'

export default function AdminVariablesPage() {
  const t = useTranslations('common')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Variable | null>(null)
  const [form, setForm] = React.useState<VariableForm>(EMPTY_VARIABLE_FORM)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'coze-variables'],
    queryFn: () =>
      api<{ list: Variable[]; total: number }>('/api/coze/variables/list?pageSize=100'),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        botId: form.botId,
        variableName: form.variableName,
        variableValue: form.variableValue || null,
        description: form.description || null,
        dataType: form.dataType,
      }
      return editing
        ? api<Variable>('/api/coze/variables/update', {
            method: 'POST',
            body: JSON.stringify({ id: editing.id, ...body }),
          })
        : api<Variable>('/api/coze/variables/create', {
            method: 'POST',
            body: JSON.stringify(body),
          })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'coze-variables'] })
      toast.success(editing ? '更新成功' : '创建成功')
      close()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      api<void>('/api/coze/variables/delete', {
        method: 'POST',
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'coze-variables'] })
      toast.success('删除成功')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_VARIABLE_FORM)
    setOpen(true)
  }
  function openEdit(item: Variable) {
    setEditing(item)
    setForm({
      botId: item.botId,
      variableName: item.variableName,
      variableValue: item.variableValue ?? '',
      description: item.description ?? '',
      dataType: item.dataType ?? 'string',
    })
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.botId.trim() || !form.variableName.trim()) {
      toast.error('Bot ID 和变量名为必填')
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: Variable) {
    if (!confirm(`确认删除变量 "${item.variableName}"?`)) return
    deleteMut.mutate(item.id)
  }

  const list = data?.list ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">变量管理</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      {isError && <Alert variant="danger" description={(error as Error).message} />}

      <VariableTable
        list={list}
        isLoading={isLoading}
        deletePending={deleteMut.isPending}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <VariableDialog
        open={open}
        editing={!!editing}
        form={form}
        submitting={saveMut.isPending}
        onClose={close}
        onChange={setForm}
        onSubmit={submit}
      />
    </div>
  )
}
