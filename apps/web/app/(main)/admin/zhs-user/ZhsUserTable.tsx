'use client'

import { Loader2, Edit, Trash2, Users } from 'lucide-react'
import { Button, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui-react'
import { HasPermi } from '@/components/auth/HasPermi'
import { Tooltip } from '@/components/feedback'
import type { ZhsUser } from './types'

interface Props {
  list: ZhsUser[]
  isLoading: boolean
  onEdit: (item: ZhsUser) => void
  onDelete: (item: ZhsUser) => void
}

export function ZhsUserTable({ list, isLoading, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">昵称</TableHead>
            <TableHead className="px-4 py-2.5">用户名</TableHead>
            <TableHead className="px-4 py-2.5">手机</TableHead>
            <TableHead className="px-4 py-2.5">邀请码</TableHead>
            <TableHead className="px-4 py-2.5">余额</TableHead>
            <TableHead className="px-4 py-2.5">总收益</TableHead>
            <TableHead className="px-4 py-2.5">VIP</TableHead>
            <TableHead className="px-4 py-2.5">身份类型</TableHead>
            <TableHead className="px-4 py-2.5">创建时间</TableHead>
            <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                加载中…
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                暂无数据
              </TableCell>
            </TableRow>
          ) : (
            list.map((item) => (
              <TableRow key={item.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-medium">{item.nickname || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{item.userName || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{item.phone || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{item.inviteCode || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{item.balance || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{item.totalEarnings || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{item.isVip || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{item.identityTypy || '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-muted-foreground">
                  {item.createdAt || '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <HasPermi code="ai:zhs_user:edit">
                      <Tooltip content="编辑">
                        <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                    </HasPermi>
                    <HasPermi code="ai:zhs_user:remove">
                      <Tooltip content="删除">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(item)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </Tooltip>
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
