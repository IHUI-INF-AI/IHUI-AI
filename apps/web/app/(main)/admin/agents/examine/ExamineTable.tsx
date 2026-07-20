'use client'

import { useTranslations } from 'next-intl'
import { Loader2, ShieldCheck, Edit, Trash2, MessageCircle } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import { Tooltip } from '@/components/feedback'
import { STATUS_STYLE } from './helpers'
import type { Examine } from './types'

interface ExamineTableProps {
  list: Examine[]
  isLoading: boolean
  onEdit: (item: Examine) => void
  onDelete: (item: Examine) => void
  onChat: (item: Examine) => void
}

export function ExamineTable({ list, isLoading, onEdit, onDelete, onChat }: ExamineTableProps) {
  const t = useTranslations('admin.agents.examine')
  const tc = useTranslations('common')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colAgentName')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStartTime')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStartPhone')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colExamineUser')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colDesc')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                <ShieldCheck className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('empty')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((item) => (
              <TableRow key={item.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-medium">
                  {item.agentName || item.agentId}
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                      STATUS_STYLE[item.status] ?? 'bg-muted text-muted-foreground',
                    )}
                  >
                    {t(`status${item.status}`)}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-muted-foreground">
                  {item.startTime || '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5">{item.startPhone || '-'}</TableCell>
                <TableCell className="px-4 py-2.5">{item.examineUser || '-'}</TableCell>
                <TableCell className="px-4 py-2.5 max-w-[200px] truncate text-muted-foreground">
                  {item.desc || '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    {item.status === 1 && (
                      <HasPermi code="ai:examine:edit">
                        <Tooltip content={t('chatApprove')}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onChat(item)}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                      </HasPermi>
                    )}
                    <HasPermi code="ai:examine:edit">
                      <Tooltip content={tc('edit')}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(item)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                    </HasPermi>
                    <HasPermi code="ai:examine:remove">
                      <Tooltip content={tc('delete')}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(item)}
                          className="text-destructive hover:text-destructive"
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
