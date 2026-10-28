// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/coupon/CouponScreen.tsx(直载共享屏 + 注入本端事实)

/**
 * 手工迁移(2026-10-28):端内 224 行手写 → 直载承载(about-shared 同形制)。
 * 判据腿此前拒转的两个真缺口,由同日补的共享屏出口承担:
 *   可用券「立即使用」 = CouponScreen.onUseCoupon(小程序端事实:提示"请前往商品页使用");
 *   底部「领券中心」   = CouponScreen.onOpenCouponCenter(跳本端 pages/member/coupon-list,RN 端
 *                        没有领券列表页 ⇒ RN 宿主不传该档,两端按各自能力渲染)。
 *   数据腿与 RN 宿主 apps/mobile-rn/src/screens/CouponScreen.tsx 逐字同构:
 *   同端点 GET /api/coupons{page,pageSize,status}、同 tab→库内词汇映射(unused/used/expired)、
 *   同 usePaginatedList(pageSize 20)、同 formatDateOnly(expiresAt)。
 *   回屏刷新 = useDidShow→refresh(对齐本页旧行为 useDidShow(load);RN 宿主另有 useRefreshOnFocus)。
 * ⇒ 排版与词条真相源 = 共享屏;改这一屏的外观/文案去改 packages/app,不再动本页。
 */
import ThemeRoot from '@/components/ThemeRoot'
import { Alert } from '@/rn-compat/apis'
import { useTheme } from '@/rn-compat/theme'
import { fetchApi } from '@ihui/api-client'
import { CouponScreen as SharedCouponScreen } from '@ihui/rn-app/features/coupon/CouponScreen'
import { formatDateOnly } from '@ihui/shared/utils/date-utils'
import { usePaginatedList } from '@ihui/shared/hooks'
import { useI18n } from '@/i18n'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useState } from 'react'

/** 与 RN 宿主同形的后端响应行 */
interface CouponPage {
  list: Array<{
    id: string
    name: string
    amount: number
    minSpend: number
    expiresAt: string
    status: 'unused' | 'used' | 'expired'
  }>
  total: number
}

type CouponTab = 'available' | 'used' | 'expired'
/** 与共享屏 TAB_KEYS 同词汇(声明件契约只出口组件符号,词汇在此与本端对齐) */
type CouponStatusLocal = CouponTab | string
/** 本屏 tab 词汇 → 后端档位词汇(与 RN 宿主同一份映射,只在端上映射一次) */
const TAB_STATUS: Record<CouponTab, 'unused' | 'used' | 'expired'> = {
  available: 'unused',
  used: 'used',
  expired: 'expired',
}

const PAGE_SIZE = 20

export default function CouponPageScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [statusTab, setStatusTab] = useState<CouponTab>('available')

  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) => {
      const res = await fetchApi<CouponPage>('/api/coupons', {
        params: { page, pageSize, status: TAB_STATUS[statusTab] },
      })
      if (!res.success) return { success: false as const, error: t('coupon.loadFailed') }
      const list = (res.data?.list ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        amount: c.amount,
        minSpend: c.minSpend,
        validUntil: formatDateOnly(c.expiresAt),
        status: c.status === 'unused' ? 'available' : c.status,
      }))
      return { success: true as const, data: { list, total: res.data?.total ?? list.length } }
    },
    [statusTab, t],
  )

  const { items, loading, refreshing, error, refresh } = usePaginatedList(fetcher, PAGE_SIZE)
  // 回屏即重取:本页旧行为 useDidShow(load) 的等价承载(共享屏无该钩子,由本壳接)
  useDidShow(() => refresh())

  const onSelectTab = (tab: CouponStatusLocal) => {
    const next = tab as CouponTab
    if (next === statusTab) return
    setStatusTab(next)
    setTimeout(refresh, 0)
  }

  return (
    <ThemeRoot>
      <SharedCouponScreen
        t={t}
        items={items}
        activeTab={statusTab}
        onSelectTab={onSelectTab}
        loading={loading}
        refreshing={refreshing}
        error={error}
        onRefresh={refresh}
        onBack={() => Taro.navigateBack()}
        colorScheme={resolvedTheme}
        onUseCoupon={() => Alert.alert('', t('coupon.useHint'))}
        onOpenCouponCenter={() => void Taro.navigateTo({ url: '/pages/member/coupon-list' })}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
