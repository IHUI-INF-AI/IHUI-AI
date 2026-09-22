// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
/**
 * 媒体查看器族可访问名回归测试(2026-09-23 a11y 审计收口)
 *
 * 判据(渲染断言优先,静态断言兜底):
 * - ImageViewer / VideoPlayer 真实渲染后,每个 <button> 都有非空 aria-label;
 * - 状态三元必须**跟随状态**:playing=false → "播放",true → "暂停";
 *   muted=false → "静音",true → "取消静音"(取 mockT 的中文值证明,不查源码字符串);
 * - 渲染不起来的组件(PDFViewer/LivePlayer/UnifiedViewer 依赖 pdfjs / hls.js / fetch)
 *   退化为静态断言:两态标签、各标签取词调用必须都在源码里出现;
 * - copy-button 常驻操作不得再被 tabIndex={-1} 剥夺键盘可达。
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'

// ─── next-intl mock:a11y 命名空间按 zh-CN 词表查表(断言中文值即证明取词跟随状态) ──
const A11Y_ZH: Record<string, string> = {
  zoomIn: '放大',
  zoomOut: '缩小',
  rotate: '旋转',
  fullscreen: '全屏',
  previous: '上一张',
  next: '下一张',
  play: '播放',
  pause: '暂停',
  seekBackward: '快退',
  seekForward: '快进',
  mute: '静音',
  unmute: '取消静音',
  copy: '复制',
  close: '关闭',
}
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => A11Y_ZH[key] ?? key,
}))

// ─── next/image mock:测试环境不加载 Next 图片 loader ──
vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt?: string; src: string }) => (
    <img alt={alt ?? ''} src={typeof src === 'string' ? src : ''} />
  ),
}))

// ─── @ihui/ui-react mock:全屏遮罩里的 CloseButton ──
vi.mock('@ihui/ui-react', () => ({
  CloseButton: ({ ariaLabel }: { ariaLabel?: string }) => (
    <button aria-label={ariaLabel ?? 'Close'} type="button" />
  ),
}))

import { ImageViewer } from '../src/components/media/ImageViewer'
import { VideoPlayer } from '../src/components/media/VideoPlayer'

const MEDIA_DIR = resolve(__dirname, '../src/components/media')

function labelOfAllButtons(): string[] {
  return Array.from(screen.getAllByRole('button')).map(
    (el) => el.getAttribute('aria-label')?.trim() ?? '',
  )
}

afterEach(cleanup)

describe('ImageViewer 图标钮可访问名', () => {
  it('多图画集下 6 个图标钮全部有非空 aria-label', () => {
    render(<ImageViewer src="/a.png" images={['/a.png', '/b.png']} />)
    const labels = labelOfAllButtons()
    expect(labels.length).toBe(6)
    expect(labels.every((l) => l.length > 0)).toBe(true)
    expect(labels).toEqual(
      expect.arrayContaining(['缩小', '放大', '旋转', '全屏', '上一张', '下一张']),
    )
  })
})

describe('VideoPlayer 图标钮可访问名跟随播放/静音状态', () => {
  it('未自动播放(playing=false)时标签为"播放",静音按钮为"静音"', () => {
    render(<VideoPlayer src="/v.mp4" />)
    const labels = labelOfAllButtons()
    expect(labels.every((l) => l.length > 0)).toBe(true)
    expect(labels).toContain('播放')
    expect(labels).not.toContain('暂停')
    expect(labels).toContain('静音')
    expect(labels).not.toContain('取消静音')
    expect(labels).toEqual(expect.arrayContaining(['快退', '快进', '全屏']))
  })

  it('autoPlay(playing=true)时标签为"暂停";muted 时静音标签翻转为"取消静音"', () => {
    render(<VideoPlayer src="/v.mp4" autoPlay muted />)
    const labels = labelOfAllButtons()
    expect(labels).toContain('暂停')
    expect(labels).not.toContain('播放')
    expect(labels).toContain('取消静音')
    expect(labels).not.toContain('静音')
  })
})

describe('其余媒体组件与复制按钮(渲染依赖过重,退化为源码级判据)', () => {
  const read = (name: string) => readFileSync(resolve(MEDIA_DIR, name), 'utf8')

  it('PDFViewer 四处翻页/缩放均取词 a11y', () => {
    const src = read('PDFViewer.tsx')
    expect(src).toContain("const t = useTranslations('a11y')")
    for (const call of ["t('previous')", "t('next')", "t('zoomOut')", "t('zoomIn')"]) {
      expect(src).toContain(call)
    }
  })

  it('LivePlayer 两态标签(play/pause、mute/unmute)都在源码里出现', () => {
    const src = read('LivePlayer.tsx')
    expect(src).toContain("const t = useTranslations('a11y')")
    expect(src).toContain("{playing ? t('pause') : t('play')}")
    expect(src).toContain("{mutedState ? t('unmute') : t('mute')}")
    expect(src).toContain("t('fullscreen')")
  })

  it('VideoPlayer 源码同样保持两态三元(防有人改回静态标签)', () => {
    const src = read('VideoPlayer.tsx')
    expect(src).toContain("{playing ? t('pause') : t('play')}")
    expect(src).toContain("{mutedState ? t('unmute') : t('mute')}")
  })

  it('UnifiedViewer 全屏钮标签跟随真实全屏态,且下载位也走取词', () => {
    const src = read('UnifiedViewer.tsx')
    expect(src).toContain("const t = useTranslations('a11y')")
    // toggleFullscreen 是真切换 ⇒ 标签必须两态,并跟随 fullscreenchange(用户按 Esc 退出也要回正)
    expect(src).toContain("aria-label={isFullscreen ? t('exitFullscreen') : t('fullscreen')}")
    expect(src).toContain("addEventListener('fullscreenchange'")
    expect(src).toContain("aria-label={t('download')}")
    expect(src).toContain("{t('downloadFile')}")
    // 反向哨兵:这两处原生中文提示位不得回潮
    expect(src).not.toMatch(/content="全屏"/)
    expect(src).not.toMatch(/content="下载"/)
    expect(src).not.toMatch(/>\s*下载文件\s*</)
  })

  it('copy-button 常驻操作不再被 tabIndex={-1} 剥夺键盘可达', () => {
    const src = readFileSync(resolve(MEDIA_DIR, '../ai/progress-sections/copy-button.tsx'), 'utf8')
    expect(src).not.toContain('tabIndex={-1}')
    expect(src).toContain('aria-label={resolvedLabel}')
    expect(src).toContain("const t = useTranslations('ai.pane')")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
