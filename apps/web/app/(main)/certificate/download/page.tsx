// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Award } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

import { fetchRaw } from '@/lib/api'

import { CertificateList } from './CertificateList'
import { CertificatePrintArea } from './CertificatePrintArea'
import { api } from './helpers'
import { formatDate } from '@/lib/date-utils'
import { escapeHtml } from '@ihui/shared'
import { useAuthGate } from '@/hooks/use-auth-gate'
import { AuthGatePrompt } from '@/components/common'
import type { Certificate, CertsData } from './types'

export default function CertificateDownloadPage() {
  const t = useTranslations('certificate')
  // 2026-10-15 登录态门(与 /chat/favorites、签到助手同型):未就绪/未登录不发注定 401 的查询
  const tGate = useTranslations('chatHistory')
  const { allow } = useAuthGate()
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)
  const [printingId, setPrintingId] = React.useState<string | null>(null)

  const STATUS_TEXT: Record<number, string> = {
    1: t('download.statusValid'),
    2: t('download.statusRevoked'),
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['certificates', 'my'],
    enabled: allow,
    queryFn: () => api<CertsData>(`/api/certificates/my?page=1&pageSize=20`),
  })

  const list = data?.list ?? []

  /** 调用接口获取 PDF 文件并触发浏览器下载 */
  const handleDownload = async (cert: Certificate) => {
    setDownloadingId(cert.id)
    try {
      // 2026-09-09 0-5 直接 fetch 清单化迁移:blob 下载走共享 fetchRaw,
      // 鉴权/CSRF/设备指纹/超时由共享层统一承担(失败自动抛错,走 catch toast)。
      const blob = await fetchRaw(`/api/certificates/${cert.id}/download`, { method: 'POST' })
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

      // 2026-11-01 安全强化:这三枚都是**库存字符串**(cert.name varchar(200)、
      // certificateNo、nickname 用户可写),原先未转义就写进 document.write 的模板里 ——
      // 打印窗是 window.open('', '_blank') 开出的**同源**文档,发证方(或任何能写证书名的
      // 面)塞一枚 <img src=x onerror=…> 即在被打印者的同源上下文里执行,而该窗的
      // window.opener 指向已登录的本站会话。同仓的导出路径
      // (src/components/chat/conversation-export.ts)对每一处插值都转义,本页此前是唯一的例外。
      const bodyContent =
        imageHtml ||
        `
        <div style="text-align:center;padding:48px 24px;">
          <h1 style="font-size:28px;margin:0 0 8px;">${escapeHtml(cert.name)}</h1>
          <p style="color:#666;margin:0 0 24px;">${t('download.certNo')}：${escapeHtml(cert.certificateNo ?? '-')}</p>
          <div style="font-size:16px;line-height:2;">
            <p>${t('download.holder')}：${escapeHtml(cert.nickname ?? '-')}</p>
            <p>${t('download.issueTime')}：${cert.issuedAt ? formatDate(cert.issuedAt) : '-'}</p>
            <p>${escapeHtml(STATUS_TEXT[cert.status] ?? t('download.statusValid'))}</p>
          </div>
        </div>`

      printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8" />
        <title>${escapeHtml(cert.name)}</title>
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
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Award className="h-6 w-6 text-primary" />
          {t('download.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('download.subtitle')}</p>
      </div>

      {!allow ? (
        <AuthGatePrompt message={tGate('loginRequired')} />
      ) : (
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
      )}

      <CertificatePrintArea list={list} statusText={STATUS_TEXT} />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
