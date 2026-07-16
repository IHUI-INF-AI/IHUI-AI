'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Plus, Users } from 'lucide-react'
import {
  Button,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'
import { PAGE_SIZE, selectClass, EMPTY_FORM, api, fetchGroups, groupToForm } from './helpers'
import { MemberGroupDialog } from './MemberGroupDialog'
import { MemberGroupsTable } from './MemberGroupsTable'
import { MembersDialog } from './MembersDialog'
import type { GroupForm, MemberGroup } from './types'

const TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'custom', label: '自定义' },
  { value: 'team', label: '团队' },
  { value: 'class', label: '班级' },
]

export default function AdminMemberGroupsPage() {
  const qc = useQueryClient()
  const [type, setType] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<MemberGroup | null>(null)
  const [form, setForm] = React.useState<GroupForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)
  const [delId, setDelId] = React.useState<string | null>(null)
  const [membersGroup, setMembersGroup] = React.useState<MemberGroup | null>(null)

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['admin', 'member-groups', type],
    queryFn: () => fetchGroups(type || undefined),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        type: form.type.trim() || 'custom',
        description: form.description.trim() || undefined,
      }
      return editing
        ? api(`/api/groups/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : api('/api/groups', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['admin', 'member-groups'] })
      close()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'member-groups'] })
      setDelId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: MemberGroup) {
    setEditing(item)
    setForm(groupToForm(item))
    setErr(null)
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.name.trim()) return setErr('名称为必填项')
    saveMut.mutate()
  }

  const total = list.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageList = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  React.useEffect(() => {
    if (page > totalPages) setPage(1)
  }, [page, totalPages])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Users className="h-6 w-6 text-primary" />
          会员分组
        </h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          新建分组
        </Button>
      </div>

      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">类型</Label>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value)
              setPage(1)
            }}
            className={selectClass}
            style={{ width: '160px' }}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <MemberGroupsTable
        list={pageList}
        isLoading={isLoading}
        onEdit={openEdit}
        onDelete={(id) => setDelId(id)}
        onMembers={setMembersGroup}
      />

      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            共 {total} 条 · {page}/{totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              上一页
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      )}

      <MemberGroupDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        err={err}
        savePending={saveMut.isPending}
        onSubmit={submit}
        onClose={close}
      />

      <Dialog open={delId !== null} onOpenChange={(o) => (o ? null : setDelId(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>确定要删除该分组吗？此操作不可撤销。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDelId(null)}
              disabled={delMut.isPending}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={delMut.isPending}
              onClick={() => delId && delMut.mutate(delId)}
            >
              {delMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MembersDialog group={membersGroup} onClose={() => setMembersGroup(null)} />
    </div>
  )
}
