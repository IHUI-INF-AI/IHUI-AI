'use client'

import * as React from 'react'
import Link from 'next/link'
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
  FileText,
  ListChecks,
  Settings2,
} from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
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
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Card,
  CardContent,
} from '@ihui/ui'

interface Paper {
  id: string
  title: string
  description: string | null
  totalScore: string
  passScore: string
  duration: number
  isPublished: boolean
  isRandom: boolean
  questionCount: number
}

interface PaperForm {
  title: string
  description: string
  totalScore: string
  passScore: string
  duration: string
  isPublished: boolean
  isRandom: boolean
}

const EMPTY: PaperForm = {
  title: '',
  description: '',
  totalScore: '100',
  passScore: '60',
  duration: '60',
  isPublished: false,
  isRandom: false,
}

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

const PAGE_SIZE = 10

function StatCard({
  icon: Icon,
  label,
  value,
  gradient,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  gradient: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-white',
            gradient,
          )}
        >
          <Icon className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function EduExamPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Paper | null>(null)
  const [form, setForm] = React.useState<PaperForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'exam', 'papers', debounced, page],
    queryFn: () =>
      eduApi<PageData<Paper>>(
        `/api/admin/exam/papers${buildQs({ page, pageSize: PAGE_SIZE, search: debounced })}`,
      ),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        totalScore: form.totalScore,
        passScore: form.passScore,
        duration: Number(form.duration) || 60,
        isPublished: form.isPublished,
        isRandom: form.isRandom,
      }
      if (editing)
        return eduApi(`/api/admin/exam/papers/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      return eduApi(`/api/admin/exam/papers`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['edu', 'exam', 'papers'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/exam/papers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['edu', 'exam', 'papers'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(p: Paper) {
    setEditing(p)
    setForm({
      title: p.title,
      description: p.description ?? '',
      totalScore: p.totalScore,
      passScore: p.passScore,
      duration: String(p.duration),
      isPublished: p.isPublished,
      isRandom: p.isRandom,
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
    if (!form.title.trim()) return setErr('试卷标题不能为空')
    saveMut.mutate()
  }
  function handleDelete(p: Paper) {
    if (!window.confirm('确定删除该试卷吗？')) return
    deleteMut.mutate(p.id)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const papers = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">考试管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理试卷、题目、组卷、考试安排与成绩</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FileText}
          label="试卷总数"
          value={total}
          gradient="bg-gradient-to-br from-indigo-500 to-purple-700"
        />
        <StatCard
          icon={ListChecks}
          label="已发布"
          value={papers.filter((p) => p.isPublished).length}
          gradient="bg-gradient-to-br from-emerald-500 to-green-400"
        />
        <StatCard
          icon={Settings2}
          label="随机组卷"
          value={papers.filter((p) => p.isRandom).length}
          gradient="bg-gradient-to-br from-sky-500 to-blue-500"
        />
        <StatCard
          icon={FileText}
          label="当前页"
          value={papers.length}
          gradient="bg-gradient-to-br from-pink-500 to-rose-500"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索试卷标题..."
            className="h-9 pl-8"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/edu/exam/questions">题库管理</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/edu/exam/grades">成绩批阅</Link>
          </Button>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4" />
            新建试卷
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">标题</TableHead>
              <TableHead className="px-4 py-2.5">总分</TableHead>
              <TableHead className="px-4 py-2.5">及格分</TableHead>
              <TableHead className="px-4 py-2.5">时长</TableHead>
              <TableHead className="px-4 py-2.5">状态</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : papers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无试卷
                </TableCell>
              </TableRow>
            ) : (
              papers.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">
                    <div className="font-medium">{p.title}</div>
                    {p.description ? (
                      <div className="max-w-xs break-words text-xs text-muted-foreground">
                        {p.description}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{Number(p.totalScore)}</TableCell>
                  <TableCell className="px-4 py-2.5">{Number(p.passScore)}</TableCell>
                  <TableCell className="px-4 py-2.5">{p.duration}分钟</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        p.isPublished
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          p.isPublished ? 'bg-emerald-500' : 'bg-muted-foreground',
                        )}
                      />
                      {p.isPublished ? '已发布' : '未发布'}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="sm" title="题目">
                        <Link href={`/admin/edu/exam/questions?paperId=${p.id}`}>
                          <ListChecks className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)} title="编辑">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(p)}
                        title="删除"
                        className="text-destructive hover:text-destructive"
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
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
        <span className="text-sm text-muted-foreground">共 {total} 份试卷</span>
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
              <DialogTitle>{editing ? '编辑试卷' : '新建试卷'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="p-title">标题</Label>
              <Input
                id="p-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="请输入试卷标题"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-desc">描述</Label>
              <Input
                id="p-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="试卷描述(选填)"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="p-total">总分</Label>
                <Input
                  id="p-total"
                  type="number"
                  min="0"
                  value={form.totalScore}
                  onChange={(e) => setForm({ ...form, totalScore: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-pass">及格分</Label>
                <Input
                  id="p-pass"
                  type="number"
                  min="0"
                  value={form.passScore}
                  onChange={(e) => setForm({ ...form, passScore: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-dur">时长(分钟)</Label>
                <Input
                  id="p-dur"
                  type="number"
                  min="1"
                  max="600"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="p-pub">发布状态</Label>
                <Select
                  value={form.isPublished ? 'true' : 'false'}
                  onValueChange={(v) => setForm({ ...form, isPublished: v === 'true' })}
                >
                  <SelectTrigger className={selectClass} id="p-pub">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">未发布</SelectItem>
                    <SelectItem value="true">已发布</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-rand">随机组卷</Label>
                <Select
                  value={form.isRandom ? 'true' : 'false'}
                  onValueChange={(v) => setForm({ ...form, isRandom: v === 'true' })}
                >
                  <SelectTrigger className={selectClass} id="p-rand">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">否</SelectItem>
                    <SelectItem value="true">是</SelectItem>
                  </SelectContent>
                </Select>
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
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
