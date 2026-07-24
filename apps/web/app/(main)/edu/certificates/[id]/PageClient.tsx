'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, Award, Loader2, Download, Printer } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface CertificateDetail {
  id: string
  name: string
  certificateNo: string
  courseName?: string
  recipientName: string
  issuedAt: string
  status: number
  description?: string
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function EduCertificateDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('eduCertificatesPage')
  const [downloading, setDownloading] = React.useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'certificate', id],
    queryFn: () =>
      api<{ certificate: CertificateDetail }>(`/api/edu/certificates/${id}`).then(
        (d) => d.certificate,
      ),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const fmt = (v: string) => {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const handleDownload = async () => {
    if (!data) return
    setDownloading(true)
    try {
      const res = await fetch(`/api/edu/certificates/${id}/download`, { method: 'POST' })
      if (!res.ok) throw new Error(t('downloadFailed', { status: res.status }))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${data.name || 'certificate'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      window.print()
    } finally {
      setDownloading(false)
    }
  }

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )

  if (error || !data) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => router.push('/edu/certificates')}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToList')}
        </button>
        <Alert variant="danger" description={(error as Error)?.message ?? t('notFound')} />
      </div>
    )
  }

  const cert = data

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href="/edu/certificates"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Award className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">{cert.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('certificateNo', { no: cert.certificateNo })}</p>
          <span
            className={cn(
              'mx-auto mt-2 inline-block rounded-md px-3 py-0.5 text-xs',
              cert.status === 1
                ? 'bg-emerald-500/10 text-emerald-600'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {cert.status === 1 ? t('status.valid') : t('status.revoked')}
          </span>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="mx-auto max-w-md space-y-4 rounded-lg border bg-gradient-to-br from-primary/5 to-transparent p-8 text-center">
            <p className="text-lg font-semibold">{cert.recipientName}</p>
            <p className="text-sm text-muted-foreground">{t('completed')}</p>
            <p className="text-base font-medium">{cert.courseName ?? cert.name}</p>
            <p className="text-sm text-muted-foreground">{t('issuanceText')}</p>
            <p className="pt-2 text-sm text-muted-foreground">{t('issuedAt', { date: fmt(cert.issuedAt) })}</p>
          </div>

          {cert.description && (
            <p className="text-center text-sm text-muted-foreground">{cert.description}</p>
          )}

          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              {t('print')}
            </Button>
            <Button onClick={handleDownload} disabled={downloading}>
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {t('download')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
