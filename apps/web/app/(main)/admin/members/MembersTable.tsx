'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Users, CheckCircle2, XCircle, Ban, Unlock, KeyRound, Trash2 } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/common'
import { type Member, type MemberAction, api, statusBadgeClass, statusDotClass } from './types'

export function MembersTable({
  members,
  isLoading,
  error,
  levelMap,
  onReset,
}: {
  members: Member[]
  isLoading: boolean
  error: unknown
  levelMap: Map<string, string>
  onReset: (m: Member) => void
}) {
  const t = useTranslations('admin.members')
  const qc = useQueryClient()

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

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      api(`/api/admin/members?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'members'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function handleDelete(member: Member) {
    if (!window.confirm(t('deleteConfirm'))) return
    deleteMut.mutate(member.id)
  }

  function statusLabel(status: number) {
    if (status === 1) return t('statusActive')
    if (status === 2) return t('statusSealed')
    return t('statusPending')
  }

  return (
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
              <TableCell colSpan={6} className="px-4 py-4">
                <Skeleton variant="list" count={5} />
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
                      <span className="inline-flex items-center rounded-md bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-600 dark:text-sky-400">
                        {t('bound')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    {member.levelId && levelMap.has(member.levelId) ? (
                      <span className="inline-flex items-center rounded-md bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400">
                        {levelMap.get(member.levelId)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
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
                        onClick={() => onReset(member)}
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
  )
}
