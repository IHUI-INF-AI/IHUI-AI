'use client'

import { Loader2, UserMinus } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button, Checkbox } from '@ihui/ui-react'
import { HasPermi } from '@/components/auth/HasPermi'
import { th } from './helpers'
import type { AuthUser } from './types'
import { formatDate } from '@/lib/date-utils'

interface AuthUserTableProps {
  list: AuthUser[]
  isLoading: boolean
  selected: Set<string>
  cancelPending: boolean
  onToggleAll: () => void
  onToggleOne: (id: string) => void
  onCancel: (u: AuthUser) => void
}

export function AuthUserTable({
  list,
  isLoading,
  selected,
  cancelPending,
  onToggleAll,
  onToggleOne,
  onCancel,
}: AuthUserTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="w-10 px-4 py-2.5">
              <Checkbox
                checked={list.length > 0 && selected.size === list.length}
                onCheckedChange={onToggleAll}
              />
            </th>
            <th className={th}>用户名</th>
            <th className={th}>昵称</th>
            <th className={th}>邮箱</th>
            <th className={th}>手机号</th>
            <th className={th}>状态</th>
            <th className={th}>创建时间</th>
            <th className={th}>操作</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                暂无数据
              </td>
            </tr>
          ) : (
            list.map((u) => (
              <tr key={u.id} className="transition-colors hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <Checkbox
                    checked={selected.has(u.id)}
                    onCheckedChange={() => onToggleOne(u.id)}
                  />
                </td>
                <td className="px-4 py-2.5 font-medium">{u.userName}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{u.nickName}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{u.email || '-'}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {u.phonenumber || '-'}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex rounded-md px-2 py-0.5 text-xs',
                      u.status === 0
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {u.status === 0 ? '正常' : '停用'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                  {u.createdAt ? formatDate(u.createdAt) : '-'}
                </td>
                <td className="px-4 py-2.5">
                  <HasPermi code="system:role:edit">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={cancelPending}
                      onClick={() => onCancel(u)}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                      取消授权
                    </Button>
                  </HasPermi>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
