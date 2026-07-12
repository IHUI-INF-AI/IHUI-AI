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
import { useTranslations } from 'next-intl'

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
  const t = useTranslations('admin.developer')
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <UserCog className="h-5 w-5" />
          {t('cozeSectionTitle')}
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('cozeSearchPlaceholder')}
              className="h-9 pl-8"
            />
          </div>
          <HasPermi code="ai:developer:add">
            <Button size="sm" onClick={onCreate}>
              <Plus className="h-4 w-4" />
              {t('cozeCreate')}
            </Button>
          </HasPermi>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-3 py-2.5">ID</TableHead>
              <TableHead className="px-3 py-2.5">{t('colCozeId')}</TableHead>
              <TableHead className="px-3 py-2.5">{t('colSignAccount')}</TableHead>
              <TableHead className="px-3 py-2.5">{t('colNickname')}</TableHead>
              <TableHead className="px-3 py-2.5">{t('colPlatform')}</TableHead>
              <TableHead className="px-3 py-2.5">{t('colStatus')}</TableHead>
              <TableHead className="px-3 py-2.5 text-right">{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                  {t('noData')}
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
                        aria-label={t('statusAriaLabel')}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">{t('statusUnused')}</SelectItem>
                        <SelectItem value="1">{t('statusInUse')}</SelectItem>
                        <SelectItem value="2">{t('statusExpired')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <HasPermi code="ai:developer:edit">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(c)}
                          title={t('edit')}
                        >
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
                            if (confirm(t('cozeDeleteConfirm', { cozeId: c.cozeId })))
                              onDelete(c.id)
                          }}
                          title={t('delete')}
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
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('pageInfo', { page, totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            {t('next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  )
}
