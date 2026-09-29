// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D129 组件层验收:用户气泡里不再出现被拍平的附件**源码**,四类附件都不许静默消失。
//
// 两条防自伤的写法约定:
//  ① 每条用例只查**自己的 container** —— RTL 共用 document.body 时,上一条留下的 <video> 会让
//     下一条"应当没有 video 元素"的断言假红(第一版就是这么红了 4 条)。
//  ② 最后一条是**源码级边界锁**:本组件不得 import 任何 markdown 渲染器。理由不是审美 ——
//     已入库的 G-825「消息级 markdown 边界」靠"用户正文不进 markdown"这条负例撑着,
//     而"把正文塞回 markdown 让它顺便好看一点"看起来永远是进步,只有这条锁会在有人这么做时响。
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { UserMessageBody } from '../message-list/user-message-body'

const openPanel = vi.fn()
/** 本文件所在目录:源码级锁要按它算相对路径(不靠 cwd —— 守门 70 的镜像测试就死在靠 cwd 上)。 */
const here = dirname(fileURLToPath(import.meta.url))
// 只桩 store 的 getState:点开行为本身(外链 vs 面板)由被测出口决定,桩到 store 这一层
// 才能既验证"传了哪一档 source",又让 window.open 分支保持真逻辑。
vi.mock('@/stores/work-panel', () => ({
  useWorkPanelStore: { getState: () => ({ openPanel }) },
}))

const IMAGE_LINE = (alt: string, url: string): string => `![${alt}](${url})`
const VIDEO_LINE = (url: string): string => `<video src="${url}" controls></video>`
/**
 * 发送侧那条"引用行"前缀(emoji 是**数据**不是图标)。放在模块常量里而不是 JSX 属性里,
 * 是为了不与守门 11h「UI 图标位禁用 emoji」互相顶:它拦的是界面拿 emoji 当图标,
 * 而这里判的是"用户正文里的那一行不该被原样渲染出来"。
 */
const FILE_REF_PREFIX = '> \u{1F4CE}'
const FILE_REF_FIXTURE = `正文\n\n${FILE_REF_PREFIX} report.pdf`
const EMPHASIS_WITH_REF = `这是 *重点* 加一行\n\n${FILE_REF_PREFIX} a.md`

describe('D129 用户气泡:四类拍平形态都不显示成源码', () => {
  afterEach(() => cleanup())

  it('① 图片:出真实 <img>(alt 保留),正文里不再出现 `![`', () => {
    const { container } = render(<UserMessageBody content={`看这张\n\n${IMAGE_LINE('photo.png', '/uploads/photo.png')}`} />)
    expect(container.textContent).not.toContain('![')
    const img = container.querySelector('[data-testid="user-message-image"]')
    expect(img?.getAttribute('src')).toBe('/uploads/photo.png')
    expect(img?.getAttribute('alt')).toBe('photo.png')
    expect(container.querySelector('video')).toBeNull()
  })

  it('② 视频:出带 controls 的 <video>,屏幕上看不到裸 HTML', () => {
    const { container } = render(<UserMessageBody content={`我录了一段\n\n${VIDEO_LINE('/uploads/clip.mp4')}`} />)
    const v = container.querySelector('[data-testid="user-message-video"]')
    expect(v?.tagName).toBe('VIDEO')
    expect(v?.getAttribute('src')).toBe('/uploads/clip.mp4')
    expect(v?.hasAttribute('controls')).toBe(true)
    expect(container.textContent).not.toContain('<video')
  })

  it('③ 超长粘贴:出代码块,文本里没有三反引号', () => {
    const { container } = render(<UserMessageBody content={'```\nsome pasted text\n```'} />)
    expect(container.textContent).not.toContain('```')
    expect(container.textContent).toContain('some pasted text')
    expect(container.querySelector('[data-testid="user-message-code"]')).not.toBeNull()
  })

  it('④ 普通文件引用:出胶囊,文本里没有那个"引用行前缀"字面量', () => {
    // 前缀常量放在**这里**而不是 JSX 属性里:守门 11h 判的是"UI 图标位用 emoji",
    // 而这一串是复现发送侧拍平形态的数据 —— 写成 JSX 字面量会被当成图标位,判据没错,是我放错了位置。
    const { container } = render(<UserMessageBody content={FILE_REF_FIXTURE} />)
    expect(container.textContent).not.toContain(FILE_REF_PREFIX)
    expect(container.querySelector('[data-testid="user-message-file"]')?.textContent).toBe('report.pdf')
    expect(container.textContent).toContain('正文')
  })

  it('⑤ 正文仍是纯文本 `<p class="whitespace-pre-wrap">`(用户打的 `*` 不被重新解释)', () => {
    const { container } = render(<UserMessageBody content={EMPHASIS_WITH_REF} />)
    const p = container.querySelector('p')
    expect(p).not.toBeNull()
    expect(p?.getAttribute('class') ?? '').toContain('whitespace-pre-wrap')
    expect(p?.textContent).toContain('这是 *重点* 加一行')
    expect(container.querySelector('em')).toBeNull()
  })

  it('⑥ 协议不安全的形态:原文留在屏幕上 + rejected 记号(绝不静默消失)', () => {
    const evil = VIDEO_LINE('javascript:alert(1)')
    const { container } = render(<UserMessageBody content={`正文\n\n${evil}`} />)
    expect(container.querySelector('[data-testid="user-message-attachment-rejected"]')?.textContent).toBe('1')
    expect(container.textContent).toContain('javascript:alert(1)')
    expect(container.querySelector('video')).toBeNull()
  })

  it('⑦ 用户正文里讨论这些写法的散文一字不改', () => {
    const prose = `请按 ${VIDEO_LINE('x')} 这个写法改代码`
    const { container } = render(<UserMessageBody content={prose} />)
    expect(container.querySelector('video')).toBeNull()
    expect(container.querySelector('p')?.textContent).toBe(prose)
  })
})

