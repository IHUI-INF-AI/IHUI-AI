// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 门 285 B 组:NavBar 的 leftActions/rightActions/rightAction、VideoPlayer.title、
// IntelligentAssistant.robotImage —— 小程序侧由「只声明」收口为真实消费(渲染即可见)。
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@tarojs/components', () => {
  const make = (tag: string) => {
    const Stub = (props: { children?: ReactNode; src?: string; style?: unknown }) =>
      createElement(tag, { src: props.src, style: props.style as never }, props.children)
    Stub.displayName = `Taro${tag}`
    return Stub
  }
  return {
    View: make('div'),
    Text: make('span'),
    Image: make('img'),
    Video: make('video'),
    Button: make('button'),
  }
})
// 共享核心用端侧 JSX runtime 产出的元素与测试里的 react-dom 18 不同源,直接渲染会报
// "Objects are not valid as a React child";本用例只验小程序壳有没有把槽位真的传下去,
// 故核心以最小结构替身(左/中/右/尾四槽原样落地)。
vi.mock('@ihui/shared/ui', () => ({
  NavBarCore: (props: Record<string, unknown>) =>
    createElement(
      'div',
      null,
      props.leading as never,
      (props.left as never) ?? null,
      (props.center as never) ?? (props.title as never) ?? null,
      (props.right as never) ?? null,
      (props.trailing as never) ?? null,
    ),
}))
vi.mock('@tarojs/taro', () => ({
  default: { navigateTo: vi.fn(), redirectTo: vi.fn(), showToast: vi.fn() },
  navigateTo: vi.fn(),
  redirectTo: vi.fn(),
  showToast: vi.fn(),
}))
vi.mock('@/i18n', () => ({
  useTt: () => (_k: string, fb: string) => fb,
  useI18n: () => ({ t: (_k: string, fb?: string) => fb ?? '' }),
  t: (_k: string, fb?: string) => fb ?? '',
}))
vi.mock('@/components/BackChevron', () => ({
  default: () => createElement('span', { 'data-back': 'chevron' }),
}))
vi.mock('@/components/LineIcon', () => ({
  default: () => createElement('span', { 'data-icon': 'line' }),
}))

import NavBar from '../src/components/NavBar'
import VideoPlayer from '../src/components/VideoPlayer'
import IntelligentAssistant from '../src/components/IntelligentAssistant'

const render = (comp: unknown, props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(comp as never, props as never))

describe('NavBar 数组槽位真消费', () => {
  it('空渲染', () => {
    expect(render(NavBar, { title: '标题' })).toContain('标题')
  })

  it('leftActions / rightActions 的字符图标与文字真的进 DOM', () => {
    const html = render(NavBar, {
      title: '标题',
      leftActions: [{ icon: '★', label: '收藏', onPress: () => {} }],
      rightActions: [{ icon: '余', label: '更多', onPress: () => {} }],
    })
    expect(html).toContain('收藏')
    expect(html).toContain('更多')
    expect(html).toContain('★')
  })

  it('rightActions 的图片 URL 走 img,rightAction ReactNode 原样渲染', () => {
    const html = render(NavBar, {
      title: '标题',
      rightActions: [{ icon: 'https://cdn.example.com/i.png', onPress: () => {} }],
      rightAction: createElement('span', { 'data-legacy': 'right' }, 'RN 节点'),
    })
    expect(html).toContain('https://cdn.example.com/i.png')
    expect(html).toContain('RN 节点')
  })
})

describe('VideoPlayer title 真消费', () => {
  it('传 title 时标题进 DOM;不传时零增量', () => {
    expect(
      render(VideoPlayer, { src: 'https://cdn.example.com/v.mp4', title: '课程标题' }),
    ).toContain('课程标题')
    expect(render(VideoPlayer, { src: 'https://cdn.example.com/v.mp4' })).not.toContain('课程标题')
  })
})

describe('IntelligentAssistant robotImage 真消费', () => {
  it('传 robotImage 时渲染位图;缺省回退行内矢量', () => {
    const withImage = render(IntelligentAssistant, {
      robotImage: 'https://cdn.example.com/bot.png',
    })
    expect(withImage).toContain('https://cdn.example.com/bot.png')
    const fallback = render(IntelligentAssistant, {})
    expect(fallback).not.toContain('bot.png')
    expect(fallback).toContain('data-icon')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
