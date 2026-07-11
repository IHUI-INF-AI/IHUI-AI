'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Award, Loader2, Download, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface Certificate {
  id: string
  name: string
  issuedAt: string
  status: number
  certificateNo?: string
  templateName?: string
  nickname?: string
}

interface CertsData {
  list: Certificate[]
  total: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function formatDate(v?: string): string {
  if (!v) return '-'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('zh-CN')
}

export default function CertificateDownloadPage() {
  const t = useTranslations('certificate')
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)
  const [printingId, setPrintingId] = React.useState<string | null>(null)

  const STATUS_TEXT: Record<number, string> = {
    1: t('download.statusValid'),
    2: t('download.statusRevoked'),
  }

  const STATUS_STYLE: Record<number, string> = {
    1: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    2: 'bg-destructive/10 text-destructive',
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['certificates', 'my'],
    queryFn: () => api<CertsData>(`/api/certificates/my?page=1&pageSize=20`),
  })

  const list = data?.list ?? []

  /** 调用接口获取 PDF 文件并触发浏览器下载 */
  const handleDownload = async (cert: Certificate) => {
    setDownloadingId(cert.id)
    try {
      const token = useAuthStore.getState().token
      const res = await fetch(`/api/certificates/${cert.id}/download`, {
        method: 'POST',
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      })
      if (!res.ok) throw new Error(`${t('download.error')}（${res.status}）`)

      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${cert.name || 'certificate'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
      toast.success(t('download.downloadSuccess'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('download.error'))
    } finally {
      setDownloadingId(null)
    }
  }

  /** 将证书渲染为图片并调用浏览器打印为 PDF（html2canvas 不可用时回退到 window.print） */
  const handlePrint = async (cert: Certificate) => {
    setPrintingId(cert.id)
    try {
      const node = document.querySelector<HTMLDivElement>(`[data-print-cert-id="${cert.id}"]`)
      const printWindow = window.open('', '_blank', 'width=900,height=700')
      if (!printWindow) {
        toast.error(t('download.allowPopup'))
        return
      }

      // 尝试使用 html2canvas 把证书节点转为图片后再打印
      let imageHtml = ''
      if (node) {
        try {
          const mod = await import('html2canvas')
          const html2canvas = mod.default ?? mod
          const canvas = await html2canvas(node, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
          })
          imageHtml = `<img src="${canvas.toDataURL('image/png')}" style="width:100%;" />`
        } catch {
          // html2canvas 未安装或渲染失败，使用 HTML 直接打印
          imageHtml = ''
        }
      }

      const bodyContent =
        imageHtml ||
        `
        <div style="text-align:center;padding:48px 24px;">
          <h1 style="font-size:28px;margin:0 0 8px;">${cert.name}</h1>
          <p style="color:#666;margin:0 0 24px;">${t('download.certNo')}：${cert.certificateNo ?? '-'}</p>
          <div style="font-size:16px;line-height:2;">
            <p>${t('download.holder')}：${cert.nickname ?? '-'}</p>
            <p>${t('download.issueTime')}：${formatDate(cert.issuedAt)}</p>
            <p>${STATUS_TEXT[cert.status] ?? t('download.statusValid')}</p>
          </div>
        </div>`

      printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8" />
        <title>${cert.name}</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color:#1f2937; }
          @page { margin: 16mm; }
        </style></head><body>${bodyContent}</body></html>`)
      printWindow.document.close()
      printWindow.focus()

      printWindow.onload = () => {
        printWindow.print()
      }
      // 部分浏览器需要立即触发
      setTimeout(() => {
        printWindow.print()
      }, 300)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('download.printError'))
    } finally {
      setPrintingId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Award className="h-6 w-6 text-primary" />
          {t('download.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('download.subtitle')}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('download.loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <Award className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('download.noCertificates')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((cert) => {
            const isDownloading = downloadingId === cert.id
            const isPrinting = printingId === cert.id
            const isRevoked = cert.status === 2
            return (
              <Card key={cert.id} className="transition-colors hover:border-primary/40">
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
                      'inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                      STATUS_STYLE[cert.status] ?? STATUS_STYLE[1],
                    )}
                  >
                    {STATUS_TEXT[cert.status] ?? t('download.statusValid')}
                  </span>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('download.issueTime')}</span>
                      <span className="font-medium">{formatDate(cert.issuedAt)}</span>
                    </div>
                    {cert.templateName && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{t('download.template')}</span>
                        <span className="line-clamp-1 font-medium">{cert.templateName}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrint(cert)}
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
                      onClick={() => handleDownload(cert)}
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
      )}

      {/* 用于 html2canvas 截图打印的隐藏渲染区域 */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        {list.map((cert) => (
          <div
            key={cert.id}
            data-print-cert-id={cert.id}
            style={{
              width: '800px',
              padding: '64px 48px',
              background: '#ffffff',
              textAlign: 'center',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              color: '#1f2937',
            }}
          >
            <div style={{ fontSize: '14px', color: '#9ca3af', letterSpacing: '2px' }}>
              CERTIFICATE
            </div>
            <h1 style={{ fontSize: '32px', margin: '12px 0 8px' }}>{cert.name}</h1>
            <p style={{ color: '#6b7280', marginBottom: '32px' }}>
              {t('download.certNo')}：{cert.certificateNo ?? '-'}
            </p>
            <div style={{ fontSize: '16px', lineHeight: '2.2', color: '#374151' }}>
              <p>{t('download.certText', { name: cert.nickname ?? '-' })}</p>
              <p>
                {t('download.issueTime')}：{formatDate(cert.issuedAt)}
              </p>
              <p>
                {t('download.status')}: {STATUS_TEXT[cert.status] ?? t('download.statusValid')}
              </p>
            </div>
            <div
              style={{
                marginTop: '48px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px',
                color: '#6b7280',
              }}
            >
              <span>{t('download.issuingOrg')}</span>
              <span>{formatDate(cert.issuedAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
