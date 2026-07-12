'use client'

import { Loader2, Edit, Trash2 } from 'lucide-react'
import { Button } from '@ihui/ui'
import { COLS, th } from './helpers'
import type { AiGcItem } from './types'

interface Props {
  list: AiGcItem[]
  isLoading: boolean
  delPending: boolean
  onEdit: (item: AiGcItem) => void
  onDelete: (id: string) => void
}

export function AiGcTable({ list, isLoading, delPending, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className={th}>封面</th>
            {COLS.map((c) => (
              <th key={c.key} className={th}>
                {c.label}
              </th>
            ))}
            <th className={`${th} text-right`}>操作</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td
                colSpan={COLS.length + 2}
                className="px-4 py-10 text-center text-muted-foreground"
              >
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                加载中...
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td
                colSpan={COLS.length + 2}
                className="px-4 py-10 text-center text-muted-foreground"
              >
                暂无数据
              </td>
            </tr>
          ) : (
            list.map((item) => (
              <tr key={item.id} className="transition-colors hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  {item.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.coverUrl} alt="" className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <span className="text-muted-foreground/50">-</span>
                  )}
                </td>
                {COLS.map((c) => (
                  <td key={c.key} className="px-4 py-2.5 text-muted-foreground">
                    {(item[c.key] || '-').slice(0, 25)}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => onEdit(item)}>
                      <Edit className="h-4 w-4" />
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={delPending}
                      onClick={() => onDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      删除
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
