// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * UserFansScreen 的行为级自证(§17:UI 改动不能只凭代码审查)。
 * 钉死四格:①RN 壳经 @ihui/rn-app 替身拿到的就是共享层
 * `packages/app/src/features/user-fans/UserFansScreen.tsx` 那一份(身份对照);
 * ②粉丝行逐元素上屏(昵称/关注时间/回关 CTA 与已关注态)且取的是词包真文案;
 * ③回关真的发 POST 并弹提示;④空态/失败态/裸键三查。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { messages, getValueByPath, type Locale } from '../src/i18n'
import type * as ApiClient from '@ihui/api-client'

const nav = vi.hoisted(() => ({ navigate: vi.fn(), goBack: vi.fn() }))
const appAlert = vi.hoisted(() => vi.fn())
const fetchApi = vi.hoisted(() => vi.fn())

/**
 * 2026-10-29:本套件曾整块 vi.mock('react-native') 复刻一份替身(§22c 反模式),逐项对账:
 * ① Animated/Easing/PixelRatio/Appearance/useColorScheme/View/Text/Image/ScrollView/
 *    Pressable/TouchableOpacity/ActivityIndicator/StyleSheet/Platform 全部键在共享替身
 *    tests/__mocks__/react-native.ts 均有实现 ⇒ 本地整块删除,零 importOriginal 增量
 *    (StyleSheet.flatten / Platform.select 只是本地防御性扩展,已 grep 本链
 *    UserFansScreen 壳 + packages/app 屏 + BackChevron/MoreLink/ScreenStates/theme/
 *    design-tokens:零使用)。
 * ② 本地替身给 View/ScrollView/Animated.View 打 data-role="shimmer"、ActivityIndicator
 *    打 data-role="spinner" —— 那是替身自造的形态(真 RN 不产出 data-role),原 loading
 *    断言查的就是这份虚构;回归共享替身后改为行为判据(骨架上屏且无文案),同 cart-screen-render
 *    的已迁样板。
 * ③ 共享替身把 accessibilityLabel 归一成 aria-label(__mocks__/react-native.ts:98,
 *    原始属性名不落 DOM)⇒ 取钮口径与 cart 同款 buttonsByLabel,计数语义不变。
 */
function buttonsByLabel(label: string): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll('button')).filter(
    (el) =>
      el.getAttribute('aria-label') === label || el.getAttribute('accessibilityLabel') === label,
  )
}

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
    ['UserCheck', 'UserPlus', 'Users', 'ChevronLeft'].map((n) => [n, icon(n.toLowerCase())]),
  )
})

// 取数腿:fetchApi 给可控假数据;其余成员走真实现(类型用静态 import type,行内 import() 被 lint 禁)。
vi.mock('@ihui/api-client', async (importOriginal) => {
  const real = await importOriginal<typeof ApiClient>()
  return { ...real, fetchApi }
})

vi.mock('../src/components/BottomPops', () => ({ appAlert }))

import { UserFansScreen } from '../src/screens/UserFansScreen'
import { I18nProvider } from '../src/i18n'
import { UserFansScreen as SharedUserFansScreen } from '../../../packages/app/src/features/user-fans/UserFansScreen'
import * as rnAppStub from './__mocks__/ihui-rn-app'

const renderScreen = () => render(createElement(I18nProvider, null, createElement(UserFansScreen)))

const zh = messages['zh-CN'] as Record<string, unknown>
const val = (k: string) => getValueByPath(zh, k) as string

const FANS = [
  {
    id: 'f1',
    userId: 'u1',
    nickname: '甲粉一号',
    avatar: null,
    createdAt: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 'f2',
    userId: 'u2',
    nickname: '乙粉二号',
    avatar: 'https://img.example.com/u2.png',
    createdAt: '2026-02-03T00:00:00.000Z',
  },
]

const fansOk = () =>
  fetchApi.mockImplementation((url: string) => {
    if (url.startsWith('/api/follows/following')) {
      return Promise.resolve({ success: true, data: { list: [{ userId: 'u2' }] } })
    }
    if (url.startsWith('/api/follows/followers')) {
      return Promise.resolve({ success: true, data: { list: FANS, total: 3 } })
    }
    return Promise.resolve({ success: true, data: { followed: true, isMutual: false } })
  })

