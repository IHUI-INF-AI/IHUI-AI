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
  FileText,
} from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { HasPermi } from '@/components/auth/HasPermi'
import { DatePicker } from '@/components/form/DatePicker'
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

interface PlatformLog {
  id: string
  platformId: string
  courseId: string
  videoId: string
  type: number
  creator: string
  sysCreator: string
  createdAt: string
}
interface CForm {
  platformId: string
  courseId: string
  videoId: string
  type: string
  creator: string
  sysCreator: string
  createdAt: string
}
const EMPTY: CForm = {
  platformId: '',
  courseId: '',
  videoId: '',
  type: '0',
  creator: '',
  sysCreator: '',
  createdAt: '',
}
const PAGE_SIZE = 10
const PERM = 'course:coursePlatformLog:'
const fmt = (s?: string | null) =>
  s
    ? new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(s))
    : '-'

export default function EduCoursePlatformLogPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [q, setQ] = React.useState({
    platformId: '',
    courseId: '',
    videoId: '',
    type: '',
    creator: '',
    createdAt: '',
  })
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PlatformLog | null>(null)
  const [form, setForm] = React.useState<CForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const params = { page, pageSize: PAGE_SIZE, ...q }
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'course-platform-log', params],
    queryFn: () =>
      eduApi<PageData<PlatformLog>>(`/api/admin/course-platform-log${buildQs(params)}`),
  })
  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        platformId: form.platformId,
        courseId: form.courseId,
        videoId: form.videoId,
        type: Number(form.type),
        creator: form.creator,
        sysCreator: form.sysCreator,
        createdAt: form.createdAt || undefined,
      }
      return editing
        ? eduApi(`/api/admin/course-platform-log/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : eduApi(`/api/admin/course-platform-log`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['edu', 'course-platform-log'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      eduApi(`/api/admin/course-platform-log/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['edu', 'course-platform-log'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(r: PlatformLog) {
    setEditing(r)
    setForm({
      platformId: r.platformId,
      courseId: r.courseId,
      videoId: r.videoId,
      type: String(r.type),
      creator: r.creator,
      sysCreator: r.sysCreator,
      createdAt: r.createdAt ? r.createdAt.slice(0, 10) : '',
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
    if (!form.platformId.trim()) return setErr('平台ID不能为空')
    saveMut.mutate()
  }
  function handleExport() {
    exportFromApi(
      `/api/admin/course-platform-log${buildQs({ ...q, pageSize: 10000 })}`,
      `coursePlatformLog_${Date.now()}`,
      [
        { key: 'id', title: 'ID' },
        { key: 'platformId', title: '平台ID' },
        { key: 'courseId', title: '课程ID' },
        { key: 'videoId', title: '视频ID' },
        { key: 'type', title: '类型' },
        { key: 'creator', title: '创建人' },
        { key: 'sysCreator', title: '系统创建人' },
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
        <h1 className="text-2xl font-bold tracking-tight">视频发布平台记录</h1>
        <p className="mt-1 text-sm text-muted-foreground">课程/视频发布到各平台的记录</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="平台ID"
          value={q.platformId}
          onChange={(e) => set('platformId', e.target.value)}
          className={inputCls}
        />
        <Input
          placeholder="课程ID"
          value={q.courseId}
          onChange={(e) => set('courseId', e.target.value)}
          className={inputCls}
        />
        <Input
          placeholder="视频ID"
          value={q.videoId}
          onChange={(e) => set('videoId', e.target.value)}
          className={inputCls}
        />
        <Input
          placeholder="类型"
          value={q.type}
          onChange={(e) => set('type', e.target.value)}
          className={inputCls}
        />
        <Input
          placeholder="创建人"
          value={q.creator}
          onChange={(e) => set('creator', e.target.value)}
          className={inputCls}
        />
        <DatePicker
          value={q.createdAt}
          onChange={(v) => set('createdAt', v)}
          placeholder="创建时间"
          className="w-40"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setQ({
              platformId: '',
              courseId: '',
              videoId: '',
              type: '',
              creator: '',
              createdAt: '',
            })
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
              <TableHead className="px-4 py-2.5">平台ID</TableHead>
              <TableHead className="px-4 py-2.5">课程ID</TableHead>
              <TableHead className="px-4 py-2.5">视频ID</TableHead>
              <TableHead className="px-4 py-2.5">类型</TableHead>
              <TableHead className="px-4 py-2.5">创建人</TableHead>
              <TableHead className="px-4 py-2.5">系统创建人</TableHead>
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
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">{r.id}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.platformId}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.courseId}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.videoId}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.type}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.creator}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.sysCreator}</TableCell>
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
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑平台记录' : '新建平台记录'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>平台ID</Label>
                <Input
                  value={form.platformId}
                  onChange={(e) => setForm({ ...form, platformId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>课程ID</Label>
                <Input
                  value={form.courseId}
                  onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>视频ID</Label>
                <Input
                  value={form.videoId}
                  onChange={(e) => setForm({ ...form, videoId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>类型</Label>
                <Input
                  type="number"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>创建人</Label>
                <Input
                  value={form.creator}
                  onChange={(e) => setForm({ ...form, creator: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>系统创建人</Label>
                <Input
                  value={form.sysCreator}
                  onChange={(e) => setForm({ ...form, sysCreator: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>创建时间</Label>
              <DatePicker
                value={form.createdAt}
                onChange={(v) => setForm({ ...form, createdAt: v })}
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
