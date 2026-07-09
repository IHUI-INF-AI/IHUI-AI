'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, Plus, ArrowLeft, UserPlus, Trash2, Mail, Shield, Crown } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { Button, Input, Label, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@ihui/ui'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ihui/ui'
import { cn } from '@/lib/utils'

type Role = 'owner' | 'admin' | 'member'
interface TeamDetail { id: string; name: string; slug: string; description: string; ownerName: string; createdAt: string }
interface TeamMember { id: string; userId: string; nickname: string; avatar?: string; role: Role; joinedAt: string }
interface Invitation { id: string; invitee: string; status: 'pending' | 'accepted' | 'expired'; expiresAt: string }

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
const fmt = (v: string) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '-' : new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(d)
}
function Avatar({ src, name }: { src?: string; name: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} className="h-8 w-8 rounded-full" />
  }
  return <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">{(name[0] ?? 'U').toUpperCase()}</div>
}
const ROLE_BADGE: Record<Role, string> = {
  owner: 'bg-amber-500/10 text-amber-600',
  admin: 'bg-primary/10 text-primary',
  member: 'bg-muted text-muted-foreground',
}
const ROLE_ICON = { owner: Crown, admin: Shield, member: UserPlus } as const

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const t = useTranslations('teams')
  const tc = useTranslations('common')
  const qc = useQueryClient()

  const teamQ = useQuery({ queryKey: ['teams', id], queryFn: () => api<{ team: TeamDetail }>(`/api/teams/${id}`).then((d) => d.team) })
  const membersQ = useQuery({ queryKey: ['teams', id, 'members'], queryFn: () => api<{ members: TeamMember[] }>(`/api/teams/${id}/members`).then((d) => d.members) })
  const invitesQ = useQuery({ queryKey: ['teams', id, 'invitations'], queryFn: () => api<{ invitations: Invitation[] }>(`/api/teams/${id}/invitations`).then((d) => d.invitations) })

  const [tab, setTab] = React.useState<'members' | 'invitations' | 'settings'>('members')
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [invitee, setInvitee] = React.useState('')
  const [inviteErr, setInviteErr] = React.useState<string | null>(null)
  const [editName, setEditName] = React.useState('')
  const [editDesc, setEditDesc] = React.useState('')
  const [editErr, setEditErr] = React.useState<string | null>(null)
  const [inited, setInited] = React.useState(false)

  const team = teamQ.data
  React.useEffect(() => {
    if (team && !inited) { setEditName(team.name); setEditDesc(team.description); setInited(true) }
  }, [team, inited])

  const inviteMut = useMutation({ mutationFn: (v: string) => api(`/api/teams/${id}/invitations`, { method: 'POST', body: JSON.stringify({ email: v }) }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['teams', id, 'invitations'] }); setInviteOpen(false); setInvitee(''); setInviteErr(null) }, onError: (e: Error) => setInviteErr(e.message) })
  const removeMut = useMutation({ mutationFn: (mId: string) => api(`/api/teams/${id}/members/${mId}`, { method: 'DELETE' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['teams', id, 'members'] }) })
  const roleMut = useMutation({ mutationFn: (p: { memberId: string; role: Role }) => api(`/api/teams/${id}/members/${p.memberId}`, { method: 'PATCH', body: JSON.stringify({ role: p.role }) }), onSuccess: () => qc.invalidateQueries({ queryKey: ['teams', id, 'members'] }) })
  const cancelMut = useMutation({ mutationFn: (iId: string) => api(`/api/teams/${id}/invitations/${iId}`, { method: 'DELETE' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['teams', id, 'invitations'] }) })
  const updateMut = useMutation({ mutationFn: () => api(`/api/teams/${id}`, { method: 'PATCH', body: JSON.stringify({ name: editName, description: editDesc }) }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['teams', id] }); qc.invalidateQueries({ queryKey: ['teams'] }); setEditErr(null) }, onError: (e: Error) => setEditErr(e.message) })
  const deleteMut = useMutation({ mutationFn: () => api(`/api/teams/${id}`, { method: 'DELETE' }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['teams'] }); router.push('/teams') } })

  const handleInvite = (e: React.FormEvent) => { e.preventDefault(); setInviteErr(null); if (!invitee.trim()) { setInviteErr(t('inviteeRequired')); return } inviteMut.mutate(invitee.trim()) }
  const handleEdit = (e: React.FormEvent) => { e.preventDefault(); setEditErr(null); if (!editName.trim()) { setEditErr(t('nameRequired')); return } updateMut.mutate() }

  if (teamQ.isLoading) return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />{t('loading')}</div>
  if (teamQ.error || !team) return <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{(teamQ.error as Error)?.message ?? t('notFound')}</div>

  const tabs = [
    { key: 'members' as const, label: t('tabMembers') },
    { key: 'invitations' as const, label: t('tabInvitations') },
    { key: 'settings' as const, label: t('tabSettings') },
  ]

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <button type="button" onClick={() => router.push('/teams')} className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="h-4 w-4" />{t('backToList')}</button>

      <Card>
        <CardHeader className="flex-row items-center gap-4 space-y-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary"><Crown className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-xl">{team.name}</CardTitle>
            <CardDescription className="mt-1">{team.description || `@${team.slug}`}</CardDescription>
          </div>
          <div className="hidden text-right text-xs text-muted-foreground sm:block">
            <div>{t('owner')}: {team.ownerName}</div>
            <div className="mt-1">{t('createdAt')}: {fmt(team.createdAt)}</div>
          </div>
        </CardHeader>
      </Card>

      <div className="flex items-center justify-between border-b">
        <nav className="flex gap-1">
          {tabs.map((tb) => (
            <button key={tb.key} type="button" onClick={() => setTab(tb.key)} className={cn('-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors', tab === tb.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>{tb.label}</button>
          ))}
        </nav>
        {tab === 'invitations' && (
          <Dialog open={inviteOpen} onOpenChange={(o) => { if (!o && inviteMut.isPending) return; setInviteOpen(o); if (!o) { setInvitee(''); setInviteErr(null) } }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" />{t('inviteMember')}</Button></DialogTrigger>
            <DialogContent>
              <form onSubmit={handleInvite} className="space-y-4">
                <DialogHeader><DialogTitle>{t('inviteMember')}</DialogTitle><DialogDescription>{t('inviteMemberDesc')}</DialogDescription></DialogHeader>
                {inviteErr && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{inviteErr}</div>}
                <div className="space-y-2"><Label htmlFor="invitee">{t('invitee')}</Label><Input id="invitee" value={invitee} onChange={(e) => setInvitee(e.target.value)} placeholder={t('inviteePlaceholder')} autoFocus /></div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setInviteOpen(false)} disabled={inviteMut.isPending}>{tc('cancel')}</Button>
                  <Button type="submit" disabled={inviteMut.isPending}>{inviteMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{t('sendInvite')}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {tab === 'members' && (membersQ.isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />{t('loading')}</div>
      ) : membersQ.data?.length ? (
        <div className="space-y-2">
          {membersQ.data.map((m) => {
            const RoleIcon = ROLE_ICON[m.role]
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-md border bg-card px-4 py-3">
                <Avatar src={m.avatar} name={m.nickname} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="truncate text-sm font-medium">{m.nickname}</span><span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs', ROLE_BADGE[m.role])}><RoleIcon className="h-3 w-3" />{t(`roles.${m.role}`)}</span></div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{t('joinedAt')}: {fmt(m.joinedAt)}</div>
                </div>
                {m.role !== 'owner' && (
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => roleMut.mutate({ memberId: m.userId, role: m.role === 'admin' ? 'member' : 'admin' })} disabled={roleMut.isPending}>{m.role === 'admin' ? t('makeMember') : t('makeAdmin')}</Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => removeMut.mutate(m.userId)} disabled={removeMut.isPending} title={t('removeMember')}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">{t('noMembers')}</div>)}

      {tab === 'invitations' && (invitesQ.isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />{t('loading')}</div>
      ) : invitesQ.data?.length ? (
        <div className="space-y-2">
          {invitesQ.data.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 rounded-md border bg-card px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"><Mail className="h-4 w-4 text-muted-foreground" /></div>
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{inv.invitee}</div><div className="mt-0.5 text-xs text-muted-foreground">{t('expiresAt')}: {fmt(inv.expiresAt)}</div></div>
              <span className={cn('rounded px-1.5 py-0.5 text-xs', inv.status === 'pending' ? 'bg-amber-500/10 text-amber-600' : inv.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>{t(`status.${inv.status}`)}</span>
              {inv.status === 'pending' && <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => cancelMut.mutate(inv.id)} disabled={cancelMut.isPending}>{t('cancelInvite')}</Button>}
            </div>
          ))}
        </div>
      ) : <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">{t('noInvitations')}</div>)}

      {tab === 'settings' && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t('editTeam')}</CardTitle><CardDescription>{t('editTeamDesc')}</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={handleEdit} className="space-y-4">
              {editErr && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{editErr}</div>}
              <div className="space-y-2"><Label htmlFor="edit-name">{t('name')}</Label><Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={64} /></div>
              <div className="space-y-2"><Label htmlFor="edit-desc">{t('description')}</Label><textarea id="edit-desc" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} maxLength={500} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" /></div>
              <Button type="submit" disabled={updateMut.isPending}>{updateMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{t('save')}</Button>
            </form>
            <div className="mt-8 border-t pt-6">
              <h3 className="text-sm font-semibold text-destructive">{t('dangerZone')}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{t('deleteTeamDesc')}</p>
              <Button variant="outline" className="mt-3 border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => { if (window.confirm(t('deleteConfirm'))) deleteMut.mutate() }} disabled={deleteMut.isPending}>{deleteMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}<Trash2 className="h-4 w-4" />{t('deleteTeam')}</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
