'use client'

import { Loader2, Edit, Trash2, Image as ImageIcon } from 'lucide-react'
import { Button, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import type { UserAgentImage } from './types'

interface Props {
  list: UserAgentImage[]
  isLoading: boolean
  onEdit: (item: UserAgentImage) => void
  onDelete: (item: UserAgentImage) => void
}

export function UserAgentImageTable({ list, isLoading, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">用户UUID</TableHead>
            <TableHead className="px-4 py-2.5">图片</TableHead>
            <TableHead className="px-4 py-2.5">图片名称</TableHead>
            <TableHead className="px-4 py-2.5">类型</TableHead>
            <TableHead className="px-4 py-2.5">平台</TableHead>
            <TableHead className="px-4 py-2.5">模型</TableHead>
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
                <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
                暂无数据
              </TableCell>
            </TableRow>
          ) : (
            list.map((item) => (
              <TableRow key={item.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-medium">{item.userUuid || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">
                  {item.imagePath ? (
                    <img
                      src={item.imagePath}
                      alt="Agent 形象"
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="px-4 py-2.5">{item.imageName || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{item.type || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{item.platform || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{item.modelName || '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-muted-foreground">
                  {item.createdAt || '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <HasPermi code="ai:useragentimage:edit">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(item)} title="编辑">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </HasPermi>
                    <HasPermi code="ai:useragentimage:remove">
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
