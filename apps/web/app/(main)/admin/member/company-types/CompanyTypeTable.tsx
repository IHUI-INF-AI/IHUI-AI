'use client'

import { Loader2, Edit, Trash2, Building2 } from 'lucide-react'
import { Button, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import type { CompanyType } from './types'

interface Props {
  list: CompanyType[]
  isLoading: boolean
  error: Error | null
  deletePending: boolean
  onEdit: (type: CompanyType) => void
  onDelete: (type: CompanyType) => void
}

export function CompanyTypeTable({
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
            <TableHead className="px-4 py-2.5">排序</TableHead>
            <TableHead className="px-4 py-2.5">状态</TableHead>
            <TableHead className="px-4 py-2.5">创建时间</TableHead>
            <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                加载中...
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={6} className="px-4 py-10 text-center text-destructive">
                {error.message}
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                <Building2 className="mx-auto mb-2 h-8 w-8 opacity-40" />
                暂无数据
              </TableCell>
            </TableRow>
          ) : (
            list.map((type) => {
              const enabled = type.status === 1
              return (
                <TableRow key={type.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">{type.name}</TableCell>
                  <TableCell className="px-4 py-2.5">{type.description ?? '—'}</TableCell>
                  <TableCell className="px-4 py-2.5">{type.sort}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                        enabled
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          enabled ? 'bg-emerald-500' : 'bg-muted-foreground',
                        )}
                      />
                      {enabled ? '启用' : '禁用'}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                    {type.createdAt ? new Date(type.createdAt).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip content="编辑">
                        <Button variant="ghost" size="sm" onClick={() => onEdit(type)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                      <Tooltip content="删除">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(type)}
                          className="text-destructive hover:text-destructive"
                          disabled={deletePending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
