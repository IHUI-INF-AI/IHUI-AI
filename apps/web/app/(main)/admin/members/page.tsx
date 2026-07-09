'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Plus,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
  Ban,
  Building2,
  CheckCircle2,
  XCircle,
  Unlock,
  KeyRound,
  Trash2,
  Crown,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
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

interface Member {
  id: string
  username: string | null
  mobile: string | null
  email: string | null
  avatar: string | null
  nickname: string | null
  gender: number
  status: number
  levelId: string | null
  companyId: string | null
  departmentId: string | null
  growthValue: number
  createdAt: string
}

interface MembersData {
  list: Member[]
  total: number
  page: number
  pageSize: number
}

interface MemberStatistics {
  total: number
  active: number
  pending: number
  sealed: number
}

interface MemberLevel {
  id: string
  name: string
  growthValue: number
  discount: string
  sort: number
}

interface CompaniesData {
  list: unknown[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 10

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function fetchMembers(params: { page: number; search: string }): Promise<MembersData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.search) {
    // 纯数字按手机号搜索,否则按用户名(后端 username/mobile 分别模糊匹配)
    if (/^\d+$/.test(params.search)) {
      qs.set('mobile', params.search)
    } else {
      qs.set('username', params.search)
    }
  }
  return api<MembersData>(`/api/admin/members?${qs.toString()}`)
}

interface MemberForm {
  username: string
  password: string
  nickname: string
  mobile: string
  email: string
  gender: string
  levelId: string
  status: string
}

const EMPTY_FORM: MemberForm = {
  username: '',
  password: '',
  nickname: '',
  mobile: '',
  email: '',
  gender: '0',
  levelId: '',
  status: '1',
}

type MemberAction = 'approved' | 'reject' | 'seal' | 'unseal'

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

function statusBadgeClass(status: number) {
  if (status === 1) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
  if (status === 2) return 'bg-rose-500/10 text-rose-600 dark:text-rose-500'
  return 'bg-amber-500/10 text-amber-600 dark:text-amber-500'
}

function statusDotClass(status: number) {
  if (status === 1) return 'bg-emerald-500'
  if (status === 2) return 'bg-rose-500'
  return 'bg-amber-500'
}

