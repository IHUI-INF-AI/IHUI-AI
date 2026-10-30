// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * TopicDetailScreen 的行为级自证(§17:UI 改动不能只凭代码审查)。
 *
 * 钉住三格:①RN 薄壳渲染的确实是共享层那份组件(vitest 把 '@ihui/rn-app' 别名到
 * tests/__mocks__/ihui-rn-app.ts,该替身对 TopicDetailScreen 只做真件 re-export,不写假实现);
 * ②话题头部/发布入口/帖子卡逐元素上屏且没有裸 i18n 键;③关注、进帖、发帖三个跳转语义。
 * 写法照 apps/mobile-rn/tests/about-screen-render.test.tsx。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { messages, getValueByPath, type Locale } from '../src/i18n'

const nav = vi.hoisted(() => ({
  navigate: vi.fn(),
  goBack: vi.fn(),
  routeId: '7',
}))
const api = vi.hoisted(() => ({ fetchApi: vi.fn(), appAlert: vi.fn() }))

vi.mock('react-native', () => {
  const flat = (v: unknown): unknown =>
    Array.isArray(v) ? Object.assign({}, ...v.filter(Boolean).map(flat)) : v
  type MockProps = {
    children?: ReactNode | ((state: { pressed: boolean }) => ReactNode)
    style?: unknown
    onPress?: () => void
    [k: string]: unknown
  }
  const mk = (tag: string) =>
    function MockComp(props: MockProps) {
      const { style, onPress, children, ...rest } = props
      const kids = typeof children === 'function' ? children({ pressed: false }) : children
      return createElement(tag, { ...rest, onClick: onPress, style: flat(style) }, kids)
    }
  type ListProps = MockProps & {
    data?: readonly unknown[]
    renderItem?: (arg: { item: unknown; index: number }) => ReactNode
  }
  function MockList(props: ListProps) {
    const { data, renderItem, ListEmptyComponent, ListFooterComponent } = props
    const items = (data ?? []).map((item, index) => renderItem?.({ item, index }))
    const slot = (C: unknown): ReactNode =>
      typeof C === 'function' ? (C as () => ReactNode)() : ((C as ReactNode) ?? null)
    return createElement(
      'div',
      { 'data-role': 'flatlist' },
      ...items,
      slot(ListEmptyComponent),
      slot(ListFooterComponent),
    )
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
    View: mk('div'),
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
    // 共享返回键核心按字体缩放取档(packages/shared back-chevron-core → useFontMultiplier)
    PixelRatio: {
      getFontScale: () => 1,
      getPixelSizeForLayoutSize: (n: number) => n,
      roundToNearestPixel: (n: number) => n,
    },
    Appearance: { getColorScheme: () => 'light', addChangeListener: () => ({ remove() {} }) },
    useColorScheme: () => 'light',
    View: mk('div'),
    Text: mk('span'),
    ScrollView: mk('div'),
    Pressable: mk('button'),
    TouchableOpacity: mk('button'),
    FlatList: MockList,
    Image: () => createElement('img', { 'data-role': 'image' }),
    ActivityIndicator: () => createElement('div', { 'data-role': 'activity' }),
    RefreshControl: () => null,
    StyleSheet: { create: <T extends object>(s: T) => s, flatten: (s: unknown) => s },
    Platform: { OS: 'web', select: (o: Record<string, unknown>) => o.web ?? o.ios },
  }
})

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: nav.navigate, goBack: nav.goBack }),
  useRoute: () => ({ params: { id: nav.routeId } }),
}))

vi.mock('@ihui/api-client', () => ({ fetchApi: (...args: unknown[]) => api.fetchApi(...args) }))
vi.mock('../src/components/BottomPops', () => ({
  appAlert: (...args: unknown[]) => api.appAlert(...args),
}))

// 图标素材不是本页判据;名单覆盖共享屏 + BackChevron 两处 import,漏一个是运行时 export 缺失
vi.mock('lucide-react-native', () => {
  const icon = (name: string) => {
    const MockIcon = () => createElement('i', { 'data-icon': name })
    MockIcon.displayName = `MockIcon(${name})`
    return MockIcon
  }
  return Object.fromEntries(
    ['Heart', 'MessageCircle', 'PenLine', 'ChevronLeft'].map((n) => [n, icon(n.toLowerCase())]),
  )
})

import { TopicDetailScreen } from '../src/screens/TopicDetailScreen'
import { I18nProvider } from '../src/i18n'

const renderScreen = () =>
  render(createElement(I18nProvider, null, createElement(TopicDetailScreen)))

const zh = messages['zh-CN'] as Record<string, unknown>
const val = (k: string) => getValueByPath(zh, k) as string

const FIXTURE_TOPIC = {
  id: '7',
  name: 'AI 绘图',
  description: '分享你的作品与心得',
  followerCount: 12,
  isFollowed: false,
  posts: [
    {
      id: 1,
      title: '第一条帖子',
      content: '正文内容',
      author: '小明',
      createTime: new Date().toISOString(),
      likes: 1,
      comments: 2,
      images: ['https://img.example.com/a.png'],
    },
  ],
}

