'use client'

import { Loader2, Edit, Trash2, MessageSquare } from 'lucide-react'
import { Button, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui-react'
import { HasPermi } from '@/components/auth/HasPermi'
import type { UserAgentContext } from './types'

interface Props {
  list: UserAgentContext[]
  isLoading: boolean
  onEdit: (item: UserAgentContext) => void
  onDelete: (item: UserAgentContext) => void
}

export function UserAgentContextTable({ list, isLoading, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">AgentID</TableHead>
            <TableHead className="px-4 py-2.5">Agent名称</TableHead>
            <TableHead className="px-4 py-2.5">用户UUID</TableHead>
            <TableHead className="px-4 py-2.5">用户名</TableHead>
            <TableHead className="px-4 py-2.5">问题</TableHead>
            <TableHead className="px-4 py-2.5">回答</TableHead>
            <TableHead className="px-4 py-2.5">发送时间</TableHead>
            <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                加载中…
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" />
                暂无数据
              </TableCell>
            </TableRow>
          ) : (
            list.map((item) => (
              <TableRow key={item.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-medium">{item.agentId || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{item.agentName || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{item.userUuid || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{item.userName || '-'}</TableCell>
                <TableCell className="px-4 py-2.5 max-w-[200px] truncate">
                  {item.problem || '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5 max-w-[200px] truncate text-muted-foreground">
                  {item.answer || '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-muted-foreground">
                  {item.sendTime || '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <HasPermi code="ai:useragentcontext:edit">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(item)} title="编辑">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </HasPermi>
                    <HasPermi code="ai:useragentcontext:remove">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(item)}
                        title="删除"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </HasPermi>
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
