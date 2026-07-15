'use client'

import { Loader2, Trash2, Pencil } from 'lucide-react'
import { Card, CardContent, Button } from '@ihui/ui'
import { Avatar } from '@/components/data/Avatar'
import { cn } from '@/lib/utils'
import { ROLE_CONFIG } from './types'
import type { TeamMember } from './types'

interface Props {
  list: TeamMember[]
  isLoading: boolean
  dateFmt: Intl.DateTimeFormat
  removePending: boolean
  onEdit: (m: TeamMember) => void
  onRemove: (id: string) => void
}

export function TeamList({ list, isLoading, dateFmt, removePending, onEdit, onRemove }: Props) {
  return (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : list.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">暂无团队成员</p>
        ) : (
          <div className="divide-y">
            {list.map((m) => {
              const cfg = ROLE_CONFIG[m.role]
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar src={m.avatar} name={m.nickname} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{m.nickname}</p>
                      <span
                        className={cn('rounded px-1.5 py-0.5 text-xs font-medium', cfg.cls)}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.email} · 加入于 {dateFmt.format(new Date(m.joinedAt))}
                    </p>
                  </div>
                  {m.role !== 'owner' && (
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant="outline" onClick={() => onEdit(m)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => confirm('确认移除该成员?') && onRemove(m.id)}
                        disabled={removePending}
                        className="text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
