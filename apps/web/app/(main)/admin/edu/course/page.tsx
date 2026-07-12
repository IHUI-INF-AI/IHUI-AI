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
  BookOpen,
  Video,
  CreditCard,
} from 'lucide-react'
import { eduApi, buildQs, selectClass, type PageData } from '@/lib/edu'
import { cn } from '@/lib/utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { ImageUpload } from '@/components/form/ImageUpload'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
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

interface Course {
  id: string
  title: string
  subtitle?: string
  content?: string
  remark?: string
  remarkFile?: string
  binding?: string
  stage?: number
  label?: string
  auditStatus?: number
  creator?: string
  nickname?: string
}
interface CForm {
  title: string
  subtitle: string
  content: string
  remark: string
  remarkFile: string
  binding: string
  stage: string
  label: string
  creator: string
}
const EMPTY: CForm = {
  title: '',
  subtitle: '',
  content: '',
  remark: '',
  remarkFile: '',
  binding: '',
  stage: '0',
  label: '',
  creator: '',
}
const PAGE_SIZE = 10
const PERM = 'course:course:'
const API = '/api/admin/course'
const STAGE_TEXT = ['初级', '中级', '高级']
const AUDIT_TEXT = ['待审核', '审核中', '待整改', '已驳回', '已通过']
const badgeCls = (ok: boolean) =>
  cn(
    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
    ok
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
      : 'bg-muted text-muted-foreground',
  )

