'use client'

import { useTranslations } from 'next-intl'
import { Loader2, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { fmt } from './helpers'
import { ROLE_BADGE, ROLE_ICON } from './types'
import type { TeamMember, Role } from './types'

interface Props {
  isLoading: boolean
  members: TeamMember[] | undefined
  onRoleChange: (memberId: string, role: Role) => void
  roleChangePending: boolean
  onRemove: (memberId: string) => void
  removePending: boolean
}

function Avatar({ src, name }: { src?: string; name: string }) {
  if (src) {
    return <Image src={src} alt={name} width={32} height={32} className="h-8 w-8 rounded-full" />
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-medium">
      {(name[0] ?? 'U').toUpperCase()}
    </div>
  )
}

export function TeamMembersList({
  isLoading,
  members,
  onRoleChange,
  roleChangePending,
  onRemove,
  removePending,
}: Props) {
  const t = useTranslations('teams')
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }
  if (!members?.length) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        {t('noMembers')}
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {members.map((m) => {
        const RoleIcon = ROLE_ICON[m.role]
        return (
          <div key={m.id} className="flex items-center gap-3 rounded-md border bg-card px-4 py-3">
            <Avatar src={m.avatar} name={m.nickname} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="break-words text-sm font-medium">{m.nickname}</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs',
                    ROLE_BADGE[m.role],
                  )}
                >
                  <RoleIcon className="h-3 w-3" />
                  {t(`roles.${m.role}`)}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {t('joinedAt')}: {fmt(m.joinedAt)}
              </div>
            </div>
            {m.role !== 'owner' && (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRoleChange(m.userId, m.role === 'admin' ? 'member' : 'admin')}
                  disabled={roleChangePending}
                >
                  {m.role === 'admin' ? t('makeMember') : t('makeAdmin')}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  onClick={() => onRemove(m.userId)}
                  disabled={removePending}
                  title={t('removeMember')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
