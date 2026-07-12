'use client'

import { Loader2, LogIn } from 'lucide-react'
import { HasPermi } from '@/components/auth/HasPermi'
import { th, PERM } from './helpers'
import type { LoginLog } from './types'

interface Props {
  list: LoginLog[]
  isLoading: boolean
  onEdit: (item: LoginLog) => void
  onDelete: (id: string) => void
}

export function LoginLogTable({ list, isLoading, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className={th}>ID</th>
            <th className={th}>用户UUID</th>
            <th className={th}>登录类型</th>
            <th className={th}>平台</th>
            <th className={th}>IP</th>
            <th className={th}>位置</th>
            <th className={th}>UA</th>
            <th className={th}>登录时间</th>
            <th className={th}>消息</th>
            <th className={th}>操作</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                加载中…
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                <LogIn className="mx-auto mb-2 h-8 w-8 opacity-40" />
                暂无数据
              </td>
            </tr>
          ) : (
            list.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5">{item.id}</td>
                <td className="px-4 py-2.5 font-medium">{item.userUuid}</td>
                <td className="px-4 py-2.5">{item.loginType ?? '-'}</td>
                <td className="px-4 py-2.5">{item.platform ?? '-'}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{item.ip ?? '-'}</td>
                <td className="px-4 py-2.5">{item.location ?? '-'}</td>
                <td
                  className="px-4 py-2.5 max-w-32 truncate text-xs text-muted-foreground"
                  title={item.userAgent}
                >
                  {item.userAgent ?? '-'}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{item.loginTime ?? '-'}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{item.message ?? '-'}</td>
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
  )
}
