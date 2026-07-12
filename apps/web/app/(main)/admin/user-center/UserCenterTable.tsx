'use client'
import { Loader2, Users } from 'lucide-react'
import { HasPermi } from '@/components/auth/HasPermi'
import { th, PERM } from './helpers'
import type { UserCenter } from './types'

interface Props {
  list: UserCenter[]
  isLoading: boolean
  onEdit: (item: UserCenter) => void
  onDelete: (uuid: string) => void
  onIdentity: (item: UserCenter) => void
  onAssign: (item: UserCenter) => void
}

export function UserCenterTable({
  list,
  isLoading,
  onEdit,
  onDelete,
  onIdentity,
  onAssign,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className={th}>UUID</th>
            <th className={th}>昵称</th>
            <th className={th}>父级ID</th>
            <th className={th}>手机号</th>
            <th className={th}>Token</th>
            <th className={th}>VIP等级</th>
            <th className={th}>操作</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                加载中…
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                暂无数据
              </td>
            </tr>
          ) : (
            list.map((item) => (
              <tr key={item.uuid} className="hover:bg-muted/30">
                <td className="px-4 py-2.5 font-mono text-xs">{item.uuid}</td>
                <td className="px-4 py-2.5 font-medium">{item.nickname ?? '-'}</td>
                <td className="px-4 py-2.5">{item.parentId ?? '-'}</td>
                <td className="px-4 py-2.5">{item.authInfo?.phone ?? '-'}</td>
                <td className="px-4 py-2.5">{item.userMargin?.tokenQuantity ?? '-'}</td>
                <td className="px-4 py-2.5">{item.vipLevelVO?.title ?? '-'}</td>
                <td className="px-4 py-2.5 space-x-2 whitespace-nowrap">
                  <HasPermi code={`${PERM}:edit`}>
                    <button className="text-primary hover:underline" onClick={() => onEdit(item)}>
                      编辑
                    </button>
                  </HasPermi>
                  <HasPermi code={`${PERM}:remove`}>
                    <button
                      className="text-destructive hover:underline"
                      onClick={() => onDelete(item.uuid)}
                    >
                      删除
                    </button>
                  </HasPermi>
                  <HasPermi code={`${PERM}:edit`}>
                    <button
                      className="text-primary hover:underline"
                      onClick={() => onIdentity(item)}
                    >
                      身份
                    </button>
                  </HasPermi>
                  <HasPermi code={`${PERM}:edit`}>
                    <button className="text-primary hover:underline" onClick={() => onAssign(item)}>
                      分配
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
