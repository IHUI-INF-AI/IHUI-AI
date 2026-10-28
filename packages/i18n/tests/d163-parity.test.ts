// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D163 parity:undo 分级键与预览五态键五语言齐;被替换的旧键必须移除(零死键)。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const

const UNDO_KEYS = [
  'undoConfirm',
  'undoPreparing',
  'undoSucceeded',
  'undoPartialWarning',
  'undoUnavailable',
  'undoFailed',
  'undoFailedChanged',
  'undoFailedUnverifiable',
] as const

const PREVIEW_KEYS = [
  'previewLoadFailed',
  'previewRetryAction',
  'previewExpired',
  'previewOpenSourceAction',
  'previewTooLarge',
] as const

/** D163 接线后被取代的旧键:词表里不许残留成死键 */
const REMOVED_CHECKPOINT_KEYS = [
  'confirmTitle',
  'restoring',
  'restoreSuccess',
  'restoreFailed',
] as const

type Messages = Record<string, unknown>

function load(locale: string): Messages {
  return JSON.parse(
    readFileSync(join(here, '../messages/web', `${locale}.json`), 'utf8'),
  ) as Messages
}

function section(messages: Messages, path: string): Record<string, string> {
  let node: unknown = messages
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in (node as Messages))) {
      throw new Error(`${path} 命名空间缺失`)
    }
    node = (node as Messages)[part]
  }
  return node as Record<string, string>
}

describe('D163 undo 键 parity(aiChat.checkpoint)', () => {
  for (const locale of LOCALES) {
    it(`${locale}: 八键齐、值非空、旧键已移除`, () => {
      const cp = section(load(locale), 'aiChat.checkpoint')
      for (const key of UNDO_KEYS) {
        expect(typeof cp[key], key).toBe('string')
        expect(cp[key].length, key).toBeGreaterThan(0)
      }
      for (const key of REMOVED_CHECKPOINT_KEYS) {
        expect(cp[key], key).toBeUndefined()
      }
    })
  }

  it('undoSucceeded 带 {count} 占位,五语言一致', () => {
    for (const locale of LOCALES) {
      expect(section(load(locale), 'aiChat.checkpoint').undoSucceeded).toContain('{count}')
    }
  })
})

describe('D163 预览五态键 parity(a11y)', () => {
  for (const locale of LOCALES) {
    it(`${locale}: 五键齐、值非空`, () => {
      const a11y = section(load(locale), 'a11y')
      for (const key of PREVIEW_KEYS) {
        expect(typeof a11y[key], key).toBe('string')
        expect(a11y[key].length, key).toBeGreaterThan(0)
      }
    })
  }
})
