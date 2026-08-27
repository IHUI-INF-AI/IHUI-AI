'use client'

import { useTranslations } from 'next-intl'
import { Users } from 'lucide-react'

import { Card, CardContent } from '@ihui/ui-react'
import { BackButton } from '@/components/common'

/** 与原版一致的 CDN 图片资源(社群宣传卡) */
const AVATAR_IMAGE =
  'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/recruitment/xuancai@2x.png'
const QR_IMAGE =
  'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/recruitment/ewm@2x.png'

export default function CartePage() {
  const t = useTranslations('carte')
  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <BackButton fallbackHref="/" />
        <h1 className="text-lg font-medium">{t('title')}</h1>
        <div className="w-10" />
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-b from-[#f4f4fb] to-[#9395e4] p-6 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={AVATAR_IMAGE}
              alt=""
              className="mx-auto mb-3 h-20 w-20 rounded-md object-cover"
            />
            <h2 className="text-base font-medium text-black">
              AI智汇社 | 私董会创始人 | 李总
            </h2>
            <p className="mt-1 text-sm text-black/70">{t('recommend')}</p>
          </div>
          <div className="space-y-4 p-6 text-center">
            <p className="text-sm font-medium">{t('inviteHint')}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={QR_IMAGE} alt="" className="mx-auto w-48" />
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {t('scanHint')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
