'use client'

import { Loader2, Edit, Trash2, LayoutTemplate } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui'
import type { Template } from './types'

interface Props {
  list: Template[]
  isLoading: boolean
  error: unknown
  deletePending: boolean
  onEdit: (t: Template) => void
  onDelete: (t: Template) => void
}

export function PapersTemplateTable({
  list,
  isLoading,
  error,
  deletePending,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">名称</TableHead>
            <TableHead className="px-4 py-2.5">描述</TableHead>
            <TableHead className="px-4 py-2.5">创建时间</TableHead>
            <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                加载中...
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                <LayoutTemplate className="mx-auto mb-2 h-8 w-8 opacity-40" />
                暂无模板（需后端端点）
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                <LayoutTemplate className="mx-auto mb-2 h-8 w-8 opacity-40" />
                暂无模板
              </TableCell>
            </TableRow>
          ) : (
            list.map((t) => (
              <TableRow key={t.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-medium">{t.name}</TableCell>
                <TableCell className="max-w-xs break-words px-4 py-2.5 text-muted-foreground">
                  {t.description ?? '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{t.createdAt}</TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(t)} title="编辑">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(t)}
                      title="删除"
                      className="text-destructive hover:text-destructive"
                      disabled={deletePending}
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
