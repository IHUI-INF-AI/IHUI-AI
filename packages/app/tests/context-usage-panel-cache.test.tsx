// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-225 / G-403(缓存读写 token 三态)在 `packages/app` 共享 RN 屏这一腿的用例。
//
// 为什么要有这个文件:此前 `ContextUsagePanel` 在**全包范围内一条用例都没有**(本包 tests/
// 原本只有 connector-auth-card 与 text-field 两枚)。票面违规的原形状是"上游没回报 ⇒ 端上
// 硬写 null",而 `null`(没采到=未知)与 `0`(真回报,一次都没命中)是两个不同的结论 ——
// 把它们并成一桶,用户看到的"0"就是一条伪造的肯定回答(与守门 134 计数诚实性、G-394 同一条纪律)。
//
// 判点取在**端→共享引擎的边界**上,这是本端此刻唯一真实存在的取数边界:
// 本端(RN 链路)当前没有 usage 源(`ChatScreen.tsx` 调 `<ContextUsagePanel>` 时不强传缓存两维),
// 所以面板**不渲染缓存行**,也就不存在"渲染位"可断言 —— 硬造一个渲染断言就是 vacuous 的红。
// 于是这里钉三件事:①props 缺省/显式 null 都必须以 `null`(未知)交给引擎,绝不折成 0;
// ②引擎收到的 `0` 必须原样是 0(不许与未知并桶);③源码里不得回潮"把上游字段顶掉的硬编码 null"
// 与"把未知折成 0 的兜底"两种形态。
//
// 变异取证:把组件里的 `cacheReadTokens ?? null` 改成 `?? 0` ⇒ 用例 1/2 当场红;
// 改回硬编码 `cacheReadTokens: null` ⇒ 用例 3/4 与用例 5 当场红。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { TFunction } from '@ihui/types'
import type { ChatScreenMessage } from '@ihui/types'
import type { ContextAttribution } from '@ihui/shared/utils'

/** 引擎入参里本票关心的两维(其余字段由 `packages/shared` 自己的用例负责,这里不复制判据) */
interface EngineCacheInput {
  cacheReadTokens?: number | null
  cacheWriteTokens?: number | null
}

const engineCalls = vi.hoisted(() => [] as EngineCacheInput[])

// 替身只重写 computeContextAttribution 这一个出口,其余原样转调真实实现。
interface SharedUtilsSurface {
  computeContextAttribution: (input: EngineCacheInput) => ContextAttribution
  [key: string]: unknown
}

vi.mock('@ihui/shared/utils', async (importOriginal) => {
  const actual = await importOriginal<SharedUtilsSurface>()
  return {
    ...actual,
    // 记账后原样转调真实实现:断言取的是"端交出去了什么",不是把引擎判据抄第二份(§22c)。
    computeContextAttribution: (input: EngineCacheInput): ContextAttribution => {
      engineCalls.push({
        cacheReadTokens: input.cacheReadTokens,
        cacheWriteTokens: input.cacheWriteTokens,
      })
      return actual.computeContextAttribution(input as never)
    },
  }
})

// 本包 vitest 无 RN 运行时(test script = `vitest run --environment jsdom`),
// 按包内既有惯例(text-field.test.tsx)把 RN 原语映射到 DOM 标签。
vi.mock('react-native', () => {
  const flatten = (style: unknown): Record<string, unknown> => {
    if (style === null || style === undefined) return {}
    if (Array.isArray(style)) {
      return style.reduce<Record<string, unknown>>((acc, s) => Object.assign(acc, flatten(s)), {})
    }
    if (typeof style === 'object') return style as Record<string, unknown>
    return {}
  }
  const View = (p: Record<string, unknown>) => createElement('div', p)
  const Text = (p: Record<string, unknown>) => createElement('span', p)
  const Pressable = (p: Record<string, unknown>) =>
    createElement('div', { onClick: p.onPress as never }, p.children as never)
  const StyleSheet = { flatten, create: (s: unknown) => s }
  return { View, Text, Pressable, StyleSheet }
})

import { ContextUsagePanel } from '../src/features/chat/ContextUsagePanel'

/** 词表桩:键名原样回显 —— 本文件不断文案(本端无缓存行可断),只断取数三态 */
const t = ((key: string) => key) as TFunction

const messages: ChatScreenMessage[] = [
  { id: 'u-1', role: 'user', content: '你好' },
  { id: 'a-1', role: 'assistant', content: '在的' },
]

const renderPanel = (props: Record<string, unknown> = {}) => {
  engineCalls.length = 0
  const view = render(
    createElement(ContextUsagePanel, {
      t,
      messages,
      maxTokens: 8_000,
      colorScheme: 'light',
      ...props,
    } as never),
  )
  return { view, handed: engineCalls[0] as EngineCacheInput }
}

describe('ContextUsagePanel 的缓存读写两维三态(G-225)', () => {
  it('宿主不传这两维时,交给引擎的是 null(未知),不是 0', () => {
    const { handed } = renderPanel()
    expect(handed.cacheReadTokens).toBeNull()
    expect(handed.cacheWriteTokens).toBeNull()
    // 显式反证:"没采到"绝不能被读成"一次都没命中"
    expect(handed.cacheReadTokens).not.toBe(0)
    expect(handed.cacheWriteTokens).not.toBe(0)
  })

  it('宿主显式传 null(上游整维缺席)时同样落 null,与"不传"同归未知', () => {
    const { handed } = renderPanel({ cacheReadTokens: null, cacheWriteTokens: null })
    expect(handed).toEqual({ cacheReadTokens: null, cacheWriteTokens: null })
  })

  it('宿主回报 0 时原样传 0(真没命中),绝不与未知并桶', () => {
    const { handed } = renderPanel({ cacheReadTokens: 0, cacheWriteTokens: 0 })
    expect(handed).toEqual({ cacheReadTokens: 0, cacheWriteTokens: 0 })
  })

  it('宿主回报数字时逐值透传(读/写两维各走各的,不互相顶替)', () => {
    const { handed } = renderPanel({ cacheReadTokens: 4_096, cacheWriteTokens: 512 })
    expect(handed).toEqual({ cacheReadTokens: 4_096, cacheWriteTokens: 512 })
  })

  it('源码不回潮:既不硬编码 null 顶掉上游字段,也不把未知兜成 0', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../src/features/chat/ContextUsagePanel.tsx'),
      'utf8',
    )
    // 票面原形状:cacheReadTokens: null, —— 渲染位把上游入参直接覆盖掉
    expect(src).not.toMatch(/^\s*cacheReadTokens:\s*null,\s*$/m)
    expect(src).not.toMatch(/^\s*cacheWriteTokens:\s*null,\s*$/m)
    // 票面红线:为消红把未知折成 0
    expect(src).not.toMatch(/cacheReadTokens\s*(\?\?|\|\|)\s*0/)
    expect(src).not.toMatch(/cacheWriteTokens\s*(\?\?|\|\|)\s*0/)
    // 渲染位折叠必须在场(?? null 把"缺席"与"显式 null"都归未知)
    expect(src).toContain('cacheReadTokens: cacheReadTokens ?? null')
    expect(src).toContain('cacheWriteTokens: cacheWriteTokens ?? null')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
