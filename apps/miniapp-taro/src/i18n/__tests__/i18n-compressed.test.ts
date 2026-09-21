// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL as NodeURL } from 'node:url'
import { gunzipSync, strFromU8 } from 'fflate'
import { mergeMessages } from '@ihui/i18n/loader'
import type { Locale, Messages } from '@ihui/i18n/types'
import { REMOTE_LOCALE_B64 } from '@/i18n/generated/remote-locales.gen'
import { getMessages } from '@/i18n'

// index.tsx 顶部 import Taro;node 环境下 mock 掉避免加载期副作用(getMessages 本身不依赖 Taro)
vi.mock('@tarojs/taro', () => ({
  default: {},
  getStorageSync: () => '',
  setStorageSync: () => {},
}))

const REMOTE_LOCALES: Locale[] = ['en', 'ja', 'ko', 'zh-TW']

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function readLocaleMessages(locale: Locale): Messages {
  const base = JSON.parse(
    readFileSync(
      fileURLToPath(
        new NodeURL(`../../../../../packages/i18n/messages/shared/${locale}.json`, import.meta.url),
      ),
      'utf8',
    ),
  ) as Messages
  const override = JSON.parse(
    readFileSync(
      fileURLToPath(
        new NodeURL(
          `../../../../../packages/i18n/messages/miniapp-taro/${locale}.json`,
          import.meta.url,
        ),
      ),
      'utf8',
    ),
  ) as Messages
  // 与 @ihui/i18n/loader#mergeMessages 语义一致:浅拷贝 + 普通对象递归
  return mergeMessages(base, override)
}

describe('非中文语言包离线 gzip+base64 无损性', () => {
  for (const locale of REMOTE_LOCALES) {
    it(`${locale}: 解压数据 === mergeMessages(shared, miniapp-taro) 源 JSON`, () => {
      const merged = readLocaleMessages(locale)
      const inflated = JSON.parse(
        strFromU8(
          gunzipSync(b64ToBytes(REMOTE_LOCALE_B64[locale as 'en' | 'ja' | 'ko' | 'zh-TW'])),
        ),
      ) as Messages
      // 深比较证明字节级无损
      expect(inflated).toEqual(merged)
    })
  }
})

describe('getMessages 引用语义', () => {
  it('zh-CN 始终返回同一引用(zhCNMessages)', () => {
    expect(getMessages('zh-CN')).toBe(getMessages('zh-CN'))
  })

  it('非中文 locale 两次调用返回同一引用(惰性缓存生效)', () => {
    expect(getMessages('ja')).toBe(getMessages('ja'))
  })

  it('解压出的 ja 与源 JSON 合并结果一致', () => {
    expect(getMessages('ja')).toEqual(readLocaleMessages('ja'))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
