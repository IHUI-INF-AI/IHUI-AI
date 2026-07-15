'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Award } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

import { useAuthStore } from '@/stores/auth'

import { CertificateList } from './CertificateList'
import { CertificatePrintArea } from './CertificatePrintArea'
import { api } from './helpers'
import { formatDate } from '@/lib/date-utils'
import type { Certificate, CertsData } from './types'

export default function CertificateDownloadPage() {
  const t = useTranslations('certificate')
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)
  const [printingId, setPrintingId] = React.useState<string | null>(null)

  const STATUS_TEXT: Record<number, string> = {
    1: t('download.statusValid'),
    2: t('download.statusRevoked'),
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
            <p>${t('download.issueTime')}：${cert.issuedAt ? formatDate(cert.issuedAt) : '-'}</p>
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

      <CertificateList
        list={list}
        isLoading={isLoading}
        error={error as Error | null}
        downloadingId={downloadingId}
        printingId={printingId}
        statusText={STATUS_TEXT}
        onDownload={handleDownload}
        onPrint={handlePrint}
      />

      <CertificatePrintArea list={list} statusText={STATUS_TEXT} />
    </div>
  )
}
