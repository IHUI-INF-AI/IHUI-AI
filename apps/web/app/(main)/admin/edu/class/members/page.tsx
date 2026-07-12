'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Trash2, Loader2, ChevronLeft, UserPlus, Users } from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { isNotFound } from '@/lib/api-error'
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
} from '@ihui/ui'

interface Member {
  id: string
  userId: string
  userName: string | null
  joinedAt: string
  status: string
  role: string
}
const PAGE_SIZE = 10

export default function EduClassMembersPage() {
  const t = useTranslations('admin.eduClassMembers')
  const qc = useQueryClient()
  const [classId, setClassId] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [userId, setUserId] = React.useState('')
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'class', 'members', classId, page],
    queryFn: () =>
      eduApi<PageData<Member>>(
        `/api/admin/edu/classes/${classId}/members${buildQs({ page, pageSize: PAGE_SIZE })}`,
      ),
    enabled: !!classId,
    retry: false,
  })

  const addMut = useMutation({
    mutationFn: () =>
      eduApi(`/api/admin/edu/classes/${classId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: userId.trim() }),
      }),
    onSuccess: () => {
      toast.success(t('addSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'class', 'members', classId] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const removeMut = useMutation({
    mutationFn: (id: string) =>
      eduApi(`/api/admin/edu/classes/${classId}/members/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('removeSuccess'))
      qc.invalidateQueries({ queryKey: ['edu', 'class', 'members', classId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function closeDialog() {
    if (addMut.isPending) return
    setOpen(false)
    setUserId('')
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!userId.trim()) return setErr(t('userIdRequired'))
    addMut.mutate()
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rows = data?.list ?? []
  const noEndpoint = isNotFound(error)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/edu/class">
            <ChevronLeft className="h-4 w-4" />
            {t('backToClass')}
          </Link>
        </Button>
        <div className="w-full max-w-xs">
          <Input
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value)
              setPage(1)
            }}
            placeholder={t('placeholderClassId')}
            className="h-9"
          />
        </div>
        {classId && (
          <Button
            onClick={() => {
              setUserId('')
              setErr(null)
              setOpen(true)
            }}
            size="sm"
            className="ml-auto"
          >
            <UserPlus className="h-4 w-4" />
            {t('addMember')}
          </Button>
        )}
      </div>
      {!classId ? (
        <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground">
          <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
          {t('enterClassId')}
        </div>
      ) : isLoading ? (
        <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      ) : noEndpoint ? (
        <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground">
          <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
          {t('endpointNotConfigured')}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground">
          <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
          {t('noMembers')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="px-4 py-2.5">{t('colStudent')}</TableHead>
                <TableHead className="px-4 py-2.5">{t('colRole')}</TableHead>
                <TableHead className="px-4 py-2.5">{t('colJoinedAt')}</TableHead>
                <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
                <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y">
              {rows.map((m) => (
                <TableRow key={m.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">
                    {m.userName ?? m.userId.slice(0, 8)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        m.role === 'teacher'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
                      )}
                    >
                      {m.role === 'teacher' ? t('roleTeacher') : t('roleStudent')}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                    {m.joinedAt}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        m.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {m.status === 'active' ? t('statusActive') : t('statusLeft')}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (window.confirm(t('confirmRemove'))) removeMut.mutate(m.id)
                      }}
                      title={t('remove')}
                      className="text-destructive hover:text-destructive"
                      disabled={removeMut.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {classId && rows.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('prev')}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t('pageOf', { page, totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('next')}
            </Button>
          </div>
        </div>
      )}
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t('dialogTitle')}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="m-uid">{t('labelUserId')}</Label>
              <Input
                id="m-uid"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder={t('placeholderUserId')}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={addMut.isPending}
              >
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={addMut.isPending}>
                {addMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('add')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
