'use client'

import {
  Loader2,
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  UserCog,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { HasPermi } from '@/components/auth/HasPermi'
import {
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { COZE_STATUS_CLASS } from './helpers'
import type { CozeAccount } from './types'

interface DeveloperCozeTableProps {
  list: CozeAccount[]
  isLoading: boolean
  search: string
  onSearchChange: (v: string) => void
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  onCreate: () => void
  onEdit: (c: CozeAccount) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: number) => void
  deletePending: boolean
}

export function DeveloperCozeTable({
  list,
  isLoading,
  search,
  onSearchChange,
  page,
  totalPages,
  total,
  onPageChange,
  onCreate,
  onEdit,
  onDelete,
  onStatusChange,
  deletePending,
}: DeveloperCozeTableProps) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <UserCog className="h-5 w-5" />
          Coze 开发者账号
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="搜索 Coze ID / 账号 / 昵称..."
              className="h-9 pl-8"
            />
          </div>
          <HasPermi code="ai:developer:add">
            <Button size="sm" onClick={onCreate}>
              <Plus className="h-4 w-4" />
              新增账号
            </Button>
          </HasPermi>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-3 py-2.5">ID</TableHead>
              <TableHead className="px-3 py-2.5">Coze ID</TableHead>
              <TableHead className="px-3 py-2.5">签权账号</TableHead>
              <TableHead className="px-3 py-2.5">昵称</TableHead>
              <TableHead className="px-3 py-2.5">平台</TableHead>
              <TableHead className="px-3 py-2.5">状态</TableHead>
              <TableHead className="px-3 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              list.map((c) => (
                <TableRow key={c.id} className="hover:bg-muted/30">
                  <TableCell className="px-3 py-2.5 text-muted-foreground">{c.id}</TableCell>
                  <TableCell className="px-3 py-2.5 font-medium">{c.cozeId}</TableCell>
                  <TableCell className="px-3 py-2.5">{c.signAccount}</TableCell>
                  <TableCell className="px-3 py-2.5">{c.signNickname}</TableCell>
                  <TableCell className="px-3 py-2.5">{c.platform}</TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Select
                      value={String(c.status)}
                      onValueChange={(v) => onStatusChange(c.id, Number(v))}
                    >
                      <SelectTrigger
                        className={cn(
                          'h-7 w-24 border-0 px-2 text-xs font-medium',
                          COZE_STATUS_CLASS[c.status],
                        )}
                        aria-label="状态"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">未使用</SelectItem>
                        <SelectItem value="1">使用中</SelectItem>
                        <SelectItem value="2">已过期</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <HasPermi code="ai:developer:edit">
                        <Button variant="ghost" size="sm" onClick={() => onEdit(c)} title="编辑">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                      <HasPermi code="ai:developer:remove">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={deletePending}
                          onClick={() => {
                            if (confirm(`确认删除账号 "${c.cozeId}" ?`)) onDelete(c.id)
                          }}
                          title="删除"
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
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            第 {page} / {totalPages} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            下一页
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  )
}
