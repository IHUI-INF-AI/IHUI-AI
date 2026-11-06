// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN CouponScreen 与共享屏的宿主动作接线锁。
 *
 * ① 阳:onOpenCouponCenter 真接线 ⇒ 点击导航到 RN 领券中心路由 Promotion
 *    (RootNavigator.tsx:598/1172 → PromotionScreen 拉 /coupons 全量券);
 * ② 阴:onUseCoupon 不接线 ⇒ RN 无商品/商城路由可表达「去商品页使用」,
 *    故共享屏的「立即使用」按钮在 RN 端不存在(不硬造空回调或错跳订单页)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createElement } from 'react'
import { render, waitFor } from '@testing-library/react'

const captured = vi.hoisted(() => ({
  coupon: null as Record<string, unknown> | null,
}))

const navMocks = vi.hoisted(() => ({ navigate: vi.fn(), goBack: vi.fn() }))

vi.mock('@ihui/rn-app', () => ({
  CouponScreen: (props: Record<string, unknown>) => {
    captured.coupon = props
    return createElement('div', { 'data-testid': 'shared-coupon-screen' })
  },
}))

vi.mock('@ihui/api-client', () => ({ fetchApi: vi.fn() }))

vi.mock('@react-navigation/native', () => ({ useNavigation: () => navMocks }))
vi.mock('@react-navigation/native-stack', () => ({}))

vi.mock('../src/hooks', () => ({
  usePaginatedList: () => ({
    items: [],
    loading: false,
    refreshing: false,
    error: '',
    refresh: vi.fn(),
  }),
  useRefreshOnFocus: () => {},
}))

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

vi.mock('../src/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

import { CouponScreen } from '../src/screens/CouponScreen'

describe('RN CouponScreen 宿主动作', () => {
  beforeEach(() => {
    captured.coupon = null
    navMocks.navigate.mockReset()
  })

  it('阳性:onOpenCouponCenter 导航到 Promotion 领券中心', async () => {
    render(createElement(CouponScreen))
    await waitFor(() => expect(captured.coupon).not.toBeNull())
    expect(typeof captured.coupon?.onOpenCouponCenter).toBe('function')

    ;(captured.coupon?.onOpenCouponCenter as () => void)()
    expect(navMocks.navigate).toHaveBeenCalledWith('Promotion')
    expect(navMocks.navigate).toHaveBeenCalledTimes(1)
  })

  it('阴性:onUseCoupon 不接线(RN 无商品/商城路由)', async () => {
    render(createElement(CouponScreen))
    await waitFor(() => expect(captured.coupon).not.toBeNull())
    expect(captured.coupon?.onUseCoupon).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