beforeEach(() => {
  cleanup()
  nav.navigate.mockClear()
  nav.goBack.mockClear()
  api.appAlert.mockClear()
  api.fetchApi.mockReset()
  api.fetchApi.mockImplementation(async (url: unknown) =>
    String(url).includes('/follow') ? { success: true } : { success: true, data: FIXTURE_TOPIC },
  )
})

describe('TopicDetailScreen 渲染的是共享层那一份', () => {
  it('话题头部/发布入口/帖子卡逐元素上屏(取的是词包真文案)', async () => {
    renderScreen()
    await waitFor(() => expect(screen.queryByText(val('topic.detail.publish'))).not.toBeNull())
    for (const text of [
      val('topic.detail.pageTitle'),
      '#AI 绘图', // 话题名以 # 前缀渲染,这一形态只存在于共享屏实现
      '分享你的作品与心得',
      String(val('topic.detail.followers')).replace('{n}', '12'),
      val('topic.detail.follow'),
      val('topic.detail.publishPlaceholder'),
      '第一条帖子',
      '正文内容',
      '小明',
    ]) {
      expect(screen.queryByText(text), `「${text}」未上屏`).not.toBeNull()
    }
    // 阳性对照:同一把尺子喂一个不存在的文本必须查不到(否则上面的循环是恒真的)
    expect(screen.queryByText('__definitely_absent__')).toBeNull()
  })

  it('没有任何裸 i18n 键上屏', async () => {
    const { container } = renderScreen()
    await waitFor(() => expect(screen.queryByText(val('topic.detail.publish'))).not.toBeNull())
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/\b(?:topic|common)\.[A-Za-z][\w.]*/)
    const probe = render(createElement('span', null, 'topic.detail.publish'), {
      container: document.createElement('div'),
    })
    expect(probe.container.textContent).toMatch(/\b(?:topic|common)\.[A-Za-z][\w.]*/)
  })

  it('三个跳转语义:进帖→CircleDetail,发帖→CircleCreate(透传 topicId/topicName),返回→goBack', async () => {
    const { container } = renderScreen()
    await waitFor(() => expect(screen.queryByText('正文内容')).not.toBeNull())
    fireEvent.click(screen.getByText('正文内容'))
    expect(nav.navigate).toHaveBeenCalledWith('CircleDetail', { id: '1' })
    fireEvent.click(screen.getByText(val('topic.detail.publish')))
    expect(nav.navigate).toHaveBeenCalledWith('CircleCreate', {
      topicId: nav.routeId,
      topicName: 'AI 绘图',
    })
    // BackChevron:label 只进 accessibilityLabel(无可见文字),矢量 SVG 上屏;点按钮本体
    const backBtn = container.querySelector(`[accessibilitylabel="${val('common.back')}"]`)
    expect(backBtn, '返回键(accessibilityLabel)未上屏').not.toBeNull()
    expect(backBtn?.querySelector('svg'), '返回键非矢量载体').not.toBeNull()
    fireEvent.click(backBtn as Element)
    expect(nav.goBack).toHaveBeenCalledTimes(1)
  })

  it('点关注真的打 POST /circles/topic/:id/follow 并翻转为已关注', async () => {
    renderScreen()
    await waitFor(() => expect(screen.queryByText(val('topic.detail.follow'))).not.toBeNull())
    fireEvent.click(screen.getByText(val('topic.detail.follow')))
    await waitFor(() =>
      expect(api.fetchApi).toHaveBeenCalledWith(
        '/circles/topic/7/follow',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    await waitFor(() => expect(screen.queryByText(val('topic.detail.following'))).not.toBeNull())
    expect(api.appAlert).toHaveBeenCalledWith(val('common.hint'), val('topic.detail.followSuccess'))
  })
})

describe('topic.detail.* 五语言齐备(共享屏取词之外最容易坏的一格)', () => {
  const USED = [
    'pageTitle',
    'loading',
    'loadFailed',
    'followers',
    'follow',
    'following',
    'followSuccess',
    'unfollowed',
    'followFailed',
    'publish',
    'publishPlaceholder',
    'empty',
    'loadingMore',
    'noMore',
    'anonymous',
  ]

  it.each(['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as Locale[])(
    '%s:15 键全部取到非空字符串,且不等于键名本身',
    (locale) => {
      const pack = messages[locale] as Record<string, unknown>
      for (const k of USED) {
        const v = getValueByPath(pack, `topic.detail.${k}`)
        expect(typeof v, `${locale}.topic.detail.${k} 缺失`).toBe('string')
        expect((v as string).trim(), `${locale}.topic.detail.${k} 空值`).not.toBe('')
        expect(v, `${locale}.topic.detail.${k} 落成了键名`).not.toBe(`topic.detail.${k}`)
      }
    },
  )

  it('阳性对照:同一把尺子问一个不存在的键必须取不到值', () => {
    for (const locale of ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as Locale[]) {
      expect(
        getValueByPath(messages[locale] as Record<string, unknown>, 'topic.detail.__missing__'),
        `${locale} 不该有这个键`,
      ).toBeUndefined()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
