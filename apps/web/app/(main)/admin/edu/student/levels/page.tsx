'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Plus, Edit, Trash2, Loader2, ChevronLeft, Star } from 'lucide-react'
import { eduApi, type PageData } from '@/lib/edu'
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

interface Level {
  id: string
  name: string
  level: number
  minScore: number
  maxScore: number
  discount: number
  sort: number
}
interface LForm {
  name: string
  level: string
  minScore: string
  maxScore: string
  discount: string
}
const EMPTY: LForm = { name: '', level: '1', minScore: '0', maxScore: '100', discount: '1' }

export default function EduStudentLevelsPage() {
  const t = useTranslations('admin.edu.student.levels')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Level | null>(null)
  const [form, setForm] = React.useState<LForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'student', 'levels'],
    queryFn: () => eduApi<PageData<Level>>(`/api/admin/member-levels`),
    retry: false,
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        level: Number(form.level),
        minScore: Number(form.minScore),
        maxScore: Number(form.maxScore),
        discount: Number(form.discount),
      }
      if (editing)
        return eduApi(`/api/admin/member-levels/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      return eduApi(`/api/admin/member-levels`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? t('updateSuccess') : t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'student', 'levels'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/member-levels/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'student', 'levels'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(l: Level) {
    setEditing(l)
    setForm({
      name: l.name,
      level: String(l.level),
      minScore: String(l.minScore),
      maxScore: String(l.maxScore),
      discount: String(l.discount),
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
    if (!form.name.trim()) return setErr(t('nameRequired'))
    saveMut.mutate()
  }

  const rows = data?.list ?? []
  const noEndpoint = !!(error as Error) && (error as Error).message.includes('请求失败')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/student">
            <ChevronLeft className="h-4 w-4" />
            {t('backToStudent')}
          </Link>
        </Button>
        <Button onClick={openCreate} size="sm" className="ml-auto">
          <Plus className="h-4 w-4" />
          {t('createLevel')}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{t('colLevel')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colName')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colScoreRange')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colDiscount')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colAction')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : noEndpoint ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Star className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noEndpoint')}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Star className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noLevels')}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((l) => (
                <TableRow key={l.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/10 text-xs font-bold text-amber-600 dark:text-amber-400">
                      L{l.level}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 font-medium">{l.name}</TableCell>
                  <TableCell className="px-4 py-2.5 text-xs">
                    {l.minScore} ~ {l.maxScore}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    {(l.discount * 10).toFixed(1)} {t('discountUnit')}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(l)}
                        title={t('edit')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(t('confirmDelete'))) deleteMut.mutate(l.id)
                        }}
                        title={t('delete')}
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
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? t('editLevel') : t('createLevel')}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="lv-name">{t('name')}</Label>
              <Input
                id="lv-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="lv-level">{t('levelNumber')}</Label>
                <Input
                  id="lv-level"
                  type="number"
                  min="1"
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lv-discount">{t('discount')}</Label>
                <Input
                  id="lv-discount"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="lv-min">{t('minScore')}</Label>
                <Input
                  id="lv-min"
                  type="number"
                  min="0"
                  value={form.minScore}
                  onChange={(e) => setForm({ ...form, minScore: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lv-max">{t('maxScore')}</Label>
                <Input
                  id="lv-max"
                  type="number"
                  min="0"
                  value={form.maxScore}
                  onChange={(e) => setForm({ ...form, maxScore: e.target.value })}
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
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
