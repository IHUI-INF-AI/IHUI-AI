// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// G-856 验收:多媒体预览「切离即暂停、解码失败只收口当前项」。
// 票面判据:新增用例断言"切换到第 2 项后第 1 项的 video 元素 paused=true"(本文件第①例);
// 另补 media-release 两个消费臂(VideoPlayer 失活/卸载、LivePlayer 失活)防出口语义漂移。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => React.createElement('img', { src, alt }),
}))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { FilePreview } from '../FilePreview'
import { VideoPlayer } from '../VideoPlayer'
import { LivePlayer } from '../LivePlayer'

const GALLERY = [
  { url: 'https://example.com/a.mp4', name: 'one' },
  { url: 'https://example.com/b.mp4', name: 'two' },
] as const

/**
 * jsdom 未实现 HTMLMediaElement 的 play/pause(调用只打 "Not implemented" 日志,不翻
 * paused 旗),`paused=true` 在裸 jsdom 里是恒真断言。这里给单个元素装上最小可观察
 * 状态机:paused 旗由"是否被 pause() 过"驱动 —— 断言要为真,组件就必须真的调 pause()。
 * 返回该元素的 pause spy(实现体翻旗),断言 spy 与断言旗等价且互为机制证明。
 */
function emulatePlaybackState(video: HTMLVideoElement) {
  let isPlaying = true
  Object.defineProperty(video, 'paused', {
    configurable: true,
    get: () => !isPlaying,
  })
  return vi.spyOn(video, 'pause').mockImplementation(() => {
    isPlaying = false
  })
}

describe('G-856 切离即暂停(media-release 三臂)', () => {
  // 画廊内 usePreviewMediaProbe 走网络探测:stub 成永不落定,pending 不干扰渲染面
  const fetchMock = vi.fn(() => new Promise<Response>(() => {}))
  beforeEach(() => {
    fetchMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('① 画廊切到第 2 项后,第 1 项的 video 元素 paused=true(票面判据)', () => {
    const props = {
      type: 'image' as const,
      url: 'https://example.com/a.mp4',
      gallery: GALLERY,
    }
    const view = render(<FilePreview {...props} />)
    // 画廊第 1 项是 video ⇒ 单持久 video 元素在位,src 指向第 1 项
    const video = view.getByTestId('image-preview-video') as HTMLVideoElement
    expect(video.getAttribute('src')).toBe('https://example.com/a.mp4')
    // 让元素先进入"播放中"形态(jsdom 无真实媒体,以最小旗标仿真,见 emulatePlaybackState)
    const pauseSpy = emulatePlaybackState(video)
    expect(video.paused).toBe(false)

    // 切到第 2 项(受控下标):上一项 effect 的 cleanup 必须把元素暂停 —— 分离/失焦的
    // 媒体元素在浏览器里会继续解码出声,这正是票面要堵的洞。
    view.rerender(<FilePreview {...props} galleryIndex={1} />)

    expect(pauseSpy).toHaveBeenCalled()
    expect(video.paused).toBe(true)
    // 单持久元素按设计切 src:第 2 项就位,且第 1 项的收口已发生
    expect(video.getAttribute('src')).toBe('https://example.com/b.mp4')
  })

  it('② VideoPlayer 失活(active=false)⇒ 只暂停,源保留可续播', () => {
    const view = render(<VideoPlayer src="https://example.com/a.mp4" />)
    const video = view.container.querySelector('video')!
    expect(video).not.toBeNull()
    const pauseSpy = emulatePlaybackState(video)
    expect(video.paused).toBe(false)

    view.rerender(<VideoPlayer src="https://example.com/a.mp4" active={false} />)

    // 「隐藏/暂时离开」档:pause() 且元素上仍有 src —— 回到 true 即可续播。
    // (回归锁:effect 清理曾在此处误走释放路径摘掉 src,见 media-release 卸载旗注释)
    expect(pauseSpy).toHaveBeenCalled()
    expect(video.paused).toBe(true)
    expect(video.getAttribute('src')).toBe('https://example.com/a.mp4')
  })

  it('③ VideoPlayer 卸载 ⇒ 暂停 + 摘源 + 复位(解码资源真正交回)', () => {
    const view = render(<VideoPlayer src="https://example.com/a.mp4" />)
    const video = view.container.querySelector('video')!
    emulatePlaybackState(video)

    view.unmount()

    // 「切 item / 关弹层 / 卸载」档:releaseMediaElement 摘掉 src(load 复位在实现内)
    expect(video.getAttribute('src')).toBeNull()
    expect(video.paused).toBe(true)
  })

  it('④ LivePlayer 失活(active=false)⇒ 收口:暂停 + 摘流(src 摘除)', () => {
    const view = render(<LivePlayer src="https://example.com/live.mp4" />)
    const video = view.container.querySelector('video')!
    expect(video).not.toBeNull()
    // 渐进分支(非 FLV/HLS)同步挂源
    expect(video.getAttribute('src')).toBe('https://example.com/live.mp4')
    emulatePlaybackState(video)

    view.rerender(<LivePlayer src="https://example.com/live.mp4" active={false} />)

    // effect 体内捕获节点后收口:hls 销毁 + releaseMediaElement(暂停 + 摘源)
    expect(video.getAttribute('src')).toBeNull()
    expect(video.paused).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
