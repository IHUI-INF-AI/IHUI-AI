// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'

import { CertVerifyScreen, type CertVerifyResult } from '@ihui/rn-app/pilot'
import { apiOrThrow } from '@/lib/api'
import {
  CERT_NOT_FOUND_RESULT,
  createCertVerifyT,
  toCertResult,
  type WebCertRow,
} from '@/lib/rn-pilot/cert-verify-view-model'

interface CertVerifyResponse {
  certificate: WebCertRow | null
}

/**
 * 证书验证页 · web 消费共享屏(2026-11-07)。
 *
 * 取数契约保持改造前 web 现读:`GET /certificates/verify?no=`;成功且 `certificate`
 * 为空时**不渲染结果卡**(与改造前一致),请求失败才落到共享屏无效卡片。
 * 响应无颁发机构 ⇒ 不传 `issuer`,共享屏省略来源行。
 */
export default function CertVerifyPageClient() {
  const t = useTranslations('certVerify')
  const router = useRouter()
  const { resolvedTheme } = useTheme()

  const [result, setResult] = React.useState<CertVerifyResult | null>(null)
  const [loading, setLoading] = React.useState(false)
  const tShared = React.useMemo(() => createCertVerifyT(t), [t])
  const colorScheme = resolvedTheme === 'dark' ? 'dark' : 'light'

  const onVerify = React.useCallback(async (certNo: string) => {
    setLoading(true)
    try {
      const data = await apiOrThrow<CertVerifyResponse>(
        `/certificates/verify?no=${encodeURIComponent(certNo)}`,
      )
      setResult(data.certificate ? toCertResult(data.certificate) : null)
    } catch {
      setResult(CERT_NOT_FOUND_RESULT)
    } finally {
      setLoading(false)
    }
  }, [])

  const goBack = React.useCallback(() => {
    if (window.history.length <= 1) router.push('/certificate')
    else router.back()
  }, [router])

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] min-h-[480px] w-full max-w-md flex-col overflow-hidden py-4">
      <CertVerifyScreen
        t={tShared}
        initialCertNo=""
        result={result}
        loading={loading}
        error=""
        onVerify={onVerify}
        onBack={goBack}
        colorScheme={colorScheme}
      />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
