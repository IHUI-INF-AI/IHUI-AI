'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

import { TeamInfoCard } from './TeamInfoCard'
import { InviteMemberDialog } from './InviteMemberDialog'
import { TeamMembersList } from './TeamMembersList'
import { TeamInvitationsList } from './TeamInvitationsList'
import { TeamSettingsPanel } from './TeamSettingsPanel'
import { api } from './helpers'
import type { Role, TeamDetail, TeamMember, Invitation } from './types'

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const t = useTranslations('teams')
  const qc = useQueryClient()

  const teamQ = useQuery({
    queryKey: ['teams', id],
    queryFn: () => api<{ team: TeamDetail }>(`/api/teams/${id}`).then((d) => d.team),
  })
  const membersQ = useQuery({
    queryKey: ['teams', id, 'members'],
    queryFn: () =>
      api<{ members: TeamMember[] }>(`/api/teams/${id}/members`).then((d) => d.members),
  })
  const invitesQ = useQuery({
    queryKey: ['teams', id, 'invitations'],
    queryFn: () =>
      api<{ invitations: Invitation[] }>(`/api/teams/${id}/invitations`).then((d) => d.invitations),
  })

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
    if (team && !inited) {
      setEditName(team.name)
      setEditDesc(team.description)
      setInited(true)
    }
  }, [team, inited])

  const inviteMut = useMutation({
    mutationFn: (v: string) =>
      api(`/api/teams/${id}/invitations`, { method: 'POST', body: JSON.stringify({ email: v }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams', id, 'invitations'] })
      setInviteOpen(false)
      setInvitee('')
      setInviteErr(null)
    },
    onError: (e: Error) => setInviteErr(e.message),
  })
  const removeMut = useMutation({
    mutationFn: (mId: string) => api(`/api/teams/${id}/members/${mId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams', id, 'members'] }),
  })
  const roleMut = useMutation({
    mutationFn: (p: { memberId: string; role: Role }) =>
      api(`/api/teams/${id}/members/${p.memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: p.role }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams', id, 'members'] }),
  })
  const cancelMut = useMutation({
    mutationFn: (iId: string) => api(`/api/teams/${id}/invitations/${iId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams', id, 'invitations'] }),
  })
  const updateMut = useMutation({
    mutationFn: () =>
      api(`/api/teams/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName, description: editDesc }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams', id] })
      qc.invalidateQueries({ queryKey: ['teams'] })
      setEditErr(null)
    },
    onError: (e: Error) => setEditErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: () => api(`/api/teams/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] })
      router.push('/teams')
    },
  })

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    setInviteErr(null)
    if (!invitee.trim()) {
      setInviteErr(t('inviteeRequired'))
      return
    }
    inviteMut.mutate(invitee.trim())
  }
  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault()
    setEditErr(null)
    if (!editName.trim()) {
      setEditErr(t('nameRequired'))
      return
    }
    updateMut.mutate()
  }
  const handleInviteDialogOpenChange = (o: boolean) => {
    if (!o && inviteMut.isPending) return
    setInviteOpen(o)
    if (!o) {
      setInvitee('')
      setInviteErr(null)
    }
  }
  const handleDeleteTeam = () => {
    if (window.confirm(t('deleteConfirm'))) deleteMut.mutate()
  }

  if (teamQ.isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  if (teamQ.error || !team)
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {(teamQ.error as Error)?.message ?? t('notFound')}
      </div>
    )

  const tabs = [
    { key: 'members' as const, label: t('tabMembers') },
    { key: 'invitations' as const, label: t('tabInvitations') },
    { key: 'settings' as const, label: t('tabSettings') },
  ]

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <button
        type="button"
        onClick={() => router.push('/teams')}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </button>

      <TeamInfoCard team={team} />

      <div className="flex items-center justify-between border-b">
        <nav className="flex gap-1">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                tab === tb.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tb.label}
            </button>
          ))}
        </nav>
        {tab === 'invitations' && (
          <InviteMemberDialog
            open={inviteOpen}
            onOpenChange={handleInviteDialogOpenChange}
            onCancel={() => setInviteOpen(false)}
            invitee={invitee}
            setInvitee={setInvitee}
            inviteErr={inviteErr}
            invitePending={inviteMut.isPending}
            onSubmit={handleInvite}
          />
        )}
      </div>

      <div key={tab} className="animate-in fade-in-0 duration-200">
        {tab === 'members' && (
          <TeamMembersList
            isLoading={membersQ.isLoading}
            members={membersQ.data}
            onRoleChange={(memberId, role) => roleMut.mutate({ memberId, role })}
            roleChangePending={roleMut.isPending}
            onRemove={(memberId) => removeMut.mutate(memberId)}
            removePending={removeMut.isPending}
          />
        )}

        {tab === 'invitations' && (
          <TeamInvitationsList
            isLoading={invitesQ.isLoading}
            invitations={invitesQ.data}
            onCancel={(invId) => cancelMut.mutate(invId)}
            cancelPending={cancelMut.isPending}
          />
        )}

        {tab === 'settings' && (
          <TeamSettingsPanel
            editName={editName}
            setEditName={setEditName}
            editDesc={editDesc}
            setEditDesc={setEditDesc}
            editErr={editErr}
            updatePending={updateMut.isPending}
            onSubmit={handleEdit}
            deletePending={deleteMut.isPending}
            onDelete={handleDeleteTeam}
          />
        )}
      </div>
    </div>
  )
}
