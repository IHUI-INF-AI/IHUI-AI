// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { UsageScreen as SharedUsageScreen, type UsageQuota, type UsageStats } from '@ihui/rn-app'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import { WEB_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * Token 用量统计屏(RN 端),对齐 web `/settings/usage`。
 *
 * 〔门 39 六屏共享化第一批 2026-10-22〕UI 已下沉到共享层 `@ihui/rn-app` 的 UsageScreen ——
 * 本文件改成 wrapper,只留平台侧三件事:API 调用、i18n 与主题注入。头部/卡片/进度条/
 * 加载/错误态由共享层渲染,与 PaymentScreen / ConnectorsScreen 同一型 wrapper 模式。
 * **不准**靠"补一条 @ihui/rn-app import"或塞白名单消门 39 的红 —— 那两条都不改真实共享度。
 *
 * 端点真实实现在 **apps/ai-service**(app/routers/usage.py,prefix `/api/v1/ai/usage`):
 *  - GET /api/v1/ai/usage/quota → { user_id, used_tokens, quota_limit, remaining, usage_percent }
 *  - GET /api/v1/ai/usage/stats?days=30 → { total_tokens, total_input_tokens, total_output_tokens,
 *      total_cost, total_calls, daily_breakdown, model_breakdown, provider_breakdown }
 *
 * 为什么基址取 WEB_BASE_URL 而不是 API_BASE_URL:`/api/v1/ai/usage/*` 只注册在 ai-service,
 * apps/api(api.aizhs.top / 8802)没有该路由;web 站点由 next.config.ts 的 rewrite
 * `/api/v1/ai/usage/:path*` 转到 8803。RN 复用它即与 web 页走同一条真实链路,不新增客户端配置。
 * ai-service 认 Bearer token,fetchApi 会带上当前登录态。
 */
export default function UsageScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const [stats, setStats] = useState<UsageStats | null>(null)
  const [quota, setQuota] = useState<UsageQuota | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [statsRes, quotaRes] = await Promise.all([
        fetchApi<UsageStats>(`${WEB_BASE_URL}/api/v1/ai/usage/stats`, { params: { days: 30 } }),
        fetchApi<UsageQuota>(`${WEB_BASE_URL}/api/v1/ai/usage/quota`),
      ])
      if (!statsRes.success) {
        setError(statsRes.error || t('usage.loadFailed'))
        return
      }
      if (!quotaRes.success) {
        setError(quotaRes.error || t('usage.loadFailed'))
        return
      }
      setStats(statsRes.data)
      setQuota(quotaRes.data)
    } catch {
      setError(t('usage.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedUsageScreen
      t={t}
      stats={stats}
      quota={quota}
      loading={loading}
      error={error}
      onRetry={() => void load()}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
