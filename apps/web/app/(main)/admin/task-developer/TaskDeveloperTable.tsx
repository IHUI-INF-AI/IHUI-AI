'use client'

import { Loader2, Edit, Trash2, Terminal } from 'lucide-react'
import { HasPermi } from '@/components/auth/HasPermi'
import { STATUS_MAP, TH_CLS, fmtDate } from './helpers'
import { PERMS } from './helpers'
import type { TaskDeveloper } from './types'

interface Props {
  list: TaskDeveloper[]
  isLoading: boolean
  ids: string[]
  allChecked: boolean
  onToggleAll: () => void
  onToggleOne: (id: string) => void
  onEdit: (row: TaskDeveloper) => void
  onDelete: (id: string) => void
}

export function TaskDeveloperTable({
  list,
  isLoading,
  ids,
  allChecked,
  onToggleAll,
  onToggleOne,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={onToggleAll}
                className="rounded"
              />
            </th>
            <th className={TH_CLS}>任务ID</th>
            <th className={TH_CLS}>接单人</th>
            <th className={TH_CLS}>金额</th>
            <th className={TH_CLS}>折扣</th>
            <th className={TH_CLS}>实付</th>
            <th className={TH_CLS}>节点</th>
            <th className={TH_CLS}>状态</th>
            <th className={TH_CLS}>发布者</th>
            <th className={TH_CLS}>创建者</th>
            <th className={TH_CLS}>创建时间</th>
            <th className={TH_CLS}>操作</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                加载中...
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">
                <Terminal className="mx-auto mb-2 h-8 w-8 opacity-40" />
                暂无数据
              </td>
            </tr>
          ) : (
            list.map((row) => {
              const st = STATUS_MAP[row.status] ?? {
                label: '未知',
                cls: 'bg-gray-500/10 text-gray-600',
              }
              return (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={ids.includes(row.id)}
                      onChange={() => onToggleOne(row.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-2.5 font-medium">{row.taskId}</td>
                  <td className="px-4 py-2.5">{row.accept}</td>
                  <td className="px-4 py-2.5">{row.amount}</td>
                  <td className="px-4 py-2.5">{row.discount}</td>
                  <td className="px-4 py-2.5">{row.realAmount}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.nodes}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}
                    >
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.publisher}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.creator}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {fmtDate(row.createdAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-2">
                      <HasPermi code={PERMS.edit}>
                        <button
                          onClick={() => onEdit(row)}
                          className="text-primary hover:underline"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                      </HasPermi>
                      <HasPermi code={PERMS.remove}>
                        <button
                          onClick={() => onDelete(row.id)}
                          className="text-red-600 hover:underline"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </HasPermi>
                    </div>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