export default function EduCoursePage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [q, setQ] = React.useState({ title: '', stage: '', label: '', creator: '' })
  const [ids, setIds] = React.useState<string[]>([])
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Course | null>(null)
  const [form, setForm] = React.useState<CForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const params = { page, pageSize: PAGE_SIZE, ...q }
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'course', params],
    queryFn: () => eduApi<PageData<Course>>(`${API}${buildQs(params)}`),
  })
  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        content: form.content,
        remark: form.remark.trim() || null,
        remarkFile: form.remarkFile.trim() || null,
        binding: form.binding || null,
        stage: Number(form.stage),
        label: form.label.trim() || null,
        creator: form.creator.trim() || null,
      }
      return editing
        ? eduApi(`${API}/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : eduApi(API, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['edu', 'course'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`${API}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['edu', 'course'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const batchDeleteMut = useMutation({
    mutationFn: (ids: string[]) => eduApi(`${API}/${ids.join(',')}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('批量删除成功')
      setIds([])
      qc.invalidateQueries({ queryKey: ['edu', 'course'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(r: Course) {
    setEditing(r)
    setForm({
      title: r.title ?? '',
      subtitle: r.subtitle ?? '',
      content: r.content ?? '',
      remark: r.remark ?? '',
      remarkFile: r.remarkFile ?? '',
      binding: r.binding ?? '',
      stage: String(r.stage ?? 0),
      label: r.label ?? '',
      creator: r.creator ?? '',
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
    if (!form.title.trim()) return setErr('标题不能为空')
    saveMut.mutate()
  }
  function handleExport() {
    exportFromApi(`${API}${buildQs({ ...q, pageSize: 10000 })}`, `course_${Date.now()}`, [
      { key: 'id', title: 'ID' },
      { key: 'title', title: '标题' },
      { key: 'subtitle', title: '副标题' },
      { key: 'stage', title: '阶段', formatter: (v) => STAGE_TEXT[Number(v)] ?? String(v) },
      { key: 'label', title: '标签' },
      {
        key: 'auditStatus',
        title: '审核状态',
        formatter: (v) => AUDIT_TEXT[Number(v)] ?? String(v),
      },
      { key: 'creator', title: '创建人' },
    ]).then((ok) => toast[ok ? 'success' : 'error'](ok ? '导出成功' : '导出失败'))
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
  const inputCls = 'h-9 w-32'
  const COLSPAN = 13

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">课程管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">课程 CRUD、视频与价格管理</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu">
            <ChevronLeft className="h-4 w-4" />
            返回教育后台
          </Link>
        </Button>
        <Input
          placeholder="标题"
          value={q.title}
          onChange={(e) => {
            setQ({ ...q, title: e.target.value })
            setPage(1)
          }}
          className={inputCls}
        />
        <div className="w-28">
          <Select
            value={q.stage || 'all'}
            onValueChange={(v) => {
              setQ({ ...q, stage: v === 'all' ? '' : v })
              setPage(1)
            }}
          >
            <SelectTrigger className={selectClass}>
              <SelectValue placeholder="阶段" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部阶段</SelectItem>
              <SelectItem value="0">初级</SelectItem>
              <SelectItem value="1">中级</SelectItem>
              <SelectItem value="2">高级</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          placeholder="标签"
          value={q.label}
          onChange={(e) => {
            setQ({ ...q, label: e.target.value })
            setPage(1)
          }}
          className={inputCls}
        />
        <Input
          placeholder="创建人"
          value={q.creator}
          onChange={(e) => {
            setQ({ ...q, creator: e.target.value })
            setPage(1)
          }}
          className={inputCls}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setQ({ title: '', stage: '', label: '', creator: '' })
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
              <TableHead className="px-4 py-2.5">标题</TableHead>
              <TableHead className="px-4 py-2.5">副标题</TableHead>
              <TableHead className="px-4 py-2.5">内容</TableHead>
              <TableHead className="px-4 py-2.5">备注</TableHead>
              <TableHead className="px-4 py-2.5">备注文件</TableHead>
              <TableHead className="px-4 py-2.5">封面</TableHead>
              <TableHead className="px-4 py-2.5">阶段</TableHead>
              <TableHead className="px-4 py-2.5">标签</TableHead>
              <TableHead className="px-4 py-2.5">审核</TableHead>
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
                  <BookOpen className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无课程
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
                  <TableCell className="px-4 py-2.5 font-medium">{r.title}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs">{r.subtitle ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <div
                      className="max-w-[120px] truncate text-xs text-muted-foreground"
                      title={r.content}
                    >
                      {r.content ?? '-'}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <div
                      className="max-w-[120px] truncate text-xs text-muted-foreground"
                      title={r.remark}
                    >
                      {r.remark ?? '-'}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs">{r.remarkFile ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    {r.binding ? (
                      <img src={r.binding} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span className={badgeCls(r.stage === 2)}>
                      {STAGE_TEXT[r.stage ?? 0] ?? String(r.stage)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs">{r.label ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span className={badgeCls(r.auditStatus === 4)}>
                      {AUDIT_TEXT[r.auditStatus ?? 0] ?? String(r.auditStatus)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs">
                    {r.nickname ?? r.creator ?? '-'}
                  </TableCell>
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
                      <Button asChild variant="ghost" size="sm" title="视频管理">
                        <Link href={`/admin/edu/learn/recorded?courseId=${r.id}`}>
                          <Video className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm" title="价格管理">
                        <Link href={`/admin/edu/course/pay?courseId=${r.id}`}>
                          <CreditCard className="h-4 w-4" />
                        </Link>
                      </Button>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑课程' : '新建课程'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="c-title">标题 *</Label>
                <Input
                  id="c-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-subtitle">副标题</Label>
                <Input
                  id="c-subtitle"
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-stage">阶段</Label>
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                  <SelectTrigger className={selectClass} id="c-stage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">初级</SelectItem>
                    <SelectItem value="1">中级</SelectItem>
                    <SelectItem value="2">高级</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-label">标签</Label>
                <Input
                  id="c-label"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-remarkFile">备注文件</Label>
                <Input
                  id="c-remarkFile"
                  value={form.remarkFile}
                  onChange={(e) => setForm({ ...form, remarkFile: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-creator">创建人</Label>
                <Input
                  id="c-creator"
                  value={form.creator}
                  onChange={(e) => setForm({ ...form, creator: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-remark">备注</Label>
              <textarea
                id="c-remark"
                value={form.remark}
                onChange={(e) => setForm({ ...form, remark: e.target.value })}
                className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>封面图</Label>
              <ImageUpload
                value={form.binding}
                onChange={(v) => setForm({ ...form, binding: v as string })}
              />
            </div>
            <div className="space-y-2">
              <Label>内容</Label>
              <RichTextEditor
                value={form.content}
                onChange={(html) => setForm({ ...form, content: html })}
                placeholder="请输入课程内容"
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
