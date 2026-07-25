'use client'

import { useTranslations } from 'next-intl'
import { Loader2, FileText } from 'lucide-react'
import { th } from './helpers'
import type { Agreement } from './types'

interface Props {
  list: Agreement[]
  isLoading: boolean
  deletePending: boolean
  onEdit: (item: Agreement) => void
  onDelete: (item: Agreement) => void
}

export function AgreementTable({ list, isLoading, deletePending, onEdit, onDelete }: Props) {
  const t = useTranslations('admin.agreements')
  const tc = useTranslations('common')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className={th}>{t('colType')}</th>
            <th className={th}>{t('colTitle')}</th>
            <th className={th}>{t('colVersion')}</th>
            <th className={th}>{t('colStatus')}</th>
            <th className={th}>{t('colActions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </td>
            </tr>
          ) : (
            list.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium">{item.type}</td>
                <td className="px-4 py-2.5">{item.title}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{item.version}</td>
                <td className="px-4 py-2.5">{item.status === 1 ? t('enabled') : t('disabled')}</td>
                <td className="px-4 py-2.5 space-x-2">
                  <button className="text-primary hover:underline" onClick={() => onEdit(item)}>
                    {t('edit')}
                  </button>
                  <button
                    className="text-destructive hover:underline"
                    onClick={() => onDelete(item)}
                    disabled={deletePending}
                  >
                    {tc('delete')}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
