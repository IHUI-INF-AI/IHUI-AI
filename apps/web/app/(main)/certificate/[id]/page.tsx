'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Award, Download, Loader2, Printer } from 'lucide-react'
import { Button } from '@ihui/ui-react'

import { CertificateTemplate } from '@/components/certificate'
import { fetchApi } from '@/lib/api'
import { formatDate } from '@/lib/date-utils'
import { useAuthStore } from '@/stores/auth'

interface CertificateDetail {
  id: string
  certificateNo: string
  title: string
  recipientName: string | null
  nickname: string | null
  source: string | null
  issuedAt: string | null
  status: number
  templateName: string | null
  /** 服务端模板 variant 推断(从 templateConfig 解析) */
  variant?: 'compact' | 'classical'
}

export default function CertificateDetailPage() {
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('certificate.detail')

  const { data, isLoading, error } = useQuery({
    queryKey: ['certificates', 'detail', id],
    queryFn: async (): Promise<CertificateDetail | null> => {
      const r = await fetchApi<{ certificate: CertificateDetail }>(
        `/api/certificates/${id}`,
      )
      if (!r.success) throw new Error(r.error)
      return r.data.certificate
    },
    enabled: Boolean(id),
  })

  /** 打印为 PDF:走原生 window.print,@page 横向 A4 由浏览器按样式渲染 */
  const onPrint = React.useCallback(() => {
    if (typeof window !== 'undefined') window.print()
  }, [])

  /** 下载 PDF(走 /api/certificates/:id/download,与已有逻辑保持一致) */
  const [downloading, setDownloading] = React.useState(false)
  const onDownload = React.useCallback(async () => {
    if (!data) return
    setDownloading(true)
    try {
      const token = useAuthStore.getState().token
      const res = await fetch(`/api/certificates/${data.id}/download`, {
        method: 'POST',
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      })
      if (!res.ok) throw new Error(`${t('downloadError')} (${res.status})`)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${data.certificateNo || 'certificate'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch (err) {
      // 下载失败时降级到打印
      console.error('download failed', err)
      onPrint()
    } finally {
      setDownloading(false)
    }
  }, [data, onPrint, t])

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 print:max-w-full print:space-y-0">
      <div className="flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/certificate/download">
            <ArrowLeft className="h-4 w-4" />
            {t('backToList')}
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onPrint} disabled={!data}>
            <Printer className="h-4 w-4" />
            {t('printAction')}
          </Button>
          <Button size="sm" onClick={onDownload} disabled={!data || downloading}>
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t('downloadAction')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : !data ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          <Award className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          {t('notFound')}
        </div>
      ) : (
        <>
          <CertificateTemplate
            variant={data.variant ?? 'compact'}
            certificateNo={data.certificateNo}
            title={data.title}
            recipientName={data.recipientName || data.nickname || t('unknownRecipient')}
            issuedAt={data.issuedAt}
            issuingOrganization={t('defaultIssuer')}
            awarderName={t('defaultAwarder')}
            awardConditions={t('defaultConditions')}
            validityPolicy={t('defaultValidity')}
          />
          <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 print:hidden">
            <MetaRow label={t('certNo')} value={data.certificateNo} />
            <MetaRow label={t('issueDate')} value={data.issuedAt ? formatDate(data.issuedAt) : '-'} />
            {data.source && <MetaRow label={t('source')} value={data.source} />}
            {data.templateName && <MetaRow label={t('template')} value={data.templateName} />}
            <MetaRow
              label={t('status')}
              value={data.status === 1 ? t('statusValid') : t('statusRevoked')}
            />
          </div>
        </>
      )}
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}
