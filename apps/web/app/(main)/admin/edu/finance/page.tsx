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
  Wallet,
} from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
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
  Checkbox,
} from '@ihui/ui'

interface PayLog {
  id: string
  userUuid: string
  courseId?: string
  videoId?: string
  outBillOn?: string
  payWay?: string
  amount?: string
  realAmount?: string
  type?: number
  createdAt?: string
}
interface CForm {
  userUuid: string
  courseId: string
  videoId: string
  outBillOn: string
  payWay: string
  amount: string
  realAmount: string
}
const EMPTY: CForm = {
  userUuid: '',
  courseId: '',
  videoId: '',
  outBillOn: '',
  payWay: '',
  amount: '0',
  realAmount: '0',
}
const PAGE_SIZE = 10
const PERM = 'course:coursepaylog:'
const API = '/api/admin/course-pay-log'

export default function EduFinancePage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [q, setQ] = React.useState({
    userUuid: '',
    courseId: '',
    videoId: '',
    outBillOn: '',
    payWay: '',
  })
  const [ids, setIds] = React.useState<string[]>([])
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PayLog | null>(null)
  const [form, setForm] = React.useState<CForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const params = { page, pageSize: PAGE_SIZE, ...q }
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'course-pay-log', params],
    queryFn: () => eduApi<PageData<PayLog>>(`${API}${buildQs(params)}`),
  })
  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        userUuid: form.userUuid.trim(),
        courseId: form.courseId.trim() || null,
        videoId: form.videoId.trim() || null,
        outBillOn: form.outBillOn || null,
        payWay: form.payWay.trim() || null,
        amount: form.amount,
        realAmount: form.realAmount,
      }
      return editing
        ? eduApi(`${API}/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : eduApi(API, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['edu', 'course-pay-log'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`${API}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['edu', 'course-pay-log'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const batchDeleteMut = useMutation({
    mutationFn: (ids: string[]) => eduApi(`${API}/${ids.join(',')}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('批量删除成功')
      setIds([])
      qc.invalidateQueries({ queryKey: ['edu', 'course-pay-log'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(r: PayLog) {
    setEditing(r)
    setForm({
      userUuid: r.userUuid ?? '',
      courseId: r.courseId ?? '',
      videoId: r.videoId ?? '',
      outBillOn: r.outBillOn ?? '',
      payWay: r.payWay ?? '',
      amount: r.amount ?? '0',
      realAmount: r.realAmount ?? '0',
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
    if (!form.userUuid.trim()) return setErr('用户UUID不能为空')
    if (!form.outBillOn) return setErr('账单日期不能为空')
    saveMut.mutate()
  }
  function handleExport() {
    exportFromApi(`${API}${buildQs({ ...q, pageSize: 10000 })}`, `coursePayLog_${Date.now()}`, [
      { key: 'id', title: 'ID' },
      { key: 'userUuid', title: '用户UUID' },
      { key: 'courseId', title: '课程ID' },
      { key: 'videoId', title: '视频ID' },
      { key: 'outBillOn', title: '账单日期' },
      { key: 'payWay', title: '支付方式' },
      { key: 'amount', title: '金额' },
      { key: 'realAmount', title: '实付金额' },
      { key: 'type', title: '类型' },
      { key: 'createdAt', title: '创建时间' },
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
  const COLSPAN = 11

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">课程支付日志</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理课程支付记录与账单</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu">
            <ChevronLeft className="h-4 w-4" />
            返回教育后台
          </Link>
        </Button>
        <Input
          placeholder="用户UUID"
          value={q.userUuid}
          onChange={(e) => {
            setQ({ ...q, userUuid: e.target.value })
            setPage(1)
          }}
          className={inputCls}
        />
        <Input
          placeholder="课程ID"
          value={q.courseId}
          onChange={(e) => {
            setQ({ ...q, courseId: e.target.value })
            setPage(1)
          }}
          className={inputCls}
        />
        <Input
          placeholder="视频ID"
          value={q.videoId}
          onChange={(e) => {
            setQ({ ...q, videoId: e.target.value })
            setPage(1)
          }}
          className={inputCls}
        />
        <Input
          type="date"
          placeholder="账单日期"
          value={q.outBillOn}
          onChange={(e) => {
            setQ({ ...q, outBillOn: e.target.value })
            setPage(1)
          }}
          className={inputCls}
        />
        <Input
          placeholder="支付方式"
          value={q.payWay}
          onChange={(e) => {
            setQ({ ...q, payWay: e.target.value })
            setPage(1)
          }}
          className={inputCls}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setQ({ userUuid: '', courseId: '', videoId: '', outBillOn: '', payWay: '' })
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
              <TableHead className="px-4 py-2.5">用户UUID</TableHead>
              <TableHead className="px-4 py-2.5">课程ID</TableHead>
              <TableHead className="px-4 py-2.5">视频ID</TableHead>
              <TableHead className="px-4 py-2.5">账单日期</TableHead>
              <TableHead className="px-4 py-2.5">支付方式</TableHead>
              <TableHead className="px-4 py-2.5">金额</TableHead>
              <TableHead className="px-4 py-2.5">实付</TableHead>
              <TableHead className="px-4 py-2.5">创建时间</TableHead>
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
                  <Wallet className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无支付记录
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
                  <TableCell className="px-4 py-2.5 text-xs font-mono">{r.userUuid}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs">{r.courseId ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs">{r.videoId ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs">{r.outBillOn ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs">{r.payWay ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 font-semibold">{r.amount ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 font-semibold text-emerald-600">
                    {r.realAmount ?? '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}
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
        <DialogContent className="max-w-xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑支付日志' : '新建支付日志'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="pl-user">用户UUID *</Label>
                <Input
                  id="pl-user"
                  value={form.userUuid}
                  onChange={(e) => setForm({ ...form, userUuid: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pl-course">课程ID</Label>
                <Input
                  id="pl-course"
                  value={form.courseId}
                  onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pl-video">视频ID</Label>
                <Input
                  id="pl-video"
                  value={form.videoId}
                  onChange={(e) => setForm({ ...form, videoId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pl-outBillOn">账单日期 *</Label>
                <Input
                  id="pl-outBillOn"
                  type="date"
                  value={form.outBillOn}
                  onChange={(e) => setForm({ ...form, outBillOn: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pl-payWay">支付方式</Label>
                <Input
                  id="pl-payWay"
                  value={form.payWay}
                  onChange={(e) => setForm({ ...form, payWay: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pl-amount">金额</Label>
                <Input
                  id="pl-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pl-realAmount">实付金额</Label>
                <Input
                  id="pl-realAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.realAmount}
                  onChange={(e) => setForm({ ...form, realAmount: e.target.value })}
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
