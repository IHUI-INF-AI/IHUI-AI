'use client'

import { Loader2, Crown } from 'lucide-react'
import { Button } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import { th, PERM } from './helpers'
import type { AuthUserVip } from './types'

interface Props {
  list: AuthUserVip[]
  isLoading: boolean
  total: number
  page: number
  totalPages: number
  onEdit: (item: AuthUserVip) => void
  onDelete: (id: string) => void
  onPageChange: (page: number) => void
}

export function AuthUserVipTable({
  list,
  isLoading,
  total,
  page,
  totalPages,
  onEdit,
  onDelete,
  onPageChange,
}: Props) {
  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className={th}>ID</th>
              <th className={th}>用户UUID</th>
              <th className={th}>VIP ID</th>
              <th className={th}>进度</th>
              <th className={th}>创建者</th>
              <th className={th}>创建时间</th>
              <th className={th}>有效</th>
              <th className={th}>操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中…
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <Crown className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">{item.id}</td>
                  <td className="px-4 py-2.5 font-medium">{item.userUuid}</td>
                  <td className="px-4 py-2.5">{item.vipId}</td>
                  <td className="px-4 py-2.5">{item.progress ?? '-'}</td>
                  <td className="px-4 py-2.5">{item.creator ?? '-'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{item.createdTime ?? '-'}</td>
                  <td className="px-4 py-2.5">
                    {String(item.isValid ?? '-') === '1' ? (
                      <span className="text-emerald-600">是</span>
                    ) : (
                      <span className="text-muted-foreground">否</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 space-x-2">
                    <HasPermi code={`${PERM}:edit`}>
                      <button className="text-primary hover:underline" onClick={() => onEdit(item)}>
                        编辑
                      </button>
                    </HasPermi>
                    <HasPermi code={`${PERM}:remove`}>
                      <button
                        className="text-destructive hover:underline"
                        onClick={() => onDelete(item.id)}
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

      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            共 {total} 条 · {page}/{totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              上一页
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
