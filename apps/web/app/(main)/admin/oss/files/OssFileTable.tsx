'use client'

import { Loader2, Eye, Trash2 } from 'lucide-react'
import { Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import { Tooltip } from '@/components/feedback'
import { formatSize } from './helpers'
import type { OssFile } from './types'

interface Props {
  list: OssFile[]
  isLoading: boolean
  deletePending: boolean
  onPreview: (item: OssFile) => void
  onDelete: (item: OssFile) => void
}

export function OssFileTable({ list, isLoading, deletePending, onPreview, onDelete }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">文件名</TableHead>
            <TableHead className="px-4 py-2.5">大小</TableHead>
            <TableHead className="px-4 py-2.5">类型</TableHead>
            <TableHead className="px-4 py-2.5">上传时间</TableHead>
            <TableHead className="px-4 py-2.5">上传者</TableHead>
            <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                加载中...
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                暂无文件
              </TableCell>
            </TableRow>
          ) : (
            list.map((f) => (
              <TableRow key={f.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-medium">{f.fileName}</TableCell>
                <TableCell className="px-4 py-2.5 text-muted-foreground">
                  {formatSize(f.size)}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                  {f.mimeType}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                  {f.createdAt}
                </TableCell>
                <TableCell className="px-4 py-2.5">{f.uploadedBy}</TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    {f.url && (
                      <Tooltip content="预览">
                        <Button variant="ghost" size="sm" onClick={() => onPreview(f)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                    )}
                    <HasPermi code="system:oss:remove">
                      <Tooltip content="删除">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={deletePending}
                          onClick={() => onDelete(f)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </Tooltip>
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
