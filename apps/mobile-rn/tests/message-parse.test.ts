// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

  it('识别 [语音] 标记为 audio 段并带时长', () => {
    const segs = parseMessageContent('[语音] https://file.aizhs.top/uploads/abc.m4a 12')
    expect(segs).toEqual([
      { type: 'audio', url: 'https://file.aizhs.top/uploads/abc.m4a', durationSec: 12 },
    ])
  })

  it('语音标记时长缺省按 0', () => {
    const segs = parseMessageContent('听听这段 [语音] https://x.com/a.mp3 再说')
    expect(segs[0]!).toEqual({ type: 'text', text: '听听这段 ' })
    expect(segs[1]!).toEqual({ type: 'audio', url: 'https://x.com/a.mp3', durationSec: 0 })
    expect(segs[2]!).toEqual({ type: 'text', text: ' 再说' })
  })

  it('语音标记支持 mp3/wav/aac 扩展名与查询参数', () => {
    for (const ext of ['mp3', 'wav', 'aac']) {
      const segs = parseMessageContent(`[语音] https://x.com/a.${ext}?t=1 5`)
      expect(segs).toEqual([{ type: 'audio', url: `https://x.com/a.${ext}?t=1`, durationSec: 5 }])
    }
  })

  it('代码块内语音标记不误拆(代码段整体保留)', () => {
    const segs = parseMessageContent('```txt\n[语音] https://x.com/a.m4a 3\n```')
    expect(segs).toHaveLength(1)
    expect(segs[0]!.type).toBe('code')
  })

  it('语音标记与图片 URL 同段时各自成段', () => {
    const segs = parseMessageContent(
      '[语音] https://x.com/a.m4a 8\n看图 https://x.com/b.png 完',
    )
    expect(segs).toHaveLength(4)
    expect(segs[0]!).toEqual({ type: 'audio', url: 'https://x.com/a.m4a', durationSec: 8 })
    expect(segs[1]!).toEqual({ type: 'text', text: '\n看图 ' })
    expect(segs[2]!.type).toBe('image')
    expect(segs[3]!).toEqual({ type: 'text', text: ' 完' })
  })

  it('兼容 CRLF 代码块并保护代码块内图片 URL', () => {
    const segs = parseMessageContent('```py\r\nurl = "https://x.com/a.png"\r\n```')
    expect(segs).toEqual([
      { type: 'code', language: 'py', code: 'url = "https://x.com/a.png"\r\n' },
    ])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
