'use client'

import { Loader2, KeyRound } from 'lucide-react'
import { HasPermi } from '@/components/auth/HasPermi'
import { th, PERM } from './helpers'
import type { AuthVeriCode } from './types'

interface Props {
  list: AuthVeriCode[]
  isLoading: boolean
  onEdit: (item: AuthVeriCode) => void
  onDelete: (item: AuthVeriCode) => void
}

export function AuthVeriCodeTable({ list, isLoading, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className={th}>ID</th>
            <th className={th}>用户ID</th>
            <th className={th}>手机号</th>
            <th className={th}>验证码</th>
            <th className={th}>类型</th>
            <th className={th}>平台</th>
            <th className={th}>IP</th>
            <th className={th}>过期时间</th>
            <th className={th}>已用</th>
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
                <KeyRound className="mx-auto mb-2 h-8 w-8 opacity-40" />
                暂无数据
              </td>
            </tr>
          ) : (
            list.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5">{item.id}</td>
                <td className="px-4 py-2.5 font-medium">{item.userId}</td>
                <td className="px-4 py-2.5">{item.phone}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{item.code}</td>
                <td className="px-4 py-2.5">{item.type ?? '-'}</td>
                <td className="px-4 py-2.5">{item.platform ?? '-'}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{item.ip ?? '-'}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{item.expiresAt ?? '-'}</td>
                <td className="px-4 py-2.5">
                  {String(item.used ?? '0') === '1' ? (
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
                      onClick={() => onDelete(item)}
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
