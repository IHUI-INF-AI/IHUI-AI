'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, Mail } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@ihui/ui'

interface PrivateLetter {
  id: number
  senderId: string
  senderName: string | null
  receiverId: string
  receiverName: string | null
  content: string
  isRead: boolean
  createdAt: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const th = 'px-4 py-2.5 font-medium'

export default function PrivateLettersPage() {
  const t = useTranslations('admin.privateLetters')
  const tc = useTranslations('common')
  const [currentPage] = React.useState(1)
  const [detail, setDetail] = React.useState<PrivateLetter | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'private-letters', currentPage],
    queryFn: () => api<{ list: PrivateLetter[] }>('/api/admin/private-letters'),
  })

  const list = data?.list ?? []

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className={th}>{t('colSender')}</th>
              <th className={th}>{t('colReceiver')}</th>
              <th className={th}>{t('colLastMessage')}</th>
              <th className={th}>{t('colUpdatedAt')}</th>
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
                  <Mail className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{item.senderName ?? '-'}</td>
                  <td className="px-4 py-2.5">{item.receiverName ?? '-'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate">
                    {item.content}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{item.createdAt}</td>
                  <td className="px-4 py-2.5">
                    <button
                      className="text-primary hover:underline"
                      onClick={() => setDetail(item)}
                    >
                      {t('view')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>私信详情</DialogTitle>
            <DialogDescription>查看私信完整内容</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-muted-foreground">{t('colSender')}：</span>
                  <span className="font-medium">{detail.senderName ?? '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('colReceiver')}：</span>
                  <span className="font-medium">{detail.receiverName ?? '-'}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-muted-foreground">已读状态：</span>
                  <span className={detail.isRead ? 'text-emerald-600' : 'text-muted-foreground'}>
                    {detail.isRead ? '已读' : '未读'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('colUpdatedAt')}：</span>
                  <span>{detail.createdAt}</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground">{t('colLastMessage')}：</span>
                <div className="rounded-md border bg-muted/30 p-3 whitespace-pre-wrap break-words">
                  {detail.content}
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setDetail(null)}>
              {tc('close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
