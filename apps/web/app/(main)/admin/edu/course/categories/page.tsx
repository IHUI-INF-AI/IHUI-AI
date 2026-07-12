'use client'

import * as React from 'react'
import Link from 'next/link'
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
  FolderTree,
} from 'lucide-react'
import { eduApi, buildQs, selectClass, type PageData } from '@/lib/edu'
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
  Checkbox,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'

interface Category {
  id: string
  code: string
  name: string
  prentId?: string
  typeId?: string
  img?: string
  butImg?: string
  isInvalid?: number
  sort?: number
  creator?: string
  createdTime?: string
}
interface CForm {
  code: string
  name: string
  prentId: string
  typeId: string
  img: string
  butImg: string
  isInvalid: string
  sort: string
}
const EMPTY: CForm = {
  code: '',
  name: '',
  prentId: '',
  typeId: '',
  img: '',
  butImg: '',
  isInvalid: '0',
  sort: '0',
}
const PAGE_SIZE = 10
const PERM = 'course:categorydictionary:'
const API = '/api/admin/category-dictionary'

export default function EduCourseCategoriesPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [q, setQ] = React.useState({ code: '', name: '', prentId: '' })
  const [ids, setIds] = React.useState<string[]>([])
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Category | null>(null)
  const [form, setForm] = React.useState<CForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const params = { page, pageSize: PAGE_SIZE, ...q }
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'category-dictionary', params],
    queryFn: () => eduApi<PageData<Category>>(`${API}${buildQs(params)}`),
  })
  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        code: form.code.trim(),
        name: form.name.trim(),
        prentId: form.prentId.trim() || null,
        typeId: form.typeId.trim() || null,
        img: form.img || null,
        butImg: form.butImg || null,
        isInvalid: Number(form.isInvalid),
        sort: Number(form.sort) || 0,
      }
      return editing
        ? eduApi(`${API}/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : eduApi(API, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['edu', 'category-dictionary'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`${API}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['edu', 'category-dictionary'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const batchDeleteMut = useMutation({
    mutationFn: (ids: string[]) => eduApi(`${API}/${ids.join(',')}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('批量删除成功')
      setIds([])
      qc.invalidateQueries({ queryKey: ['edu', 'category-dictionary'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(r: Category) {
    setEditing(r)
    setForm({
      code: r.code ?? '',
      name: r.name ?? '',
      prentId: r.prentId ?? '',
      typeId: r.typeId ?? '',
      img: r.img ?? '',
      butImg: r.butImg ?? '',
      isInvalid: String(r.isInvalid ?? 0),
      sort: String(r.sort ?? 0),
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
    if (!form.typeId.trim()) return setErr('类型ID不能为空')
    saveMut.mutate()
  }
  function handleExport() {
    exportFromApi(
      `${API}${buildQs({ ...q, pageSize: 10000 })}`,
      `categoryDictionary_${Date.now()}`,
      [
        { key: 'id', title: 'ID' },
        { key: 'code', title: '编码' },
        { key: 'name', title: '名称' },
        { key: 'prentId', title: '父ID' },
        { key: 'typeId', title: '类型ID' },
        { key: 'sort', title: '排序' },
        { key: 'creator', title: '创建人' },
      ],
    ).then((ok) => toast[ok ? 'success' : 'error'](ok ? '导出成功' : '导出失败'))
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []
  const allChecked = rows.length > 0 && rows.every((r) => ids.includes(r.id))
  function toggleAll() {
    setIds(allChecked ? [] : rows.map((r) => r.id))
  }
  function toggleOne(id: string) {
    setIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }
  const inputCls = 'h-9 w-36'
  const COLSPAN = 11

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">课程分类字典</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理课程分类字典编码、图片与层级</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/course">
            <ChevronLeft className="h-4 w-4" />
            返回课程管理
          </Link>
        </Button>
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
        <Input
          placeholder="父ID"
          value={q.prentId}
          onChange={(e) => {
            setQ({ ...q, prentId: e.target.value })
            setPage(1)
          }}
          className={inputCls}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setQ({ code: '', name: '', prentId: '' })
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
          <HasPermi code={`${PERM}remove`}>
            <Button
              variant="outline"
              size="sm"
              disabled={ids.length === 0}
              onClick={() => {
                if (window.confirm(`确定删除选中的 ${ids.length} 项？`)) batchDeleteMut.mutate(ids)
              }}
            >
              <Trash2 className="h-4 w-4" />
              批量删除
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
              <TableHead className="px-3 py-2.5 w-10">
                <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead className="px-4 py-2.5">ID</TableHead>
              <TableHead className="px-4 py-2.5">编码</TableHead>
              <TableHead className="px-4 py-2.5">名称</TableHead>
              <TableHead className="px-4 py-2.5">父ID</TableHead>
              <TableHead className="px-4 py-2.5">类型ID</TableHead>
              <TableHead className="px-4 py-2.5">图片</TableHead>
              <TableHead className="px-4 py-2.5">按钮图</TableHead>
              <TableHead className="px-4 py-2.5">排序</TableHead>
              <TableHead className="px-4 py-2.5">创建人</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={COLSPAN}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={COLSPAN}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  <FolderTree className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell className="px-3 py-2.5">
                    <Checkbox
                      checked={ids.includes(r.id)}
                      onCheckedChange={() => toggleOne(r.id)}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                    {r.id}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{r.code}</TableCell>
                  <TableCell className="px-4 py-2.5 font-medium">{r.name}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.prentId ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.typeId ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    {r.img ? (
                      <img src={r.img} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    {r.butImg ? (
                      <img src={r.butImg} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{r.sort ?? 0}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.creator ?? '-'}</TableCell>
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
        <DialogContent className="max-w-xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑分类字典' : '新建分类字典'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cd-code">编码 *</Label>
                <Input
                  id="cd-code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cd-name">名称</Label>
                <Input
                  id="cd-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cd-prentId">父ID</Label>
                <Input
                  id="cd-prentId"
                  value={form.prentId}
                  onChange={(e) => setForm({ ...form, prentId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cd-typeId">类型ID *</Label>
                <Input
                  id="cd-typeId"
                  value={form.typeId}
                  onChange={(e) => setForm({ ...form, typeId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cd-sort">排序</Label>
                <Input
                  id="cd-sort"
                  type="number"
                  min="0"
                  value={form.sort}
                  onChange={(e) => setForm({ ...form, sort: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cd-isInvalid">是否失效</Label>
                <Select
                  value={form.isInvalid}
                  onValueChange={(v) => setForm({ ...form, isInvalid: v })}
                >
                  <SelectTrigger className={selectClass} id="cd-isInvalid">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">有效</SelectItem>
                    <SelectItem value="1">失效</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>图片</Label>
              <ImageUpload
                value={form.img}
                onChange={(v) => setForm({ ...form, img: v as string })}
              />
            </div>
            <div className="space-y-2">
              <Label>按钮图</Label>
              <ImageUpload
                value={form.butImg}
                onChange={(v) => setForm({ ...form, butImg: v as string })}
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
