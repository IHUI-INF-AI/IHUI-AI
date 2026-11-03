// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * token-estimate 回归(2026-10-31 立,票「E2E 自动补测」第三枚真补测)。
 *
 * 两个导出各自守一条**用户看得见**的界线:
 * - `estimateChatMessagesTokens` 只算 user/assistant 且非 error 的消息 —— 把 system 提示、
 *   报错气泡算进上下文占用,进度环就会虚高;
 * - `isContextAtCompactionThreshold` 是"正在压缩上下文"预告态的唯一门控(与后端 triggerRatio
 *   同源常量),差一档就变成"没到阈值却提前喊压缩"或"该喊时沉默"。
 */
import { describe, expect, it } from 'vitest'

import { DEFAULT_TRIGGER_RATIO } from '@ihui/shared/constants'

import type { ChatMessage } from '@/stores/chat'

import { estimateChatMessagesTokens, isContextAtCompactionThreshold } from '../token-estimate'

/** 只喂本模块真正读的三个字段(role / content / error),其余按类型补齐后断言。 */
const msg = (over: Partial<ChatMessage>): ChatMessage =>
  ({ id: 'm1', role: 'user', content: '', createdAt: 0, ...over }) as unknown as ChatMessage

// 纯 ASCII 400 字符 = 100 token(4 字符/token),外加每条消息 4 token 的 role 开销 ⇒ 104
const ASCII_400 = 'a'.repeat(400)
const TOKENS_104 = 104

describe('token-estimate 上下文占用估算', () => {
  it('单条 user 消息 = 内容 token + role 开销(ASCII 400 字符 ⇒ 104)', () => {
    expect(estimateChatMessagesTokens([msg({ content: ASCII_400 })])).toBe(TOKENS_104)
  })

  it('error 消息 / system 消息 / 空内容一律不计(否则进度环虚高)', () => {
    expect(estimateChatMessagesTokens([msg({ content: ASCII_400, error: true })])).toBe(0)
    expect(estimateChatMessagesTokens([msg({ content: ASCII_400, role: 'system' })])).toBe(0)
    expect(estimateChatMessagesTokens([msg({ content: '' })])).toBe(0)
  })

  it('多轮只按 user/assistant 累加', () => {
    const messages = [
      msg({ id: 'u1', role: 'user', content: ASCII_400 }),
      msg({ id: 'a1', role: 'assistant', content: ASCII_400 }),
      msg({ id: 's1', role: 'system', content: ASCII_400 }),
      msg({ id: 'e1', role: 'assistant', content: ASCII_400, error: true }),
    ]
    expect(estimateChatMessagesTokens(messages)).toBe(TOKENS_104 * 2)
  })

  it('阈值门控:恰在触发线上算到,差一枚 token 就不算', () => {
    const messages = [msg({ content: ASCII_400 })]
    // 取 floor(104 / 0.88) = 118 ⇒ 104/118 = 0.881 ≥ 0.88 触发;119 则不触发
    const atLine = Math.floor(TOKENS_104 / DEFAULT_TRIGGER_RATIO)
    expect(isContextAtCompactionThreshold(messages, atLine)).toBe(true)
    expect(isContextAtCompactionThreshold(messages, atLine + 1)).toBe(false)
  })

  it('contextLimit ≤ 0 恒不触发(未配置上限 ≠ 已满)', () => {
    const messages = [msg({ content: ASCII_400 })]
    expect(isContextAtCompactionThreshold(messages, 0)).toBe(false)
    expect(isContextAtCompactionThreshold(messages, -1)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
