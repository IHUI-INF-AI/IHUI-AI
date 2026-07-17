'use client'

import { Loader2 } from 'lucide-react'
import { Checkbox } from '@ihui/ui'
import { cn } from '@/lib/utils'

import { th } from './helpers'
import type { UnallocUser } from './types'
import { formatDate } from '@/lib/date-utils'

interface Props {
  list: UnallocUser[]
  isLoading: boolean
  selected: Set<string>
  onToggleAll: () => void
  onToggleOne: (id: string) => void
}

export function SelectUserTable({ list, isLoading, selected, onToggleAll, onToggleOne }: Props) {
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
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                暂无可授权用户
              </td>
            </tr>
          ) : (
            list.map((u) => (
              <tr
                key={u.id}
                className="cursor-pointer transition-colors hover:bg-muted/30"
                onClick={() => onToggleOne(u.id)}
              >
                <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
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
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
