// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 开发者空间屏的五语言词包对账(与 developer-screen-render 分册:那份判渲染,这份判词包)。
 *
 * 读的是 `packages/i18n/messages/mobile-rn/<locale>.json` **原始文件**,不是 `src/i18n` 里
 * 深合并过的运行时词包 —— ja/ko/zh-TW 在运行时都拿 zh-CN 兜底深合并,用合并后的面判"齐备"
 * 等于什么都没判(缺键会被兜成中文而测试全绿)。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEVELOPER_SPACE_ENTRIES,
  DEVELOPER_SPACE_PROBLEMS,
} from '@ihui/shared/constants/developer-space'

const HERE = dirname(fileURLToPath(import.meta.url))
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
type Locale = (typeof LOCALES)[number]
/** 本屏用到的两个命名空间(devSpace 页级 + developerInfo 信息卡) */
const NAMESPACES = ['devSpace', 'developerInfo'] as const

const read = (locale: Locale): Record<string, Record<string, string>> =>
  JSON.parse(
    readFileSync(resolve(HERE, `../../../packages/i18n/messages/mobile-rn/${locale}.json`), 'utf8'),
  ) as Record<string, Record<string, string>>

/** 跨端表点名的键(表先改、词包后补 ⇒ 这一格最容易漂) */
const TABLE_KEYS: string[] = [
  ...DEVELOPER_SPACE_ENTRIES.map((e) => e.labelKey),
  ...DEVELOPER_SPACE_PROBLEMS.flatMap((p) => [p.titleKey, p.descKey, p.btnKey]),
]

describe('开发者空间屏 i18n 词包:devSpace.* 与 developerInfo.* 五语言同形', () => {
  const ref = read('zh-CN')

  it.each(LOCALES)('%s:键集与 zh-CN 逐枚同形、值非空且不落成形', (locale) => {
    const pack = read(locale)
    for (const ns of NAMESPACES) {
      expect(Object.keys(pack[ns] ?? {}).sort(), `${locale}.${ns} 键集与 zh-CN 分叉`).toEqual(
        Object.keys(ref[ns] ?? {}).sort(),
      )
      for (const [leaf, value] of Object.entries(pack[ns] ?? {})) {
        expect((value ?? '').trim(), `${locale}.${ns}.${leaf} 空值`).not.toBe('')
        expect(value, `${locale}.${ns}.${leaf} 落成了键名`).not.toBe(`${ns}.${leaf}`)
      }
    }
  })

  it.each(LOCALES)('%s:跨端表里每一枚键在该语种都有真文案', (locale) => {
    const pack = read(locale)
    for (const full of TABLE_KEYS) {
      const dot = full.indexOf('.')
      const ns = pack[full.slice(0, dot)]
      expect(ns?.[full.slice(dot + 1)], `${locale}.${full} 缺失`).toBeTruthy()
    }
  })

  it('语种纯度:ko/en 不混汉字,en 不混假名与谚文(zh-TW/zh-CN/ja 各按本族文字)', () => {
    for (const locale of LOCALES) {
      const pack = read(locale)
      const words = NAMESPACES.flatMap((ns) => Object.values(pack[ns] ?? {})).join('')
      if (locale === 'ko' || locale === 'en') {
        expect(words.match(/[\u3400-\u9FFF]/g) ?? [], `${locale} 混进汉字`).toEqual([])
      }
      if (locale === 'en') {
        expect(
          words.match(/[\u3040-\u30FF\uAC00-\uD7AF]/g) ?? [],
          `${locale} 混进假名/谚文`,
        ).toEqual([])
      }
      // 阳性对照:同一把尺子喂一句中文必须判出汉字
      if (locale === 'ko') expect('漢字'.match(/[\u3400-\u9FFF]/g)).toHaveLength(2)
    }
  })

  it('zh-CN 词包没有把表外的孤儿键塞进这两个命名空间(防"顺手加键无人消费")', () => {
    const consumed = new Set<string>([
      ...TABLE_KEYS.map((k) => k.slice(k.indexOf('.') + 1)),
      'title',
      'notLoggedIn',
      'renew',
      'copy',
      'copied',
      'copyFailed',
      'linkCopied',
      'linkCopyFailed',
      'faqHeading',
      'contactHeading',
      'contactDesc',
    ])
    const infoLeaves = [
      'title',
      'nameLabel',
      'descLabel',
      'statusLabel',
      'statusApproved',
      'statusRejected',
      'statusPending',
      'accountLabel',
      'apiKeyLabel',
      'apiKeyCount',
      'apiKeyNone',
      'urlLabel',
      'expiryLabel',
    ]
    expect(Object.keys(ref.devSpace ?? {}).sort()).toEqual([...consumed].sort())
    expect(Object.keys(ref.developerInfo ?? {}).sort()).toEqual(infoLeaves.sort())
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
