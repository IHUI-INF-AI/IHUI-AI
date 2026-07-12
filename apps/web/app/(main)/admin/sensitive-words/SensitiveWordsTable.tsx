'use client'

import { Loader2, ShieldAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { LEVEL_KEYS, th } from './helpers'
import type { SensitiveWord } from './types'

interface Props {
  list: SensitiveWord[]
  isLoading: boolean
  onEdit: (item: SensitiveWord) => void
  onDelete: (item: SensitiveWord) => void
  deletePending: boolean
}

export function SensitiveWordsTable({ list, isLoading, onEdit, onDelete, deletePending }: Props) {
  const t = useTranslations('admin.sensitiveWords')
  const tc = useTranslations('common')

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className={th}>{t('colWord')}</th>
            <th className={th}>{t('colCategory')}</th>
            <th className={th}>{t('colLevel')}</th>
            <th className={th}>{t('colStatus')}</th>
            <th className={th}>{tc('edit')}</th>
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
                <ShieldAlert className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </td>
            </tr>
          ) : (
            list.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5 font-medium">{item.word}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{item.category}</td>
                <td className="px-4 py-2.5">{t(LEVEL_KEYS[item.level - 1] ?? 'levelReplace')}</td>
                <td className="px-4 py-2.5">{item.status === 1 ? t('enabled') : t('disabled')}</td>
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
