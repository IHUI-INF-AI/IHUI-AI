// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'

import { UsageScreen } from '@ihui/rn-app/pilot'
import { fetchApi } from '@/lib/api'
import { BackButton, AuthGatePrompt } from '@/components/common'
import { useAuthGate } from '@/hooks/use-auth-gate'
import {
  createUsageT,
  toUsageQuota,
  toUsageStats,
  type WebUsageQuota,
  type WebUsageStats,
} from '@/lib/rn-pilot/usage-view-model'

/**
 * Token 用量页 · web 消费共享屏(2026-11-07)。
 *
 * 取数契约保持不变:`GET /api/v1/ai/usage/stats?days=30` + `/api/v1/ai/usage/quota`;
 * 鉴权门与请求基址留在本 wrapper,共享 UsageScreen 只收 stats/quota/loading/error。
 * 共享屏内部按 RN 同口径收敛为「近 14 天柱状 + 模型 TOP10」,见等价对照表。
 */
export default function UsagePageClient() {
  const tGate = useTranslations('chatHistory')
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const { allow } = useAuthGate()

  const [stats, setStats] = React.useState<WebUsageStats | null>(null)
  const [quota, setQuota] = React.useState<WebUsageQuota | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const load = React.useCallback(async () => {
    setLoading(true)
    setError('')
    await Promise.all([
      fetchApi<WebUsageStats>('/api/v1/ai/usage/stats?days=30'),
      fetchApi<WebUsageQuota>('/api/v1/ai/usage/quota'),
    ])
      .then(([statsRes, quotaRes]) => {
        if (statsRes.success) setStats(statsRes.data)
        else setError(statsRes.error || '数据加载失败')
        if (quotaRes.success) setQuota(quotaRes.data)
      })
      .catch(() => setError('数据加载失败'))
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => {
    if (!allow) return
    void load()
  }, [allow, load])

  const tShared = React.useMemo(() => createUsageT(), [])
  const colorScheme = resolvedTheme === 'dark' ? 'dark' : 'light'

  if (!allow) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-4">
        <BackButton />
        <AuthGatePrompt message={tGate('loginRequired')} />
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] min-h-[480px] w-full max-w-4xl flex-col overflow-hidden px-4 py-4">
      <UsageScreen
        t={tShared}
        stats={toUsageStats(stats)}
        quota={toUsageQuota(quota)}
        loading={loading}
        error={error || null}
        onRetry={() => void load()}
        onBack={() => router.back()}
        colorScheme={colorScheme}
      />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
