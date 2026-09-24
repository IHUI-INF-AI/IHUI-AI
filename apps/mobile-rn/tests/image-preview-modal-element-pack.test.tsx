// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ImagePreviewModal × element-pack(D64② 接线回归,mobile-rn)
 *
 * 证明四件事(全部经渲染后的 DOM 断言,测的是真相源本身):
 * 1. 多图计数走 imageCounterView(0 基→1 基、命名空间全键、{index,total} 插值);
 * 2. 翻页走 pageImage(wrap 循环:首张点「上一页」到末张);
 * 3. 缩放走 zoomStep 档位钳制(in 到顶 200%、out 到底 50%,不自由取值);
 * 4. 保存/复制成败显式渲染 imageTransferView(含宿主抛错按 failed 呈现),
 *    单图无 sources 时不渲染计数/翻页(现网行为不回退)。
 *
 * 注:'@ihui/shared/chat/element-pack' 在 vitest 经 alias 直指
 * packages/shared/src/chat/element-pack.ts(真实实现,非 mock);
 * react-native mock 把 Pressable 渲染成 <button>,按钮顺序 = 渲染顺序
 * (close, [prev, next], zoomOut, zoomIn, [save, copy])。
 */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

vi.mock('../src/i18n', () => {
  const t = (key: string, values?: Record<string, string | number>) =>
    values ? `${key}:${JSON.stringify(values)}` : key
  return { useI18n: () => ({ t, locale: 'zh-CN', setLocale: async () => {} }) }
})

// active-tokens 顶层依赖原生模块(expo/nativewind),vitest 下加载即抛(esbuild 对 Flow
// 源报 SyntaxError 'typeof');组件只取 tokens.surface.light 一个常量,替身即可。
vi.mock('../src/theme/active-tokens', () => ({
  tokens: { surface: { light: '#f9fafb' } },
}))

import ImagePreviewModal from '../src/components/ImagePreviewModal'
import type { ImageSourcePropType } from 'react-native'
import type { ImageTransferKind, ImageTransferResult } from '@ihui/shared/chat/element-pack'

const NS = 'ai.pane.elementPack'
const SOURCES: ImageSourcePropType[] = [
  { uri: 'https://img.test/a.png' },
  { uri: 'https://img.test/b.png' },
  { uri: 'https://img.test/c.png' },
]

const buttons = (container: HTMLElement) => Array.from(container.querySelectorAll('button'))

describe('ImagePreviewModal 消费 element-pack(mobile-rn)', () => {
  it('多图默认:计数(1 基)与 100% 缩放渲染', () => {
    const { container, getByText } = render(
      <ImagePreviewModal visible source={SOURCES[0]} onClose={() => {}} sources={SOURCES} />,
    )
    expect(getByText(`${NS}.imagePreview.counter:{"index":1,"total":3}`)).toBeTruthy()
    expect(getByText('100%')).toBeTruthy()
    // overlay + close + prev + next + zoomOut + zoomIn = 6
    expect(buttons(container)).toHaveLength(6) // overlay+close+prev+next+zoomOut+zoomIn
  })

  it('翻页走 pageImage:next 前进,首张 prev 循环到末张', () => {
    const { container, getByText } = render(
      <ImagePreviewModal visible source={SOURCES[0]} onClose={() => {}} sources={SOURCES} />,
    )
    const [, , prev, next] = buttons(container)
    fireEvent.click(next!)
    expect(getByText(`${NS}.imagePreview.counter:{"index":2,"total":3}`)).toBeTruthy()
    fireEvent.click(next!)
    expect(getByText(`${NS}.imagePreview.counter:{"index":3,"total":3}`)).toBeTruthy()
    fireEvent.click(prev!)
    expect(getByText(`${NS}.imagePreview.counter:{"index":2,"total":3}`)).toBeTruthy()
    // 回到首张后再 prev → wrap 到末张
    fireEvent.click(prev!)
    fireEvent.click(prev!)
    expect(getByText(`${NS}.imagePreview.counter:{"index":3,"total":3}`)).toBeTruthy()
  })

  it('initialIndex 越界经 pageImage 钳制(99 → 第 3 张)', () => {
    const { getByText } = render(
      <ImagePreviewModal
        visible
        source={SOURCES[0]}
        onClose={() => {}}
        sources={SOURCES}
        initialIndex={99}
      />,
    )
    expect(getByText(`${NS}.imagePreview.counter:{"index":3,"total":3}`)).toBeTruthy()
  })

  it('缩放走 zoomStep 档位:连进到顶 200%,连出到底 50%(钳制不循环)', () => {
    const { container, getByText } = render(
      <ImagePreviewModal visible source={SOURCES[0]} onClose={() => {}} sources={SOURCES} />,
    )
    const [, , , , zoomOut, zoomIn] = buttons(container)
    for (let i = 0; i < 6; i++) fireEvent.click(zoomIn!)
    expect(getByText('200%')).toBeTruthy()
    for (let i = 0; i < 10; i++) fireEvent.click(zoomOut!)
    expect(getByText('50%')).toBeTruthy()
  })

  it('保存/复制成败经 imageTransferView 显式渲染;宿主抛错按 failed 呈现', async () => {
    let mode: 'ok' | 'bad' | 'throw' = 'ok'
    const onTransfer = async (kind: ImageTransferKind): Promise<ImageTransferResult> => {
      if (mode === 'throw') throw new Error('native failed')
      return kind === 'save' && mode === 'bad' ? 'failed' : 'success'
    }
    const { container, findByText } = render(
      <ImagePreviewModal
        visible
        source={SOURCES[0]}
        onClose={() => {}}
        sources={SOURCES}
        onTransfer={onTransfer}
      />,
    )
    const bs = buttons(container)
    const save = bs[6]!
    const copy = bs[7]!
    // close + prev + next + zoomOut + zoomIn + save + copy = 7
    expect(bs).toHaveLength(8) // +overlay,save,copy 共 8
    fireEvent.click(save)
    expect(await findByText(`${NS}.imagePreview.saveSuccess`)).toBeTruthy()
    mode = 'bad'
    fireEvent.click(save)
    expect(await findByText(`${NS}.imagePreview.saveFailed`)).toBeTruthy()
    mode = 'ok'
    fireEvent.click(copy)
    expect(await findByText(`${NS}.imagePreview.copySuccess`)).toBeTruthy()
    mode = 'throw'
    fireEvent.click(copy)
    expect(await findByText(`${NS}.imagePreview.copyFailed`)).toBeTruthy()
  })

  it('单图本地 source(require→number)无计数/翻页/传输,现网行为不变', () => {
    const { container, queryByText } = render(
      <ImagePreviewModal visible source={1} onClose={() => {}} />,
    )
    // overlay + close + zoomOut + zoomIn = 4(单图不渲染翻页/传输,缩放档保留)
    expect(buttons(container)).toHaveLength(4)
    expect(queryByText(`${NS}.imagePreview.counter`)).toBeNull()
    expect(container.textContent).toContain('100%')
  })

  it('onClose 经遮罩点击仍生效', () => {
    const onClose = vi.fn()
    const { container } = render(
      <ImagePreviewModal visible source={SOURCES[0]} onClose={onClose} sources={SOURCES} />,
    )
    fireEvent.click(buttons(container)[0]!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
