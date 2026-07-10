'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Loader2, ChevronLeft, ChevronRight, Users, Search } from 'lucide-react'
import { eduApi, buildQs, selectClass, textareaClass, type PageData } from '@/lib/edu'
import { cn } from '@/lib/utils'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '@ihui/ui'

interface Topic {
  id: string; userId: string; userName: string | null
  lessonId: string | null; lessonTitle: string | null
  title: string; content: string | null
  replyCount: number; viewCount: number; isPinned: boolean
  createdAt: string; status: string
}
interface TForm { title: string; content: string; lessonId: string; status: string; isPinned: boolean }
const EMPTY: TForm = { title: '', content: '', lessonId: '', status: 'published', isPinned: false }

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  published: { label: '已发布', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
  draft: { label: '草稿', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  hidden: { label: '已隐藏', cls: 'bg-muted text-muted-foreground' },
}

const PAGE_SIZE = 10

export default function EduLearnCommunityPage() {
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Topic | null>(null)
  const [form, setForm] = React.useState<TForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => { setDebounced(search); setPage(1) }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'learn', 'community', debounced, page],
    queryFn: () => eduApi<PageData<Topic>>(`/api/admin/learn/topics${buildQs({ page, pageSize: PAGE_SIZE, search: debounced })}`),
    retry: false,
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(), content: form.content.trim() || null,
        lessonId: form.lessonId || null, status: form.status, isPinned: form.isPinned,
      }
      if (editing) return eduApi(`/api/admin/learn/topics/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
      return eduApi(`/api/admin/learn/topics`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => { toast.success(editing ? '更新成功' : '创建成功'); qc.invalidateQueries({ queryKey: ['edu', 'learn', 'community'] }); closeDialog() },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/learn/topics/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('删除成功'); qc.invalidateQueries({ queryKey: ['edu', 'learn', 'community'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() { setEditing(null); setForm(EMPTY); setErr(null); setOpen(true) }
  function openEdit(t: Topic) {
    setEditing(t)
    setForm({ title: t.title, content: t.content ?? '', lessonId: t.lessonId ?? '', status: t.status, isPinned: t.isPinned })
    setErr(null); setOpen(true)
  }
  function closeDialog() { if (saveMut.isPending) return; setOpen(false); setEditing(null); setErr(null) }
  function submit(e: React.FormEvent) { e.preventDefault(); setErr(null); if (!form.title.trim()) return setErr('标题不能为空'); saveMut.mutate() }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []
  const noEndpoint = !!(error as Error) && (error as Error).message.includes('请求失败')

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight">学习社区</h1><p className="mt-1 text-sm text-muted-foreground">管理学员讨论话题与互动</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link href="/admin/edu/learn"><ChevronLeft className="h-4 w-4" />返回学习管理</Link></Button>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索话题..." className="h-9 pl-8" />
        </div>
        <Button onClick={openCreate} size="sm" className="ml-auto"><Plus className="h-4 w-4" />发布话题</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50"><TableRow>
            <TableHead className="px-4 py-2.5">标题</TableHead><TableHead className="px-4 py-2.5">作者</TableHead>
            <TableHead className="px-4 py-2.5">回复</TableHead><TableHead className="px-4 py-2.5">浏览</TableHead>
            <TableHead className="px-4 py-2.5">状态</TableHead><TableHead className="px-4 py-2.5 text-right">操作</TableHead>
          </TableRow></TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (<TableRow><TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载中...</TableCell></TableRow>
            ) : noEndpoint ? (<TableRow><TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground"><Users className="mx-auto mb-2 h-8 w-8 opacity-40" />社区端点未配置</TableCell></TableRow>
            ) : rows.length === 0 ? (<TableRow><TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground"><Users className="mx-auto mb-2 h-8 w-8 opacity-40" />暂无话题</TableCell></TableRow>
            ) : rows.map((t) => {
              const st = STATUS_MAP[t.status] ?? { label: t.status, cls: 'bg-muted text-muted-foreground' }
              return (
                <TableRow key={t.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {t.isPinned && <span className="inline-flex items-center rounded bg-amber-500/10 px-1 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">置顶</span>}
                      <span className="font-medium">{t.title}</span>
                    </div>
                    {t.lessonTitle && <div className="text-xs text-muted-foreground">{t.lessonTitle}</div>}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{t.userName ?? t.userId.slice(0, 8)}</TableCell>
                  <TableCell className="px-4 py-2.5">{t.replyCount}</TableCell>
                  <TableCell className="px-4 py-2.5">{t.viewCount}</TableCell>
                  <TableCell className="px-4 py-2.5"><span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', st.cls)}>{st.label}</span></TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(t)} title="编辑"><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => { if (window.confirm('确定删除？')) deleteMut.mutate(t.id) }} title="删除" className="text-destructive hover:text-destructive" disabled={deleteMut.isPending}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="h-4 w-4" />上一页</Button>
          <span className="text-sm text-muted-foreground">第 {page} / {totalPages} 页</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页<ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader><DialogTitle>{editing ? '编辑话题' : '发布话题'}</DialogTitle></DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="space-y-2"><Label htmlFor="t-title">标题</Label><Input id="t-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="t-content">内容</Label><textarea id="t-content" className={textareaClass} rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="t-status">状态</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className={selectClass} id="t-status"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="published">已发布</SelectItem><SelectItem value="draft">草稿</SelectItem><SelectItem value="hidden">已隐藏</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={closeDialog} disabled={saveMut.isPending}>取消</Button><Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
