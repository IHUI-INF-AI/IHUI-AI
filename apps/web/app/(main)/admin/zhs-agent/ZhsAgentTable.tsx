'use client'

import { Loader2, Edit, Trash2, Bot } from 'lucide-react'
import { Button, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui-react'
import { HasPermi } from '@/components/auth/HasPermi'
import { Tooltip } from '@/components/feedback'
import type { ZhsAgent } from './types'

interface Props {
  list: ZhsAgent[]
  isLoading: boolean
  onEdit: (item: ZhsAgent) => void
  onDelete: (item: ZhsAgent) => void
}

export function ZhsAgentTable({ list, isLoading, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">名称</TableHead>
            <TableHead className="px-4 py-2.5">图片</TableHead>
            <TableHead className="px-4 py-2.5">消耗</TableHead>
            <TableHead className="px-4 py-2.5">排序</TableHead>
            <TableHead className="px-4 py-2.5">价格</TableHead>
            <TableHead className="px-4 py-2.5">类型</TableHead>
            <TableHead className="px-4 py-2.5">热度</TableHead>
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
                <Bot className="mx-auto mb-2 h-8 w-8 opacity-40" />
                暂无数据
              </TableCell>
            </TableRow>
          ) : (
            list.map((item) => (
              <TableRow key={item.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-medium">{item.name || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name || 'Agent'}
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="px-4 py-2.5">{item.consume || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{item.seqencing ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{item.price || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{item.typeName || item.type || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{item.heat || '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <HasPermi code="ai:zhsagent:edit">
                      <Tooltip content="编辑">
                        <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                    </HasPermi>
                    <HasPermi code="ai:zhsagent:remove">
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
