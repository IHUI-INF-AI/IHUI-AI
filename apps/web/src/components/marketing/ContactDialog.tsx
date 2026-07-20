'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@ihui/ui'

/**
 * ContactDialog — 联系我们弹窗
 *
 * 2026-07-20 新建:footer "联系我们" 链接改弹窗(用户要求"点击后是弹出一个
 * 弹窗窗口")。内容仅显示站点核心联系信息 + 微信二维码图片,无表单提交
 * 复杂度,聚焦轻量展示。
 */

export function ContactDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('footer')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            {t('contactUs')}
          </DialogTitle>
          <DialogDescription>{t('contactSubtitle')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <div className="font-medium">{t('companyName')}</div>
              <div className="text-xs text-muted-foreground">
                {t('addressLine1')}
                <br />
                {t('addressLine2')}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="text-xs">
              <div>{t('companyContact')}</div>
              <div className="text-muted-foreground">{t('companyEmail2')}</div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="text-xs text-muted-foreground">{t('companyEmail')}</div>
          </div>

          <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
            <img
              src="/footer/erweima/wechat-vx.png"
              alt={t('contactWechat')}
              width={64}
              height={64}
              className="h-16 w-16 rounded-sm border bg-background object-contain"
              loading="eager"
              decoding="sync"
            />
            <div className="text-xs text-muted-foreground">{t('contactWechatHint')}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
