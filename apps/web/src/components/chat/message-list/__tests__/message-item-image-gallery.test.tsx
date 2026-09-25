// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D64 ② 的**宿主接线**取证(2026-09-25 补挂)。渲染件单测(image-preview-pack.test.tsx)
// 只能证明 FilePreview 自己会翻页;本文件钉的是宿主链路上三条容易断的约定:
//   ① 多图消息:ToolCallCard 收到画廊 ⇒ ImageResultBlock 升级为 FilePreview(翻页/计数在位),
//      宿主注入的 galleryIndex 被尊重(不是永远第一张);
//   ② 单图消息:画廊不启用 ⇒ 渲染与改前逐字一致(裸 img,无翻页控件);
//   ③ 成员守卫:当前图不在画廊内(如轮询取件图)⇒ 即使宿主传了画廊也退回单图模式,
//      绝不把别人的图显示成本次的产物。
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import React from 'react'

// 取词回显键名 + 插值:本文件判的是结构与 data-* 数值,不是译文
vi.mock('next-intl', () => ({
  useLocale: () => 'zh-CN',
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => React.createElement('img', { src, alt }),
}))

// FilePreview 的探测/横幅走网络与定时器,测试里桩掉(与 image-preview-pack.test.tsx 同口径)
vi.mock('@/components/media/use-preview-staleness', () => ({
  usePreviewMediaProbe: () => ({ readAt: null, isRecord: false, notice: null, refresh: vi.fn() }),
  usePreviewTextFeed: () => ({
    readAt: null,
    isRecord: false,
    notice: null,
    loading: false,
    content: '',
    fileUpdated: false,
    refresh: vi.fn(),
    applyLatest: vi.fn(),
    dismissFileUpdated: vi.fn(),
  }),
}))
vi.mock('@/components/media/preview-degradation-banner', () => ({
  PreviewFileUpdatedBar: () => null,
  PreviewNoContentState: () => null,
  PreviewSnapshotNotice: () => null,
  usePreviewCopy: () => ({}),
}))

import { TooltipProvider } from '@/components/feedback'
import { useChatStore, type ChatMessage, type ToolCall } from '@/stores/chat'
import { MessageItem } from '../MessageItem'

const NOW = Date.UTC(2026, 8, 25, 10, 0, 0)

function imageCall(id: string, url: string): ToolCall {
  return {
    id,
    toolName: 'image_generation',
    args: { prompt: `prompt-${id}` },
    status: 'success',
    image_url: url,
  }
}

function assistantMessage(toolCalls: ToolCall[]): ChatMessage {
  return {
    id: 'm-gallery',
    role: 'assistant',
    content: '生成完成。',
    createdAt: NOW,
    toolCalls,
  }
}

function renderMessage(message: ChatMessage): void {
  useChatStore.setState({ messages: [message] })
  render(
    <TooltipProvider>
      <MessageItem message={message} isLast isStreaming={false} assistantLabel="AI" />
    </TooltipProvider>,
  )
}

function expand(toolCallId: string): void {
  fireEvent.click(screen.getByTestId(`tool-call-row-${toolCallId}`))
}

afterEach(() => {
  cleanup()
  useChatStore.setState({ messages: [] })
})

describe('D64② MessageItem 图片画廊接线', () => {
  it('多图消息:展开的图卡升级为 FilePreview,翻页/计数在位,宿主注入的下标被尊重', () => {
    renderMessage(
      assistantMessage([
        imageCall('tc-1', 'https://cdn.test/a.png'),
        imageCall('tc-2', 'https://cdn.test/b.png'),
      ]),
    )
    // 直接展开第二张:计数应为「第 2 · 2 张」而不是第一张(宿主 galleryIndex=1 生效)
    expand('tc-2')
    const root = document.querySelector('[data-image-preview-total]')
    expect(root?.getAttribute('data-image-preview-total')).toBe('2')
    expect(root?.getAttribute('data-image-preview-index')).toBe('1')
    expect(document.querySelector('[data-image-nav="prev"]')).toBeTruthy()
    expect(document.querySelector('[data-image-counter]')?.textContent).toBe(
      'imagePreview.counter:{"index":2,"total":2}',
    )
    // 翻页由判定层 pageImage 决定,渲染源跟着走
    fireEvent.click(screen.getByRole('button', { name: 'imagePreview.prev' }))
    expect(root?.getAttribute('data-image-preview-index')).toBe('0')
    // 折叠的第一张不得也渲染出第二份预览(一次只有展开的那张挂 FilePreview)
    expect(document.querySelectorAll('[data-image-preview-total]')).toHaveLength(1)
  })

  it('单图消息:画廊不启用,渲染与改前逐字一致(裸 img + 无翻页/无计数容器)', () => {
    renderMessage(assistantMessage([imageCall('tc-solo', 'https://cdn.test/solo.png')]))
    expand('tc-solo')
    expect(document.querySelector('[data-image-preview-total]')).toBeNull()
    expect(document.querySelector('[data-image-nav="prev"]')).toBeNull()
    // 既有裸 img 行为:alt 用提示词,加载失败兜底仍在
    expect(document.querySelector('img[alt="prompt-tc-solo"]')).toBeTruthy()
  })

  it('成员守卫:三图消息里 result 兜底推导的图不在画廊内 ⇒ 退回单图模式,不显示别张图', () => {
    renderMessage(
      assistantMessage([
        imageCall('tc-1', 'https://cdn.test/a.png'),
        imageCall('tc-2', 'https://cdn.test/b.png'),
        {
          id: 'tc-3',
          toolName: 'image_generation',
          args: { prompt: 'prompt-tc-3' },
          status: 'success',
          // 无 image_url 顶层字段,URL 只在 result 里(MessageItem 既有兜底推导路径)
          result: { image_url: 'https://cdn.test/c.png' },
        },
      ]),
    )
    expand('tc-3')
    // 画廊 = [a, b],当前图 c 不在其中 ⇒ 不挂 FilePreview,渲染裸 img
    expect(document.querySelector('[data-image-preview-total]')).toBeNull()
    expect(document.querySelector('img[alt="prompt-tc-3"]')?.getAttribute('src')).toBe(
      'https://cdn.test/c.png',
    )
    // 同一消息里展开画廊内的那张,仍然正常升级(守卫只影响不在画廊内的成员)
    cleanup()
    useChatStore.setState({ messages: [] })
    renderMessage(
      assistantMessage([
        imageCall('tc-1', 'https://cdn.test/a.png'),
        imageCall('tc-2', 'https://cdn.test/b.png'),
      ]),
    )
    expand('tc-1')
    expect(
      document
        .querySelector('[data-image-preview-total]')
        ?.getAttribute('data-image-preview-total'),
    ).toBe('2')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
