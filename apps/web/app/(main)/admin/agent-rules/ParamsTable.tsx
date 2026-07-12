'use client'

import { useTranslations } from 'next-intl'
import { Edit, Trash2, Loader2, Shield } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui'
import { badgeCls, dotCls } from './helpers'
import type { RuleParam } from './types'

const COLSPAN = 8

interface Props {
  rows: RuleParam[]
  isLoading: boolean
  error: Error | null
  onDelete: (param: RuleParam) => void
  deletePending: boolean
}

export function ParamsTable({ rows, isLoading, error, onDelete, deletePending }: Props) {
  const t = useTranslations('admin.agentRules')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('paramId')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('paramRuleId')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('paramName')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('paramCode')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('paramType')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('paramValue')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('status')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-destructive">
                {error.message}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLSPAN} className="px-4 py-10 text-center text-muted-foreground">
                <Shield className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((param) => {
              const enabled = param.status === 1
              return (
                <TableRow key={param.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-mono text-xs">{param.id}</TableCell>
                  <TableCell className="px-4 py-2.5 font-mono text-xs">{param.ruleId}</TableCell>
                  <TableCell className="px-4 py-2.5 font-medium">{param.name}</TableCell>
                  <TableCell className="px-4 py-2.5 font-mono text-xs">{param.code}</TableCell>
                  <TableCell className="px-4 py-2.5">{param.type}</TableCell>
                  <TableCell className="px-4 py-2.5">{param.value}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span className={badgeCls(enabled)}>
                      <span className={dotCls(enabled)} />
                      {enabled ? t('enable') : t('disable')}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" title={t('edit')}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(param)}
                        title={t('delete')}
                        className="text-destructive hover:text-destructive"
                        disabled={deletePending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
