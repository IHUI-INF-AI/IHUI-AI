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
  Globe,
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
  Switch,
} from '@ihui/ui'

interface EduPlatform {
  id: string
  code: string
  name: string
  domain?: string
  remark?: string
  binding?: string
  filePath?: string
  type?: number
  status: number
  sort?: number
  creator?: string
  createdAt: string
  updator?: string
  field1?: string
  field2?: string
}
interface CForm {
  code: string
  name: string
  domain: string
  remark: string
  binding: string
  filePath: string
  type: string
  status: boolean
  sort: string
  field1: string
  field2: string
}
const EMPTY: CForm = {
  code: '',
  name: '',
  domain: '',
  remark: '',
  binding: '',
  filePath: '',
  type: '0',
  status: true,
  sort: '0',
  field1: '',
  field2: '',
}
const PAGE_SIZE = 10
const PERM = 'course:educationPlatform:'
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

export default function EduPlatformPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [q, setQ] = React.useState({ code: '', name: '' })
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<EduPlatform | null>(null)
  const [form, setForm] = React.useState<CForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const params = { page, pageSize: PAGE_SIZE, ...q }
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'platform', params],
    queryFn: () => eduApi<PageData<EduPlatform>>(`/api/admin/education-platform${buildQs(params)}`),
  })
  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        code: form.code,
        name: form.name,
        domain: form.domain || undefined,
        remark: form.remark || undefined,
        binding: form.binding || undefined,
        filePath: form.filePath || undefined,
        type: Number(form.type),
        status: form.status ? 1 : 0,
        sort: Number(form.sort) || 0,
        field1: form.field1 || undefined,
        field2: form.field2 || undefined,
      }
      return editing
        ? eduApi(`/api/admin/education-platform/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : eduApi(`/api/admin/education-platform`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['edu', 'platform'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/education-platform/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['edu', 'platform'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(r: EduPlatform) {
    setEditing(r)
    setForm({
      code: r.code,
      name: r.name,
      domain: r.domain ?? '',
      remark: r.remark ?? '',
      binding: r.binding ?? '',
      filePath: r.filePath ?? '',
      type: String(r.type ?? 0),
      status: r.status === 1,
      sort: String(r.sort ?? 0),
      field1: r.field1 ?? '',
      field2: r.field2 ?? '',
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
    if (!form.code.trim()) return setErr('编码不能为空')
    if (!form.name.trim()) return setErr('名称不能为空')
    saveMut.mutate()
  }
  function handleExport() {
    exportFromApi(
      `/api/admin/education-platform${buildQs({ ...q, pageSize: 10000 })}`,
      `educationPlatform_${Date.now()}`,
      [
        { key: 'id', title: 'ID' },
        { key: 'code', title: '编码' },
        { key: 'name', title: '名称' },
        { key: 'domain', title: '域名' },
        { key: 'type', title: '类型' },
        { key: 'status', title: '状态' },
        { key: 'sort', title: '排序' },
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
        <h1 className="text-2xl font-bold tracking-tight">平台发布管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">教育平台发布与绑定管理</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="编码"
          value={q.code}
          onChange={(e) => {
            setQ({ ...q, code: e.target.value })
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
            setQ({ code: '', name: '' })
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
              <TableHead className="px-4 py-2.5">编码</TableHead>
              <TableHead className="px-4 py-2.5">名称</TableHead>
              <TableHead className="px-4 py-2.5">域名</TableHead>
              <TableHead className="px-4 py-2.5">图片</TableHead>
              <TableHead className="px-4 py-2.5">类型</TableHead>
              <TableHead className="px-4 py-2.5">排序</TableHead>
              <TableHead className="px-4 py-2.5">创建人</TableHead>
              <TableHead className="px-4 py-2.5">创建时间</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={9} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  <Globe className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{r.code}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.name}</TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {r.domain ?? '-'}
                  </TableCell>
                  {}
                  <TableCell className="px-4 py-2.5">
                    {r.binding ? (
                      <img src={r.binding} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{r.type ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.sort ?? 0}</TableCell>
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
              <DialogTitle>{editing ? '编辑平台' : '新建平台'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>编码</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>名称</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>域名</Label>
              <Input
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
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
              <Label>图片</Label>
              <ImageUpload
                value={form.binding}
                onChange={(v) => setForm({ ...form, binding: v as string })}
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
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>类型</Label>
                <Input
                  type="number"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>排序</Label>
                <Input
                  type="number"
                  value={form.sort}
                  onChange={(e) => setForm({ ...form, sort: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>状态</Label>
                <div className="flex h-9 items-center gap-2">
                  <Switch
                    checked={form.status}
                    onCheckedChange={(v) => setForm({ ...form, status: v })}
                  />
                  <span className="text-sm text-muted-foreground">
                    {form.status ? '启用' : '禁用'}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>扩展字段1</Label>
                <Input
                  value={form.field1}
                  onChange={(e) => setForm({ ...form, field1: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>扩展字段2</Label>
                <Input
                  value={form.field2}
                  onChange={(e) => setForm({ ...form, field2: e.target.value })}
                />
              </div>
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
