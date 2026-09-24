// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import zhCN from '@ihui/i18n/messages/extension/zh-CN.json'
import en from '@ihui/i18n/messages/extension/en.json'
import ja from '@ihui/i18n/messages/extension/ja.json'
import ko from '@ihui/i18n/messages/extension/ko.json'
import zhTW from '@ihui/i18n/messages/extension/zh-TW.json'
import { enumLabel, SUBAGENT_ROLE_KEY } from '../entrypoints/sidepanel/components/MessageContent'
import {
  DANGER_LEVEL_KEY,
  MODE_KEY,
} from '../entrypoints/sidepanel/components/AgentRuntimePanel'

const KEY_MAP = {
  allow: 'agent.decisionAllow',
  deny: 'agent.decisionDeny',
} as const

describe('enumLabel', () => {
  const t = (key: string) => `«${key}»`

  it('已登记枚举值走映射取词', () => {
    expect(enumLabel('allow', KEY_MAP, t)).toBe('«agent.decisionAllow»')
    expect(enumLabel('deny', KEY_MAP, t)).toBe('«agent.decisionDeny»')
  })

  it('未登记值原样保留,不做猜测式转换', () => {
    expect(enumLabel('Allow', KEY_MAP, t)).toBe('Allow')
    expect(enumLabel('acceptEdits', KEY_MAP, t)).toBe('acceptEdits')
    expect(enumLabel('some_future_value', KEY_MAP, t)).toBe('some_future_value')
  })

  it('空值显示为破折号占位,不显示空字符串', () => {
    expect(enumLabel(undefined, KEY_MAP, t)).toBe('—')
    expect(enumLabel(null, KEY_MAP, t)).toBe('—')
    expect(enumLabel('', KEY_MAP, t)).toBe('—')
  })
})

const LOCALES: Record<string, unknown> = { 'zh-CN': zhCN, en, ja, ko, 'zh-TW': zhTW }

function resolveKey(locale: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, seg) => {
    if (acc && typeof acc === 'object' && seg in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[seg]
    }
    return undefined
  }, locale)
}

// 端内取词器对缺失键会原样回显键名,所以"parity 通过"不等于"界面上是中文"。
// 这里把映射表里的每个键按真实语言包逐条解析,防止把错键名塞进 UI。
// (decision 字段的取值词不在此列:D55② 起走共享 permissionDecisionWord +
//  packages/i18n shared 词包 stepDecision.*,该路径的可解析性由
//  tests/agent-runtime-permission-decision.test.tsx 咬住。)
describe('枚举映射表键可解析', () => {
  const allKeys = [
    ...Object.values(SUBAGENT_ROLE_KEY),
    ...Object.values(DANGER_LEVEL_KEY),
    ...Object.values(MODE_KEY),
  ]

  it('映射表非空', () => {
    expect(allKeys.length).toBe(21)
  })

  // SearchPage 的 ItemType 映射表:从源码文本里取键,不镜像常量(页面模块含 chrome 依赖,不适合在测试里 import)
  it('SearchPage 内容类型映射表的键同样可解析', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../entrypoints/sidepanel/pages/SearchPage.tsx', import.meta.url)),
      'utf8',
    )
    const block = src.match(/const TYPE_LABEL_KEY[^=]*=\s*\{([\s\S]*?)\n\}/)
    const body = block?.[1] ?? ''
    expect(body, '未找到 TYPE_LABEL_KEY 映射表').not.toBe('')
    const keys = [...body.matchAll(/'([a-zA-Z][\w]*\.[A-Za-z0-9_]+)'/g)]
      .map((m) => m[1])
      .filter((k): k is string => Boolean(k))
    expect(keys).toHaveLength(7)
    for (const [lang, locale] of Object.entries(LOCALES)) {
      const broken = keys.filter((key) => {
        const v = resolveKey(locale, key)
        return typeof v !== 'string' || v.trim() === '' || v === key
      })
      expect(broken, `${lang} 取不到值`).toEqual([])
    }
  })

  for (const [lang, locale] of Object.entries(LOCALES)) {
    it(`${lang}: 全部键取到非空文案且未回显键名`, () => {
      const broken = allKeys.filter((key) => {
        const v = resolveKey(locale, key)
        return typeof v !== 'string' || v.trim() === '' || v === key
      })
      expect(broken).toEqual([])
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
