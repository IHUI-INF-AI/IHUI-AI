'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Users, Plus } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { TeamList } from './TeamList'
import { TeamDialog } from './TeamDialog'
import type { TeamMember } from './types'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function TeamPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editId, setEditId] = React.useState<string | null>(null)
  const [email, setEmail] = React.useState('')
  const [role, setRole] = React.useState<TeamMember['role']>('developer')

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const {
    data: list = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['developer', 'team'],
    queryFn: () => api<TeamMember[]>('/api/developer/team').catch(() => [] as TeamMember[]),
  })

  const inviteMut = useMutation({
    mutationFn: () =>
      api('/api/developer/team/invite', {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer', 'team'] })
      closeDialog()
      toast.success('邀请已发送')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const updateRoleMut = useMutation({
    mutationFn: (m: TeamMember) =>
      api(`/api/developer/team/${m.id}`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer', 'team'] })
      closeDialog()
      toast.success('角色已更新')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const removeMut = useMutation({
    mutationFn: (id: string) => api(`/api/developer/team/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer', 'team'] })
      toast.success('成员已移除')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function closeDialog() {
    setOpen(false)
    setEditId(null)
    setEmail('')
    setRole('developer')
  }

  function openEdit(m: TeamMember) {
    setEditId(m.id)
    setEmail(m.email)
    setRole(m.role === 'owner' ? 'admin' : m.role)
    setOpen(true)
  }

  function handleSave() {
    if (editId) {
      const m = list.find((x) => x.id === editId)
      if (m) updateRoleMut.mutate(m)
    } else {
      inviteMut.mutate()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Users className="h-5 w-5 text-primary" />
            团队管理
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">成员列表、邀请与角色权限</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            closeDialog()
            setOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          邀请成员
        </Button>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      <TeamList
        list={list}
        isLoading={isLoading}
        dateFmt={dateFmt}
        removePending={removeMut.isPending}
        onEdit={openEdit}
        onRemove={(id) => removeMut.mutate(id)}
      />

      <TeamDialog
        open={open}
        isEdit={!!editId}
        email={email}
        role={role}
        isPending={inviteMut.isPending || updateRoleMut.isPending}
        onOpenChange={(v) => !v && closeDialog()}
        onEmailChange={setEmail}
        onRoleChange={setRole}
        onSave={handleSave}
        onCancel={closeDialog}
      />
    </div>
  )
}
