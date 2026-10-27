// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 更新提示文案的两端一致性结构锁(2026-10-27 立)。
//
// 为什么需要:web 的 PWAUpdatePrompt / 版本闸门卡片与 RN 的 UpdatePrompt 是**两套渲染**,
// 文案却必须"看起来是同一个东西"。此前 web 端硬编码中文、RN 端写在自己词表里,
// 两边各改各的 ⇒ 用户看到的措辞迟早漂开,而且 5 语言里只有中文对得上。
// 现在两端共用 appUpdate 命名空间,本测试把"共用"从口头约定变成机器判据:
//   S1 web 侧 5 语言键集完全一致(不许某个语言漏翻);
//   S2 RN 侧键集必须是 web 的子集,且**同名键的值逐字相等**(同键不同文 = 不一致);
//   S3 两端共有键里的占位符必须成对出现({version}/{latest} 不许单边丢);
//   S4 两端都不得残留旧命名空间 update(它已被 appUpdate 取代,留着就是第二份真相源)。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const messagesRoot = join(here, '..', 'messages')
const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const

type Dict = Record<string, unknown>

function readMessages(platform: 'web' | 'mobile-rn', locale: string): Dict {
  const path = join(messagesRoot, platform, `${locale}.json`)
  return JSON.parse(readFileSync(path, 'utf8')) as Dict
}

function appUpdateOf(platform: 'web' | 'mobile-rn', locale: string): Record<string, string> {
  const dict = readMessages(platform, locale)
  const ns = dict.appUpdate
  expect(ns, `${platform}/${locale} 缺 appUpdate 命名空间`).toBeTypeOf('object')
  return ns as Record<string, string>
}

/** 两端必须都有的键(RN 只用这 12 个;web 另有 gate* 强更文案)。 */
const SHARED_KEYS = [
  'title',
  'body',
  'action',
  'close',
  'checking',
  'downloading',
  'ready',
  'installing',
  'error',
  'errorDesc',
  'retry',
  'upToDate',
] as const

/** web 独占的强更弹窗文案(web 有阻塞弹窗,RN 目前没有强更通道)。 */
const WEB_ONLY_KEYS = [
  'gateTitle',
  'gateBody',
  'gateForceBody',
  'gateReleaseNotes',
  'gateUpdateNow',
  'gateLater',
  'gateQuit',
  'gateQuitConfirm',
  'gateQuitFailed',
] as const

describe('appUpdate 文案:web 5 语言键集一致(S1)', () => {
  it('每个语言都齐 SHARED_KEYS + WEB_ONLY_KEYS', () => {
    for (const locale of LOCALES) {
      const ns = appUpdateOf('web', locale)
      for (const key of [...SHARED_KEYS, ...WEB_ONLY_KEYS]) {
        expect(ns[key], `web/${locale} 缺 ${key}`).toBeTypeOf('string')
        expect((ns[key] as string).length, `web/${locale} 的 ${key} 是空串`).toBeGreaterThan(0)
      }
    }
  })

  it('5 语言的键集逐字相同(没有语言多一个或少一个)', () => {
    const baseline = Object.keys(appUpdateOf('web', 'zh-CN')).sort()
    for (const locale of LOCALES) {
      expect(
        Object.keys(appUpdateOf('web', locale)).sort(),
        `web/${locale} 键集与 zh-CN 不同`,
      ).toEqual(baseline)
    }
  })
})

describe('appUpdate 文案:RN 是 web 的子集且同名键等值(S2)', () => {
  it('RN 有 SHARED_KEYS,且每个键的值与 web 逐字相等', () => {
    for (const locale of LOCALES) {
      const web = appUpdateOf('web', locale)
      const mobile = appUpdateOf('mobile-rn', locale)
      for (const key of SHARED_KEYS) {
        expect(mobile[key], `mobile-rn/${locale} 缺 ${key}`).toBeTypeOf('string')
      }
      for (const [key, value] of Object.entries(mobile)) {
        expect(web[key], `mobile-rn/${locale} 的 ${key} 在 web 侧不存在(两边漂开了)`).toBeTypeOf(
          'string',
        )
        expect(value, `mobile-rn/${locale} 的 ${key} 与 web 措辞不一致`).toBe(web[key])
      }
    }
  })
})

describe('appUpdate 文案:占位符成对(S3)', () => {
  it('{version} / {latest} 该有的地方都在', () => {
    for (const locale of LOCALES) {
      const web = appUpdateOf('web', locale)
      expect(web.gateBody, `web/${locale} gateBody 缺 {version}`).toContain('{version}')
      expect(web.gateBody, `web/${locale} gateBody 缺 {latest}`).toContain('{latest}')
      expect(web.gateForceBody, `web/${locale} gateForceBody 缺 {latest}`).toContain('{latest}')
    }
  })
})

describe('appUpdate 文案:旧命名空间不得残留(S4)', () => {
  it('两端都没有 update 命名空间(已被 appUpdate 取代)', () => {
    for (const locale of LOCALES) {
      expect(
        Object.hasOwn(readMessages('mobile-rn', locale), 'update'),
        `mobile-rn/${locale} 仍残留旧 update 命名空间`,
      ).toBe(false)
      expect(
        Object.hasOwn(readMessages('web', locale), 'appUpdate'),
        `web/${locale} 缺 appUpdate`,
      ).toBe(true)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
