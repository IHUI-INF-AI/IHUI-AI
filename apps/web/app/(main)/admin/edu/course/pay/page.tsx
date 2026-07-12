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
  CreditCard,
} from 'lucide-react'
import { eduApi, buildQs, selectClass, type PageData } from '@/lib/edu'
import { cn } from '@/lib/utils'
import { HasPermi } from '@/components/auth/HasPermi'
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
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'

interface CoursePay {
  id: string
  courseId: string
  title?: string
  payType: number
  payCrowd: number
  amount: string
  creator?: string
  nickname?: string
}
interface CForm {
  courseId: string
  payType: string
  payCrowd: string
  amount: string
}
const EMPTY: CForm = { courseId: '', payType: '0', payCrowd: '0', amount: '0' }
const PAGE_SIZE = 10
const PERM = 'course:coursepay:'
const payTypeText = (n: number) =>
  n === 0 ? '免费' : n === 1 ? '限免' : n === 2 ? '付费' : String(n)
const payCrowdText = (n: number) => (n === 0 ? '全部' : n === 1 ? '会员' : String(n))

export default function EduCoursePayPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [q, setQ] = React.useState({ payCrowd: '', creator: '' })
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<CoursePay | null>(null)
  const [form, setForm] = React.useState<CForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const params = { page, pageSize: PAGE_SIZE, ...q }
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'course-pay', params],
    queryFn: () => eduApi<PageData<CoursePay>>(`/api/admin/course-pay${buildQs(params)}`),
  })
  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        courseId: form.courseId,
        payType: Number(form.payType),
        payCrowd: Number(form.payCrowd),
        amount: form.amount,
      }
      return editing
        ? eduApi(`/api/admin/course-pay/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : eduApi(`/api/admin/course-pay`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['edu', 'course-pay'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/course-pay/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['edu', 'course-pay'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(r: CoursePay) {
    setEditing(r)
    setForm({
      courseId: r.courseId,
      payType: String(r.payType),
      payCrowd: String(r.payCrowd),
      amount: r.amount,
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
    if (!form.courseId.trim()) return setErr('课程ID不能为空')
    saveMut.mutate()
  }
  function handleExport() {
    exportFromApi(
      `/api/admin/course-pay${buildQs({ ...q, pageSize: 10000 })}`,
      `coursePay_${Date.now()}`,
      [
        { key: 'id', title: 'ID' },
        { key: 'courseId', title: '课程ID' },
        { key: 'title', title: '课程名称' },
        { key: 'payType', title: '付费类型', formatter: (v) => payTypeText(Number(v)) },
        { key: 'payCrowd', title: '付费人群', formatter: (v) => payCrowdText(Number(v)) },
        { key: 'amount', title: '金额' },
        { key: 'creator', title: '创建人' },
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
        <h1 className="text-2xl font-bold tracking-tight">课程付费</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理课程付费类型与人群</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="付费人群"
          value={q.payCrowd}
          onChange={(e) => {
            setQ({ ...q, payCrowd: e.target.value })
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
            setQ({ payCrowd: '', creator: '' })
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
              <TableHead className="px-4 py-2.5">课程名称</TableHead>
              <TableHead className="px-4 py-2.5">付费类型</TableHead>
              <TableHead className="px-4 py-2.5">付费人群</TableHead>
              <TableHead className="px-4 py-2.5">金额</TableHead>
              <TableHead className="px-4 py-2.5">创建人</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <CreditCard className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">{r.id}</TableCell>
                  <TableCell className="px-4 py-2.5 font-medium">{r.title ?? r.courseId}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        r.payType === 0
                          ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                          : r.payType === 2
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
                      )}
                    >
                      {payTypeText(r.payType)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{payCrowdText(r.payCrowd)}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.amount}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.nickname ?? r.creator ?? '-'}</TableCell>
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
              <DialogTitle>{editing ? '编辑课程付费' : '新建课程付费'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="cp-course">课程ID</Label>
              <Input
                id="cp-course"
                value={form.courseId}
                onChange={(e) => setForm({ ...form, courseId: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cp-type">付费类型</Label>
                <Select
                  value={form.payType}
                  onValueChange={(v) => setForm({ ...form, payType: v })}
                >
                  <SelectTrigger className={selectClass} id="cp-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">免费</SelectItem>
                    <SelectItem value="1">限免</SelectItem>
                    <SelectItem value="2">付费</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cp-crowd">付费人群</Label>
                <Select
                  value={form.payCrowd}
                  onValueChange={(v) => setForm({ ...form, payCrowd: v })}
                >
                  <SelectTrigger className={selectClass} id="cp-crowd">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">全部</SelectItem>
                    <SelectItem value="1">会员</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cp-amount">金额</Label>
              <Input
                id="cp-amount"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
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
