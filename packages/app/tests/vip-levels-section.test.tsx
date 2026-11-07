// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { VipLevelsSection } from '../src/features/vip/VipLevelsSection'
import { VipScreen } from '../src/features/vip/VipScreen'
import type { VipLevelItem2, VipScreenProps } from '../src/types'

vi.mock('lucide-react-native', () => {
  const icon = () => () => createElement('i', { 'data-icon': 'mock' })
  // 白名单与 VipScreen/BackChevron 的 import 同步(多于实际用到的名字无害)
  return {
    BarChart3: icon,
    Check: icon,
    Film: icon,
    MessageCircle: icon,
    Palette: icon,
    Radio: icon,
    Sparkles: icon,
    ArrowLeft: icon,
    ChevronLeft: icon,
    Circle: icon,
  }
})

vi.mock('react-native', () => {
  const el =
    (tag: string) =>
    ({ children }: { children?: ReactNode }) =>
      createElement(tag, null, children)
  const StyleSheet = { create: <T,>(s: T) => s, hairlineWidth: 1 }
  return {
    View: el('div'),
    Text: el('span'),
    ScrollView: el('div'),
    TouchableOpacity: ({
      children,
      disabled,
      onPress,
    }: {
      children?: ReactNode
      disabled?: boolean
      onPress?: () => void
    }) => createElement('button', { disabled: disabled === true, onClick: onPress }, children),
    RefreshControl: () => null,
    Pressable: ({ children, onPress }: { children?: ReactNode; onPress?: () => void }) =>
      createElement('div', { onClick: onPress }, children),
    ActivityIndicator: () => createElement('i', { 'data-test': 'spinner' }),
    PixelRatio: {
      get: () => 2,
      getFontScale: () => 2,
      getPixelSizeForLayoutSize: (n: number) => n,
      roundToNearestPixel: (n: number) => n,
    },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios ?? o.default },
    Animated: {
      View: el('div'),
      Value: class {
        constructor(public v: number) {}
        setValue() {}
        interpolate() {
          return this
        }
      },
      timing: () => ({ start: (cb?: () => void) => cb?.() }),
    },
    Easing: { out: (f: unknown) => f, inOut: (f: unknown) => f, linear: (f: unknown) => f },
    StyleSheet,
  }
})

/** 极简 t:把变量拼进返回值,断言面即"哪个键 + 带什么值" */
const t = (key: string, vars?: Record<string, string | number>) => {
  const parts = Object.entries(vars ?? {}).map(([k, v]) => `${k}=${v}`)
  return parts.length > 0 ? `${key}[${parts.join(',')}]` : key
}

const LEVELS: VipLevelItem2[] = [
  {
    id: 'lv1',
    levelName: '月度会员',
    durationDays: 30,
    price: 39.9,
    benefits: ['a', 'b'],
    status: 1,
    levelValue: 1,
  },
  {
    id: 'lv2',
    levelName: '年度会员',
    durationDays: 365,
    price: 399,
    benefits: ['a'],
    status: 1,
    levelValue: 2,
  },
]

afterEach(cleanup)

describe('VipLevelsSection(从 VipScreen 抽出的单源档位段)', () => {
  it('段标题原样渲染 + 档位数据/价格/权益数齐全', () => {
    render(
      <VipLevelsSection
        t={t}
        title="vip.plans"
        levels={LEVELS}
        membership={null}
        purchasingId={null}
        onPurchase={() => undefined}
      />,
    )
    expect(screen.getByText('vip.plans')).toBeTruthy()
    expect(screen.getByText('月度会员')).toBeTruthy()
    expect(screen.getByText('年度会员')).toBeTruthy()
    expect(screen.getByText('¥ 39.90')).toBeTruthy()
    expect(screen.getByText('vip.duration[days=30]')).toBeTruthy()
    expect(screen.getByText('vip.benefitsCount[count=2]')).toBeTruthy()
  })

  it('空档位走共享空态,不渲染任何档位卡', () => {
    render(
      <VipLevelsSection
        t={t}
        title="vip.plans"
        levels={[]}
        membership={null}
        purchasingId={null}
        onPurchase={() => undefined}
      />,
    )
    expect(screen.getByText('vip.empty')).toBeTruthy()
    expect(screen.queryByText('月度会员')).toBeNull()
  })

  it('点购买按钮回调带对应档位', () => {
    const onPurchase = vi.fn()
    render(
      <VipLevelsSection
        t={t}
        title="vip.plans"
        levels={LEVELS}
        membership={null}
        purchasingId={null}
        onPurchase={onPurchase}
      />,
    )
    const buttons = screen.getAllByText('vip.purchase')
    fireEvent.click(buttons[1] as unknown as HTMLElement)
    expect(onPurchase).toHaveBeenCalledTimes(1)
    expect(onPurchase.mock.calls[0]?.[0]).toMatchObject({ id: 'lv2' })
  })

  it('当前等级挂徽标且该档位不再出购买按钮', () => {
    render(
      <VipLevelsSection
        t={t}
        title="vip.plans"
        levels={LEVELS}
        membership={{
          isActive: true,
          level: 1,
          levelName: '月度会员',
          expireTime: '2026-12-01',
          daysRemaining: 26,
        }}
        purchasingId={null}
        onPurchase={() => undefined}
      />,
    )
    expect(screen.getByText('vip.currentLevel')).toBeTruthy()
    // 2 档里只有非当前档(lv2)可购买
    expect(screen.getAllByText('vip.purchase')).toHaveLength(1)
  })

  it('不注入 onPurchase 时段退化为纯展示(无购买按钮)', () => {
    render(
      <VipLevelsSection
        t={t}
        title="vip.plans"
        levels={LEVELS}
        membership={null}
        purchasingId={null}
      />,
    )
    expect(screen.getByText('月度会员')).toBeTruthy()
    expect(screen.queryByText('vip.purchase')).toBeNull()
  })

  it('VipScreen(RN 消费端) 经同一 VipLevelsSection 渲染档位', () => {
    // 端口必须是"非已知空实现"的函数,否则 assertRequiredPort 在 dev 下直接 throw
    const onNavigate = (route: string) => route
    const onToast = (message: string) => message
    render(
      <VipScreen
        {...({
          t,
          levels: LEVELS,
          membership: null,
          loading: false,
          refreshing: false,
          error: null,
          onNavigate,
          onToast,
        } as unknown as VipScreenProps)}
      />,
    )
    expect(screen.getByText('vip.levelsTitle')).toBeTruthy()
    expect(screen.getByText('月度会员')).toBeTruthy()
    expect(screen.getByText('¥ 39.90')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
