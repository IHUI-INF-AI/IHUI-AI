'use client'

import { Loader2, Edit, Trash2, CalendarClock } from 'lucide-react'
import { Button, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import type { ZhsActivity } from './types'

interface Props {
  list: ZhsActivity[]
  isLoading: boolean
  onEdit: (item: ZhsActivity) => void
  onDelete: (item: ZhsActivity) => void
}

export function ZhsActivityTable({ list, isLoading, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">活动名称</TableHead>
            <TableHead className="px-4 py-2.5">活动规则</TableHead>
            <TableHead className="px-4 py-2.5">起始金额</TableHead>
            <TableHead className="px-4 py-2.5">倍数</TableHead>
            <TableHead className="px-4 py-2.5">开始时间</TableHead>
            <TableHead className="px-4 py-2.5">结束时间</TableHead>
            <TableHead className="px-4 py-2.5">状态</TableHead>
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
                <CalendarClock className="mx-auto mb-2 h-8 w-8 opacity-40" />
                暂无数据
              </TableCell>
            </TableRow>
          ) : (
            list.map((item) => (
              <TableRow key={item.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-medium">
                  {item.activityName || '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5 max-w-[200px] truncate text-muted-foreground">
                  {item.activityRule || '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5">{item.beginAmount || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{item.multiple || '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-muted-foreground">
                  {item.beginTime || '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-muted-foreground">
                  {item.endTime || '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  <span
                    className={
                      item.status === 1
                        ? 'inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600'
                        : 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                    }
                  >
                    {item.status === 1 ? '启用' : '关闭'}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <HasPermi code="ai:zhs_activity:edit">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(item)} title="编辑">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </HasPermi>
                    <HasPermi code="ai:zhs_activity:remove">
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
