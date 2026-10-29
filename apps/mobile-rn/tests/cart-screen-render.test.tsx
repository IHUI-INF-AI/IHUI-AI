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
import { createElement, type ReactElement, type ReactNode } from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { messages, getValueByPath, type Locale } from '../src/i18n'
import type * as ApiClient from '@ihui/api-client'

const nav = vi.hoisted(() => ({ navigate: vi.fn(), goBack: vi.fn() }))
const appAlert = vi.hoisted(() => vi.fn())
const selectGoods = vi.hoisted(() => vi.fn())

vi.mock('@react-navigation/native', async () => {
  // CartScreen 经 useRefreshOnFocus 取 useFocusEffect;ESM 下 mock 缺出口 ⇒ 整文件加载即失败。
  // 语义照端内唯一实现 apps/miniapp-taro/src/rn-compat/navigation.tsx 的 useFocusEffect。
  const { useEffect } = await import('react')
  return {
    useNavigation: () => ({ navigate: nav.navigate, goBack: nav.goBack }),
    useFocusEffect: (effect: () => void | (() => void)) =>
      useEffect(() => {
        const cleanup = effect()
        return () => cleanup?.()
      }, [effect]),
  }
})

/**
 * 两处「共享 RN 替身没武装到位」(均为环境缺件,不是被测缺陷;共享替身
 * tests/__mocks__/react-native.ts 是他人文件、波及其他套件 ⇒ 本席只按同端既有正解
 * app-root-background-focused-route.test.tsx:35 / chat-disclosure-tier-approval.test.tsx:33 的
 * importOriginal 扩展法在本套件补齐,不另造第三份替身):
 * ① FlatList 只真渲 data/renderItem(替身:184),`ListEmptyComponent` 随 rest 落到 DOM 上
 *   (实测渲成 listemptycomponent="[object Object]")⇒ 本屏三兄弟状态(骨架屏 / cart.loadFailed+重试 /
 *   cart.empty)全走 ListEmptyComponent 上屏(packages/app/src/features/cart/CartScreen.tsx:169),
 *   在测试里一条也渲不出。真 RN 的 FlatList 在 data 为空时渲这一位,故补齐;并给列表容器挂
 *   data-role="flatlist"(loading 段按它取文本 —— 此前 querySelector 恒取 null,那条断言靠 ?? '' 白过)。
 * ② Animated 缺 loop/sequence(替身只有 timing/spring/parallel),而 loading 态的 ScreenSkeleton
 *   = ScreenStates.tsx 的 Shimmer 渲染期就调 Animated.loop(Animated.sequence([...])) ⇒ 一旦 ①
 *   补齐、骨架屏真的上屏,当场抛「Animated.sequence is not a function」。真 RN 有这两个出口,故补齐。
 */
vi.mock('react-native', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const BaseFlatList = actual.FlatList as (props: Record<string, unknown>) => ReactElement
  function FlatList(props: Record<string, unknown>): ReactElement {
    const data = (props.data as readonly unknown[] | undefined) ?? []
    if (data.length > 0) return BaseFlatList({ ...props, 'data-role': 'flatlist' })
    const empty = props.ListEmptyComponent
    const slot =
      typeof empty === 'function' ? (empty as () => ReactNode)() : ((empty as ReactNode) ?? null)
    return createElement('div', { 'data-role': 'flatlist' }, slot)
  }
  const anim = {
    start: (cb?: (r: { finished: boolean }) => void) => {
      cb?.({ finished: true })
      return anim
    },
    stop: () => {},
  }
  const Animated = {
    ...(actual.Animated as Record<string, unknown>),
    loop: () => anim,
    sequence: () => anim,
  }
  return { ...actual, Animated, FlatList }
})

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

/**
 * 取钮口径与共享替身同一套(照同端正解样板 input-area-model-props.test.tsx:51 的 buttonByLabel
 * 与其头注):替身把 RN 的 `accessibilityLabel` **归一成 web 的 `aria-label`**
 * (__mocks__/react-native.ts:98,不映射则 React DOM 丢掉这个未知属性、RTL 的 getByLabelText
 * 也检索不到),原始属性名根本不落 DOM ⇒ 按 `[accessibilitylabel=…]` 查恒命中 0(2026-10-29 三条红的成因)。
 * 故主查 aria-label,兼容直通属性 accessibilityLabel,两者都取不到才算"没有这枚钮"。
 * 本套件按"载体枚数"判据,所以在同一个助手里加计数出口,不写第二把尺子。
 */
function buttonsByLabel(container: HTMLElement, label: string): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button')).filter(
    (el) =>
      el.getAttribute('aria-label') === label || el.getAttribute('accessibilityLabel') === label,
  )
}

function buttonByLabel(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return buttonsByLabel(container, label)[0]
}

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
    const { container } = renderScreen()
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
    expect(buttonsByLabel(container, val('common.delete'))).toHaveLength(2)
    expect(buttonsByLabel(container, '+')).toHaveLength(2)
    expect(buttonsByLabel(container, '-')).toHaveLength(2)
    // 勾选位:2 行 + 全选
    expect(container.querySelectorAll('button[accessibilityrole="checkbox"]')).toHaveLength(3)
  })

  it('数量 +1 真的改合计(件数与总价同步)', async () => {
    selectGoods.mockImplementation(() =>
      okList([{ id: '1', title: '测试商品甲', price: 10, quantity: 1 }]),
    )
    const { container } = renderScreen()
    // 初值:行单价 ¥10.00 与底部合计 ¥10.00(10×1)各一枚
    await waitFor(() => expect(screen.getAllByText('¥10.00')).toHaveLength(2))
    const plus = buttonByLabel(container, '+')
    expect(plus ?? null).not.toBeNull()
    fireEvent.click(plus as Element)
    // 件数 1→2:行单价不变,合计变 ¥20.00,结算按钮件数同步
    await waitFor(() => expect(screen.getByText(`${val('cart.checkout')}(2)`)).toBeDefined())
    expect(screen.getByText('¥20.00')).toBeDefined()
    expect(screen.getAllByText('¥10.00')).toHaveLength(1)
  })

  it('空态三分支:loading 指示 → 空列表文案;接口失败 → 加载失败 + 重试', async () => {
    selectGoods.mockImplementation(() => new Promise(() => {})) // 挂起,首帧仍在加载
    const { unmount } = renderScreen()
    // loading 态已演进为共享层 ScreenSkeleton 骨架屏(ScreenStates.tsx;spinner 是旧形态断言):
    // 骨架无文案 ⇒ 断言空态文案与错误文案都不出现,且列表区无内容
    const listText = document.querySelector('[data-role="flatlist"]')?.textContent ?? ''
    expect(listText).not.toMatch(/[一-龥]/)
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
