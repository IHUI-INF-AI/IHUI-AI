'use client'

import { Loader2, Edit, Trash2, FileStack } from 'lucide-react'
import {
  Button,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Checkbox,
} from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import { PERM, LEVEL_TEXT, AUDIT_TEXT, badgeCls } from './helpers'
import type { Video } from './types'

const COLSPAN = 14

interface Props {
  rows: Video[]
  isLoading: boolean
  error: Error | null
  ids: string[]
  allChecked: boolean
  onToggleAll: () => void
  onToggleOne: (id: string) => void
  onEdit: (r: Video) => void
  onDelete: (r: Video) => void
  deletePending: boolean
}

export function RecordedTable({
  rows,
  isLoading,
  error,
  ids,
  allChecked,
  onToggleAll,
  onToggleOne,
  onEdit,
  onDelete,
  deletePending,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-3 py-2.5 w-10">
              <Checkbox checked={allChecked} onCheckedChange={onToggleAll} />
            </TableHead>
            <TableHead className="px-4 py-2.5">ID</TableHead>
            <TableHead className="px-4 py-2.5">课程ID</TableHead>
            <TableHead className="px-4 py-2.5">封面</TableHead>
            <TableHead className="px-4 py-2.5">标题</TableHead>
            <TableHead className="px-4 py-2.5">讲师</TableHead>
            <TableHead className="px-4 py-2.5">时长</TableHead>
            <TableHead className="px-4 py-2.5">付费</TableHead>
            <TableHead className="px-4 py-2.5">金额</TableHead>
            <TableHead className="px-4 py-2.5">标签</TableHead>
            <TableHead className="px-4 py-2.5">难度</TableHead>
            <TableHead className="px-4 py-2.5">审核</TableHead>
            <TableHead className="px-4 py-2.5">创建人</TableHead>
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
                <FileStack className="mx-auto mb-2 h-8 w-8 opacity-40" />
                暂无视频
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.id} className="hover:bg-muted/30">
                <TableCell className="px-3 py-2.5">
                  <Checkbox
                    checked={ids.includes(r.id)}
                    onCheckedChange={() => onToggleOne(r.id)}
                  />
                </TableCell>
                <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">{r.id}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{r.courseId ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5">
                  {r.binding ? (
                    <img src={r.binding} alt="" className="h-10 w-10 rounded object-cover" />
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell className="px-4 py-2.5 font-medium">{r.title}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{r.lecturer ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{r.duration ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5">
                  <span className={badgeCls(r.isPay === 1)}>{r.isPay === 1 ? '付费' : '免费'}</span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{r.amount ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{r.label ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5">
                  <span className={badgeCls(r.status === 2)}>
                    {LEVEL_TEXT[r.status ?? 0] ?? String(r.status)}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  <span className={badgeCls(r.auditStatus === 4)}>
                    {AUDIT_TEXT[r.auditStatus ?? 0] ?? String(r.auditStatus)}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-xs">
                  {r.nickname ?? r.creator ?? '-'}
                </TableCell>
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
