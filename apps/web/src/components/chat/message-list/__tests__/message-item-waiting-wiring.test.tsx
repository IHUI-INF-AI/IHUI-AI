// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D79 web 接线端到端取证:证的是 **MessageItem 渲染位** 真的把象限/阶段/seed 传给了
// TypingIndicator。同目录 typing-indicator-waiting-pool.test.tsx 只证"组件 honors 入参",
// 那一层无法发现"渲染位漏传"(2026-09 之前的生产态就是漏传 ⇒ 恒走固定串"等待响应…")。
//
// 关键取舍:typingTurn 取的是 `useChatStore.getState().messages`,所以这里喂**真 zustand
// store**(setState 注入消息),不 mock 数据源 —— 一旦把 store 换成假对象,本用例就退化成
// 又一条"入参用例",接线仍没被咬住。
//
// 判定按 **ns** 而非 key 前缀:渲染位把 `waiting.` 前缀剥掉后才交给
// useTranslations('waiting'),按前缀判会永远不命中 ⇒ 静默落英文兜底表的"假绿"。
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveWaitingText, type WaitingPhase } from '@ihui/shared/chat'

/** 固定串哨兵:池文案与固定串互斥,由此区分"接线"与"回退" */
const FIXED_SENTINEL = '[固定串]'
/** 池取词哨兵(仅 ns='waiting' 命中) */
const POOL_MARK = '[池:'
/** 假时钟:seed 含 `Math.floor(Date.now()/4000)` 时间桶,不钉死则期望值漂移 */
const NOW = Date.UTC(2026, 8, 23, 12, 34, 56)
const TIME_BUCKET = Math.floor(NOW / 4000)

// 哨兵字符串在 mock 工厂内必须写字面量(vi.mock 工厂被提升到 const 之前,引用 const 会撞 TDZ),
// 下面两个常量与其逐字一致,由用例断言保证不脱钩。
vi.mock('next-intl', () => ({
  useTranslations:
    (ns: string) =>
    (key: string): string => {
      if (ns === 'waiting') return `[池:${key}]`
      if (key === 'waitingResponse') return '[固定串]'
      return key
    },
  useLocale: () => 'zh-CN',
}))

import { MessageItem } from '../MessageItem'
import { useChatStore, type ChatMessage } from '@/stores/chat'

const TARGET_ID = 'a-waiting'

function userMsg(id: string, content: string): ChatMessage {
  return { id, role: 'user', content, createdAt: NOW }
}

/** 等待首 token 的助手消息:content 空 + 无 reasoning + 无 running 工具(三者任一非空都会绕开等待池) */
function waitingAssistant(): ChatMessage {
  return { id: TARGET_ID, role: 'assistant', content: '', createdAt: NOW }
}

/**
 * 期望词表键:用 shared 的同一个纯函数(公开 API)按"应算出的 seed"反查,
 * 不手抄下标 —— 手抄等于把接线断言降级成常量比对。
 */
function expectedPoolKey(phase: WaitingPhase, seed: number): string {
  const raw = resolveWaitingText({ quadrant: 'agent', phase, seed, t: (k) => `«${k}»` })
  expect(raw).toMatch(/^«waiting\.agent\.[a-z]+\.\d+»$/)
  return raw.slice('«waiting.agent.'.length, -1)
}

/** 从渲染结果里解析"象限/阶段/下标",顺带证明既不是固定串也没落英文兜底表 */
function readRenderedTurn(): { quadrant: string; phase: string; index: number; text: string } {
  const text = screen.getByTestId('typing-indicator').textContent ?? ''
  const matched = new RegExp(`\\${POOL_MARK}(\\w+)\\.(\\w+)\\.(\\d+)\\]`).exec(text)
  if (!matched || typeof matched[1] !== 'string' || typeof matched[2] !== 'string') {
    throw new Error(`等待态未取到池文案(疑漏传象限/阶段),text=${text}`)
  }
  expect(text).not.toContain(FIXED_SENTINEL)
  return { quadrant: matched[1], phase: matched[2], index: Number(matched[3]), text }
}

/** 把消息灌进真 store 后渲染目标助手条目(等待首 token 态) */
function renderWaitingTurn(messages: ChatMessage[]): ReturnType<typeof readRenderedTurn> {
  useChatStore.setState({ messages })
  const target = messages.find((m) => m.id === TARGET_ID)
  expect(target).toBeDefined()
  render(<MessageItem message={target!} isLast isStreaming assistantLabel="AI" />)
  return readRenderedTurn()
}

afterEach(() => {
  cleanup()
  useChatStore.setState({ messages: [] })
})

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW)
})

describe('MessageItem 等待态接线(D79,store 驱动)', () => {
  it('等待首 token:渲染位取到池文案,不是固定串 waitingResponse', () => {
    const turn = renderWaitingTurn([waitingAssistant()])
    expect(turn.quadrant).toBe('agent')
    expect(turn.index).toBe(Number(expectedPoolKey('first', TIME_BUCKET).split('.').pop()))
  })

  it('本条之前没有 user 消息 → 阶段 first,seed = 上一条长度(0)+ 时间桶', () => {
    const turn = renderWaitingTurn([waitingAssistant()])
    expect(`${turn.phase}.${turn.index}`).toBe(expectedPoolKey('first', 0 + TIME_BUCKET))
  })

  it('本条之前有 user 消息 → 阶段 followup,seed = 该条内容长度 + 时间桶', () => {
    const prior = userMsg('u-1', 'a'.repeat(5))
    const turn = renderWaitingTurn([prior, waitingAssistant()])
    expect(`${turn.phase}.${turn.index}`).toBe(expectedPoolKey('followup', 5 + TIME_BUCKET))
  })

  it('seed 真的来自 store:上一条 user 内容变长 → 命中池内不同变体', () => {
    const lengths = [5, 9] as const
    const seen = new Set<string>()
    for (const length of lengths) {
      const turn = renderWaitingTurn([userMsg('u-1', 'a'.repeat(length)), waitingAssistant()])
      const expected = expectedPoolKey('followup', length + TIME_BUCKET)
      expect(`${turn.phase}.${turn.index}`).toBe(expected)
      seen.add(turn.text)
      cleanup()
    }
    expect(seen.size).toBe(lengths.length)
  })

  // 防"seed 断言恒真":TypingIndicator 的缺省是 `waitSeed ?? 0` ⇒ 下标 0。
  // 若假时钟挑到下标 0 的组合,漏传 seed 也能过 → 本用例即失去变异取证能力。
  it('自检:假时钟下的期望下标均非 0(否则 seed 漏传不会被咬住)', () => {
    for (const [phase, seed] of [
      ['first', TIME_BUCKET],
      ['followup', 5 + TIME_BUCKET],
      ['followup', 9 + TIME_BUCKET],
    ] as const) {
      const index = Number(expectedPoolKey(phase, seed).split('.').pop())
      expect(index, `phase=${phase}`).not.toBe(0)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
