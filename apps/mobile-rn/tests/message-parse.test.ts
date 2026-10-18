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

  // 反向锁(2026-10-18):语音标记那侧是**真修过一格的** —— `VOICE_MARKER_RE` 带 `gi`,
  // 旧写法对切过的短串继续 exec,lastIndex 错位 ⇒ 第二个语音标记被整段跳过(只出第一条)。
  // 下面第 1 条是那个修复的变异自证:把 message-parse.ts 的游标法换回切串法,它当场翻红。
  it('同一段内两条语音标记都要出段(旧写法只出第一条)', () => {
    const segs = parseMessageContent('[语音] https://x.com/a.m4a 3 和 [语音] https://x.com/b.m4a 7')
    expect(segs.filter((s) => s.type === 'audio')).toHaveLength(2)
    expect(segs).toEqual([
      { type: 'audio', url: 'https://x.com/a.m4a', durationSec: 3 },
      { type: 'text', text: ' 和 ' },
      { type: 'audio', url: 'https://x.com/b.m4a', durationSec: 7 },
    ])
  })

  // 反向锁(2026-10-18):图片那侧的形态**反过来**才是对的 —— `IMAGE_URL_RE` 不带 `g`,
  // `exec` 每轮都从 0 开始,只有「切串」能推进;对它改用游标法就是死循环
  // (进程挂死,表现为 vitest worker 被 OOM 掉,看不出是哪条用例)。
  // 本条钉住"多图仍逐段出"这一结果,配合 message-parse.ts 里那段形态说明。
  it('同一段内两张图片都要出段(切串法推进,不得改成游标)', () => {
    const segs = parseMessageContent('看 https://x.com/1.png 与 https://x.com/2.png')
    expect(segs.filter((s) => s.type === 'image')).toHaveLength(2)
    expect(segs).toEqual([
      { type: 'text', text: '看 ' },
      { type: 'image', url: 'https://x.com/1.png' },
      { type: 'text', text: ' 与 ' },
      { type: 'image', url: 'https://x.com/2.png' },
    ])
  })

  it('三段连排:语音-图-语音 顺序与内容都不丢', () => {
    const segs = parseMessageContent(
      '[语音] https://x.com/a.m4a 1 https://x.com/b.png [语音] https://x.com/c.mp3 2',
    )
    // 两侧各留一个空格 ⇒ 图前后各出一段单空格 text(切串法的自然产物,不是脏段)
    expect(segs).toHaveLength(5)
    expect(segs[0]!).toEqual({ type: 'audio', url: 'https://x.com/a.m4a', durationSec: 1 })
    expect(segs[1]!).toEqual({ type: 'text', text: ' ' })
    expect(segs[2]!).toEqual({ type: 'image', url: 'https://x.com/b.png' })
    expect(segs[3]!).toEqual({ type: 'text', text: ' ' })
    expect(segs[4]!).toEqual({ type: 'audio', url: 'https://x.com/c.mp3', durationSec: 2 })
  })

  it('连续两条语音标记之间没有夹字时不出空 text 段', () => {
    const segs = parseMessageContent('[语音] https://x.com/a.m4a 1[语音] https://x.com/b.m4a 2')
    expect(segs.filter((s) => s.type === 'text')).toHaveLength(0)
    expect(segs.filter((s) => s.type === 'audio')).toHaveLength(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
