'use client'

import { Coins, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import {
  Button,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui-react'
import type { TokenFlowItem } from '@/lib/token-api'

interface Props {
  items: TokenFlowItem[]
  isLoading: boolean
  error: Error | null
  page: number
  totalPages: number
  total: number
  pageSize: number
  t: (k: string) => string
  tc: (k: string) => string
  fmtDate: (v: string) => string
  onPageChange: (p: number) => void
}

export function TokenValueTable({
  items,
  isLoading,
  error,
  page,
  totalPages,
  total,
  pageSize,
  t,
  tc,
  fmtDate,
  onPageChange,
}: Props) {
  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="px-4 py-2.5">{t('colTime')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colAgent')}</TableHead>
              <TableHead className="px-4 py-2.5">{t('colModel')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colToken')}</TableHead>
              <TableHead className="px-4 py-2.5 text-right">{t('colAmount')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {tc('loading')}
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-destructive">
                  {error.message}
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Coins className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {tc('empty')}
                </TableCell>
              </TableRow>
            ) : (
              items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {fmtDate(it.createdAt)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 font-medium">{it.agentName}</TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">{it.modelName}</TableCell>
                  <TableCell className="px-4 py-2.5 text-right font-medium text-red-600 dark:text-red-400">
                    -{it.token}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right font-medium text-red-600 dark:text-red-400">
                    ¥{Math.abs(it.amount).toFixed(4)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {total} / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(Math.max(1, page - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
