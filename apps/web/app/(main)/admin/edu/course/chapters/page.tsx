'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Loader2, ChevronLeft, ListOrdered, ChevronDown, ChevronRight } from 'lucide-react'
import { eduApi, buildQs, selectClass } from '@/lib/edu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '@ihui/ui'

interface Lesson { id: string; title: string }
interface Chapter { id: string; title: string; sortOrder: number; sections?: Section[] }
interface Section { id: string; title: string; duration: number; isFree: boolean }

interface ChForm { title: string; sortOrder: string }
const EMPTY_CH: ChForm = { title: '', sortOrder: '0' }

export default function EduCourseChaptersPage() {
  const qc = useQueryClient()
  const [lessonId, setLessonId] = React.useState('')
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
  const [chOpen, setChOpen] = React.useState(false)
  const [editingCh, setEditingCh] = React.useState<Chapter | null>(null)
  const [chForm, setChForm] = React.useState<ChForm>(EMPTY_CH)
  const [err, setErr] = React.useState<string | null>(null)

  const { data: lessonsData } = useQuery({
    queryKey: ['edu', 'course', 'chapters', 'lessons'],
    queryFn: () => eduApi<{ list: Lesson[] }>(`/api/admin/learn/lessons${buildQs({ page: 1, pageSize: 100 })}`),
  })
  const lessons = lessonsData?.list ?? []

  const { data: chapters, isLoading, error } = useQuery({
    queryKey: ['edu', 'course', 'chapters', lessonId],
    queryFn: async () => {
      const list = await eduApi<Chapter[]>(`/api/learn/lessons/${lessonId}`)
      return list ?? []
    },
    enabled: !!lessonId,
    retry: false,
  })

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const saveChMut = useMutation({
    mutationFn: () => {
      const body = { title: chForm.title.trim(), sortOrder: Number(chForm.sortOrder) || 0 }
      if (editingCh) return eduApi(`/api/admin/learn/lessons/${lessonId}/chapters/${editingCh.id}`, { method: 'PUT', body: JSON.stringify(body) })
      return eduApi(`/api/admin/learn/lessons/${lessonId}/chapters`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => { toast.success(editingCh ? '更新成功' : '创建成功'); qc.invalidateQueries({ queryKey: ['edu', 'course', 'chapters', lessonId] }); closeChDialog() },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteChMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/learn/lessons/${lessonId}/chapters/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('删除成功'); qc.invalidateQueries({ queryKey: ['edu', 'course', 'chapters', lessonId] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreateCh() { setEditingCh(null); setChForm(EMPTY_CH); setErr(null); setChOpen(true) }
  function openEditCh(c: Chapter) { setEditingCh(c); setChForm({ title: c.title, sortOrder: String(c.sortOrder) }); setErr(null); setChOpen(true) }
  function closeChDialog() { if (saveChMut.isPending) return; setChOpen(false); setEditingCh(null); setErr(null) }
  function submitCh(e: React.FormEvent) { e.preventDefault(); setErr(null); if (!chForm.title.trim()) return setErr('标题不能为空'); saveChMut.mutate() }

  const rows = chapters ?? []
  const noEndpoint = !!(error as Error) && (error as Error).message.includes('请求失败')

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight">课程章节</h1><p className="mt-1 text-sm text-muted-foreground">管理课程章节与小节</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link href="/admin/edu/course"><ChevronLeft className="h-4 w-4" />返回课程管理</Link></Button>
        <div className="w-full max-w-xs">
          <Select value={lessonId || 'none'} onValueChange={(v) => setLessonId(v === 'none' ? '' : v)}>
            <SelectTrigger className={selectClass} aria-label="课程"><SelectValue placeholder="选择课程" /></SelectTrigger>
            <SelectContent><SelectItem value="none">请选择课程</SelectItem>{lessons.map((l) => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {lessonId && <Button onClick={openCreateCh} size="sm" className="ml-auto"><Plus className="h-4 w-4" />新建章节</Button>}
      </div>
      {!lessonId ? (
        <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground"><ListOrdered className="mx-auto mb-2 h-8 w-8 opacity-40" />请先选择课程</div>
      ) : isLoading ? (
        <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载中...</div>
      ) : noEndpoint ? (
        <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground"><ListOrdered className="mx-auto mb-2 h-8 w-8 opacity-40" />章节端点未配置</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground"><ListOrdered className="mx-auto mb-2 h-8 w-8 opacity-40" />暂无章节</div>
      ) : (
        <div className="space-y-2">
          {rows.map((ch) => {
            const isExp = expanded.has(ch.id)
            return (
              <div key={ch.id} className="rounded-lg border">
                <div className="flex items-center gap-2 px-4 py-3 hover:bg-muted/30">
                  <Button variant="ghost" size="sm" onClick={() => toggleExpand(ch.id)} className="h-7 w-7 p-0">{isExp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button>
                  <span className="font-medium">{ch.title}</span>
                  <span className="text-xs text-muted-foreground">序号 {ch.sortOrder}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditCh(ch)} title="编辑"><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (window.confirm('确定删除？')) deleteChMut.mutate(ch.id) }} title="删除" className="text-destructive hover:text-destructive" disabled={deleteChMut.isPending}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {isExp && (
                  <div className="border-t bg-muted/20 px-4 py-2">
                    {ch.sections?.length ? ch.sections.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 py-1.5 text-sm">
                        <span className="text-muted-foreground">└</span>
                        <span>{s.title}</span>
                        <span className="text-xs text-muted-foreground">{s.duration}分钟</span>
                        {s.isFree && <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-xs text-sky-600 dark:text-sky-400">免费</span>}
                      </div>
                    )) : <p className="py-2 text-xs text-muted-foreground">暂无小节</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <Dialog open={chOpen} onOpenChange={(o) => (o ? setChOpen(true) : closeChDialog())}>
        <DialogContent>
          <form onSubmit={submitCh} className="space-y-4">
            <DialogHeader><DialogTitle>{editingCh ? '编辑章节' : '新建章节'}</DialogTitle></DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="space-y-2"><Label htmlFor="ch-title">标题</Label><Input id="ch-title" value={chForm.title} onChange={(e) => setChForm({ ...chForm, title: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="ch-sort">排序</Label><Input id="ch-sort" type="number" min="0" value={chForm.sortOrder} onChange={(e) => setChForm({ ...chForm, sortOrder: e.target.value })} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={closeChDialog} disabled={saveChMut.isPending}>取消</Button><Button type="submit" disabled={saveChMut.isPending}>{saveChMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
