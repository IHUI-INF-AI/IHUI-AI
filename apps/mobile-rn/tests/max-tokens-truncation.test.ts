// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-425 RN 腿(2026-10-19 收口):"输出被 max_tokens 截断"的可见提示。
 *
 * 两份取证:
 * ① 判据行为 —— utils/max-tokens-truncation 的 isMaxTokensTruncatedFinishReason:
 *    阳性 length/MAX_TOKENS(大小写归一)、阴性 stop/tool_calls/SAFETY/RECITATION、
 *    缺席(undefined/null)与非串一律 false(缺席 = 上游没给,绝不折成"正常结束")。
 * ② 词包对账 —— 五语言 mobile-rn 包必须含 `chat.truncation.maxLengthNotice`(与
 *    web 包 truncation.maxLengthNotice 同键同义):本端取词缺键时不抛错,而是把键名
 *    原样回显到界面上(守门 56 / D111 同一失效类)。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { isMaxTokensTruncatedFinishReason } from '../src/utils/max-tokens-truncation'

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

function readPack(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        'packages',
        'i18n',
        'messages',
        'mobile-rn',
        `${locale}.json`,
      ),
      'utf8',
    ),
  ) as Record<string, unknown>
}

describe('G-425 isMaxTokensTruncatedFinishReason(阳性)', () => {
  it.each(['length', 'LENGTH', 'Length', 'max_tokens', 'MAX_TOKENS', 'Max_Tokens'])(
    'finishReason=%s ⇒ true(小写归一)',
    (reason) => {
      expect(isMaxTokensTruncatedFinishReason(reason)).toBe(true)
    },
  )
})

describe('G-425 isMaxTokensTruncatedFinishReason(阴性:其余 reason 绝不折成截断)', () => {
  it.each(['stop', 'tool_calls', 'SAFETY', 'RECITATION', 'stop_sequence', 'content_filter', ''])(
    'finishReason=%s ⇒ false',
    (reason) => {
      expect(isMaxTokensTruncatedFinishReason(reason)).toBe(false)
    },
  )
})

describe('G-425 isMaxTokensTruncatedFinishReason(缺席/非串 ⇒ false,不提示)', () => {
  it('undefined / null ⇒ false(缺席 = 上游没给,不折成 stop 也不提示)', () => {
    expect(isMaxTokensTruncatedFinishReason(undefined)).toBe(false)
    expect(isMaxTokensTruncatedFinishReason(null)).toBe(false)
  })
})

describe('G-425 词包对账:五语言 chat.truncation.maxLengthNotice 必须在', () => {
  it.each(LOCALES)('%s 包含非空 maxLengthNotice', (locale) => {
    const pack = readPack(locale)
    const chat = pack.chat as Record<string, unknown> | undefined
    const truncation = chat?.truncation as Record<string, unknown> | undefined
    expect(typeof truncation?.maxLengthNotice).toBe('string')
    expect(truncation?.maxLengthNotice as string).not.toBe('')
    // 缺键会回显键名(守门 56 同型),键名回显也要拦
    expect(truncation?.maxLengthNotice).not.toBe('chat.truncation.maxLengthNotice')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
