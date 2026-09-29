// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D162 队列动作「为什么现在不能按」六格具体拒因 + deferred/failed 终态 —— 判定层用例。
// 覆盖:六种不可用态各一条(人为造上下文),断言六条**键互不相同、zh-CN 文案互不相同**
// (同串即未落实);deferred(未发送)与 failed(发送失败)两条终态断言不同。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  QUEUE_ACTION_BLOCK_REASONS,
  QUEUE_BLOCKABLE_ACTIONS,
  QUEUE_SEND_OUTCOMES,
  queueActionBlockReasonKey,
  queueActionBlockView,
  queueSendOutcomeKey,
  queueSendOutcomeView,
  type QueueActionBlockContext,
} from '../input-notices'

const here = dirname(fileURLToPath(import.meta.url))
// __tests__ → chat → src → shared → packages → 仓库根;i18n 词包在 packages/i18n 下
const ZH_CN_MESSAGES = join(here, '../../../../../packages/i18n/messages/web/zh-CN.json')

/** 全绿上下文(六动作都可用) */
const allClear: QueueActionBlockContext = {
  runtimeSupportsInterjection: true,
  hasRunningTurn: true,
  hasWaitingRequests: false,
  isControlCommand: false,
  queueChanged: false,
  sourceMatches: true,
}

/** 六种不可用态各一条:每个用例恰命中一格,六格互不重叠 */
const SIX_BLOCKED_CASES: ReadonlyArray<{
  readonly name: string
  readonly action: (typeof QUEUE_BLOCKABLE_ACTIONS)[number]
  readonly ctx: QueueActionBlockContext
  readonly expected: (typeof QUEUE_ACTION_BLOCK_REASONS)[number]
}> = [
  {
    name: '① Runtime 不支持插话',
    action: 'interject',
    ctx: { ...allClear, runtimeSupportsInterjection: false },
    expected: 'runtimeNoInterject',
  },
  {
    name: '② 无运行中 Turn(支持插话但 Turn 未运行,插话没有落点)',
    action: 'interject',
    ctx: { ...allClear, hasRunningTurn: false },
    expected: 'noRunningTurn',
  },
  {
    name: '③ 控制命令不能插入运行中 Turn',
    action: 'interject',
    ctx: { ...allClear, isControlCommand: true },
    expected: 'controlCommandNoInterject',
  },
  {
    name: '④ 需先处理等待中的请求(前面的排队尚未处理完,引导让行)',
    action: 'steer',
    ctx: { ...allClear, hasWaitingRequests: true },
    expected: 'waitingRequestFirst',
  },
  {
    name: '⑤ 队列已发生变化(并发变更,看到的是旧队列)',
    action: 'reorder',
    ctx: { ...allClear, queueChanged: true },
    expected: 'queueChanged',
  },
  {
    name: '⑥ 来源不符(非语音委派任务)',
    action: 'steer',
    ctx: { ...allClear, sourceMatches: false },
    expected: 'sourceMismatch',
  },
]

describe('D162 六格拒因 / 六种不可用态各一条', () => {
  it('常量表恰为六格六动作,取值互异', () => {
    expect(QUEUE_ACTION_BLOCK_REASONS).toHaveLength(6)
    expect(new Set(QUEUE_ACTION_BLOCK_REASONS).size).toBe(6)
    expect(QUEUE_BLOCKABLE_ACTIONS).toHaveLength(6)
    expect(new Set(QUEUE_BLOCKABLE_ACTIONS).size).toBe(6)
  })

  for (const tc of SIX_BLOCKED_CASES) {
    it(`${tc.name} → ${tc.expected}(blocked + 键名落格)`, () => {
      const view = queueActionBlockView(tc.action, tc.ctx)
      expect(view.blocked).toBe(true)
      expect(view.reason).toBe(tc.expected)
      expect(view.reasonKey).toBe(queueActionBlockReasonKey(tc.expected))
      expect(view.reasonKey).toBe(`blocked.${tc.expected}`)
    })
  }

  it('六格 key 互不相同(同键即未落实)', () => {
    const keys = QUEUE_ACTION_BLOCK_REASONS.map((reason) => queueActionBlockReasonKey(reason))
    expect(new Set(keys).size).toBe(6)
  })

  it('六格 zh-CN 文案互不相同(同串即未落实)', () => {
    const parsed = JSON.parse(readFileSync(ZH_CN_MESSAGES, 'utf8')) as {
      ai?: { pane?: { inputNotices?: { queue?: { blocked?: Record<string, string> } } } }
    }
    const blocked = parsed.ai?.pane?.inputNotices?.queue?.blocked
    expect(blocked, 'ai.pane.inputNotices.queue.blocked 必须落盘').toBeTruthy()
    const texts = QUEUE_ACTION_BLOCK_REASONS.map((reason) => blocked?.[reason])
    for (const text of texts) {
      expect(typeof text === 'string' && text.trim().length > 0).toBe(true)
    }
    expect(new Set(texts).size, '六条文案必须互不相同').toBe(6)
  })

  it('全绿上下文 → 六动作全部可用(reason / reasonKey 恒 null)', () => {
    for (const action of QUEUE_BLOCKABLE_ACTIONS) {
      const view = queueActionBlockView(action, allClear)
      expect(view.blocked, action).toBe(false)
      expect(view.reason, action).toBeNull()
      expect(view.reasonKey, action).toBeNull()
    }
  })
})

describe('D162 终态两分 / deferred(未发送)≠ failed(发送失败)', () => {
  it('恰为两态;两条 labelKey 互不相同(同键即未落实)', () => {
    expect(QUEUE_SEND_OUTCOMES).toEqual(['deferred', 'failed'])
    const deferred = queueSendOutcomeView('deferred')
    const failed = queueSendOutcomeView('failed')
    expect(deferred.labelKey).toBe(queueSendOutcomeKey('deferred'))
    expect(failed.labelKey).toBe(queueSendOutcomeKey('failed'))
    expect(deferred.labelKey).not.toBe(failed.labelKey)
  })

  it('两条 zh-CN 文案互不相同(「没做」与「失败」是两个词)', () => {
    const parsed = JSON.parse(readFileSync(ZH_CN_MESSAGES, 'utf8')) as {
      ai?: { pane?: { inputNotices?: { queue?: { outcome?: Record<string, string> } } } }
    }
    const outcome = parsed.ai?.pane?.inputNotices?.queue?.outcome
    expect(outcome, 'ai.pane.inputNotices.queue.outcome 必须落盘').toBeTruthy()
    const deferredText = outcome?.deferred
    const failedText = outcome?.failed
    expect(typeof deferredText === 'string' && deferredText.trim().length > 0).toBe(true)
    expect(typeof failedText === 'string' && failedText.trim().length > 0).toBe(true)
    expect(deferredText).not.toBe(failedText)
  })

  it('六格拒因文案与两条终态文案之间也无同串(整族零撞句)', () => {
    const parsed = JSON.parse(readFileSync(ZH_CN_MESSAGES, 'utf8')) as {
      ai?: { pane?: { inputNotices?: { queue?: { blocked?: Record<string, string>; outcome?: Record<string, string> } } } }
    }
    const blocked = parsed.ai?.pane?.inputNotices?.queue?.blocked ?? {}
    const outcome = parsed.ai?.pane?.inputNotices?.queue?.outcome ?? {}
    const all = [
      ...QUEUE_ACTION_BLOCK_REASONS.map((reason) => blocked[reason]),
      ...QUEUE_SEND_OUTCOMES.map((o) => outcome[o]),
    ]
    expect(new Set(all).size).toBe(all.length)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
