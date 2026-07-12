'use client'

import { Loader2, Pencil, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button, Checkbox } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import { th } from './helpers'
import type { Post } from './types'

interface PostTableProps {
  list: Post[]
  isLoading: boolean
  selected: Set<string>
  onToggleAll: () => void
  onToggleOne: (id: string) => void
  onEdit: (p: Post) => void
  onDelete: (id: string) => void
}

export function PostTable({
  list,
  isLoading,
  selected,
  onToggleAll,
  onToggleOne,
  onEdit,
  onDelete,
}: PostTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="w-10 px-4 py-2.5">
              <Checkbox
                checked={list.length > 0 && selected.size === list.length}
                onCheckedChange={onToggleAll}
              />
            </th>
            <th className={th}>ID</th>
            <th className={th}>岗位编码</th>
            <th className={th}>岗位名称</th>
            <th className={th}>排序</th>
            <th className={th}>状态</th>
            <th className={th}>备注</th>
            <th className={th}>创建时间</th>
            <th className={th}>操作</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                暂无数据
              </td>
            </tr>
          ) : (
            list.map((p) => (
              <tr key={p.id} className="transition-colors hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <Checkbox
                    checked={selected.has(p.id)}
                    onCheckedChange={() => onToggleOne(p.id)}
                  />
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{p.id}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{p.postCode}</td>
                <td className="px-4 py-2.5 font-medium">{p.postName}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{p.postSort}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs',
                      p.status === 0
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {p.status === 0 ? '正常' : '停用'}
                  </span>
                </td>
                <td
                  className="max-w-[160px] truncate px-4 py-2.5 text-xs text-muted-foreground"
                  title={p.remark}
                >
                  {p.remark || '-'}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                  {p.createdAt ? new Date(p.createdAt).toLocaleString() : '-'}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1">
                    <HasPermi code="system:post:edit">
                      <Button size="sm" variant="ghost" onClick={() => onEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </HasPermi>
                    <HasPermi code="system:post:remove">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm('确认删除？')) onDelete(p.id)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </HasPermi>
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
