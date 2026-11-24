// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 端包不得用标量遮蔽 shared 的同名对象(2026-11-04 实测)。
 *
 * 缺陷形态:`packages/i18n/messages/extension/*.json` 里 `chat.terminal` 曾被写成标量
 * "Terminal",而 `chat.terminal.waitingInput / promptLabel / submit / timeoutNoInput /
 * mobileUnsupported` 五枚子键住在 shared 包里。`mergeMessages(shared, 端)` 是深合并,
 * 但"端给的是标量"时标量直接胜出 ⇒ 整个对象被覆盖,端内四处取词全部退化成裸键名上屏。
 * 手写"只看端包"的取词夹具看不见这一型(它连 shared 都不读),所以本用例走生产同一份
 * `mergeMessages` + `translate`,与 apps/extension/src/i18n/index.tsx 的装配路径同形。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { mergeMessages, translate } from '@ihui/i18n/loader'

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '..', '..', '..', 'packages', 'i18n', 'messages')

type Msg = Parameters<typeof mergeMessages>[0]

function pack(dir: 'shared' | 'extension', locale: string): Msg {
  return JSON.parse(readFileSync(join(MESSAGES_ROOT, dir, `${locale}.json`), 'utf8')) as Msg
}

const LOCALES = ['en', 'ja', 'ko', 'zh-CN', 'zh-TW']
const SHARED_SUB_KEYS = [
  'waitingInput',
  'promptLabel',
  'submit',
  'timeoutNoInput',
  'mobileUnsupported',
]

describe('extension 的 chat.terminal 必须是对象(不得把 shared 的同名对象遮蔽成标量)', () => {
  for (const locale of LOCALES) {
    it(`${locale}: 端包形态为对象,合并后 shared 的 5 枚子键与端内 title 都取得到词`, () => {
      const ext = pack('extension', locale)
      const chat = (ext as Record<string, unknown>).chat as Record<string, unknown> | undefined
      expect(typeof chat?.terminal, '端包再写成标量就会重新遮蔽 shared 的对象').toBe('object')

      const merged = mergeMessages(pack('shared', locale), ext)
      for (const leaf of SHARED_SUB_KEYS) {
        const key = `chat.terminal.${leaf}`
        expect(translate(merged, key), `${locale} 下 ${key} 退化成裸键名`).not.toBe(key)
      }
      const titleKey = 'chat.terminal.title'
      const title = translate(merged, titleKey)
      expect(title, `${locale} 下 ${titleKey} 取不到词`).not.toBe(titleKey)
      expect(title.length).toBeGreaterThan(0)
    })
  }

  it('插值键真能插(promptLabel 交 {{prompt}}),不是把占位符原样吐回屏幕', () => {
    const merged = mergeMessages(pack('shared', 'zh-CN'), pack('extension', 'zh-CN'))
    const out = translate(merged, 'chat.terminal.promptLabel', { params: { prompt: 'y? [Y/n]' } })
    expect(out).toContain('y? [Y/n]')
    expect(out).not.toContain('{{prompt}}')
  })

  it('阴性对照:确实未入账的键仍返回裸键名(证明上面的 not.toBe 不是恒真)', () => {
    const merged = mergeMessages(pack('shared', 'zh-CN'), pack('extension', 'zh-CN'))
    expect(translate(merged, 'chat.terminal.thisKeyDoesNotExistAnywhere')).toBe(
      'chat.terminal.thisKeyDoesNotExistAnywhere',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
