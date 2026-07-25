'use client'

import { Loader2, Crown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui-react'
import { HasPermi } from '@/components/auth/HasPermi'
import { th, PERM } from './helpers'
import type { AuthUserVip } from './types'

interface Props {
  list: AuthUserVip[]
  isLoading: boolean
  total: number
  page: number
  totalPages: number
  onEdit: (item: AuthUserVip) => void
  onDelete: (id: string) => void
  onPageChange: (page: number) => void
}

export function AuthUserVipTable({
  list,
  isLoading,
  total,
  page,
  totalPages,
  onEdit,
  onDelete,
  onPageChange,
}: Props) {
  const t = useTranslations('adminAuthUserVip')
  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className={th}>ID</th>
              <th className={th}>{t('colUserUuid')}</th>
              <th className={th}>{t('colVipId')}</th>
              <th className={th}>{t('colProgress')}</th>
              <th className={th}>{t('colCreator')}</th>
              <th className={th}>{t('colCreatedTime')}</th>
              <th className={th}>{t('colValid')}</th>
              <th className={th}>{t('colActions')}</th>
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
                  <Crown className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">{item.id}</td>
                  <td className="px-4 py-2.5 font-medium">{item.userUuid}</td>
                  <td className="px-4 py-2.5">{item.vipId}</td>
                  <td className="px-4 py-2.5">{item.progress ?? '-'}</td>
                  <td className="px-4 py-2.5">{item.creator ?? '-'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{item.createdTime ?? '-'}</td>
                  <td className="px-4 py-2.5">
                    {String(item.isValid ?? '-') === '1' ? (
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

      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('total', { total, page, totalPages })}</span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              {t('prev')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              {t('next')}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
