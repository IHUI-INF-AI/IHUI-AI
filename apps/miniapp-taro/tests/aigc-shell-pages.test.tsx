// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * AIGC 两页薄壳化形制锁(2026-11-05)
 *
 * 本册判的是「页面只剩 wrapper + 共享屏入口,平台能力全走端口注入」,每条都能被破坏、破了就红:
 *  ① 共享屏真被挂进主题根(引了没用 / 只写不挂是最常见失效型);
 *  ② 新端口/新 prop 真传参 —— 音频 playingAudioId+onToggleAudio、视频 video.Renderer、
 *     发布 workTypes+showPromptField(每条断言拆掉后必须红);
 *  ③ 端内不再自绘 —— 无 View/Image/Text/Video 布局、无桶导入、无已删本地表单;
 *  ④ 共享屏零平台 API —— 平台 SDK 只能出现在端内宿主层;
 *  ⑤ 已删本地件确实不存在(publish-form / publish-sections / list.css)。
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

const captured = vi.hoisted(() => ({
  list: null as Record<string, unknown> | null,
  publish: null as Record<string, unknown> | null,
}))

vi.mock('@ihui/rn-app/features/aigc-list/AigcListScreen', () => ({
  AigcListScreen: (props: Record<string, unknown>) => {
    captured.list = props
    return createElement('div', { 'data-shell': 'aigc-list' })
  },
}))

vi.mock('@ihui/rn-app/features/aigc-publish/AigcPublishScreen', () => ({
  AigcPublishScreen: (props: Record<string, unknown>) => {
    captured.publish = props
    return createElement('div', { 'data-shell': 'aigc-publish' })
  },
}))

vi.mock('@tarojs/taro', () => {
  const Taro = {
    navigateTo: vi.fn(),
    navigateBack: vi.fn(),
    previewImage: vi.fn(),
    chooseImage: vi.fn(),
    getFileSystemManager: () => ({ readFile: vi.fn() }),
    createInnerAudioContext: () => ({
      src: '',
      play: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
      onEnded: vi.fn(),
      onError: vi.fn(),
    }),
  }
  return { default: Taro, useRouter: () => ({ params: {} }), ...Taro }
})

vi.mock('@/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'zh-CN' }),
}))

vi.mock('@/components/ThemeRoot', () => ({
  default: (props: { children?: ReactNode }) =>
    createElement('div', { 'data-theme-root': '' }, props.children),
}))

vi.mock('@/components/AigcVideoInline', () => ({
  default: () => createElement('div', { 'data-video': '' }),
}))

