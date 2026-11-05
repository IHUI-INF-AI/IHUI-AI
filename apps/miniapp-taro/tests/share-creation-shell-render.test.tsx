// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 分享落地页薄壳锁(apps/miniapp-taro/src/pkg-content/share/creation.tsx)。
//
// 判据:
//   ① 源码钉住共享屏入口;页内不得出现 @tarojs/components / View / Text / Video / Audio 渲染段
//   ② 12 个 prop 逐个到齐(集合精确相等),渲染函数只以引用形式过桥
//   ③ 内容映射 1:1(问题/回答/thinking/图片/lists/模型/tokenCost/作者),业务字段不泄漏
//   ④ 返回/重试/预览图片/重新生成/分享好友/分享文案 真调用
//   (阴性对照:摘 prop、删一条映射、换回本地 View、重新引入 @tarojs/components,断言立即转红)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

const h = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
  navigateTo: vi.fn(),
  navigateBack: vi.fn(),
  previewImage: vi.fn(),
  showShareMenu: vi.fn(),
  onToast: vi.fn(),
  getShareContentByCode: vi.fn(),
  shareMessage: null as null | (() => Record<string, unknown>),
  renderShareVideo: vi.fn(),
  renderShareAudio: vi.fn(),
}))

vi.mock('@ihui/rn-app/features/share-landing/ShareLandingScreen', () => ({
  ShareLandingScreen: (p: Record<string, unknown>) => {
    h.props = p
    return createElement('div', { 'data-screen': 'share-landing' })
  },
}))

