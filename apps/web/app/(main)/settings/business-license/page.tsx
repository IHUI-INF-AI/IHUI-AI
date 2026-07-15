'use client'

import * as React from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { FileImage, Eye } from 'lucide-react'

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
} from '@ihui/ui'
import { Container } from '@/components/layout'

const LICENSE_PLACEHOLDER = '/images/common/empty-box.svg'

export default function BusinessLicensePage() {
  const t = useTranslations('settings')
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const [licenseImage] = React.useState(LICENSE_PLACEHOLDER)
  const isPlaceholder = licenseImage === LICENSE_PLACEHOLDER

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('businessLicenseTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('businessLicenseDesc')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileImage className="h-4 w-4" />
            {t('businessLicenseCardTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="group relative w-full cursor-pointer overflow-hidden rounded-lg border bg-muted/30 transition-colors hover:bg-muted/60"
            onClick={() => setPreviewOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setPreviewOpen(true)
            }}
          >
            <Image
              src={licenseImage}
              alt={t('businessLicenseCardTitle')}
              width={600}
              height={420}
              className="mx-auto block max-h-[420px] w-auto max-w-full p-4"
            />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-black/50 py-2 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Eye className="h-3.5 w-3.5" />
              {t('businessLicensePreviewTip')}
            </div>
          </div>

          {isPlaceholder && (
            <div className="rounded-md border border-dashed bg-muted/20 p-4 text-center">
              <p className="text-sm text-muted-foreground">{t('businessLicensePlaceholder')}</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {t('businessLicensePlaceholderSub')}
              </p>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="h-4 w-4" />
            {t('businessLicensePreviewBtn')}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogTitle className="sr-only">{t('businessLicenseCardTitle')}</DialogTitle>
          <div className="flex items-center justify-center">
            <Image
              src={licenseImage}
              alt={t('businessLicenseCardTitle')}
              width={600}
              height={420}
              className="max-h-[70vh] w-auto max-w-full rounded-md"
            />
          </div>
        </DialogContent>
      </Dialog>
    </Container>
  )
}
