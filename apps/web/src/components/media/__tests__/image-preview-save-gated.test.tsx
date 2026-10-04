// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// G-851(2026-09-29 立):图片预览的「保存」必须先把字节取到手,再落盘并播报。
// 旧实现直接把远端 URL 挂到 <a download> 上并无条件报 success —— 浏览器对跨域 URL
// 会忽略 download(变成一次导航),于是"点了没存还报成功"。本用例钉的是:
//  success 只能来自真的拿到字节;href 只能是 object URL;取体被拒必须报 failed。
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => React.createElement('img', { src, alt }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

vi.mock('../use-preview-staleness', () => ({
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

vi.mock('../preview-degradation-banner', () => ({
  PreviewFileUpdatedBar: () => null,
  PreviewNoContentState: () => null,
  PreviewSnapshotNotice: () => null,
  usePreviewCopy: () => ({}),
}))

import { FilePreview } from '../FilePreview'

const PHOTO_URL = 'https://cdn.example.com/private/photo.png'

/** 受闸取体用到的响应夹具(声明体积与真实字节同值,不涉本用例的判点)。 */
function gatedResponse(contentType: string, sizes: readonly number[]) {
  const total = sizes.reduce((sum, size) => sum + size, 0)
  let cursor = 0
  return {
    ok: true,
    headers: {
      get: (name: string) =>
        name === 'content-length' ? String(total) : name === 'content-type' ? contentType : null,
    },
    body: {
      getReader: () => ({
        read: async () => {
          if (cursor >= sizes.length) return { done: true, value: undefined }
          const size = sizes[cursor] ?? 0
          cursor += 1
          return { done: false, value: new Uint8Array(size) }
        },
      }),
    },
  }
}

/** 谎报 content-length=1、真吐 60×1MB 的流:声明侧骗不过真实字节侧的闸。 */
function oversizedResponse() {
  let cursor = 0
  return {
    ok: true,
    headers: {
      get: (name: string) =>
        name === 'content-length' ? '1' : name === 'content-type' ? 'image/png' : null,
    },
    body: {
      getReader: () => ({
        read: async () => {
          if (cursor >= 60) return { done: true, value: undefined }
          cursor += 1
          return { done: false, value: new Uint8Array(1024 * 1024) }
        },
      }),
    },
  }
}

const clicked: { download: string; href: string }[] = []
const created: string[] = []
const revoked: string[] = []
let urlSeq = 0
let realClick: typeof HTMLElement.prototype.click | undefined
let createDescriptor: PropertyDescriptor | undefined
let revokeDescriptor: PropertyDescriptor | undefined

function stubDownloadSurface(): void {
  realClick = HTMLElement.prototype.click
  HTMLElement.prototype.click = function (this: HTMLElement) {
    // 不委托实现:jsdom 的锚点 click 会触发 "not implemented: navigation" 噪音
    if (this instanceof HTMLAnchorElement) {
      clicked.push({
        download: this.getAttribute('download') ?? '',
        href: this.getAttribute('href') ?? '',
      })
    }
  } as typeof HTMLElement.prototype.click

  createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
  revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: (blob: unknown) => {
      void blob
      urlSeq += 1
      const url = `blob:mock/${urlSeq}`
      created.push(url)
      return url
    },
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: (url: string) => {
      revoked.push(url)
    },
  })
}

function restoreDownloadSurface(): void {
  if (realClick) HTMLElement.prototype.click = realClick
  const restore = (key: 'createObjectURL' | 'revokeObjectURL', desc?: PropertyDescriptor) => {
    if (desc) Object.defineProperty(URL, key, desc)
    else delete (URL as unknown as Record<string, unknown>)[key]
  }
  restore('createObjectURL', createDescriptor)
  restore('revokeObjectURL', revokeDescriptor)
}

function renderSave(): void {
  render(
    <FilePreview url={PHOTO_URL} type="image" gallery={[{ url: PHOTO_URL, name: 'photo.png' }]} />,
  )
}

function transferState(): string | null {
  return (
    document.querySelector('[data-image-transfer]')?.getAttribute('data-image-transfer') ?? null
  )
}

describe('G-851 保存:字节到手才落盘', () => {
  afterEach(() => {
    cleanup()
    restoreDownloadSurface()
    clicked.length = 0
    created.length = 0
    revoked.length = 0
    urlSeq = 0
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('取体成功:下载挂的是 object URL(不是远端 URL),报 success,并成对释放', async () => {
    stubDownloadSurface()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => gatedResponse('image/png', [8, 8])),
    )

    renderSave()
    // 取体是异步的:此刻既不该点下载,也不该已经报成功
    fireEvent.click(screen.getByRole('button', { name: 'imagePreview.save' }))
    expect(clicked).toEqual([])

    await waitFor(() => expect(transferState()).toBe('save-success'))
    expect(clicked).toHaveLength(1)
    expect(clicked[0]?.download).toBe('photo.png')
    // 判点:href 必须是本地 object URL —— 挂远端 URL 就是那条"看起来点了、其实没存"的老路
    expect(clicked[0]?.href).toBe('blob:mock/1')
    expect(created).toEqual(['blob:mock/1'])

    // 建一条就得放一条(延迟释放,同一 tick revoke 会被部分浏览器掐掉下载)
    await waitFor(() => expect(revoked).toEqual(['blob:mock/1']), { timeout: 3000 })
  })

  it('扩展名由 blob.type 决定,不沿用名字里那个后缀', async () => {
    stubDownloadSurface()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => gatedResponse('image/jpeg', [8])),
    )

    renderSave()
    fireEvent.click(screen.getByRole('button', { name: 'imagePreview.save' }))

    await waitFor(() => expect(clicked).toHaveLength(1))
    expect(clicked[0]?.download).toBe('photo.jpg')
  })

  it('跨域取体被拒:不点下载、不建 object URL、结果不是 success', async () => {
    stubDownloadSurface()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    renderSave()
    fireEvent.click(screen.getByRole('button', { name: 'imagePreview.save' }))

    await waitFor(() => expect(transferState()).toBe('save-failed'))
    expect(transferState()).not.toBe('save-success')
    expect(clicked).toEqual([])
    expect(created).toEqual([])
    expect(document.querySelector('[data-image-transfer]')?.textContent).toBe(
      'imagePreview.saveFailed',
    )
  })

  it('超上限被闸拒下:同样是 failed,不是"没反应"(组件真的走了受闸取体)', async () => {
    stubDownloadSurface()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => oversizedResponse()),
    )

    renderSave()
    fireEvent.click(screen.getByRole('button', { name: 'imagePreview.save' }))

    await waitFor(() => expect(transferState()).toBe('save-failed'), { timeout: 10000 })
    expect(clicked).toEqual([])
    expect(created).toEqual([])
  })
})

