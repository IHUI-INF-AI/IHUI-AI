// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D79 等待态轮换池 —— miniapp-taro 接线层用例。
// 端内 vitest 是 `environment:'node'`(无 jsdom,`@tarojs/components` 渲染级测不到),
// 故分两层钉住:① 纯函数层(取词/回退/确定性)② 渲染位源码结构层(证明页面**确实**调了
// buildTaroWaitingText,而不是仍挂着固定串)—— 缺第②层则"把接线退回固定串"测不出红。
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  buildTaroWaitingText,
  deriveTaroWaitingTurn,
  TARO_THINKING_FALLBACK,
} from '../waiting-text'

/**
 * 可辨识合成词表:覆盖 agent 池的**全部**下标(池长 5,不硬编码 seed 命中的是哪一条)。
 * 只认 waiting.agent.<phase>.<n> 键 ⇒ 顺带钉住"渲染位给的象限/阶段/下标"契约形状。
 */
function synthT(key: string): string | undefined {
  const hit = /^waiting\.agent\.(first|followup)\.(\d)$/.exec(key)
  if (!hit) return undefined
  return `【${hit[1] === 'first' ? '首轮' : '追问'}】${hit[2]}`
}

/** 反解合成文案 → [阶段, 下标] */
const SYNTH = /【(首轮|追问)】(\d)$/

describe('buildTaroWaitingText — 不进池条件回退固定串', () => {
  it('无本轮输入(seed 缺失 / 全空白)时回退固定串,不抛随机池文案', () => {
    expect(buildTaroWaitingText({ prompt: '', userMessageCount: 1 })).toBe(TARO_THINKING_FALLBACK)
    expect(buildTaroWaitingText({ prompt: '   ', userMessageCount: 3 })).toBe(
      TARO_THINKING_FALLBACK,
    )
  })

  it('人格化开关关闭时回退固定串', () => {
    expect(
      buildTaroWaitingText({
        prompt: '帮我写首诗',
        userMessageCount: 1,
        personaEnabled: false,
        t: synthT,
      }),
    ).toBe(TARO_THINKING_FALLBACK)
  })
})

describe('buildTaroWaitingText — 进池', () => {
  it('给足 seed 即出池文案,且不再是固定串', () => {
    const text = buildTaroWaitingText({
      prompt: '帮我写首诗',
      userMessageCount: 1,
      t: synthT,
    })
    expect(text).not.toBe(TARO_THINKING_FALLBACK)
    expect(SYNTH.test(text)).toBe(true)
  })

  it('无词表也进池(落共享层英文回退池,绝不回显 raw key、绝不落回固定串)', () => {
    const text = buildTaroWaitingText({ prompt: '帮我写首诗', userMessageCount: 1 })
    expect(text).not.toBe(TARO_THINKING_FALLBACK)
    expect(text.startsWith('waiting.')).toBe(false)
  })

  it('首轮与追问取不同池(证明 phase 派生真接上了)', () => {
    const first = buildTaroWaitingText({
      prompt: '帮我写首诗',
      userMessageCount: 1,
      t: synthT,
    })
    const followup = buildTaroWaitingText({
      prompt: '帮我写首诗',
      userMessageCount: 2,
      t: synthT,
    })
    expect(SYNTH.exec(first)?.[1]).toBe('首轮')
    expect(SYNTH.exec(followup)?.[1]).toBe('追问')
    expect(first).not.toBe(followup)
  })
})

describe('buildTaroWaitingText — 确定性(seed 取模,禁 Math.random)', () => {
  it('同 seed 稳定:重复调用输出完全一致', () => {
    const input = { prompt: '解释一下 RLS', userMessageCount: 1, t: synthT }
    expect(buildTaroWaitingText(input)).toBe(buildTaroWaitingText(input))
  })

  it('异 seed 会变:多条不同输入不会全撞同一条', () => {
    const seen = new Set<string>()
    for (const prompt of ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛']) {
      seen.add(buildTaroWaitingText({ prompt, userMessageCount: 1, t: synthT }))
    }
    expect(seen.size).toBeGreaterThan(1)
  })
})

describe('deriveTaroWaitingTurn — seed 与 phase 原料取自会话消息', () => {
  it('取末条 user 消息作本轮输入,user 条数判阶段', () => {
    const derived = deriveTaroWaitingTurn([
      { role: 'user', content: '第一问' },
      { role: 'assistant', content: '答一' },
      { role: 'user', content: '第二问' },
      { role: 'assistant', content: '答二(流式中不占位)' },
      { role: 'user', content: '第三问' },
    ])
    expect(derived).toEqual({ prompt: '第三问', userMessageCount: 3 })
  })

  it('空会话派生出空 seed ⇒ 渲染位拿到固定串(链路闭合)', () => {
    const derived = deriveTaroWaitingTurn([])
    expect(buildTaroWaitingText({ ...derived })).toBe(TARO_THINKING_FALLBACK)
  })
})

describe('渲染位接线(index.tsx 源码结构层)', () => {
  const pagePath = path.resolve(__dirname, '../../../pages/index/index.tsx')
  const source = readFileSync(pagePath, 'utf8')
  // loading 占位块:state.isStreaming && !state.streamingContent ? … : null
  const blockStart = source.indexOf('state.isStreaming && !state.streamingContent')
  const block = blockStart >= 0 ? source.slice(blockStart, blockStart + 1200) : ''

  it('页面 import 了端内接线层', () => {
    expect(source).toMatch(/from\s+'@\/pkg-ai\/ai\/waiting-text'/)
  })

  it('等待占位块改调 buildTaroWaitingText(变异取证:退回固定串即红)', () => {
    expect(blockStart).toBeGreaterThanOrEqual(0)
    expect(block).toContain('buildTaroWaitingText(')
    expect(block).toContain('deriveTaroWaitingTurn(state.conversationMessages)')
    expect(block).not.toContain("tt('index.thinking'")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
