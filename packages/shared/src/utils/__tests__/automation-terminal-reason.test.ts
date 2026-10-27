// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-241 终态徽章判据(跨端唯一一份)的单测。
 *
 * 覆盖三类语义:
 *  1. 四个封闭集成因各自映射到正确的 i18n 键后缀与语义色调档;
 *  2. 键后缀与 packages/i18n/messages/{web,mobile-rn}/<五语>.json 的
 *     `automations.terminalReason.*` 逐字对齐(读真文件,防止有人改键名而不同步本表);
 *  3. 无终态 / 未知取值 ⇒ null(绝不折成默认成因)。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  AUTOMATION_TERMINAL_REASON_I18N_SUFFIXES,
  AUTOMATION_TERMINAL_REASON_TONES,
  deriveAutomationTerminalReason,
} from '../automation-terminal-reason.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../../../../..')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
const MESSAGE_SETS = ['web', 'mobile-rn'] as const

describe('deriveAutomationTerminalReason(G-241 终态徽章判据唯一实现)', () => {
  it('阳性:四档成因各自给出键后缀与色调档', () => {
    expect(deriveAutomationTerminalReason('manual_pause')).toEqual({
      i18nSuffix: 'manualPause',
      tone: 'neutral',
    })
    expect(deriveAutomationTerminalReason('failed_permanent')).toEqual({
      i18nSuffix: 'failedPermanent',
      tone: 'danger',
    })
    expect(deriveAutomationTerminalReason('failed_retries_exhausted')).toEqual({
      i18nSuffix: 'failedRetriesExhausted',
      tone: 'warning',
    })
    expect(deriveAutomationTerminalReason('completed')).toEqual({
      i18nSuffix: 'completed',
      tone: 'success',
    })
  })

  it('阴性:无终态(null/undefined/空串)⇒ null(不占位、不冒充结论)', () => {
    expect(deriveAutomationTerminalReason(null)).toBeNull()
    expect(deriveAutomationTerminalReason(undefined)).toBeNull()
    expect(deriveAutomationTerminalReason('')).toBeNull()
  })

  it('阴性:不在封闭集内的取值 ⇒ null(未知不折成默认成因)', () => {
    expect(deriveAutomationTerminalReason('manualPause')).toBeNull()
    expect(deriveAutomationTerminalReason('cancelled')).toBeNull()
    expect(deriveAutomationTerminalReason('constructor')).toBeNull()
    expect(deriveAutomationTerminalReason('toString')).toBeNull()
  })

  it('键后缀与五语言 i18n 真实键逐字对齐(web 与 mobile-rn 两套消息面)', () => {
    for (const set of MESSAGE_SETS) {
      for (const locale of LOCALES) {
        const file = resolve(REPO_ROOT, `packages/i18n/messages/${set}/${locale}.json`)
        const messages = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
        const automations = messages.automations as Record<string, unknown>
        const terminal = automations.terminalReason as Record<string, string>
        expect(terminal, `${set}/${locale} 缺 automations.terminalReason`).toBeTruthy()
        for (const suffix of Object.values(AUTOMATION_TERMINAL_REASON_I18N_SUFFIXES)) {
          expect(
            typeof terminal[suffix] === 'string' && terminal[suffix].length > 0,
            `${set}/${locale} 缺 automations.terminalReason.${suffix}`,
          ).toBe(true)
        }
      }
    }
  })

  it('两张表与封闭集成因一一对应(不多不少)', () => {
    const suffixKeys = Object.keys(AUTOMATION_TERMINAL_REASON_I18N_SUFFIXES).sort()
    const toneKeys = Object.keys(AUTOMATION_TERMINAL_REASON_TONES).sort()
    expect(suffixKeys).toEqual([
      'completed',
      'failed_permanent',
      'failed_retries_exhausted',
      'manual_pause',
    ])
    expect(toneKeys).toEqual(suffixKeys)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
