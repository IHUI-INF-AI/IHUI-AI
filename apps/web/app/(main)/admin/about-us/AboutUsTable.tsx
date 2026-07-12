'use client'

import { Edit, Trash2, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import { COLS, TH_CLASS, PERM } from './helpers'
import type { AboutUsItem } from './types'

interface Props {
  list: AboutUsItem[]
  isLoading: boolean
  deletePending: boolean
  onEdit: (item: AboutUsItem) => void
  onDelete: (id: string) => void
}

export function AboutUsTable({ list, isLoading, deletePending, onEdit, onDelete }: Props) {
  const t = useTranslations('admin.aboutUs')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            {COLS.map((c) => (
              <th key={c.key} className={TH_CLASS}>
                {t(c.label)}
              </th>
            ))}
            <th className={`${TH_CLASS} text-right`}>操作</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td
                colSpan={COLS.length + 1}
                className="px-4 py-10 text-center text-muted-foreground"
              >
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                加载中...
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td
                colSpan={COLS.length + 1}
                className="px-4 py-10 text-center text-muted-foreground"
              >
                暂无数据
              </td>
            </tr>
          ) : (
            list.map((item) => (
              <tr key={item.id} className="transition-colors hover:bg-muted/30">
                {COLS.map((c) => (
                  <td key={c.key} className="px-4 py-2.5 text-muted-foreground">
                    {(item[c.key] || '-').slice(0, 30)}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <HasPermi code={`${PERM}:edit`}>
                      <Button size="sm" variant="ghost" onClick={() => onEdit(item)}>
                        <Edit className="h-4 w-4" />
                        编辑
                      </Button>
                    </HasPermi>
                    <HasPermi code={`${PERM}:remove`}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={deletePending}
                        onClick={() => confirm('确认删除?') && onDelete(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        删除
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
