'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, ChevronLeft, ChevronRight, Download, ClipboardCheck, Eye } from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
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
} from '@ihui/ui'

interface Audit {
  id: string
  type: number
  operate: string
  sourceId: string
  targetId: string
  status: number
  creator?: string
  createdAt: string
  updator?: string
  remark?: string
}
type Snapshot = Record<string, unknown>
const PAGE_SIZE = 10
const PERM = 'course:courseAudit:'
const fmt = (s?: string | null) =>
  s
    ? new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(s))
    : '-'
const statusText = (n: number) =>
  n === 0 ? '待审核' : n === 1 ? '待整改' : n === 3 ? '已通过' : String(n)
const statusClass = (n: number) =>
  n === 3
    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
    : n === 1
      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
      : 'bg-muted text-muted-foreground'

const COURSE_FIELDS: [string, string][] = [
  ['title', '标题'],
  ['subtitle', '副标题'],
  ['content', '内容'],
  ['remark', '备注'],
  ['remarkFile', '备注文件'],
  ['binding', '绑定'],
  ['stage', '阶段'],
  ['isHidden', '是否隐藏'],
  ['sort', '排序'],
  ['createdAt', '创建时间'],
  ['updatedAt', '更新时间'],
]
const VIDEO_FIELDS: [string, string][] = [
  ['courseId', '课程ID'],
  ['binding', '绑定'],
  ['videoPath', '视频路径'],
  ['title', '标题'],
  ['subtitle', '副标题'],
  ['content', '内容'],
  ['remark', '备注'],
  ['duration', '时长'],
  ['adjunctUrl', '附件'],
  ['isPay', '是否付费'],
  ['amount', '金额'],
  ['status', '状态'],
  ['sort', '排序'],
  ['createdAt', '创建时间'],
  ['updatedAt', '更新时间'],
]

function CompareRow({ label, before, after }: { label: string; before: unknown; after: unknown }) {
  const b = before === null || before === undefined || before === '' ? '-' : String(before)
  const a = after === null || after === undefined || after === '' ? '-' : String(after)
  const diff = b !== a
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-muted/40 py-1.5 text-sm">
      <div className="font-medium text-muted-foreground">{label}</div>
      <div
        className={cn(
          'break-words',
          diff && 'rounded bg-red-500/5 px-1 text-red-600 dark:text-red-400',
        )}
      >
        {b}
      </div>
      <div
        className={cn(
          'break-words',
          diff && 'rounded bg-emerald-500/5 px-1 text-emerald-600 dark:text-emerald-400',
        )}
      >
        {a}
      </div>
    </div>
  )
}

