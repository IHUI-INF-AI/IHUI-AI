'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  Bot,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { ImageUpload } from '@/components/form/ImageUpload'
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

interface ZhsAgent {
  id: string
  name: string | null
  consume: string | null
  image: string | null
  url: string | null
  info: string | null
  remark: string | null
  seqencing: number | null
  price: string | null
  type: string | null
  typeName: string | null
  isHidden: number | null
  heat: string | null
  field1: string | null
}

interface ListData {
  list: ZhsAgent[]
  total: number
}

const PAGE_SIZE = 10

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const EMPTY = {
  name: '',
  consume: '',
  image: '',
  url: '',
  info: '',
  remark: '',
  seqencing: '0',
  price: '',
  heat: '',
  field1: '',
}

export default function ZhsAgentPage() {
  const qc = useQueryClient()
  const [searchName, setSearchName] = React.useState('')
  const [searchField1, setSearchField1] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ZhsAgent | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(JSON.stringify({ n: searchName, f: searchField1 }))
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [searchName, searchField1])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'zhs-agent', debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (searchName) qs.set('name', searchName)
      if (searchField1) qs.set('field1', searchField1)
      return api<ListData>(`/api/admin/zhs-agent?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        consume: form.consume || undefined,
        image: form.image || undefined,
        url: form.url || undefined,
        info: form.info || undefined,
        remark: form.remark || undefined,
        seqencing: Number(form.seqencing) || 0,
        price: form.price || undefined,
        heat: form.heat || undefined,
        field1: form.field1 || undefined,
      }
      return editing
        ? api(`/api/admin/zhs-agent/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api('/api/admin/zhs-agent', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '新增成功')
      qc.invalidateQueries({ queryKey: ['admin', 'zhs-agent'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/zhs-agent/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'zhs-agent'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: ZhsAgent) {
    setEditing(item)
    setForm({
      name: item.name ?? '',
      consume: item.consume ?? '',
      image: item.image ?? '',
      url: item.url ?? '',
      info: item.info ?? '',
      remark: item.remark ?? '',
      seqencing: String(item.seqencing ?? 0),
      price: item.price ?? '',
      heat: item.heat ?? '',
      field1: item.field1 ?? '',
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
    if (!form.name.trim()) {
      setErr('请输入名称')
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: ZhsAgent) {
    if (!window.confirm(`确认删除 "${item.name}" ?`)) return
    deleteMut.mutate(item.id)
  }
  function handleExport() {
    exportToExcel(
      'ZHS Agent',
      [
        { key: 'id', title: 'ID' },
        { key: 'name', title: '名称' },
        { key: 'consume', title: '消耗' },
        { key: 'image', title: '图片' },
        { key: 'url', title: 'URL' },
        { key: 'info', title: '信息' },
        { key: 'remark', title: '备注' },
        { key: 'seqencing', title: '排序' },
        { key: 'price', title: '价格' },
        { key: 'type', title: '类型' },
        { key: 'typeName', title: '类型名称' },
        { key: 'heat', title: '热度' },
      ],
      (data?.list ?? []) as unknown as Record<string, unknown>[],
    )
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">ZHS Agent管理</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
          <HasPermi code="ai:zhsAgent:add">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新增
            </Button>
          </HasPermi>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder="搜索名称"
            className="h-9 pl-8"
          />
        </div>
        <Input
          value={searchField1}
          onChange={(e) => setSearchField1(e.target.value)}
          placeholder="field1"
          className="h-9 w-40"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">名称</TableHead>
              <TableHead className="px-4 py-2.5">图片</TableHead>
              <TableHead className="px-4 py-2.5">消耗</TableHead>
              <TableHead className="px-4 py-2.5">排序</TableHead>
              <TableHead className="px-4 py-2.5">价格</TableHead>
              <TableHead className="px-4 py-2.5">类型</TableHead>
              <TableHead className="px-4 py-2.5">热度</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中…
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <Bot className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              list.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{item.name || '-'}</TableCell>
                  {}
                  <TableCell className="px-4 py-2.5">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{item.consume || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.seqencing ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.price || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.typeName || item.type || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.heat || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <HasPermi code="ai:zhsAgent:edit">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(item)}
                          title="编辑"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                      <HasPermi code="ai:zhsAgent:remove">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item)}
                          title="删除"
                          className="text-destructive hover:text-destructive"
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

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-lg">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑ZHS Agent' : '新增ZHS Agent'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label>名称 *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>图片</Label>
              <ImageUpload
                value={form.image}
                onChange={(v) => setForm({ ...form, image: v as string })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>消耗</Label>
                <Input
                  value={form.consume}
                  onChange={(e) => setForm({ ...form, consume: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>排序</Label>
                <Input
                  type="number"
                  value={form.seqencing}
                  onChange={(e) => setForm({ ...form, seqencing: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>价格</Label>
                <Input
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>热度</Label>
                <Input
                  value={form.heat}
                  onChange={(e) => setForm({ ...form, heat: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>信息</Label>
              <Input
                value={form.info}
                onChange={(e) => setForm({ ...form, info: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Input
                value={form.remark}
                onChange={(e) => setForm({ ...form, remark: e.target.value })}
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