describe('UserFansScreen 渲染委托与内容', () => {
  beforeEach(() => {
    cleanup()
    nav.goBack.mockClear()
    appAlert.mockClear()
    fetchApi.mockReset()
  })
  afterEach(() => cleanup())

  it('身份锁:RN 薄壳经 @ihui/rn-app 替身拿到的就是共享层那一份组件', () => {
    expect(rnAppStub.UserFansScreen).toBe(SharedUserFansScreen)
  })

  it('粉丝行逐元素上屏:昵称/关注时间前缀/回关 CTA 与已关注态按 followedIds 分流', async () => {
    fansOk()
    renderScreen()
    await waitFor(() => expect(screen.queryByText('甲粉一号')).not.toBeNull())
    expect(screen.getByText('乙粉二号')).toBeDefined()
    expect(screen.getByText(val('userFans.title'))).toBeDefined()
    // u2 在 following 名单 ⇒ 已关注态一枚;u1 未回关 ⇒ 回关 CTA 一枚
    expect(screen.getAllByText(val('userFans.followed'))).toHaveLength(1)
    expect(screen.getByText(val('userFans.follow'))).toBeDefined()
    // 关注时间行取 userFans.followedAt 词头
    expect(
      screen.getAllByText(new RegExp(val('userFans.followedAt'))).length,
    ).toBeGreaterThanOrEqual(2)
    // 载体计数:回关按钮(CTA 载体)= 1,加载更多按钮 = 1(2<3)
    // 取钮走 buttonsByLabel(共享替身把 accessibilityLabel 归一成 aria-label,口径同 cart)
    expect(buttonsByLabel(val('userFans.follow'))).toHaveLength(1)
    expect(
      document.querySelectorAll('button[accessibilityrole="button"]').length,
    ).toBeGreaterThanOrEqual(3)
  })

  it('回关:点击真的 POST /api/follows/u1 并弹成功提示,该行转为已关注态', async () => {
    fansOk()
    renderScreen()
    await waitFor(() => expect(screen.queryByText('甲粉一号')).not.toBeNull())
    const btn = buttonsByLabel(val('userFans.follow'))[0]
    expect(btn ?? null).not.toBeNull()
    fireEvent.click(btn as Element)
    await waitFor(() =>
      expect(fetchApi).toHaveBeenCalledWith('/api/follows/u1', { method: 'POST' }),
    )
    await waitFor(() => expect(screen.getAllByText(val('userFans.followed'))).toHaveLength(2))
    expect(appAlert).toHaveBeenCalledWith(val('common.hint'), val('userFans.followSuccess'))
  })

  it('空态三分支:loading 指示 → 空文案;接口失败 → 加载失败 + 重试', async () => {
    fetchApi.mockImplementation(() => new Promise(() => {})) // 挂起,首帧仍在加载
    const { unmount } = renderScreen()
    // loading 态由共享层 ScreenSkeleton 骨架屏承载(骨架无文案)。原断言查
    // [data-role="shimmer"] —— 该属性只由本套件旧本地替身自造(真 RN/共享替身都不产出,
    // 测的是替身不是实现),回归共享替身后改行为判据:滚动容器(共享替身打
    // data-rn-scrollview 标记)内骨架块已上屏,且不出现任何文案。
    const scrollBody = document.querySelector('[data-rn-scrollview]')
    expect(scrollBody).not.toBeNull()
    expect((scrollBody as HTMLElement).childElementCount).toBeGreaterThan(0)
    expect(scrollBody!.textContent).not.toMatch(/[一-龥]/)
    expect(screen.queryByText(val('userFans.empty'))).toBeNull()
    expect(screen.queryByText(val('userFans.loadFailed'))).toBeNull()
    unmount()

    cleanup()
    fetchApi.mockImplementation((url: string) =>
      url.startsWith('/api/follows/followers')
        ? Promise.resolve({ success: true, data: { list: [], total: 0 } })
        : Promise.resolve({ success: true, data: { list: [] } }),
    )
    renderScreen()
    await waitFor(() => expect(screen.queryByText(val('userFans.empty'))).not.toBeNull())

    cleanup()
    fetchApi.mockImplementation((url: string) =>
      url.startsWith('/api/follows/followers')
        ? Promise.resolve({ success: false, error: 'boom' })
        : Promise.resolve({ success: true, data: { list: [] } }),
    )
    renderScreen()
    await waitFor(() => expect(screen.queryByText(val('userFans.loadFailed'))).not.toBeNull())
    expect(screen.getByText(val('common.retry'))).toBeDefined()
  })

  it('没有任何裸 i18n 键上屏', async () => {
    fansOk()
    const { container } = renderScreen()
    await waitFor(() => expect(screen.queryByText('甲粉一号')).not.toBeNull())
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/\b(?:userFans|common)\.[A-Za-z][\w.]*/)
    // 阳性对照:同一把尺子喂一个真键名必须判红
    const probe = createElement('span', null, 'userFans.loadMore')
    const r2 = render(probe, { container: document.createElement('div') })
    expect(r2.container.textContent).toMatch(/\b(?:userFans|common)\.[A-Za-z][\w.]*/)
  })
})

describe('userFans.* 五语言齐备(共享屏取词面)', () => {
  const FANS_KEYS = [
    'title',
    'anonymous',
    'empty',
    'follow',
    'followed',
    'followedAt',
    'followSuccess',
    'actionFailed',
    'loadFailed',
  ]
  const COMMON_KEYS = ['back', 'retry', 'loading', 'hint', 'error']

  it.each(['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as Locale[])(
    '%s:userFans/common 取词键全部取到非空字符串且不等于键名',
    (locale) => {
      const pack = messages[locale] as Record<string, unknown>
      for (const k of FANS_KEYS) {
        const v = getValueByPath(pack, `userFans.${k}`)
        expect(typeof v, `${locale}.userFans.${k} 缺失`).toBe('string')
        expect((v as string).trim(), `${locale}.userFans.${k} 空值`).not.toBe('')
        expect(v, `${locale}.userFans.${k} 落成了键名`).not.toBe(`userFans.${k}`)
      }
      for (const k of COMMON_KEYS) {
        const v = getValueByPath(pack, `common.${k}`)
        expect(typeof v, `${locale}.common.${k} 缺失`).toBe('string')
      }
    },
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
