'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { LayoutGrid, Plus, Edit, Power, Loader2 } from 'lucide-react'

import { Button, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface RecommendSlot {
  id: string
  position: string
  name: string
  contentType: 'agent' | 'article' | 'course' | 'activity' | 'live'
  sort: number
  isEnabled: boolean
}

const MOCK_SLOTS: RecommendSlot[] = [
  { id: '1', position: 'home_banner', name: '首页顶部 Banner', contentType: 'agent', sort: 1, isEnabled: true },
  { id: '2', position: 'home_hot', name: '首页热门推荐', contentType: 'agent', sort: 2, isEnabled: true },
  { id: '3', position: 'plaza_sidebar', name: '广场侧边栏', contentType: 'article', sort: 3, isEnabled: true },
  { id: '4', position: 'learn_recommend', name: '学习推荐位', contentType: 'course', sort: 4, isEnabled: false },
  { id: '5', position: 'live_upcoming', name: '直播预告位', contentType: 'live', sort: 5, isEnabled: true },
]

const CONTENT_TYPE_LABEL: Record<RecommendSlot['contentType'], string> = {
  agent: 'Agent',
  article: 'Article',
  course: 'Course',
  activity: 'Activity',
  live: 'Live',
}
const CONTENT_TYPE_STYLE: Record<RecommendSlot['contentType'], string> = {
  agent: 'bg-blue-500/10 text-blue-600',
  article: 'bg-emerald-500/10 text-emerald-600',
  course: 'bg-purple-500/10 text-purple-600',
  activity: 'bg-amber-500/10 text-amber-600',
  live: 'bg-red-500/10 text-red-600',
}

const EMPTY = { position: '', name: '', contentType: 'agent' as RecommendSlot['contentType'], sort: 0 }
const th = 'px-4 py-2.5 font-medium'
const selectClass = 'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function RecommendationConfigPage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<RecommendSlot | null>(null)
  const [form, setForm] = React.useState(EMPTY)

  const { data: list = MOCK_SLOTS, isLoading } = useQuery({
    queryKey: ['admin', 'recommendation-config'],
    queryFn: () => Promise.resolve(MOCK_SLOTS),
  })

  const saveMut = useMutation({
    mutationFn: () => Promise.resolve(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'recommendation-config'] }); close(); toast.success(t('rec.saveSuccess')) },
  })
  const toggleMut = useMutation({
    mutationFn: (_id: string) => Promise.resolve(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'recommendation-config'] }); toast.success(t('rec.toggleSuccess')) },
  })

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true) }
  function openEdit(s: RecommendSlot) { setEditing(s); setForm({ position: s.position, name: s.name, contentType: s.contentType, sort: s.sort }); setOpen(true) }
  function close() { if (saveMut.isPending) return; setOpen(false); setEditing(null); setForm(EMPTY) }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.position.trim()) { toast.error(t('rec.required')); return }
    saveMut.mutate()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <LayoutGrid className="h-6 w-6 text-primary" />
            {t('rec.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('rec.subtitle')}</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />{t('rec.create')}</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />{tc('search')}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">{t('rec.noData')}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className={th}>{t('rec.colPosition')}</th>
                <th className={th}>{t('rec.colName')}</th>
                <th className={th}>{t('rec.colContentType')}</th>
                <th className={th}>{t('rec.colSort')}</th>
                <th className={th}>{t('rec.colStatus')}</th>
                <th className={cn(th, 'text-right')}>{t('rec.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5"><code className="font-mono text-xs">{s.position}</code></td>
                  <td className="px-4 py-2.5 font-medium">{s.name}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', CONTENT_TYPE_STYLE[s.contentType])}>
                      {CONTENT_TYPE_LABEL[s.contentType]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{s.sort}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', s.isEnabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', s.isEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
                      {s.isEnabled ? t('rec.enabled') : t('rec.disabled')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(s)}><Edit className="h-4 w-4" />{tc('edit')}</Button>
                      <Button size="sm" variant="ghost" disabled={toggleMut.isPending} onClick={() => toggleMut.mutate(s.id)}>
                        <Power className="h-4 w-4" />
                        {s.isEnabled ? t('rec.disable') : t('rec.enable')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader><DialogTitle>{editing ? t('rec.editTitle') : t('rec.createTitle')}</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="r-pos">{t('rec.fieldPosition')}</Label>
              <Input id="r-pos" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="home_banner" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-name">{t('rec.fieldName')}</Label>
              <Input id="r-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('rec.namePlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="r-type">{t('rec.fieldContentType')}</Label>
                <select value={form.contentType} onChange={(e) => setForm({ ...form, contentType: e.target.value as RecommendSlot['contentType'] })} className={selectClass}>
                  <option value="agent">Agent</option>
                  <option value="article">Article</option>
                  <option value="course">Course</option>
                  <option value="activity">Activity</option>
                  <option value="live">Live</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="r-sort">{t('rec.fieldSort')}</Label>
                <Input id="r-sort" type="number" value={form.sort} onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saveMut.isPending}>{tc('cancel')}</Button>
              <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{tc('save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
