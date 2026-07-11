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
  Building2,
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

interface Organization {
  id: string
  uuid: string
  platformId: string
  name: string
  remark?: string
  filePath?: string
  binding?: string
  creator?: string
  createdAt: string
  updator?: string
}
interface CForm {
  uuid: string
  platformId: string
  name: string
  remark: string
  filePath: string
  binding: string
}
const EMPTY: CForm = { uuid: '', platformId: '', name: '', remark: '', filePath: '', binding: '' }
const PAGE_SIZE = 10
const PERM = 'course:organization:'
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

export default function EduOrganizationPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [q, setQ] = React.useState({ platformId: '', name: '' })
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Organization | null>(null)
  const [form, setForm] = React.useState<CForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const params = { page, pageSize: PAGE_SIZE, ...q }
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'organization', params],
    queryFn: () => eduApi<PageData<Organization>>(`/api/admin/organization${buildQs(params)}`),
  })
  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        uuid: form.uuid || undefined,
        platformId: form.platformId,
        name: form.name,
        remark: form.remark || undefined,
        filePath: form.filePath || undefined,
        binding: form.binding || undefined,
      }
      return editing
        ? eduApi(`/api/admin/organization/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : eduApi(`/api/admin/organization`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['edu', 'organization'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/organization/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['edu', 'organization'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(r: Organization) {
    setEditing(r)
    setForm({
      uuid: r.uuid,
      platformId: r.platformId,
      name: r.name,
      remark: r.remark ?? '',
      filePath: r.filePath ?? '',
      binding: r.binding ?? '',
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
    if (!form.name.trim()) return setErr('名称不能为空')
    if (!form.platformId.trim()) return setErr('平台ID不能为空')
    saveMut.mutate()
  }
  function handleExport() {
    exportFromApi(
      `/api/admin/organization${buildQs({ ...q, pageSize: 10000 })}`,
      `organization_${Date.now()}`,
      [
        { key: 'id', title: 'ID' },
        { key: 'uuid', title: 'UUID' },
        { key: 'platformId', title: '平台ID' },
        { key: 'name', title: '名称' },
        { key: 'remark', title: '备注' },
        { key: 'filePath', title: '文件路径' },
        { key: 'creator', title: '创建人' },
        { key: 'createdAt', title: '创建时间' },
      ],
    ).then((ok) => toast[ok ? 'success' : 'error'](ok ? '导出成功' : '导出失败'))
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []
  const inputCls = 'h-9 w-40'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">平台组织</h1>
        <p className="mt-1 text-sm text-muted-foreground">教育平台下的组织机构管理</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="平台ID"
          value={q.platformId}
          onChange={(e) => {
            setQ({ ...q, platformId: e.target.value })
            setPage(1)
          }}
          className={inputCls}
        />
        <Input
          placeholder="名称"
          value={q.name}
          onChange={(e) => {
            setQ({ ...q, name: e.target.value })
            setPage(1)
          }}
          className={inputCls}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setQ({ platformId: '', name: '' })
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
              <TableHead className="px-4 py-2.5">平台ID</TableHead>
              <TableHead className="px-4 py-2.5">名称</TableHead>
              <TableHead className="px-4 py-2.5">图片</TableHead>
              <TableHead className="px-4 py-2.5">创建人</TableHead>
              <TableHead className="px-4 py-2.5">创建时间</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <Building2 className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">{r.id}</TableCell>
                  <TableCell className="px-4 py-2.5 font-medium">{r.uuid}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.platformId}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.name}</TableCell>
                  {}
                  <TableCell className="px-4 py-2.5">
                    {r.binding ? (
                      <img src={r.binding} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      '-'
                    )}
                  </TableCell>
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
              <DialogTitle>{editing ? '编辑组织' : '新建组织'}</DialogTitle>
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
                <Label>平台ID</Label>
                <Input
                  value={form.platformId}
                  onChange={(e) => setForm({ ...form, platformId: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>名称</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
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
              <Label>文件路径</Label>
              <Input
                value={form.filePath}
                onChange={(e) => setForm({ ...form, filePath: e.target.value })}
                placeholder="文件URL"
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
