'use client'

import { Loader2, KeyRound } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { HasPermi } from '@/components/auth/HasPermi'
import { th, PERM } from './helpers'
import type { AuthVeriCode } from './types'

interface Props {
  list: AuthVeriCode[]
  isLoading: boolean
  onEdit: (item: AuthVeriCode) => void
  onDelete: (item: AuthVeriCode) => void
}

export function AuthVeriCodeTable({ list, isLoading, onEdit, onDelete }: Props) {
  const t = useTranslations('adminAuthVeriCode')
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className={th}>ID</th>
            <th className={th}>{t('colUserId')}</th>
            <th className={th}>{t('colPhone')}</th>
            <th className={th}>{t('colCode')}</th>
            <th className={th}>{t('colType')}</th>
            <th className={th}>{t('colPlatform')}</th>
            <th className={th}>{t('colIp')}</th>
            <th className={th}>{t('colExpiresAt')}</th>
            <th className={th}>{t('colUsed')}</th>
            <th className={th}>{t('colActions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                <KeyRound className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </td>
            </tr>
          ) : (
            list.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5">{item.id}</td>
                <td className="px-4 py-2.5 font-medium">{item.userId}</td>
                <td className="px-4 py-2.5">{item.phone}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{item.code}</td>
                <td className="px-4 py-2.5">{item.type ?? '-'}</td>
                <td className="px-4 py-2.5">{item.platform ?? '-'}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{item.ip ?? '-'}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{item.expiresAt ?? '-'}</td>
                <td className="px-4 py-2.5">
                  {String(item.used ?? '0') === '1' ? (
                    <span className="text-emerald-600">{t('yes')}</span>
                  ) : (
                    <span className="text-muted-foreground">{t('no')}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 space-x-2">
                  <HasPermi code={`${PERM}:edit`}>
                    <button className="text-primary hover:underline" onClick={() => onEdit(item)}>
                      {t('edit')}
                    </button>
                  </HasPermi>
                  <HasPermi code={`${PERM}:remove`}>
                    <button
                      className="text-destructive hover:underline"
                      onClick={() => onDelete(item)}
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
