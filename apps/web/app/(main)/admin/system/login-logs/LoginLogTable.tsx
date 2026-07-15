'use client'

import { Loader2 } from 'lucide-react'
import { Checkbox } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { th } from './helpers'
import type { LoginLog } from './types'
import { formatDate } from '@/lib/date-utils'

interface Props {
  list: LoginLog[]
  isLoading: boolean
  selected: Set<string>
  sort: { col: string; dir: 'asc' | 'desc' }
  onToggleAll: () => void
  onToggleOne: (id: string) => void
  onSort: (col: string) => void
}

export function LoginLogTable({
  list,
  isLoading,
  selected,
  sort,
  onToggleAll,
  onToggleOne,
  onSort,
}: Props) {
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
            <th className={th}>ID</th>
            <th className={th}>用户</th>
            <th className={th}>类型</th>
            <th className={th}>平台</th>
            <th className={th}>IP</th>
            <th className={th}>位置</th>
            <th className={th}>UA</th>
            <th
              className={cn(th, 'cursor-pointer select-none')}
              onClick={() => onSort('loginTime')}
            >
              登录时间 {sort.col === 'loginTime' && (sort.dir === 'desc' ? '↓' : '↑')}
            </th>
            <th className={th}>消息</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                暂无数据
              </td>
            </tr>
          ) : (
            list.map((l) => (
              <tr key={l.id} className="transition-colors hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <Checkbox
                    checked={selected.has(l.id)}
                    onCheckedChange={() => onToggleOne(l.id)}
                  />
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.id}</td>
                <td className="px-4 py-2.5 font-medium">{l.userUuid}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{l.loginType}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{l.platform}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{l.ip}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{l.location}</td>
                <td
                  className="max-w-[200px] truncate px-4 py-2.5 text-xs text-muted-foreground"
                  title={l.userAgent}
                >
                  {l.userAgent}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                  {l.loginTime ? formatDate(l.loginTime) : '-'}
                </td>
                <td
                  className="max-w-[200px] truncate px-4 py-2.5 text-xs text-muted-foreground"
                  title={l.message}
                >
                  {l.message}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
