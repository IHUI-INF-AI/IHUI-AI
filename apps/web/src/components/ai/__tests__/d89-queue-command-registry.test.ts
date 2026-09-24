// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:watermarked

// D89 ② 队列与引导命令化(2026-09-24,G-121)
// 验证:排队语义命令注册(id 唯一/语义归属/三映射覆盖)+ 五语言词表 parity。
// 说明:CHAT_QUEUE_COMMANDS 不进 BUILTIN_COMMANDS 的原因见 command-registry.ts 注释
// (CommandAction 闭联合约被 ui-action-registry 三处穷尽 switch 消费,该文件不在 D89 写域)。
import { describe, it, expect } from 'vitest'

import {
  BUILTIN_COMMANDS,
  CHAT_QUEUE_COMMANDS,
  COMMAND_LABEL_KEY,
  COMMAND_DESC_KEY,
  COMMAND_KEYWORDS_KEY,
} from '@/lib/command-registry'

import en from '@ihui/i18n/messages/web/en.json'
import ja from '@ihui/i18n/messages/web/ja.json'
import ko from '@ihui/i18n/messages/web/ko.json'
import zhCN from '@ihui/i18n/messages/web/zh-CN.json'
import zhTW from '@ihui/i18n/messages/web/zh-TW.json'

type Json = Record<string, unknown>

const MESSAGES: Array<{ lang: string; msgs: Json }> = [
  { lang: 'zh-CN', msgs: zhCN as unknown as Json },
  { lang: 'zh-TW', msgs: zhTW as unknown as Json },
  { lang: 'en', msgs: en as unknown as Json },
  { lang: 'ja', msgs: ja as unknown as Json },
  { lang: 'ko', msgs: ko as unknown as Json },
]

function requireNs(msgs: Json, key: string): Json {
  const v = msgs[key]
  if (!v || typeof v !== 'object') throw new Error(`命名空间缺失: ${key}`)
  return v as Json
}

describe('D89 ② 排队语义命令注册', () => {
  it('queuePrompt/steerPrompt id 唯一且不与 BUILTIN_COMMANDS 冲突', () => {
    const builtinIds = new Set(BUILTIN_COMMANDS.map((c) => c.id))
    const queueIds = CHAT_QUEUE_COMMANDS.map((c) => c.id)
    expect(new Set(queueIds).size).toBe(queueIds.length)
    for (const id of queueIds) {
      expect(builtinIds.has(id)).toBe(false)
    }
    expect([...queueIds].sort()).toEqual(['queuePrompt', 'steerPrompt'].sort())
  })

  it('语义归属复用既有排队体系,不建第二套排队', () => {
    const byId = new Map(CHAT_QUEUE_COMMANDS.map((c) => [c.id, c]))
    // queuePrompt → W27 预备消息 FIFO(use-message-send.ts pendingMessages)
    expect(byId.get('queuePrompt')?.semantic).toBe('w27-pending')
    // steerPrompt → steer 中途引导(send-message.ts 闪电按钮 → steer 端点)
    expect(byId.get('steerPrompt')?.semantic).toBe('steer')
  })

  it('COMMAND_LABEL/DESC/KEYWORDS 三映射覆盖两条命令,键形与 next-intl 路径一致', () => {
    for (const id of ['queuePrompt', 'steerPrompt']) {
      expect(COMMAND_LABEL_KEY[id]).toBe(`commands.${id}.label`)
      expect(COMMAND_DESC_KEY[id]).toBe(`commands.${id}.description`)
      expect(COMMAND_KEYWORDS_KEY[id]).toBe(`commands.${id}.keywords`)
    }
  })

  it('commandPalette.commands 词表五语言 parity(label/description/keywords 齐备)', () => {
    for (const { lang, msgs } of MESSAGES) {
      const commands = requireNs(requireNs(msgs, 'commandPalette'), 'commands')
      for (const id of ['queuePrompt', 'steerPrompt']) {
        const entry = commands[id]
        if (!entry || typeof entry !== 'object') {
          throw new Error(`${lang}.commandPalette.commands.${id} 缺失`)
        }
        const e = entry as Json
        expect(typeof e.label, `${lang}.commands.${id}.label`).toBe('string')
        expect((e.label as string).length).toBeGreaterThan(0)
        expect(typeof e.description, `${lang}.commands.${id}.description`).toBe('string')
        expect((e.description as string).length).toBeGreaterThan(0)
        expect(Array.isArray(e.keywords), `${lang}.commands.${id}.keywords`).toBe(true)
        expect((e.keywords as string[]).length).toBeGreaterThan(0)
      }
    }
  })

  it('Undo 二键(chat.queueUndoRestored/queueUndoRestoredQueued)五语言齐备', () => {
    for (const { lang, msgs } of MESSAGES) {
      const chat = requireNs(msgs, 'chat')
      expect(typeof chat.queueUndoRestored, `${lang}.chat.queueUndoRestored`).toBe('string')
      expect((chat.queueUndoRestored as string).length).toBeGreaterThan(0)
      expect(
        typeof chat.queueUndoRestoredQueued,
        `${lang}.chat.queueUndoRestoredQueued`,
      ).toBe('string')
      expect((chat.queueUndoRestoredQueued as string).length).toBeGreaterThan(0)
    }
  })
})
