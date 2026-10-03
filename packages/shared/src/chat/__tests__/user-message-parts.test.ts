// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D129 纯函数层:从用户正文里拆出被拍平的附件。
// 判据形状逐条取自**发送侧真实产出的形态**(`apps/web/src/hooks/use-message-send.ts` 的 `doSend`),
// 不是照我想象的四段文本造夹具 —— 那边改了形态,这一组用例必须同时改(否则用户又会看见源码)。
import { describe, expect, it } from 'vitest'

import { safeMediaUrl, splitUserMessageParts } from '../user-message-parts'

const IMAGE_LINE = (alt: string, url: string): string => `![${alt}](${url})`
const VIDEO_LINE = (url: string): string => `<video src="${url}" controls></video>`

describe('safeMediaUrl:协议白名单', () => {
  it('放行 blob / 同源绝对路径 / http(s)', () => {
    expect(safeMediaUrl('blob:https://aizhs.top/7c2f')).toBe('blob:https://aizhs.top/7c2f')
    expect(safeMediaUrl('/uploads/clip.mp4')).toBe('/uploads/clip.mp4')
    expect(safeMediaUrl('https://cdn.aizhs.top/a.webm')).toBe('https://cdn.aizhs.top/a.webm')
  })
  it('拒绝 javascript: / data: / 其它协议与空串', () => {
    expect(safeMediaUrl('javascript:alert(1)')).toBeNull()
    expect(safeMediaUrl('data:video/mp4;base64,AAAA')).toBeNull()
    expect(safeMediaUrl('vbscript:x')).toBeNull()
    expect(safeMediaUrl('   ')).toBeNull()
  })
})

describe('splitUserMessageParts:四类形态', () => {
  it('① 图片行摘成 {alt,url},正文里不再残留 `![`', () => {
    const r = splitUserMessageParts(`看这张\n\n${IMAGE_LINE('photo.png', '/uploads/photo.png')}`)
    expect(r.images).toEqual([{ alt: 'photo.png', url: '/uploads/photo.png' }])
    expect(r.text).toBe('看这张')
    expect(r.rejected).toBe(0)
  })

  it('② 视频行摘成 URL', () => {
    const r = splitUserMessageParts(`我录了一段\n\n${VIDEO_LINE('/uploads/clip.mp4')}\n\n后面还有话`)
    expect(r.videos).toEqual(['/uploads/clip.mp4'])
    expect(r.text).toContain('我录了一段')
    expect(r.text).toContain('后面还有话')
    expect(r.text).not.toContain('<video')
  })

  it('③ 配对 fenced block 摘成代码正文(不含围栏)', () => {
    const r = splitUserMessageParts('前\n\n```\nline1\nline2\n```\n\n后')
    expect(r.codeBlocks).toEqual(['line1\nline2'])
    expect(r.text).toBe('前\n\n后')
  })

  it('④ `> 📎 label` 摘成标签', () => {
    const r = splitUserMessageParts('正文\n\n> 📎 report.pdf')
    expect(r.fileRefs).toEqual(['report.pdf'])
    expect(r.text).toBe('正文')
  })

  it('多附件按出现顺序全摘,不会只剩第一个', () => {
    const r = splitUserMessageParts(
      `${IMAGE_LINE('a.png', '/a.png')}\n${VIDEO_LINE('/v.mp4')}\n中间\n${VIDEO_LINE('blob:https://x/y')}\n> 📎 z.zip`,
    )
    expect(r.images.map((x) => x.url)).toEqual(['/a.png'])
    expect(r.videos).toEqual(['/v.mp4', 'blob:https://x/y'])
    expect(r.fileRefs).toEqual(['z.zip'])
    expect(r.text).toContain('中间')
  })
})

