'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, ChevronLeft, ChevronRight, Download } from 'lucide-react'

import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui-react'

import { UserAgentAudioFilter } from './UserAgentAudioFilter'
import { UserAgentAudioTable } from './UserAgentAudioTable'
import { UserAgentAudioDialog } from './UserAgentAudioDialog'
import { PAGE_SIZE, api, EMPTY_FORM, EMPTY_SEARCH, EXPORT_COLUMNS, audioToForm } from './helpers'
import type { UserAgentAudio, UserAgentAudioForm, UserAgentAudioSearch, ListData } from './types'

export default function UserAgentAudioPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState<UserAgentAudioSearch>(EMPTY_SEARCH)
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<UserAgentAudio | null>(null)
  const [form, setForm] = React.useState<UserAgentAudioForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(JSON.stringify(search))
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'user-agent-audio', debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (search.uuid) qs.set('uuid', search.uuid)
      if (search.audioId) qs.set('audioId', search.audioId)
      if (search.agentId) qs.set('agentId', search.agentId)
      if (search.source) qs.set('source', search.source)
      if (search.platform) qs.set('platform', search.platform)
      return api<ListData>(`/api/admin/user-agent-audio?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        uuid: form.uuid.trim(),
        audioId: form.audioId.trim(),
        agentId: form.agentId.trim(),
        audioPath: form.audioPath || undefined,
        source: form.source || undefined,
        platform: form.platform || undefined,
      }
      return editing
        ? api(`/api/admin/user-agent-audio/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : api('/api/admin/user-agent-audio', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '新增成功')
      qc.invalidateQueries({ queryKey: ['admin', 'user-agent-audio'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/user-agent-audio/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'user-agent-audio'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: UserAgentAudio) {
    setEditing(item)
    setForm(audioToForm(item))
    setErr(null)
    setOpen(true)
  }
  function closeDialog() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.uuid.trim()) {
      setErr('请输入用户UUID')
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: UserAgentAudio) {
    if (!window.confirm(`确认删除 "${item.uuid}" ?`)) return
    deleteMut.mutate(item.id)
  }
  function handleExport() {
    exportToExcel(
      '用户Agent音频',
      EXPORT_COLUMNS,
      (data?.list ?? []) as unknown as Record<string, unknown>[],
    )
  }
  function onSearchChange(patch: Partial<UserAgentAudioSearch>) {
    setSearch({ ...search, ...patch })
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">用户Agent音频</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
          <HasPermi code="slave:useragentaudit:add">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新增
            </Button>
          </HasPermi>
        </div>
      </div>

      <UserAgentAudioFilter search={search} onSearchChange={onSearchChange} />

      <UserAgentAudioTable
        list={list}
        isLoading={isLoading}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <UserAgentAudioDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        err={err}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={closeDialog}
      />
    </div>
  )
}
