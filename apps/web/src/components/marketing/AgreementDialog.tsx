'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Calendar, FileText, Loader2, Tag } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@ihui/ui'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { fetchApi } from '@/lib/api'
import { SafeHtml } from '@/components/common'

/**
 * AgreementDialog — 用户协议/隐私政策弹窗
 *
 * 2026-07-20 新建:footer 协议链接改弹窗(原 /agreement 完整页跳转,用户要求
 * "点击后是弹出一个弹窗窗口 而不是一个完整的页面")。复用 /agreement 页面的
 * API 查询 + 静态 fallback 逻辑,内容不重复实现,保持单源。
 *
 * 用法:
 *   const [open, setOpen] = useState(false)
 *   <button onClick={() => setOpen(true)}>用户协议</button>
 *   <AgreementDialog type="user" open={open} onOpenChange={setOpen} />
 */

type AgreementType = 'user' | 'privacy'

// 前端短名 → 后端完整 type
const TYPE_MAP: Record<AgreementType, string> = {
  user: 'user-agreement',
  privacy: 'privacy-policy',
}

interface Agreement {
  id: string
  title: string
  content: string
  version?: string | null
  effectiveDate?: string | null
  type?: string | null
}

export function AgreementDialog({
  type,
  open,
  onOpenChange,
}: {
  type: AgreementType
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('agreement')
  const tFooter = useTranslations('footer')
  const locale = useLocale()

  const { data, isLoading, error } = useQuery({
    queryKey: ['agreement', type, open],
    queryFn: async () => {
      const r = await fetchApi<Agreement>(`/api/agreements/current?type=${TYPE_MAP[type]}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    enabled: open,
    retry: false,
  })

  const title = type === 'privacy' ? t('privacyPolicy') : t('userAgreement')
  const fmtDate = (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : new Intl.DateTimeFormat(locale).format(d)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{tFooter('agreementSubtitle')}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : error || !data ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5" />
                  {t('version')}: v1.0.0
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {t('effectiveDate')}: {fmtDate(new Date().toISOString())}
                </span>
              </div>
              <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                <p>{t('staticContent1')}</p>
                <p>{t('staticContent2')}</p>
                <p>{t('staticContent3')}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{data.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b pb-3 text-xs text-muted-foreground">
                {data.version && (
                  <span className="inline-flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5" />
                    {t('version')}: {data.version}
                  </span>
                )}
                {data.effectiveDate && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {t('effectiveDate')}: {fmtDate(data.effectiveDate)}
                  </span>
                )}
              </div>
              <SafeHtml
                html={data.content}
                className="prose prose-sm max-w-none dark:prose-invert"
              />
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  )
}
