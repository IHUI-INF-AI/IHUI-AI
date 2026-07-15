'use client'

import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@ihui/ui'
import { thCls } from './helpers'
import type { Variable } from './types'

interface Props {
  list: Variable[]
  isLoading: boolean
  deletePending: boolean
  onEdit: (v: Variable) => void
  onDelete: (v: Variable) => void
}

export function VariableTable({ list, isLoading, deletePending, onEdit, onDelete }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        加载中...
      </div>
    )
  }
  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
        <p className="text-sm text-muted-foreground">暂无变量,点击右上角创建</p>
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className={thCls}>Bot ID</th>
            <th className={thCls}>变量名</th>
            <th className={thCls}>变量值</th>
            <th className={thCls}>类型</th>
            <th className={thCls}>描述</th>
            <th className={`${thCls} text-right`}>操作</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {list.map((v) => (
            <tr key={v.id} className="transition-colors hover:bg-accent/50">
              <td className="px-4 py-2.5 font-mono text-xs">{v.botId}</td>
              <td className="px-4 py-2.5 font-medium">{v.variableName}</td>
              <td className="max-w-[200px] truncate px-4 py-2.5 text-muted-foreground">
                {v.variableValue ?? '-'}
              </td>
              <td className="px-4 py-2.5">
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  {v.dataType ?? 'string'}
                </span>
              </td>
              <td className="max-w-[200px] truncate px-4 py-2.5 text-muted-foreground">
                {v.description ?? '-'}
              </td>
              <td className="px-4 py-2.5 text-right">
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onEdit(v)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(v)}
                    disabled={deletePending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
