// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D129 组件层验收:用户气泡里不再出现被拍平的附件**源码**,四类附件都不许静默消失。
//
// 两条防自伤的写法约定:
//  ① 每条用例只查**自己的 container** —— RTL 共用 document.body 时,上一条留下的 <video> 会让
//     下一条"应当没有 video 元素"的断言假红(第一版就是这么红了 4 条)。
//  ② 边界锁(2026-10-01 S15 随 V4 #87 拍板翻转):用户正文**必须**走与助手侧同一套 MarkdownStream,
//     且该渲染器**不得挂 rehype-raw** —— 锁在渲染器源码上,用户/助手两侧共用,锁一处锁两侧;
//     被拒行(协议不安全/判不出)由共享层摘进 `rejectedLines`、组件按字面渲染,不许就地猜。
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

  it('⑤ 正文走与助手侧同一套 MarkdownStream(2026-10-01 拍板翻转:`*` 与助手侧同保真地解释为强调)', () => {
    const { container } = render(<UserMessageBody content={EMPHASIS_WITH_REF} />)
    // 与助手侧同渲染器 ⇒ 用户写的 markdown 同样生效(强调),这正是拍板要的"同一屏一种保真度"
    expect(container.querySelector('em')?.textContent).toBe('重点')
    // 危险项关闭:裸 HTML 永远不出元素(该渲染器不挂 rehype-raw,由边界锁用例钉在源码层)
    expect(container.querySelector('video')).toBeNull()
  })

  it('⑥ 协议不安全的形态:字面可见(不进 markdown、不被静默丢弃)+ rejected 记号', () => {
    const evil = VIDEO_LINE('javascript:alert(1)')
    const { container } = render(<UserMessageBody content={`正文\n\n${evil}`} />)
    expect(container.querySelector('[data-testid="user-message-attachment-rejected"]')?.textContent).toBe('1')
    // 字面渲染块:react-markdown 会把裸 HTML 静默丢掉,所以共享层把被拒行摘进 rejectedLines,
    // 由组件按字面显示 —— 原文照样看得见(2026-10-01 起,可见性由这条通道兑现)
    const rejected = container.querySelector('[data-testid="user-message-rejected"]')
    expect(rejected?.textContent).toBe(evil)
    expect(container.textContent).toContain('javascript:alert(1)')
    expect(container.querySelector('video')).toBeNull()
  })

  it('⑦ 用户正文里讨论这些写法的散文:不命中确切形态(不被摘),随正文走同一渲染件(裸 HTML 片段与助手侧同行为)', () => {
    const prose = `请按 ${VIDEO_LINE('x')} 这个写法改代码`
    const { container } = render(<UserMessageBody content={prose} />)
    // 永远不出元素
    expect(container.querySelector('video')).toBeNull()
    // 散文没有被摘走(不命中整行确切形态):文字骨架还在,只是经过了与助手侧相同的 markdown 渲染
    expect(container.textContent).toContain('请按')
    expect(container.textContent).toContain('这个写法改代码')
    expect(container.querySelector('[data-testid="user-message-rejected"]')).toBeNull()
  })
})

describe('D129 边界锁:用户气泡走助手侧同一渲染件,但危险项必须关着', () => {
  it('组件源码必须 import MarkdownStream(与助手侧同一渲染件,2026-10-01 拍板),且仍走共享拆分出口', () => {
    const src = readFileSync(
      join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'message-list', 'user-message-body.tsx'),
      'utf8',
    )
    expect(src).toMatch(/MarkdownStream/)
    // 附件拆分只有一份实现:组件必须走共享出口,不在端内再解一遍正则
    expect(src).toMatch(/splitUserMessageParts/)
    // 被拒行必须来自共享层的新通道,不许组件就地猜
    expect(src).toMatch(/rejectedLines/)
    expect(src).not.toMatch(/!\[\\\[|<video src=/)
  })

  it('渲染器源码不得挂 rehype-raw(危险项关闭的唯一判据 —— 用户与助手两侧共用,锁一处锁两侧)', () => {
    const rendererSrc = readFileSync(
      join(here, '..', '..', 'ai', 'markdown-stream.tsx'),
      'utf8',
    )
    expect(rendererSrc).not.toMatch(/rehype-raw|rehypeRaw/)
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

describe('D129 追加:引用回复块不再以 Markdown 源码示人', () => {
  const QUOTE_FIXTURE = ['我的新问题', '', '> 💬 用户:', '> 上一轮的原话', '> 第二行'].join('\n')

  it('引用块被摘成结构化卡片,正文里不再有 `> 💬` 字面量', () => {
    cleanup()
    const { container } = render(<UserMessageBody content={QUOTE_FIXTURE} />)
    const bq = container.querySelector('[data-testid="user-message-quote"]')
    expect(bq).not.toBeNull()
    expect(bq?.textContent).toContain('上一轮的原话')
    expect(container.textContent).not.toContain('> 💬')
    expect(container.querySelector('p')?.textContent).toBe('我的新问题')
  })

  it('引用块与附件行同时存在时各归各位(不互相吞)', () => {
    cleanup()
    const { container } = render(<UserMessageBody content={[QUOTE_FIXTURE, '', '> \u{1F4CE} a.md'].join('\n')} />)
    expect(container.querySelector('[data-testid="user-message-quote"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="user-message-file"]')?.textContent).toBe('a.md')
    expect(container.textContent).not.toContain('> \u{1F4CE}')
  })
})
