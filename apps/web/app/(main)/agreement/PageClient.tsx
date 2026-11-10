// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'

import { apiOrThrow } from '@/lib/api'
import { AgreementScreen } from '@ihui/rn-app/pilot'
import { cn } from '@/lib/utils'
import {
  agreementFallbackTitle,
  normalizeAgreementType,
  toAgreementContentView,
  type AgreementPayload,
} from '@/lib/rn-pilot/agreement-view-model'
import { useSharedScreenT } from '@/lib/rn-pilot/use-shared-screen-t'

type AgreementType = 'user' | 'privacy'

const TABS: { key: AgreementType; labelKey: string }[] = [
  { key: 'user', labelKey: 'userAgreement' },
  { key: 'privacy', labelKey: 'privacyPolicy' },
]

/**
 * 协议总览页(带类型切换条)· web 消费共享屏(2026-11-08 收编)。
 *
 * 类型切换条是页内导航(共享屏没有),属壳职责,留在本文件;正文渲染整屏交给
 * `@ihui/rn-app/pilot` 的 AgreementScreen。返回走浏览器历史(`router.back()`),
 * 不再自注册顶栏返回组件,避免与全局顶栏重复。
 */
export default function AgreementPage() {
  const t = useTranslations('agreement')
  const tShared = useSharedScreenT()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const searchParams = useSearchParams()

  const typeParam = (searchParams.get('type') as AgreementType | null) ?? 'user'
  const [activeType, setActiveType] = React.useState<AgreementType>(
    typeParam === 'privacy' ? 'privacy' : 'user',
  )

  React.useEffect(() => {
    if (typeParam === 'privacy' || typeParam === 'user') {
      setActiveType(typeParam)
    }
  }, [typeParam])

  const { data, isLoading } = useQuery({
    queryKey: ['agreement', activeType],
    queryFn: () =>
      apiOrThrow<AgreementPayload>(
        `/api/agreements/current?type=${encodeURIComponent(normalizeAgreementType(activeType))}`,
      ),
    retry: false,
  })

  const colorScheme = resolvedTheme === 'dark' ? 'dark' : 'light'

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4">
      {/* 协议类型切换 */}
      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveType(tab.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-body font-medium transition-colors',
              activeType === tab.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      <div className="flex min-h-[480px] flex-col overflow-hidden">
        <AgreementScreen
          t={tShared}
          agreement={toAgreementContentView(data)}
          loading={isLoading}
          fallbackTitle={agreementFallbackTitle(normalizeAgreementType(activeType), activeType)}
          onBack={() => router.back()}
          colorScheme={colorScheme}
        />
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