vi.mock('@/api', () => ({
  getShareContentByCode: h.getShareContentByCode,
}))
vi.mock('@/utils/share', () => ({ showShareMenu: h.showShareMenu }))
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/host/on-toast', () => ({ onToast: h.onToast }))
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key}|${JSON.stringify(params)}` : key,
    locale: 'zh-CN',
  }),
}))
vi.mock('@/rn-compat/theme', () => ({
  useTheme: () => ({ themeMode: 'light', resolvedTheme: 'dark' }),
}))
vi.mock('@/components/ThemeRoot', () => {
  const Stub = (props: { children?: ReactNode }) =>
    createElement('div', { 'data-theme-root': '' }, props.children)
  Stub.displayName = 'ThemeRootStub'
  return { default: Stub }
})
vi.mock('../src/pkg-content/share/creation-media', () => ({
  renderShareVideo: h.renderShareVideo,
  renderShareAudio: h.renderShareAudio,
}))

vi.mock('@tarojs/taro', () => {
  const api = {
    navigateTo: h.navigateTo,
    navigateBack: h.navigateBack,
    previewImage: h.previewImage,
    showShareMenu: h.showShareMenu,
  }
  return {
    default: api,
    ...api,
    useDidShow: vi.fn(),
    useShareAppMessage: (cb: () => Record<string, unknown>) => {
      h.shareMessage = cb
    },
    getCurrentInstance: () => ({ router: { params: { code: 'abc123' } } }),
  }
})

import ShareCreationPage, {
  toShareLandingContent,
  type ShareCreationRecord,
} from '../src/pkg-content/share/creation'
import type { ShareLandingContent } from '@ihui/rn-app/features/share-landing/ShareLandingScreen'

const SOURCE = readFileSync(resolve('src/pkg-content/share/creation.tsx'), 'utf8')
const MEDIA_SOURCE = readFileSync(resolve('src/pkg-content/share/creation-media.tsx'), 'utf8')

const EXPECTED_KEYS = [
  't',
  'state',
  'content',
  'errorText',
  'onBack',
  'onRetry',
  'onPreviewImage',
  'onRegenerate',
  'onShareFriend',
  'colorScheme',
  'renderVideo',
  'renderAudio',
]

const RECORD: ShareCreationRecord = {
  code: 'abc123',
  agentId: 'agent-1',
  modelName: 'DeepSeek-V4',
  modelIcon: 'https://img.example/model.png',
  question: '请把今天的讨论整理成三点结论',
  answer: {
    thinking: '先拆解问题,再收敛要点。',
    text: '结论一:先薄壳化。',
    images: ['https://img.example/1.png', 'https://img.example/2.png'],
    video: { url: 'https://cdn.example/v.mp4', cover: 'https://img.example/v.png' },
    audio: { url: 'https://cdn.example/a.mp3', duration: 12 },
    lists: [
      { type: 'text', content: '要点一' },
      { type: 'image', content: 'https://img.example/list.png' },
    ],
  },
  tokenCost: 128,
  createdAt: '2026-11-05T08:30:00.000Z',
  userAvatar: 'https://img.example/u.png',
  userName: '李春川',
}

function assertShellSource(src: string): void {
  expect(src).toContain("from '@ihui/rn-app/features/share-landing/ShareLandingScreen'")
  expect(src).toContain('<ShareLandingScreen')
  expect(src).not.toContain('@tarojs/components')
  expect(src).not.toContain('<View')
  expect(src).not.toContain('<Text')
  expect(src).not.toContain('<Video')
  expect(src).not.toContain('<Audio')
  expect(src).not.toContain('@ihui/rn-app/features/chat/ChatScreen')
  expect(src).not.toContain('@ihui/rn-app/features/square/SquareScreen')
}

function assertSharedScreenProps(props: Record<string, unknown>): void {
  expect(Object.keys(props).sort()).toEqual([...EXPECTED_KEYS].sort())
  expect(props.state).toBe('loading')
  expect(props.content).toBeNull()
  expect(props.errorText).toBe('')
  expect(props.colorScheme).toBe('dark')
  for (const key of [
    't',
    'onBack',
    'onRetry',
    'onPreviewImage',
    'onRegenerate',
    'onShareFriend',
    'renderVideo',
    'renderAudio',
  ]) {
    expect(typeof props[key]).toBe('function')
  }
  expect(props.renderVideo).toBe(h.renderShareVideo)
  expect(props.renderAudio).toBe(h.renderShareAudio)
}

function assertLandingContent(content: ShareLandingContent): void {
  expect(content.modelName).toBe(RECORD.modelName)
  expect(content.modelIcon).toBe(RECORD.modelIcon)
  expect(content.question).toBe(RECORD.question)
  expect(content.tokenCost).toBe(RECORD.tokenCost)
  expect(content.createdAt).toBe(RECORD.createdAt)
  expect(content.userName).toBe(RECORD.userName)
  expect(content.userAvatar).toBe(RECORD.userAvatar)
  expect(content.answer?.thinking).toBe(RECORD.answer?.thinking)
  expect(content.answer?.text).toBe(RECORD.answer?.text)
  expect(content.answer?.images).toEqual(RECORD.answer?.images)
  expect(content.answer?.lists).toEqual(RECORD.answer?.lists)
  expect(Object.keys(content)).toEqual([
    'modelName',
    'modelIcon',
    'question',
    'answer',
    'tokenCost',
    'createdAt',
    'userAvatar',
    'userName',
  ])
}

function renderPage(): Record<string, unknown> {
  h.props = null
  renderToStaticMarkup(createElement(ShareCreationPage))
  expect(h.props).not.toBeNull()
  return h.props as unknown as Record<string, unknown>
}

describe('share/creation 薄壳', () => {
  beforeEach(() => {
    h.props = null
    h.shareMessage = null
    h.navigateTo.mockReset()
    h.navigateBack.mockReset()
    h.previewImage.mockReset()
    h.showShareMenu.mockReset()
    h.onToast.mockReset()
    h.getShareContentByCode.mockReset()
    h.renderShareVideo.mockReset()
    h.renderShareAudio.mockReset()
    h.getShareContentByCode.mockResolvedValue(RECORD)
  })

  it('① 源码钉住共享屏入口,页内渲染型 JSX 已清零', () => {
    assertShellSource(SOURCE)
    // 兄弟模块承担 Taro 播放器,页面本身零渲染片段
    expect(MEDIA_SOURCE).toContain('@tarojs/components')
    expect(MEDIA_SOURCE).toContain('<Video')
    expect(MEDIA_SOURCE).toContain('<Audio')

    // 阴性对照:换回本地 View / 重新引 @tarojs/components / 改回桶导入,立即转红
    expect(() => assertShellSource(SOURCE.replace('<ShareLandingScreen', '<View'))).toThrow()
    expect(() =>
      assertShellSource(
        SOURCE.replace(
          "import Taro, { getCurrentInstance, useDidShow, useShareAppMessage } from '@tarojs/taro'",
          "import { View } from '@tarojs/components'\nimport Taro, { getCurrentInstance, useDidShow, useShareAppMessage } from '@tarojs/taro'",
        ),
      ),
    ).toThrow()
    expect(() =>
      assertShellSource(
        SOURCE.replace(
          "from '@ihui/rn-app/features/share-landing/ShareLandingScreen'",
          "from '@ihui/rn-app'",
        ),
      ),
    ).toThrow()
  })

  it('② 12 个 prop 逐个到齐,渲染函数只以引用过桥', () => {
    assertSharedScreenProps(renderPage())
  })

  it('③ 内容映射 1:1,业务字段(agentId/code)不泄漏进共享屏', () => {
    const mapped = toShareLandingContent(RECORD)
    assertLandingContent(mapped)
    expect('agentId' in mapped).toBe(false)
    expect('code' in mapped).toBe(false)
  })

  it('④ 返回/重试/预览/重新生成/分享好友/分享文案 真调用', async () => {
    const p = renderPage()

    ;(p.onBack as () => void)()
    expect(h.navigateBack).toHaveBeenCalledTimes(1)

    ;(p.onRetry as () => void)()
    expect(h.getShareContentByCode).toHaveBeenCalledWith('abc123')
    await new Promise((r) => setTimeout(r, 0))

    ;(p.onPreviewImage as (images: string[], index: number) => void)(
      ['https://img.example/1.png', 'https://img.example/2.png'],
      1,
    )
    expect(h.previewImage).toHaveBeenCalledWith({
      urls: ['https://img.example/1.png', 'https://img.example/2.png'],
      current: 'https://img.example/2.png',
    })

    ;(p.onRegenerate as () => void)()
    expect(h.navigateTo).toHaveBeenLastCalledWith({ url: '/pkg-ai/ai/chat' })

    ;(p.onShareFriend as () => void)()
    expect(h.showShareMenu).toHaveBeenCalledWith({ withShareTicket: true })
    expect(h.onToast).toHaveBeenCalledWith('share.creation.clickShare', { kind: 'info' })

    expect(h.shareMessage).not.toBeNull()
    const message = (h.shareMessage as () => Record<string, unknown>)()
    expect(message).toMatchObject({
      title: 'share.creation.title',
      path: '/pkg-content/share/creation?code=abc123',
      imageUrl: '',
    })
  })

  it('⑤ 阴性对照:摘 prop / 删一条映射 / 换回本地 View 必须红', () => {
    const good = renderPage()
    const noRetry = { ...good }
    delete noRetry.onRetry
    expect(() => assertSharedScreenProps(noRetry)).toThrow()

    expect(() => assertSharedScreenProps({ ...good, renderVideo: undefined })).toThrow()
    expect(() => assertSharedScreenProps({ ...good, colorScheme: 'light' })).toThrow()

    const mapped = toShareLandingContent(RECORD)
    expect(() => {
      const withoutThinking: ShareLandingContent = {
        ...mapped,
        answer: { ...mapped.answer, thinking: undefined },
      }
      assertLandingContent(withoutThinking)
    }).toThrow()
    expect(() => {
      const withoutTokenCost = { ...mapped }
      delete (withoutTokenCost as Partial<ShareLandingContent>).tokenCost
      assertLandingContent(withoutTokenCost)
    }).toThrow()
    expect(() => {
      const withoutAuthor = { ...mapped }
      delete (withoutAuthor as Partial<ShareLandingContent>).userName
      assertLandingContent(withoutAuthor)
    }).toThrow()

    expect(() => assertShellSource(SOURCE.replace('<ShareLandingScreen', '<Text'))).toThrow()
  })
})
