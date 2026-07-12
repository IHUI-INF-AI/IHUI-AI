'use client'

import { Loader2, Shield } from 'lucide-react'
import { HasPermi } from '@/components/auth/HasPermi'
import type { AuthRole } from './types'

const th = 'px-4 py-2.5 font-medium'

interface Props {
  list: AuthRole[]
  isLoading: boolean
  perm: string
  onEdit: (item: AuthRole) => void
  onDelete: (id: string) => void
}

export function AuthRoleTable({ list, isLoading, perm, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className={th}>ID</th>
            <th className={th}>用户ID</th>
            <th className={th}>角色ID</th>
            <th className={th}>创建时间</th>
            <th className={th}>操作</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                加载中…
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                <Shield className="mx-auto mb-2 h-8 w-8 opacity-40" />
                暂无数据
              </td>
            </tr>
          ) : (
            list.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5">{item.id}</td>
                <td className="px-4 py-2.5 font-medium">{item.userId}</td>
                <td className="px-4 py-2.5">{item.roleId}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{item.createdAt ?? '-'}</td>
                <td className="px-4 py-2.5 space-x-2">
                  <HasPermi code={`${perm}:edit`}>
                    <button className="text-primary hover:underline" onClick={() => onEdit(item)}>
                      编辑
                    </button>
                  </HasPermi>
                  <HasPermi code={`${perm}:remove`}>
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
  )
}
