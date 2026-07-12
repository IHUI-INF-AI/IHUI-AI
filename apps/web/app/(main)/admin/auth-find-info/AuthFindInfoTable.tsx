'use client'

import { Loader2, CreditCard } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { HasPermi } from '@/components/auth/HasPermi'
import { PERM, TABLE_TH_CLASS } from './helpers'
import type { AuthFindInfo } from './types'

interface Props {
  list: AuthFindInfo[]
  isLoading: boolean
  onEdit: (item: AuthFindInfo) => void
  onDelete: (id: string) => void
}

export function AuthFindInfoTable({ list, isLoading, onEdit, onDelete }: Props) {
  const t = useTranslations('adminAuthFindInfo')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className={TABLE_TH_CLASS}>ID</th>
            <th className={TABLE_TH_CLASS}>{t('colUserUuid')}</th>
            <th className={TABLE_TH_CLASS}>{t('colCard')}</th>
            <th className={TABLE_TH_CLASS}>{t('colBelong')}</th>
            <th className={TABLE_TH_CLASS}>{t('colTitle')}</th>
            <th className={TABLE_TH_CLASS}>{t('colMessage')}</th>
            <th className={TABLE_TH_CLASS}>{t('colCreatedAt')}</th>
            <th className={TABLE_TH_CLASS}>{t('colActions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                <CreditCard className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </td>
            </tr>
          ) : (
            list.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5">{item.id}</td>
                <td className="px-4 py-2.5 font-medium">{item.userUuid}</td>
                <td className="px-4 py-2.5 text-xs">{item.card}</td>
                <td className="px-4 py-2.5">{item.belong ?? '-'}</td>
                <td className="px-4 py-2.5">{item.title ?? '-'}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{item.message ?? '-'}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{item.createdAt ?? '-'}</td>
                <td className="px-4 py-2.5 space-x-2">
                  <HasPermi code={`${PERM}:edit`}>
                    <button className="text-primary hover:underline" onClick={() => onEdit(item)}>
                      {t('edit')}
                    </button>
                  </HasPermi>
                  <HasPermi code={`${PERM}:remove`}>
                    <button
                      className="text-destructive hover:underline"
                      onClick={() => onDelete(item.id)}
                    >
                      {t('delete')}
                    </button>
                  </HasPermi>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
