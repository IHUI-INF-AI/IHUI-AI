// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CartScreen 的行为级自证(§17:UI 改动不能只凭代码审查)。
 * 钉死四格:①RN 壳渲染的确实是共享层 `packages/app/src/features/cart/CartScreen.tsx`
 * 那一份(替身身份对照);②商品行/合计栏/空态三分支逐段上屏且取的是词包真文案;
 * ③数量增减真的改合计;④没有裸 i18n 键上屏。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { messages, getValueByPath, type Locale } from '../src/i18n'
import type * as ApiClient from '@ihui/api-client'

const nav = vi.hoisted(() => ({ navigate: vi.fn(), goBack: vi.fn() }))
const appAlert = vi.hoisted(() => vi.fn())
const selectGoods = vi.hoisted(() => vi.fn())

vi.mock('react-native', () => {
  const mk = (tag: string) =>
    function MockComp(props: { children?: ReactNode; [k: string]: unknown }) {
      const { style, onPress, children, ...rest } = props
      const flat = (v: unknown): unknown =>
        Array.isArray(v) ? Object.assign({}, ...v.filter(Boolean).map(flat)) : v
      return createElement(tag, { ...rest, onClick: onPress, style: flat(style) }, children)
    }
  const FlatList = function MockFlatList(props: {
    data?: unknown[]
    renderItem?: (arg: { item: unknown }) => ReactNode
    keyExtractor?: (item: unknown, index: number) => string
    ListEmptyComponent?: ReactNode
    contentContainerStyle?: unknown
  }) {
    const { data = [], renderItem, keyExtractor, ListEmptyComponent, contentContainerStyle } = props
    const children = data.length
      ? data.map((item, index) =>
          createElement(
            'div',
            { key: keyExtractor ? keyExtractor(item, index) : String(index) },
            renderItem ? renderItem({ item }) : null,
          ),
        )
      : ListEmptyComponent
    return createElement('div', { 'data-role': 'flatlist', style: contentContainerStyle }, children)
  }
  /**
   * 屏幕状态四件套(ScreenStates,枚 d723f8bc9b37 起为共享屏的 Shimmer/按压动画)在渲染期
   * 使用 Animated.loop/sequence/timing/spring/Value/View + Easing。内联 mock 缺这组导出
   * ⇒ 整文件加载/渲染期抛「No "Animated" export is defined on the "react-native" mock」。
   * 与真实 RN 的 Animated 面同形的 no-op 桩(start 回调带 finished:true,保证 useEffect 清理可达)。
   */
  const anim = {
    start: (cb?: (r: { finished: boolean }) => void) => {
      cb?.({ finished: true })
      return anim
    },
    stop: () => {},
  }
  const mkAnimValue = () => ({
    setValue: () => {},
    interpolate: (cfg: { outputRange?: number[] }) => cfg.outputRange?.[0] ?? 1,
  })
  function AnimatedValue() {
    return mkAnimValue()
  }
  const Animated = {
    View: (props: { children?: ReactNode; style?: unknown }) => createElement('div', { 'data-role': 'shimmer' }, props.children),
    Value: AnimatedValue,
    timing: () => anim,
    spring: () => anim,
    loop: () => anim,
    sequence: () => anim,
    parallel: () => anim,
  }
  const Easing = {
    ease: (t: number) => t,
    linear: (t: number) => t,
    in: (f: (t: number) => number) => f,
    out: (f: (t: number) => number) => f,
    inOut: (f: (t: number) => number) => f,
  }
  return {
    Animated,
    Easing,
    // 共享返回键核心按字体缩放取档(packages/shared/src/ui/back-chevron-core → useFontMultiplier)
    PixelRatio: {
      getFontScale: () => 1,
      getPixelSizeForLayoutSize: (n: number) => n,
      roundToNearestPixel: (n: number) => n,
    },
    Appearance: { getColorScheme: () => 'light', addChangeListener: () => ({ remove() {} }) },
    useColorScheme: () => 'light',
    View: (props: { children?: ReactNode; style?: unknown }) => createElement('div', { 'data-role': 'shimmer' }, props.children),
    Text: mk('span'),
    Image: mk('div'),
    ScrollView: (props: { children?: ReactNode; style?: unknown }) => createElement('div', { 'data-role': 'shimmer' }, props.children),
    Pressable: mk('button'),
    TouchableOpacity: mk('button'),
    FlatList,
    ActivityIndicator: () => createElement('div', { 'data-role': 'spinner' }),
    StyleSheet: {
      create: <T extends object>(s: T) => s,
      flatten: (s: unknown) => s,
      hairlineWidth: 0.5,
    },
    Platform: { OS: 'web', select: (o: Record<string, unknown>) => o.web ?? o.ios },
  }
})

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: nav.navigate, goBack: nav.goBack }),
}))

