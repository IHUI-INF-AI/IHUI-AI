'use client'

import { useTranslations } from 'next-intl'
import { Loader2, Edit, Trash2, CheckCircle, XCircle, ClipboardList } from 'lucide-react'
import { Button, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui-react'
import { HasPermi } from '@/components/auth/HasPermi'
import { Tooltip } from '@/components/feedback'
import { STATUS_STYLE } from './helpers'
import type { AgentTask } from './types'

interface Props {
  list: AgentTask[]
  isLoading: boolean
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onEdit: (item: AgentTask) => void
  onDelete: (item: AgentTask) => void
}

export function AgentTaskTable({ list, isLoading, onApprove, onReject, onEdit, onDelete }: Props) {
  const t = useTranslations('admin.agentTask')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCreator')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colClosingTime')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCycle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colPriceRange')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
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
                <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('empty')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((item) => (
              <TableRow key={item.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-medium max-w-[200px] truncate">
                  {item.title || '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5">{item.createdName || '-'}</TableCell>
                <TableCell className="px-4 py-2.5 text-muted-foreground">
                  {item.closingTime || '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  {item.cycle ? `${item.cycle}${item.cycleUnit || ''}` : '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  {item.lowestPrice || item.peakPrice
                    ? `${item.lowestPrice || '-'} - ${item.peakPrice || '-'}`
                    : '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[item.status] ?? 'bg-muted text-muted-foreground'}`}
                  >
                    {t(`status${item.status}`)}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    {item.status === 0 && (
                      <>
                        <HasPermi code="ai:agenttask:edit">
                          <Tooltip content={t('approve')}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onApprove(item.id)}
                              className="text-emerald-600"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          </Tooltip>
                        </HasPermi>
                        <HasPermi code="ai:agenttask:edit">
                          <Tooltip content={t('reject')}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onReject(item.id)}
                              className="text-amber-600"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </Tooltip>
                        </HasPermi>
                      </>
                    )}
                    <HasPermi code="ai:agenttask:edit">
                      <Tooltip content={t('edit')}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(item)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                    </HasPermi>
                    <HasPermi code="ai:agenttask:remove">
                      <Tooltip content={t('delete')}>
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