export default function AdminMembersPage() {
  const t = useTranslations('admin.members')
  const qc = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)

  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<MemberForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)

  const [resetOpen, setResetOpen] = React.useState(false)
  const [resetTarget, setResetTarget] = React.useState<Member | null>(null)
  const [resetPwd, setResetPwd] = React.useState('')
  const [resetErr, setResetErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data: stats } = useQuery({
    queryKey: ['admin', 'members', 'statistics'],
    queryFn: () =>
      api<{ statistics: MemberStatistics }>(`/api/admin/members/statistics`).then(
        (d) => d.statistics,
      ),
  })

  const { data: companiesData } = useQuery({
    queryKey: ['admin', 'members', 'companies', 'count'],
    queryFn: () =>
      api<CompaniesData>(`/api/admin/members/companies?page=1&pageSize=100`),
  })

  const { data: levelsData } = useQuery({
    queryKey: ['admin', 'members', 'levels', 'all'],
    queryFn: () =>
      api<{ list: MemberLevel[] }>(`/api/admin/members/levels`).then((d) => d.list ?? []),
  })
  const levelMap = React.useMemo(() => {
    const m = new Map<string, string>()
    const levels = levelsData ?? []
    for (const l of levels) m.set(l.id, l.name)
    return m
  }, [levelsData])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'members', 'list', debounced, page],
    queryFn: () => fetchMembers({ page, search: debounced }),
  })

  const createMut = useMutation({
    mutationFn: () => {
      const body = {
        username: form.username.trim(),
        password: form.password,
        mobile: form.mobile.trim() || null,
        email: form.email.trim() || null,
        nickname: form.nickname.trim() || null,
        gender: Number(form.gender),
        levelId: form.levelId || null,
        status: Number(form.status),
      }
      return api<{ id: string }>(`/api/admin/members`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success(t('createSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'members'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const actionMessages: Record<MemberAction, string> = {
    approved: t('approveSuccess'),
    reject: t('rejectSuccess'),
    seal: t('sealSuccess'),
    unseal: t('unsealSuccess'),
  }

  const actionMut = useMutation({
    mutationFn: ({ action, id }: { action: MemberAction; id: string }) =>
      api(`/api/admin/members/${action}`, {
        method: 'PUT',
        body: JSON.stringify({ id }),
      }),
    onSuccess: (_d, vars) => {
      toast.success(actionMessages[vars.action])
      qc.invalidateQueries({ queryKey: ['admin', 'members'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const resetPwdMut = useMutation({
    mutationFn: () =>
      api(`/api/admin/members/pwd/reset`, {
        method: 'PUT',
        body: JSON.stringify({ id: resetTarget!.id, password: resetPwd }),
      }),
    onSuccess: () => {
      toast.success(t('resetSuccess'))
      closeResetDialog()
    },
    onError: (e: Error) => setResetErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/members?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'members'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }

  function closeDialog() {
    if (createMut.isPending) return
    setOpen(false)
    setErr(null)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.username.trim()) {
      setErr(t('usernameRequired'))
      return
    }
    if (!form.password) {
      setErr(t('passwordRequired'))
      return
    }
    createMut.mutate()
  }

  function openReset(member: Member) {
    setResetTarget(member)
    setResetPwd('')
    setResetErr(null)
    setResetOpen(true)
  }

  function closeResetDialog() {
    if (resetPwdMut.isPending) return
    setResetOpen(false)
    setResetTarget(null)
    setResetPwd('')
    setResetErr(null)
  }

  function submitReset(e: React.FormEvent) {
    e.preventDefault()
    setResetErr(null)
    if (!resetPwd) {
      setResetErr(t('newPasswordRequired'))
      return
    }
    resetPwdMut.mutate()
  }

  function handleDelete(member: Member) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(member.id)
  }

  function statusLabel(status: number) {
    if (status === 1) return t('statusActive')
    if (status === 2) return t('statusSealed')
    return t('statusPending')
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const members = data?.list ?? []

  const statTotal = stats?.total ?? 0
  const statPending = stats?.pending ?? 0
  const statSealed = stats?.sealed ?? 0
  const statCompany = companiesData?.total ?? 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/members/levels">
              <Crown className="h-4 w-4" />
              {t('levels')}
            </Link>
          </Button>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4" />
            {t('create')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label={t('statTotal')}
          value={statTotal}
          gradient="bg-gradient-to-br from-indigo-500 to-purple-700"
        />
        <StatCard
          icon={Clock}
          label={t('statPending')}
          value={statPending}
          gradient="bg-gradient-to-br from-amber-400 to-orange-400"
        />
        <StatCard
          icon={Ban}
          label={t('statSealed')}
          value={statSealed}
          gradient="bg-gradient-to-br from-rose-500 to-red-500"
        />
        <StatCard
          icon={Building2}
          label={t('statCompany')}
          value={statCompany}
          gradient="bg-gradient-to-br from-sky-500 to-blue-500"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-9 pl-8"
            aria-label={t('search')}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">{t('colUsername')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colNickname')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colCompany')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colLevel')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => {
                const status = member.status
                return (
                  <TableRow key={member.id} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5">
                      <div className="font-medium">{member.username ?? '—'}</div>
                      {member.mobile ? (
                        <div className="text-xs text-muted-foreground">{member.mobile}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">{member.nickname ?? '—'}</TableCell>
                    <TableCell className="px-4 py-2.5">
                      {member.companyId ? (
                        <span className="inline-flex items-center rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-600 dark:text-sky-400">
                          {t('bound')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      {member.levelId && levelMap.has(member.levelId) ? (
                        <span className="inline-flex items-center rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400">
                          {levelMap.get(member.levelId)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          statusBadgeClass(status),
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', statusDotClass(status))} />
                        {statusLabel(status)}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {status === 0 ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => actionMut.mutate({ action: 'approved', id: member.id })}
                              title={t('approve')}
                              disabled={actionMut.isPending}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => actionMut.mutate({ action: 'reject', id: member.id })}
                              title={t('reject')}
                              disabled={actionMut.isPending}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        ) : null}
                        {status === 1 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => actionMut.mutate({ action: 'seal', id: member.id })}
                            title={t('seal')}
                            disabled={actionMut.isPending}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {status === 2 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => actionMut.mutate({ action: 'unseal', id: member.id })}
                            title={t('unseal')}
                            disabled={actionMut.isPending}
                          >
                            <Unlock className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openReset(member)}
                          title={t('resetPwd')}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(member)}
                          title={t('delete')}
                          className="text-destructive hover:text-destructive"
                          disabled={deleteMut.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('page', { page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 新建会员 */}
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-xl">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t('createTitle')}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="m-username">{t('fieldUsername')}</Label>
                <Input
                  id="m-username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder={t('usernamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-password">{t('fieldPassword')}</Label>
                <Input
                  id="m-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={t('passwordPlaceholder')}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="m-nickname">{t('fieldNickname')}</Label>
                <Input
                  id="m-nickname"
                  value={form.nickname}
                  onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                  placeholder={t('nicknamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-mobile">{t('fieldMobile')}</Label>
                <Input
                  id="m-mobile"
                  value={form.mobile}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                  placeholder={t('mobilePlaceholder')}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="m-email">{t('fieldEmail')}</Label>
                <Input
                  id="m-email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder={t('emailPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-gender">{t('fieldGender')}</Label>
                <Select
                  value={form.gender}
                  onValueChange={(v) => setForm({ ...form, gender: v })}
                >
                  <SelectTrigger className={selectClass} id="m-gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">{t('genderUnknown')}</SelectItem>
                    <SelectItem value="1">{t('genderMale')}</SelectItem>
                    <SelectItem value="2">{t('genderFemale')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="m-level">{t('fieldLevel')}</Label>
                <Select
                  value={form.levelId || 'none'}
                  onValueChange={(v) => setForm({ ...form, levelId: v === 'none' ? '' : v })}
                >
                  <SelectTrigger className={selectClass} id="m-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('noLevel')}</SelectItem>
                    {(levelsData ?? []).map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-status">{t('fieldStatus')}</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger className={selectClass} id="m-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">{t('statusPending')}</SelectItem>
                    <SelectItem value="1">{t('statusActive')}</SelectItem>
                    <SelectItem value="2">{t('statusSealed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={createMut.isPending}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 重置密码 */}
      <Dialog open={resetOpen} onOpenChange={(o) => (o ? setResetOpen(true) : closeResetDialog())}>
        <DialogContent>
          <form onSubmit={submitReset} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t('resetTitle')}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {t('resetDesc')}
              {resetTarget?.username ? `：${resetTarget.username}` : ''}
            </p>
            {resetErr && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {resetErr}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="m-newpwd">{t('fieldNewPassword')}</Label>
              <Input
                id="m-newpwd"
                value={resetPwd}
                onChange={(e) => setResetPwd(e.target.value)}
                placeholder={t('newPasswordPlaceholder')}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeResetDialog} disabled={resetPwdMut.isPending}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={resetPwdMut.isPending}>
                {resetPwdMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