// 图标素材不是本页判据;名单必须覆盖共享屏 + 薄壳两处 import,漏一个是运行时 export 缺失。
vi.mock('lucide-react-native', () => {
  const icon = (name: string) => {
    const MockIcon = () => createElement('i', { 'data-icon': name })
    MockIcon.displayName = `MockIcon(${name})`
    return MockIcon
  }
  return Object.fromEntries(
    [
      'Check',
      'Minus',
      'Package',
      'Plus',
      'ShoppingCart',
      'Trash2',
      'ChevronLeft', // 共享 BackChevron 的字形
    ].map((n) => [n, icon(n.toLowerCase())]),
  )
})

// 取数/结算腿:selectGoods 给可控假数据;normalizeCartGoods 必须用真实现(它就是被测的兜底契约)
// 类型用静态 `import type`(行内 import() 类型注解被 @typescript-eslint/consistent-type-imports 禁),
// 它编译期即擦除,不会让 @ihui/api-client 在收集期真跑起来。
vi.mock('@ihui/api-client', async (importOriginal) => {
  const real = await importOriginal<typeof ApiClient>()
  return { ...real, selectGoods, createWechatAppPayment: vi.fn() }
})

vi.mock('../src/lib/wechat-pay', () => ({
  isWeChatInstalled: vi.fn(async () => false),
  openWeChatPayment: vi.fn(async () => false),
}))
vi.mock('../src/components/BottomPops', () => ({ appAlert }))
vi.mock('../src/components/ConfirmPurchasePopUp', () => ({
  ConfirmPurchasePopUp: () => createElement('div', { 'data-testid': 'confirm-purchase-pop' }),
}))

import { CartScreen } from '../src/screens/CartScreen'
import { I18nProvider } from '../src/i18n'
import { CartScreen as SharedCartScreen } from '../../../packages/app/src/features/cart/CartScreen'
import * as rnAppStub from './__mocks__/ihui-rn-app'

const renderScreen = () => render(createElement(I18nProvider, null, createElement(CartScreen)))

const zh = messages['zh-CN'] as Record<string, unknown>
const val = (k: string) => getValueByPath(zh, k) as string

const okList = (list: unknown[]) => Promise.resolve({ success: true, data: { list } })

