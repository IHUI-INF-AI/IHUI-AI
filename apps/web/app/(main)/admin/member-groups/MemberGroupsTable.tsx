'use client'

import { Loader2, Users, Pencil, Trash2, UserPlus } from 'lucide-react'
import { Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { formatTime } from './helpers'
import type { MemberGroup } from './types'

const COLSPAN = 7

interface Props {
  list: MemberGroup[]
  isLoading: boolean
  onEdit: (item: MemberGroup) => void
  onDelete: (id: string) => void
  onMembers: (item: MemberGroup) => void
}

export function MemberGroupsTable({ list, isLoading, onEdit, onDelete, onMembers }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">名称</TableHead>
            <TableHead className="px-4 py-2.5">类型</TableHead>
            <TableHead className="px-4 py-2.5">描述</TableHead>
            <TableHead className="px-4 py-2.5">成员数</TableHead>
            <TableHead className="px-4 py-2.5">状态</TableHead>
            <TableHead className="px-4 py-2.5">创建时间</TableHead>
            <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                加载中...
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                暂无数据
              </TableCell>
            </TableRow>
          ) : (
            list.map((item) => (
              <TableRow key={item.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-medium">{item.name}</TableCell>
                <TableCell className="px-4 py-2.5">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{item.type}</code>
                </TableCell>
                <TableCell className="max-w-xs truncate px-4 py-2.5 text-muted-foreground">
                  {item.description ?? '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5">{item.memberCount}</TableCell>
                <TableCell className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                      item.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {item.status === 'active' ? '启用' : '禁用'}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                  {formatTime(item.createdAt)}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onMembers(item)}
                      title="成员管理"
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onEdit(item)} title="编辑">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(item.id)}
                      title="删除"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
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
