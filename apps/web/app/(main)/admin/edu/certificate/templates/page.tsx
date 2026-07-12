'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Loader2, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { eduApi, buildQs, textareaClass, type PageData } from '@/lib/edu'
import { cn } from '@/lib/utils'
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

interface Template {
  id: string
  name: string
  description: string | null
  backgroundImage: string | null
  templateConfig: Record<string, unknown> | null
  status: number
  createdAt: string
}
interface TForm {
  name: string
  description: string
  backgroundImage: string
  templateConfig: string
  status: boolean
}
const EMPTY: TForm = {
  name: '',
  description: '',
  backgroundImage: '',
  templateConfig: '',
  status: true,
}
const PAGE_SIZE = 10

export default function EduCertificateTemplatesPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Template | null>(null)
  const [form, setForm] = React.useState<TForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'cert', 'templates', page],
    queryFn: () =>
      eduApi<PageData<Template>>(
        `/api/admin/certificates/templates${buildQs({ page, pageSize: PAGE_SIZE })}`,
      ),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      let templateConfig: Record<string, unknown> | undefined
      const raw = form.templateConfig.trim()
      if (raw) {
        try {
          templateConfig = JSON.parse(raw)
        } catch {
          throw new Error('模板配置JSON格式错误')
        }
      }
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        backgroundImage: form.backgroundImage.trim() || undefined,
        templateConfig,
        status: form.status ? 1 : 0,
      }
      if (editing)
        return eduApi(`/api/admin/certificates/templates/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      return eduApi(`/api/admin/certificates/templates`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['edu', 'cert', 'templates'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      eduApi(`/api/admin/certificates/templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['edu', 'cert', 'templates'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(t: Template) {
    setEditing(t)
    setForm({
      name: t.name,
      description: t.description ?? '',
      backgroundImage: t.backgroundImage ?? '',
      templateConfig: t.templateConfig ? JSON.stringify(t.templateConfig, null, 2) : '',
      status: t.status === 1,
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
    saveMut.mutate()
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">证书模板</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理证书模板样式</p>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/certificate">
            <ChevronLeft className="h-4 w-4" />
            返回证书管理
          </Link>
        </Button>
        <Button onClick={openCreate} size="sm" className="ml-auto">
          <Plus className="h-4 w-4" />
          新建模板
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">名称</TableHead>
              <TableHead className="px-4 py-2.5">描述</TableHead>
              <TableHead className="px-4 py-2.5">状态</TableHead>
              <TableHead className="px-4 py-2.5">创建时间</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无模板
                </TableCell>
              </TableRow>
            ) : (
              rows.map((t) => {
                const enabled = t.status === 1
                return (
                  <TableRow key={t.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5 font-medium">{t.name}</TableCell>
                    <TableCell className="px-4 py-2.5">
                      <div className="max-w-xs break-words text-xs text-muted-foreground">
                        {t.description ?? '-'}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          enabled
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            enabled ? 'bg-emerald-500' : 'bg-muted-foreground',
                          )}
                        />
                        {enabled ? '启用' : '禁用'}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(t)} title="编辑">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (window.confirm('确定删除？')) deleteMut.mutate(t.id)
                          }}
                          title="删除"
                          className="text-destructive hover:text-destructive"
                          disabled={deleteMut.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
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
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑模板' : '新建模板'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="tpl-name">名称</Label>
              <Input
                id="tpl-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-desc">描述</Label>
              <textarea
                id="tpl-desc"
                className={textareaClass}
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-bg">背景图片</Label>
              <Input
                id="tpl-bg"
                value={form.backgroundImage}
                onChange={(e) => setForm({ ...form, backgroundImage: e.target.value })}
                placeholder="背景图片URL（选填）"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-config">模板配置 (JSON)</Label>
              <textarea
                id="tpl-config"
                className={cn(textareaClass, 'font-mono')}
                rows={4}
                value={form.templateConfig}
                onChange={(e) => setForm({ ...form, templateConfig: e.target.value })}
                placeholder='{"fields":["name","title"]}'
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="tpl-status"
                checked={form.status}
                onCheckedChange={(v) => setForm({ ...form, status: v })}
              />
              <Label htmlFor="tpl-status">启用</Label>
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
