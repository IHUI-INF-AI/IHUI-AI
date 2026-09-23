// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D111:移动端权限档词包完备性(真实 miniapp-taro 词包 ×5 语言)。
// 断言"档位与后果文案出现且本地化"的词表面:五档 + unknown 兜底逐键非空、zh 与 en 文案互异。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { permissionTierWordKeys } from '@ihui/shared/chat'

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
const TIERS = ['default', 'plan', 'accept-edits', 'bypass-permissions', 'unknown'] as const

function pack(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(
      join(__dirname, '../../../../..', `packages/i18n/messages/miniapp-taro/${locale}.json`),
      'utf8',
    ),
  ) as Record<string, unknown>
}

function resolve(root: Record<string, unknown>, path: string): string | undefined {
  let cur: unknown = root
  for (const seg of path.split('.')) {
    if (cur && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[seg]
    } else {
      return undefined
    }
  }
  return typeof cur === 'string' ? cur : undefined
}

describe('permissionTier 词包(miniapp-taro ×5 语言,D111)', () => {
  it('label + 五档 title/desc 全部存在且非空(缺键即暴露,不靠运行时回显键名)', () => {
    for (const locale of LOCALES) {
      const root = pack(locale)
      expect(resolve(root, 'permissionTier.label')?.length ?? 0).toBeGreaterThan(0)
      for (const tier of TIERS) {
        for (const part of ['title', 'desc'] as const) {
          const v = resolve(root, `permissionTier.mode.${tier}.${part}`)
          expect(v?.length ?? 0).toBeGreaterThan(0)
        }
      }
    }
  })

  it('取词链路:未知档落 unknown 键,且 unknown 文案与 default 互异(非写死回退)', () => {
    const zh = pack('zh-CN')
    const en = pack('en')
    const unknownTitle = permissionTierWordKeys('garbage-mode').title
    expect(resolve(zh, unknownTitle)).not.toBe(resolve(en, unknownTitle))
    expect(resolve(zh, unknownTitle)).not.toBe(resolve(zh, 'permissionTier.mode.default.title'))
    // 各档在真实词包上取得到词,不崩
    expect(resolve(zh, permissionTierWordKeys('acceptEdits').title)).toBe('接受编辑')
    expect(resolve(zh, permissionTierWordKeys(null).title)).toBe('默认模式')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