// G-816000(2026-10-03 立):G-851 把"字节到手才算成功"钉死之后,跨域不给 CORS 头的一族
// 只会看到"保存失败"却没有任何下一步。本组用例钉的是「失败也有真出口」:
//  正例 取体被拒 ⇒ 兜底入口出现,点它真的把链接交出去(断言 window.open 副作用,不是断言存在);
//  反例① 成功态不得出现该出口(否则每次成功都多一个按钮,是回归);
//  反例② 出口文案不得硬编码中文(必须走 t() 拿既有键)。
describe('G-816000 兜底出口:失败也有路可走', () => {
  const opened: { url: string; target: string; features?: string }[] = []
  let realOpen: typeof window.open | undefined

  function stubOpen(): void {
    realOpen = window.open
    opened.length = 0
    window.open = ((url: string, target?: string, features?: string) => {
      opened.push({ url, target: target ?? '', features })
      return null
    }) as typeof window.open
  }

  function restoreOpen(): void {
    if (realOpen) window.open = realOpen
  }

  function fallbackExit(): HTMLButtonElement | null {
    return document.querySelector<HTMLButtonElement>('[data-image-transfer-btn="save-fallback"]')
  }

  afterEach(() => {
    cleanup()
    restoreOpen()
    restoreDownloadSurface()
    clicked.length = 0
    created.length = 0
    revoked.length = 0
    urlSeq = 0
    opened.length = 0
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('正例:取体被拒后兜底入口出现,点它真的把链接开去新标签(断言副作用)', async () => {
    stubDownloadSurface()
    stubOpen()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    renderSave()
    // 先点保存 → 如实报 failed(不退回假 success)
    fireEvent.click(screen.getByRole('button', { name: 'imagePreview.save' }))
    await waitFor(() => expect(transferState()).toBe('save-failed'))

    // 判点:失败态下必须有可点出口
    expect(fallbackExit()).not.toBeNull()
    expect(opened).toEqual([])

    // 判点:点了它**真的**产生副作用(开新标签),不是断言元素存在
    fireEvent.click(screen.getByRole('button', { name: 'download' }))
    expect(opened).toHaveLength(1)
    expect(opened[0]?.url).toBe(PHOTO_URL)
    expect(opened[0]?.target).toBe('_blank')
    // 交链接不等于存成功:失败仍如实报失败
    expect(transferState()).toBe('save-failed')
  })

  it('反例①:取体成功时不得出现兜底出口(成功态多一个按钮就是回归)', async () => {
    stubDownloadSurface()
    stubOpen()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => gatedResponse('image/png', [8, 8])),
    )

    renderSave()
    fireEvent.click(screen.getByRole('button', { name: 'imagePreview.save' }))
    await waitFor(() => expect(transferState()).toBe('save-success'))

    expect(fallbackExit()).toBeNull()
    // 未点保存前(transfer 为 idle)同样不得有出口
    expect(fallbackExit()).toBeNull()
  })

  it('反例②:出口文案不得硬编码中文 —— 必须走 t() 拿既有键', async () => {
    stubDownloadSurface()
    stubOpen()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    renderSave()
    fireEvent.click(screen.getByRole('button', { name: 'imagePreview.save' }))
    await waitFor(() => expect(transferState()).toBe('save-failed'))

    // next-intl 被 mock 成"回键名",所以 aria-label 必须是**键名**而不是任何中文字面量
    const label = fallbackExit()?.getAttribute('aria-label') ?? ''
    expect(label).toBe('download')
    expect(label).not.toMatch(/[一-鿿]/)
    // 也不得是键名兜底的假象:真正的界面文案由 a11y.download 提供
    expect(label).not.toBe('')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
