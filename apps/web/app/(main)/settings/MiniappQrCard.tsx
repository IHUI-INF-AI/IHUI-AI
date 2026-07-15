'use client'

import Image from 'next/image'
import { Smartphone } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui'

interface Props {
  t: (k: string) => string
}

export function MiniappQrCard({ t }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="h-4 w-4" />
          {t('miniappQr')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/images/common/miniapp-qr.png"
            alt={t('miniappQr')}
            width={192}
            height={192}
            className="h-48 w-48 rounded-lg border"
          />
          <p className="text-sm text-muted-foreground">{t('miniappQrDesc')}</p>
        </div>
      </CardContent>
    </Card>
  )
}
