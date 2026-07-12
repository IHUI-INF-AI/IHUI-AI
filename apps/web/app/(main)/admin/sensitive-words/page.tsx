'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@ihui/ui'

import { SensitiveWordsTable } from './SensitiveWordsTable'
import { SensitiveWordDialog } from './SensitiveWordDialog'
import { api, EMPTY } from './helpers'
import type { SensitiveWord, SensitiveWordForm } from './types'

export default function SensitiveWordsPage() {
  const t = useTranslations('admin.sensitiveWords')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [currentPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<SensitiveWord | null>(null)
  const [form, setForm] = React.useState<SensitiveWordForm>(EMPTY)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'sensitive-words', currentPage],
    queryFn: () => api<{ list: SensitiveWord[] }>('/api/admin/sensitive-words'),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        word: form.word,
        category: form.category,
        level: form.level,
        replacement: form.replacement || undefined,
        status: form.status,
      }
      return editing
        ? api<SensitiveWord>(`/api/admin/sensitive-words/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : api<SensitiveWord>('/api/admin/sensitive-words', {
            method: 'POST',
            body: JSON.stringify(body),
          })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sensitive-words'] })
      toast.success(editing ? '更新成功' : '创建成功')
      close()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api<void>(`/api/admin/sensitive-words/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sensitive-words'] })
      toast.success('删除成功')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  function openEdit(item: SensitiveWord) {
    setEditing(item)
    setForm({
      word: item.word,
      category: item.category,
      level: item.level,
      replacement: item.replacement ?? '',
      status: item.status,
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
    if (!form.word.trim()) {
      toast.error('请输入敏感词')
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: SensitiveWord) {
    if (!confirm('确认删除该敏感词？')) return
    deleteMut.mutate(item.id)
  }

  const list = data?.list ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {tc('create')}
        </Button>
      </div>

      <SensitiveWordsTable
        list={list}
        isLoading={isLoading}
        onEdit={openEdit}
        onDelete={handleDelete}
        deletePending={deleteMut.isPending}
      />

      <SensitiveWordDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={close}
      />
    </div>
  )
}