describe('D129 边界锁:用户气泡不得走 markdown 渲染器', () => {
  it('组件源码里不得 import markdown 渲染器(G-825 的用户侧边界)', () => {
    const src = readFileSync(
      join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'message-list', 'user-message-body.tsx'),
      'utf8',
    )
    expect(src).not.toMatch(/markdown-stream|MarkdownStream/)
    // 附件拆分只有一份实现:组件必须走共享出口,不在端内再解一遍正则
    expect(src).toMatch(/splitUserMessageParts/)
    expect(src).not.toMatch(/!\[\\\[|<video src=/)
  })
})

describe('D129 用户自己上传的图可点开(与助手侧共用一个出口)', () => {
  afterEach(() => {
    cleanup()
    openPanel.mockClear()
    vi.restoreAllMocks()
  })

  it('同源路径的图片:点击交给工作面板,并带上自己的来源档(不冒充 markdown-image)', () => {
    const { container } = render(<UserMessageBody content={IMAGE_LINE('photo.png', '/uploads/photo.png')} />)
    const btn = container.querySelector('[data-testid="user-message-image-button"]')
    expect(btn).not.toBeNull()
    fireEvent.click(btn as HTMLElement)
    expect(openPanel).toHaveBeenCalledWith({ url: '/uploads/photo.png', source: 'user-attachment-image' })
  })

  it('外链图片:开新窗口并带 noopener,不进面板(跨站内容嵌进同域面板会带来鉴权与 CSP 问题)', () => {
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { container } = render(<UserMessageBody content={IMAGE_LINE('a.png', 'https://cdn.example.com/a.png')} />)
    fireEvent.click(container.querySelector('[data-testid="user-message-image-button"]') as HTMLElement)
    expect(spy).toHaveBeenCalledTimes(1)
    const firstCall = spy.mock.calls[0]
    expect(firstCall, 'window.open 应至少有一次调用记录').toBeDefined()
    expect(firstCall?.[0]).toBe('https://cdn.example.com/a.png')
    expect(String(firstCall?.[2])).toContain('noopener')
    expect(openPanel).not.toHaveBeenCalled()
  })

  it('助手侧也走同一个出口:该文件必须 import openImageSource,不再内联判断外链', () => {
    const src = readFileSync(join(here, '..', '..', 'ai', 'markdown-stream.tsx'), 'utf8')
    expect(src).toMatch(/openImageSource\(/)
    // MarkdownImage 那一段不得再留 `window.open(srcStr` 的内联判断(留着的下一份就会与这里漂开)
    expect(src).not.toMatch(/window\.open\(srcStr/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
