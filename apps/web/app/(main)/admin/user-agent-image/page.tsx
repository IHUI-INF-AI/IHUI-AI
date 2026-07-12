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
  Image as ImageIcon,
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

interface UserAgentImage {
  id: string
  userUuid: string | null
  imagePath: string | null
  imageName: string | null
  type: string | null
  platform: string | null
  modelName: string | null
  createdAt: string | null
  updatedAt: string | null
}

interface ListData {
  list: UserAgentImage[]
  total: number
}

const PAGE_SIZE = 10

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const EMPTY = { userUuid: '', imagePath: '', imageName: '', type: '', platform: '', modelName: '' }

export default function UserAgentImagePage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState({
    userUuid: '',
    imageName: '',
    platform: '',
    modelName: '',
  })
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<UserAgentImage | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(JSON.stringify(search))
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'user-agent-image', debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (search.userUuid) qs.set('userUuid', search.userUuid)
      if (search.imageName) qs.set('imageName', search.imageName)
      if (search.platform) qs.set('platform', search.platform)
      if (search.modelName) qs.set('modelName', search.modelName)
      return api<ListData>(`/api/admin/user-agent-image?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        userUuid: form.userUuid.trim(),
        imagePath: form.imagePath || undefined,
        imageName: form.imageName || undefined,
        type: form.type || undefined,
        platform: form.platform || undefined,
        modelName: form.modelName || undefined,
      }
      return editing
        ? api(`/api/admin/user-agent-image/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : api('/api/admin/user-agent-image', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '新增成功')
      qc.invalidateQueries({ queryKey: ['admin', 'user-agent-image'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/user-agent-image/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'user-agent-image'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: UserAgentImage) {
    setEditing(item)
    setForm({
      userUuid: item.userUuid ?? '',
      imagePath: item.imagePath ?? '',
      imageName: item.imageName ?? '',
      type: item.type ?? '',
      platform: item.platform ?? '',
      modelName: item.modelName ?? '',
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
    if (!form.userUuid.trim()) {
      setErr('请输入用户UUID')
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: UserAgentImage) {
    if (!window.confirm(`确认删除 "${item.imageName || item.id}" ?`)) return
    deleteMut.mutate(item.id)
  }
  function handleExport() {
    exportToExcel(
      '用户Agent图片',
      [
        { key: 'id', title: 'ID' },
        { key: 'userUuid', title: '用户UUID' },
        { key: 'imagePath', title: '图片路径' },
        { key: 'imageName', title: '图片名称' },
        { key: 'type', title: '类型' },
        { key: 'platform', title: '平台' },
        { key: 'modelName', title: '模型名称' },
        { key: 'createdAt', title: '创建时间' },
        { key: 'updatedAt', title: '更新时间' },
      ],
      (data?.list ?? []) as unknown as Record<string, unknown>[],
    )
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const sch = (k: keyof typeof search) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSearch({ ...search, [k]: e.target.value })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">用户Agent图片</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
          <HasPermi code="ai:useragentimage:add">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新增
            </Button>
          </HasPermi>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search.userUuid}
          onChange={sch('userUuid')}
          placeholder="用户UUID"
          className="h-9 w-40"
        />
        <Input
          value={search.imageName}
          onChange={sch('imageName')}
          placeholder="图片名称"
          className="h-9 w-40"
        />
        <Input
          value={search.platform}
          onChange={sch('platform')}
          placeholder="平台"
          className="h-9 w-32"
        />
        <Input
          value={search.modelName}
          onChange={sch('modelName')}
          placeholder="模型名称"
          className="h-9 w-40"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">用户UUID</TableHead>
              <TableHead className="px-4 py-2.5">图片</TableHead>
              <TableHead className="px-4 py-2.5">图片名称</TableHead>
              <TableHead className="px-4 py-2.5">类型</TableHead>
              <TableHead className="px-4 py-2.5">平台</TableHead>
              <TableHead className="px-4 py-2.5">模型</TableHead>
              <TableHead className="px-4 py-2.5">创建时间</TableHead>
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
                  <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              list.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{item.userUuid || '-'}</TableCell>
                  {}
                  <TableCell className="px-4 py-2.5">
                    {item.imagePath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imagePath} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{item.imageName || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.type || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.platform || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.modelName || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {item.createdAt || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <HasPermi code="ai:useragentimage:edit">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(item)}
                          title="编辑"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                      <HasPermi code="ai:useragentimage:remove">
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
              <DialogTitle>{editing ? '编辑用户Agent图片' : '新增用户Agent图片'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label>用户UUID *</Label>
              <Input
                value={form.userUuid}
                onChange={(e) => setForm({ ...form, userUuid: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>图片</Label>
              <ImageUpload
                value={form.imagePath}
                onChange={(v) => setForm({ ...form, imagePath: v as string })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>图片名称</Label>
                <Input
                  value={form.imageName}
                  onChange={(e) => setForm({ ...form, imageName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>类型</Label>
                <Input
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>平台</Label>
                <Input
                  value={form.platform}
                  onChange={(e) => setForm({ ...form, platform: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>模型名称</Label>
                <Input
                  value={form.modelName}
                  onChange={(e) => setForm({ ...form, modelName: e.target.value })}
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
