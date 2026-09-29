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

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { UserMessageBody } from '../message-list/user-message-body'

const IMAGE_LINE = (alt: string, url: string): string => `![${alt}](${url})`
const VIDEO_LINE = (url: string): string => `<video src="${url}" controls></video>`

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

  it('④ 普通文件引用:出胶囊,文本里没有 `> 📎` 字面量', () => {
    const { container } = render(<UserMessageBody content={'正文\n\n> 📎 report.pdf'} />)
    expect(container.textContent).not.toContain('> 📎')
    expect(container.querySelector('[data-testid="user-message-file"]')?.textContent).toBe('report.pdf')
    expect(container.textContent).toContain('正文')
  })

  it('⑤ 正文仍是纯文本 `<p class="whitespace-pre-wrap">`(用户打的 `*` 不被重新解释)', () => {
    const { container } = render(<UserMessageBody content={'这是 *重点* 加一行\n\n> 📎 a.md'} />)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
