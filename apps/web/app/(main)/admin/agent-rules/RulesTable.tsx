'use client'

import { useTranslations } from 'next-intl'
import { Edit, Trash2, Loader2, Shield } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button } from '@ihui/ui'
import { badgeCls, dotCls } from './helpers'
import type { AgentRule } from './types'

const COLSPAN = 8

interface Props {
  rows: AgentRule[]
  isLoading: boolean
  error: Error | null
  onEdit: (rule: AgentRule) => void
  onDelete: (rule: AgentRule) => void
  deletePending: boolean
}

export function RulesTable({ rows, isLoading, error, onEdit, onDelete, deletePending }: Props) {
  const t = useTranslations('admin.agentRules')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('ruleId')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('agentId')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('ruleName')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('ruleCode')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('ruleType')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('priority')}</TableHead>
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
            rows.map((rule) => {
              const enabled = rule.status === 1
              return (
                <TableRow key={rule.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-mono text-xs">{rule.id}</TableCell>
                  <TableCell className="px-4 py-2.5 font-mono text-xs">{rule.agentId}</TableCell>
                  <TableCell className="px-4 py-2.5 font-medium">{rule.ruleName}</TableCell>
                  <TableCell className="px-4 py-2.5 font-mono text-xs">{rule.ruleCode}</TableCell>
                  <TableCell className="px-4 py-2.5">{rule.ruleType}</TableCell>
                  <TableCell className="px-4 py-2.5">{rule.priority}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span className={badgeCls(enabled)}>
                      <span className={dotCls(enabled)} />
                      {enabled ? t('enable') : t('disable')}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(rule)}
                        title={t('edit')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(rule)}
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
