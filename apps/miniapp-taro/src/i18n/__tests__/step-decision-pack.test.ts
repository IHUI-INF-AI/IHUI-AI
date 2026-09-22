// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D55②:miniapp-taro 运行时词包必须解析得到 stepDecision.*(决策徽章取词)。
// 端包本身**不含**这些键 —— 它们只在 shared,由 gen-i18n-compressed / 端加载器 merge 进来,
// 所以这里按同一套 merge 语义断言"合并视图可达",而不是只看端包(否则测的是一个根本不参与
// 运行的组合)。缺键时端内会回显 `stepDecision.perm.deny` 这种键名,即本用例要拦的形态。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { mergeMessages } from '@ihui/i18n/loader'
import { describe, expect, it } from 'vitest'

import { permissionDecisionWord, STEP_DECISIONS } from '@ihui/shared/chat'

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
const PERM_VALUES = ['allow', 'ask', 'deny'] as const

const load = (dir: string, locale: string) =>
  JSON.parse(
    readFileSync(
      join(__dirname, '../../../../../packages/i18n/messages', dir, `${locale}.json`),
      'utf8',
    ),
  ) as Record<string, unknown>

describe('stepDecision 词包在 taro 合并视图可达(D55②)', () => {
  it.each(LOCALES)('%s:15 个步骤决策 + allow/ask/deny 全部本地化,且不回显键名/原始码', (locale) => {
    const merged = mergeMessages(
      load('shared', locale) as never,
      load('miniapp-taro', locale) as never,
    ) as unknown as Record<string, unknown>
    const t = (key: string): string => {
      // 与端内一致的命名空间绑定:t(`stepDecision.${k}`)
      let cur: unknown = merged.stepDecision
      for (const seg of key.split('.')) {
        if (cur && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
          cur = (cur as Record<string, unknown>)[seg]
        } else {
          return key
        }
      }
      return typeof cur === 'string' ? cur : key
    }
    for (const d of STEP_DECISIONS) {
      const word = permissionDecisionWord(d, t)
      expect(word).not.toBe(d)
      expect(word).not.toContain('stepDecision.')
      expect(word.trim().length).toBeGreaterThan(0)
    }
    for (const p of PERM_VALUES) {
      const word = permissionDecisionWord(p, t)
      expect(word).not.toBe(p)
      expect(word).not.toContain('perm.')
    }
    // 未知取值仍必须原样(不许把未知判成"已放行")
    expect(permissionDecisionWord('unexpected_value', t)).toBe('unexpected_value')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
