'use client'
import { Trash2, Loader2, Award } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { useTranslations } from 'next-intl'
import { SOURCE_MAP } from './helpers'
import type { Certificate } from './types'

interface Props {
  rows: Certificate[]
  isLoading: boolean
  error: Error | null
  onStatusChange: (c: Certificate, next: number) => void
  onDelete: (c: Certificate) => void
  deletePending: boolean
}

const COLSPAN = 7

export function CertificateTable({
  rows,
  isLoading,
  error,
  onStatusChange,
  onDelete,
  deletePending,
}: Props) {
  const t = useTranslations('admin.edu.certificate')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4 py-2.5">{t('colNo')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colTitle')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colRecipient')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colSource')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('colIssuedAt')}</TableHead>
            <TableHead className="px-4 py-2.5">{t('status')}</TableHead>
            <TableHead className="px-4 py-2.5 text-right">{t('colAction')}</TableHead>
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
                <Award className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noCertificates')}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((c) => {
              const valid = c.status === 1
              return (
                <TableRow key={c.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-mono text-xs">{c.certificateNo}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <div className="font-medium">{c.title}</div>
                    {c.templateName && (
                      <div className="text-xs text-muted-foreground">{c.templateName}</div>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    {c.recipientName ?? c.nickname ?? '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs">
                    {SOURCE_MAP[c.source ?? '']
                      ? t(`sourceLabel.${SOURCE_MAP[c.source ?? '']}`)
                      : (c.source ?? '-')}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                    {c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        valid
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-500',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          valid ? 'bg-emerald-500' : 'bg-rose-500',
                        )}
                      />
                      {valid ? t('statusValid') : t('statusRevoked')}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Select
                        value={String(c.status)}
                        onValueChange={(v) => onStatusChange(c, Number(v))}
                      >
                        <SelectTrigger className="h-8 w-[90px]" aria-label={t('status')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">{t('statusValid')}</SelectItem>
                          <SelectItem value="0">{t('statusRevoke')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(c)}
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
