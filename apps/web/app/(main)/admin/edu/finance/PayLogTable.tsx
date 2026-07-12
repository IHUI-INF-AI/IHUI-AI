'use client'
import { Edit, Trash2, Loader2, Wallet } from 'lucide-react'
import { HasPermi } from '@/components/auth/HasPermi'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  Checkbox,
} from '@ihui/ui'
import { PERM } from './helpers'
import type { PayLog } from './types'

interface Props {
  rows: PayLog[]
  isLoading: boolean
  error: Error | null
  ids: string[]
  allChecked: boolean
  onToggleAll: () => void
  onToggleOne: (id: string) => void
  onEdit: (r: PayLog) => void
  onDelete: (r: PayLog) => void
  deletePending: boolean
}

const COLSPAN = 11

export function PayLogTable({
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
            <TableHead className="px-4 py-2.5">用户UUID</TableHead>
            <TableHead className="px-4 py-2.5">课程ID</TableHead>
            <TableHead className="px-4 py-2.5">视频ID</TableHead>
            <TableHead className="px-4 py-2.5">账单日期</TableHead>
            <TableHead className="px-4 py-2.5">支付方式</TableHead>
            <TableHead className="px-4 py-2.5">金额</TableHead>
            <TableHead className="px-4 py-2.5">实付</TableHead>
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
                <Wallet className="mx-auto mb-2 h-8 w-8 opacity-40" />
                暂无支付记录
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
                <TableCell className="px-4 py-2.5 text-xs font-mono">{r.userUuid}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{r.courseId ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{r.videoId ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{r.outBillOn ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-xs">{r.payWay ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5 font-semibold">{r.amount ?? '-'}</TableCell>
                <TableCell className="px-4 py-2.5 font-semibold text-emerald-600">
                  {r.realAmount ?? '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                  {r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}
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
