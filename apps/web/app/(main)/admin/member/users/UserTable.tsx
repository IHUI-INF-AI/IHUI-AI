'use client'

import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@ihui/ui'
import { cn } from '@/lib/utils'
import type { MemberUser } from './types'

interface Props {
  list: MemberUser[]
  isLoading: boolean
  patchPending: boolean
  deletePending: boolean
  onStatusToggle: (u: MemberUser) => void
  onDelete: (u: MemberUser) => void
}

export function UserTable({ list, isLoading, patchPending, deletePending, onStatusToggle, onDelete }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">用户</th>
            <th className="px-4 py-2.5 font-medium">联系方式</th>
            <th className="px-4 py-2.5 font-medium">等级</th>
            <th className="px-4 py-2.5 font-medium">状态</th>
            <th className="px-4 py-2.5 font-medium">注册时间</th>
            <th className="px-4 py-2.5 text-right font-medium">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                暂无用户
              </td>
            </tr>
          ) : (
            list.map((u) => {
              const statusVal = u.status ?? 0
              const isActive = statusVal === 1
              const isCancelled = statusVal === 3
              const levelLabel = ['普通', '白银', '黄金', '钻石'][u.level] ?? '普通'
              return (
                <tr key={u.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">
                    {u.nickname || u.phone || u.email || u.id}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    <div>{u.phone || '-'}</div>
                    <div className="text-muted-foreground/80">{u.email || '-'}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs',
                        u.level >= 2
                          ? 'bg-amber-500/10 text-amber-600'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {levelLabel}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                        isCancelled
                          ? 'bg-muted text-muted-foreground'
                          : isActive
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          isCancelled
                            ? 'bg-muted-foreground'
                            : isActive
                              ? 'bg-emerald-500'
                              : 'bg-muted-foreground',
                        )}
                      />
                      {isCancelled ? '已注销' : isActive ? '正常' : '禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={patchPending}
                        onClick={() => onStatusToggle(u)}
                      >
                        {isActive ? '禁用' : '启用'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={deletePending}
                        onClick={() => onDelete(u)}
                        className="text-destructive hover:text-destructive"
                        aria-label="删除用户"
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
