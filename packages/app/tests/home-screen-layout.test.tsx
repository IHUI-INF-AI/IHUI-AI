// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 首页共享屏的形态锁(packages/app/src/features/home/HomeScreen.tsx)。
//
// 钉的是 2026-10-20 用户实拍打回的那一型:三块内容全空时摆出三张同形空卡 + 九行菜单长列表,
// 整屏读成"三个洞"。这类问题截图看得见、typecheck 看不见,所以判据必须落在渲染结果上:
//   1. 三块全空 ⇒ 只留一枚引导卡,「直播预告」「为你推荐」两个标题一起消失(空壳不占位)
//   2. 任一块有数据 ⇒ 各自区块照常渲染(合并只发生在"全空"这一格)
//   3. 卡片不得再带 1px 硬边框(暗色下底色已分区,描边会把卡片读成凹陷)
//   4. 发现区是宫格:每格宽 33.333%,不再是整行 + ChevronRight
//   5. 错误态必须带「重试」出口,不能只甩一行红字

import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

import { HomeScreen } from '../src/features/home/HomeScreen'

vi.mock('lucide-react-native', () => {
  const icon = (name: string) => () => createElement('i', { 'data-icon': name })
  return {
    Bell: icon('Bell'),
    BookOpen: icon('BookOpen'),
    Video: icon('Video'),
    ChevronRight: icon('ChevronRight'),
  }
})

vi.mock('react-native', () => {
  const flatten = (style: unknown): Record<string, unknown> => {
    if (style === null || style === undefined) return {}
    if (Array.isArray(style))
      return style.reduce<Record<string, unknown>>((acc, s) => Object.assign(acc, flatten(s)), {})
    if (typeof style === 'object') return style as Record<string, unknown>
    return {}
  }
  // RN 专有 prop 一律不进 DOM:React 会按 HTML 属性处理它们(报警 + 污染断言面)
  const DROP = new Set([
    'numberOfLines',
    'maxFontSizeMultiplier',
    'activeOpacity',
    'hitSlop',
    'refreshControl',
    'contentContainerStyle',
    'testID',
    'includeFontPadding',
  ])
  const rnEl = (tag: string) => (p: Record<string, unknown>) => {
    const { style, children, onPress, ...rest } = p
    const dom: Record<string, unknown> = { 'data-style': JSON.stringify(flatten(style)) }
    for (const [k, v] of Object.entries(rest)) {
      if (DROP.has(k) || k.startsWith('accessibility') || k.startsWith('on')) continue
      dom[k] = v
    }
    if (typeof onPress === 'function') dom.onClick = onPress
    // MoreLink 等用 Pressable 的 children 渲染函数形态(pressed => …),桩里先求值
    const kids = typeof children === 'function' ? (children as never)({ pressed: false }) : children
    return createElement(tag, dom, kids as never)
  }
  return {
    View: rnEl('div'),
    Text: rnEl('span'),
    TouchableOpacity: rnEl('button'),
    Pressable: rnEl('button'),
    ScrollView: rnEl('div'),
    RefreshControl: () => null,
    ActivityIndicator: rnEl('div'),
    StyleSheet: { flatten, create: (s: unknown) => s },
    Platform: { OS: 'web' },
    PixelRatio: { getFontScale: () => 1 },
  }
})

const t = (key: string) => key

const MENU = [
  { key: 'Search', labelKey: 'search.title' },
  { key: 'History', labelKey: 'history.title' },
  { key: 'Bookmark', labelKey: 'bookmark.title' },
]

const styleOf = (el: Element) =>
  JSON.parse(el.getAttribute('data-style') || '{}') as Record<string, unknown>

/** 取"卡片档"节点:同时带底色与圆角的容器(引导卡/区块卡/按钮/标签/状态点都落在这档) */
const cardNodes = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-style]')).filter((el) => {
    const s = styleOf(el)
    return typeof s.backgroundColor === 'string' && s.borderRadius !== undefined
  })

const renderHome = (over: Record<string, unknown> = {}) =>
  render(
    createElement(HomeScreen, {
      t,
      userNickname: ' tester',
      connected: true,
      unreadCount: 0,
      recommends: [],
      lives: [],
      progress: [],
      menuItems: MENU,
      loading: false,
      refreshing: false,
      error: '',
      onRefresh: () => {},
      onOpenNotifications: () => {},
      onPressProgress: () => {},
      onPressLive: () => {},
      onPressCourse: () => {},
      onPressMenu: () => {},
      onNavigateCourses: () => {},
      onNavigateLives: () => {},
      colorScheme: 'dark',
      ...over,
    } as never),
  )

describe('首页共享屏形态', () => {
  it('三块全空 ⇒ 只留一枚引导卡,两个区块标题一起消失', () => {
    const { container } = renderHome()
    const text = container.textContent || ''
    expect(text).toContain('home.progressEmpty')
    expect(text).not.toContain('home.livePreview')
    expect(text).not.toContain('home.recommend')
    expect(text).not.toContain('live.empty')
    expect(text).not.toContain('course.empty')
  })

  it('只有一块有数据 ⇒ 合并立即解除,各区块照常渲染', () => {
    const { container } = renderHome({
      progress: [
        {
          courseId: 'c1',
          courseTitle: '一门课',
          progress: 0.5,
          completedLessons: 3,
          totalLessons: 6,
        },
      ],
    })
    const text = container.textContent || ''
    expect(text).toContain('home.learningProgress')
    expect(text).toContain('home.livePreview')
    expect(text).toContain('home.recommend')
    expect(text).toContain('一门课')
  })

  it('卡片不带硬边框(暗色下靠底色分区)', () => {
    const { container } = renderHome()
    const cards = cardNodes(container)
    // 防空转:这一屏至少要有一枚带底色+圆角的卡片档节点,否则下面的断言是恒真
    expect(cards.length).toBeGreaterThan(0)
    for (const c of cards) expect(styleOf(c).borderWidth).toBeUndefined()
  })

  it('发现区是宫格:每格 33.333% 宽,格数等于入口数', () => {
    const { container } = renderHome()
    const cells = Array.from(container.querySelectorAll('button')).filter((b) => {
      const s = styleOf(b)
      return s.width === '33.333%'
    })
    expect(cells).toHaveLength(MENU.length)
    for (const c of cells) {
      const s = styleOf(c)
      expect(s.alignItems).toBe('center')
      expect(s.flexWrap).toBeUndefined()
    }
  })

  it('错误态带重试出口,不是只有一行红字', () => {
    const { container } = renderHome({ error: '网络异常,请稍后重试' })
    const text = container.textContent || ''
    expect(text).toContain('网络异常,请稍后重试')
    expect(text).toContain('common.retry')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
