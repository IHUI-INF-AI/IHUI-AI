'use client'
import { Edit, Trash2, Loader2, Globe } from 'lucide-react'
import { HasPermi } from '@/components/auth/HasPermi'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui'
import { PERM, fmt } from './helpers'
import type { EduPlatform } from './types'

interface Props {
  rows: EduPlatform[]
  isLoading: boolean
  error: Error | null
  onEdit: (r: EduPlatform) => void
  onDelete: (r: EduPlatform) => void
  deletePending: boolean
}

const COLSPAN = 9

export function PlatformTable({ rows, isLoading, error, onEdit, onDelete, deletePending }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">编码</TableHead>
            <TableHead className="px-4 py-2.5">名称</TableHead>
            <TableHead className="px-4 py-2.5">域名</TableHead>
            <TableHead className="px-4 py-2.5">图片</TableHead>
            <TableHead className="px-4 py-2.5">类型</TableHead>
            <TableHead className="px-4 py-2.5">排序</TableHead>
            <TableHead className="px-4 py-2.5">创建人</TableHead>
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
          ) : error ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-destructive">
                {error.message}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <Globe className="mx-auto mb-2 h-8 w-8 opacity-40" />
                暂无数据
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-medium">{r.code}</TableCell>
                <TableCell className="px-4 py-2.5">{r.name}</TableCell>
                <TableCell className="px-4 py-2.5 text-muted-foreground">
                  {r.domain ?? '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  {r.binding ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.binding} alt="" className="h-10 w-10 rounded object-cover" />
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell className="px-4 py-2.5">{r.type ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{r.sort ?? 0}</TableCell>
                <TableCell className="px-4 py-2.5">{r.creator ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{fmt(r.createdAt)}</TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <HasPermi code={`${PERM}edit`}>
                      <Button variant="ghost" size="sm" onClick={() => onEdit(r)} title="编辑">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </HasPermi>
                    <HasPermi code={`${PERM}remove`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(r)}
                        title="删除"
                        className="text-destructive hover:text-destructive"
                        disabled={deletePending}
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
