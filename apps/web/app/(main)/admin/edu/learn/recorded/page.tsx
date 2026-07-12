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
  FileStack,
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

interface Video {
  id: string
  courseId?: string
  binding?: string
  videoPath?: string
  title?: string
  subtitle?: string
  content?: string
  remark?: string
  lecturer?: string
  duration?: string
  adjunctUrl?: string
  isPay?: number
  amount?: string
  label?: string
  agentIds?: string
  hot?: number
  collect?: number
  status?: number
  auditStatus?: number
  sort?: number
  creator?: string
  nickname?: string
}
interface CForm {
  courseId: string
  videoPath: string
  title: string
  subtitle: string
  lecturer: string
  duration: string
  adjunctUrl: string
  amount: string
  label: string
  agentIds: string
  hot: string
  collect: string
  sort: string
  creator: string
  binding: string
  content: string
  remark: string
  isPay: string
  status: string
  auditStatus: string
}
const EMPTY: CForm = {
  courseId: '',
  videoPath: '',
  title: '',
  subtitle: '',
  lecturer: '',
  duration: '',
  adjunctUrl: '',
  amount: '0',
  label: '',
  agentIds: '',
  hot: '0',
  collect: '0',
  sort: '0',
  creator: '',
  binding: '',
  content: '',
  remark: '',
  isPay: '0',
  status: '0',
  auditStatus: '0',
}
const TEXT_FIELDS: { key: keyof CForm; label: string }[] = [
  { key: 'courseId', label: '课程ID' },
  { key: 'videoPath', label: '视频路径' },
  { key: 'title', label: '标题' },
  { key: 'subtitle', label: '副标题' },
  { key: 'lecturer', label: '讲师' },
  { key: 'duration', label: '时长' },
  { key: 'adjunctUrl', label: '附件URL' },
  { key: 'amount', label: '金额' },
  { key: 'label', label: '标签' },
  { key: 'agentIds', label: '代理IDs' },
  { key: 'hot', label: '热度' },
  { key: 'collect', label: '收藏' },
  { key: 'sort', label: '排序' },
  { key: 'creator', label: '创建人' },
]
const PAGE_SIZE = 10
const PERM = 'course:coursevideo:'
const API = '/api/admin/course-video'
const LEVEL_TEXT = ['初级', '中级', '高级']
const AUDIT_TEXT = ['待审核', '审核中', '待整改', '已驳回', '已通过']
const badgeCls = (ok: boolean) =>
  cn(
    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
    ok
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
      : 'bg-muted text-muted-foreground',
  )

