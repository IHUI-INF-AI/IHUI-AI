'use client'

import { Loader2, Edit, Trash2, AudioLines } from 'lucide-react'
import { Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@ihui/ui-react'
import { HasPermi } from '@/components/auth/HasPermi'
import type { UserAgentAudio } from './types'

interface Props {
  list: UserAgentAudio[]
  isLoading: boolean
  onEdit: (item: UserAgentAudio) => void
  onDelete: (item: UserAgentAudio) => void
}

export function UserAgentAudioTable({ list, isLoading, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">用户UUID</TableHead>
            <TableHead className="px-4 py-2.5">音频ID</TableHead>
            <TableHead className="px-4 py-2.5">AgentID</TableHead>
            <TableHead className="px-4 py-2.5">音频路径</TableHead>
            <TableHead className="px-4 py-2.5">来源</TableHead>
            <TableHead className="px-4 py-2.5">平台</TableHead>
            <TableHead className="px-4 py-2.5">创建时间</TableHead>
            <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                加载中…
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                <AudioLines className="mx-auto mb-2 h-8 w-8 opacity-40" />
                暂无数据
              </TableCell>
            </TableRow>
          ) : (
            list.map((item) => (
              <TableRow key={item.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-medium">{item.uuid || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{item.audioId || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{item.agentId || '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-muted-foreground max-w-[200px] truncate">
                  {item.audioPath || '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5">{item.source || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{item.platform || '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-muted-foreground">
                  {item.createdAt || '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <HasPermi code="slave:useragentaudit:edit">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(item)} title="编辑">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </HasPermi>
                    <HasPermi code="slave:useragentaudit:remove">
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
