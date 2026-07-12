'use client'

import { Loader2, ClipboardCheck, Eye } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { PERM, fmt, statusText, statusClass } from './helpers'
import type { Audit } from './types'

interface Props {
  list: Audit[]
  isLoading: boolean
  error: unknown
  onAudit: (item: Audit) => void
}

export function CourseAuditTable({ list, isLoading, error, onAudit }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">ID</TableHead>
            <TableHead className="px-4 py-2.5">类型</TableHead>
            <TableHead className="px-4 py-2.5">操作</TableHead>
            <TableHead className="px-4 py-2.5">源ID</TableHead>
            <TableHead className="px-4 py-2.5">目标ID</TableHead>
            <TableHead className="px-4 py-2.5">状态</TableHead>
            <TableHead className="px-4 py-2.5">创建人</TableHead>
            <TableHead className="px-4 py-2.5">创建时间</TableHead>
            <TableHead className="px-4 py-2.5">更新人</TableHead>
            <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                加载中...
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={10} className="px-4 py-10 text-center text-destructive">
                {(error as Error).message}
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                <ClipboardCheck className="mx-auto mb-2 h-8 w-8 opacity-40" />
                暂无数据
              </TableCell>
            </TableRow>
          ) : (
            list.map((r) => (
              <TableRow key={r.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5">{r.id}</TableCell>
                <TableCell className="px-4 py-2.5">{r.type === 0 ? '课程' : '视频'}</TableCell>
                <TableCell className="px-4 py-2.5">{r.operate}</TableCell>
                <TableCell className="px-4 py-2.5">{r.sourceId}</TableCell>
                <TableCell className="px-4 py-2.5">{r.targetId}</TableCell>
                <TableCell className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                      statusClass(r.status),
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        r.status === 3
                          ? 'bg-emerald-500'
                          : r.status === 1
                            ? 'bg-amber-500'
                            : 'bg-muted-foreground',
                      )}
                    />
                    {statusText(r.status)}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5">{r.creator ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{fmt(r.createdAt)}</TableCell>
                <TableCell className="px-4 py-2.5">{r.updator ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <HasPermi code={`${PERM}edit`}>
                    <Button variant="ghost" size="sm" onClick={() => onAudit(r)} title="审核对比">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </HasPermi>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