export default function EduLearnRecordedPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [urlCourseId] = React.useState(() =>
    typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('courseId') ?? '')
      : '',
  )
  const [q, setQ] = React.useState({ title: '', label: '', creator: '' })
  const [ids, setIds] = React.useState<string[]>([])
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Video | null>(null)
  const [form, setForm] = React.useState<CForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const params = { page, pageSize: PAGE_SIZE, courseId: urlCourseId, ...q }
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'course-video', params],
    queryFn: () => eduApi<PageData<Video>>(`${API}${buildQs(params)}`),
  })
  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        courseId: form.courseId.trim() || null,
        videoPath: form.videoPath.trim() || null,
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        content: form.content,
        remark: form.remark,
        lecturer: form.lecturer.trim() || null,
        duration: form.duration.trim() || null,
        adjunctUrl: form.adjunctUrl.trim() || null,
        isPay: Number(form.isPay),
        amount: form.amount,
        label: form.label.trim() || null,
        agentIds: form.agentIds.trim() || null,
        hot: Number(form.hot) || 0,
        collect: Number(form.collect) || 0,
        sort: Number(form.sort) || 0,
        creator: form.creator.trim() || null,
        binding: form.binding || null,
        status: Number(form.status),
        auditStatus: Number(form.auditStatus),
      }
      return editing
        ? eduApi(`${API}/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : eduApi(API, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['edu', 'course-video'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`${API}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['edu', 'course-video'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const batchDeleteMut = useMutation({
    mutationFn: (ids: string[]) => eduApi(`${API}/${ids.join(',')}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('批量删除成功')
      setIds([])
      qc.invalidateQueries({ queryKey: ['edu', 'course-video'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY, courseId: urlCourseId })
    setErr(null)
    setOpen(true)
  }
  function openEdit(r: Video) {
    setEditing(r)
    setForm({
      courseId: r.courseId ?? '',
      videoPath: r.videoPath ?? '',
      title: r.title ?? '',
      subtitle: r.subtitle ?? '',
      lecturer: r.lecturer ?? '',
      duration: r.duration ?? '',
      adjunctUrl: r.adjunctUrl ?? '',
      amount: r.amount ?? '0',
      label: r.label ?? '',
      agentIds: r.agentIds ?? '',
      hot: String(r.hot ?? 0),
      collect: String(r.collect ?? 0),
      sort: String(r.sort ?? 0),
      creator: r.creator ?? '',
      binding: r.binding ?? '',
      content: r.content ?? '',
      remark: r.remark ?? '',
      isPay: String(r.isPay ?? 0),
      status: String(r.status ?? 0),
      auditStatus: String(r.auditStatus ?? 0),
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
    exportFromApi(
      `${API}${buildQs({ ...q, courseId: urlCourseId, pageSize: 10000 })}`,
      `courseVideo_${Date.now()}`,
      [
        { key: 'id', title: 'ID' },
        { key: 'courseId', title: '课程ID' },
        { key: 'title', title: '标题' },
        { key: 'lecturer', title: '讲师' },
        { key: 'duration', title: '时长' },
        { key: 'isPay', title: '付费', formatter: (v) => (Number(v) === 1 ? '付费' : '免费') },
        { key: 'amount', title: '金额' },
        { key: 'label', title: '标签' },
        { key: 'hot', title: '热度' },
        { key: 'status', title: '难度', formatter: (v) => LEVEL_TEXT[Number(v)] ?? String(v) },
        { key: 'auditStatus', title: '审核', formatter: (v) => AUDIT_TEXT[Number(v)] ?? String(v) },
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
  const inputCls = 'h-9 w-32'
  const COLSPAN = 14

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">课程视频</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理课程视频、审核与付费信息</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/learn">
            <ChevronLeft className="h-4 w-4" />
            返回学习管理
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
            setQ({ title: '', label: '', creator: '' })
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
              <TableHead className="px-4 py-2.5">课程ID</TableHead>
              <TableHead className="px-4 py-2.5">封面</TableHead>
              <TableHead className="px-4 py-2.5">标题</TableHead>
              <TableHead className="px-4 py-2.5">讲师</TableHead>
              <TableHead className="px-4 py-2.5">时长</TableHead>
              <TableHead className="px-4 py-2.5">付费</TableHead>
              <TableHead className="px-4 py-2.5">金额</TableHead>
              <TableHead className="px-4 py-2.5">标签</TableHead>
              <TableHead className="px-4 py-2.5">难度</TableHead>
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
                  <FileStack className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无视频
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
                  <TableCell className="px-4 py-2.5 text-xs">{r.courseId ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    {r.binding ? (
                      <img src={r.binding} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 font-medium">{r.title}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs">{r.lecturer ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs">{r.duration ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span className={badgeCls(r.isPay === 1)}>
                      {r.isPay === 1 ? '付费' : '免费'}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs">{r.amount ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs">{r.label ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span className={badgeCls(r.status === 2)}>
                      {LEVEL_TEXT[r.status ?? 0] ?? String(r.status)}
                    </span>
                  </TableCell>
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
              <DialogTitle>{editing ? '编辑课程视频' : '新建课程视频'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {TEXT_FIELDS.map((f) => (
                <div key={f.key} className="space-y-2">
                  <Label>{f.label}</Label>
                  <Input
                    value={form[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>付费</Label>
                <Select value={form.isPay} onValueChange={(v) => setForm({ ...form, isPay: v })}>
                  <SelectTrigger className={selectClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">免费</SelectItem>
                    <SelectItem value="1">付费</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>状态</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className={selectClass}>
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
                <Label>审核</Label>
                <Select
                  value={form.auditStatus}
                  onValueChange={(v) => setForm({ ...form, auditStatus: v })}
                >
                  <SelectTrigger className={selectClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">待审核</SelectItem>
                    <SelectItem value="1">审核中</SelectItem>
                    <SelectItem value="2">待整改</SelectItem>
                    <SelectItem value="3">已驳回</SelectItem>
                    <SelectItem value="4">已通过</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                placeholder="请输入视频内容"
              />
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <RichTextEditor
                value={form.remark}
                onChange={(html) => setForm({ ...form, remark: html })}
                placeholder="请输入备注"
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
