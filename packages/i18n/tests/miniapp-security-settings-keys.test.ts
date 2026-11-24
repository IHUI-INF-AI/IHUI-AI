// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 小程序 securitySettings 词包键集结构锁(2026-11-09 立)。
//
// 为什么需要:小程序镜像页 pkg-mirror3/security-settings 经 @rn-shells 承载
// apps/mobile-rn/src/screens/SecuritySettingsScreen.tsx + packages/app 的
// SecuritySettingsScreen,取词被 rn-shell-replace-plugin 换到端内真相源
// packages/i18n/messages/miniapp-taro/。该词包曾只有 7 键,缺 readOnlyHint /
// stateOn / stateOff 三键,而 loader.getValueByPath 取不到键时原样返回键名
// (packages/i18n/src/loader.ts 的 `if (!options?.params) return key`),
// 用户因此在屏上看到裸键名。本测试把「消费键集 ⊆ 词包键集」钉成机器判据:
//   L1 屏上消费的 10 枚 securitySettings.* 键在五语言全部存在且为非空字符串;
//   L2 五语言键集完全一致(不许某一语言漏翻);
//   L3 小程序版 readOnlyHint 不得指向端内不存在的「安全中心」入口
//      (mobile-rn 文案点名安全中心,小程序并无该屏,抄过来=换个端重放谎话,
//       门 290 A2「空端口」同型);
//   L4 stateOn 与 stateOff 取值必须不同(同值=状态列失真)。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const messagesRoot = join(here, '..', 'messages', 'miniapp-taro')
const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const

// 消费键集 = SecuritySettingsScreen(packages/app)与 RN 壳(apps/mobile-rn)
// 里出现的 securitySettings.* 全串(现读 2026-11-09)。
const CONSUMED_KEYS = [
  'title',
  'password',
  'biometric',
  'twoFactor',
  'loginAlert',
  'desc',
  'loadFailed',
  'readOnlyHint',
  'stateOn',
  'stateOff',
] as const

// 「安全中心」各语言点名形态(含全角引号内外的核心词),小程序端不存在该入口。
const SECURITY_CENTER_REF: Record<(typeof LOCALES)[number], RegExp> = {
  'zh-CN': /安全中心/,
  'zh-TW': /安全中心/,
  en: /Security\s*Center/i,
  ja: /セキュリティ\s*センター/,
  ko: /보안\s*센터/,
}

function readSecuritySettings(locale: string): Record<string, unknown> {
  const raw = JSON.parse(readFileSync(join(messagesRoot, `${locale}.json`), 'utf8')) as {
    securitySettings?: Record<string, unknown>
  }
  expect(raw.securitySettings, `miniapp-taro/${locale}.json 缺 securitySettings 命名空间`).toBeTypeOf('object')
  return raw.securitySettings as Record<string, unknown>
}

describe('miniapp securitySettings 词包键集结构锁', () => {
  it('L1 屏上消费的每枚键在五语言全部存在且为非空字符串', () => {
    for (const locale of LOCALES) {
      const ss = readSecuritySettings(locale)
      for (const key of CONSUMED_KEYS) {
        const value = ss[key]
        expect(value, `miniapp-taro ${locale}: securitySettings.${key} 缺失,页面上会渲染裸键名`).toBeTypeOf('string')
        expect((value as string).trim().length, `miniapp-taro ${locale}: securitySettings.${key} 为空串`).toBeGreaterThan(0)
      }
    }
  })

  it('L2 五语言 securitySettings 键集完全一致', () => {
    const sets = LOCALES.map((locale) => Object.keys(readSecuritySettings(locale)).sort().join(','))
    for (let i = 1; i < LOCALES.length; i++) {
      expect(sets[i], `miniapp-taro ${LOCALES[i]} 键集与 ${LOCALES[0]} 不一致`).toBe(sets[0])
    }
  })

  it('L3 readOnlyHint 不得指向小程序端不存在的「安全中心」入口', () => {
    for (const locale of LOCALES) {
      const hint = String(readSecuritySettings(locale).readOnlyHint)
      expect(hint, `miniapp-taro ${locale}: readOnlyHint 点名了小程序不存在的「安全中心」入口`).not.toMatch(SECURITY_CENTER_REF[locale])
    }
  })

  it('L4 stateOn 与 stateOff 取值不得同字', () => {
    for (const locale of LOCALES) {
      const ss = readSecuritySettings(locale)
      expect(String(ss.stateOff), `miniapp-taro ${locale}: stateOn/stateOff 同值,状态列失真`).not.toBe(String(ss.stateOn))
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
