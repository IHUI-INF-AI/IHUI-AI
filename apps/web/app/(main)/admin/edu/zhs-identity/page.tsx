'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  BadgeCheck,
} from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { HasPermi } from '@/components/auth/HasPermi'
import { ImageUpload } from '@/components/form/ImageUpload'
import { exportFromApi } from '@/lib/export-utils'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
} from '@ihui/ui'

interface ZhsIdentity {
  id: string
  uuid: string
  name: string
  platformId: string
  organizationId: string
  parentId?: string
  remark?: string
  binding?: string
  isCross?: number
  creator?: string
  createdAt: string
  updator?: string
}
interface CForm {
  uuid: string
  name: string
  platformId: string
  organizationId: string
  parentId: string
  remark: string
  binding: string
  isCross: string
}
const EMPTY: CForm = {
  uuid: '',
  name: '',
  platformId: '',
  organizationId: '',
  parentId: '',
  remark: '',
  binding: '',
  isCross: '0',
}
const PAGE_SIZE = 10
const PERM = 'course:zhsIdentity:'
const fmt = (s?: string | null) =>
  s
    ? new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(s))
    : '-'
const textareaCls =
  'flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function EduZhsIdentityPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [q, setQ] = React.useState({ uuid: '', name: '', platformId: '', organizationId: '' })
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ZhsIdentity | null>(null)
  const [form, setForm] = React.useState<CForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const params = { page, pageSize: PAGE_SIZE, ...q }
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'zhs-identity', params],
    queryFn: () => eduApi<PageData<ZhsIdentity>>(`/api/admin/zhs-identity${buildQs(params)}`),
  })
  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        uuid: form.uuid,
        name: form.name,
        platformId: form.platformId,
        organizationId: form.organizationId,
        parentId: form.parentId || undefined,
        remark: form.remark || undefined,
        binding: form.binding || undefined,
        isCross: Number(form.isCross),
      }
      return editing
        ? eduApi(`/api/admin/zhs-identity/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : eduApi(`/api/admin/zhs-identity`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['edu', 'zhs-identity'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/zhs-identity/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['edu', 'zhs-identity'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(r: ZhsIdentity) {
    setEditing(r)
    setForm({
      uuid: r.uuid,
      name: r.name,
      platformId: r.platformId,
      organizationId: r.organizationId,
      parentId: r.parentId ?? '',
      remark: r.remark ?? '',
      binding: r.binding ?? '',
      isCross: String(r.isCross ?? 0),
    })
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
    if (!form.uuid.trim()) return setErr('UUID不能为空')
    if (!form.platformId.trim()) return setErr('平台ID不能为空')
    saveMut.mutate()
  }
  function handleExport() {
    exportFromApi(
      `/api/admin/zhs-identity${buildQs({ ...q, pageSize: 10000 })}`,
      `zhsIdentity_${Date.now()}`,
      [
        { key: 'id', title: 'ID' },
        { key: 'uuid', title: 'UUID' },
        { key: 'name', title: '名称' },
        { key: 'platformId', title: '平台ID' },
        { key: 'organizationId', title: '组织ID' },
        { key: 'parentId', title: '父级ID' },
        { key: 'isCross', title: '是否跨组织' },
        { key: 'creator', title: '创建人' },
        { key: 'createdAt', title: '创建时间' },
      ],
    ).then((ok) => toast[ok ? 'success' : 'error'](ok ? '导出成功' : '导出失败'))
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []
  const set = (k: keyof typeof q, v: string) => {
    setQ({ ...q, [k]: v })
    setPage(1)
  }
  const inputCls = 'h-9 w-36'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">平台身份</h1>
        <p className="mt-1 text-sm text-muted-foreground">教育平台身份标识管理</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="UUID"
          value={q.uuid}
          onChange={(e) => set('uuid', e.target.value)}
          className={inputCls}
        />
        <Input
          placeholder="名称"
          value={q.name}
          onChange={(e) => set('name', e.target.value)}
          className={inputCls}
        />
        <Input
          placeholder="平台ID"
          value={q.platformId}
          onChange={(e) => set('platformId', e.target.value)}
          className={inputCls}
        />
        <Input
          placeholder="组织ID"
          value={q.organizationId}
          onChange={(e) => set('organizationId', e.target.value)}
          className={inputCls}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setQ({ uuid: '', name: '', platformId: '', organizationId: '' })
            setPage(1)
          }}
        >
          重置
        </Button>
        <div className="ml-auto flex gap-2">
          <HasPermi code={`${PERM}add`}>
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4" />
              新建
            </Button>
          </HasPermi>
          <HasPermi code={`${PERM}export`}>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              导出
            </Button>
          </HasPermi>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">ID</TableHead>
              <TableHead className="px-4 py-2.5">UUID</TableHead>
              <TableHead className="px-4 py-2.5">名称</TableHead>
              <TableHead className="px-4 py-2.5">平台ID</TableHead>
              <TableHead className="px-4 py-2.5">组织ID</TableHead>
              <TableHead className="px-4 py-2.5">图片</TableHead>
              <TableHead className="px-4 py-2.5">跨组织</TableHead>
              <TableHead className="px-4 py-2.5">创建人</TableHead>
              <TableHead className="px-4 py-2.5">创建时间</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={10} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  <BadgeCheck className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">{r.id}</TableCell>
                  <TableCell className="px-4 py-2.5 font-medium">{r.uuid}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.name}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.platformId}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.organizationId}</TableCell>
                  {}
                  <TableCell className="px-4 py-2.5">
                    {r.binding ? (
                      <img src={r.binding} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{r.isCross === 1 ? '是' : '否'}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.creator ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{fmt(r.createdAt)}</TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <HasPermi code={`${PERM}edit`}>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(r)} title="编辑">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                      <HasPermi code={`${PERM}remove`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (window.confirm('确定删除？')) deleteMut.mutate(r.id)
                          }}
                          title="删除"
                          className="text-destructive hover:text-destructive"
                          disabled={deleteMut.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
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
            第 {page} / {totalPages} 页
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
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑平台身份' : '新建平台身份'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>UUID</Label>
                <Input
                  value={form.uuid}
                  onChange={(e) => setForm({ ...form, uuid: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>名称</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>平台ID</Label>
                <Input
                  value={form.platformId}
                  onChange={(e) => setForm({ ...form, platformId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>组织ID</Label>
                <Input
                  value={form.organizationId}
                  onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>父级ID</Label>
                <Input
                  value={form.parentId}
                  onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>是否跨组织</Label>
                <Input
                  type="number"
                  value={form.isCross}
                  onChange={(e) => setForm({ ...form, isCross: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <textarea
                className={textareaCls}
                value={form.remark}
                onChange={(e) => setForm({ ...form, remark: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>图片</Label>
              <ImageUpload
                value={form.binding}
                onChange={(v) => setForm({ ...form, binding: v as string })}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={saveMut.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
