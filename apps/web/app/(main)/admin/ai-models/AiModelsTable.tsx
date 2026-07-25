'use client'

import { Pencil, Trash2, Zap } from 'lucide-react'
import { Button, Switch } from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'
import type { ModelRow } from './types'

interface Props {
  list: ModelRow[]
  isLoading: boolean
  togglePending: boolean
  testPending: boolean
  onToggle: (item: ModelRow) => void
  onTest: (id: number) => void
  onEdit: (item: ModelRow) => void
  onDelete: (item: ModelRow) => void
}

export function AiModelsTable({
  list,
  isLoading,
  togglePending,
  testPending,
  onToggle,
  onTest,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left font-medium">名称</th>
            <th className="px-3 py-2 text-left font-medium">Provider</th>
            <th className="px-3 py-2 text-left font-medium">Base URL</th>
            <th className="px-3 py-2 text-left font-medium">格式</th>
            <th className="px-3 py-2 text-left font-medium">Key</th>
            <th className="px-3 py-2 text-left font-medium">启用</th>
            <th className="px-3 py-2 text-left font-medium">测试</th>
            <th className="px-3 py-2 text-left font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                加载中...
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                暂无数据
              </td>
            </tr>
          ) : (
            list.map((item) => (
              <tr key={item.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-2">{item.name}</td>
                <td className="px-3 py-2 font-mono text-xs">{item.providerCode}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                  {item.baseUrl}
                </td>
                <td className="px-3 py-2 text-xs">{item.apiFormat}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs ${
                      item.hasApiKey
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {item.hasApiKey ? '已配置' : '未配置'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Switch
                    checked={item.enabled}
                    onCheckedChange={() => onToggle(item)}
                    disabled={togglePending}
                  />
                </td>
                <td className="px-3 py-2">
                  {item.lastTestStatus ? (
                    <span
                      className={`text-xs ${
                        item.lastTestStatus === 'success'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {item.lastTestStatus === 'success'
                        ? `成功 ${item.lastTestResponseMs ?? 0}ms`
                        : '失败'}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">未测试</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Tooltip content="测试连通">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onTest(item.id)}
                        disabled={testPending}
                      >
                        <Zap className="h-3.5 w-3.5" />
                      </Button>
                    </Tooltip>
                    <Tooltip content="编辑">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </Tooltip>
                    <Tooltip content="删除">
                      <Button variant="ghost" size="sm" onClick={() => onDelete(item)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </Tooltip>
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
