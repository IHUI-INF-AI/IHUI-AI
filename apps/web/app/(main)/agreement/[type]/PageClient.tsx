// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'

import { apiOrThrow } from '@/lib/api'
import { AgreementScreen } from '@ihui/rn-app/pilot'
import {
  agreementFallbackTitle,
  normalizeAgreementType,
  toAgreementContentView,
  type AgreementPayload,
} from '@/lib/rn-pilot/agreement-view-model'
import { useSharedScreenT } from '@/lib/rn-pilot/use-shared-screen-t'

/**
 * 协议详情页 · web 消费共享屏(2026-11-08 收编)。
 *
 * 本文件只做「路由归一化 + 取数 + 文案注入」,正文渲染整屏交给
 * `@ihui/rn-app/pilot` 的 AgreementScreen(RN/小程序同源),web 不再自持一份
 * 手写的协议版式。
 *
 * 口径保持:
 *  - 取数 `GET /api/agreements/current?type=…`,失败/空数据 ⇒ 共享屏静态兜底分支;
 *  - 回退标题沿用改造前 web 的 zh 文案(TYPE_TITLE.zh),未知 type 原样透传;
 *  - 返回目标沿用改造前的 `<Link href="/">`,即 `router.push('/')`。
 */
export default function AgreementTypePage() {
  const params = useParams<{ type: string }>()
  const rawType = params.type ?? ''
  const apiType = normalizeAgreementType(rawType)
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const t = useSharedScreenT()

  const { data, isLoading } = useQuery({
    queryKey: ['agreement', apiType],
    queryFn: () =>
      apiOrThrow<AgreementPayload>(`/api/agreements/current?type=${encodeURIComponent(apiType)}`),
    retry: false,
  })

  const colorScheme = resolvedTheme === 'dark' ? 'dark' : 'light'

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] min-h-[480px] w-full max-w-4xl flex-col overflow-hidden px-4 py-4">
      <AgreementScreen
        t={t}
        agreement={toAgreementContentView(data)}
        loading={isLoading}
        fallbackTitle={agreementFallbackTitle(apiType, rawType)}
        onBack={() => router.push('/')}
        colorScheme={colorScheme}
      />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
