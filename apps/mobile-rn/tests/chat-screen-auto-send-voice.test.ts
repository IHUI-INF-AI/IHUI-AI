// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createContext, runInContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

import { API_BASE_URL } from '../src/lib/config'
import { parseMessageContent } from '../src/utils/message-parse'

const SCREEN = readFileSync(join(__dirname, '../src/screens/ChatScreen.tsx'), 'utf8')

/**
 * ChatScreen 顶层直挂 expo,测试收集期 import 整屏会炸(与本仓其它 ChatScreen 源码锁同一原因)。
 * 这里把生产函数正文切出来,用真的 parseMessageContent / API_BASE_URL 跑,不复制第二份判据。
 */
function loadVoiceBubbleContent(): (url: string, durationSec: number) => string | null {
  const start = SCREEN.indexOf('const VOICE_DURATION_MAX_SEC')
  const end = SCREEN.indexOf('// DrawerTab 中 home/ai/mine')
  if (start < 0 || end < start) {
    throw new Error('ChatScreen 语音气泡函数块缺失')
  }
  const js = SCREEN.slice(start, end)
    .replace(
      'export function voiceBubbleContent(url: string, durationSec: number): string | null',
      'function voiceBubbleContent(url, durationSec)',
    )
    .replace(
      'function replayableAudioUrl(raw: string): string | null',
      'function replayableAudioUrl(raw)',
    )
    .replace(
      'function voiceDurationSec(durationSec: number): number',
      'function voiceDurationSec(durationSec)',
    )
  const sandbox: {
    parseMessageContent: typeof parseMessageContent
    API_BASE_URL: string
    __voiceBubbleContent?: unknown
  } = { parseMessageContent, API_BASE_URL }
  runInContext(
    js + '\nglobalThis.__voiceBubbleContent = voiceBubbleContent',
    createContext(sandbox),
  )
  const fn = sandbox.__voiceBubbleContent
  if (typeof fn !== 'function') throw new Error('voiceBubbleContent 未导出')
  return fn as (url: string, durationSec: number) => string | null
}

const voiceBubbleContent = loadVoiceBubbleContent()

describe('DBG-32 autoSendVoice 按已有语音气泡结构发送', () => {
  it('绝对音频地址收成唯一 audio 段,时长取整且不留尾巴文本', () => {
    const url = 'https://file.aizhs.top/uploads/abc.m4a'
    const content = voiceBubbleContent(url, 12.6)
    expect(content).toBe(`[语音] ${url} 13`)
    expect(parseMessageContent(content ?? '')).toEqual([{ type: 'audio', url, durationSec: 13 }])
  })

  it('相对上传路径补成可请求的绝对地址,对方能按同一解析回听', () => {
    const content = voiceBubbleContent('/uploads/voice.m4a', 8)
    const base = API_BASE_URL.replace(/\/$/, '')
    const url = `${base}/uploads/voice.m4a`
    expect(content).toBe(`[语音] ${url} 8`)
    expect(parseMessageContent(content ?? '')).toEqual([{ type: 'audio', url, durationSec: 8 }])
  })

  it('无音频扩展名或空地址不发纯文本标记', () => {
    expect(voiceBubbleContent('https://file.aizhs.top/uploads/abc', 4)).toBeNull()
    expect(voiceBubbleContent('  ', 4)).toBeNull()
    expect(voiceBubbleContent('/uploads/abc', 4)).toBeNull()
  })

  it('屏内两处录音出口都走 voiceBubbleContent,不再裸拼标记', () => {
    expect(SCREEN).toContain('voiceBubbleContent(voice.url, voice.durationSec)')
    expect(SCREEN).toContain('voiceBubbleContent(resolveFileUrl(up.data.path), durationSec)')
    expect(SCREEN).not.toMatch(/sendRef\.current\(`\[语音\]/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
