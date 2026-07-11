'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, ShieldAlert, Plus } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'

interface SensitiveWord {
  id: string
  word: string
  category: string
  level: number
  replacement: string | null
  status: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const CATEGORIES = ['default', 'politics', 'porn', 'ads', 'abuse'] as const
const LEVEL_KEYS = ['levelReplace', 'levelBlock', 'levelBan'] as const
const th = 'px-4 py-2.5 font-medium'
const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

const EMPTY = { word: '', category: 'default' as string, level: 1, replacement: '', status: 1 }

export default function SensitiveWordsPage() {
  const t = useTranslations('admin.sensitiveWords')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [currentPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<SensitiveWord | null>(null)
  const [form, setForm] = React.useState(EMPTY)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'sensitive-words', currentPage],
    queryFn: () => api<{ list: SensitiveWord[] }>('/api/admin/sensitive-words'),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        word: form.word,
        category: form.category,
        level: form.level,
        replacement: form.replacement || undefined,
        status: form.status,
      }
      return editing
        ? api<SensitiveWord>(`/api/admin/sensitive-words/${editing.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : api<SensitiveWord>('/api/admin/sensitive-words', {
            method: 'POST',
            body: JSON.stringify(body),
          })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sensitive-words'] })
      toast.success(editing ? '更新成功' : '创建成功')
      close()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api<void>(`/api/admin/sensitive-words/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sensitive-words'] })
      toast.success('删除成功')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }
  function openEdit(item: SensitiveWord) {
    setEditing(item)
    setForm({
      word: item.word,
      category: item.category,
      level: item.level,
      replacement: item.replacement ?? '',
      status: item.status,
    })
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.word.trim()) {
      toast.error('请输入敏感词')
      return
    }
    saveMut.mutate()
  }

  const list = data?.list ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {tc('create')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className={th}>{t('colWord')}</th>
              <th className={th}>{t('colCategory')}</th>
              <th className={th}>{t('colLevel')}</th>
              <th className={th}>{t('colStatus')}</th>
              <th className={th}>{tc('edit')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <ShieldAlert className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{item.word}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{item.category}</td>
                  <td className="px-4 py-2.5">{t(LEVEL_KEYS[item.level - 1] ?? 'levelReplace')}</td>
                  <td className="px-4 py-2.5">
                    {item.status === 1 ? t('enabled') : t('disabled')}
                  </td>
                  <td className="px-4 py-2.5 space-x-2">
                    <button className="text-primary hover:underline" onClick={() => openEdit(item)}>
                      {tc('edit')}
                    </button>
                    <button
                      className="text-destructive hover:underline"
                      onClick={() => {
                        if (confirm('确认删除该敏感词？')) deleteMut.mutate(item.id)
                      }}
                      disabled={deleteMut.isPending}
                    >
                      {tc('delete')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑敏感词' : '新增敏感词'}</DialogTitle>
              <DialogDescription>{editing ? '修改敏感词信息' : '添加新的敏感词'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="sw-word">{t('colWord')}</Label>
              <Input
                id="sw-word"
                value={form.word}
                onChange={(e) => setForm({ ...form, word: e.target.value })}
                placeholder="请输入敏感词"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sw-category">{t('colCategory')}</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger className={selectClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sw-level">{t('colLevel')}</Label>
                <Select
                  value={String(form.level)}
                  onValueChange={(v) => setForm({ ...form, level: Number(v) })}
                >
                  <SelectTrigger className={selectClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{t('levelReplace')}</SelectItem>
                    <SelectItem value="2">{t('levelBlock')}</SelectItem>
                    <SelectItem value="3">{t('levelBan')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sw-replacement">替换文本</Label>
              <Input
                id="sw-replacement"
                value={form.replacement}
                onChange={(e) => setForm({ ...form, replacement: e.target.value })}
                placeholder="默认 ***"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sw-status">{t('colStatus')}</Label>
              <Select
                value={String(form.status)}
                onValueChange={(v) => setForm({ ...form, status: Number(v) })}
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t('enabled')}</SelectItem>
                  <SelectItem value="0">{t('disabled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saveMut.isPending}>
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
