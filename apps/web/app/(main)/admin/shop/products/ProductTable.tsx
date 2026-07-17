'use client'

import Image from 'next/image'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { Button, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { toArrayImages } from './helpers'
import type { Product } from './types'

interface Props {
  list: Product[]
  isLoading: boolean
  togglePending: boolean
  onToggle: (p: Product) => void
  onEdit: (p: Product) => void
  onDelete: (p: Product) => void
}

export function ProductTable({
  list,
  isLoading,
  togglePending,
  onToggle,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-3 py-2.5 text-xs uppercase">商品</TableHead>
            <TableHead className="px-3 py-2.5 text-xs uppercase">分类</TableHead>
            <TableHead className="px-3 py-2.5 text-xs uppercase">价格</TableHead>
            <TableHead className="px-3 py-2.5 text-xs uppercase">库存</TableHead>
            <TableHead className="px-3 py-2.5 text-xs uppercase">销量</TableHead>
            <TableHead className="px-3 py-2.5 text-xs uppercase">类型</TableHead>
            <TableHead className="px-3 py-2.5 text-xs uppercase">面额</TableHead>
            <TableHead className="px-3 py-2.5 text-xs uppercase">VIP面额</TableHead>
            <TableHead className="px-3 py-2.5 text-xs uppercase">运营商面额</TableHead>
            <TableHead className="px-3 py-2.5 text-xs uppercase">图片</TableHead>
            <TableHead className="px-3 py-2.5 text-xs uppercase">状态</TableHead>
            <TableHead className="px-3 py-2.5 text-right text-xs uppercase">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={12} className="px-3 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                加载中…
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={12} className="px-3 py-10 text-center text-muted-foreground">
                暂无商品
              </TableCell>
            </TableRow>
          ) : (
            list.map((p) => {
              const imgs = toArrayImages(p.images)
              return (
                <TableRow key={p.id} className="hover:bg-muted/30">
                  <TableCell className="px-3 py-2.5 font-medium">{p.name}</TableCell>
                  <TableCell className="px-3 py-2.5">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {p.category || '-'}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">¥{(p.price / 100).toFixed(2)}</TableCell>
                  <TableCell className="px-3 py-2.5">{p.stock}</TableCell>
                  <TableCell className="px-3 py-2.5">{p.sales ?? 0}</TableCell>
                  <TableCell className="px-3 py-2.5">{p.type || '-'}</TableCell>
                  <TableCell className="px-3 py-2.5">{p.denomination || '-'}</TableCell>
                  <TableCell className="px-3 py-2.5">{p.denominationVip || '-'}</TableCell>
                  <TableCell className="px-3 py-2.5">{p.denominationOperate || '-'}</TableCell>
                  <TableCell className="px-3 py-2.5">
                    {imgs.length > 0 ? (
                      <div className="flex gap-1">
                        {imgs.slice(0, 3).map((src, i) => (
                          <Image
                            key={i}
                            src={src}
                            alt=""
                            width={32}
                            height={32}
                            className="h-8 w-8 rounded object-cover"
                            onError={(e) => {
                              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        ))}
                        {imgs.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{imgs.length - 3}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs',
                        p.status === 'online'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          p.status === 'online' ? 'bg-emerald-500' : 'bg-muted-foreground',
                        )}
                      />
                      {p.status === 'online' ? '上架' : '下架'}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onToggle(p)}
                        disabled={togglePending}
                      >
                        {p.status === 'online' ? '下架' : '上架'}
                      </Button>
                      <HasPermi code="ai:zhs_product:edit">
                        <Button size="sm" variant="ghost" onClick={() => onEdit(p)} title="编辑">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </HasPermi>
                      <HasPermi code="ai:zhs_product:remove">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDelete(p)}
                          title="删除"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </HasPermi>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
