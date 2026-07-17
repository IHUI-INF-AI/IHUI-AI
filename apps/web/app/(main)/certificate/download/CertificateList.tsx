'use client'

import { Award, Loader2, Download, Printer } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/date-utils'
import { STATUS_STYLE } from './helpers'
import type { Certificate } from './types'

interface Props {
  list: Certificate[]
  isLoading: boolean
  error: Error | null
  downloadingId: string | null
  printingId: string | null
  statusText: Record<number, string>
  onDownload: (cert: Certificate) => void
  onPrint: (cert: Certificate) => void
}

export function CertificateList({
  list,
  isLoading,
  error,
  downloadingId,
  printingId,
  statusText,
  onDownload,
  onPrint,
}: Props) {
  const t = useTranslations('certificate')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('download.loading')}
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error.message}
      </div>
    )
  }
  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
        <Award className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t('download.noCertificates')}</p>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {list.map((cert) => {
        const isDownloading = downloadingId === cert.id
        const isPrinting = printingId === cert.id
        const isRevoked = cert.status === 2
        return (
          <Card key={cert.id} className="transition-colors hover:bg-accent">
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Award className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-base">{cert.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {t('download.certNo')}：{cert.certificateNo ?? '-'}
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  'inline-flex shrink-0 rounded-md px-2 py-0.5 text-xs font-medium',
                  STATUS_STYLE[cert.status] ?? STATUS_STYLE[1],
                )}
              >
                {statusText[cert.status] ?? t('download.statusValid')}
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('download.issueTime')}</span>
                  <span className="font-medium">
                    {cert.issuedAt ? formatDate(cert.issuedAt) : '-'}
                  </span>
                </div>
                {cert.templateName && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('download.template')}</span>
                    <span className="font-medium">{cert.templateName}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPrint(cert)}
                  disabled={isPrinting || isRevoked}
                >
                  {isPrinting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="h-4 w-4" />
                  )}
                  {t('download.printPdf')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => onDownload(cert)}
                  disabled={isDownloading || isRevoked}
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {t('download.download')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
