// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { BadgeCheck, Loader2, Search, ShieldCheck } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, Input, Label } from '@ihui/ui-react'
import { BackButton } from '@/components/common'

interface CertInfo {
  certificate: {
    id: string
    certNo: string
    title: string
    holderName: string | null
    issueDate: string | null
    status: number
  } | null
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function CertVerifyPage() {
  const t = useTranslations('certVerify')
  const [no, setNo] = React.useState('')
  const [result, setResult] = React.useState<CertInfo['certificate'] | null | 'notfound'>(null)
  const [loading, setLoading] = React.useState(false)

  const onVerify = async () => {
    const certNo = no.trim()
    if (!certNo) return
    setLoading(true)
    setResult(null)
    try {
      const data = await api<CertInfo>(`/certificates/verify?no=${encodeURIComponent(certNo)}`)
      setResult(data.certificate ?? null)
    } catch {
      setResult('notfound')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <BackButton fallbackHref="/certificate" />
        <h1 className="text-lg font-medium">{t('title')}</h1>
        <div className="w-10" />
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t('subtitle')}</p>

      <Card className="mb-4">
        <CardContent className="space-y-3 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="cert-no">{t('certNoLabel')}</Label>
            <Input
              id="cert-no"
              value={no}
              onChange={(e) => setNo(e.target.value)}
              placeholder={t('certNoPlaceholder')}
              maxLength={100}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onVerify()
              }}
            />
          </div>
          <Button className="w-full" disabled={loading || !no.trim()} onClick={() => void onVerify()}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            {t('verifyBtn')}
          </Button>
        </CardContent>
      </Card>

      {result === 'notfound' ? (
        <Card>
          <CardContent className="flex flex-col items-center py-8 text-center">
            <ShieldCheck className="mb-2 h-8 w-8 text-destructive" />
            <p className="text-sm font-medium">{t('notFound')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('notFoundHint')}</p>
          </CardContent>
        </Card>
      ) : result ? (
        <Card>
          <CardContent className="flex flex-col items-center py-8 text-center">
            <BadgeCheck className="mb-2 h-8 w-8 text-green-600" />
            <p className="text-sm font-medium">{t('verified')}</p>
            <div className="mt-4 w-full space-y-2 text-left text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t('certTitle')}</span>
                <span className="text-right font-medium">{result.title}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t('certNo')}</span>
                <span className="text-right font-medium">{result.certNo}</span>
              </div>
              {result.holderName ? (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{t('holderName')}</span>
                  <span className="text-right font-medium">{result.holderName}</span>
                </div>
              ) : null}
              {result.issueDate ? (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{t('issueDate')}</span>
                  <span className="text-right font-medium">{result.issueDate.slice(0, 10)}</span>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
