'use client'

import { useTranslations } from 'next-intl'
import { Loader2, Edit, Trash2, Link2 } from 'lucide-react'
import { Button, Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ihui/ui'
import { HasPermi } from '@/components/auth/HasPermi'
import type { DeveloperLink } from './types'

interface Props {
  list: DeveloperLink[]
  isLoading: boolean
  onEdit: (item: DeveloperLink) => void
  onDelete: (item: DeveloperLink) => void
}

export function DeveloperLinkTable({ list, isLoading, onEdit, onDelete }: Props) {
  const t = useTranslations('admin.developerLink')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colDeveloperId')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colAgentId')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colStatus')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colCreatedAt')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </TableCell>
            </TableRow>
          ) : list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                <Link2 className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((item) => (
              <TableRow key={item.id} className="hover:bg-muted/30">
                <TableCell className="px-4 py-2.5 font-mono text-xs">
                  {item.developerId?.slice(0, 8) ?? '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5 font-mono text-xs">
                  {item.agentId?.slice(0, 8) ?? '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5">
                  <span
                    className={
                      item.status === 1
                        ? 'inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600'
                        : 'inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                    }
                  >
                    {item.status === 1 ? t('enabled') : t('disabled')}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-muted-foreground">
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <HasPermi code="ai:developerlink:edit">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(item)}
                        title={t('edit')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </HasPermi>
                    <HasPermi code="ai:developerlink:remove">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(item)}
                        title={t('delete')}
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