describe('splitUserMessageParts:判不出/不安全一律不摘(绝不静默消失)', () => {
  it('不安全的视频行 ⇒ 不摘、可见,计 rejected;含裸括号的不安全"图片样式"行**连形态都不算命中**(不猜)', () => {
    const evilImg = IMAGE_LINE('x.png', 'javascript:alert(1)')
    const evilVid = VIDEO_LINE('data:video/mp4;base64,AAAA')
    const r = splitUserMessageParts(`正文\n\n${evilImg}\n${evilVid}`)
    expect(r.images).toEqual([])
    expect(r.videos).toEqual([])
    // 两条都必须**原样留在屏幕上**——这是本用例真正的判据,rejected 只是附属计数。
    expect(r.text).toContain(evilImg)
    // D129 起:确凿命中但不安全的行走 rejectedLines 字面渲染通道(不再混在 text 里)
    expect(r.rejectedLines).toEqual([evilVid])
    // `![a](javascript:alert(1))` 的 URL 里带未转义的 `)`,按 markdown 语法本身就是歧义形态;
    // 发送侧产出的 URL 不会长成这样 ⇒ 这里**刻意不猜**它是图片,当普通文本处理(所以 rejected=1,
    // 只统计那条确凿命中却不安全的 video 行)。放宽正则去吞歧义形态,等于替用户改稿。
    expect(r.rejected).toBe(1)
  })

  it('不配对的围栏不猜结尾:原样保留 + rejected 记一笔', () => {
    const r = splitUserMessageParts('```\n没有收尾的粘贴')
    expect(r.codeBlocks).toEqual([])
    expect(r.rejected).toBe(1)
    expect(r.rejectedLines).toEqual(['```'])
  })

  it('空标签的 `> 📎` 行不摘(没有可显示的名字,宁可原样可见)', () => {
    const r = splitUserMessageParts('> 📎   ')
    expect(r.fileRefs).toEqual([])
    expect(r.rejected).toBe(1)
    expect(r.rejectedLines).toEqual(['> 📎   '])
  })

  it('用户正文里"讨论这些写法"的散文一律不动(只认整行的确切形态)', () => {
    const prose = `请按 ${VIDEO_LINE('x')} 这个写法改代码,还有 ${IMAGE_LINE('alt', 'url')} 也要`
    const r = splitUserMessageParts(prose)
    expect(r.videos).toEqual([])
    expect(r.images).toEqual([])
    expect(r.text).toBe(prose)
  })

  it('摘走行才收敛空行;用户自己写的空行不得被压掉', () => {
    expect(splitUserMessageParts(`A\n\n${VIDEO_LINE('/v.mp4')}\n\nB`).text).toBe('A\n\nB')
    const userGap = 'A\n\n\nB'
    expect(splitUserMessageParts(userGap).text).toBe(userGap)
  })

  it('只有附件、没有正文:text 为空数组化(组件侧要留锚点,不得整块空着)', () => {
    const r = splitUserMessageParts(VIDEO_LINE('/v.mp4'))
    expect(r.text.trim()).toBe('')
    expect(r.videos).toEqual(['/v.mp4'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

describe('splitUserMessageParts:引用回复块(D22 拍平形态)', () => {
  it('起始行 + 连续 `> ` 行被整块摘出,正文里不再有 `> 💬` 源码', () => {
    const content = '我的新问题\n\n> 💬 用户:\n> 上一轮的原话第一行\n> 第二行'
    const r = splitUserMessageParts(content)
    expect(r.quote?.label).toBe('用户')
    expect(r.quote?.lines).toEqual(['上一轮的原话第一行', '第二行'])
    expect(r.text).toBe('我的新问题')
    expect(r.text).not.toContain('> 💬')
  })

  it('引用块**不吞**附件引用行 `> 📎`(两种语义不得互相伪装)', () => {
    const r = splitUserMessageParts('> 💬 助手:\n> 回答\n\n> 📎 report.pdf')
    expect(r.quote?.lines).toEqual(['回答'])
    expect(r.fileRefs).toEqual(['report.pdf'])
  })

  it('两个相邻引用块分成两块(不跨起始行合并)', () => {
    const r = splitUserMessageParts('> 💬 用户:\n> a\n> 💬 助手:\n> b')
    expect(r.quote?.label).toBe('用户')
    // 第二块不在本次结构里(一条消息只会有一个引用),但**必须可见**而不是被吞掉
    expect(r.text).toContain('> 💬 助手:')
    expect(r.rejected).toBe(0)
  })

  it('空标签的起始行仍归入引用(label 兜底为「引用」),不静默丢内容', () => {
    const r = splitUserMessageParts('> 💬 :\n> 内容')
    expect(r.quote?.label).toBe('引用')
    expect(r.quote?.lines).toEqual(['内容'])
  })

  it('没有引用块时 quote 为 undefined(而不是空对象冒充分支)', () => {
    expect(splitUserMessageParts('只有正文').quote).toBeUndefined()
  })
})