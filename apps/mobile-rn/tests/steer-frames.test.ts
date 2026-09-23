// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D106 Steer(中途引导)承接:mobile-rn 此前对 onSteer 交代帧 0 消费。
// 锁住累积层四条性质:逐字段承接不丢、追加不被覆盖、空文本帧整帧丢弃(不渲染空交代)、
// 单消息 8 条封顶(对齐 web appendSteerNotice / 后端 _STEER_QUEUE_LIMIT)。
// 另锁 i18n:steer 文案键在 5 种语言覆盖齐全且非空(禁止硬编码中文界面文本)。
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

import {
  STEER_NOTICE_MAX_PER_MESSAGE,
  appendSteerFrames,
  type SteerNotice,
} from '../src/utils/chat-render-model'

const base: SteerNotice = {
  phase: 'injected',
  text: '回答时优先引用项目内文档',
  timestamp: '2026-09-24T08:00:00.000Z',
  messageId: 'assistant-1',
}

describe('appendSteerFrames(D106 承接)', () => {
  it('undefined 起点 → 单条,phase/text/timestamp/messageId 逐字段显式承接', () => {
    expect(appendSteerFrames(undefined, base)).toEqual([base])
  })

  it('多条引导追加不互相覆盖(一条回答可被多次引导)', () => {
    const once = appendSteerFrames(undefined, base)
    const twice = appendSteerFrames(once, { ...base, text: '语气再正式一点' })
    expect(twice.map((x) => x.text)).toEqual(['回答时优先引用项目内文档', '语气再正式一点'])
  })

  it('空文本与纯空白帧整帧丢弃(提示不出现)', () => {
    expect(appendSteerFrames(undefined, { ...base, text: '' })).toEqual([])
    expect(appendSteerFrames(undefined, { ...base, text: '   \n\t ' })).toEqual([])
  })

  it('累积后遇到空帧,已有交代原样保留', () => {
    const once = appendSteerFrames(undefined, base)
    const twice = appendSteerFrames(once, { ...base, text: ' ' })
    expect(twice).toEqual([base])
  })

  it('后端未给 timestamp/messageId 时不写空字段', () => {
    const out = appendSteerFrames(undefined, { phase: 'injected', text: '简短一点' })
    expect('timestamp' in (out[0] ?? {})).toBe(false)
    expect('messageId' in (out[0] ?? {})).toBe(false)
  })

  it(`单消息 ${STEER_NOTICE_MAX_PER_MESSAGE} 条封顶,超出静默丢弃`, () => {
    let list: SteerNotice[] | undefined
    for (let i = 0; i < STEER_NOTICE_MAX_PER_MESSAGE + 3; i += 1) {
      list = appendSteerFrames(list, { ...base, text: `引导 ${i}` })
    }
    expect(list).toHaveLength(STEER_NOTICE_MAX_PER_MESSAGE)
    expect(list?.[0]?.text).toBe('引导 0')
  })

  it('超过上限后收到空帧仍返回原内容(不崩不增)', () => {
    let list: SteerNotice[] | undefined
    for (let i = 0; i < STEER_NOTICE_MAX_PER_MESSAGE; i += 1) {
      list = appendSteerFrames(list, { ...base, text: `引导 ${i}` })
    }
    expect(appendSteerFrames(list, { ...base, text: '' })).toHaveLength(
      STEER_NOTICE_MAX_PER_MESSAGE,
    )
  })
})

describe('steer 文案键覆盖(D106 i18n,直锁端词表正仓)', () => {
  const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const
  const repoRoot = resolve(fileURLToPath(import.meta.url), '../../../..')

  const disclosureOf = (locale: (typeof LOCALES)[number]) => {
    const json = JSON.parse(
      readFileSync(
        resolve(repoRoot, `packages/i18n/messages/mobile-rn/${locale}.json`),
        'utf-8',
      ),
    ) as Record<string, Record<string, string>>
    return json.chatDisclosure
  }

  it('五种语言都补齐 steerTitle / steerMore 且非空', () => {
    for (const locale of LOCALES) {
      const ns = disclosureOf(locale)
      expect(ns?.steerTitle).toBeTruthy()
      expect(ns?.steerMore).toBeTruthy()
    }
  })

  it('中文文案对齐 web 词表口径(已引导 {count} 次 / 等 {count} 条)', () => {
    const ns = disclosureOf('zh-CN')
    expect(ns?.steerTitle).toBe('已引导 {count} 次')
    expect(ns?.steerMore).toBe('等 {count} 条')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