describe('CartScreen 渲染委托与内容', () => {
  beforeEach(() => {
    cleanup()
    nav.navigate.mockClear()
    nav.goBack.mockClear()
    appAlert.mockClear()
    selectGoods.mockReset()
  })
  afterEach(() => cleanup())

  it('身份锁:RN 薄壳经 @ihui/rn-app 替身拿到的就是共享层那一份组件', () => {
    expect(rnAppStub.CartScreen).toBe(SharedCartScreen)
  })

  it('商品行逐元素上屏:勾选/标题/价格/数量/删除,合计按已选项统计', async () => {
    selectGoods.mockImplementation(() =>
      okList([
        { id: '1', title: '测试商品甲', price: 12.5, quantity: 2 },
        { id: '2', name: '测试商品乙', amount: 7, num: 1 },
      ]),
    )
    renderScreen()
    await waitFor(() => expect(screen.queryByText('测试商品甲')).not.toBeNull())
    expect(screen.getByText('测试商品乙')).toBeDefined() // normalizeCartGoods 的 name 兜底
    expect(screen.getByText('¥12.50')).toBeDefined()
    expect(screen.getByText('¥7.00')).toBeDefined()
    expect(screen.getByText(val('cart.title'))).toBeDefined()
    expect(screen.getByText(val('cart.selectAll'))).toBeDefined()
    expect(screen.getByText(val('cart.total') + ':')).toBeDefined()
    // 已选合计:12.5×2 + 7×1 = 32.00,件数 3
    expect(screen.getByText('¥32.00')).toBeDefined()
    expect(screen.getByText(`${val('cart.checkout')}(3)`)).toBeDefined()
    // 图标载体按无障碍位计数(共享屏 lucide 组件在 packages/app 语境真渲染成 svg DOM,
    // 本套件的 vi.mock 只拦 mobile-rn 侧 import ⇒ 判据落在按钮载体而非图标节点名)
    expect(document.querySelectorAll('button[accessibilitylabel="删除"]')).toHaveLength(2)
    expect(document.querySelectorAll('button[accessibilitylabel="+"]')).toHaveLength(2)
    expect(document.querySelectorAll('button[accessibilitylabel="-"]')).toHaveLength(2)
    // 勾选位:2 行 + 全选
    expect(document.querySelectorAll('button[accessibilityrole="checkbox"]')).toHaveLength(3)
  })

  it('数量 +1 真的改合计(件数与总价同步)', async () => {
    selectGoods.mockImplementation(() =>
      okList([{ id: '1', title: '测试商品甲', price: 10, quantity: 1 }]),
    )
    renderScreen()
    // 初值:行单价 ¥10.00 与底部合计 ¥10.00(10×1)各一枚
    await waitFor(() => expect(screen.getAllByText('¥10.00')).toHaveLength(2))
    const plus = document.querySelector('button[accessibilitylabel="+"]')
    expect(plus).not.toBeNull()
    fireEvent.click(plus as Element)
    // 件数 1→2:行单价不变,合计变 ¥20.00,结算按钮件数同步
    await waitFor(() => expect(screen.getByText(`${val('cart.checkout')}(2)`)).toBeDefined())
    expect(screen.getByText('¥20.00')).toBeDefined()
    expect(screen.getAllByText('¥10.00')).toHaveLength(1)
  })

  it('空态三分支:loading 指示 → 空列表文案;接口失败 → 加载失败 + 重试', async () => {
    selectGoods.mockImplementation(() => new Promise(() => {})) // 挂起,首帧仍在加载
    const { unmount } = renderScreen()
    expect(document.querySelector('[data-role="shimmer"]')).not.toBeNull()
    unmount()

    selectGoods.mockResolvedValue({ success: true, data: { list: [] } })
    renderScreen()
    await waitFor(() => expect(screen.queryByText(val('cart.empty'))).not.toBeNull())

    cleanup()
    selectGoods.mockResolvedValue({ success: false, error: 'boom' })
    renderScreen()
    await waitFor(() => expect(screen.queryByText(val('cart.loadFailed'))).not.toBeNull())
    expect(screen.getByText(val('common.retry'))).toBeDefined()
  })

  it('没有任何裸 i18n 键上屏', async () => {
    selectGoods.mockImplementation(() => okList([{ id: '1', title: '甲', price: 1, quantity: 1 }]))
    const { container } = renderScreen()
    await waitFor(() => expect(screen.queryByText(val('cart.title'))).not.toBeNull())
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/\b(?:cart|common|payment|success)\.[A-Za-z][\w.]*/)
    // 阳性对照:同一把尺子喂一个真键名必须判红
    const probe = createElement('span', null, 'cart.checkoutConfirm')
    const r2 = render(probe, { container: document.createElement('div') })
    expect(r2.container.textContent).toMatch(/\b(?:cart|common|payment|success)\.[A-Za-z][\w.]*/)
  })
})

describe('cart.* 五语言齐备(共享屏取词面)', () => {
  const CART_KEYS = ['title', 'empty', 'loadFailed', 'selectAll', 'total', 'checkout']
  const COMMON_KEYS = ['back', 'delete', 'retry']

  it.each(['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as Locale[])(
    '%s:cart/common 取词键全部取到非空字符串且不等于键名',
    (locale) => {
      const pack = messages[locale] as Record<string, unknown>
      for (const k of CART_KEYS) {
        const v = getValueByPath(pack, `cart.${k}`)
        expect(typeof v, `${locale}.cart.${k} 缺失`).toBe('string')
        expect((v as string).trim(), `${locale}.cart.${k} 空值`).not.toBe('')
        expect(v, `${locale}.cart.${k} 落成了键名`).not.toBe(`cart.${k}`)
      }
      for (const k of COMMON_KEYS) {
        const v = getValueByPath(pack, `common.${k}`)
        expect(typeof v, `${locale}.common.${k} 缺失`).toBe('string')
      }
    },
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
