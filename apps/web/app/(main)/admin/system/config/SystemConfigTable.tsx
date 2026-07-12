'use client'

import { Loader2, Edit, Trash2 } from 'lucide-react'
import { Button, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { CATEGORY_LABEL } from './helpers'
import type { SystemConfig } from './types'

interface Props {
  list: SystemConfig[]
  isLoading: boolean
  onEdit: (c: SystemConfig) => void
  onDelete: (id: string) => void
}

export function SystemConfigTable({ list, isLoading, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-xs uppercase">键</TableHead>
            <TableHead className="text-xs uppercase">值</TableHead>
            <TableHead className="text-xs uppercase">类型</TableHead>
            <TableHead className="text-xs uppercase">分类</TableHead>
            <TableHead className="text-xs uppercase">公开</TableHead>
            <TableHead className="text-xs uppercase">更新时间</TableHead>
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
                暂无配置
              </TableCell>
            </TableRow>
          ) : (
            list.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="font-medium">{c.key}</div>
                  {c.description && (
                    <div className="text-xs text-muted-foreground">{c.description}</div>
                  )}
                </TableCell>
                <TableCell
                  className="max-w-[200px] break-words font-mono text-xs text-muted-foreground"
                  title={c.value}
                >
                  {c.value || '-'}
                </TableCell>
                <TableCell>
                  <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs">
                    {c.type}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {CATEGORY_LABEL[c.category]}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                      c.isPublic
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        c.isPublic ? 'bg-emerald-500' : 'bg-muted-foreground/50',
                      )}
                    />
                    {c.isPublic ? '公开' : '私有'}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {c.updatedAt ? new Date(c.updatedAt).toLocaleString() : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => onEdit(c)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm('确认删除？')) onDelete(c.id)
                      }}
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
