'use client'

import { Loader2, ArrowLeftRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { th } from './helpers'
import type { ExchangeRate } from './types'

interface Props {
  list: ExchangeRate[]
  isLoading: boolean
  onEdit: (item: ExchangeRate) => void
  onDelete: (item: ExchangeRate) => void
  deletePending: boolean
}

export function ExchangeRateTable({ list, isLoading, onEdit, onDelete, deletePending }: Props) {
  const t = useTranslations('admin.exchangeRates')
  const tc = useTranslations('common')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className={th}>{t('fromCurrency')}</th>
            <th className={th}>{t('toCurrency')}</th>
            <th className={th}>{t('rate')}</th>
            <th className={th}>{t('status')}</th>
            <th className={th}>{t('createdAt')}</th>
            <th className={th}>{tc('edit')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                <ArrowLeftRight className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </td>
            </tr>
          ) : (
            list.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium">{item.fromCurrency}</td>
                <td className="px-4 py-2.5 font-medium">{item.toCurrency}</td>
                <td className="px-4 py-2.5">{item.rate}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={item.status === 1 ? 'text-emerald-600' : 'text-muted-foreground'}
                  >
                    {item.status === 1 ? t('statusEnabled') : t('statusDisabled')}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{item.createdAt}</td>
                <td className="px-4 py-2.5 space-x-2">
                  <button className="text-primary hover:underline" onClick={() => onEdit(item)}>
                    {tc('edit')}
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
