// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'

import { SecurityAuditScreen } from '@ihui/rn-app/pilot'
import { formatDate } from '@/lib/date-utils'
import { fetchApi } from '@/lib/api'
import { BackButton, AuthGatePrompt } from '@/components/common'
import { useAuthGate } from '@/hooks/use-auth-gate'
import {
  createSecurityAuditT,
  toSecurityAuditItems,
  type SecurityLogRow,
} from '@/lib/rn-pilot/security-audit-view-model'

/**
 * 安全审计页 · web 消费共享屏(2026-11-07)。
 *
 * 结构对齐 agreement 试点:page.tsx 只做服务端壳,本文件负责
 * 「取数 + 鉴权门 + 文案注入 + 调 view-model」,再交给共享 SecurityAuditScreen
 * 渲染;web 不再复制一份表格实现。
 *
 * 请求契约与改造前一致:`GET /api/security/audit`,响应 `{list,total,page,pageSize}`
 * ⇒ 取 `.list`;`action → type` 归类、`ip ?? '-'` 口径均由共享屏承接。
 */
export default function SecurityAuditPageClient() {
  const t = useTranslations('securityAuditPage')
  const router = useRouter()
  const { resolvedTheme } = useTheme()

  // 2026-09-30 登录态门:未登录不发注定 401 的请求
  const { allow } = useAuthGate()

  const {
    data: list = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['security-audit'],
    enabled: allow,
    queryFn: async () => {
      // 响应是 {list,total,page,pageSize},不是裸数组 ⇒ 取 .list
      const r = await fetchApi<{ list: SecurityLogRow[] }>('/api/security/audit')
      return r.success && r.data ? (r.data.list ?? []) : []
    },
  })

  const fmtDate = React.useCallback((value: string) => {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? '-' : formatDate(d)
  }, [])

  const items = React.useMemo(() => toSecurityAuditItems(list, fmtDate), [list, fmtDate])

  const tShared = React.useMemo(() => createSecurityAuditT(t as (key: string) => string), [t])
  const colorScheme = resolvedTheme === 'dark' ? 'dark' : 'light'

  if (!allow) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-4">
        <BackButton />
        <AuthGatePrompt message="请先登录后查看安全审计" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] min-h-[480px] w-full max-w-4xl flex-col overflow-hidden px-4 py-4">
      <SecurityAuditScreen
        t={tShared}
        items={items}
        loading={isLoading}
        refreshing={isFetching}
        error={isError ? '安全审计数据加载失败，请稍后重试' : ''}
        onRetry={() => void refetch()}
        onRefresh={() => void refetch()}
        onBack={() => router.back()}
        colorScheme={colorScheme}
      />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