export default function EduCourseAuditPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [q, setQ] = React.useState({ operate: '', sourceId: '', creator: '' })
  const [compareOpen, setCompareOpen] = React.useState(false)
  const [compareType, setCompareType] = React.useState(0)
  const [compareData, setCompareData] = React.useState<{ before: Snapshot; after: Snapshot }>({
    before: {},
    after: {},
  })
  const [compareRemark, setCompareRemark] = React.useState('')
  const [currentId, setCurrentId] = React.useState<string | null>(null)
  const [loadingCompare, setLoadingCompare] = React.useState(false)

  const params = { page, pageSize: PAGE_SIZE, ...q }
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'course-audit', params],
    queryFn: () => eduApi<PageData<Audit>>(`/api/admin/course-audit${buildQs(params)}`),
  })
  const auditMut = useMutation({
    mutationFn: (args: { id: string; status: number; remark: string }) =>
      eduApi(`/api/admin/course-audit/${args.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: args.status, remark: args.remark }),
      }),
    onSuccess: (_d, vars) => {
      toast.success(vars.status === 3 ? '已通过审核' : '已提交整改')
      qc.invalidateQueries({ queryKey: ['edu', 'course-audit'] })
      closeCompare()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  async function openCompare(r: Audit) {
    setCurrentId(r.id)
    setCompareType(r.type)
    setCompareRemark(r.remark ?? '')
    setCompareData({ before: {}, after: {} })
    setCompareOpen(true)
    setLoadingCompare(true)
    try {
      let before: Snapshot = {},
        after: Snapshot = {}
      if (r.type === 0) {
        before = await eduApi<Snapshot>(`/api/admin/courses/${r.sourceId}`)
        after = await eduApi<Snapshot>(`/api/admin/courses/temp/${r.targetId}`)
      } else {
        before = await eduApi<Snapshot>(`/api/admin/course-videos/${r.sourceId}`)
        after = await eduApi<Snapshot>(`/api/admin/course-videos/temp/${r.targetId}`)
      }
      setCompareData({ before, after })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载对比数据失败')
    } finally {
      setLoadingCompare(false)
    }
  }
  function closeCompare() {
    if (auditMut.isPending) return
    setCompareOpen(false)
    setCompareData({ before: {}, after: {} })
    setCompareRemark('')
    setCurrentId(null)
  }
  function approve() {
    if (currentId) auditMut.mutate({ id: currentId, status: 3, remark: compareRemark })
  }
  function rectify() {
    if (!compareRemark.trim()) return toast.warning('请填写整改意见')
    if (currentId) auditMut.mutate({ id: currentId, status: 1, remark: compareRemark })
  }
  function handleExport() {
    exportFromApi(
      `/api/admin/course-audit${buildQs({ ...q, pageSize: 10000 })}`,
      `courseAudit_${Date.now()}`,
      [
        { key: 'id', title: 'ID' },
        { key: 'type', title: '类型' },
        { key: 'operate', title: '操作' },
        { key: 'sourceId', title: '源ID' },
        { key: 'targetId', title: '目标ID' },
        { key: 'status', title: '状态', formatter: (v) => statusText(Number(v)) },
        { key: 'creator', title: '创建人' },
        { key: 'createdAt', title: '创建时间' },
        { key: 'updator', title: '更新人' },
      ],
    ).then((ok) => toast[ok ? 'success' : 'error'](ok ? '导出成功' : '导出失败'))
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []
  const fields = compareType === 0 ? COURSE_FIELDS : VIDEO_FIELDS
  const set = (k: keyof typeof q, v: string) => {
    setQ({ ...q, [k]: v })
    setPage(1)
  }
  const inputCls = 'h-9 w-40'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">课程审核</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          审核课程/视频修改，对比 before/after 数据
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="操作"
          value={q.operate}
          onChange={(e) => set('operate', e.target.value)}
          className={inputCls}
        />
        <Input
          placeholder="源ID"
          value={q.sourceId}
          onChange={(e) => set('sourceId', e.target.value)}
          className={inputCls}
        />
        <Input
          placeholder="创建人"
          value={q.creator}
          onChange={(e) => set('creator', e.target.value)}
          className={inputCls}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setQ({ operate: '', sourceId: '', creator: '' })
            setPage(1)
          }}
        >
          重置
        </Button>
        <div className="ml-auto">
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
              <TableHead className="px-4 py-2.5">类型</TableHead>
              <TableHead className="px-4 py-2.5">操作</TableHead>
              <TableHead className="px-4 py-2.5">源ID</TableHead>
              <TableHead className="px-4 py-2.5">目标ID</TableHead>
              <TableHead className="px-4 py-2.5">状态</TableHead>
              <TableHead className="px-4 py-2.5">创建人</TableHead>
              <TableHead className="px-4 py-2.5">创建时间</TableHead>
              <TableHead className="px-4 py-2.5">更新人</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={10} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  <ClipboardCheck className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">{r.id}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.type === 0 ? '课程' : '视频'}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.operate}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.sourceId}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.targetId}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        statusClass(r.status),
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          r.status === 3
                            ? 'bg-emerald-500'
                            : r.status === 1
                              ? 'bg-amber-500'
                              : 'bg-muted-foreground',
                        )}
                      />
                      {statusText(r.status)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{r.creator ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{fmt(r.createdAt)}</TableCell>
                  <TableCell className="px-4 py-2.5">{r.updator ?? '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <HasPermi code={`${PERM}edit`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openCompare(r)}
                        title="审核对比"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </HasPermi>
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
      <Dialog open={compareOpen} onOpenChange={(o) => (o ? setCompareOpen(true) : closeCompare())}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>审核对比 — {compareType === 0 ? '课程' : '视频'}</DialogTitle>
          </DialogHeader>
          {loadingCompare ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              加载对比数据...
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 border-b pb-2 text-xs font-semibold text-muted-foreground">
                <div>字段</div>
                <div className="text-red-600 dark:text-red-400">修改前</div>
                <div className="text-emerald-600 dark:text-emerald-400">修改后</div>
              </div>
              {fields.map(([key, label]) => (
                <CompareRow
                  key={key}
                  label={label}
                  before={compareData.before[key]}
                  after={compareData.after[key]}
                />
              ))}
              <div className="space-y-2 pt-2">
                <Label htmlFor="audit-remark">审核意见</Label>
                <textarea
                  id="audit-remark"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={compareRemark}
                  onChange={(e) => setCompareRemark(e.target.value)}
                  placeholder="请输入审核意见（整改必填）"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeCompare}
              disabled={auditMut.isPending}
            >
              关闭
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={rectify}
              disabled={auditMut.isPending || loadingCompare}
              className="border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
            >
              提交整改
            </Button>
            <Button type="button" onClick={approve} disabled={auditMut.isPending || loadingCompare}>
              {auditMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}通过审核
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