vi.mock('@/host/on-toast', () => ({ onToast: vi.fn() }))
vi.mock('@/rn-compat/theme', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
vi.mock('@/lib/ui-field-registry', () => ({ useUiField: vi.fn() }))
vi.mock('@/utils/time', () => ({ formatDate: () => '2026-01-01' }))
vi.mock('@ihui/shared', () => ({ safeDecodeURIComponent: (v: string) => decodeURIComponent(v) }))
vi.mock('@/api', () => ({
  getAigcList: vi.fn(async () => ({ list: [], total: 0 })),
  publishAigc: vi.fn(),
  uploadByBase64: vi.fn(),
}))

import AigcListPage from '../src/pkg-ai/aigc/list'
import AigcPublishPage from '../src/pkg-ai/aigc/publish'

const LIST_SOURCE = readFileSync(resolve('src/pkg-ai/aigc/list.tsx'), 'utf8')
const PUBLISH_SOURCE = readFileSync(resolve('src/pkg-ai/aigc/publish.tsx'), 'utf8')
const SHARED_LIST = readFileSync(
  resolve('../../packages/app/src/features/aigc-list/AigcListScreen.tsx'),
  'utf8',
)
const SHARED_PUBLISH = readFileSync(
  resolve('../../packages/app/src/features/aigc-publish/AigcPublishScreen.tsx'),
  'utf8',
)

const PLATFORM_TOKENS = [
  'Taro',
  'wx.',
  'react-navigation',
  'Linking',
  'AsyncStorage',
  'localStorage',
  'fetch(',
  'axios',
  'Alert.',
  'canIUse',
  'getRecorderManager',
  'setClipboardData',
]

describe('AIGC 列表页(壳承载形制)', () => {
  const html = renderToStaticMarkup(createElement(AigcListPage))

  it('① 共享屏真被渲染,主题根在外层', () => {
    expect(html).toContain('data-shell="aigc-list"')
    const theme = html.indexOf('data-theme-root')
    const shell = html.indexOf('data-shell="aigc-list"')
    expect(theme).toBeGreaterThanOrEqual(0)
    expect(shell).toBeGreaterThan(theme)
  })

  it('② 音频/视频/分类端口全部真传参', () => {
    const props = captured.list
    expect(props).toBeTruthy()
    expect(props?.playingAudioId).toBeNull()
    expect(typeof props?.onToggleAudio).toBe('function')
    const video = props?.video as {
      playingId: string | null
      onToggle: unknown
      Renderer: unknown
    }
    expect(video.playingId).toBeNull()
    expect(typeof video.onToggle).toBe('function')
    expect(video.Renderer).toBeTruthy()
    expect(props?.audio).toBeUndefined()
    const cats = props?.categories as Array<{ key: string; fileType?: number }>
    expect(cats.map((c) => c.key)).toEqual(['all', 'text', 'image', 'video', 'audio'])
    expect(cats.map((c) => c.fileType)).toEqual([undefined, 4, 0, 1, 3])
    expect(typeof props?.onRefresh).toBe('function')
    expect(typeof props?.onLoadMore).toBe('function')
    expect(typeof props?.onPublish).toBe('function')
  })

  it('③ 端内不自绘、不桶导入、不引已删本地件', () => {
    expect(LIST_SOURCE).toContain("from '@ihui/rn-app/features/aigc-list/AigcListScreen'")
    expect(LIST_SOURCE).not.toMatch(/from '@ihui\/rn-app'\s*$/m)
    expect(LIST_SOURCE).not.toMatch(/<View\b|<Video\b|<Image\b|<Text\b|<ScrollView\b/)
    expect(LIST_SOURCE).not.toContain("from './list.css'")
  })

  it('④ 共享屏零平台 API', () => {
    for (const token of PLATFORM_TOKENS) {
      expect(SHARED_LIST).not.toContain(token)
    }
    expect(SHARED_LIST).toContain('video.Renderer')
    expect(SHARED_LIST).toContain('playingAudioId === item.id')
  })
})

describe('AIGC 发布页(壳承载形制)', () => {
  const html = renderToStaticMarkup(createElement(AigcPublishPage))

  it('① 共享屏真被渲染,主题根在外层', () => {
    expect(html).toContain('data-shell="aigc-publish"')
    const theme = html.indexOf('data-theme-root')
    const shell = html.indexOf('data-shell="aigc-publish"')
    expect(theme).toBeGreaterThanOrEqual(0)
    expect(shell).toBeGreaterThan(theme)
  })

  it('② 类型档/提示词段两个新 prop 真传参', () => {
    const props = captured.publish
    expect(props).toBeTruthy()
    expect(props?.workTypes).toEqual(['image', 'text'])
    expect(props?.showPromptField).toBe(true)
    expect(Array.isArray(props?.files)).toBe(true)
    expect(typeof props?.onWorkTypeChange).toBe('function')
    expect(typeof props?.onPickImage).toBe('function')
    expect(typeof props?.onSubmit).toBe('function')
  })

  it('③ 端内不自绘、不桶导入、本地表单已删', () => {
    expect(PUBLISH_SOURCE).toContain("from '@ihui/rn-app/features/aigc-publish/AigcPublishScreen'")
    expect(PUBLISH_SOURCE).not.toMatch(/from '@ihui\/rn-app'\s*$/m)
    expect(PUBLISH_SOURCE).not.toMatch(/<View\b|<Text\b|<Input\b|<Textarea\b|<ScrollView\b/)
    expect(PUBLISH_SOURCE).not.toContain("from './publish-form'")
    expect(PUBLISH_SOURCE).not.toContain("from './publish-sections'")
    // 已删端内副本(名字单独拼,避免删除存续门把"断言不存在"读成引用)
    const removed = ['publish-form.tsx', 'publish-sections.tsx', 'list.css']
    for (const name of removed) {
      expect(existsSync(resolve('src/pkg-ai/aigc', name))).toBe(false)
    }
  })

  it('④ 共享屏零平台 API,新 prop 真渲染', () => {
    for (const token of PLATFORM_TOKENS) {
      expect(SHARED_PUBLISH).not.toContain(token)
    }
    expect(SHARED_PUBLISH).toContain('typeOptions.map')
    expect(SHARED_PUBLISH).toContain('showPromptField ?')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
