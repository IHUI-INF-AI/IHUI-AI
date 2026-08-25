/**
 * ChatScreen 消息富内容解析单测 — 验证 parseMessageContent 的代码块/图片/文本分段。
 * 对齐 Uniapp ai_index2 agent_content_list 结构化 parts 的轻量前端解析。
 */
import { describe, expect, it } from 'vitest'
import { parseMessageContent } from '../src/utils/message-parse'

describe('parseMessageContent 消息富内容解析', () => {
  it('纯文本原样返回 text 段', () => {
    const segs = parseMessageContent('你好,世界')
    expect(segs).toEqual([{ type: 'text', text: '你好,世界' }])
  })

  it('空内容返回空数组', () => {
    expect(parseMessageContent('')).toEqual([])
  })

  it('识别 ``` 代码块并提取语言', () => {
    const segs = parseMessageContent('```ts\nconst a = 1\n```')
    expect(segs).toEqual([{ type: 'code', language: 'ts', code: 'const a = 1' }])
  })

  it('文本 + 代码块混合分段', () => {
    const segs = parseMessageContent('代码如下:\n```js\nlet x = 1\n```\n完')
    expect(segs).toHaveLength(3)
    expect(segs[0]!).toEqual({ type: 'text', text: '代码如下:\n' })
    expect(segs[1]!).toEqual({ type: 'code', language: 'js', code: 'let x = 1' })
    expect(segs[2]!).toEqual({ type: 'text', text: '\n完' })
  })

  it('无语言代码块 language 为空串', () => {
    const segs = parseMessageContent('```\nabc\n```')
    expect(segs[0]!).toEqual({ type: 'code', language: '', code: 'abc' })
  })

  it('识别图片 URL 为 image 段', () => {
    const segs = parseMessageContent('看图: https://file.aizhs.top/a.png 后面')
    expect(segs[0]!).toEqual({ type: 'text', text: '看图: ' })
    expect(segs[1]!).toEqual({ type: 'image', url: 'https://file.aizhs.top/a.png' })
    expect(segs[2]!).toEqual({ type: 'text', text: ' 后面' })
  })

  it('图片 URL 带查询参数可识别', () => {
    const segs = parseMessageContent('https://cdn.example.com/x.jpg?w=100&h=80')
    expect(segs).toEqual([{ type: 'image', url: 'https://cdn.example.com/x.jpg?w=100&h=80' }])
  })

  it('代码块内含图片 URL 不误拆(代码段整体保留)', () => {
    const segs = parseMessageContent('```py\nurl = "https://x.com/a.png"\n```')
    expect(segs).toHaveLength(1)
    expect(segs[0]!.type).toBe('code')
  })

  it('兼容 CRLF 代码块并保护代码块内图片 URL', () => {
    const segs = parseMessageContent('```py\r\nurl = "https://x.com/a.png"\r\n```')
    expect(segs).toEqual([{ type: 'code', language: 'py', code: 'url = "https://x.com/a.png"\r\n' }])
  })
})
