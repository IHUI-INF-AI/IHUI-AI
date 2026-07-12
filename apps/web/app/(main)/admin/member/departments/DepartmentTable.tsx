'use client'

import { Loader2, Network } from 'lucide-react'
import { HasPermi } from '@/components/auth/HasPermi'
import { ALL_KEYS, LABELS, PERM, th, colCount } from './helpers'
import type { Department } from './types'

interface Props {
  list: Department[]
  isLoading: boolean
  onEdit: (item: Department) => void
  onDelete: (id: string) => void
}

export function DepartmentTable({ list, isLoading, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className={th}>ID</th>
            {ALL_KEYS.map((k) => (
              <th key={k} className={th}>
                {LABELS[k]}
              </th>
            ))}
            <th className={th}>操作</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={colCount} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                加载中…
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="px-4 py-10 text-center text-muted-foreground">
                <Network className="mx-auto mb-2 h-8 w-8 opacity-40" />
                暂无数据
              </td>
            </tr>
          ) : (
            list.map((item) => (
              <tr key={String(item.id)} className="hover:bg-muted/30">
                <td className="px-4 py-2.5">{String(item.id)}</td>
                {ALL_KEYS.map((k) => (
                  <td key={k} className="px-4 py-2.5">
                    {String(item[k] ?? '-')}
                  </td>
                ))}
                <td className="px-4 py-2.5 space-x-2">
                  <HasPermi code={`${PERM}:edit`}>
                    <button className="text-primary hover:underline" onClick={() => onEdit(item)}>
                      编辑
                    </button>
                  </HasPermi>
                  <HasPermi code={`${PERM}:remove`}>
                    <button
                      className="text-destructive hover:underline"
                      onClick={() => onDelete(String(item.id))}
                    >
                      删除
                    </button>
                  </HasPermi>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
