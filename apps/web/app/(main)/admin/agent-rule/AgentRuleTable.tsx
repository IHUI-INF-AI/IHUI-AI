'use client'

import { Loader2, Edit, Trash2, Settings, FileText } from 'lucide-react'
import { Button, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import type { AgentRule } from './types'

interface Props {
  list: AgentRule[]
  isLoading: boolean
  onParams: (item: AgentRule) => void
  onEdit: (item: AgentRule) => void
  onDelete: (item: AgentRule) => void
}

export function AgentRuleTable({ list, isLoading, onParams, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">AgentID</TableHead>
            <TableHead className="px-4 py-2.5">规则名称</TableHead>
            <TableHead className="px-4 py-2.5">规则编码</TableHead>
            <TableHead className="px-4 py-2.5">类型</TableHead>
            <TableHead className="px-4 py-2.5">优先级</TableHead>
            <TableHead className="px-4 py-2.5">状态</TableHead>
            <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                加载中…
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                暂无数据
              </TableCell>
            </TableRow>
          ) : (
            list.map((item) => (
              <TableRow key={item.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-mono text-xs">
                  {item.agentId?.slice(0, 8) ?? '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5 font-medium">{item.ruleName}</TableCell>
                <TableCell className="px-4 py-2.5">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {item.ruleCode || '-'}
                  </code>
                </TableCell>
                <TableCell className="px-4 py-2.5">{item.ruleType || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{item.priority}</TableCell>
                <TableCell className="px-4 py-2.5">
                  <span
                    className={
                      item.status === 1
                        ? 'inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600'
                        : 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                    }
                  >
                    {item.status === 1 ? '启用' : '禁用'}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onParams(item)}
                      title="规则参数"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <HasPermi code="ai:agentrule:edit">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(item)} title="编辑">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </HasPermi>
                    <HasPermi code="ai:agentrule:remove">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(item)}
                        title="删除"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </HasPermi>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
