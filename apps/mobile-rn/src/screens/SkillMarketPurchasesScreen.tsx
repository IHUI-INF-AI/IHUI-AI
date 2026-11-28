// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import type {
  SkillMyPurchaseItem,
  SkillMyPurchasesResponse,
  SkillRefundRequestCreateResponse,
} from '@ihui/shared/skills/market'
import { apiFailureToText } from '@ihui/shared/utils'
import {
  SkillMarketPurchasesScreen as SharedSkillMarketPurchasesScreen,
  type SkillMyPurchaseView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

function toView(item: SkillMyPurchaseItem): SkillMyPurchaseView {
  return {
    id: item.id,
    skillName: item.skillName,
    priceCents: item.priceCents,
    currency: item.currency,
    status: item.status,
    createdAt: item.createdAt,
    refundedAt: item.refundedAt,
    refundAmountCents: item.refundAmountCents,
    refundRequest: item.refundRequest
      ? {
          id: item.refundRequest.id,
          status: item.refundRequest.status,
          reason: item.refundRequest.reason,
          reviewNote: item.refundRequest.reviewNote,
          createdAt: item.refundRequest.createdAt,
          reviewedAt: item.refundRequest.reviewedAt,
        }
      : null,
    canRequestRefund: item.canRequestRefund,
  }
}

/**
 * “我的购买 / 申请退款” RN 宿主壳。
 *
 * 与 web `/skills-market/purchases` 打同一对端点：
 * - `GET /api/skills/market/purchases` 拉当前买家购买与最近申请；
 * - `POST /api/skills/market/purchases/:id/refund-request` 提交退款申请。
 * 渲染全部在 `@ihui/rn-app` 的共享屏；本壳只做取数、提交、刷新与提示。
 */
export function SkillMarketPurchasesScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const [items, setItems] = useState<SkillMyPurchaseView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [noticeTone, setNoticeTone] = useState<'success' | 'error' | ''>('')
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchApi<SkillMyPurchasesResponse>('/api/skills/market/purchases')
      if (!res.success) {
        setItems([])
        setError(apiFailureToText(res, t('skillsMarket.loadFailed')))
        return
      }
      setItems((res.data?.items ?? []).map(toView))
    } catch {
      setItems([])
      setError(t('skillsMarket.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const submitRefund = useCallback(
    async (purchaseId: string, reason: string) => {
      setSubmittingId(purchaseId)
      setNotice('')
      setNoticeTone('')
      try {
        const res = await fetchApi<SkillRefundRequestCreateResponse>(
          `/api/skills/market/purchases/${encodeURIComponent(purchaseId)}/refund-request`,
          { method: 'POST', body: JSON.stringify({ reason }) },
        )
        if (!res.success) {
          setNoticeTone('error')
          setNotice(apiFailureToText(res, t('skillsMarket.refundSubmitFailed')))
          return
        }
        setNoticeTone('success')
        setNotice(
          res.data?.alreadyRequested
            ? t('skillsMarket.refundAlreadyRequested')
            : t('skillsMarket.refundSubmitted'),
        )
        await load()
      } catch {
        setNoticeTone('error')
        setNotice(t('skillsMarket.refundSubmitFailed'))
      } finally {
        setSubmittingId(null)
      }
    },
    [load, t],
  )

  return (
    <SharedSkillMarketPurchasesScreen
      t={t}
      items={items}
      loading={loading}
      error={error}
      notice={notice}
      noticeTone={noticeTone}
      submittingId={submittingId}
      onBack={() => navigation.goBack()}
      onRetry={() => void load()}
      onRequestRefund={(id, reason) => void submitRefund(id, reason)}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
