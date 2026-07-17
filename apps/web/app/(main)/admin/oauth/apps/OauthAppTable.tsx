'use client'

import { Loader2, Power, Trash2, ShieldCheck } from 'lucide-react'
import { Button, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { STATUS_LABEL, STATUS_STYLE } from './helpers'
import type { OAuthApp } from './types'

interface Props {
  list: OAuthApp[]
  isLoading: boolean
  togglePending: boolean
  onToggle: (a: OAuthApp) => void
  onDelete: (a: OAuthApp) => void
}

export function OauthAppTable({ list, isLoading, togglePending, onToggle, onDelete }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-xs uppercase">应用名称</TableHead>
            <TableHead className="text-xs uppercase">ClientID</TableHead>
            <TableHead className="text-xs uppercase">所属用户</TableHead>
            <TableHead className="text-xs uppercase">回调地址</TableHead>
            <TableHead className="text-xs uppercase">权限</TableHead>
            <TableHead className="text-xs uppercase">状态</TableHead>
            <TableHead className="text-right text-xs uppercase">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                暂无应用
              </TableCell>
            </TableRow>
          ) : (
            list.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell className="font-mono text-xs">{a.clientId}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {a.ownerName || a.ownerId}
                </TableCell>
                <TableCell className="max-w-[200px]">
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    {(a.redirectUris ?? []).slice(0, 2).map((u) => (
                      <div key={u} className="break-words">
                        {u}
                      </div>
                    ))}
                    {a.redirectUris.length > 2 && (
                      <div className="text-xs">+{a.redirectUris.length - 2}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(a.scopes ?? []).slice(0, 3).map((s) => (
                      <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {s}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs',
                      STATUS_STYLE[a.status],
                    )}
                  >
                    <ShieldCheck className="h-3 w-3" />
                    {STATUS_LABEL[a.status]}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onToggle(a)}
                      disabled={togglePending}
                    >
                      <Power className="h-3.5 w-3.5" />
                      {a.status === 'active' ? '禁用' : '启用'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDelete(a)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
