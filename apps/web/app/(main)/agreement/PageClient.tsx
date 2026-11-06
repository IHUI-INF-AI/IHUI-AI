// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { FileText } from 'lucide-react'

import { AgreementScreen } from '@ihui/rn-app/pilot'
import { apiOrThrow } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useSharedScreenT } from '@/lib/rn-pilot/use-shared-screen-t'
import {
  normalizeAgreementType,
  toAgreementContentView,
  type AgreementPayload,
} from '@/lib/rn-pilot/agreement-view-model'

type AgreementType = 'user' | 'privacy'

const TABS: { key: AgreementType; labelKey: string }[] = [
  { key: 'user', labelKey: 'userAgreement' },
  { key: 'privacy', labelKey: 'privacyPolicy' },
]

/**
 * agreement 切换页薄壳(web 收编试点 · 2026-11-07)。
 *
 * 页内只剩协议类型切换条 + 共享屏入口;标题/元信息/正文全部由共享 AgreementScreen 渲染。
 */
export default function AgreementPage() {
  const t = useTranslations('agreement')
  const tShared = useSharedScreenT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { resolvedTheme } = useTheme()

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
        `/api/agreements/current?type=${normalizeAgreementType(activeType)}`,
      ),
    retry: false,
  })

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] min-h-[480px] w-full max-w-4xl flex-col overflow-hidden px-4 py-4">
      <div className="mb-2 flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
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
            <FileText className="h-3.5 w-3.5" />
            {t(tab.labelKey)}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <AgreementScreen
          t={tShared}
          onBack={() => router.back()}
          colorScheme={resolvedTheme === 'dark' ? 'dark' : 'light'}
          agreement={toAgreementContentView(data)}
          loading={isLoading}
          fallbackTitle={t(activeType === 'privacy' ? 'privacyPolicy' : 'userAgreement')}
        />
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
