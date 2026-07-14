'use client'

import { useTranslations } from 'next-intl'
import { Users, Eye, Trash2 } from 'lucide-react'
import { Button, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { Avatar } from '@/components/data/Avatar'
import { Skeleton } from '@/components/common'
import { cn } from '@/lib/utils'
import { selectClass } from './helpers'
import type { AdminUser } from './types'

interface Props {
  list: AdminUser[]
  isLoading: boolean
  error: Error | null
  patchPending: boolean
  dateFmt: Intl.DateTimeFormat
  onQuickView: (u: AdminUser) => void
  onDetail: (u: AdminUser) => void
  onRoleChange: (id: string, role: number) => void
  onStatusToggle: (u: AdminUser) => void
  onDelete: (u: AdminUser) => void
}

export function UserTable({
  list,
  isLoading,
  error,
  patchPending,
  dateFmt,
  onQuickView,
  onDetail,
  onRoleChange,
  onStatusToggle,
  onDelete,
}: Props) {
  const t = useTranslations('admin.users')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">{t('nickname')}</th>
            <th className="px-4 py-2.5 font-medium">
              {t('phone')} / {t('email')}
            </th>
            <th className="px-4 py-2.5 font-medium">{t('role')}</th>
            <th className="px-4 py-2.5 font-medium">{t('status')}</th>
            <th className="px-4 py-2.5 font-medium">{t('createdAt')}</th>
            <th className="px-4 py-2.5 text-right font-medium">{t('actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={6} className="px-4 py-4">
                <Skeleton variant="list" count={5} />
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-destructive">
                {error.message}
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </td>
            </tr>
          ) : (
            list.map((u) => {
              const isAdmin = (u.roleId ?? 0) >= 1
              const isActive = (u.status ?? 0) >= 1
              const name = u.nickname || u.phone || u.email || 'U'
              return (
                <tr key={u.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <button className="flex items-center gap-2" onClick={() => onQuickView(u)}>
                      <Avatar src={u.avatar ?? undefined} name={name} size="sm" />
                      <span className="font-medium hover:text-primary">{name}</span>
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    <div className="text-xs">{u.phone || '-'}</div>
                    <div className="text-xs text-muted-foreground/80">{u.email || '-'}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Select
                      value={isAdmin ? '1' : '0'}
                      onValueChange={(v) => onRoleChange(u.id, Number(v))}
                    >
                      <SelectTrigger
                        className={cn(
                          selectClass,
                          isAdmin ? 'border-primary/30 text-primary' : 'text-muted-foreground',
                        )}
                        aria-label={t('setRole')}
                        disabled={patchPending}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">{t('roleUser')}</SelectItem>
                        <SelectItem value="1">{t('roleAdmin')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        isActive
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          isActive ? 'bg-emerald-500' : 'bg-muted-foreground',
                        )}
                      />
                      {isActive ? t('statusActive') : t('statusDisabled')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {u.createdAt ? dateFmt.format(new Date(u.createdAt)) : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDetail(u)}
                        aria-label={t('view')}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={patchPending}
                        onClick={() => onStatusToggle(u)}
                      >
                        {isActive ? t('disable') : t('enable')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDelete(u)}
                        aria-label="删除"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
