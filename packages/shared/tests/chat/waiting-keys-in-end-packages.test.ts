// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D79 等待态词包防回潮断言。
// 等待池(packages/shared/src/chat/waiting-pool)按 象限×阶段×下标 产词表键,
// 池本身只内联英文兜底;非英文真相在 packages/i18n/messages/shared。
// 本用例钉住三件事:
//  1. 池的每个 waiting.* 键在 5 端词包 × 5 语言里至少存在于一处(缺了 → 端上取词回退英文);
//  2. 已落的值必须逐字等于"池对该语言/该下标的返回值"(不允许多语言各写一套);
//  3. 每端 5 语言 waiting 键集合对称(只补一种语言 = 红)。
// 以后新增象限/阶段/变体而忘补词包,这里立刻红,而不是等用户看到英文兜底。

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  WAITING_LOCALES,
  WAITING_PHASES,
  WAITING_QUADRANTS,
  WAITING_VIVID_TAIL_EN,
  resolveWaitingText,
  waitingI18nKey,
  waitingI18nKeyList,
} from '../../src/chat/waiting-pool'

// 本测试原在 packages/i18n/tests/ 下,按相对路径穿透进 packages/shared 实现 ⇒ 架构契约门判
// D1(未声明依赖)+D2(i18n rank 20 反向依赖 shared rank 30)。**换 import 写法消不掉 D2**
// (D2 只比 rank 数值),而把 i18n 挪层属"挪层消红"被禁 ⇒ 唯一合规出路是让测试待在**不反向**
// 的那一层:它读各端 JSON 词包用的是 readFileSync(不构成 import 边),故放 shared 同包内即零跨模块边。
const REPO_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../..')
const END_PACKAGES = ['web', 'extension', 'mobile-rn', 'miniapp-taro', 'cli'] as const
const END_DIR: Record<(typeof END_PACKAGES)[number], string> = {
  web: 'packages/i18n/messages/web',
  extension: 'packages/i18n/messages/extension',
  'mobile-rn': 'packages/i18n/messages/mobile-rn',
  'miniapp-taro': 'packages/i18n/messages/miniapp-taro',
  cli: 'packages/i18n/messages/cli',
}
type End = (typeof END_PACKAGES)[number]
type Locale = (typeof WAITING_LOCALES)[number]

const cache = new Map<string, Record<string, unknown>>()
function loadMessages(dir: string, locale: Locale): Record<string, unknown> {
  const id = `${dir}/${locale}`
  let doc = cache.get(id)
  if (!doc) {
    doc = JSON.parse(readFileSync(join(REPO_ROOT, dir, `${locale}.json`), 'utf8')) as Record<
      string,
      unknown
    >
    cache.set(id, doc)
  }
  return doc
}

function leafAt(doc: Record<string, unknown>, dottedKey: string): unknown {
  return dottedKey
    .split('.')
    .reduce<unknown>(
      (acc, seg) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[seg] : undefined,
      doc,
    )
}

const POOL_KEYS = waitingI18nKeyList()

/** 池对某语言/某键的返回值 = 注入 shared 词表后 resolveWaitingText 的输出(词表是唯一非英文真相) */
function poolValueFor(locale: Locale, key: string): string {
  const shared = loadMessages('packages/i18n/messages/shared', locale)
  const t = (k: string) => {
    const v = leafAt(shared, k)
    return typeof v === 'string' ? v : undefined
  }
  if (key === 'waiting.vividTail') {
    return resolveWaitingText({
      quadrant: 'agent',
      phase: 'first',
      seed: 0,
      locale,
      persona: 'vivid',
      t,
    }).slice(resolveWaitingText({ quadrant: 'agent', phase: 'first', seed: 0, locale, t }).length)
  }
  const [, quadrant, phase, index] = key.split('.')
  return resolveWaitingText({
    quadrant: quadrant as (typeof WAITING_QUADRANTS)[number],
    phase: phase as (typeof WAITING_PHASES)[number],
    seed: Number(index),
    locale,
    t,
  })
}

describe('D79 waiting 池词包落地', () => {
  it('键清单确为 象限×阶段×5 变体 + vividTail', () => {
    const body = POOL_KEYS.filter((k) => k !== 'waiting.vividTail')
    expect(body.length).toBe(WAITING_QUADRANTS.length * WAITING_PHASES.length * 5)
    for (const quadrant of WAITING_QUADRANTS)
      for (const phase of WAITING_PHASES)
        for (let i = 0; i < 5; i += 1)
          expect(POOL_KEYS).toContain(waitingI18nKey(quadrant, phase, i))
    expect(POOL_KEYS).toContain('waiting.vividTail')
  })

  it('池英文内联兜底与 shared en 词表逐字一致(否则就是两套真相)', () => {
    for (const key of POOL_KEYS) {
      const inDict = leafAt(loadMessages('packages/i18n/messages/shared', 'en'), key)
      if (key === 'waiting.vividTail') {
        expect(inDict).toBe(WAITING_VIVID_TAIL_EN)
        continue
      }
      const [, quadrant, phase, index] = key.split('.')
      const inline = resolveWaitingText({
        quadrant: quadrant as (typeof WAITING_QUADRANTS)[number],
        phase: phase as (typeof WAITING_PHASES)[number],
        seed: Number(index),
      })
      expect(inDict).toBe(inline)
    }
  })

  it.each(WAITING_LOCALES.map((locale) => [locale] as const))(
    '每个 waiting.* 键在五语言端包至少存在于一处且值等于池返回值(%s)',
    (rawLocale) => {
      const locale = rawLocale as Locale
      const missing: string[] = []
      const drifted: string[] = []
      for (const key of POOL_KEYS) {
        const expectValue = poolValueFor(locale, key)
        const hits = END_PACKAGES.filter((end) => {
          const v = leafAt(loadMessages(END_DIR[end], locale), key)
          if (typeof v === 'string' && v !== expectValue)
            drifted.push(`${end}:${key}=${JSON.stringify(v)} != ${JSON.stringify(expectValue)}`)
          return typeof v === 'string'
        })
        if (hits.length === 0) missing.push(`${locale}:${key}`)
      }
      expect({ missing, drifted }).toEqual({ missing: [], drifted: [] })
    },
  )

  it.each(END_PACKAGES.map((end) => [end] as const))(
    '端包 %s 的 waiting 五语言键集合对称',
    (rawEnd) => {
      const end = rawEnd as End
      const perLocale = WAITING_LOCALES.map((locale) => {
        const doc = loadMessages(END_DIR[end], locale)
        const waiting = doc.waiting
        const flat = new Set<string>()
        const walk = (node: unknown, prefix: string) => {
          if (node && typeof node === 'object' && !Array.isArray(node)) {
            for (const [k, v] of Object.entries(node as Record<string, unknown>))
              walk(v, prefix ? `${prefix}.${k}` : k)
          } else if (prefix) flat.add(prefix)
        }
        walk(waiting, '')
        return flat
      })
      const baseline = perLocale[0]
      expect(baseline.size).toBe(POOL_KEYS.length)
      for (const [i, set] of perLocale.entries())
        expect([...set].sort(), WAITING_LOCALES[i]).toEqual([...baseline].sort())
      for (const key of POOL_KEYS) {
        const path = key.split('.').slice(1).join('.')
        const leaf = path
          .split('.')
          .reduce<unknown>(
            (acc, seg) =>
              acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[seg] : undefined,
            loadMessages(END_DIR[end], 'zh-CN').waiting,
          )
        expect(typeof leaf, `${end}:${key}`).toBe('string')
      }
    },
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
