// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { elementPackKey, imageTransferView } from '@ihui/shared/chat/element-pack'

const previewImage = vi.fn()
const saveImageToPhotosAlbum = vi.fn()
const setClipboardData = vi.fn()

vi.mock('@tarojs/taro', () => ({
  default: {
    previewImage: (...args: unknown[]) => previewImage(...args),
    saveImageToPhotosAlbum: (...args: unknown[]) => saveImageToPhotosAlbum(...args),
    setClipboardData: (...args: unknown[]) => setClipboardData(...args),
  },
}))

const {
  taroPreviewChatImages,
  taroChatImageCounterText,
  taroSaveChatImageToAlbum,
  taroCopyChatImageSource,
} = await import('@/lib/image-preview-pack')

beforeEach(() => {
  previewImage.mockReset()
  saveImageToPhotosAlbum.mockReset()
  setClipboardData.mockReset()
})

describe('taroPreviewChatImages — 原生预览器入口的防御', () => {
  it('空列表不唤端(共享判定层之外唯一的端内职责:不传非法入参给原生 API)', () => {
    expect(taroPreviewChatImages('', [])).toBe(false)
    expect(previewImage).not.toHaveBeenCalled()
  })

  it('剔除空串后仍有图才唤端,并把 current 原样交给原生预览器', () => {
    expect(taroPreviewChatImages('b.png', ['a.png', '', 'b.png'])).toBe(true)
    expect(previewImage).toHaveBeenCalledWith({ current: 'b.png', urls: ['a.png', 'b.png'] })
  })
})

describe('taroChatImageCounterText — 计数判定必须来自共享层', () => {
  it('键名唯一出口是 elementPackKey(端内不得自立文案键,否则即第二份真相)', () => {
    const t = vi.fn((key: string) => `«${key}»`)
    expect(taroChatImageCounterText(0, 3, t)).toBe(`«${elementPackKey('imagePreview.counter')}»`)
    expect(t).toHaveBeenCalledWith(elementPackKey('imagePreview.counter'), { index: 1, total: 3 })
  })

  it('越界索引按共享层钳制口径展示(0 基入参 → 1 基展示)', () => {
    const t = vi.fn((_key: string, vars?: Record<string, string | number>) => `${vars?.index}`)
    void taroChatImageCounterText(99, 4, t)
    expect(t).toHaveBeenLastCalledWith(elementPackKey('imagePreview.counter'), {
      index: 4,
      total: 4,
    })
  })

  it('total 非法 → null,渲染层不挂载计数节点', () => {
    expect(taroChatImageCounterText(0, 0, () => '')).toBeNull()
  })
})

describe('taroSaveChatImageToAlbum — 保存成败两态都显式', () => {
  it('resolve 即成功,键取共享层 imageTransferView(save,success)', async () => {
    saveImageToPhotosAlbum.mockResolvedValue({ errMsg: 'saveImageToPhotosAlbum:ok' })
    const out = await taroSaveChatImageToAlbum('/tmp/a.png')
    expect(out).toEqual({
      kind: 'save',
      result: 'success',
      labelKey: elementPackKey(imageTransferView('save', 'success')),
    })
  })

  it('reject 判失败(不得静默吞)', async () => {
    saveImageToPhotosAlbum.mockRejectedValue(new Error('auth denied'))
    const out = await taroSaveChatImageToAlbum('/tmp/a.png')
    expect(out.result).toBe('failed')
    expect(out.labelKey).toBe(elementPackKey(imageTransferView('save', 'failed')))
  })

  it('resolve 但 errMsg 含 fail(授权被拒形态)同样判失败', async () => {
    saveImageToPhotosAlbum.mockResolvedValue({ errMsg: 'saveImageToPhotosAlbum:fail auth deny' })
    expect((await taroSaveChatImageToAlbum('/tmp/a.png')).result).toBe('failed')
  })

  it('空 filePath 不唤端,直接判失败', async () => {
    expect((await taroSaveChatImageToAlbum('')).result).toBe('failed')
    expect(saveImageToPhotosAlbum).not.toHaveBeenCalled()
  })
})

describe('taroCopyChatImageSource — 本端「复制」落到图片地址', () => {
  it('成功路径写地址并回 copySuccess 键', async () => {
    setClipboardData.mockResolvedValue({ errMsg: 'setClipboardData:ok' })
    const out = await taroCopyChatImageSource('https://cdn/a.png')
    expect(setClipboardData).toHaveBeenCalledWith({ data: 'https://cdn/a.png' })
    expect(out.kind).toBe('copy')
    expect(out.result).toBe('success')
  })

  it('reject 回 copyFailed 键(与 web 同一判定出口)', async () => {
    setClipboardData.mockRejectedValue(new Error('fail'))
    const out = await taroCopyChatImageSource('https://cdn/a.png')
    expect(out.labelKey).toBe(elementPackKey(imageTransferView('copy', 'failed')))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
